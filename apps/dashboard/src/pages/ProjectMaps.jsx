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
                if (selectedPointRef.current) setDistance(calcDist(loc.lat, loc.lng, selectedPointRef.current.latitude, selectedPointRef.current.longitude));
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
            html: `<div style="width:60px;height:60px;position:relative;">
                <div style="position:absolute;top:0;left:50%;transform:translateX(-50%) rotate(${heading || 0}deg);transform-origin:center 30px;transition:transform 0.3s;">
                    <div style="width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-bottom:24px solid #1B988D;"></div>
                </div>
                <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;background:#1B988D;border:5px solid white;border-radius:50%;box-shadow:0 4px 15px rgba(0,0,0,0.5);"></div>
            </div>`,
            iconSize: [60, 60], iconAnchor: [30, 30]
        });
        if (userMarkerRef.current) { userMarkerRef.current.setLatLng([loc.lat, loc.lng]); userMarkerRef.current.setIcon(icon); }
        else { userMarkerRef.current = L.marker([loc.lat, loc.lng], { icon, zIndexOffset: 2000 }).addTo(mapInstanceRef.current); }
        if (selectedPointRef.current && lineRef.current) {
            lineRef.current.setLatLngs([[loc.lat, loc.lng], [selectedPointRef.current.latitude, selectedPointRef.current.longitude]]);
            updateDistLabel(loc, selectedPointRef.current);
        }
    };

    const updateDistLabel = (loc, target) => {
        if (!distanceLabelRef.current || !window.L) return;
        const L = window.L;
        const d = calcDist(loc.lat, loc.lng, target.latitude, target.longitude);
        const txt = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
        distanceLabelRef.current.setLatLng([(loc.lat + target.latitude) / 2, (loc.lng + target.longitude) / 2]);
        distanceLabelRef.current.setIcon(L.divIcon({ className: 'dist', html: `<div style="background:#1B988D;color:white;padding:8px 14px;border-radius:20px;font-size:16px;font-weight:bold;box-shadow:0 3px 10px rgba(0,0,0,0.4);border:2px solid white;">${txt}</div>`, iconSize: [100, 40], iconAnchor: [50, 20] }));
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
                // FIXED: Check evidence by matching evidence.point_id with point.id
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
        if (distanceLabelRef.current) { mapInstanceRef.current?.removeLayer(distanceLabelRef.current); distanceLabelRef.current = null; }
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
        const col = hasEv ? '#22C55E' : '#FBBF24';  // GREEN = has, YELLOW = no
        const bg = sel ? '#1B988D' : col;
        const sz = sel ? 44 : 32;
        return L.marker([p.latitude, p.longitude], {
            icon: L.divIcon({
                className: 'pt',
                html: `<div style="position:relative;cursor:pointer;">
                    <div style="width:${sz}px;height:${sz}px;background:${bg};border:${sel ? 5 : 4}px solid white;border-radius:50%;box-shadow:0 4px 15px rgba(0,0,0,0.5);${sel ? 'animation:pulse 1.5s infinite;' : ''}"></div>
                    <div style="position:absolute;top:${sz + 6}px;left:50%;transform:translateX(-50%);background:${sel ? '#1B988D' : 'rgba(0,0,0,0.9)'};color:white;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:bold;white-space:nowrap;max-width:150px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 6px rgba(0,0,0,0.4);">${name}</div>
                </div>`,
                iconSize: [sz, sz + 35], iconAnchor: [sz / 2, sz / 2]
            }),
            zIndexOffset: sel ? 1000 : 0
        });
    };

    const clickPoint = (p) => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L, map = mapInstanceRef.current;
        // Reset prev
        if (selectedPointRef.current && pointMarkersRef.current[selectedPointRef.current.id]) {
            const prev = selectedPointRef.current;
            const pm = mkMarker(L, prev, prev.point_id || prev.name || 'Titik', false, pointsWithEvidence.has(prev.id));
            map.removeLayer(pointMarkersRef.current[prev.id]);
            pm.addTo(map).on('click', () => clickPoint(prev));
            pointMarkersRef.current[prev.id] = pm;
        }
        // Select new
        const name = p.point_id || p.name || 'Titik';
        const nm = mkMarker(L, p, name, true, pointsWithEvidence.has(p.id));
        map.removeLayer(pointMarkersRef.current[p.id]);
        nm.addTo(map).on('click', () => clickPoint(p));
        pointMarkersRef.current[p.id] = nm;
        setSelectedPoint(p); selectedPointRef.current = p;

        if (lineRef.current) map.removeLayer(lineRef.current);
        if (distanceLabelRef.current) map.removeLayer(distanceLabelRef.current);

        if (userLocation) {
            const d = calcDist(userLocation.lat, userLocation.lng, p.latitude, p.longitude);
            setDistance(d);
            const txt = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
            lineRef.current = L.polyline([[userLocation.lat, userLocation.lng], [p.latitude, p.longitude]], { color: '#1B988D', weight: 5, dashArray: '12, 8', opacity: 0.9 }).addTo(map);
            distanceLabelRef.current = L.marker([(userLocation.lat + p.latitude) / 2, (userLocation.lng + p.longitude) / 2], {
                icon: L.divIcon({ className: 'dist', html: `<div style="background:#1B988D;color:white;padding:8px 14px;border-radius:20px;font-size:16px;font-weight:bold;box-shadow:0 3px 10px rgba(0,0,0,0.4);border:2px solid white;">${txt}</div>`, iconSize: [100, 40], iconAnchor: [50, 20] }),
                zIndexOffset: 1500
            }).addTo(map);
            // SUPER ZOOM
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
        if (lineRef.current) { mapInstanceRef.current?.removeLayer(lineRef.current); lineRef.current = null; }
        if (distanceLabelRef.current) { mapInstanceRef.current?.removeLayer(distanceLabelRef.current); distanceLabelRef.current = null; }
        if (window.L && mapInstanceRef.current) {
            Object.keys(pointMarkersRef.current).forEach(id => {
                const pt = points.find(x => x.id === id);
                if (pt) {
                    const m = mkMarker(window.L, pt, pt.point_id || pt.name || 'Titik', false, pointsWithEvidence.has(pt.id));
                    mapInstanceRef.current.removeLayer(pointMarkersRef.current[id]);
                    m.addTo(mapInstanceRef.current).on('click', () => clickPoint(pt));
                    pointMarkersRef.current[id] = m;
                }
            });
        }
    };

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark relative">
            <style>{`@keyframes pulse { 0%,100%{transform:scale(1);} 50%{transform:scale(1.15);} }`}</style>

            {/* MAP */}
            <div ref={mapRef} className="absolute inset-0 bg-slate-900 z-0"></div>

            {/* Toggle Button - always visible */}
            <button onClick={() => setShowControls(!showControls)} className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full bg-black/50 backdrop-blur flex items-center justify-center text-white/80 hover:bg-black/70 transition-all shadow-lg">
                <span className="material-symbols-outlined text-xl">{showControls ? 'visibility_off' : 'visibility'}</span>
            </button>

            {/* Header */}
            <header className={`absolute top-0 left-0 right-16 z-20 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'}`}>
                <div className="bg-[#131416]/95 backdrop-blur-md px-3 py-2 rounded-br-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                        <select value={selectedRegion} onChange={(e) => { setSelectedRegion(e.target.value); setSelectedProjectId(''); }} className="bg-input-bg border border-border-dark text-white text-xs rounded h-8 px-2">
                            <option value="">Region</option>
                            {REGIONS.map(r => <option key={r} value={r}>{r.replace('TREG ', 'T')}</option>)}
                        </select>
                        <select value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)} className="bg-input-bg border border-border-dark text-white text-xs rounded h-8 px-2 max-w-[150px]">
                            <option value="">Project</option>
                            {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        {points.length > 0 && (
                            <div className="flex items-center gap-1.5 text-[9px]">
                                <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold">{points.length}</span>
                                <span className="flex items-center gap-0.5 text-slate-400"><span className="w-2 h-2 rounded-full bg-green-500"></span>✓</span>
                                <span className="flex items-center gap-0.5 text-slate-400"><span className="w-2 h-2 rounded-full bg-yellow-400"></span>○</span>
                            </div>
                        )}
                        {userLocation && <span className="text-emerald-400 text-[9px] bg-emerald-500/10 px-1.5 py-0.5 rounded-full flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>GPS</span>}
                    </div>
                </div>
            </header>

            {/* Compact Nav Panel - Fixed at bottom, always visible when point selected */}
            {selectedPoint && (
                <div className={`absolute bottom-4 left-4 right-4 z-20 transition-all duration-300 ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-full pointer-events-none'}`}>
                    <div className="bg-[#131416]/95 backdrop-blur-lg rounded-2xl p-3 border border-border-dark shadow-2xl">
                        <div className="flex items-center gap-3">
                            {/* Compass when navigating */}
                            {isNavigating && bearing !== null && (
                                <div className="w-12 h-12 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center flex-shrink-0">
                                    <span className="material-symbols-outlined text-2xl text-primary" style={{ transform: `rotate(${arrowRot}deg)`, transition: 'transform 0.2s' }}>navigation</span>
                                </div>
                            )}
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-white font-bold text-sm truncate">{selectedPoint.point_id || selectedPoint.name}</h3>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${pointsWithEvidence.has(selectedPoint.id) ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        {pointsWithEvidence.has(selectedPoint.id) ? '✓' : '○'}
                                    </span>
                                </div>
                            </div>
                            {/* Distance */}
                            <div className="text-right flex-shrink-0">
                                <p className="text-2xl font-bold text-primary leading-none">{fmtDist(distance)}</p>
                                {distance !== null && distance < 15 && <p className="text-emerald-400 text-[10px] font-bold">🎉 Sampai!</p>}
                            </div>
                        </div>
                        {/* Actions */}
                        <div className="flex gap-2 mt-2">
                            {!isNavigating ? (
                                <button onClick={() => setIsNavigating(true)} className="flex-1 py-2 rounded-lg bg-primary text-white text-xs font-semibold flex items-center justify-center gap-1">
                                    <span className="material-symbols-outlined text-lg">navigation</span>Navigasi
                                </button>
                            ) : (
                                <>
                                    <button onClick={() => setIsNavigating(false)} className="px-3 py-2 rounded-lg bg-slate-700 text-white text-xs">Stop</button>
                                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.latitude},${selectedPoint.longitude}`} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-xs flex items-center justify-center gap-1">
                                        <span className="material-symbols-outlined text-base">open_in_new</span>GMaps
                                    </a>
                                </>
                            )}
                            <button onClick={closeNav} className="px-2 py-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white">
                                <span className="material-symbols-outlined text-lg">close</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!selectedProjectId && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-surface-dark/90 z-5">
                    <span className="material-symbols-outlined text-6xl mb-3 opacity-20">explore</span>
                    <p className="text-lg font-semibold text-white">Project Maps</p>
                    <p className="text-xs">Pilih project untuk melihat titik</p>
                </div>
            )}
        </main>
    );
};

export default ProjectMaps;
