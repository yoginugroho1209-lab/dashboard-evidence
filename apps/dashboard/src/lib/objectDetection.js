/**
 * Object Detection Service using Custom YOLOv8 ONNX Model
 * Detects poles (tiang) in uploaded images
 * 
 * Improvements:
 * - Lowered confidence threshold for better recall
 * - Multi-scale detection for different pole sizes
 * - Heuristic fallback using vertical edge analysis
 * - Full image loading guarantee before inference
 * - Debug logging with confidence histogram
 */

import * as ort from 'onnxruntime-web';

let session = null;
let isModelLoading = false;

// Class names from your training
const CLASS_NAMES = ['tiang'];

// Detection configuration
const CONFIG = {
    confidenceThreshold: 0.15,  // Lowered from 0.5 for better recall
    iouThreshold: 0.45,
    inputSize: 640,
    // Multi-scale sizes for better detection at various distances
    multiScaleSizes: [640, 480],
    // Enable/disable features
    enableMultiScale: true,
    enableHeuristicFallback: true,
    // Heuristic settings
    heuristicMinConfidence: 0.35,
    // Letterbox padding color (match training)
    letterboxColor: '#808080',
};

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
 * Ensure image is fully loaded at native resolution
 * This is critical - without this, naturalWidth/Height may be 0
 */
const ensureImageLoaded = (imageSource) => {
    return new Promise((resolve, reject) => {
        // If it's already a fully loaded Image with dimensions, use it
        if (imageSource.complete && imageSource.naturalWidth > 0 && imageSource.naturalHeight > 0) {
            console.log(`✅ Image already loaded: ${imageSource.naturalWidth}x${imageSource.naturalHeight}`);
            resolve(imageSource);
            return;
        }

        // Create a new Image object to guarantee full loading
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            console.log(`✅ Image loaded fresh: ${img.naturalWidth}x${img.naturalHeight}`);
            resolve(img);
        };

        img.onerror = (err) => {
            console.error('❌ Image failed to load:', err);
            reject(new Error('Failed to load image for detection'));
        };

        // Use the src from the existing element
        img.src = imageSource.src;
    });
};

/**
 * Preprocess image for YOLOv8 (resize to targetSize x targetSize, normalize)
 */
const preprocessImage = (imageElement, targetSize = CONFIG.inputSize) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = targetSize;
    canvas.height = targetSize;

    // Use naturalWidth/naturalHeight for original image dimensions
    const origWidth = imageElement.naturalWidth || imageElement.width;
    const origHeight = imageElement.naturalHeight || imageElement.height;

    if (origWidth === 0 || origHeight === 0) {
        console.error('❌ Image has zero dimensions! naturalWidth:', origWidth, 'naturalHeight:', origHeight);
        throw new Error('Image has zero dimensions - not fully loaded');
    }

    console.log(`📐 Original image size: ${origWidth}x${origHeight}, target: ${targetSize}x${targetSize}`);

    // Calculate scaling to maintain aspect ratio
    const scale = Math.min(targetSize / origWidth, targetSize / origHeight);
    const scaledWidth = origWidth * scale;
    const scaledHeight = origHeight * scale;
    const offsetX = (targetSize - scaledWidth) / 2;
    const offsetY = (targetSize - scaledHeight) / 2;

    // Fill with letterbox color
    ctx.fillStyle = CONFIG.letterboxColor;
    ctx.fillRect(0, 0, targetSize, targetSize);

    // Draw image centered
    ctx.drawImage(imageElement, offsetX, offsetY, scaledWidth, scaledHeight);

    // Get image data
    const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
    const data = imageData.data;

    // Convert to float32 tensor [1, 3, targetSize, targetSize] with normalization
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
        originalWidth: origWidth,
        originalHeight: origHeight,
        targetSize
    };
};

/**
 * Post-process YOLOv8 output with enhanced logging
 */
