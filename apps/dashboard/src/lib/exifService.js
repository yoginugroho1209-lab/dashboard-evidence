/**
 * EXIF Data Extraction Service
 * Extracts GPS coordinates and metadata from photos
 * Uses 'exifr' for robust parsing of JPEG, PNG, HEIC, TIFF
 */

import exifr from 'exifr';

/**
 * Extract EXIF data from an image file
 * @param {File} file - The image file to extract EXIF from
 * @returns {Promise<Object>} EXIF data including GPS coordinates
 */
export const extractExifData = async (file) => {
    try {
        console.log('🔄 internal: Starting EXIF extraction with exifr...');

        // Parse essential data + GPS
        // exifr automatically parses GPS to {latitude, longitude}
        const options = {
            tiff: true,
            ifd0: true,   // Make, Model
            exif: true,   // DateTimeOriginal
            gps: true,    // Latitude, Longitude
            // box, xmp, icc... we don't need these usually, keep it performant
        };

        const output = await exifr.parse(file, options);

        // Defensive check if parse returns null (no EXIF)
        if (!output) {
            console.log('⚠️ exifr returned null (No metadata found)');
            return {
                latitude: null,
                longitude: null,
                timestamp: new Date().toISOString(),
                device: 'No Metadata',
                hasGPS: false,
                raw: {}
            };
        }

        console.log('📸 exifr output:', output);

        const latitude = output.latitude;
        const longitude = output.longitude;

        // Timestamp fallback strategy
        let timestamp = output.DateTimeOriginal || output.DateTime || output.CreateDate || output.ModifyDate;
        if (timestamp) {
            // exifr returns Date objects usually, but sometimes strings
            if (typeof timestamp === 'string') {
                // Try to clean up standard EXIF date format "YYYY:MM:DD HH:MM:SS"
                const cleaner = timestamp.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
                timestamp = new Date(cleaner).toISOString();
            } else if (timestamp instanceof Date) {
                timestamp = timestamp.toISOString();
            }
        } else {
            timestamp = new Date().toISOString();
        }

        // Device info
        const device = [output.Make, output.Model].filter(Boolean).join(' ') || 'Unknown Device';

        // Check if GPS is valid
        const hasGPS = (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude));

        if (hasGPS) {
            console.log(`📍 GPS Found: ${latitude}, ${longitude}`);
        } else {
            console.log('⚠️ No GPS coordinates found in metadata');
        }

        return {
            latitude: hasGPS ? latitude : null,
            longitude: hasGPS ? longitude : null,
            timestamp,
            device,
            hasGPS,
            raw: output // Pass raw data for debugging
        };

    } catch (error) {
        console.error('❌ exifr extraction error:', error);
        return {
            latitude: null,
            longitude: null,
            timestamp: new Date().toISOString(),
            device: 'Extraction Error',
            hasGPS: false,
            raw: { error: error.message }
        };
    }
};

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

/**
 * Find the nearest point from a list of points
 * @param {number} lat - Photo latitude
 * @param {number} lng - Photo longitude
 * @param {Array} points - Array of KML points with lat/lng
 * @param {number} radiusMeters - Maximum distance in meters (default: 100m)
 * @returns {Object|null} Nearest point within radius or null
 */
export const findNearestPoint = (lat, lng, points, radiusMeters = 100) => {
    if (!lat || !lng || !points || points.length === 0) {
        return { point: null, distance: null, withinRadius: false };
    }

    let nearestPoint = null;
    let minDistance = Infinity;

    points.forEach(point => {
        const distance = calculateDistance(
            lat, lng,
            parseFloat(point.latitude || point.lat),
            parseFloat(point.longitude || point.lng)
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearestPoint = point;
        }
    });

    const withinRadius = minDistance <= radiusMeters;

    return {
        point: nearestPoint,
        distance: minDistance.toFixed(1),
        withinRadius
    };
};

/**
 * Find ALL points within a specified radius, sorted by distance
 * Used for smart photo assignment when multiple placemarks are nearby
 * @param {number} lat - Photo latitude
 * @param {number} lng - Photo longitude
 * @param {Array} points - Array of KML points with lat/lng
 * @param {number} radiusMeters - Maximum distance in meters (default: 100m)
 * @returns {Array} Array of points with distance, sorted by nearest first
 */
export const findNearbyPoints = (lat, lng, points, radiusMeters = 100) => {
    if (!lat || !lng || !points || points.length === 0) {
        return [];
    }

    // Calculate distance for each point
    const pointsWithDistance = points.map(point => {
        const distance = calculateDistance(
            lat, lng,
            parseFloat(point.latitude || point.lat),
            parseFloat(point.longitude || point.lng)
        );
        return {
            ...point,
            distance: parseFloat(distance.toFixed(1)),
            withinRadius: distance <= radiusMeters
        };
    });

    // Filter points within radius and sort by distance
    const nearbyPoints = pointsWithDistance
        .filter(p => p.withinRadius)
        .sort((a, b) => a.distance - b.distance);

    return nearbyPoints;
};

export default {
    extractExifData,
    calculateDistance,
    findNearestPoint,
    findNearbyPoints
};
