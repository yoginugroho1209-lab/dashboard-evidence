import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';

const Sidebar = () => {
    const [showComingSoon, setShowComingSoon] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const activeNavClass = ({ isActive }) =>
        `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${isActive
            ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_-3px_rgba(27,152,141,0.2)]'
            : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
        }`;

    return (
        <>
            {/* Collapsible Drawer Sidebar */}
            <aside
                className={`fixed top-0 left-0 h-full z-40 transition-all duration-500 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
                style={{ width: '288px' }}
            >
                <div className="flex h-full flex-col border-r border-border-dark bg-surface-dark/95 backdrop-blur-xl shadow-2xl">
                    {/* Logo Section */}
                    <div className="flex h-20 items-center gap-3 px-6 border-b border-border-dark/50">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                            <span className="material-symbols-outlined text-[24px]">satellite_alt</span>
                        </div>
                        <div>
                            <h1 className="font-heading text-lg font-bold tracking-tight text-white">Telkom Evidence</h1>
                            <p className="text-xs font-medium text-gray-500">Admin Console</p>
                        </div>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
                        {/* Active Features */}
                        <div className="mb-2">
                            <span className="px-3 text-xs font-semibold uppercase tracking-wider text-primary/70">Active</span>
                        </div>
                        <NavLink to="/upload-evidence" className={activeNavClass}>
                            <span className="material-symbols-outlined">photo_camera</span>
                            Upload Evidence
                        </NavLink>
                        <NavLink to="/projects" className={activeNavClass}>
                            <span className="material-symbols-outlined">folder_open</span>
                            Projects
                        </NavLink>
                        <NavLink to="/project-maps" className={activeNavClass}>
                            <span className="material-symbols-outlined">map</span>
                            Project Maps
                        </NavLink>
                        <NavLink to="/reports" className={activeNavClass}>
                            <span className="material-symbols-outlined">description</span>
                            Reports
                        </NavLink>

                        {/* Coming Soon Section */}
                        <div className="mt-6 mb-2">
                            <button
                                onClick={() => setShowComingSoon(!showComingSoon)}
                                className="flex items-center gap-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-400 transition-colors w-full"
                            >
                                <span className="material-symbols-outlined text-[16px] transition-transform duration-200" style={{ transform: showComingSoon ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                    chevron_right
                                </span>
                                Coming Soon
                            </button>
                        </div>

                        {showComingSoon && (
                            <div className="space-y-1 opacity-50">
                                <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 cursor-not-allowed border border-transparent">
                                    <span className="material-symbols-outlined filled">dashboard</span>
                                    Dashboard
                                    <span className="ml-auto text-[10px] bg-gray-700 px-1.5 py-0.5 rounded">Soon</span>
                                </div>
                                <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 cursor-not-allowed border border-transparent">
                                    <span className="material-symbols-outlined">engineering</span>
                                    Technicians
                                    <span className="ml-auto text-[10px] bg-gray-700 px-1.5 py-0.5 rounded">Soon</span>
                                </div>
                            </div>
                        )}
                    </nav>

                    {/* User Profile Snippet */}
                    <div className="border-t border-border-dark/50 p-4">
                        <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3 hover:bg-white/10 transition-colors cursor-pointer border border-white/5">
                            <div className="h-10 w-10 rounded-full bg-cover bg-center ring-2 ring-primary/30" data-alt="Portrait of admin user" style={{ backgroundImage: "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBl04K_ERAHpiIcKDHMrse9TLr2z8-paUUYUjHhfZ3jZl1U05HPfu-QlvuEZViGlW9p5ZR6s_Dv9GvtO7d_5r2e3mcov_dfhwpB2Lfx6sUkIMsK3peVAEDCGBD1WDa4ZKsje6_iZm4FtnF9NgP81YyxjgjWHjMgPPHpSQY5JD4Yf-qAoSypzwRBks4vBU5rn3LiR0eytmnup0BuHOoRxCK7zyxMZtETslDcEUCtoQ5Iuy0sCnKTw9Rbpz6Ak4zLc7jYz6MqphtNUIm9')" }}>
                            </div>
                            <div className="flex flex-col overflow-hidden">
                                <span className="truncate text-sm font-medium text-white">Administrator</span>
                                <span className="truncate text-xs text-gray-500">admin@telkom.co.za</span>
                            </div>
                            <Link to="/login" className="ml-auto text-gray-500 hover:text-white transition-colors" title="Logout">
                                <span className="material-symbols-outlined text-[20px]">logout</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Toggle Sidebar Button - Positioned at top like ProjectMaps */}
            <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`fixed top-6 z-50 w-10 h-10 bg-primary text-white rounded-r-xl shadow-xl flex items-center justify-center transition-all duration-500 hover:w-12 ${sidebarOpen ? 'left-[288px]' : 'left-0'}`}
            >
                <span className="material-symbols-outlined text-xl">{sidebarOpen ? 'chevron_left' : 'chevron_right'}</span>
            </button>

            {/* Spacer div to push content when sidebar is open */}
            <div
                className={`flex-shrink-0 transition-all duration-500 ${sidebarOpen ? 'w-72' : 'w-0'}`}
            />
        </>
    );
};

export default Sidebar;
