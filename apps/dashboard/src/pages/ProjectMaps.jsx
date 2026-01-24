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
    const mapRef = useRef(null);

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

    // Get user's current location
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    setLocationError('Tidak dapat mengakses lokasi. Pastikan GPS aktif.');
                }
            );
        }
    }, []);

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
            }
        };
        fetchPoints();
    }, [selectedProjectId]);

    // Filter projects by region
    const filteredProjects = selectedRegion
        ? projects.filter(p => p.region === selectedRegion)
        : projects;

    // Open Google Maps navigation
    const handleNavigate = (point) => {
        if (!point) return;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}&travelmode=driving`;
        window.open(url, '_blank');
    };

    // Calculate distance between two points (Haversine formula)
    const calculateDistance = (lat1, lng1, lat2, lng2) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Get distance to point from user location
    const getDistanceText = (point) => {
        if (!userLocation || !point.latitude || !point.longitude) return null;
        const distance = calculateDistance(
            userLocation.lat, userLocation.lng,
            point.latitude, point.longitude
        );
        if (distance < 1) {
            return `${Math.round(distance * 1000)} m`;
        }
        return `${distance.toFixed(1)} km`;
    };

    const selectedProject = projects.find(p => p.id === selectedProjectId);

    return (
        <main className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark relative">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "24px 24px" }}></div>

            {/* Top Header */}
            <header className="h-20 flex-shrink-0 px-8 flex items-center justify-between border-b border-border-dark bg-[#131416]/80 backdrop-blur-md z-10">
                <div>
                    <h2 className="text-white text-2xl font-heading font-bold leading-tight tracking-tight">Project Maps</h2>
                    <p className="text-slate-400 text-sm">Navigasi ke titik lokasi project</p>
                </div>
                {userLocation && (
                    <div className="flex items-center gap-2 text-emerald-500 text-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        GPS Active
                    </div>
                )}
            </header>

            {/* Main Content */}
            <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">
                {/* Left Panel - Filters & Point List */}
                <div className="w-full lg:w-96 flex-shrink-0 flex flex-col gap-4">
                    {/* Filters */}
                    <div className="bg-surface-dark border border-border-dark rounded-lg p-4 space-y-4">
                        {/* Region Filter */}
                        <div>
                            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2 block">Region</label>
                            <select
                                value={selectedRegion}
                                onChange={(e) => {
                                    setSelectedRegion(e.target.value);
                                    setSelectedProjectId('');
                                }}
                                className="w-full bg-input-bg border border-border-dark text-white text-sm rounded h-10 px-3 focus:outline-none focus:border-primary"
                            >
                                <option value="">Semua Region</option>
                                {REGIONS.map(region => (
                                    <option key={region} value={region}>{region}</option>
                                ))}
                            </select>
                        </div>

                        {/* Project Filter */}
                        <div>
                            <label className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2 block">Project</label>
                            <select
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                className="w-full bg-input-bg border border-border-dark text-white text-sm rounded h-10 px-3 focus:outline-none focus:border-primary"
                            >
                                <option value="">Pilih Project...</option>
                                {filteredProjects.map(project => (
                                    <option key={project.id} value={project.id}>{project.name}</option>
                                ))}
                            </select>
                        </div>

                        {selectedProject && (
                            <div className="p-3 rounded bg-primary/10 border border-primary/20">
                                <p className="text-primary text-sm font-medium">{selectedProject.name}</p>
                                <p className="text-slate-400 text-xs">{points.length} titik tersedia</p>
                            </div>
                        )}
                    </div>

                    {/* Points List */}
                    <div className="flex-1 bg-surface-dark border border-border-dark rounded-lg overflow-hidden flex flex-col">
                        <div className="p-3 border-b border-border-dark bg-[#1c1e20]">
                            <h3 className="text-white font-medium text-sm">Daftar Titik</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {points.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 p-6">
                                    <span className="material-symbols-outlined text-[40px] mb-2 opacity-30">location_off</span>
                                    <p className="text-sm text-center">Pilih project untuk melihat titik</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border-dark">
                                    {points.map((point, idx) => {
                                        const distance = getDistanceText(point);
                                        const isSelected = selectedPoint?.id === point.id;

                                        return (
                                            <button
                                                key={point.id}
                                                onClick={() => setSelectedPoint(point)}
                                                className={`w-full text-left p-3 hover:bg-white/5 transition-colors ${isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''}`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-white text-sm font-medium truncate">
                                                            {point.point_id || point.name || `Titik ${idx + 1}`}
                                                        </p>
                                                        <p className="text-slate-500 text-xs truncate">{point.name}</p>
                                                    </div>
                                                    {distance && (
                                                        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded flex-shrink-0">
                                                            {distance}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-slate-500 text-[10px] font-mono mt-1">
                                                    {point.latitude?.toFixed(6)}, {point.longitude?.toFixed(6)}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Panel - Map Preview & Navigation */}
                <div className="flex-1 flex flex-col min-w-0 bg-surface-dark border border-border-dark rounded-lg overflow-hidden">
                    {/* Map Container */}
                    <div className="flex-1 relative bg-[#1a1c1e]">
                        {selectedPoint ? (
                            <>
                                {/* Map Embed */}
                                <iframe
                                    ref={mapRef}
                                    src={`https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1000!2d${selectedPoint.longitude}!3d${selectedPoint.latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e1!3m2!1sen!2sid!4v1`}
                                    width="100%"
                                    height="100%"
                                    style={{ border: 0 }}
                                    allowFullScreen=""
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    className="absolute inset-0"
                                ></iframe>

                                {/* Point Info Overlay */}
                                <div className="absolute top-4 left-4 right-4 bg-surface-dark/95 backdrop-blur-md border border-border-dark rounded-lg p-4 shadow-xl">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="text-white font-bold text-lg">
                                                {selectedPoint.point_id || selectedPoint.name}
                                            </h3>
                                            <p className="text-slate-400 text-sm">{selectedPoint.name}</p>
                                            <p className="text-slate-500 text-xs font-mono mt-1">
                                                {selectedPoint.latitude?.toFixed(6)}, {selectedPoint.longitude?.toFixed(6)}
                                            </p>
                                        </div>
                                        {getDistanceText(selectedPoint) && (
                                            <div className="text-right">
                                                <p className="text-2xl font-bold text-primary">{getDistanceText(selectedPoint)}</p>
                                                <p className="text-slate-500 text-xs">dari lokasi Anda</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500">
                                <span className="material-symbols-outlined text-[64px] mb-4 opacity-20">map</span>
                                <p className="text-lg font-medium">Pilih titik untuk melihat peta</p>
                                <p className="text-sm">Klik pada titik di daftar sebelah kiri</p>
                            </div>
                        )}
                    </div>

                    {/* Navigation Button */}
                    <div className="p-4 border-t border-border-dark bg-[#1c1e20]">
                        <button
                            onClick={() => handleNavigate(selectedPoint)}
                            disabled={!selectedPoint}
                            className="w-full py-3 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium flex items-center justify-center gap-2 shadow-[0_0_20px_-5px_rgba(27,152,141,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            <span className="material-symbols-outlined">directions</span>
                            Mulai Navigasi ke Titik
                        </button>
                        {selectedPoint && (
                            <p className="text-center text-slate-500 text-xs mt-2">
                                Akan membuka Google Maps untuk navigasi
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
};

export default ProjectMaps;
