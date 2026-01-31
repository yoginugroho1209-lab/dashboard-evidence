/**
 * Object Detection Service using Custom YOLOv8 ONNX Model
 * Detects poles (tiang) in uploaded images
 */

import * as ort from 'onnxruntime-web';

let session = null;
let isModelLoading = false;

// Class names from your training
const CLASS_NAMES = ['tiang'];

/**
 * Load the custom ONNX model
 */
export const loadModel = async () => {
    if (session) return session;
    if (isModelLoading) {
        while (isModelLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        return session;
    }

    isModelLoading = true;
    try {
        console.log('🔄 Loading custom tiang detection model...');

        // Configure ONNX Runtime WASM
        ort.env.wasm.numThreads = 1;
        ort.env.wasm.simd = true;

        session = await ort.InferenceSession.create('https://wrwlibyrpoqknaycwlex.supabase.co/storage/v1/object/public/models/tiang_model.onnx', {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'basic'
        });

        console.log('✅ Custom model loaded successfully!');
        console.log('Input names:', session.inputNames);
        console.log('Output names:', session.outputNames);

        return session;
    } catch (error) {
        console.error('❌ Failed to load model:', error);
        throw error;
    } finally {
        isModelLoading = false;
    }
};

/**
 * Preprocess image for YOLOv8 (resize to 640x640, normalize)
 */
const preprocessImage = (imageElement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const targetSize = 640;
    canvas.width = targetSize;
    canvas.height = targetSize;

    // Calculate scaling to maintain aspect ratio
    const scale = Math.min(targetSize / imageElement.width, targetSize / imageElement.height);
    const scaledWidth = imageElement.width * scale;
    const scaledHeight = imageElement.height * scale;
    const offsetX = (targetSize - scaledWidth) / 2;
    const offsetY = (targetSize - scaledHeight) / 2;

    // Fill with gray (letterbox)
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, targetSize, targetSize);

    // Draw image centered
    ctx.drawImage(imageElement, offsetX, offsetY, scaledWidth, scaledHeight);

    // Get image data
    const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
    const data = imageData.data;

    // Convert to float32 tensor [1, 3, 640, 640] with normalization
    const float32Data = new Float32Array(1 * 3 * targetSize * targetSize);

    for (let y = 0; y < targetSize; y++) {
        for (let x = 0; x < targetSize; x++) {
            const idx = (y * targetSize + x) * 4;
            const outIdx = y * targetSize + x;

            // RGB channels, normalized to 0-1
            float32Data[0 * targetSize * targetSize + outIdx] = data[idx] / 255.0;     // R
            float32Data[1 * targetSize * targetSize + outIdx] = data[idx + 1] / 255.0; // G
            float32Data[2 * targetSize * targetSize + outIdx] = data[idx + 2] / 255.0; // B
        }
    }

    return {
        tensor: new ort.Tensor('float32', float32Data, [1, 3, targetSize, targetSize]),
        scale,
        offsetX,
        offsetY,
        originalWidth: imageElement.width,
        originalHeight: imageElement.height
    };
};

/**
 * Post-process YOLOv8 output
 */
