import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = () => {
    const { user, userRole, isAdmin, signOut } = useAuth();
    console.log('Sidebar Auth State:', { userRole, isAdmin })
    const [showComingSoon, setShowComingSoon] = useState(false);

    const activeNavClass = ({ isActive }) =>
        `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${isActive
            ? 'bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_-3px_rgba(27,152,141,0.2)]'
            : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
        }`;

    // Get display name from user metadata or email
    const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const displayEmail = user?.email || '';
    const roleLabel = isAdmin ? 'Administrator' : 'Teknisi';
    const roleBadgeClass = isAdmin
        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
        : 'bg-primary/20 text-primary border-primary/30';

    return (
        <aside className="flex w-72 flex-col border-r border-border-dark bg-surface-dark/50 backdrop-blur-md">
            {/* Logo Section */}
            <div className="flex h-20 items-center gap-3 px-6 border-b border-border-dark/50">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                    <span className="material-symbols-outlined text-[24px]">satellite_alt</span>
                </div>
                <div>
                    <h1 className="font-heading text-lg font-bold tracking-tight text-white">Telkom Evidence</h1>
                    <p className="text-xs font-medium text-gray-500">{isAdmin ? 'Admin Console' : 'Teknisi Console'}</p>
                </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
                {/* Active Features */}
                <div className="mb-2">
                    <span className="px-3 text-xs font-semibold uppercase tracking-wider text-primary/70">Menu</span>
                </div>

                {/* Upload Evidence - Available for all users */}
                <NavLink to="/upload-evidence" className={activeNavClass}>
                    <span className="material-symbols-outlined">photo_camera</span>
                    Upload Evidence
                </NavLink>

                {/* Admin-only navigation items */}
                {isAdmin && (
                    <>
                        <NavLink to="/dashboard" className={activeNavClass}>
                            <span className="material-symbols-outlined filled">dashboard</span>
                            Dashboard
                        </NavLink>
                        <NavLink to="/projects" className={activeNavClass}>
                            <span className="material-symbols-outlined">folder_open</span>
                            Projects
                        </NavLink>
                        <NavLink to="/reports" className={activeNavClass}>
                            <span className="material-symbols-outlined">description</span>
                            Reports
                        </NavLink>

                        {/* Coming Soon Section - Admin only */}
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
                                    <span className="material-symbols-outlined">map</span>
                                    Project Maps
                                    <span className="ml-auto text-[10px] bg-gray-700 px-1.5 py-0.5 rounded">Soon</span>
                                </div>
                                <div className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 cursor-not-allowed border border-transparent">
                                    <span className="material-symbols-outlined">engineering</span>
                                    Technicians
                                    <span className="ml-auto text-[10px] bg-gray-700 px-1.5 py-0.5 rounded">Soon</span>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </nav>

            {/* User Profile Snippet */}
            <div className="border-t border-border-dark/50 p-4">
                <div className="flex items-center gap-3 rounded-lg bg-white/5 p-3 hover:bg-white/10 transition-colors border border-white/5">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center ring-2 ring-primary/30">
                        <span className="material-symbols-outlined text-primary text-[20px]">person</span>
                    </div>
                    <div className="flex flex-col overflow-hidden flex-1">
                        <span className="truncate text-sm font-medium text-white">{displayName}</span>
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${roleBadgeClass}`}>
                                {roleLabel}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={signOut}
                        className="text-gray-500 hover:text-white transition-colors"
                        title="Logout"
                    >
                        <span className="material-symbols-outlined text-[20px]">logout</span>
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;

