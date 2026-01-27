import React, { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { extractExifData, findNearestPoint as findNearest, findNearbyPoints } from '../lib/exifService'
import { detectPoles, drawDetections, loadModel } from '../lib/objectDetection'

const UploadEvidence = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [uploadStatus, setUploadStatus] = useState('idle'); // idle, analyzing, saving, done
    const [analysisResult, setAnalysisResult] = useState(null);
    const [saveStatus, setSaveStatus] = useState(null); // null, success, error
    const [projectPoints, setProjectPoints] = useState([]);
    const [user, setUser] = useState(null);
    const [modelStatus, setModelStatus] = useState('idle'); // idle, loading, ready, error
    const [radiusMeters, setRadiusMeters] = useState(5); // Default radius 5 meters
    const [gpsStatus, setGpsStatus] = useState('checking'); // checking, enabled, disabled, error

    // Smart Photo Assignment states
    const [nearbyPoints, setNearbyPoints] = useState([]); // Multiple points near photo
    const [showPointSelector, setShowPointSelector] = useState(false); // Show selection modal
    const [selectedPointIndex, setSelectedPointIndex] = useState(0); // Which nearby point is selected

    // Browser GPS capture (more reliable than EXIF for camera capture)
    const [capturedGPS, setCapturedGPS] = useState(null); // { latitude, longitude, accuracy, timestamp }
    const [isCapturingGPS, setIsCapturingGPS] = useState(false);

    const fileInputRef = useRef(null);
    const canvasRef = useRef(null);
    const imageRef = useRef(null);

    // Icon/color config for each infrastructure type
    const infraConfig = {
        'ODC': { icon: 'change_history', color: 'text-red-500', bg: 'bg-red-500/20' },
        'ODP': { icon: 'crop_square', color: 'text-blue-500', bg: 'bg-blue-500/20' },
        'Tiang': { icon: 'cell_tower', color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
        'Closure': { icon: 'join', color: 'text-purple-500', bg: 'bg-purple-500/20' },
        'Kabel': { icon: 'cable', color: 'text-green-500', bg: 'bg-green-500/20' },
    };

    // Load AI model on mount
    useEffect(() => {
        const initModel = async () => {
            setModelStatus('loading');
            try {
                await loadModel();
                setModelStatus('ready');
                console.log('✅ AI Model ready for detection');
            } catch (error) {
                console.error('❌ Failed to load AI model:', error);
                setModelStatus('error');
            }
        };
        initModel();
    }, []);

    // Check GPS status on mount
    useEffect(() => {
        const checkGPS = () => {
            if (!navigator.geolocation) {
                setGpsStatus('error');
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('📍 GPS Enabled:', position.coords);
                    setGpsStatus('enabled');
                },
                (error) => {
                    console.log('⚠️ GPS Error:', error.message);
                    if (error.code === error.PERMISSION_DENIED) {
                        setGpsStatus('disabled');
                    } else {
                        setGpsStatus('disabled');
                    }
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        };

        checkGPS();
    }, []);

    // Get current user and project points on mount + Realtime subscription
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();

        const getPoints = async () => {
            const { data, error } = await supabase
                .from('points')
                .select('*')
                .limit(500);

            if (data && data.length > 0) {
                setProjectPoints(data.map(p => ({
                    id: p.point_id,
                    dbId: p.id,
                    latitude: parseFloat(p.latitude),
                    longitude: parseFloat(p.longitude),
                    name: p.name,
                    projectId: p.project_id,
                    category: p.category,
                    infrastructureType: p.infrastructure_type
                })));
            } else {
                // Use sample points if no data in DB yet
                setProjectPoints([
                    { id: 'TK-8821-A', latitude: -6.9175, longitude: 107.6191, name: 'Tiang Fiber Zone A' },
                    { id: 'TK-8822-B', latitude: -6.9210, longitude: 107.6120, name: 'Box ODP-204' },
                    { id: 'TK-8825-A', latitude: -6.9312, longitude: 107.6255, name: 'Tiang TK-8825' },
                ]);
            }
        };
        getPoints();

        // 🔄 REALTIME: Subscribe to points table changes for auto-refresh
        const pointsSubscription = supabase
            .channel('points-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'points' },
                (payload) => {
                    console.log('🔄 Realtime: Points table changed', payload);
                    getPoints(); // Re-fetch all points when any change occurs
                }
            )
            .subscribe();

        // Cleanup subscription on unmount
        return () => {
            supabase.removeChannel(pointsSubscription);
        };
    }, []);

    // Auto-recalculate matched point when radius changes (after analysis is done)
    useEffect(() => {
        if (analysisResult && analysisResult.exif.hasGPS && projectPoints.length > 0) {
            const matchedPoint = findNearest(
                analysisResult.exif.latitude,
                analysisResult.exif.longitude,
                projectPoints,
                radiusMeters
            );

            setAnalysisResult(prev => ({
                ...prev,
                matchedPoint: {
                    point: matchedPoint.point ? {
                        id: matchedPoint.point.id,
                        dbId: matchedPoint.point.dbId,
                        name: matchedPoint.point.name,
                        projectId: matchedPoint.point.projectId,
                        category: matchedPoint.point.category,
                        infrastructureType: matchedPoint.point.infrastructureType
                    } : null,
                    distance: matchedPoint.distance,
                    withinRadius: matchedPoint.withinRadius
                }
            }));
        }
    }, [radiusMeters, projectPoints]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
            setUploadStatus('idle');
            setAnalysisResult(null);
            setSaveStatus(null);
            // Note: capturedGPS was already set before camera opened
        }
    };

    // Capture GPS FIRST, then open camera
    const handleCaptureClick = async () => {
        setIsCapturingGPS(true);
        setCapturedGPS(null);

        try {
            // Get high-accuracy GPS before opening camera
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    resolve,
                    reject,
                    {
                        enableHighAccuracy: true,
                        timeout: 10000,
                        maximumAge: 0 // Force fresh GPS reading
                    }
                );
            });

            const gpsData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: new Date().toISOString()
            };

            setCapturedGPS(gpsData);
            console.log('📍 Browser GPS captured:', gpsData);

        } catch (error) {
            console.warn('⚠️ Could not get browser GPS:', error.message);
            // Continue anyway, will try EXIF fallback
        }

        setIsCapturingGPS(false);

        // Now open camera
        fileInputRef.current?.click();
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploadStatus('analyzing');
        setSaveStatus(null);
        setNearbyPoints([]); // Reset nearby points
        setShowPointSelector(false);
        setSelectedPointIndex(0);

        try {
            // 1. Extract EXIF data from photo
            console.log('📍 Extracting EXIF data...');
            const exifData = await extractExifData(selectedFile);
            console.log('EXIF Data:', exifData);

            // 2. Determine GPS coordinates (Browser GPS is priority, EXIF as fallback)
            let gpsLat = null;
            let gpsLng = null;
            let gpsSource = 'none';

            if (capturedGPS && capturedGPS.latitude && capturedGPS.longitude) {
                // Use browser GPS (captured before camera opened) - most reliable
                gpsLat = capturedGPS.latitude;
                gpsLng = capturedGPS.longitude;
                gpsSource = 'browser';
                console.log('📍 Using Browser GPS:', gpsLat, gpsLng, `(accuracy: ${capturedGPS.accuracy}m)`);
            } else if (exifData.hasGPS) {
                // Fallback to EXIF if browser GPS failed
                gpsLat = exifData.latitude;
                gpsLng = exifData.longitude;
                gpsSource = 'exif';
                console.log('📍 Using EXIF GPS:', gpsLat, gpsLng);
            } else {
                console.log('⚠️ No GPS data available from browser or EXIF');
            }

            // 3. Find ALL nearby points within radius (Smart Photo Assignment)
            let matchedPoint = { point: null, distance: null, withinRadius: false };
            let foundNearbyPoints = [];

            if (gpsLat && gpsLng) {
                foundNearbyPoints = findNearbyPoints(
                    gpsLat,
                    gpsLng,
                    projectPoints,
                    radiusMeters
                );
                console.log('📌 Nearby points found:', foundNearbyPoints.length);

                // Store nearby points for potential selection
                setNearbyPoints(foundNearbyPoints);

                if (foundNearbyPoints.length === 1) {
                    // Only 1 point in radius - auto assign (original behavior)
                    matchedPoint = {
                        point: foundNearbyPoints[0],
                        distance: foundNearbyPoints[0].distance.toString(),
                        withinRadius: true
                    };
                    console.log('✅ Auto-assigned to:', matchedPoint.point.name);
                } else if (foundNearbyPoints.length > 1) {
                    // Multiple points in radius - show selector
                    setShowPointSelector(true);
                    // Default to nearest point (first in sorted array)
                    matchedPoint = {
                        point: foundNearbyPoints[0],
                        distance: foundNearbyPoints[0].distance.toString(),
                        withinRadius: true
                    };
                    console.log('⚠️ Multiple points found! User needs to select.');
                } else {
                    // No points in radius
                    matchedPoint = { point: null, distance: null, withinRadius: false };
                }
            } else {
                console.log('⚠️ Cannot match points - no GPS coordinates');
            }

            // Update exifData with browser GPS if used (for saving to DB)
            const finalExifData = {
                ...exifData,
                latitude: gpsLat || exifData.latitude,
                longitude: gpsLng || exifData.longitude,
                hasGPS: !!(gpsLat && gpsLng),
                gpsSource: gpsSource
            };

            // 3. Detect poles using AI
            console.log('🤖 Running pole detection...');
            let detectedObjects = [];

            if (imageRef.current) {
                // We now call detectPoles regardless of modelStatus 
                // because it has internal timeout and fallback to heuristic
                detectedObjects = await detectPoles(imageRef.current);
                console.log('Detected objects:', detectedObjects);

                // Draw bounding boxes on canvas
                if (canvasRef.current && detectedObjects.length > 0) {
                    const canvas = canvasRef.current;
                    const ctx = canvas.getContext('2d');
                    canvas.width = imageRef.current.naturalWidth;
                    canvas.height = imageRef.current.naturalHeight;
                    ctx.drawImage(imageRef.current, 0, 0);
                    drawDetections(canvas, detectedObjects);
                }
            }

            setAnalysisResult({
                exif: {
                    latitude: finalExifData.latitude,
                    longitude: finalExifData.longitude,
                    timestamp: finalExifData.timestamp,
                    device: finalExifData.device,
                    hasGPS: finalExifData.hasGPS,
                    gpsSource: finalExifData.gpsSource,
                    accuracy: capturedGPS?.accuracy || null,
                    raw: finalExifData.raw
                },
                matchedPoint: {
                    point: matchedPoint.point ? {
                        id: matchedPoint.point.id,
                        dbId: matchedPoint.point.dbId,
                        name: matchedPoint.point.name,
                        projectId: matchedPoint.point.projectId,
                        category: matchedPoint.point.category,
                        infrastructureType: matchedPoint.point.infrastructureType
                    } : null,
                    distance: matchedPoint.distance,
                    withinRadius: matchedPoint.withinRadius
                },
                objects: detectedObjects,
            });
            setUploadStatus('done');
        } catch (error) {
            console.error('Analysis error:', error);
            setUploadStatus('done');
            setAnalysisResult({
                exif: { latitude: null, longitude: null, timestamp: new Date().toISOString(), device: 'Unknown', hasGPS: false },
                matchedPoint: { point: null, distance: null, withinRadius: false },
                objects: [],
                error: error.message
            });
        }
    };

    // Handle point selection when multiple points are nearby
    const handleSelectPoint = (index) => {
        if (nearbyPoints.length === 0 || index >= nearbyPoints.length) return;

        const selectedPoint = nearbyPoints[index];
        setSelectedPointIndex(index);

        // Update analysis result with selected point
        setAnalysisResult(prev => ({
            ...prev,
            matchedPoint: {
                point: {
                    id: selectedPoint.id,
                    dbId: selectedPoint.dbId,
                    name: selectedPoint.name,
                    projectId: selectedPoint.projectId,
                    category: selectedPoint.category,
                    infrastructureType: selectedPoint.infrastructureType
                },
                distance: selectedPoint.distance.toString(),
                withinRadius: true
            }
        }));

        setShowPointSelector(false);
        console.log('✅ User selected point:', selectedPoint.name);
    };

    const handleSaveToReport = async () => {
        if (!analysisResult || !selectedFile) return;

        // Validation 1: Check for GPS Data
        if (!analysisResult.exif.hasGPS) {
            alert("GAGAL: Foto tidak memiliki data koordinat (GPS). Pastikan lokasi diaktifkan saat mengambil foto.");
            return;
        }

        // Validation 2: Check Radius
        if (!analysisResult.matchedPoint.withinRadius) {
            alert(`GAGAL: Foto berada ${analysisResult.matchedPoint.distance || '?'}m dari titik terdekat. Maksimal radius adalah ${radiusMeters}m. Harap ambil foto lebih dekat ke titik lokasi.`);
            return;
        }

        setUploadStatus('saving');

        try {
            // 1. Upload photo to Supabase Storage
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `uploads/${fileName}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('evidence')
                .upload(filePath, selectedFile);

            if (uploadError) throw uploadError;

            // 2. Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('evidence')
                .getPublicUrl(filePath);

            // 3. Save evidence record to database
            const { data: evidenceData, error: evidenceError } = await supabase
                .from('evidence')
                .insert([
                    {
                        photo_url: publicUrl,
                        photo_filename: fileName,
                        exif_latitude: analysisResult.exif.latitude,
                        exif_longitude: analysisResult.exif.longitude,
                        exif_timestamp: analysisResult.exif.timestamp,
                        exif_device: analysisResult.exif.device,
                        ai_detections: analysisResult.objects,
                        matched_distance_meters: parseFloat(analysisResult.matchedPoint.distance) || null,
                        point_id: analysisResult.matchedPoint.point?.dbId || null,
                        project_id: analysisResult.matchedPoint.point?.projectId || null,
                        uploaded_by: user?.id || null,
                        category: analysisResult.matchedPoint.point?.category || 'Existing',
                        infrastructure_type: analysisResult.matchedPoint.point?.infrastructureType || 'ODC',
                    }
                ])
                .select();

            if (evidenceError) throw evidenceError;

            setSaveStatus('success');
            setUploadStatus('done');
        } catch (error) {
            console.error('Save error:', error);
            setSaveStatus('error');
            setUploadStatus('done');
        }
    };

    const resetUpload = () => {
        setSelectedFile(null);
        setPreviewUrl(null);
        setUploadStatus('idle');
        setAnalysisResult(null);
        setSaveStatus(null);
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark relative">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "24px 24px" }}></div>

            {/* GPS Warning Overlay */}
            {(gpsStatus === 'disabled' || gpsStatus === 'error') && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-surface-dark border border-red-500/30 rounded-xl p-8 max-w-md text-center shadow-2xl">
                        <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                            <span className="material-symbols-outlined text-red-400 text-[48px]">location_off</span>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-3">GPS Tidak Aktif</h2>
                        <p className="text-slate-400 text-sm mb-6">
                            Untuk mengupload evidence, Anda <strong className="text-white">wajib mengaktifkan GPS</strong> di perangkat Anda.
                            Pastikan izin lokasi sudah diberikan untuk browser ini.
                        </p>
                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    setGpsStatus('checking');
                                    navigator.geolocation.getCurrentPosition(
                                        () => setGpsStatus('enabled'),
                                        () => setGpsStatus('disabled'),
                                        { enableHighAccuracy: true, timeout: 10000 }
                                    );
                                }}
                                className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                            >
                                <span className="material-symbols-outlined text-[18px]">refresh</span>
                                Cek Ulang GPS
                            </button>
                            <p className="text-xs text-slate-500">
                                💡 Buka Settings → Location → aktifkan GPS, lalu klik tombol di atas
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* GPS Checking Overlay */}
            {gpsStatus === 'checking' && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
                    <div className="bg-surface-dark border border-border-dark rounded-xl p-8 max-w-md text-center">
                        <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"></div>
                        <h2 className="text-xl font-bold text-white mb-2">Memeriksa GPS...</h2>
                        <p className="text-slate-400 text-sm">Mohon izinkan akses lokasi jika diminta</p>
                    </div>
                </div>
            )}

            {/* Point Selector Modal - Shows when multiple points are nearby */}
            {showPointSelector && nearbyPoints.length > 1 && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface-dark border border-border-dark rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-yellow-400 text-2xl">pin_drop</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">Beberapa Titik Ditemukan</h2>
                                <p className="text-slate-400 text-sm">{nearbyPoints.length} titik dalam radius {radiusMeters}m</p>
                            </div>
                        </div>

                        <p className="text-sm text-slate-400 mb-4">
                            Pilih titik mana yang akan diberi foto ini:
                        </p>

                        {/* Points List */}
                        <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                            {nearbyPoints.map((point, index) => (
                                <button
                                    key={point.id || index}
                                    onClick={() => setSelectedPointIndex(index)}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedPointIndex === index
                                        ? 'border-primary bg-primary/10'
                                        : 'border-white/10 bg-white/5 hover:border-primary/50 hover:bg-white/10'
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-green-400' :
                                                index === 1 ? 'bg-yellow-400' :
                                                    index === 2 ? 'bg-orange-400' : 'bg-slate-400'
                                                }`}></div>
                                            <div>
                                                <p className="text-white font-medium text-sm truncate max-w-[200px]">
                                                    {point.name || point.id || `Titik ${index + 1}`}
                                                </p>
                                                <p className="text-xs text-slate-500">{point.id}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-sm font-bold ${point.distance <= 5 ? 'text-green-400' :
                                                point.distance <= 15 ? 'text-yellow-400' :
                                                    'text-orange-400'
                                                }`}>
                                                {point.distance}m
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setShowPointSelector(false);
                                }}
                                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-colors"
                            >
                                Gunakan Terdekat
                            </button>
                            <button
                                onClick={() => handleSelectPoint(selectedPointIndex)}
                                className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors"
                            >
                                Pilih Ini
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Header */}
            <header className="min-h-[5rem] flex-shrink-0 px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-border-dark bg-[#131416]/80 backdrop-blur-md z-10">
                <div className="flex-shrink-0">
                    <h2 className="text-white text-xl sm:text-2xl font-heading font-bold leading-tight tracking-tight">Upload Evidence</h2>
                    <p className="text-slate-400 text-xs sm:text-sm">Capture & Analyze Field Photos</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                    {/* Model Status */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${modelStatus === 'ready' ? 'bg-green-500/10 text-green-400' :
                        modelStatus === 'loading' ? 'bg-yellow-500/10 text-yellow-400' :
                            'bg-red-500/10 text-red-400'
                        }`}>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${modelStatus === 'ready' ? 'bg-green-400' :
                            modelStatus === 'loading' ? 'bg-yellow-400 animate-pulse' :
                                'bg-red-400'
                            }`}></span>
                        <span className="hidden xs:inline">{modelStatus === 'ready' ? 'AI Ready' :
                            modelStatus === 'loading' ? 'Loading AI...' : 'AI Error'}</span>
                    </div>
                    {user && (
                        <div className="text-right hidden sm:block">
                            <p className="text-xs text-slate-500">Logged in as</p>
                            <p className="text-sm text-white truncate max-w-[200px]">{user.email}</p>
                        </div>
                    )}
                </div>
            </header>

            {/* Content */}
            <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 overflow-auto">
                {/* Left: Upload Area */}
                <div className="w-full lg:w-1/2 flex flex-col gap-6">
                    <div className="bg-surface-dark border border-border-dark rounded-lg p-6 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-primary">
                                <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                                <span className="text-xs font-bold uppercase tracking-widest">Capture Evidence</span>
                            </div>
                        </div>

                        {/* Category & Infrastructure Type Selectors */}
                        {/* Max Radius */}
                        <div className="flex-1 min-w-[100px]">
                            <label className="block text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1 whitespace-nowrap">Max Radius</label>
                            <select
                                value={radiusMeters}
                                onChange={(e) => setRadiusMeters(Number(e.target.value))}
                                className="w-full bg-[#131416] border border-border-dark text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-primary"
                            >
                                <option value={5}>5 m</option>
                                <option value={10}>10 m</option>
                                <option value={15}>15 m</option>
                                <option value={20}>20 m</option>
                            </select>
                        </div>
                    </div>

                    {/* Upload Zone */}
                    <div
                        onClick={handleCaptureClick}
                        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[300px] relative ${previewUrl ? 'border-primary bg-primary/5' : 'border-border-dark hover:border-primary/50 hover:bg-white/5'}`}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        {previewUrl ? (
                            <div className="relative">
                                <img
                                    ref={imageRef}
                                    src={previewUrl}
                                    alt="Preview"
                                    className="max-h-[250px] rounded-lg object-contain"
                                    crossOrigin="anonymous"
                                />
                                {/* Canvas overlay for bounding boxes */}
                                <canvas
                                    ref={canvasRef}
                                    className="absolute top-0 left-0 max-h-[250px] rounded-lg object-contain pointer-events-none"
                                    style={{ display: analysisResult?.objects?.length > 0 ? 'block' : 'none' }}
                                />
                            </div>
                        ) : (
                            <>
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-primary text-[32px]">add_a_photo</span>
                                </div>
                                <p className="text-white font-medium mb-1">Klik untuk Ambil Foto</p>
                                <p className="text-slate-500 text-sm">atau pilih dari galeri</p>
                            </>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        {previewUrl && (
                            <button onClick={resetUpload} className="flex-1 py-3 rounded-lg border border-border-dark text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-[18px]">refresh</span>
                                Ulangi
                            </button>
                        )}
                        <button
                            onClick={handleUpload}
                            disabled={!selectedFile || uploadStatus === 'analyzing' || uploadStatus === 'saving'}
                            className={`flex-[2] py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${!selectedFile ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20'}`}
                        >
                            {uploadStatus === 'analyzing' ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    Menganalisis...
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
                                    Upload & Analisis
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Right: Analysis Results */}
            <div className="w-full lg:w-1/2 flex flex-col gap-6">
                <div className="bg-surface-dark border border-border-dark rounded-lg p-6 flex flex-col gap-4 flex-1">
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <span className="material-symbols-outlined text-[20px]">analytics</span>
                        <span className="text-xs font-bold uppercase tracking-widest">Analysis Result</span>
                    </div>

                    {uploadStatus === 'idle' && !analysisResult && (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                            <span className="material-symbols-outlined text-[48px] mb-4 opacity-30">image_search</span>
                            <p>Upload foto untuk melihat hasil analisis</p>
                        </div>
                    )}

                    {uploadStatus === 'analyzing' && (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <div className="w-16 h-16 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4"></div>
                            <p className="font-medium">Menganalisis Foto...</p>
                            <p className="text-sm text-slate-500 mt-1">Membaca EXIF, mencocokkan koordinat, deteksi tiang</p>
                        </div>
                    )}

                    {uploadStatus === 'saving' && (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <div className="w-16 h-16 rounded-full border-4 border-green-500 border-t-transparent animate-spin mb-4"></div>
                            <p className="font-medium">Menyimpan ke Database...</p>
                        </div>
                    )}

                    {(uploadStatus === 'done' && analysisResult) && (
                        <div className="flex flex-col gap-4 overflow-auto">
                            {/* Save Status Messages */}
                            {saveStatus === 'success' && (
                                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                                    Evidence berhasil disimpan ke database!
                                </div>
                            )}
                            {saveStatus === 'error' && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">error</span>
                                    Gagal menyimpan. Pastikan Anda sudah login.
                                </div>
                            )}

                            {/* EXIF Data */}
                            <div className={`bg-[#1c1e20] border rounded-lg p-4 ${analysisResult.exif.hasGPS ? 'border-border-dark' : 'border-yellow-500/30'}`}>
                                <div className="flex items-center gap-2 text-slate-300 mb-3">
                                    <span className="material-symbols-outlined text-[18px]">location_on</span>
                                    <span className="text-sm font-bold uppercase tracking-wide">Koordinat EXIF</span>
                                    {!analysisResult.exif.hasGPS && (
                                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">No GPS</span>
                                    )}
                                </div>
                                {analysisResult.exif.hasGPS ? (
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-slate-500 text-xs">Latitude</p>
                                            <p className="text-white font-mono">{analysisResult.exif.latitude?.toFixed(6)}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs">Longitude</p>
                                            <p className="text-white font-mono">{analysisResult.exif.longitude?.toFixed(6)}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs">Timestamp</p>
                                            <p className="text-white font-mono text-xs">{new Date(analysisResult.exif.timestamp).toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-xs">Device</p>
                                            <p className="text-white">{analysisResult.exif.device}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2">
                                        <p className="text-yellow-400 text-sm mb-2">⚠️ Foto tidak memiliki data GPS. Pastikan lokasi diaktifkan saat mengambil foto.</p>
                                        <details className="text-xs text-slate-500 bg-black/20 p-2 rounded">
                                            <summary className="cursor-pointer hover:text-white">Debug: Raw EXIF Data ({Object.keys(analysisResult.exif.raw || {}).length} keys)</summary>
                                            <pre className="mt-2 text-[10px] overflow-auto max-h-40 font-mono text-slate-400">
                                                {JSON.stringify(analysisResult.exif.raw, null, 2)}
                                            </pre>
                                        </details>
                                    </div>
                                )}
                            </div>

                            {/* Matched Point */}
                            <div className={`border rounded-lg p-4 ${analysisResult.matchedPoint.withinRadius
                                ? 'bg-green-500/10 border-green-500/20'
                                : analysisResult.matchedPoint.point
                                    ? 'bg-yellow-500/10 border-yellow-500/20'
                                    : 'bg-red-500/10 border-red-500/20'
                                }`}>
                                <div className={`flex items-center gap-2 mb-3 ${analysisResult.matchedPoint.withinRadius ? 'text-green-500' :
                                    analysisResult.matchedPoint.point ? 'text-yellow-500' : 'text-red-500'
                                    }`}>
                                    <span className="material-symbols-outlined text-[18px]">
                                        {analysisResult.matchedPoint.withinRadius ? 'check_circle' :
                                            analysisResult.matchedPoint.point ? 'warning' : 'error'}
                                    </span>
                                    <span className="text-sm font-bold uppercase tracking-wide">Titik KML Terdekat</span>
                                    {!analysisResult.matchedPoint.withinRadius && analysisResult.matchedPoint.point && (
                                        <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Di luar radius</span>
                                    )}
                                </div>
                                {analysisResult.matchedPoint.point ? (
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-white font-bold text-lg">{analysisResult.matchedPoint.point.id}</p>
                                            <p className="text-slate-400 text-sm mb-1">{analysisResult.matchedPoint.point.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs px-2 py-0.5 rounded font-medium ${analysisResult.matchedPoint.point.category === 'Existing' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                                                    {analysisResult.matchedPoint.point.category || 'Existing'}
                                                </span>
                                                <span className="text-xs text-slate-500">•</span>
                                                <span className="text-xs text-slate-400">
                                                    {analysisResult.matchedPoint.point.infrastructureType || 'Unknown'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-mono text-lg ${analysisResult.matchedPoint.withinRadius ? 'text-green-400' : 'text-yellow-400'}`}>
                                                {analysisResult.matchedPoint.distance}m
                                            </p>
                                            <p className="text-slate-500 text-xs">jarak dari titik (max {radiusMeters}m)</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-red-400 text-sm">❌ Tidak ada titik KML dalam radius. Upload file KML terlebih dahulu.</p>
                                )}
                            </div>

                            {/* AI Detection */}
                            <div className="bg-[#1c1e20] border border-border-dark rounded-lg p-4">
                                <div className="flex items-center gap-2 text-purple-400 mb-3">
                                    <span className="material-symbols-outlined text-[18px]">smart_toy</span>
                                    <span className="text-sm font-bold uppercase tracking-wide">Deteksi AI (Tiang)</span>
                                    <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                                        {analysisResult.objects.length} objek
                                    </span>
                                </div>
                                {analysisResult.objects.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {analysisResult.objects.map((obj, idx) => (
                                            <div key={idx} className="bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2 flex items-center gap-2">
                                                <span className="text-purple-400 font-medium">{obj.label}</span>
                                                <span className="text-xs text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">{(obj.confidence * 100).toFixed(0)}%</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-slate-500 text-sm">Tidak terdeteksi tiang listrik dalam foto.</p>
                                )}
                            </div>

                            {/* Save to Report Button */}
                            <button
                                onClick={handleSaveToReport}
                                disabled={
                                    saveStatus === 'success' ||
                                    uploadStatus === 'saving' ||
                                    !analysisResult.exif.hasGPS ||
                                    !analysisResult.matchedPoint.withinRadius
                                }
                                className={`mt-2 w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 shadow-lg ${saveStatus === 'success' ? 'bg-green-600 text-white cursor-not-allowed' :
                                    (!analysisResult.exif.hasGPS || !analysisResult.matchedPoint.withinRadius) ? 'bg-slate-700 text-slate-500 cursor-not-allowed' :
                                        'bg-primary hover:bg-primary/90 text-white shadow-primary/20'
                                    }`}
                            >
                                {saveStatus === 'success' ? (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">check</span>
                                        Tersimpan
                                    </>
                                ) : !analysisResult.exif.hasGPS ? (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">gps_off</span>
                                        GPS Required
                                    </>
                                ) : !analysisResult.matchedPoint.withinRadius ? (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">wrong_location</span>
                                        Diluar Radius ({radiusMeters}m)
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined text-[18px]">save</span>
                                        Simpan ke Report
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};

export default UploadEvidence;