const postprocess = (output, preprocessInfo, confidenceThreshold = 0.5, iouThreshold = 0.45) => {
    const { scale, offsetX, offsetY, originalWidth, originalHeight } = preprocessInfo;

    // YOLOv8 output shape: [1, 5, 8400] where 5 = x, y, w, h, confidence
    // Or [1, 84, 8400] for 80 classes
    const data = output.data;
    const dims = output.dims;

    console.log('📊 Output dims:', dims);
    console.log('📊 Scale:', scale, 'Offset X:', offsetX, 'Offset Y:', offsetY);

    const detections = [];

    // Check if this is transposed output [1, 8400, 5] vs [1, 5, 8400]
    let numBoxes, numFeatures;
    if (dims[1] > dims[2]) {
        // Format: [1, 8400, 5] - rows are boxes
        numBoxes = dims[1];
        numFeatures = dims[2];
    } else {
        // Format: [1, 5, 8400] - columns are boxes
        numBoxes = dims[2];
        numFeatures = dims[1];
    }

    console.log('📊 Num boxes:', numBoxes, 'Num features:', numFeatures);

    const numClasses = numFeatures - 4;

    for (let i = 0; i < numBoxes; i++) {
        let x, y, w, h, maxConf, maxClassIdx;

        if (dims[1] > dims[2]) {
            // Format: [1, 8400, 5] - each row is a box
            x = data[i * numFeatures + 0];
            y = data[i * numFeatures + 1];
            w = data[i * numFeatures + 2];
            h = data[i * numFeatures + 3];

            maxConf = 0;
            maxClassIdx = 0;
            for (let c = 0; c < numClasses; c++) {
                const conf = data[i * numFeatures + 4 + c];
                if (conf > maxConf) {
                    maxConf = conf;
                    maxClassIdx = c;
                }
            }
        } else {
            // Format: [1, 5, 8400] - each column is a box
            x = data[0 * numBoxes + i];
            y = data[1 * numBoxes + i];
            w = data[2 * numBoxes + i];
            h = data[3 * numBoxes + i];

            maxConf = 0;
            maxClassIdx = 0;
            for (let c = 0; c < numClasses; c++) {
                const conf = data[(4 + c) * numBoxes + i];
                if (conf > maxConf) {
                    maxConf = conf;
                    maxClassIdx = c;
                }
            }
        }

        if (maxConf > confidenceThreshold) {
            // YOLOv8 outputs are in 640x640 space
            // Convert from center format to corner format
            const x1_640 = x - w / 2;
            const y1_640 = y - h / 2;
            const x2_640 = x + w / 2;
            const y2_640 = y + h / 2;

            // Remove letterbox offset and scale back to original image
            const x1 = (x1_640 - offsetX) / scale;
            const y1 = (y1_640 - offsetY) / scale;
            const x2 = (x2_640 - offsetX) / scale;
            const y2 = (y2_640 - offsetY) / scale;

            console.log(`📦 Detection: x=${x.toFixed(1)}, y=${y.toFixed(1)}, w=${w.toFixed(1)}, h=${h.toFixed(1)}, conf=${maxConf.toFixed(3)}`);
            console.log(`📦 Transformed: x1=${x1.toFixed(1)}, y1=${y1.toFixed(1)}, x2=${x2.toFixed(1)}, y2=${y2.toFixed(1)}`);

            detections.push({
                label: CLASS_NAMES[maxClassIdx] || 'tiang',
                confidence: maxConf,
                bbox: {
                    x: Math.max(0, x1),
                    y: Math.max(0, y1),
                    w: Math.max(0, Math.min(x2 - x1, originalWidth - x1)),
                    h: Math.max(0, Math.min(y2 - y1, originalHeight - y1))
                }
            });
        }
    }

    // Apply Non-Maximum Suppression (NMS)
    return applyNMS(detections, iouThreshold);
};

/**
 * Non-Maximum Suppression
 */
const applyNMS = (detections, iouThreshold) => {
    if (detections.length === 0) return [];

    // Sort by confidence
    detections.sort((a, b) => b.confidence - a.confidence);

    const kept = [];
    const suppressed = new Set();

    for (let i = 0; i < detections.length; i++) {
        if (suppressed.has(i)) continue;

        kept.push(detections[i]);

        for (let j = i + 1; j < detections.length; j++) {
            if (suppressed.has(j)) continue;

            const iou = calculateIoU(detections[i].bbox, detections[j].bbox);
            if (iou > iouThreshold) {
                suppressed.add(j);
            }
        }
    }

    return kept;
};

/**
 * Calculate Intersection over Union
 */
const calculateIoU = (box1, box2) => {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.w, box2.x + box2.w);
    const y2 = Math.min(box1.y + box1.h, box2.y + box2.h);

    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const area1 = box1.w * box1.h;
    const area2 = box2.w * box2.h;
    const union = area1 + area2 - intersection;

    return intersection / union;
};

/**
 * Detect poles in an image using custom YOLOv8 model
 */
export const detectPoles = async (imageElement) => {
    try {
        console.log('🔍 Starting pole detection with custom model...');
        const startTime = Date.now();

        // Load model if not loaded
        const model = await loadModel();

        // Preprocess image
        const preprocessInfo = preprocessImage(imageElement);

        // Run inference
        const feeds = { [model.inputNames[0]]: preprocessInfo.tensor };
        const results = await model.run(feeds);

        // Get output
        const output = results[model.outputNames[0]];

        // Postprocess
        const detections = postprocess(output, preprocessInfo);

        console.log(`✅ Detection completed in ${Date.now() - startTime}ms`);
        console.log(`📦 Found ${detections.length} tiang`);

        return detections;
    } catch (error) {
        console.error('❌ Pole detection error:', error);
        return [];
    }
};

/**
 * Draw detection results on canvas
 */
export const drawDetections = (canvas, detections) => {
    const ctx = canvas.getContext('2d');

    detections.forEach(det => {
        const { bbox, label, confidence } = det;

        // Draw bounding box (green)
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 3;
        ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);

        // Draw label background
        ctx.fillStyle = '#00FF00';
        const text = `${label} ${(confidence * 100).toFixed(0)}%`;
        ctx.font = 'bold 16px Arial';
        const textMetrics = ctx.measureText(text);
        ctx.fillRect(bbox.x, bbox.y - 28, textMetrics.width + 12, 28);

        // Draw label text
        ctx.fillStyle = '#000000';
        ctx.fillText(text, bbox.x + 6, bbox.y - 8);
    });
};

export default {
    loadModel,
    detectPoles,
    drawDetections
};
