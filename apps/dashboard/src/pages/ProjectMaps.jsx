import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const REGIONS = [
    'TREG I Sumatera',
    'TREG II Jabodetabek',
    'TREG III Jawa Barat',
    'TREG IV Jateng & DIY',
    'TREG V Jawa Timur',
    'TREG VI Kalimantan',
    'TREG VII KTI'
];

const ProjectMaps = () => {
    const [projects, setProjects] = useState([]);
    const [points, setPoints] = useState([]);
    const [pointsWithEvidence, setPointsWithEvidence] = useState(new Set());
    const [selectedRegion, setSelectedRegion] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [userHeading, setUserHeading] = useState(0);
    const [isNavigating, setIsNavigating] = useState(false);
    const [distance, setDistance] = useState(null);
    const [showControls, setShowControls] = useState(true);
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const userMarkerRef = useRef(null);
    const pointMarkersRef = useRef({});
    const lineRef = useRef(null);
    const distanceLabelRef = useRef(null);
    const selectedPointRef = useRef(null);

    // Fetch projects
    useEffect(() => {
        const fetchProjects = async () => {
            const { data } = await supabase.from('projects').select('*').is('deleted_at', null).order('created_at', { ascending: false });
            if (data) setProjects(data);
        };
        fetchProjects();
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
            const L = window.L;
            const map = L.map(mapRef.current, {
                zoomControl: false,
                touchZoom: true,
                scrollWheelZoom: true,
                doubleClickZoom: true,
                dragging: true
            }).setView([-6.2088, 106.8456], 18);

            // Carto Voyager - supports high zoom
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '',
                maxZoom: 24,
                maxNativeZoom: 20
            }).addTo(map);

            // Add zoom control bottom right
            L.control.zoom({ position: 'bottomright' }).addTo(map);

            mapInstanceRef.current = map;
        };
        document.head.appendChild(script);

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // GPS tracking
    useEffect(() => {
        if (!navigator.geolocation) return;

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
                setUserLocation(loc);
                if (position.coords.heading && !isNaN(position.coords.heading)) setUserHeading(position.coords.heading);
                updateUserMarker(loc, position.coords.heading || userHeading);
                updateDistanceToTarget(loc);
            },
            () => { },
            { enableHighAccuracy: true, maximumAge: 500, timeout: 10000 }
        );

        const handleOrientation = (e) => {
            let h = e.webkitCompassHeading || (e.alpha ? 360 - e.alpha : null);
            if (h !== null && !isNaN(h)) {
                setUserHeading(h);
                if (userLocation) updateUserMarker(userLocation, h);
            }
        };
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
        window.addEventListener('deviceorientation', handleOrientation, true);

        return () => {
            navigator.geolocation.clearWatch(watchId);
            window.removeEventListener('deviceorientationabsolute', handleOrientation);
            window.removeEventListener('deviceorientation', handleOrientation);
        };
    }, []);

    const updateUserMarker = (loc, heading) => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L;

        const icon = L.divIcon({
            className: 'user-marker',
            html: `<div style="width:60px;height:60px;position:relative;">
                <div style="position:absolute;top:0;left:50%;transform:translateX(-50%) rotate(${heading || 0}deg);transform-origin:center 30px;transition:transform 0.3s;">
                    <div style="width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-bottom:24px solid #1B988D;"></div>
                </div>
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;background:#1B988D;border:5px solid white;border-radius:50%;box-shadow:0 4px 15px rgba(0,0,0,0.5);"></div>
            </div>`,
            iconSize: [60, 60],
            iconAnchor: [30, 30]
        });

        if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([loc.lat, loc.lng]);
            userMarkerRef.current.setIcon(icon);
        } else {
            userMarkerRef.current = L.marker([loc.lat, loc.lng], { icon, zIndexOffset: 2000 }).addTo(mapInstanceRef.current);
        }

        if (selectedPointRef.current && lineRef.current) {
            lineRef.current.setLatLngs([[loc.lat, loc.lng], [selectedPointRef.current.latitude, selectedPointRef.current.longitude]]);
            updateDistanceLabel(loc, selectedPointRef.current);
        }
    };

    const updateDistanceToTarget = (loc) => {
        if (!selectedPointRef.current) return;
        setDistance(calculateDistance(loc.lat, loc.lng, selectedPointRef.current.latitude, selectedPointRef.current.longitude));
    };

    const updateDistanceLabel = (loc, target) => {
        if (!distanceLabelRef.current || !window.L) return;
        const L = window.L;
        const midLat = (loc.lat + target.latitude) / 2;
        const midLng = (loc.lng + target.longitude) / 2;
        const d = calculateDistance(loc.lat, loc.lng, target.latitude, target.longitude);
        const distText = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;

        distanceLabelRef.current.setLatLng([midLat, midLng]);
        distanceLabelRef.current.setIcon(L.divIcon({
            className: 'dist-label',
            html: `<div style="background:#1B988D;color:white;padding:10px 18px;border-radius:30px;font-size:18px;font-weight:bold;box-shadow:0 4px 15px rgba(0,0,0,0.4);border:3px solid white;">${distText}</div>`,
            iconSize: [120, 50],
            iconAnchor: [60, 25]
        }));
    };

    // Fetch points
    useEffect(() => {
        if (!selectedProjectId) {
            setPoints([]);
            setPointsWithEvidence(new Set());
            clearAllMarkers();
            return;
        }

        const fetchData = async () => {
            const [{ data: pts }, { data: evs }] = await Promise.all([
                supabase.from('points').select('*').eq('project_id', selectedProjectId).order('point_id'),
                supabase.from('evidence').select('point_id').eq('project_id', selectedProjectId)
            ]);

            if (pts) {
                setPoints(pts);
                const evSet = new Set(evs?.map(e => e.point_id) || []);
                setPointsWithEvidence(evSet);
                setSelectedPoint(null);
                selectedPointRef.current = null;
                setIsNavigating(false);
                setDistance(null);
                setTimeout(() => addPointsToMap(pts, evSet), 200);
            }
        };
        fetchData();
    }, [selectedProjectId]);

    const clearAllMarkers = () => {
        Object.values(pointMarkersRef.current).forEach(m => mapInstanceRef.current?.removeLayer(m));
        pointMarkersRef.current = {};
        if (lineRef.current) { mapInstanceRef.current?.removeLayer(lineRef.current); lineRef.current = null; }
        if (distanceLabelRef.current) { mapInstanceRef.current?.removeLayer(distanceLabelRef.current); distanceLabelRef.current = null; }
    };

    const addPointsToMap = (pts, evSet) => {
        if (!mapInstanceRef.current || !window.L || !pts.length) return;
        const L = window.L;
        const map = mapInstanceRef.current;
        clearAllMarkers();
        const bounds = L.latLngBounds();

        pts.forEach((p, i) => {
            if (!p.latitude || !p.longitude) return;
            const name = p.point_id || p.name || `Titik ${i + 1}`;
            const hasEv = evSet.has(p.id);
            const marker = createPointMarker(L, p, name, false, hasEv);
            marker.addTo(map).on('click', () => handlePointClick(p));
            pointMarkersRef.current[p.id] = marker;
            bounds.extend([p.latitude, p.longitude]);
        });

        if (userLocation) bounds.extend([userLocation.lat, userLocation.lng]);
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 19 });
    };

    const createPointMarker = (L, point, name, isSelected, hasEvidence) => {
        const color = hasEvidence ? '#EF4444' : '#FBBF24';
        const bg = isSelected ? '#1B988D' : color;
        const size = isSelected ? 44 : 32;

        const icon = L.divIcon({
            className: 'point-marker',
            html: `<div style="position:relative;cursor:pointer;">
                <div style="width:${size}px;height:${size}px;background:${bg};border:${isSelected ? 5 : 4}px solid white;border-radius:50%;box-shadow:0 4px 15px rgba(0,0,0,0.5);${isSelected ? 'animation:pulse 1.5s infinite;' : ''}"></div>
                <div style="position:absolute;top:${size + 6}px;left:50%;transform:translateX(-50%);background:${isSelected ? '#1B988D' : 'rgba(0,0,0,0.9)'};color:white;padding:5px 10px;border-radius:8px;font-size:12px;font-weight:bold;white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${name}</div>
            </div>`,
            iconSize: [size, size + 40],
            iconAnchor: [size / 2, size / 2]
        });

        return L.marker([point.latitude, point.longitude], { icon, zIndexOffset: isSelected ? 1000 : 0 });
    };

    const handlePointClick = (point) => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L;
        const map = mapInstanceRef.current;

        // Reset previous
        if (selectedPointRef.current && pointMarkersRef.current[selectedPointRef.current.id]) {
            const prev = selectedPointRef.current;
            const prevMarker = createPointMarker(L, prev, prev.point_id || prev.name || 'Titik', false, pointsWithEvidence.has(prev.id));
            map.removeLayer(pointMarkersRef.current[prev.id]);
            prevMarker.addTo(map).on('click', () => handlePointClick(prev));
            pointMarkersRef.current[prev.id] = prevMarker;
        }

        // Highlight new
        const name = point.point_id || point.name || 'Titik';
        const newMarker = createPointMarker(L, point, name, true, pointsWithEvidence.has(point.id));
        map.removeLayer(pointMarkersRef.current[point.id]);
        newMarker.addTo(map).on('click', () => handlePointClick(point));
        pointMarkersRef.current[point.id] = newMarker;

        setSelectedPoint(point);
        selectedPointRef.current = point;
        setShowControls(true);

        if (lineRef.current) map.removeLayer(lineRef.current);
        if (distanceLabelRef.current) map.removeLayer(distanceLabelRef.current);

        if (userLocation) {
            const d = calculateDistance(userLocation.lat, userLocation.lng, point.latitude, point.longitude);
            setDistance(d);
            const distText = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;

            lineRef.current = L.polyline([[userLocation.lat, userLocation.lng], [point.latitude, point.longitude]], {
                color: '#1B988D', weight: 6, dashArray: '15, 10', opacity: 0.9
            }).addTo(map);

            const midLat = (userLocation.lat + point.latitude) / 2;
            const midLng = (userLocation.lng + point.longitude) / 2;
            distanceLabelRef.current = L.marker([midLat, midLng], {
                icon: L.divIcon({
                    className: 'dist-label',
                    html: `<div style="background:#1B988D;color:white;padding:10px 18px;border-radius:30px;font-size:18px;font-weight:bold;box-shadow:0 4px 15px rgba(0,0,0,0.4);border:3px solid white;">${distText}</div>`,
                    iconSize: [120, 50],
                    iconAnchor: [60, 25]
                }),
                zIndexOffset: 1500
            }).addTo(map);

            // SUPER CLOSE ZOOM - based on distance
            let zoom = 22;
            if (d < 10) zoom = 22;
            else if (d < 30) zoom = 21;
            else if (d < 60) zoom = 20;
            else if (d < 150) zoom = 19;
            else if (d < 400) zoom = 18;
            else if (d < 1000) zoom = 17;
            else zoom = 16;

            const cLat = (userLocation.lat + point.latitude) / 2;
            const cLng = (userLocation.lng + point.longitude) / 2;
            map.setView([cLat, cLng], zoom);
        } else {
            map.setView([point.latitude, point.longitude], 21);
        }
    };

    const calculateDistance = (lat1, lng1, lat2, lng2) => {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const calculateBearing = (lat1, lng1, lat2, lng2) => {
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
        const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    };

    const formatDistance = (m) => m === null ? '-' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
    const filteredProjects = selectedRegion ? projects.filter(p => p.region === selectedRegion) : projects;
    const bearing = selectedPoint && userLocation ? calculateBearing(userLocation.lat, userLocation.lng, selectedPoint.latitude, selectedPoint.longitude) : null;
    const arrowRotation = bearing !== null ? bearing - userHeading : 0;

    const closeNavigation = () => {
        setSelectedPoint(null);
        selectedPointRef.current = null;
        setDistance(null);
        setIsNavigating(false);
        if (lineRef.current) { mapInstanceRef.current?.removeLayer(lineRef.current); lineRef.current = null; }
        if (distanceLabelRef.current) { mapInstanceRef.current?.removeLayer(distanceLabelRef.current); distanceLabelRef.current = null; }

        if (window.L && mapInstanceRef.current) {
            Object.keys(pointMarkersRef.current).forEach(id => {
                const pt = points.find(p => p.id === id);
                if (pt) {
                    const marker = createPointMarker(window.L, pt, pt.point_id || pt.name || 'Titik', false, pointsWithEvidence.has(pt.id));
                    mapInstanceRef.current.removeLayer(pointMarkersRef.current[id]);
                    marker.addTo(mapInstanceRef.current).on('click', () => handlePointClick(pt));
                    pointMarkersRef.current[id] = marker;
                }
            });
        }
    };

    // Toggle controls visibility
    const toggleControls = () => setShowControls(!showControls);

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark relative">
            <style>{`
                @keyframes pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.15);} }
            `}</style>

            {/* MAP - Full screen */}
            <div ref={mapRef} className="absolute inset-0 bg-slate-900 z-0"></div>

            {/* Tap to toggle controls - center button */}
            <button
                onClick={toggleControls}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-16 h-16 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white/60 hover:bg-black/50 hover:text-white transition-all"
            >
                <span className="material-symbols-outlined text-3xl">
                    {showControls ? 'visibility_off' : 'visibility'}
                </span>
            </button>

            {/* Header - Collapsible */}
            <header className={`absolute top-0 left-0 right-0 z-10 transition-transform duration-300 ${showControls ? 'translate-y-0' : '-translate-y-full'}`}>
                <div className="bg-[#131416]/95 backdrop-blur-md border-b border-border-dark px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={selectedRegion}
                            onChange={(e) => { setSelectedRegion(e.target.value); setSelectedProjectId(''); }}
                            className="bg-input-bg border border-border-dark text-white text-xs rounded h-9 px-3 focus:outline-none focus:border-primary"
                        >
                            <option value="">Region</option>
                            {REGIONS.map(r => <option key={r} value={r}>{r.replace('TREG ', 'T')}</option>)}
                        </select>

                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="bg-input-bg border border-border-dark text-white text-xs rounded h-9 px-3 focus:outline-none focus:border-primary flex-1 max-w-[200px]"
                        >
                            <option value="">Project</option>
                            {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>

                        {points.length > 0 && (
                            <div className="flex items-center gap-2 text-[10px]">
                                <span className="bg-primary/20 text-primary px-2 py-1 rounded-full font-bold">{points.length}</span>
                                <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-red-500"></span>foto</span>
                                <span className="flex items-center gap-1 text-slate-400"><span className="w-2 h-2 rounded-full bg-yellow-400"></span>belum</span>
                            </div>
                        )}

                        {userLocation && (
                            <div className="ml-auto flex items-center gap-1 text-emerald-400 text-xs bg-emerald-500/10 px-2 py-1 rounded-full">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>GPS
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Navigation Panel - Collapsible from bottom */}
            {selectedPoint && (
                <div className={`absolute bottom-0 left-0 right-0 z-10 transition-transform duration-300 ${showControls ? 'translate-y-0' : 'translate-y-full'}`}>
                    <div className="bg-gradient-to-t from-[#0d0e10] via-[#0d0e10]/98 to-transparent p-4 pt-10">
                        <div className="max-w-md mx-auto bg-surface-dark/95 backdrop-blur-lg rounded-2xl p-4 border border-border-dark shadow-2xl">
                            <div className="flex items-center gap-3 mb-3">
                                {isNavigating && bearing !== null && (
                                    <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-3xl text-primary" style={{ transform: `rotate(${arrowRotation}deg)`, transition: 'transform 0.2s' }}>navigation</span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-bold text-base truncate">{selectedPoint.point_id || selectedPoint.name}</h3>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pointsWithEvidence.has(selectedPoint.id) ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        {pointsWithEvidence.has(selectedPoint.id) ? '✓ Ada Evidence' : '○ Belum'}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-bold text-primary">{formatDistance(distance)}</p>
                                    {distance !== null && distance < 15 && <p className="text-emerald-400 text-xs font-bold animate-pulse">🎉 Sampai!</p>}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {!isNavigating ? (
                                    <button onClick={() => setIsNavigating(true)} className="flex-1 py-3 rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 shadow-lg text-sm">
                                        <span className="material-symbols-outlined">navigation</span>Navigasi
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={() => setIsNavigating(false)} className="px-4 py-3 rounded-xl bg-slate-700 text-white text-sm">Stop</button>
                                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.latitude},${selectedPoint.longitude}`} target="_blank" rel="noopener noreferrer" className="flex-1 py-3 rounded-xl bg-blue-600 text-white flex items-center justify-center gap-2 text-sm">
                                            <span className="material-symbols-outlined text-lg">open_in_new</span>GMaps
                                        </a>
                                    </>
                                )}
                                <button onClick={closeNavigation} className="px-3 py-3 rounded-xl bg-slate-800 text-slate-400 hover:text-white">
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!selectedProjectId && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-surface-dark/90 z-5">
                    <span className="material-symbols-outlined text-7xl mb-4 opacity-20">explore</span>
                    <p className="text-xl font-semibold text-white mb-2">Project Maps</p>
                    <p className="text-sm">Pilih project di atas untuk melihat titik</p>
                </div>
            )}
        </main>
    );
};

export default ProjectMaps;
