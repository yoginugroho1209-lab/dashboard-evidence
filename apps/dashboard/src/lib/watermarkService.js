/**
 * Watermark Service
 * Adds information overlay to photos before upload
 */

/**
 * Apply watermark to an image
 * @param {HTMLImageElement} imageElement - The source image
 * @param {Object} data - Watermark data
 * @param {Object} data.exif - EXIF data (timestamp, device, coords)
 * @param {Object} data.matchedPoint - Matched KML point info
 * @param {Array} data.objects - AI detected objects
 * @param {number} data.radius - Radius used for matching
 * @returns {Promise<Blob>} - Watermarked image as Blob
 */
export const applyWatermark = async (imageElement, data) => {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Set canvas to image dimensions
            canvas.width = imageElement.naturalWidth;
            canvas.height = imageElement.naturalHeight;

            // Draw original image
            ctx.drawImage(imageElement, 0, 0);

            // Calculate watermark dimensions based on image size
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const isLandscape = imgWidth > imgHeight;

            // Scale font based on image size (minimum readable size)
            const baseFontSize = Math.max(14, Math.min(imgWidth, imgHeight) * 0.025);
            const lineHeight = baseFontSize * 1.4;
            const padding = baseFontSize * 0.8;

            // Prepare watermark lines
            const lines = [];

            // Line 1: Project/Point Name + Infrastructure Type
            if (data.matchedPoint?.point) {
                const pointName = data.matchedPoint.point.name || data.matchedPoint.point.id || 'Unknown Point';
                const infraType = data.matchedPoint.point.infrastructureType || '';
                const distance = data.matchedPoint.distance || '?';
                lines.push(`📍 ${pointName} ${infraType ? `(${infraType})` : ''} - ${distance}m`);
            } else {
                lines.push('📍 No KML Point Matched');
            }

            // Line 2: Timestamp
            if (data.exif?.timestamp) {
                const date = new Date(data.exif.timestamp);
                const formatted = date.toLocaleString('id-ID', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                lines.push(`🕐 ${formatted}`);
            }

            // Line 3: Coordinates
            if (data.exif?.hasGPS && data.exif?.latitude && data.exif?.longitude) {
                const lat = data.exif.latitude.toFixed(6);
                const lng = data.exif.longitude.toFixed(6);
                const accuracy = data.exif.accuracy ? ` (±${Math.round(data.exif.accuracy)}m)` : '';
                const source = data.exif.gpsSource === 'browser' ? 'GPS' : 'EXIF';
                lines.push(`🌐 ${lat}, ${lng}${accuracy} [${source}]`);
            } else {
                lines.push('🌐 No GPS Data');
            }

            // Line 4: Device
            if (data.exif?.device && data.exif.device !== 'Unknown Device') {
                lines.push(`📱 ${data.exif.device}`);
            }

            // Line 5: AI Detections
            if (data.objects && data.objects.length > 0) {
                const detections = data.objects.map(obj => {
                    const label = obj.label || obj.class || 'Object';
                    const conf = Math.round((obj.confidence || 0) * 100);
                    return `${label} ${conf}%`;
                }).join(', ');
                lines.push(`🤖 ${detections}`);
            } else {
                lines.push('🤖 No objects detected');
            }

            // Calculate watermark box dimensions
            ctx.font = `bold ${baseFontSize}px "Segoe UI", Arial, sans-serif`;
            let maxTextWidth = 0;
            lines.forEach(line => {
                const width = ctx.measureText(line).width;
                if (width > maxTextWidth) maxTextWidth = width;
            });

            const boxWidth = maxTextWidth + padding * 2;
            const boxHeight = lines.length * lineHeight + padding * 2;
            const boxX = padding;
            const boxY = imgHeight - boxHeight - padding;

            // Draw semi-transparent background
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8);
            ctx.fill();

            // Draw border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Draw text lines
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `bold ${baseFontSize}px "Segoe UI", Arial, sans-serif`;
            ctx.textBaseline = 'top';

            lines.forEach((line, index) => {
                const textX = boxX + padding;
                const textY = boxY + padding + (index * lineHeight);
                ctx.fillText(line, textX, textY);
            });

            // Convert canvas to Blob
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create blob from canvas'));
                }
            }, 'image/jpeg', 0.92);

        } catch (error) {
            console.error('Watermark error:', error);
            reject(error);
        }
    });
};

export default { applyWatermark };
