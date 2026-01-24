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
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const userMarkerRef = useRef(null);
    const pointMarkersRef = useRef({});
    const lineRef = useRef(null);
    const arrowsRef = useRef([]);
    const selectedPointRef = useRef(null);

    useEffect(() => {
        supabase.from('projects').select('*').is('deleted_at', null).order('created_at', { ascending: false })
            .then(({ data }) => data && setProjects(data));
    }, []);

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
            const map = L.map(mapRef.current, { zoomControl: false, touchZoom: true, scrollWheelZoom: true, doubleClickZoom: true, dragging: true }).setView([-6.2088, 106.8456], 18);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 24, maxNativeZoom: 20 }).addTo(map);
            L.control.zoom({ position: 'bottomright' }).addTo(map);
            mapInstanceRef.current = map;
        };
        document.head.appendChild(script);
        return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
    }, []);

    useEffect(() => {
        if (!navigator.geolocation) return;
        const watchId = navigator.geolocation.watchPosition(
            (pos) => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setUserLocation(loc);
                if (pos.coords.heading && !isNaN(pos.coords.heading)) setUserHeading(pos.coords.heading);
                updateUserMarker(loc, pos.coords.heading || userHeading);
                if (selectedPointRef.current) {
                    const d = calcDist(loc.lat, loc.lng, selectedPointRef.current.latitude, selectedPointRef.current.longitude);
                    setDistance(d);
                    updateRouteLine(loc, selectedPointRef.current);
                }
            },
            () => { },
            { enableHighAccuracy: true, maximumAge: 500, timeout: 10000 }
        );
        const handleOri = (e) => {
            let h = e.webkitCompassHeading || (e.alpha ? 360 - e.alpha : null);
            if (h !== null && !isNaN(h)) { setUserHeading(h); if (userLocation) updateUserMarker(userLocation, h); }
        };
        window.addEventListener('deviceorientationabsolute', handleOri, true);
        window.addEventListener('deviceorientation', handleOri, true);
        return () => { navigator.geolocation.clearWatch(watchId); window.removeEventListener('deviceorientationabsolute', handleOri); window.removeEventListener('deviceorientation', handleOri); };
    }, []);

    const updateUserMarker = (loc, heading) => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L;
        const icon = L.divIcon({
            className: 'user-marker',
            html: `<div style="width:60px;height:60px;position:relative;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3));">
                <div style="position:absolute;top:0;left:50%;transform:translateX(-50%) rotate(${heading || 0}deg);transform-origin:center 30px;transition:transform 0.3s;">
                    <div style="width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-bottom:24px solid #1B988D;"></div>
                </div>
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;background:#1B988D;border:5px solid white;border-radius:50%;box-shadow:0 0 20px rgba(27,152,141,0.6);"></div>
            </div>`,
            iconSize: [60, 60], iconAnchor: [30, 30]
        });
        if (userMarkerRef.current) { userMarkerRef.current.setLatLng([loc.lat, loc.lng]); userMarkerRef.current.setIcon(icon); }
        else { userMarkerRef.current = L.marker([loc.lat, loc.lng], { icon, zIndexOffset: 2000 }).addTo(mapInstanceRef.current); }
    };

    // Create directional arrows along line
    const updateRouteLine = (userLoc, target) => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L;
        const map = mapInstanceRef.current;

        // Clear existing
        if (lineRef.current) map.removeLayer(lineRef.current);
        arrowsRef.current.forEach(a => map.removeLayer(a));
        arrowsRef.current = [];

        // Main line with glow effect
        const glowLine = L.polyline([[userLoc.lat, userLoc.lng], [target.latitude, target.longitude]], {
            color: '#1B988D', weight: 12, opacity: 0.3, lineCap: 'round'
        }).addTo(map);

        lineRef.current = L.polyline([[userLoc.lat, userLoc.lng], [target.latitude, target.longitude]], {
            color: '#1B988D', weight: 5, opacity: 1, lineCap: 'round', dashArray: '1, 15'
        }).addTo(map);
        arrowsRef.current.push(glowLine);

        // Calculate bearing for arrows
        const bearing = calcBearing(userLoc.lat, userLoc.lng, target.latitude, target.longitude);
        const dist = calcDist(userLoc.lat, userLoc.lng, target.latitude, target.longitude);
        const numArrows = Math.min(Math.max(Math.floor(dist / 50), 2), 10);

        // Add directional arrows along the path
        for (let i = 1; i <= numArrows; i++) {
            const fraction = i / (numArrows + 1);
            const lat = userLoc.lat + (target.latitude - userLoc.lat) * fraction;
            const lng = userLoc.lng + (target.longitude - userLoc.lng) * fraction;

            const arrowIcon = L.divIcon({
                className: 'arrow-marker',
                html: `<div style="transform:rotate(${bearing}deg);width:20px;height:20px;display:flex;align-items:center;justify-content:center;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1B988D" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                        <path d="M12 2L4 14h6v8h4v-8h6L12 2z"/>
                    </svg>
                </div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            const arrow = L.marker([lat, lng], { icon: arrowIcon, zIndexOffset: 500, interactive: false }).addTo(map);
            arrowsRef.current.push(arrow);
        }
    };

    const locateMe = () => {
        if (userLocation && mapInstanceRef.current) {
            mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 20);
        }
    };

    useEffect(() => {
        if (!selectedProjectId) { setPoints([]); setPointsWithEvidence(new Set()); clearMarkers(); return; }
        const fetch = async () => {
            const [{ data: pts }, { data: evs }] = await Promise.all([
                supabase.from('points').select('*').eq('project_id', selectedProjectId).order('point_id'),
                supabase.from('evidence').select('point_id').eq('project_id', selectedProjectId)
            ]);
            if (pts) {
                setPoints(pts);
                const evSet = new Set();
                if (evs) evs.forEach(e => { if (e.point_id) evSet.add(e.point_id); });
                setPointsWithEvidence(evSet);
                setSelectedPoint(null); selectedPointRef.current = null; setIsNavigating(false); setDistance(null);
                setTimeout(() => addPoints(pts, evSet), 200);
            }
        };
        fetch();
    }, [selectedProjectId]);

    const clearMarkers = () => {
        Object.values(pointMarkersRef.current).forEach(m => mapInstanceRef.current?.removeLayer(m));
        pointMarkersRef.current = {};
        if (lineRef.current) { mapInstanceRef.current?.removeLayer(lineRef.current); lineRef.current = null; }
        arrowsRef.current.forEach(a => mapInstanceRef.current?.removeLayer(a));
        arrowsRef.current = [];
    };

    const addPoints = (pts, evSet) => {
        if (!mapInstanceRef.current || !window.L || !pts.length) return;
        const L = window.L, map = mapInstanceRef.current;
        clearMarkers();
        const bounds = L.latLngBounds();
        pts.forEach((p, i) => {
            if (!p.latitude || !p.longitude) return;
            const name = p.point_id || p.name || `Titik ${i + 1}`;
            const hasEv = evSet.has(p.id);
            const marker = mkMarker(L, p, name, false, hasEv);
            marker.addTo(map).on('click', () => clickPoint(p));
            pointMarkersRef.current[p.id] = marker;
            bounds.extend([p.latitude, p.longitude]);
        });
        if (userLocation) bounds.extend([userLocation.lat, userLocation.lng]);
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 19 });
    };

    const mkMarker = (L, p, name, sel, hasEv) => {
        const col = hasEv ? '#22C55E' : '#FBBF24';
        const bg = sel ? '#1B988D' : col;
        const sz = sel ? 44 : 32;
        const glow = sel ? 'box-shadow:0 0 20px rgba(27,152,141,0.8);' : '';
        return L.marker([p.latitude, p.longitude], {
            icon: L.divIcon({
                className: 'pt',
                html: `<div style="position:relative;cursor:pointer;">
                    <div style="width:${sz}px;height:${sz}px;background:${bg};border:${sel ? 5 : 4}px solid white;border-radius:50%;${glow}${sel ? 'animation:pulse 1.5s infinite;' : ''}"></div>
                    <div style="position:absolute;top:${sz + 6}px;left:50%;transform:translateX(-50%);background:${sel ? '#1B988D' : 'rgba(0,0,0,0.9)'};color:white;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:bold;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px rgba(0,0,0,0.4);">${name}</div>
                </div>`,
                iconSize: [sz, sz + 35], iconAnchor: [sz / 2, sz / 2]
            }),
            zIndexOffset: sel ? 1000 : 0
        });
    };

    const clickPoint = (p) => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L, map = mapInstanceRef.current;
        if (selectedPointRef.current && pointMarkersRef.current[selectedPointRef.current.id]) {
            const prev = selectedPointRef.current;
            const pm = mkMarker(L, prev, prev.point_id || prev.name || 'Titik', false, pointsWithEvidence.has(prev.id));
            map.removeLayer(pointMarkersRef.current[prev.id]);
            pm.addTo(map).on('click', () => clickPoint(prev));
            pointMarkersRef.current[prev.id] = pm;
        }
        const name = p.point_id || p.name || 'Titik';
        const nm = mkMarker(L, p, name, true, pointsWithEvidence.has(p.id));
        map.removeLayer(pointMarkersRef.current[p.id]);
        nm.addTo(map).on('click', () => clickPoint(p));
        pointMarkersRef.current[p.id] = nm;
        setSelectedPoint(p); selectedPointRef.current = p;

        if (userLocation) {
            const d = calcDist(userLocation.lat, userLocation.lng, p.latitude, p.longitude);
            setDistance(d);
            updateRouteLine(userLocation, p);

            let z = 22;
            if (d < 10) z = 22; else if (d < 30) z = 21; else if (d < 60) z = 20; else if (d < 150) z = 19; else if (d < 400) z = 18; else if (d < 1000) z = 17; else z = 16;
            map.setView([(userLocation.lat + p.latitude) / 2, (userLocation.lng + p.longitude) / 2], z);
        } else {
            map.setView([p.latitude, p.longitude], 21);
        }
    };

    const calcDist = (lat1, lng1, lat2, lng2) => {
        const R = 6371000, dLat = (lat2 - lat1) * Math.PI / 180, dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    const calcBearing = (lat1, lng1, lat2, lng2) => {
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
        const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    };

    const fmtDist = (m) => m === null ? '-' : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
    const filteredProjects = selectedRegion ? projects.filter(p => p.region === selectedRegion) : projects;
    const bearing = selectedPoint && userLocation ? calcBearing(userLocation.lat, userLocation.lng, selectedPoint.latitude, selectedPoint.longitude) : null;
    const arrowRot = bearing !== null ? bearing - userHeading : 0;

    const closeNav = () => {
        setSelectedPoint(null); selectedPointRef.current = null; setDistance(null); setIsNavigating(false);
        clearMarkers();
        if (points.length > 0) addPoints(points, pointsWithEvidence);
    };

    return (
        <main className="flex-1 h-full overflow-hidden bg-background-dark relative">
            <style>{`
                @keyframes pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.15);} }
                @keyframes slideIn { from{transform:translateX(-100%);opacity:0;} to{transform:translateX(0);opacity:1;} }
                @keyframes fadeIn { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }
            `}</style>

            {/* FULL SCREEN MAP */}
            <div ref={mapRef} className="absolute inset-0 z-0"></div>

            {/* FLOATING OVERLAY SIDEBAR - A. Requirements */}
            <aside
                className={`fixed top-16 left-0 h-[calc(100vh-4rem)] z-40 transition-all duration-500 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
                style={{ width: '320px' }}
            >
                <div className="h-full bg-surface-dark/90 backdrop-blur-xl border-r border-border-dark shadow-2xl flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-border-dark/50">
                        <h2 className="text-white font-bold text-xl mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">explore</span>
                            Project Maps
                        </h2>
                        <select value={selectedRegion} onChange={(e) => { setSelectedRegion(e.target.value); setSelectedProjectId(''); }} className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-lg h-11 px-4 mb-3 focus:border-primary focus:outline-none transition">
                            <option value="">Semua Region</option>
                            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-lg h-11 px-4 focus:border-primary focus:outline-none transition">
                            <option value="">Pilih Project</option>
                            {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    {/* Stats */}
                    {points.length > 0 && (
                        <div className="px-4 py-3 border-b border-border-dark/50 flex items-center gap-3 text-sm">
                            <span className="bg-primary/20 text-primary px-3 py-1 rounded-full font-bold">{points.length} Titik</span>
                            <span className="flex items-center gap-1.5 text-slate-400"><span className="w-3 h-3 rounded-full bg-green-500"></span>Ada foto</span>
                            <span className="flex items-center gap-1.5 text-slate-400"><span className="w-3 h-3 rounded-full bg-yellow-400"></span>Belum</span>
                        </div>
                    )}

                    {/* Points List */}
                    <div className="flex-1 overflow-y-auto">
                        {points.map((p, i) => (
                            <button key={p.id} onClick={() => clickPoint(p)} className={`w-full text-left px-4 py-3.5 border-b border-white/5 hover:bg-white/5 transition-all ${selectedPoint?.id === p.id ? 'bg-primary/15 border-l-4 border-l-primary' : ''}`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-white font-medium truncate">{p.point_id || p.name || `Titik ${i + 1}`}</span>
                                    <span className={`w-3 h-3 rounded-full flex-shrink-0 ${pointsWithEvidence.has(p.id) ? 'bg-green-500' : 'bg-yellow-400'}`}></span>
                                </div>
                            </button>
                        ))}
                        {points.length === 0 && selectedProjectId && (
                            <div className="p-8 text-center text-slate-500">
                                <span className="material-symbols-outlined text-4xl mb-2 block opacity-50">location_off</span>
                                Tidak ada titik
                            </div>
                        )}
                    </div>
                </div>
            </aside>

            {/* TOGGLE SIDEBAR BUTTON - Always visible chevron */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`fixed top-1/2 -translate-y-1/2 z-50 w-8 h-16 bg-primary text-white rounded-r-lg shadow-xl flex items-center justify-center transition-all duration-500 hover:w-10 ${sidebarOpen ? 'left-[320px]' : 'left-0'}`}
            >
                <span className="material-symbols-outlined text-xl">{sidebarOpen ? 'chevron_left' : 'chevron_right'}</span>
            </button>

            {/* GPS & LOCATE BUTTONS */}
            <div className="fixed top-20 right-4 z-40 flex flex-col gap-2">
                {userLocation && (
                    <button onClick={locateMe} className="w-12 h-12 rounded-xl bg-surface-dark/90 backdrop-blur border border-primary/50 text-primary flex items-center justify-center shadow-xl hover:bg-primary hover:text-white transition-all" title="Lokasi Saya">
                        <span className="material-symbols-outlined text-2xl">my_location</span>
                    </button>
                )}
                <div className={`px-3 py-2 rounded-xl text-xs font-medium backdrop-blur shadow-lg ${userLocation ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${userLocation ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
                    {userLocation ? 'GPS' : 'Off'}
                </div>
            </div>

            {/* STICKY DISTANCE LABEL - B. Requirement - Fixed to viewport */}
            {selectedPoint && distance !== null && (
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
                    <div className="bg-primary text-white px-6 py-3 rounded-2xl text-xl font-bold shadow-2xl border-2 border-white/30" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                        {fmtDist(distance)}
                    </div>
                </div>
            )}

            {/* NAVIGATION INFO PANEL - C. Requirements - Fixed Bottom Sheet */}
            {selectedPoint && (
                <div className="fixed bottom-0 left-0 right-0 z-50 p-4" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <div className="max-w-lg mx-auto bg-surface-dark/95 backdrop-blur-xl rounded-2xl p-5 border border-border-dark shadow-2xl">
                        {/* Header Row */}
                        <div className="flex items-center gap-4 mb-4">
                            {/* Compass */}
                            {isNavigating && bearing !== null && (
                                <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center flex-shrink-0 shadow-lg" style={{ boxShadow: '0 0 20px rgba(27,152,141,0.4)' }}>
                                    <span className="material-symbols-outlined text-3xl text-primary" style={{ transform: `rotate(${arrowRot}deg)`, transition: 'transform 0.2s' }}>navigation</span>
                                </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-bold text-lg truncate mb-1">{selectedPoint.point_id || selectedPoint.name}</h3>
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pointsWithEvidence.has(selectedPoint.id) ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        {pointsWithEvidence.has(selectedPoint.id) ? '✓ Ada Evidence' : '○ Belum ada'}
                                    </span>
                                    {distance !== null && distance < 15 && (
                                        <span className="text-emerald-400 text-xs font-bold animate-pulse">🎉 Sampai!</span>
                                    )}
                                </div>
                            </div>

                            {/* Distance */}
                            <div className="text-right flex-shrink-0">
                                <p className="text-4xl font-bold text-primary leading-none" style={{ textShadow: '0 0 20px rgba(27,152,141,0.3)' }}>{fmtDist(distance)}</p>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                            {!isNavigating ? (
                                <button onClick={() => setIsNavigating(true)} className="flex-1 py-3.5 rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 shadow-lg hover:bg-primary/90 transition-all text-base">
                                    <span className="material-symbols-outlined">navigation</span>
                                    Mulai Navigasi
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => setIsNavigating(false)} className="px-5 py-3.5 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-600 transition">
                                        Stop
                                    </button>
                                    <a
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.latitude},${selectedPoint.longitude}&travelmode=walking`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 py-3.5 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 shadow-lg hover:bg-blue-500 transition-all"
                                    >
                                        <span className="material-symbols-outlined">open_in_new</span>
                                        Buka Google Maps
                                    </a>
                                </>
                            )}
                            <button onClick={closeNav} className="px-4 py-3.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!selectedProjectId && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-surface-dark/80 backdrop-blur-sm z-10">
                    <span className="material-symbols-outlined text-8xl mb-4 opacity-20">explore</span>
                    <p className="text-2xl font-semibold text-white mb-2">Project Maps</p>
                    <p className="text-base">Pilih project dari sidebar untuk melihat titik lokasi</p>
                </div>
            )}
        </main>
    );
};

export default ProjectMaps;