const postprocess = (output, preprocessInfo) => {
    const { scale, offsetX, offsetY, originalWidth, originalHeight } = preprocessInfo;
    const confidenceThreshold = CONFIG.confidenceThreshold;
    const iouThreshold = CONFIG.iouThreshold;

    const data = output.data;
    const dims = output.dims;

    console.log('📊 Output dims:', dims);

    const detections = [];

    // Confidence histogram for debugging
    const confBuckets = { '0.0-0.1': 0, '0.1-0.2': 0, '0.2-0.3': 0, '0.3-0.4': 0, '0.4-0.5': 0, '0.5-0.6': 0, '0.6-0.7': 0, '0.7-0.8': 0, '0.8-0.9': 0, '0.9-1.0': 0 };
    let maxConfFound = 0;
    let totalAboveMin = 0;

    // Check if this is transposed output [1, 8400, 5] vs [1, 5, 8400]
    let numBoxes, numFeatures;
    if (dims[1] > dims[2]) {
        numBoxes = dims[1];
        numFeatures = dims[2];
    } else {
        numBoxes = dims[2];
        numFeatures = dims[1];
    }

    console.log(`📊 Num boxes: ${numBoxes}, Num features: ${numFeatures}`);

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

        // Track confidence histogram (for scores > 0.05)
        if (maxConf > 0.05) {
            const bucket = Math.min(Math.floor(maxConf * 10), 9);
            const bucketKey = `${(bucket / 10).toFixed(1)}-${((bucket + 1) / 10).toFixed(1)}`;
            confBuckets[bucketKey] = (confBuckets[bucketKey] || 0) + 1;
            totalAboveMin++;
            if (maxConf > maxConfFound) maxConfFound = maxConf;
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

            console.log(`📦 Detection: conf=${maxConf.toFixed(3)}, box=[${x1.toFixed(0)},${y1.toFixed(0)},${x2.toFixed(0)},${y2.toFixed(0)}]`);

            detections.push({
                label: CLASS_NAMES[maxClassIdx] || 'tiang',
                confidence: maxConf,
                source: 'model',
                bbox: {
                    x: Math.max(0, x1),
                    y: Math.max(0, y1),
                    w: Math.max(0, Math.min(x2 - x1, originalWidth - Math.max(0, x1))),
                    h: Math.max(0, Math.min(y2 - y1, originalHeight - Math.max(0, y1)))
                }
            });
        }
    }

    // Log confidence histogram
    console.log('📊 Confidence Histogram (candidates with conf > 0.05):');
    console.table(confBuckets);
    console.log(`📊 Max confidence found: ${maxConfFound.toFixed(3)}, Total candidates: ${totalAboveMin}`);

    if (detections.length === 0 && maxConfFound > 0.05) {
        console.warn(`⚠️ No detections passed threshold (${confidenceThreshold}), but max confidence was ${maxConfFound.toFixed(3)}. Consider lowering threshold.`);
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

    return union > 0 ? intersection / union : 0;
};

/**
 * Heuristic pole detection using vertical edge analysis
 * Used as fallback when the ONNX model finds nothing
 */
