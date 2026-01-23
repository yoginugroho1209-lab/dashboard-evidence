/**
 * ONNX-based Object Detection Service
 * Detects Tiang Telkom using custom-trained YOLOv8n-seg model
 */

import * as ort from 'onnxruntime-web';

// Configuration
const MODEL_PATH = '/models/tiang_telkom.onnx';
const INPUT_SIZE = 640;
const CONFIDENCE_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;

// Class names from training
const CLASS_NAMES = ['tiang_telkom'];

let session = null;
let isModelLoading = false;

/**
 * Load the ONNX model
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
        console.log('🔄 Loading ONNX model...');

        // Use CDN for WASM files with correct version matching installed package
        ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.2/dist/';

        // Disable SIMD if having issues
        ort.env.wasm.simd = true;
        ort.env.wasm.proxy = false;

        session = await ort.InferenceSession.create(MODEL_PATH, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all'
        });

        console.log('✅ ONNX model loaded successfully');
        console.log('Input names:', session.inputNames);
        console.log('Output names:', session.outputNames);

        return session;
    } catch (error) {
        console.error('❌ Failed to load ONNX model:', error);
        throw error;
    } finally {
        isModelLoading = false;
    }
};

/**
 * Preprocess image for YOLO model
 */
const preprocessImage = (imageElement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;

    // Calculate scaling to maintain aspect ratio
    const scale = Math.min(INPUT_SIZE / imageElement.width, INPUT_SIZE / imageElement.height);
    const scaledWidth = imageElement.width * scale;
    const scaledHeight = imageElement.height * scale;
    const offsetX = (INPUT_SIZE - scaledWidth) / 2;
    const offsetY = (INPUT_SIZE - scaledHeight) / 2;

    // Fill with gray (letterboxing)
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);

    // Draw scaled image
    ctx.drawImage(imageElement, offsetX, offsetY, scaledWidth, scaledHeight);

    // Get image data and convert to tensor format
    const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const { data } = imageData;

    // Convert to float32 and normalize to [0, 1]
    // YOLO expects [batch, channels, height, width] format
    const float32Data = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);

    for (let y = 0; y < INPUT_SIZE; y++) {
        for (let x = 0; x < INPUT_SIZE; x++) {
            const pixelIndex = (y * INPUT_SIZE + x) * 4;
            const tensorIndex = y * INPUT_SIZE + x;

            // RGB channels, normalized to [0, 1]
            float32Data[0 * INPUT_SIZE * INPUT_SIZE + tensorIndex] = data[pixelIndex] / 255;     // R
            float32Data[1 * INPUT_SIZE * INPUT_SIZE + tensorIndex] = data[pixelIndex + 1] / 255; // G
            float32Data[2 * INPUT_SIZE * INPUT_SIZE + tensorIndex] = data[pixelIndex + 2] / 255; // B
        }
    }

    return {
        tensor: new ort.Tensor('float32', float32Data, [1, 3, INPUT_SIZE, INPUT_SIZE]),
        scale,
        offsetX,
        offsetY,
        originalWidth: imageElement.width,
        originalHeight: imageElement.height
    };
};

/**
 * Non-Maximum Suppression
 */
