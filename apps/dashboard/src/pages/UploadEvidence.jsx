import React, { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { extractExifData, findNearestPoint as findNearest } from '../lib/exifService'
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
    const [radiusMeters, setRadiusMeters] = useState(10); // Default radius 10 meters
    const fileInputRef = useRef(null);
    const canvasRef = useRef(null);
    const imageRef = useRef(null);

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

    // Get current user and project points on mount
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
                .limit(100);

            if (data && data.length > 0) {
                setProjectPoints(data.map(p => ({
                    id: p.point_id,
                    dbId: p.id,
                    latitude: parseFloat(p.latitude),
                    longitude: parseFloat(p.longitude),
                    name: p.name,
                    projectId: p.project_id
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
                        projectId: matchedPoint.point.projectId
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
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setUploadStatus('analyzing');
        setSaveStatus(null);

        try {
            // 1. Extract EXIF data from photo
            console.log('📍 Extracting EXIF data...');
            const exifData = await extractExifData(selectedFile);
            console.log('EXIF Data:', exifData);

            // 2. Find nearest KML point based on photo GPS
            let matchedPoint = { point: null, distance: null, withinRadius: false };
            if (exifData.hasGPS) {
                matchedPoint = findNearest(
                    exifData.latitude,
                    exifData.longitude,
                    projectPoints,
                    radiusMeters
                );
                console.log('📌 Nearest point:', matchedPoint);
            } else {
                console.log('⚠️ No GPS data in photo');
            }

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
                    latitude: exifData.latitude,
                    longitude: exifData.longitude,
                    timestamp: exifData.timestamp,
                    device: exifData.device,
                    hasGPS: exifData.hasGPS,
                    raw: exifData.raw
                },
                matchedPoint: {
                    point: matchedPoint.point ? {
                        id: matchedPoint.point.id,
                        dbId: matchedPoint.point.dbId,
                        name: matchedPoint.point.name,
                        projectId: matchedPoint.point.projectId
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

            {/* Top Header */}
            <header className="h-20 flex-shrink-0 px-8 flex items-center justify-between border-b border-border-dark bg-[#131416]/80 backdrop-blur-md z-10">
                <div>
                    <h2 className="text-white text-2xl font-heading font-bold leading-tight tracking-tight">Upload Evidence</h2>
                    <p className="text-slate-400 text-sm">Capture & Analyze Field Photos</p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Model Status */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${modelStatus === 'ready' ? 'bg-green-500/10 text-green-400' :
                        modelStatus === 'loading' ? 'bg-yellow-500/10 text-yellow-400' :
                            'bg-red-500/10 text-red-400'
                        }`}>
                        <span className={`w-2 h-2 rounded-full ${modelStatus === 'ready' ? 'bg-green-400' :
                            modelStatus === 'loading' ? 'bg-yellow-400 animate-pulse' :
                                'bg-red-400'
                            }`}></span>
                        {modelStatus === 'ready' ? 'AI Ready' :
                            modelStatus === 'loading' ? 'Loading AI...' : 'AI Error'}
                    </div>
                    {user && (
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Logged in as</p>
                            <p className="text-sm text-white">{user.email}</p>
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
                            {/* Radius Selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">Max Radius:</span>
                                <select
                                    value={radiusMeters}
                                    onChange={(e) => setRadiusMeters(Number(e.target.value))}
                                    className="bg-[#1c1e20] border border-border-dark text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-primary"
                                >
                                    <option value={5}>5m</option>
                                    <option value={10}>10m</option>
                                    <option value={15}>15m</option>
                                    <option value={20}>20m</option>
                                </select>
                            </div>
                        </div>

                        {/* Upload Zone */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
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
                                                <p className="text-slate-400 text-sm">{analysisResult.matchedPoint.point.name}</p>
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
            </div>
        </main>
    );
};

export default UploadEvidence;
