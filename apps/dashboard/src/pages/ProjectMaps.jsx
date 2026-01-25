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
    const [panelOpen, setPanelOpen] = useState(true);
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

    const updateRouteLine = (userLoc, target) => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L;
        const map = mapInstanceRef.current;

        if (lineRef.current) map.removeLayer(lineRef.current);
        arrowsRef.current.forEach(a => map.removeLayer(a));
        arrowsRef.current = [];

        // Outer glow layer (larger, more transparent)
        const outerGlow = L.polyline([[userLoc.lat, userLoc.lng], [target.latitude, target.longitude]], {
            color: '#00FFCC', weight: 20, opacity: 0.15, lineCap: 'round', lineJoin: 'round'
        }).addTo(map);
        arrowsRef.current.push(outerGlow);

        // Inner glow layer
        const innerGlow = L.polyline([[userLoc.lat, userLoc.lng], [target.latitude, target.longitude]], {
            color: '#1B988D', weight: 10, opacity: 0.35, lineCap: 'round', lineJoin: 'round'
        }).addTo(map);
        arrowsRef.current.push(innerGlow);

        // Main solid line (no dash for cleaner look)
        lineRef.current = L.polyline([[userLoc.lat, userLoc.lng], [target.latitude, target.longitude]], {
            color: '#1B988D', weight: 4, opacity: 1, lineCap: 'round', lineJoin: 'round'
        }).addTo(map);

        const bearing = calcBearing(userLoc.lat, userLoc.lng, target.latitude, target.longitude);
        const dist = calcDist(userLoc.lat, userLoc.lng, target.latitude, target.longitude);

        // More arrows for longer distances, minimum 3, max 12
        const numArrows = Math.min(Math.max(Math.floor(dist / 40), 3), 12);

        for (let i = 1; i <= numArrows; i++) {
            const fraction = i / (numArrows + 1);
            const lat = userLoc.lat + (target.latitude - userLoc.lat) * fraction;
            const lng = userLoc.lng + (target.longitude - userLoc.lng) * fraction;

            // Larger chevron-style arrow with enhanced glow
            const arrowIcon = L.divIcon({
                className: 'arrow-marker',
                html: `<div style="transform:rotate(${bearing}deg);width:36px;height:36px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 0 10px rgba(0,255,204,0.9)) drop-shadow(0 3px 6px rgba(0,0,0,0.6));">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#00FFCC" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 15 12 9 18 15"/>
                    </svg>
                </div>`,
                iconSize: [36, 36],
                iconAnchor: [18, 18]
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

    // Calculate top panel height for positioning
    const topPanelHeight = points.length > 0 ? 180 : 130;

    return (
        <main className="flex-1 h-full overflow-hidden bg-background-dark relative">
            <style>{`
                @keyframes pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.15);} }
                @keyframes slideDown { from{transform:translateY(-100%);opacity:0;} to{transform:translateY(0);opacity:1;} }
                @keyframes fadeIn { from{opacity:0;transform:translateY(20px);} to{opacity:1;transform:translateY(0);} }
            `}</style>

            {/* FULL SCREEN MAP */}
            <div ref={mapRef} className="absolute inset-0 z-0"></div>

            {/* TOP PANEL - ProjectMaps Controls - RESPONSIVE */}
            <div
                className={`fixed top-0 left-0 right-0 z-40 transition-all duration-500 ease-in-out ${panelOpen ? 'translate-y-0' : '-translate-y-full'}`}
            >
                <div className="bg-surface-dark/95 backdrop-blur-xl border-b border-border-dark shadow-2xl">
                    {/* Header with Navigation - Responsive */}
                    <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-white/5">
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="material-symbols-outlined text-3xl sm:text-4xl text-primary">explore</span>
                            <span className="font-bold text-xl sm:text-2xl text-white whitespace-nowrap">Project Maps</span>
                        </div>

                        {/* Quick Navigation - Responsive */}
                        <div className="ml-auto flex flex-wrap items-center gap-1">
                            <a href="/upload-evidence" className="min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/10 transition flex items-center gap-2">
                                <span className="material-symbols-outlined text-xl sm:text-2xl">photo_camera</span>
                                <span className="hidden md:inline font-medium">Upload</span>
                            </a>
                            <a href="/projects" className="min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/10 transition flex items-center gap-2">
                                <span className="material-symbols-outlined text-xl sm:text-2xl">folder_open</span>
                                <span className="hidden md:inline font-medium">Projects</span>
                            </a>
                            <a href="/reports" className="min-w-[44px] min-h-[44px] px-3 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/10 transition flex items-center gap-2">
                                <span className="material-symbols-outlined text-xl sm:text-2xl">description</span>
                                <span className="hidden md:inline font-medium">Reports</span>
                            </a>
                        </div>
                    </div>

                    {/* Filters - Responsive dropdowns */}
                    <div className="flex flex-wrap gap-3 px-4 py-3">
                        <select value={selectedRegion} onChange={(e) => { setSelectedRegion(e.target.value); setSelectedProjectId(''); }} className="flex-1 min-w-[140px] bg-white/5 border-2 border-white/15 text-white text-base sm:text-lg font-medium rounded-xl h-12 sm:h-14 px-3 sm:px-5 focus:border-primary focus:outline-none transition">
                            <option value="">Semua Region</option>
                            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="flex-1 min-w-[140px] bg-white/5 border-2 border-white/15 text-white text-base sm:text-lg font-medium rounded-xl h-12 sm:h-14 px-3 sm:px-5 focus:border-primary focus:outline-none transition">
                            <option value="">Pilih Project</option>
                            {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>

                    {/* Points horizontal scroll - Larger chips */}
                    {points.length > 0 && (
                        <div className="border-t border-white/5 py-2 sm:py-3 px-4 sm:px-5">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-2 sm:mb-3 text-sm sm:text-base text-slate-400">
                                <span className="bg-primary/20 text-primary px-3 sm:px-4 py-1 sm:py-1.5 rounded-full font-bold text-base sm:text-lg">{points.length}</span>
                                <span className="flex items-center gap-1 sm:gap-2"><span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-green-500"></span>Foto</span>
                                <span className="flex items-center gap-1 sm:gap-2"><span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-yellow-400"></span>Belum</span>
                            </div>
                            <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 sm:pb-3 scrollbar-hide">
                                {points.map((p, i) => (
                                    <button
                                        key={p.id}
                                        onClick={() => clickPoint(p)}
                                        className={`flex-shrink-0 min-h-[40px] sm:min-h-[48px] px-3 sm:px-5 py-2 sm:py-3 rounded-lg sm:rounded-xl text-sm sm:text-base font-semibold transition-all flex items-center gap-2 sm:gap-3 ${selectedPoint?.id === p.id ? 'bg-primary text-white' : 'bg-white/5 text-white hover:bg-white/10'}`}
                                    >
                                        <span className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${pointsWithEvidence.has(p.id) ? 'bg-green-500' : 'bg-yellow-400'}`}></span>
                                        <span className="truncate max-w-[100px] sm:max-w-[140px]">{p.point_id || p.name || `Titik ${i + 1}`}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TOGGLE BUTTON - Di dalam panel, di bagian bawah */}
                    <button
                        onClick={() => setPanelOpen(!panelOpen)}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all border-t border-white/5"
                    >
                        <span className="material-symbols-outlined text-2xl">{panelOpen ? 'expand_less' : 'expand_more'}</span>
                    </button>
                </div>
            </div>

            {/* TOGGLE BUTTON when panel is closed */}
            {!panelOpen && (
                <button
                    onClick={() => setPanelOpen(true)}
                    className="fixed top-0 left-1/2 -translate-x-1/2 z-40 w-14 h-10 bg-primary text-white rounded-b-xl shadow-2xl flex items-center justify-center transition-all hover:h-12"
                >
                    <span className="material-symbols-outlined text-2xl">expand_more</span>
                </button>
            )}

            {/* GPS STATUS - Larger badge */}
            <div
                className="fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-500"
                style={{ top: panelOpen ? `${topPanelHeight + 60}px` : '60px' }}
            >
                <div className={`px-6 py-4 rounded-2xl text-lg font-bold backdrop-blur-xl shadow-2xl flex items-center gap-4 ${userLocation ? 'bg-emerald-500/25 text-emerald-400 border-2 border-emerald-500/50' : 'bg-red-500/25 text-red-400 border-2 border-red-500/50'}`} style={{ boxShadow: userLocation ? '0 0 40px rgba(16,185,129,0.5)' : '0 4px 24px rgba(0,0,0,0.4)' }}>
                    <span className="relative flex h-5 w-5">
                        {userLocation && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                        <span className={`relative inline-flex rounded-full h-5 w-5 ${userLocation ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                    </span>
                    {userLocation ? 'GPS Aktif' : 'GPS Off'}
                </div>
            </div>

            {/* MY LOCATION BUTTON - Bottom right, tidak nabrak panel */}
            {userLocation && (
                <button
                    onClick={locateMe}
                    className="fixed bottom-32 sm:bottom-40 right-3 sm:right-5 z-[60] w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-xl border-2 border-primary/60 text-primary flex items-center justify-center shadow-2xl hover:bg-primary hover:text-white hover:scale-110 transition-all duration-300"
                    title="Lokasi Saya"
                    style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.4), 0 0 25px rgba(27,152,141,0.3)' }}
                >
                    <span className="material-symbols-outlined text-2xl sm:text-4xl">my_location</span>
                </button>
            )}



            {/* NAVIGATION INFO PANEL - Scaled Up 20% */}
            {selectedPoint && (
                <div className="fixed bottom-0 left-0 right-0 z-50 p-5" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                    <div className="max-w-xl mx-auto bg-surface-dark/95 backdrop-blur-xl rounded-3xl p-6 border-2 border-border-dark shadow-2xl">
                        <div className="flex items-center gap-5 mb-5">
                            {isNavigating && bearing !== null && (
                                <div className="w-20 h-20 rounded-full bg-primary/20 border-3 border-primary flex items-center justify-center flex-shrink-0 shadow-xl" style={{ boxShadow: '0 0 30px rgba(27,152,141,0.5)' }}>
                                    <span className="material-symbols-outlined text-4xl text-primary" style={{ transform: `rotate(${arrowRot}deg)`, transition: 'transform 0.2s' }}>navigation</span>
                                </div>
                            )}

                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-extrabold text-2xl truncate mb-2">{selectedPoint.point_id || selectedPoint.name}</h3>
                                <div className="flex items-center gap-3">
                                    <span className={`text-sm px-3 py-1 rounded-full font-semibold ${pointsWithEvidence.has(selectedPoint.id) ? 'bg-green-500/25 text-green-400' : 'bg-yellow-500/25 text-yellow-400'}`}>
                                        {pointsWithEvidence.has(selectedPoint.id) ? '✓ Ada Evidence' : '○ Belum ada'}
                                    </span>
                                    {distance !== null && distance < 15 && (
                                        <span className="text-emerald-400 text-sm font-bold animate-pulse">🎉 Sampai!</span>
                                    )}
                                </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                                <p className="text-5xl font-extrabold text-primary leading-none" style={{ textShadow: '0 0 25px rgba(27,152,141,0.4)' }}>{fmtDist(distance)}</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            {!isNavigating ? (
                                <button onClick={() => setIsNavigating(true)} className="flex-1 min-h-[56px] py-5 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-3 shadow-xl hover:bg-primary/90 transition-all text-xl">
                                    <span className="material-symbols-outlined text-3xl">navigation</span>
                                    Mulai Navigasi
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => setIsNavigating(false)} className="min-h-[56px] px-6 py-5 rounded-2xl bg-slate-700 text-white font-semibold hover:bg-slate-600 transition text-lg">
                                        Stop
                                    </button>
                                    <a
                                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.latitude},${selectedPoint.longitude}&travelmode=walking`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 min-h-[56px] py-5 rounded-2xl bg-blue-600 text-white font-bold flex items-center justify-center gap-3 shadow-xl hover:bg-blue-500 transition-all text-xl"
                                    >
                                        <span className="material-symbols-outlined text-3xl">open_in_new</span>
                                        Google Maps
                                    </a>
                                </>
                            )}
                            <button onClick={closeNav} className="min-w-[56px] min-h-[56px] px-5 py-5 rounded-2xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition">
                                <span className="material-symbols-outlined text-3xl">close</span>
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
                    <p className="text-lg">Pilih project dari panel atas</p>
                </div>
            )}
        </main>
    );
};

export default ProjectMaps;