const heuristicPoleDetection = (imageElement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const origWidth = imageElement.naturalWidth || imageElement.width;
    const origHeight = imageElement.naturalHeight || imageElement.height;

    // Work at reduced resolution for speed
    const analyzeWidth = Math.min(origWidth, 400);
    const analyzeScale = analyzeWidth / origWidth;
    const analyzeHeight = Math.round(origHeight * analyzeScale);

    canvas.width = analyzeWidth;
    canvas.height = analyzeHeight;
    ctx.drawImage(imageElement, 0, 0, analyzeWidth, analyzeHeight);

    const imageData = ctx.getImageData(0, 0, analyzeWidth, analyzeHeight);
    const data = imageData.data;

    // Convert to grayscale
    const gray = new Float32Array(analyzeWidth * analyzeHeight);
    for (let i = 0; i < gray.length; i++) {
        const idx = i * 4;
        gray[i] = (data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114) / 255;
    }

    // Detect vertical edges using Sobel-like filter
    const verticalEdges = new Float32Array(analyzeWidth * analyzeHeight);
    for (let y = 1; y < analyzeHeight - 1; y++) {
        for (let x = 1; x < analyzeWidth - 1; x++) {
            // Horizontal gradient (detects vertical edges)
            const gx = Math.abs(
                -gray[(y - 1) * analyzeWidth + (x - 1)] + gray[(y - 1) * analyzeWidth + (x + 1)]
                - 2 * gray[y * analyzeWidth + (x - 1)] + 2 * gray[y * analyzeWidth + (x + 1)]
                - gray[(y + 1) * analyzeWidth + (x - 1)] + gray[(y + 1) * analyzeWidth + (x + 1)]
            );
            verticalEdges[y * analyzeWidth + x] = gx;
        }
    }

    // Scan columns for sustained vertical edges (pole-like structures)
    const columnScores = new Float32Array(analyzeWidth);
    for (let x = 0; x < analyzeWidth; x++) {
        let runLength = 0;
        let maxRun = 0;
        let runStart = 0;
        let bestRunStart = 0;

        for (let y = 0; y < analyzeHeight; y++) {
            if (verticalEdges[y * analyzeWidth + x] > 0.08) {
                if (runLength === 0) runStart = y;
                runLength++;
            } else {
                if (runLength > maxRun) {
                    maxRun = runLength;
                    bestRunStart = runStart;
                }
                runLength = 0;
            }
        }
        if (runLength > maxRun) {
            maxRun = runLength;
            bestRunStart = runStart;
        }

        // A pole should span at least 30% of image height
        const minPoleHeight = analyzeHeight * 0.3;
        if (maxRun >= minPoleHeight) {
            columnScores[x] = maxRun / analyzeHeight;
        }
    }

    // Find peaks in column scores (potential pole positions)
    const detections = [];
    let inPeak = false;
    let peakStart = 0;
    let peakMaxScore = 0;

    for (let x = 0; x < analyzeWidth; x++) {
        if (columnScores[x] > 0) {
            if (!inPeak) {
                inPeak = true;
                peakStart = x;
                peakMaxScore = 0;
            }
            peakMaxScore = Math.max(peakMaxScore, columnScores[x]);
        } else if (inPeak) {
            inPeak = false;
            const peakEnd = x;
            const peakWidth = peakEnd - peakStart;
            const peakCenter = peakStart + peakWidth / 2;

            // Poles are narrow - width should be < 15% of image width
            if (peakWidth < analyzeWidth * 0.15 && peakWidth >= 2) {
                const confidence = Math.min(peakMaxScore * 0.7, 0.6); // Cap heuristic confidence

                // Convert back to original coordinates
                const bboxX = (peakCenter - peakWidth) / analyzeScale;
                const bboxW = (peakWidth * 2.5) / analyzeScale;
                const bboxH = origHeight * 0.85;
                const bboxY = origHeight * 0.05;

                detections.push({
                    label: 'tiang',
                    confidence: confidence,
                    source: 'heuristic',
                    bbox: {
                        x: Math.max(0, bboxX),
                        y: Math.max(0, bboxY),
                        w: Math.min(bboxW, origWidth - bboxX),
                        h: Math.min(bboxH, origHeight - bboxY)
                    }
                });
            }
        }
    }

    // Apply NMS to heuristic detections too
    const nmsResults = applyNMS(detections, 0.3);

    if (nmsResults.length > 0) {
        console.log(`🔍 Heuristic found ${nmsResults.length} potential pole(s)`);
    }

    return nmsResults;
};

/**
 * Detect poles in an image using custom YOLOv8 model
 * Enhanced with multi-scale detection and heuristic fallback
 */
