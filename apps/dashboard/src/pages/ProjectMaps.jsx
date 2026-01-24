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
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState(null);
    const [userHeading, setUserHeading] = useState(0);
    const [locationError, setLocationError] = useState('');
    const [isNavigating, setIsNavigating] = useState(false);
    const [distance, setDistance] = useState(null);
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const userMarkerRef = useRef(null);
    const pointMarkersRef = useRef({});
    const lineRef = useRef(null);
    const distanceLabelRef = useRef(null);
    const selectedPointRef = useRef(null);

    // Fetch projects on mount
    useEffect(() => {
        const fetchProjects = async () => {
            const { data } = await supabase
                .from('projects')
                .select('*')
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (data) setProjects(data);
            setLoading(false);
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
                zoomControl: true,
                touchZoom: true,
                scrollWheelZoom: true,
                doubleClickZoom: true,
                boxZoom: true,
                keyboard: true,
                dragging: true
            }).setView([-6.2088, 106.8456], 17);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19
            }).addTo(map);

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
                const loc = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                setUserLocation(loc);

                if (position.coords.heading && !isNaN(position.coords.heading)) {
                    setUserHeading(position.coords.heading);
                }

                updateUserMarker(loc, position.coords.heading || userHeading);
                updateDistanceToTarget(loc);
            },
            () => setLocationError('GPS tidak aktif'),
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
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
            className: 'user-marker-icon',
            html: `
                <div style="width: 56px; height: 56px; position: relative;">
                    <div style="
                        position: absolute;
                        top: 0;
                        left: 50%;
                        transform: translateX(-50%) rotate(${heading || 0}deg);
                        transform-origin: center 28px;
                        transition: transform 0.3s ease;
                    ">
                        <div style="
                            width: 0;
                            height: 0;
                            border-left: 12px solid transparent;
                            border-right: 12px solid transparent;
                            border-bottom: 22px solid #1B988D;
                        "></div>
                    </div>
                    <div style="
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 32px;
                        height: 32px;
                        background: #1B988D;
                        border: 4px solid white;
                        border-radius: 50%;
                        box-shadow: 0 3px 12px rgba(0,0,0,0.5);
                    "></div>
                    <div style="
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 50px;
                        height: 50px;
                        border: 3px solid rgba(27,152,141,0.4);
                        border-radius: 50%;
                    "></div>
                </div>
            `,
            iconSize: [56, 56],
            iconAnchor: [28, 28]
        });

        if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([loc.lat, loc.lng]);
            userMarkerRef.current.setIcon(icon);
        } else {
            userMarkerRef.current = L.marker([loc.lat, loc.lng], {
                icon,
                zIndexOffset: 2000
            }).addTo(mapInstanceRef.current);
        }

        if (selectedPointRef.current && lineRef.current) {
            lineRef.current.setLatLngs([
                [loc.lat, loc.lng],
                [selectedPointRef.current.latitude, selectedPointRef.current.longitude]
            ]);
            // Update distance label position
            updateDistanceLabel(loc, selectedPointRef.current);
        }
    };

    const updateDistanceToTarget = (loc) => {
        if (!selectedPointRef.current) return;
        const d = calculateDistance(loc.lat, loc.lng, selectedPointRef.current.latitude, selectedPointRef.current.longitude);
        setDistance(d);
    };

    const updateDistanceLabel = (loc, target) => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L;

        // Calculate midpoint
        const midLat = (loc.lat + target.latitude) / 2;
        const midLng = (loc.lng + target.longitude) / 2;
        const d = calculateDistance(loc.lat, loc.lng, target.latitude, target.longitude);
        const distText = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;

        if (distanceLabelRef.current) {
            distanceLabelRef.current.setLatLng([midLat, midLng]);
            distanceLabelRef.current.setIcon(L.divIcon({
                className: 'distance-label',
                html: `<div style="
                    background: #1B988D;
                    color: white;
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: bold;
                    white-space: nowrap;
                    box-shadow: 0 3px 10px rgba(0,0,0,0.4);
                    border: 2px solid white;
                ">${distText}</div>`,
                iconSize: [80, 30],
                iconAnchor: [40, 15]
            }));
        }
    };

    // Fetch points with evidence status
    useEffect(() => {
        if (!selectedProjectId) {
            setPoints([]);
            setPointsWithEvidence(new Set());
            clearAllMarkers();
            return;
        }

        const fetchPoints = async () => {
            // Fetch points
            const { data: pointsData } = await supabase
                .from('points')
                .select('*')
                .eq('project_id', selectedProjectId)
                .order('point_id', { ascending: true });

            // Fetch evidence to know which points have photos
            const { data: evidenceData } = await supabase
                .from('evidence')
                .select('point_id')
                .eq('project_id', selectedProjectId);

            if (pointsData) {
                setPoints(pointsData);

                // Create set of point IDs that have evidence
                const evidencePointIds = new Set();
                if (evidenceData) {
                    evidenceData.forEach(e => {
                        if (e.point_id) evidencePointIds.add(e.point_id);
                    });
                }
                setPointsWithEvidence(evidencePointIds);

                setSelectedPoint(null);
                selectedPointRef.current = null;
                setIsNavigating(false);
                setDistance(null);
                setTimeout(() => addPointsToMap(pointsData, evidencePointIds), 200);
            }
        };
        fetchPoints();
    }, [selectedProjectId]);

    const clearAllMarkers = () => {
        Object.values(pointMarkersRef.current).forEach(m => {
            if (mapInstanceRef.current) mapInstanceRef.current.removeLayer(m);
        });
        pointMarkersRef.current = {};
        if (lineRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(lineRef.current);
            lineRef.current = null;
        }
        if (distanceLabelRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(distanceLabelRef.current);
            distanceLabelRef.current = null;
        }
    };

    const addPointsToMap = (pointsData, evidenceSet) => {
        if (!mapInstanceRef.current || !window.L || !pointsData.length) return;
        const L = window.L;
        const map = mapInstanceRef.current;

        clearAllMarkers();
        const bounds = L.latLngBounds();

        pointsData.forEach((point, idx) => {
            if (!point.latitude || !point.longitude) return;

            const name = point.point_id || point.name || `Titik ${idx + 1}`;
            const hasEvidence = evidenceSet.has(point.id);
            const marker = createPointMarker(L, point, name, false, hasEvidence);
            marker.addTo(map);
            marker.on('click', () => handlePointClick(point));

            pointMarkersRef.current[point.id] = marker;
            bounds.extend([point.latitude, point.longitude]);
        });

        if (userLocation) bounds.extend([userLocation.lat, userLocation.lng]);
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    };

    // Colors: RED = has evidence, YELLOW = no evidence
    const createPointMarker = (L, point, name, isSelected, hasEvidence) => {
        // RED for evidence, YELLOW for no evidence
        const color = hasEvidence ? '#EF4444' : '#FBBF24';
        const selectedColor = '#1B988D';
        const bgColor = isSelected ? selectedColor : color;

        const icon = L.divIcon({
            className: 'point-marker-icon',
            html: `
                <div style="position: relative; cursor: pointer;">
                    <div style="
                        width: ${isSelected ? '40px' : '30px'};
                        height: ${isSelected ? '40px' : '30px'};
                        background: ${bgColor};
                        border: ${isSelected ? '4px' : '3px'} solid white;
                        border-radius: 50%;
                        box-shadow: 0 3px 12px rgba(0,0,0,0.5);
                        ${isSelected ? 'animation: pointPulse 1.5s infinite;' : ''}
                    "></div>
                    <div style="
                        position: absolute;
                        top: ${isSelected ? '46px' : '36px'};
                        left: 50%;
                        transform: translateX(-50%);
                        background: ${isSelected ? selectedColor : 'rgba(0,0,0,0.9)'};
                        color: white;
                        padding: ${isSelected ? '6px 12px' : '4px 8px'};
                        border-radius: 8px;
                        font-size: ${isSelected ? '13px' : '11px'};
                        font-weight: 600;
                        white-space: nowrap;
                        max-width: 160px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                    ">${name}</div>
                    ${!isSelected ? `<div style="
                        position: absolute;
                        top: 4px;
                        right: -4px;
                        width: 12px;
                        height: 12px;
                        background: ${hasEvidence ? '#22C55E' : '#94A3B8'};
                        border: 2px solid white;
                        border-radius: 50%;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                    "></div>` : ''}
                </div>
            `,
            iconSize: [isSelected ? 40 : 30, 80],
            iconAnchor: [isSelected ? 20 : 15, isSelected ? 20 : 15]
        });

        return L.marker([point.latitude, point.longitude], {
            icon,
            zIndexOffset: isSelected ? 1000 : 0
        });
    };

    const handlePointClick = (point) => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L;
        const map = mapInstanceRef.current;

        // Reset previous marker
        if (selectedPointRef.current && pointMarkersRef.current[selectedPointRef.current.id]) {
            const prevName = selectedPointRef.current.point_id || selectedPointRef.current.name || 'Titik';
            const prevHasEvidence = pointsWithEvidence.has(selectedPointRef.current.id);
            const prevMarker = createPointMarker(L, selectedPointRef.current, prevName, false, prevHasEvidence);
            map.removeLayer(pointMarkersRef.current[selectedPointRef.current.id]);
            prevMarker.addTo(map);
            prevMarker.on('click', () => handlePointClick(selectedPointRef.current));
            pointMarkersRef.current[selectedPointRef.current.id] = prevMarker;
        }

        // Highlight selected marker
        const name = point.point_id || point.name || 'Titik';
        const hasEvidence = pointsWithEvidence.has(point.id);
        const newMarker = createPointMarker(L, point, name, true, hasEvidence);
        map.removeLayer(pointMarkersRef.current[point.id]);
        newMarker.addTo(map);
        newMarker.on('click', () => handlePointClick(point));
        pointMarkersRef.current[point.id] = newMarker;

        setSelectedPoint(point);
        selectedPointRef.current = point;

        // Remove old line and label
        if (lineRef.current) map.removeLayer(lineRef.current);
        if (distanceLabelRef.current) map.removeLayer(distanceLabelRef.current);

        if (userLocation) {
            const d = calculateDistance(userLocation.lat, userLocation.lng, point.latitude, point.longitude);
            setDistance(d);
            const distText = d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;

            // Draw line
            lineRef.current = L.polyline([
                [userLocation.lat, userLocation.lng],
                [point.latitude, point.longitude]
            ], {
                color: '#1B988D',
                weight: 5,
                dashArray: '15, 10',
                opacity: 0.9
            }).addTo(map);

            // Distance label at midpoint
            const midLat = (userLocation.lat + point.latitude) / 2;
            const midLng = (userLocation.lng + point.longitude) / 2;
            distanceLabelRef.current = L.marker([midLat, midLng], {
                icon: L.divIcon({
                    className: 'distance-label',
                    html: `<div style="
                        background: #1B988D;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 24px;
                        font-size: 16px;
                        font-weight: bold;
                        white-space: nowrap;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                        border: 3px solid white;
                    ">${distText}</div>`,
                    iconSize: [100, 40],
                    iconAnchor: [50, 20]
                }),
                zIndexOffset: 1500
            }).addTo(map);

            // Fit view - zoom in more
            const bounds = L.latLngBounds([
                [userLocation.lat, userLocation.lng],
                [point.latitude, point.longitude]
            ]);
            map.fitBounds(bounds, { padding: [100, 100], maxZoom: 19 });
        } else {
            map.setView([point.latitude, point.longitude], 19);
        }
    };

    const filteredProjects = selectedRegion
        ? projects.filter(p => p.region === selectedRegion)
        : projects;

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
        const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    };

    const formatDistance = (m) => {
        if (m === null) return '-';
        return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
    };

    const bearing = selectedPoint && userLocation
        ? calculateBearing(userLocation.lat, userLocation.lng, selectedPoint.latitude, selectedPoint.longitude)
        : null;
    const arrowRotation = bearing !== null ? bearing - userHeading : 0;

    const closeNavigation = () => {
        setSelectedPoint(null);
        selectedPointRef.current = null;
        setDistance(null);
        setIsNavigating(false);
        if (lineRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(lineRef.current);
            lineRef.current = null;
        }
        if (distanceLabelRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(distanceLabelRef.current);
            distanceLabelRef.current = null;
        }
        // Reset all markers
        if (window.L && mapInstanceRef.current) {
            Object.keys(pointMarkersRef.current).forEach(id => {
                const pt = points.find(p => p.id === id);
                if (pt) {
                    const name = pt.point_id || pt.name || 'Titik';
                    const hasEvidence = pointsWithEvidence.has(pt.id);
                    const marker = createPointMarker(window.L, pt, name, false, hasEvidence);
                    mapInstanceRef.current.removeLayer(pointMarkersRef.current[id]);
                    marker.addTo(mapInstanceRef.current);
                    marker.on('click', () => handlePointClick(pt));
                    pointMarkersRef.current[id] = marker;
                }
            });
        }
    };

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark relative">
            <style>{`
                @keyframes pointPulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.15); }
                }
            `}</style>

            {/* Header */}
            <header className="h-14 flex-shrink-0 px-4 flex items-center justify-between border-b border-border-dark bg-[#131416]/95 backdrop-blur-md z-20">
                <div className="flex items-center gap-2">
                    <select
                        value={selectedRegion}
                        onChange={(e) => { setSelectedRegion(e.target.value); setSelectedProjectId(''); }}
                        className="bg-input-bg border border-border-dark text-white text-xs rounded h-8 px-2 focus:outline-none focus:border-primary"
                    >
                        <option value="">Region</option>
                        {REGIONS.map(r => <option key={r} value={r}>{r.replace('TREG ', 'T')}</option>)}
                    </select>

                    <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="bg-input-bg border border-border-dark text-white text-xs rounded h-8 px-2 focus:outline-none focus:border-primary max-w-[180px]"
                    >
                        <option value="">Project</option>
                        {filteredProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>

                    {points.length > 0 && (
                        <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-primary bg-primary/10 px-2 py-1 rounded-full font-medium">
                                {points.length} titik
                            </span>
                            <span className="flex items-center gap-1 text-slate-400">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                                Ada foto
                            </span>
                            <span className="flex items-center gap-1 text-slate-400">
                                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                                Belum
                            </span>
                        </div>
                    )}
                </div>

                {userLocation ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 text-xs bg-emerald-500/10 px-2.5 py-1 rounded-full">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        GPS
                    </div>
                ) : (
                    <div className="text-red-400 text-xs bg-red-500/10 px-2.5 py-1 rounded-full">GPS Off</div>
                )}
            </header>

            {/* Map */}
            <div className="flex-1 relative">
                <div ref={mapRef} className="absolute inset-0 bg-slate-900"></div>

                {/* Navigation Panel */}
                {selectedPoint && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0d0e10] via-[#0d0e10]/98 to-transparent p-4 pt-16 z-10">
                        <div className="max-w-md mx-auto bg-surface-dark/90 backdrop-blur-lg rounded-2xl p-4 border border-border-dark shadow-2xl">
                            <div className="flex items-center gap-4 mb-4">
                                {isNavigating && bearing !== null && (
                                    <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center flex-shrink-0">
                                        <span
                                            className="material-symbols-outlined text-[32px] text-primary"
                                            style={{ transform: `rotate(${arrowRotation}deg)`, transition: 'transform 0.2s' }}
                                        >
                                            navigation
                                        </span>
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-bold text-lg truncate">
                                        {selectedPoint.point_id || selectedPoint.name}
                                    </h3>
                                    {selectedPoint.name && selectedPoint.point_id && (
                                        <p className="text-slate-400 text-sm truncate">{selectedPoint.name}</p>
                                    )}
                                    <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${pointsWithEvidence.has(selectedPoint.id)
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                        {pointsWithEvidence.has(selectedPoint.id) ? '✓ Ada Evidence' : '○ Belum ada Evidence'}
                                    </span>
                                </div>

                                <div className="text-right flex-shrink-0">
                                    <p className="text-3xl font-bold text-primary">{formatDistance(distance)}</p>
                                    {distance !== null && distance < 15 && (
                                        <p className="text-emerald-400 text-xs font-bold animate-pulse">🎉 Sampai!</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                {!isNavigating ? (
                                    <button
                                        onClick={() => setIsNavigating(true)}
                                        className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold flex items-center justify-center gap-2 shadow-lg text-sm"
                                    >
                                        <span className="material-symbols-outlined">navigation</span>
                                        Mulai Navigasi
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setIsNavigating(false)}
                                            className="px-5 py-3 rounded-xl bg-slate-700 text-white font-medium text-sm"
                                        >
                                            Stop
                                        </button>
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.latitude},${selectedPoint.longitude}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-medium flex items-center justify-center gap-2 text-sm"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                            GMaps
                                        </a>
                                    </>
                                )}
                                <button
                                    onClick={closeNavigation}
                                    className="px-4 py-3 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!selectedProjectId && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-surface-dark/90 z-10">
                        <span className="material-symbols-outlined text-[72px] mb-4 opacity-20">explore</span>
                        <p className="text-xl font-semibold text-white mb-2">Project Maps</p>
                        <p className="text-sm">Pilih project untuk melihat titik lokasi</p>
                    </div>
                )}
            </div>
        </main>
    );
};

export default ProjectMaps;
