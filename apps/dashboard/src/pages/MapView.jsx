import React from 'react'

const MapView = () => {
    return (
        <main className="flex-1 relative h-full w-full bg-[#131416] isolate overflow-hidden group/map">
            {/* Background Map Image (Simulated Leaflet) */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center pointer-events-none opacity-60"
                data-alt="Dark mode map of Jakarta city streets"
                data-location="Jakarta"
                style={{
                    backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAt8UQOdZJSFtlwYZIGmdIsaKzq_JV3rKBtRUhWcrPMGBp-2VUvhLCViZrPBtqlmKBC_BJvVWatvuOs97pWjnp_8Jjo-Ti7htNVDxSLk94CY0bbd1D6Y0TPn2g4HjAsirZC6LAuYHT6VtYfbnuT51KKl9iIJfPyw9qdck2dCfxcwdUb7NKugUIfUhZvWKp1clgc23ataJXpr5iPNKNCc7Fu9BWHouG8lfV311XBxSyysIDJf90fu3w8bn5ab84Ugj9nUiHpYl0sNbdT')",
                    filter: "grayscale(100%) invert(85%) hue-rotate(180deg) contrast(110%) brightness(70%)"
                }}
            >
            </div>

            {/* Map Grid Overlay Effect */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-10 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

            {/* MAP MARKERS (Absolute Positioned Simulation) */}

            {/* Marker 1: Installed (Green) */}
            <button className="absolute top-[30%] left-[45%] z-10 group hover:z-50 transition-transform hover:scale-110">
                <div className="flex items-center justify-center size-4 bg-status-installed rounded-full shadow-[0_0_10px_rgba(66,201,66,0.5)] border border-white/20"></div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    INS-092
                </div>
            </button>

            {/* Marker 2: Warning (Yellow) */}
            <button className="absolute top-[42%] left-[38%] z-10 group hover:z-50 transition-transform hover:scale-110">
                <div className="flex items-center justify-center size-4 bg-status-warning rounded-full shadow-[0_0_10px_rgba(230,170,26,0.5)] border border-white/20"></div>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                    WARN-Drift
                </div>
            </button>

            {/* Marker 3: Planned (Red) */}
            <button className="absolute top-[25%] left-[60%] z-10 group hover:z-50 transition-transform hover:scale-110">
                <div className="flex items-center justify-center size-4 bg-status-planned rounded-full shadow-[0_0_10px_rgba(204,51,51,0.5)] border border-white/20"></div>
            </button>

            {/* Marker 4: Selected (Green with Pulse) */}
            <button className="absolute top-[50%] left-[55%] z-20 group">
                <div className="relative flex items-center justify-center size-6 bg-status-installed rounded-full shadow-[0_0_15px_rgba(66,201,66,0.8)] border-2 border-white marker-pulse">
                    <span className="material-symbols-outlined text-[14px] text-black font-bold">check</span>
                </div>

                {/* Connector Line to Card */}
                <svg className="absolute top-1/2 left-full h-[2px] w-[120px] lg:w-[180px] z-0 pointer-events-none overflow-visible hidden md:block" style={{ top: "50%" }}>
                    <line stroke="#1b988d" strokeDasharray="4 2" strokeWidth="2" x1="0" x2="100%" y1="0" y2="0"></line>
                    <circle cx="100%" cy="0" fill="#1b988d" r="3"></circle>
                </svg>
            </button>

            {/* FLOATING UI LAYERS */}

            {/* Top Controls Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 md:p-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center pointer-events-none z-30">
                {/* Search & Breadcrumb */}
                <div className="flex flex-col gap-2 pointer-events-auto w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-panel/90 backdrop-blur border border-white/10 rounded-lg p-1 pr-4 shadow-lg w-full md:w-[400px]">
                        <div className="h-10 w-10 flex items-center justify-center text-[#97c4c0]">
                            <span className="material-symbols-outlined">search</span>
                        </div>
                        <input
                            className="bg-transparent border-none text-white placeholder-[#97c4c0] focus:ring-0 w-full text-sm h-10 p-0 outline-none"
                            placeholder="Search coordinates or ID..."
                            type="text"
                        />
                        <div className="h-6 w-[1px] bg-white/10 mx-2"></div>
                        <button className="text-[#97c4c0] hover:text-white">
                            <span className="material-symbols-outlined">tune</span>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 pointer-events-auto overflow-x-auto max-w-full pb-2 md:pb-0 no-scrollbar">
                    {/* Status Filter */}
                    <div className="relative group">
                        <button className="flex items-center gap-2 bg-panel/90 backdrop-blur border border-white/10 hover:border-primary/50 text-white px-3 py-2.5 rounded-lg shadow-lg transition-all text-sm whitespace-nowrap">
                            <span className="material-symbols-outlined text-[18px] text-[#97c4c0]">filter_list</span>
                            <span>Status: All</span>
                            <span className="material-symbols-outlined text-[18px]">expand_more</span>
                        </button>
                    </div>

                    {/* Date Filter */}
                    <div className="relative">
                        <button className="flex items-center gap-2 bg-panel/90 backdrop-blur border border-white/10 hover:border-primary/50 text-white px-3 py-2.5 rounded-lg shadow-lg transition-all text-sm whitespace-nowrap">
                            <span className="material-symbols-outlined text-[18px] text-[#97c4c0]">calendar_today</span>
                            <span>Date: Last 7 Days</span>
                            <span className="material-symbols-outlined text-[18px]">expand_more</span>
                        </button>
                    </div>

                    {/* Region Filter */}
                    <div className="relative hidden sm:block">
                        <button className="flex items-center gap-2 bg-panel/90 backdrop-blur border border-white/10 hover:border-primary/50 text-white px-3 py-2.5 rounded-lg shadow-lg transition-all text-sm whitespace-nowrap">
                            <span className="material-symbols-outlined text-[18px] text-[#97c4c0]">location_on</span>
                            <span>Jakarta Region</span>
                            <span className="material-symbols-outlined text-[18px]">expand_more</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Detail Modal / Card (Right Side Overlay) */}
            <div className="absolute right-4 top-[20%] md:right-8 z-40 w-[calc(100%-2rem)] md:w-[400px] pointer-events-auto animate-[slideIn_0.3s_ease-out]">
                <div className="bg-panel/85 backdrop-blur-md border border-white/10 rounded-xl overflow-hidden shadow-2xl flex flex-col">
                    {/* Card Header */}
                    <div className="p-4 border-b border-white/10 flex justify-between items-start bg-[#1c312f]">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h2 className="text-xl font-bold font-mono tracking-tight text-white">TIANG-JB-001</h2>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-status-installed/20 text-status-installed border border-status-installed/30">Installed</span>
                            </div>
                            <p className="text-xs text-[#97c4c0] flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">my_location</span>
                                -6.2088, 106.8456
                            </p>
                        </div>
                        <button className="text-[#97c4c0] hover:text-white p-1 rounded hover:bg-white/5 transition-colors">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    {/* Evidence Image Area */}
                    <div className="relative aspect-video bg-black group/image overflow-hidden">
                        <div
                            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover/image:scale-105"
                            data-alt="Photo of a utility pole taken from street level"
                            style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAYw-E_t_En-Ma29Q7uQ9ir52u2EyZYFCTvAWyom5yimxSgMNsuJl0nw3iktgKHaaSq95gsww_9c4gP6POrd9IjGthGmP1Ss1ppKxNa5mVdEeg-FwLCbp0fQchazJYj5USAN6fN24jyn4z_Cgzz6maqoT37H0Qlxa-EjcL3nqbqS6cnUFP5f7OHxrjddW-BUHbQMtGgA9OClyMV2_zXirCrO9amG_GG7uiIHY4sdwTv-nBDBXCir9aUtISN7T6cQEVjxCzebCW00iXw')" }}
                        >
                        </div>

                        {/* AI Bounding Box Overlay (Visual flair) */}
                        <div className="absolute top-[20%] left-[40%] w-[20%] h-[60%] border-2 border-primary/80 shadow-[0_0_20px_rgba(27,152,141,0.4)] flex flex-col justify-between p-1">
                            <div className="bg-primary text-white text-[9px] font-bold px-1 self-start">POLE</div>
                            <div className="bg-black/70 text-primary text-[9px] font-bold px-1 self-end">95%</div>
                        </div>

                        <div className="absolute bottom-2 right-2">
                            <button className="size-8 flex items-center justify-center bg-black/60 backdrop-blur rounded text-white hover:bg-primary transition-colors">
                                <span className="material-symbols-outlined text-[18px]">fullscreen</span>
                            </button>
                        </div>
                    </div>

                    {/* Data Grid */}
                    <div className="p-4 space-y-4">
                        {/* Metrics Row */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#131416]/50 rounded p-2 border border-white/5">
                                <p className="text-[10px] uppercase tracking-wider text-[#97c4c0] mb-0.5">Technician</p>
                                <div className="flex items-center gap-2">
                                    <div className="size-5 rounded-full bg-gray-600 bg-cover" data-alt="Technician avatar" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBZdMZawIdu4ZOvVShr8ntUx1uuBU_cH_o1_A93u1jH7uscxrLDDb7F1U88MT7z-Sh6MlBjgoCdIRpQmJkvGm9YlxVZ5CavW-F71jSOS2cXJu15gBAZicrjV4lQFm86lv667aRbijznW5HpRMvvq7hVjei6HWWWL3b3AEzVbLs29zCl9bDkbNb8BBsPOL6Ep62cePtlmTHdqIwR4Bo0BfO9rYFY35S0-A9d8zeX-peYlA_1CxYhIoDsdLA4mKO9WVGL8Is2QkqqAqxF')" }}></div>
                                    <p className="text-sm font-medium text-white truncate">Budi Santoso</p>
                                </div>
                            </div>
                            <div className="bg-[#131416]/50 rounded p-2 border border-white/5">
                                <p className="text-[10px] uppercase tracking-wider text-[#97c4c0] mb-0.5">Timestamp</p>
                                <p className="text-sm font-medium text-white">Oct 24, 14:30</p>
                            </div>
                        </div>

                        {/* Drift Analysis */}
                        <div className="bg-status-warning/10 border border-status-warning/20 rounded p-3 flex items-start gap-3">
                            <span className="material-symbols-outlined text-status-warning shrink-0 mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                            <div className="flex-1">
                                <div className="flex justify-between items-center mb-1">
                                    <p className="text-xs font-bold text-status-warning">Drift Detected</p>
                                    <span className="text-xs font-mono text-white">12m &gt; 10m Limit</span>
                                </div>
                                <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
                                    <div className="h-full bg-status-warning w-[80%]"></div>
                                </div>
                            </div>
                        </div>

                        {/* Action Button */}
                        <button className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-2.5 rounded shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                            <span>View Full Evidence Report</span>
                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Bottom Right Legend & Tools */}
            <div className="absolute bottom-6 right-6 flex flex-col items-end gap-4 pointer-events-none z-30">
                {/* Map Controls */}
                <div className="flex flex-col gap-1 pointer-events-auto shadow-lg rounded-lg overflow-hidden border border-white/10">
                    <button className="size-10 flex items-center justify-center bg-panel/90 backdrop-blur hover:bg-panel text-white border-b border-white/10">
                        <span className="material-symbols-outlined">add</span>
                    </button>
                    <button className="size-10 flex items-center justify-center bg-panel/90 backdrop-blur hover:bg-panel text-white">
                        <span className="material-symbols-outlined">remove</span>
                    </button>
                </div>

                {/* Compass / Re-center */}
                <button className="size-10 flex items-center justify-center bg-panel/90 backdrop-blur hover:bg-panel text-white rounded-lg shadow-lg border border-white/10 pointer-events-auto">
                    <span className="material-symbols-outlined">near_me</span>
                </button>

                {/* Legend */}
                <div className="bg-panel/95 backdrop-blur border border-white/10 rounded-lg p-4 shadow-xl pointer-events-auto min-w-[180px]">
                    <h3 class="text-xs font-bold uppercase tracking-wider text-[#97c4c0] mb-3">Status Legend</h3>
                    <div className="flex flex-col gap-2.5">
                        <div className="flex items-center gap-3">
                            <div className="size-3 rounded-full bg-status-installed shadow-[0_0_8px_rgba(66,201,66,0.4)]"></div>
                            <span className="text-xs text-white font-medium">Installed</span>
                            <span className="text-[10px] text-gray-400 ml-auto">84%</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="size-3 rounded-full bg-status-planned shadow-[0_0_8px_rgba(204,51,51,0.4)]"></div>
                            <span className="text-xs text-white font-medium">Planned</span>
                            <span className="text-[10px] text-gray-400 ml-auto">12%</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="size-3 rounded-full bg-status-warning shadow-[0_0_8px_rgba(230,170,26,0.4)]"></div>
                            <span className="text-xs text-white font-medium">Warning</span>
                            <span className="text-[10px] text-gray-400 ml-auto">4%</span>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}

export default MapView
