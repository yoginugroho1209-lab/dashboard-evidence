/**
 * Object Detection Service using TensorFlow.js
 * Detects poles (tiang listrik) in uploaded images
 */

import * as tf from '@tensorflow/tfjs';

// COCO dataset class index for common objects we care about
const COCO_CLASSES = {
    0: 'person',
    1: 'bicycle',
    2: 'car',
    3: 'motorcycle',
    5: 'bus',
    7: 'truck',
    // COCO doesn't have "pole" directly, but we can detect:
    // - traffic light (9) often on poles
    // - stop sign (11) often on poles  
    // - fire hydrant (10) near poles
    9: 'traffic_light',
    10: 'fire_hydrant',
    11: 'stop_sign',
};

// For pole detection, we'll use a custom approach since COCO doesn't have pole class
// We'll detect vertical structures and classify them as potential poles

let model = null;
let isModelLoading = false;

/**
 * Load the COCO-SSD model for object detection
 */
export const loadModel = async () => {
    if (model) return model;
    if (isModelLoading) {
        // Wait for model to load
        while (isModelLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return model;
    }

    isModelLoading = true;
    try {
        // Use TensorFlow.js COCO-SSD model (lightweight, good for browser)
        // Note: For production, you'd want to use a custom-trained YOLOv8 model
        await tf.ready();

        // Load COCO-SSD from TensorFlow Hub
        const cocoSsd = await import('@tensorflow-models/coco-ssd');
        model = await cocoSsd.load({
            base: 'lite_mobilenet_v2' // Lighter model for faster inference
        });

        console.log('✅ Object detection model loaded');
        return model;
    } catch (error) {
        console.error('❌ Failed to load model:', error);
        throw error;
    } finally {
        isModelLoading = false;
    }
};

/**
 * Detect objects in an image using COCO-SSD
 * @param {HTMLImageElement} imageElement - The image to analyze
 * @returns {Array} Array of detected objects with bounding boxes
 */
export const detectObjects = async (imageElement) => {
    try {
        const loadedModel = await loadModel();
        const predictions = await loadedModel.detect(imageElement);

        // Transform predictions to our format
        return predictions.map(pred => ({
            label: pred.class,
            confidence: pred.score,
            bbox: {
                x: pred.bbox[0],
                y: pred.bbox[1],
                w: pred.bbox[2],
                h: pred.bbox[3]
            }
        }));
    } catch (error) {
        console.error('Detection error:', error);
        return [];
    }
};

/**
 * Detect poles in an image using edge detection and vertical line analysis
 * This is a simple heuristic approach for pole detection
 * @param {HTMLImageElement} imageElement - The image to analyze
 * @returns {Array} Array of detected poles
 */
export const detectPoles = async (imageElement) => {
    try {
        console.log('Starting pole detection...');
        const startTime = Date.now();

        // Run both detections in parallel
        // 1. COCO-SSD (AI Model) - might be slow due to network/loading
        const cocoPromise = new Promise(async (resolve) => {
            try {
                // Add 5s timeout for AI detection
                const aiTimeout = new Promise(r => setTimeout(() => r(null), 5000));
                const detection = detectObjects(imageElement);
                const result = await Promise.race([detection, aiTimeout]);

                if (!result) {
                    console.warn('AI detection timed out, skipping...');
                    resolve([]);
                } else {
                    resolve(result);
                }
            } catch (e) {
                console.warn('AI detection failed:', e);
                resolve([]);
            }
        });

        // 2. Heuristic Analysis (Canvas/Edge Detection) - fast & local
        const heuristicPromise = analyzeForPoles(imageElement);

        // Wait for both
        const [cocoDetections, poleDetections] = await Promise.all([
            cocoPromise,
            heuristicPromise
        ]);

        console.log(`Detection finished in ${Date.now() - startTime}ms`);
        console.log('COCO detections:', cocoDetections);
        console.log('Heuristic pole detections:', poleDetections);

        // Combine results
        const allDetections = [
            ...poleDetections,
            ...cocoDetections.filter(d =>
                ['traffic_light', 'stop_sign', 'fire_hydrant'].includes(d.label)
            )
        ];

        // Fallback: if no detection and image looks like it has vertical structures
        if (allDetections.length === 0) {
            console.log('⚠️ No detections found, trying simple color variance analysis...');
            const simpleDetection = await simpleVerticalDetection(imageElement);
            if (simpleDetection) {
                allDetections.push(simpleDetection);
            }
        }

        console.log('Final detections:', allDetections);
        return allDetections;
    } catch (error) {
        console.error('Pole detection error:', error);
        return [];
    }
};

/**
 * Simple fallback detection - analyzes image for any vertical dark structures
 * This is used when the main heuristic doesn't detect anything
 */
const simpleVerticalDetection = async (imageElement) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Scale down for fast processing
        const maxSize = 200;
        const scale = Math.min(maxSize / imageElement.width, maxSize / imageElement.height, 1);
        canvas.width = imageElement.width * scale;
        canvas.height = imageElement.height * scale;

        ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        // Find darkest vertical column (likely to be a pole)
        let darkestColumn = -1;
        let darkestValue = 255;

        for (let x = Math.floor(width * 0.2); x < Math.floor(width * 0.8); x++) {
            let columnSum = 0;
            let count = 0;

            for (let y = 0; y < height; y++) {
                const idx = (y * width + x) * 4;
                const gray = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114);
                columnSum += gray;
                count++;
            }

            const avgBrightness = columnSum / count;
            if (avgBrightness < darkestValue) {
                darkestValue = avgBrightness;
                darkestColumn = x;
            }
        }

        // If we found a notably dark column (potential pole)
        if (darkestColumn > 0 && darkestValue < 150) {
            console.log(`Found potential pole at column ${darkestColumn} with brightness ${darkestValue}`);
            resolve({
                label: 'Struktur Vertikal',
                confidence: 0.5 + (0.3 * (1 - darkestValue / 150)), // Higher confidence for darker
                bbox: {
                    x: (darkestColumn / scale) - 20,
                    y: 0,
                    w: 40,
                    h: imageElement.height
                }
            });
        } else {
            console.log('No vertical structures detected in fallback');
            resolve(null);
        }
    });
};

