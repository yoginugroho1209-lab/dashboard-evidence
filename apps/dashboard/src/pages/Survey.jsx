import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const Survey = () => {
    const navigate = useNavigate();
    const [selectedPoint, setSelectedPoint] = useState(null);
    const [status, setStatus] = useState('pending'); // pending, uploading, done

    // Simulate Evidence Points
    const points = [
        { id: 1, name: 'Tiang TK-8821', address: 'Jl. Merdeka No. 45', status: 'pending', lat: '50%', long: '40%' },
        { id: 2, name: 'Box ODP-204', address: 'Jl. Sudirman Kav. 2', status: 'done', lat: '30%', long: '60%' },
        { id: 3, name: 'Tiang TK-8822', address: 'Gg. Melati 3', status: 'pending', lat: '60%', long: '70%' },
    ];

    const handlePointClick = (point) => {
        setSelectedPoint(point);
        setStatus(point.status);
    }

    const handleUpload = (e) => {
        setStatus('uploading');
        setTimeout(() => {
            setStatus('done');
        }, 1500);
    }

    const MapMarker = ({ point }) => (
        <div
            onClick={() => handlePointClick(point)}
            className={`absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-2 border-white shadow-lg flex items-center justify-center cursor-pointer transition-transform active:scale-95 ${point.status === 'done' ? 'bg-status-installed' : 'bg-status-planned animate-pulse'}`}
            style={{ top: point.lat, left: point.long }}
        >
            <span className="material-symbols-outlined text-white text-[16px]">
                {point.status === 'done' ? 'check' : 'priority_high'}
            </span>
        </div>
    );

    return (
        <main className="flex flex-col h-screen w-full bg-[#131416] text-white overflow-hidden relative font-display">
            {/* Map Layer (Simulated) */}
            <div className="absolute inset-0 z-0 bg-[#18191b]">
                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(#ffffff 2px, transparent 2px)", backgroundSize: "40px 40px" }}></div>
                {/* Map Elements */}
                <div className="absolute inset-0 pointer-events-none opacity-10">
                    <svg className="w-full h-full" stroke="white" strokeWidth="2">
                        <path d="M0 100 Q 200 200 400 100 T 800 300" fill="none" />
                        <path d="M100 0 Q 300 400 500 200 T 900 600" fill="none" />
                    </svg>
                </div>

                {/* Points */}
                <div className="relative w-full h-full">
                    {points.map(p => (
                        <MapMarker key={p.id} point={p === selectedPoint && status === 'done' ? { ...p, status: 'done' } : p} />
                    ))}
                </div>
            </div>

            {/* Top Bar */}
            <header className="absolute top-0 left-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center overflow-hidden">
                        <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCDg_JuA0kO-7_ZhJR1LbdNyRmixVMWLhYJLRs1AZnt5-oUf7iKoeeV6osKwi284uYouZpI3DednHTZkGFquR19PZNoXOHZHKg5CVmjK7rVXpsNX5ZqjSZfcvnkVFpqg0EVnGnUNIiesnHKjSiJDzCsKUMhQcl0fBQspOAifYGyCIdfRIcYskzVMuxn_1axAQZ5KazaiwyPGRkhTv1I8h_dLAi94Kl7C8LPVKydCfszkWeNNkXr-AItVfJR4jUqT4GgMQHS_LMRHeHv" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold shadow-black drop-shadow-md">Ahmad Teknisi</h2>
                        <p className="text-xs text-green-400 drop-shadow-md flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            Online
                        </p>
                    </div>
                </div>
                <button onClick={() => navigate('/login')} className="p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white">
                    <span className="material-symbols-outlined">logout</span>
                </button>
            </header>

            {/* Bottom Sheet / Action Card */}
            <div className={`absolute bottom-0 left-0 w-full transition-transform duration-300 ease-out z-20 ${selectedPoint ? 'translate-y-0' : 'translate-y-full'}`}>
                <div className="mx-4 mb-4 bg-[#1c1e20] rounded-2xl p-5 border border-white/10 shadow-2xl relative">
                    {/* Handle bar */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-slate-600"></div>

                    {selectedPoint && (
                        <div className="flex flex-col gap-4 mt-2">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-bold font-heading">{selectedPoint.name}</h3>
                                    <p className="text-slate-400 text-sm">{selectedPoint.address}</p>
                                </div>
                                <div onClick={() => setSelectedPoint(null)} className="p-1 rounded-full bg-white/5 hover:bg-white/10 cursor-pointer">
                                    <span className="material-symbols-outlined text-slate-400">close</span>
                                </div>
                            </div>

                            {status === 'pending' && (
                                <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 p-3 rounded-lg text-sm flex items-center gap-2">
                                    <span className="material-symbols-outlined">warning</span>
                                    Belum ada bukti foto
                                </div>
                            )}

                            {status === 'uploading' && (
                                <div className="bg-blue-500/10 border border-blue-500/20 text-blue-500 p-3 rounded-lg text-sm flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                    Mengunggah Evidence...
                                </div>
                            )}

                            {status === 'done' && (
                                <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-3 rounded-lg text-sm flex items-center gap-2">
                                    <span className="material-symbols-outlined">verified</span>
                                    Evidence Terverifikasi
                                </div>
                            )}

                            <div className="flex gap-2 mt-2">
                                <button className="flex-1 py-3 rounded-xl bg-slate-700 text-white font-medium text-sm flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined">navigation</span>
                                    Rute
                                </button>
                                <label className={`flex-[2] py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors ${status === 'done' ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-primary text-white hover:bg-primary/90'}`}>
                                    <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleUpload} disabled={status === 'done'} />
                                    <span className="material-symbols-outlined">photo_camera</span>
                                    {status === 'done' ? 'Ulangi Foto' : 'Ambil Foto'}
                                </label>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Instruction if no point selected */}
            <div className={`absolute bottom-8 left-0 w-full text-center pointer-events-none transition-opacity duration-300 ${selectedPoint ? 'opacity-0' : 'opacity-100'}`}>
                <span className="bg-black/60 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-medium border border-white/10">
                    Pilih titik merah untuk mulai survey
                </span>
            </div>
        </main>
    )
}

export default Survey
