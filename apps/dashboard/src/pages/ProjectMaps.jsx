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
    const [locationError, setLocationError] = useState('');
    const [isNavigating, setIsNavigating] = useState(false);
    const [heading, setHeading] = useState(0);
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const userMarkerRef = useRef(null);
    const targetMarkerRef = useRef(null);
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

        // Load Leaflet JS
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
            const L = window.L;
            const map = L.map(mapRef.current).setView([-6.2088, 106.8456], 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
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

    // Start GPS tracking
    useEffect(() => {
        if (navigator.geolocation) {
            // Watch position for real-time updates
            watchIdRef.current = navigator.geolocation.watchPosition(
                (position) => {
                    const newLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                        heading: position.coords.heading
                    };
                    setUserLocation(newLocation);

                    if (position.coords.heading !== null) {
                        setHeading(position.coords.heading);
                    }

                    // Update map if initialized
                    if (mapInstanceRef.current && window.L) {
                        const L = window.L;

                        // Update or create user marker
                        if (userMarkerRef.current) {
                            userMarkerRef.current.setLatLng([newLocation.lat, newLocation.lng]);
                        } else {
                            const userIcon = L.divIcon({
                                className: 'user-marker',
                                html: `<div style="width: 20px; height: 20px; background: #1B988D; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 10px rgba(0,0,0,0.3);"></div>`,
                                iconSize: [20, 20],
                                iconAnchor: [10, 10]
                            });
                            userMarkerRef.current = L.marker([newLocation.lat, newLocation.lng], { icon: userIcon }).addTo(mapInstanceRef.current);
                        }

                        // Update line to target if navigating
                        if (selectedPoint && isNavigating && lineRef.current) {
                            lineRef.current.setLatLngs([
                                [newLocation.lat, newLocation.lng],
                                [selectedPoint.latitude, selectedPoint.longitude]
                            ]);
                        }
                    }
                },
                (error) => {
                    setLocationError('Tidak dapat mengakses GPS. Aktifkan lokasi di perangkat Anda.');
                },
                { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
            );
        }

        return () => {
            if (watchIdRef.current) {
                navigator.geolocation.clearWatch(watchIdRef.current);
            }
        };
    }, [selectedPoint, isNavigating]);

    // Fetch points when project changes
    useEffect(() => {
        if (!selectedProjectId) {
            setPoints([]);
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
            }
        };
        fetchPoints();
    }, [selectedProjectId]);

    // Update map when point is selected
    useEffect(() => {
        if (!selectedPoint || !mapInstanceRef.current || !window.L) return;

        const L = window.L;
        const map = mapInstanceRef.current;

        // Remove old target marker
        if (targetMarkerRef.current) {
            map.removeLayer(targetMarkerRef.current);
        }
        if (lineRef.current) {
            map.removeLayer(lineRef.current);
        }

        // Add target marker
        const targetIcon = L.divIcon({
            className: 'target-marker',
            html: `<div style="width: 30px; height: 30px; background: #EF4444; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 10px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
                <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
            </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        targetMarkerRef.current = L.marker([selectedPoint.latitude, selectedPoint.longitude], { icon: targetIcon }).addTo(map);

        // Add line from user to target
        if (userLocation) {
            lineRef.current = L.polyline([
                [userLocation.lat, userLocation.lng],
                [selectedPoint.latitude, selectedPoint.longitude]
            ], { color: '#1B988D', weight: 3, dashArray: '10, 10' }).addTo(map);

            // Fit bounds to show both points
            const bounds = L.latLngBounds([
                [userLocation.lat, userLocation.lng],
                [selectedPoint.latitude, selectedPoint.longitude]
            ]);
            map.fitBounds(bounds, { padding: [50, 50] });
        } else {
            map.setView([selectedPoint.latitude, selectedPoint.longitude], 16);
        }
    }, [selectedPoint, userLocation]);

    // Filter projects by region
    const filteredProjects = selectedRegion
        ? projects.filter(p => p.region === selectedRegion)
        : projects;

    // Calculate distance between two points (Haversine formula)
    const calculateDistance = (lat1, lng1, lat2, lng2) => {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Calculate bearing between two points
    const calculateBearing = (lat1, lng1, lat2, lng2) => {
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const lat1Rad = lat1 * Math.PI / 180;
        const lat2Rad = lat2 * Math.PI / 180;

        const y = Math.sin(dLng) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        bearing = (bearing + 360) % 360;
        return bearing;
    };

    // Get distance to point
    const getDistance = (point) => {
        if (!userLocation || !point?.latitude || !point?.longitude) return null;
        return calculateDistance(userLocation.lat, userLocation.lng, point.latitude, point.longitude);
    };

    // Format distance text
    const formatDistance = (meters) => {
        if (meters === null) return '-';
        if (meters < 1000) {
            return `${Math.round(meters)} m`;
        }
        return `${(meters / 1000).toFixed(1)} km`;
    };

    // Get bearing to point
    const getBearing = (point) => {
        if (!userLocation || !point?.latitude || !point?.longitude) return null;
        return calculateBearing(userLocation.lat, userLocation.lng, point.latitude, point.longitude);
    };

    // Start navigation mode
    const startNavigation = () => {
        if (!selectedPoint) return;
        setIsNavigating(true);
    };

    // Stop navigation
    const stopNavigation = () => {
        setIsNavigating(false);
    };

    const selectedProject = projects.find(p => p.id === selectedProjectId);
    const distance = getDistance(selectedPoint);
    const bearing = getBearing(selectedPoint);
    const arrowRotation = bearing !== null ? bearing - heading : 0;

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark relative">
            {/* Top Header */}
            <header className="h-16 flex-shrink-0 px-6 flex items-center justify-between border-b border-border-dark bg-[#131416]/80 backdrop-blur-md z-10">
                <div>
                    <h2 className="text-white text-xl font-heading font-bold">Project Maps</h2>
                    <p className="text-slate-400 text-xs">Navigasi ke titik lokasi</p>
                </div>
                <div className="flex items-center gap-3">
                    {userLocation && (
                        <div className="flex items-center gap-2 text-emerald-500 text-xs bg-emerald-500/10 px-3 py-1.5 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            GPS Active
                        </div>
                    )}
                    {locationError && (
                        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 px-3 py-1.5 rounded-full">
                            <span className="material-symbols-outlined text-[14px]">gps_off</span>
                            {locationError}
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* Left Panel - Filters & Point List */}
                <div className="w-full lg:w-80 flex-shrink-0 flex flex-col border-r border-border-dark bg-surface-dark overflow-hidden">
                    {/* Filters */}
                    <div className="p-4 border-b border-border-dark space-y-3">
                        <select
                            value={selectedRegion}
                            onChange={(e) => {
                                setSelectedRegion(e.target.value);
                                setSelectedProjectId('');
                            }}
                            className="w-full bg-input-bg border border-border-dark text-white text-sm rounded h-9 px-3 focus:outline-none focus:border-primary"
                        >
                            <option value="">Semua Region</option>
                            {REGIONS.map(region => (
                                <option key={region} value={region}>{region}</option>
                            ))}
                        </select>

                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="w-full bg-input-bg border border-border-dark text-white text-sm rounded h-9 px-3 focus:outline-none focus:border-primary"
                        >
                            <option value="">Pilih Project...</option>
                            {filteredProjects.map(project => (
                                <option key={project.id} value={project.id}>{project.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Points List */}
                    <div className="flex-1 overflow-y-auto">
                        {points.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6">
                                <span className="material-symbols-outlined text-[40px] mb-2 opacity-30">location_off</span>
                                <p className="text-sm text-center">Pilih project</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border-dark">
                                {points.map((point, idx) => {
                                    const pointDistance = getDistance(point);
                                    const isSelected = selectedPoint?.id === point.id;

                                    return (
                                        <button
                                            key={point.id}
                                            onClick={() => {
                                                setSelectedPoint(point);
                                                setIsNavigating(false);
                                            }}
                                            className={`w-full text-left p-3 hover:bg-white/5 transition-colors ${isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-white text-sm font-medium truncate flex-1">
                                                    {point.point_id || point.name || `Titik ${idx + 1}`}
                                                </p>
                                                {pointDistance !== null && (
                                                    <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded">
                                                        {formatDistance(pointDistance)}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Panel - Map & Navigation */}
                <div className="flex-1 flex flex-col min-w-0 relative">
                    {/* Map Container */}
                    <div ref={mapRef} className="flex-1 bg-[#1a1c1e]" style={{ minHeight: '300px' }}></div>

                    {/* Navigation Overlay */}
                    {selectedPoint && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-surface-dark via-surface-dark/95 to-transparent p-4 pt-16">
                            {/* Point Info & Distance */}
                            <div className="flex items-center gap-4 mb-4">
                                {/* Compass Arrow */}
                                {isNavigating && bearing !== null && (
                                    <div className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center flex-shrink-0">
                                        <span
                                            className="material-symbols-outlined text-[32px] text-primary transition-transform duration-300"
                                            style={{ transform: `rotate(${arrowRotation}deg)` }}
                                        >
                                            navigation
                                        </span>
                                    </div>
                                )}

                                <div className="flex-1 min-w-0">
                                    <h3 className="text-white font-bold text-lg truncate">
                                        {selectedPoint.point_id || selectedPoint.name}
                                    </h3>
                                    <p className="text-slate-400 text-sm truncate">{selectedPoint.name}</p>
                                </div>

                                <div className="text-right">
                                    <p className="text-3xl font-bold text-primary">{formatDistance(distance)}</p>
                                    <p className="text-slate-500 text-xs">dari lokasi Anda</p>
                                </div>
                            </div>

                            {/* Progress Bar (visual) */}
                            {isNavigating && distance !== null && distance < 1000 && (
                                <div className="mb-4">
                                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500"
                                            style={{ width: `${Math.max(0, 100 - (distance / 10))}%` }}
                                        ></div>
                                    </div>
                                    {distance < 20 && (
                                        <p className="text-center text-emerald-400 text-sm font-medium mt-2 animate-pulse">
                                            🎉 Anda sudah sampai!
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3">
                                {!isNavigating ? (
                                    <button
                                        onClick={startNavigation}
                                        className="flex-1 py-3 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium flex items-center justify-center gap-2 shadow-[0_0_20px_-5px_rgba(27,152,141,0.5)] transition-all"
                                    >
                                        <span className="material-symbols-outlined">navigation</span>
                                        Mulai Navigasi
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={stopNavigation}
                                            className="px-6 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium flex items-center justify-center gap-2 transition-all"
                                        >
                                            <span className="material-symbols-outlined">close</span>
                                            Stop
                                        </button>
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPoint.latitude},${selectedPoint.longitude}&travelmode=driving`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium flex items-center justify-center gap-2 transition-all"
                                        >
                                            <span className="material-symbols-outlined">open_in_new</span>
                                            Buka Google Maps
                                        </a>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Empty State */}
                    {!selectedPoint && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 bg-surface-dark/50">
                            <span className="material-symbols-outlined text-[64px] mb-4 opacity-20">map</span>
                            <p className="text-lg font-medium">Pilih titik untuk navigasi</p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};

export default ProjectMaps;