/**
 * Analyze image for vertical structures (poles)
 * Uses edge detection to find vertical lines
 */
const analyzeForPoles = async (imageElement) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Scale down for faster processing
        const maxSize = 300;
        const scale = Math.min(maxSize / imageElement.width, maxSize / imageElement.height, 1);
        canvas.width = imageElement.width * scale;
        canvas.height = imageElement.height * scale;

        ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Convert to grayscale and detect edges
        const width = canvas.width;
        const height = canvas.height;
        const grayData = new Uint8Array(width * height);

        for (let i = 0; i < data.length; i += 4) {
            const gray = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
            grayData[i / 4] = gray;
        }

        // Simple vertical edge detection
        const poles = [];
        const verticalLines = [];

        // Scan for vertical edges
        for (let x = 1; x < width - 1; x++) {
            let lineStart = -1;
            let lineLength = 0;

            for (let y = 1; y < height - 1; y++) {
                const idx = y * width + x;
                const left = grayData[idx - 1];
                const right = grayData[idx + 1];
                const diff = Math.abs(left - right);

                // Horizontal gradient indicates vertical edge (lowered threshold for better detection)
                if (diff > 15) {
                    if (lineStart === -1) lineStart = y;
                    lineLength++;
                } else {
                    // End of line segment
                    if (lineLength > height * 0.15) { // Line must be at least 15% of image height (relaxed)
                        verticalLines.push({
                            x: x / scale,
                            yStart: lineStart / scale,
                            yEnd: (lineStart + lineLength) / scale,
                            length: lineLength / scale
                        });
                    }
                    lineStart = -1;
                    lineLength = 0;
                }
            }
        }

        // Cluster nearby vertical lines as poles
        const clustered = clusterVerticalLines(verticalLines);

        clustered.forEach((cluster, idx) => {
            if (cluster.length > 0) {
                const avgX = cluster.reduce((sum, l) => sum + l.x, 0) / cluster.length;
                const minY = Math.min(...cluster.map(l => l.yStart));
                const maxY = Math.max(...cluster.map(l => l.yEnd));

                poles.push({
                    label: 'Tiang Listrik',
                    confidence: Math.min(0.7 + cluster.length * 0.05, 0.95),
                    bbox: {
                        x: avgX - 15,
                        y: minY,
                        w: 30,
                        h: maxY - minY
                    }
                });
            }
        });

        resolve(poles.slice(0, 5)); // Max 5 poles per image
    });
};

/**
 * Cluster nearby vertical lines
 */
const clusterVerticalLines = (lines, threshold = 20) => {
    if (lines.length === 0) return [];

    const clusters = [];
    const used = new Set();

    lines.forEach((line, i) => {
        if (used.has(i)) return;

        const cluster = [line];
        used.add(i);

        lines.forEach((other, j) => {
            if (i !== j && !used.has(j)) {
                if (Math.abs(line.x - other.x) < threshold) {
                    cluster.push(other);
                    used.add(j);
                }
            }
        });

        if (cluster.length >= 1) { // At least 1 vertical line to consider as pole (relaxed)
            clusters.push(cluster);
        }
    });

    return clusters;
};

/**
 * Draw detection results on canvas
 */
export const drawDetections = (canvas, detections) => {
    const ctx = canvas.getContext('2d');

    detections.forEach(det => {
        const { bbox, label, confidence } = det;

        // Draw bounding box
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 3;
        ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);

        // Draw label background
        ctx.fillStyle = '#00FF00';
        const text = `${label} ${(confidence * 100).toFixed(0)}%`;
        const textMetrics = ctx.measureText(text);
        ctx.fillRect(bbox.x, bbox.y - 25, textMetrics.width + 10, 25);

        // Draw label text
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(text, bbox.x + 5, bbox.y - 7);
    });
};

export default {
    loadModel,
    detectObjects,
    detectPoles,
    drawDetections
};