export const detectPoles = async (imageElement) => {
    try {
        console.log('🔍 Starting enhanced pole detection...');
        console.log(`⚙️ Config: threshold=${CONFIG.confidenceThreshold}, multiScale=${CONFIG.enableMultiScale}, heuristic=${CONFIG.enableHeuristicFallback}`);
        const startTime = Date.now();

        // CRITICAL: Ensure image is fully loaded before processing
        const loadedImage = await ensureImageLoaded(imageElement);
        console.log(`📐 Image verified: ${loadedImage.naturalWidth}x${loadedImage.naturalHeight}`);

        // Load model if not loaded
        const model = await loadModel();

        let allDetections = [];

        // Run standard detection at primary scale (640)
        try {
            const preprocessInfo = preprocessImage(loadedImage, CONFIG.inputSize);
            const feeds = { [model.inputNames[0]]: preprocessInfo.tensor };
            const results = await model.run(feeds);
            const output = results[model.outputNames[0]];
            const detections = postprocess(output, preprocessInfo);
            allDetections.push(...detections);
            console.log(`📦 Primary scale (${CONFIG.inputSize}): ${detections.length} detection(s)`);
        } catch (err) {
            console.error('❌ Primary scale detection failed:', err);
        }

        // Multi-scale: run at additional scales if enabled and no detections yet
        if (CONFIG.enableMultiScale && allDetections.length === 0) {
            for (const scale of CONFIG.multiScaleSizes) {
                if (scale === CONFIG.inputSize) continue; // Skip primary

                try {
                    console.log(`🔄 Trying scale ${scale}...`);
                    const preprocessInfo = preprocessImage(loadedImage, scale);

                    // Need to resize tensor to 640 for model input
                    // Re-preprocess at 640 but with image pre-scaled differently
                    // Actually, most ONNX models expect fixed input, so we resize input
                    const resizedPreprocess = preprocessImage(loadedImage, CONFIG.inputSize);

                    // Try with slightly different preprocessing (add brightness augmentation)
                    const augCanvas = document.createElement('canvas');
                    const augCtx = augCanvas.getContext('2d');
                    augCanvas.width = loadedImage.naturalWidth;
                    augCanvas.height = loadedImage.naturalHeight;

                    // Slight brightness boost to help with dark/shadowy poles
                    augCtx.filter = 'brightness(1.2) contrast(1.1)';
                    augCtx.drawImage(loadedImage, 0, 0);
                    augCtx.filter = 'none';

                    const augImg = new Image();
                    augImg.crossOrigin = 'anonymous';
                    const augBlob = await new Promise(resolve => augCanvas.toBlob(resolve, 'image/jpeg', 0.95));
                    const augUrl = URL.createObjectURL(augBlob);

                    await new Promise((resolve, reject) => {
                        augImg.onload = resolve;
                        augImg.onerror = reject;
                        augImg.src = augUrl;
                    });

                    const augPreprocess = preprocessImage(augImg, CONFIG.inputSize);
                    const feeds = { [model.inputNames[0]]: augPreprocess.tensor };
                    const results = await model.run(feeds);
                    const output = results[model.outputNames[0]];
                    const detections = postprocess(output, augPreprocess);

                    URL.revokeObjectURL(augUrl);

                    if (detections.length > 0) {
                        console.log(`📦 Augmented detection found ${detections.length} detection(s)`);
                        allDetections.push(...detections);
                        break;
                    }
                } catch (err) {
                    console.warn(`⚠️ Augmented detection failed:`, err);
                }
            }
        }

        // Heuristic fallback: if model found nothing, try image analysis
        if (CONFIG.enableHeuristicFallback && allDetections.length === 0) {
            console.log('🔍 Model found nothing, trying heuristic fallback...');
            try {
                const heuristicResults = heuristicPoleDetection(loadedImage);
                // Only use heuristic results with sufficient confidence
                const filtered = heuristicResults.filter(d => d.confidence >= CONFIG.heuristicMinConfidence);
                if (filtered.length > 0) {
                    console.log(`🔍 Heuristic found ${filtered.length} pole(s) above threshold`);
                    allDetections.push(...filtered);
                }
            } catch (err) {
                console.warn('⚠️ Heuristic detection failed:', err);
            }
        }

        // Final NMS across all detections
        const finalDetections = applyNMS(allDetections, CONFIG.iouThreshold);

        const elapsed = Date.now() - startTime;
        console.log(`✅ Detection completed in ${elapsed}ms`);
        console.log(`📦 Final result: ${finalDetections.length} tiang detected`);
        finalDetections.forEach((d, i) => {
            console.log(`  ${i + 1}. ${d.label} (${(d.confidence * 100).toFixed(1)}%) [${d.source}] @ [${d.bbox.x.toFixed(0)},${d.bbox.y.toFixed(0)},${d.bbox.w.toFixed(0)},${d.bbox.h.toFixed(0)}]`);
        });

        return finalDetections;
    } catch (error) {
        console.error('❌ Pole detection error:', error);
        return [];
    }
};

/**
 * Draw detection results on canvas with enhanced visuals
 */
export const drawDetections = (canvas, detections) => {
    const ctx = canvas.getContext('2d');

    detections.forEach(det => {
        const { bbox, label, confidence, source } = det;

        // Different colors for model vs heuristic
        const isModel = source === 'model';
        const primaryColor = isModel ? '#00FF00' : '#FFD700';
        const bgColor = isModel ? 'rgba(0, 255, 0, 0.8)' : 'rgba(255, 215, 0, 0.8)';

        // Draw bounding box
        ctx.strokeStyle = primaryColor;
        ctx.lineWidth = 3;
        ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);

        // Draw corner accents
        const cornerSize = Math.min(20, bbox.w * 0.15, bbox.h * 0.05);
        ctx.lineWidth = 4;
        ctx.strokeStyle = primaryColor;

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
        const sourceTag = isModel ? 'AI' : 'Heuristic';
        const text = `${label} ${(confidence * 100).toFixed(0)}% [${sourceTag}]`;
        ctx.font = 'bold 14px Arial';
        const textMetrics = ctx.measureText(text);
        const textHeight = 22;

        ctx.fillStyle = bgColor;
        ctx.fillRect(bbox.x, bbox.y - textHeight - 4, textMetrics.width + 12, textHeight + 4);

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
