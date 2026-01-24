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
    const [selectedRegion, setSelectedRegion] = useState('');
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userLocation, setUserLocation] = useState(null);
    const [userHeading, setUserHeading] = useState(0);
    const [locationError, setLocationError] = useState('');
    const [isNavigating, setIsNavigating] = useState(false);
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const userMarkerRef = useRef(null);
    const pointMarkersRef = useRef([]);
    const lineRef = useRef(null);
    const watchIdRef = useRef(null);

    // Fetch projects on mount
    useEffect(() => {
        const fetchProjects = async () => {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (data) {
                setProjects(data);
            }
            setLoading(false);
        };
        fetchProjects();
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapRef.current || mapInstanceRef.current) return;

        // Load Leaflet CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        // Load Leaflet Rotate CSS & JS for rotation support
        const rotateCSS = document.createElement('link');
        rotateCSS.rel = 'stylesheet';
        rotateCSS.href = 'https://unpkg.com/leaflet-rotate@0.2.8/dist/leaflet-rotate.css';
        document.head.appendChild(rotateCSS);

        // Load Leaflet JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
            const L = window.L;
            const map = L.map(mapRef.current, {
                rotate: true,
                rotateControl: {
                    closeOnZeroBearing: false
                },
                touchRotate: true,
                zoomControl: true
            }).setView([-6.2088, 106.8456], 18); // Deeper zoom level

            // Use satellite/hybrid tiles for better detail
            L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: 'Esri',
                maxZoom: 22
            }).addTo(map);

            // Add labels layer on top
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
                maxZoom: 22
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

    // Start GPS tracking with heading
    useEffect(() => {
        if (navigator.geolocation) {
            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    const newLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    };
                    setUserLocation(newLocation);

                    if (position.coords.heading !== null && !isNaN(position.coords.heading)) {
                        setUserHeading(position.coords.heading);
                    }

                    updateUserMarker(newLocation, position.coords.heading || userHeading);
                },
                (error) => {
                    setLocationError('GPS tidak aktif');
                },
                { enableHighAccuracy: true, maximumAge: 500, timeout: 10000 }
            );

            // Also try to get compass heading from device orientation
            if (window.DeviceOrientationEvent) {
                window.addEventListener('deviceorientationabsolute', handleOrientation, true);
                window.addEventListener('deviceorientation', handleOrientation, true);
            }
        }

        return () => {
            if (watchIdRef.current) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
            window.removeEventListener('deviceorientationabsolute', handleOrientation);
            window.removeEventListener('deviceorientation', handleOrientation);
        };
    }, []);

    const handleOrientation = (event) => {
        let heading = event.alpha;
        if (event.webkitCompassHeading) {
            heading = event.webkitCompassHeading;
        } else if (heading !== null) {
            heading = 360 - heading;
        }
        if (heading !== null && !isNaN(heading)) {
            setUserHeading(heading);
            if (userLocation) {
                updateUserMarker(userLocation, heading);
            }
        }
    };

    const updateUserMarker = (location, heading) => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L;

        // Create arrow icon showing direction user is facing
        const userIcon = L.divIcon({
            className: 'user-direction-marker',
            html: `
                <div style="
                    width: 40px; 
                    height: 40px; 
                    position: relative;
                    transform: rotate(${heading || 0}deg);
                    transition: transform 0.3s ease;
                ">
                    <div style="
                        position: absolute;
                        top: 0;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 0;
                        height: 0;
                        border-left: 12px solid transparent;
                        border-right: 12px solid transparent;
                        border-bottom: 20px solid #1B988D;
                        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
                    "></div>
                    <div style="
                        position: absolute;
                        bottom: 0;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 20px;
                        height: 20px;
                        background: #1B988D;
                        border: 3px solid white;
                        border-radius: 50%;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                    "></div>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([location.lat, location.lng]);
            userMarkerRef.current.setIcon(userIcon);
        } else {
            userMarkerRef.current = L.marker([location.lat, location.lng], {
                icon: userIcon,
                zIndexOffset: 1000
            }).addTo(mapInstanceRef.current);
        }

        // Update line to target if navigating
        if (selectedPoint && isNavigating && lineRef.current) {
            lineRef.current.setLatLngs([
                [location.lat, location.lng],
                [selectedPoint.latitude, selectedPoint.longitude]
            ]);
        }
    };

    // Fetch points when project changes
    useEffect(() => {
        if (!selectedProjectId) {
            setPoints([]);
            clearPointMarkers();
            return;
        }

        const fetchPoints = async () => {
            const { data, error } = await supabase
                .from('points')
                .select('*')
                .eq('project_id', selectedProjectId)
                .order('point_id', { ascending: true });

            if (data) {
                setPoints(data);
                setSelectedPoint(null);
                setIsNavigating(false);

                // Add all points to map
                setTimeout(() => addPointsToMap(data), 100);
            }
        };
        fetchPoints();
    }, [selectedProjectId]);

    const clearPointMarkers = () => {
        if (mapInstanceRef.current) {
            pointMarkersRef.current.forEach(marker => {
                mapInstanceRef.current.removeLayer(marker);
            });
        }
        pointMarkersRef.current = [];
        if (lineRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(lineRef.current);
            lineRef.current = null;
        }
    };

    const addPointsToMap = (pointsData) => {
        if (!mapInstanceRef.current || !window.L || !pointsData.length) return;

        const L = window.L;
        const map = mapInstanceRef.current;

        // Clear existing markers
        clearPointMarkers();

        const bounds = L.latLngBounds();

        pointsData.forEach((point, idx) => {
            if (!point.latitude || !point.longitude) return;

            const pointName = point.point_id || point.name || `Titik ${idx + 1}`;

            // Create custom icon with label
            const pointIcon = L.divIcon({
                className: 'point-marker',
                html: `
                    <div style="position: relative; cursor: pointer;">
                        <div style="
                            width: 24px;
                            height: 24px;
                            background: #EF4444;
                            border: 3px solid white;
                            border-radius: 50%;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                        "></div>
                        <div style="
                            position: absolute;
                            top: 28px;
                            left: 50%;
                            transform: translateX(-50%);
                            background: rgba(0,0,0,0.8);
                            color: white;
                            padding: 2px 6px;
                            border-radius: 4px;
                            font-size: 10px;
                            font-weight: bold;
                            white-space: nowrap;
                            max-width: 120px;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        ">${pointName}</div>
                    </div>
                `,
                iconSize: [24, 50],
                iconAnchor: [12, 12]
            });

            const marker = L.marker([point.latitude, point.longitude], { icon: pointIcon })
                .addTo(map)
                .on('click', () => {
                    selectPoint(point);
                });

            pointMarkersRef.current.push(marker);
            bounds.extend([point.latitude, point.longitude]);
        });

        // Add user location to bounds if available
        if (userLocation) {
            bounds.extend([userLocation.lat, userLocation.lng]);
        }

        // Fit map to show all points
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
        }
    };

    const selectPoint = (point) => {
        setSelectedPoint(point);
        setIsNavigating(false);

        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L;
        const map = mapInstanceRef.current;

        // Remove old line
        if (lineRef.current) {
            map.removeLayer(lineRef.current);
        }

        // Draw line from user to selected point
        if (userLocation) {
            lineRef.current = L.polyline([
                [userLocation.lat, userLocation.lng],
                [point.latitude, point.longitude]
            ], {
                color: '#1B988D',
                weight: 4,
                dashArray: '10, 10',
                opacity: 0.8
            }).addTo(map);

            // Center map on the route
            const bounds = L.latLngBounds([
                [userLocation.lat, userLocation.lng],
                [point.latitude, point.longitude]
            ]);
            map.fitBounds(bounds, { padding: [80, 80], maxZoom: 19 });
        } else {
            map.setView([point.latitude, point.longitude], 19);
        }

        // Update point marker to show selected state
        updatePointMarkers(point);
    };

    const updatePointMarkers = (selectedPt) => {
        if (!mapInstanceRef.current || !window.L) return;
        const L = window.L;

        // Recreate markers with updated styles
        clearPointMarkers();

        points.forEach((point, idx) => {
            if (!point.latitude || !point.longitude) return;

            const pointName = point.point_id || point.name || `Titik ${idx + 1}`;
            const isSelected = selectedPt?.id === point.id;

            const pointIcon = L.divIcon({
                className: 'point-marker',
                html: `
                    <div style="position: relative; cursor: pointer;">
                        <div style="
                            width: ${isSelected ? '32px' : '24px'};
                            height: ${isSelected ? '32px' : '24px'};
                            background: ${isSelected ? '#1B988D' : '#EF4444'};
                            border: ${isSelected ? '4px' : '3px'} solid white;
                            border-radius: 50%;
                            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                            ${isSelected ? 'animation: pulse 1.5s infinite;' : ''}
                        "></div>
                        <div style="
                            position: absolute;
                            top: ${isSelected ? '36px' : '28px'};
                            left: 50%;
                            transform: translateX(-50%);
                            background: ${isSelected ? '#1B988D' : 'rgba(0,0,0,0.8)'};
                            color: white;
                            padding: ${isSelected ? '4px 8px' : '2px 6px'};
                            border-radius: 4px;
                            font-size: ${isSelected ? '11px' : '10px'};
                            font-weight: bold;
                            white-space: nowrap;
                            max-width: 150px;
                            overflow: hidden;
                            text-overflow: ellipsis;
                        ">${pointName}</div>
                    </div>
                `,
                iconSize: [isSelected ? 32 : 24, 60],
                iconAnchor: [isSelected ? 16 : 12, isSelected ? 16 : 12]
            });

            const marker = L.marker([point.latitude, point.longitude], {
                icon: pointIcon,
                zIndexOffset: isSelected ? 500 : 0
            })
                .addTo(mapInstanceRef.current)
                .on('click', () => selectPoint(point));

            pointMarkersRef.current.push(marker);
        });
    };

    // Filter projects by region
    const filteredProjects = selectedRegion
        ? projects.filter(p => p.region === selectedRegion)
        : projects;

    // Calculate distance
    const calculateDistance = (lat1, lng1, lat2, lng2) => {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Calculate bearing
    const calculateBearing = (lat1, lng1, lat2, lng2) => {
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;
        const y = Math.sin(dLng) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        return (bearing + 360) % 360;
    };

    const getDistance = (point) => {
        if (!userLocation || !point?.latitude) return null;
        return calculateDistance(userLocation.lat, userLocation.lng, point.latitude, point.longitude);
    };

    const formatDistance = (meters) => {
        if (meters === null) return '-';
        if (meters < 1000) return `${Math.round(meters)} m`;
        return `${(meters / 1000).toFixed(1)} km`;
    };

    const getBearing = (point) => {
        if (!userLocation || !point?.latitude) return null;
        return calculateBearing(userLocation.lat, userLocation.lng, point.latitude, point.longitude);
    };

    const startNavigation = () => {
        if (!selectedPoint) return;
        setIsNavigating(true);
    };

    const stopNavigation = () => {
        setIsNavigating(false);
    };

    const distance = getDistance(selectedPoint);
    const bearing = getBearing(selectedPoint);
    const arrowRotation = bearing !== null ? bearing - userHeading : 0;

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark relative">
            {/* Add pulse animation */}
            <style>{`
                @keyframes pulse {
                    0%, 100% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.8; }
                }
            `}</style>

            {/* Top Header */}
            <header className="h-14 flex-shrink-0 px-4 flex items-center justify-between border-b border-border-dark bg-[#131416]/90 backdrop-blur-md z-20">
                <div className="flex items-center gap-3">
                    {/* Filters inline */}
                    <select
                        value={selectedRegion}
                        onChange={(e) => {
                            setSelectedRegion(e.target.value);
                            setSelectedProjectId('');
                        }}
                        className="bg-input-bg border border-border-dark text-white text-xs rounded h-8 px-2 focus:outline-none focus:border-primary"
                    >
                        <option value="">Region</option>
                        {REGIONS.map(region => (
                            <option key={region} value={region}>{region.split(' ')[0]} {region.split(' ')[1]}</option>
                        ))}
                    </select>

                    <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="bg-input-bg border border-border-dark text-white text-xs rounded h-8 px-2 focus:outline-none focus:border-primary max-w-[200px]"
                    >
                        <option value="">Pilih Project</option>
                        {filteredProjects.map(project => (
                            <option key={project.id} value={project.id}>{project.name}</option>
                        ))}
                    </select>

                    {points.length > 0 && (
                        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                            {points.length} titik
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {userLocation ? (
                        <div className="flex items-center gap-1.5 text-emerald-500 text-xs bg-emerald-500/10 px-2 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            GPS
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-red-400 text-xs bg-red-500/10 px-2 py-1 rounded-full">
                            <span className="material-symbols-outlined text-[12px]">gps_off</span>
                            GPS Off
                        </div>
                    )}
                </div>
            </header>

            {/* Map Container - Full Width */}
            <div className="flex-1 relative">
                <div ref={mapRef} className="absolute inset-0 bg-[#1a1c1e]"></div>

                {/* Navigation Panel - Floating at bottom */}
                {selectedPoint && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#131416] via-[#131416]/95 to-transparent p-4 pt-12 z-10">
                        <div className="max-w-lg mx-auto">
                            {/* Point Info & Distance */}
                            <div className="flex items-center gap-4 mb-3 bg-surface-dark/80 backdrop-blur-md rounded-xl p-3 border border-border-dark">
                                {/* Compass Arrow */}
                                {isNavigating && bearing !== null && (
                                    <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center flex-shrink-0">
                                        <span
                                            className="material-symbols-outlined text-[28px] text-primary transition-transform duration-200"
                                            style={{ transform: `rotate(${arrowRotation}deg)` }}
                                        >
                                            navigation
                                        </span>
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-bold truncate">
                                        {selectedPoint.point_id || selectedPoint.name}
                                    </h3>
                                    <p className="text-slate-400 text-xs truncate">{selectedPoint.name}</p>
                                </div>

                                <div className="text-right">
                                    <p className="text-2xl font-bold text-primary">{formatDistance(distance)}</p>
                                    {distance !== null && distance < 20 && (
                                        <p className="text-emerald-400 text-xs font-medium animate-pulse">🎉 Sampai!</p>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                {!isNavigating ? (
                                    <button
                                        onClick={startNavigation}
                                        className="flex-1 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium flex items-center justify-center gap-2 shadow-lg transition-all text-sm"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">navigation</span>
                                        Navigasi
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={stopNavigation}
                                            className="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm"
                                        >
                                            Stop
                                        </button>
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.latitude},${selectedPoint.longitude}&travelmode=driving`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center gap-2 text-sm"
                                        >
                                            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                                            Google Maps
                                        </a>
                                    </>
                                )}
                                <button
                                    onClick={() => {
                                        setSelectedPoint(null);
                                        if (lineRef.current && mapInstanceRef.current) {
                                            mapInstanceRef.current.removeLayer(lineRef.current);
                                            lineRef.current = null;
                                        }
                                        updatePointMarkers(null);
                                    }}
                                    className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm"
                                >
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!selectedProjectId && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-surface-dark/80 z-10">
                        <span className="material-symbols-outlined text-[64px] mb-4 opacity-20">map</span>
                        <p className="text-lg font-medium">Pilih Project untuk melihat titik</p>
                        <p className="text-sm">Klik titik di peta untuk navigasi</p>
                    </div>
                )}
            </div>
        </main>
    );
};

export default ProjectMaps;