const nms = (boxes, scores, threshold) => {
    const indices = [];
    const sortedIndices = scores
        .map((score, idx) => ({ score, idx }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.idx);

    const suppressed = new Set();

    for (const i of sortedIndices) {
        if (suppressed.has(i)) continue;
        indices.push(i);

        for (const j of sortedIndices) {
            if (suppressed.has(j) || i === j) continue;

            const iou = calculateIoU(boxes[i], boxes[j]);
            if (iou > threshold) {
                suppressed.add(j);
            }
        }
    }

    return indices;
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
 * Postprocess YOLO output
 */
const postprocessOutput = (output, preprocessInfo) => {
    const { scale, offsetX, offsetY, originalWidth, originalHeight } = preprocessInfo;

    // YOLOv8 output format is TRANSPOSED: [batch, num_features, num_predictions]
    // For segmentation: [1, 37, 8400] where 37 = 4 (bbox) + 1 (class) + 32 (mask coefficients)
    // So we need to read data column-wise, not row-wise
    const outputData = output.data;
    const dims = output.dims;

    console.log('📊 Output dims:', dims);
    console.log('📊 Output data length:', outputData.length);
    console.log('📊 First 20 values:', Array.from(outputData.slice(0, 20)));

    // Determine if output is transposed (YOLOv8 style) or not
    // YOLOv8: [1, features, predictions] e.g. [1, 37, 8400]
    // Traditional: [1, predictions, features] e.g. [1, 8400, 37]
    let numPredictions, numFeatures;
    const isTransposed = dims[1] < dims[2]; // features < predictions means transposed

    if (isTransposed) {
        numFeatures = dims[1];
        numPredictions = dims[2];
        console.log(`📊 Transposed format detected: ${numFeatures} features x ${numPredictions} predictions`);
    } else {
        numPredictions = dims[1];
        numFeatures = dims[2];
        console.log(`📊 Standard format detected: ${numPredictions} predictions x ${numFeatures} features`);
    }

    const boxes = [];
    const scores = [];
    const classIds = [];

    for (let i = 0; i < numPredictions; i++) {
        let cx, cy, w, h, score;

        if (isTransposed) {
            // Transposed: data[feature][prediction], so index = feature * numPredictions + prediction
            cx = outputData[0 * numPredictions + i];
            cy = outputData[1 * numPredictions + i];
            w = outputData[2 * numPredictions + i];
            h = outputData[3 * numPredictions + i];
            score = outputData[4 * numPredictions + i];
        } else {
            // Standard: data[prediction][feature], so index = prediction * numFeatures + feature
            const offset = i * numFeatures;
            cx = outputData[offset];
            cy = outputData[offset + 1];
            w = outputData[offset + 2];
            h = outputData[offset + 3];
            score = outputData[offset + 4];
        }

        if (score > CONFIDENCE_THRESHOLD) {
            // Convert from center format to corner format
            // And reverse the preprocessing transformations
            let x = (cx - w / 2 - offsetX) / scale;
            let y = (cy - h / 2 - offsetY) / scale;
            let boxW = w / scale;
            let boxH = h / scale;

            // Clip to image bounds
            x = Math.max(0, Math.min(x, originalWidth));
            y = Math.max(0, Math.min(y, originalHeight));
            boxW = Math.min(boxW, originalWidth - x);
            boxH = Math.min(boxH, originalHeight - y);

            if (boxW > 0 && boxH > 0) {
                boxes.push({ x, y, w: boxW, h: boxH });
                scores.push(score);
                classIds.push(0); // Single class

                console.log(`📦 Detection ${boxes.length}: score=${score.toFixed(3)}, box=[${x.toFixed(0)},${y.toFixed(0)},${boxW.toFixed(0)},${boxH.toFixed(0)}]`);
            }
        }
    }

    console.log(`📊 Found ${boxes.length} detections before NMS`);

    // Apply NMS
    const keepIndices = nms(boxes, scores, IOU_THRESHOLD);

    console.log(`📊 Kept ${keepIndices.length} detections after NMS`);

    return keepIndices.map(idx => ({
        label: CLASS_NAMES[classIds[idx]] || 'Tiang Telkom',
        confidence: scores[idx],
        bbox: boxes[idx]
    }));
};

/**
 * Detect poles using custom YOLO model
 */
export const detectPoles = async (imageElement) => {
    try {
        console.log('🔍 Starting detection...');
        const startTime = performance.now();

        // Load model if not loaded
        const loadedSession = await loadModel();

        // Preprocess image
        const preprocessInfo = preprocessImage(imageElement);

        // Run inference
        const feeds = { [loadedSession.inputNames[0]]: preprocessInfo.tensor };
        const results = await loadedSession.run(feeds);

        // Get output tensor
        const outputName = loadedSession.outputNames[0];
        const output = results[outputName];

        // Postprocess results
        const detections = postprocessOutput(output, preprocessInfo);

        const endTime = performance.now();
        console.log(`✅ Detection completed in ${(endTime - startTime).toFixed(0)}ms`);
        console.log(`📦 Found ${detections.length} tiang telkom`);

        return detections;
    } catch (error) {
        console.error('❌ Detection error:', error);
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

        // Draw bounding box with gradient
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 3;
        ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);

        // Draw corner accents
        const cornerSize = 15;
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#00FF00';

        // Top-left
        ctx.beginPath();
        ctx.moveTo(bbox.x, bbox.y + cornerSize);
        ctx.lineTo(bbox.x, bbox.y);
        ctx.lineTo(bbox.x + cornerSize, bbox.y);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(bbox.x + bbox.w - cornerSize, bbox.y);
        ctx.lineTo(bbox.x + bbox.w, bbox.y);
        ctx.lineTo(bbox.x + bbox.w, bbox.y + cornerSize);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(bbox.x, bbox.y + bbox.h - cornerSize);
        ctx.lineTo(bbox.x, bbox.y + bbox.h);
        ctx.lineTo(bbox.x + cornerSize, bbox.y + bbox.h);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(bbox.x + bbox.w - cornerSize, bbox.y + bbox.h);
        ctx.lineTo(bbox.x + bbox.w, bbox.y + bbox.h);
        ctx.lineTo(bbox.x + bbox.w, bbox.y + bbox.h - cornerSize);
        ctx.stroke();

        // Draw label background
        const text = `${label} ${(confidence * 100).toFixed(0)}%`;
        ctx.font = 'bold 14px Arial';
        const textMetrics = ctx.measureText(text);
        const textHeight = 20;

        ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        ctx.fillRect(bbox.x, bbox.y - textHeight - 5, textMetrics.width + 10, textHeight + 5);

        // Draw label text
        ctx.fillStyle = '#000000';
        ctx.fillText(text, bbox.x + 5, bbox.y - 8);
    });
};

export default {
    loadModel,
    detectPoles,
    drawDetections
};
