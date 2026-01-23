import React from 'react';

const Header = () => {
    return (
        <header className="flex h-20 items-center justify-between px-8 border-b border-border-dark/50 z-10 bg-background-dark/80 backdrop-blur-sm sticky top-0">
            <div>
                <h2 className="font-heading text-2xl font-bold text-white tracking-tight">Dashboard Overview</h2>
                <p className="text-sm text-gray-400 mt-0.5">Welcome back, Admin. Here is today's field activity.</p>
            </div>
            <div className="flex items-center gap-4">
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[20px]">search</span>
                    <input className="h-10 w-64 rounded-lg border border-border-dark bg-surface-dark pl-10 pr-4 text-sm text-white focus:border-primary focus:ring-1 focus:ring-primary placeholder-gray-600" placeholder="Search evidence..." type="text" />
                </div>
                <button className="relative h-10 w-10 items-center justify-center rounded-lg border border-border-dark bg-surface-dark hover:bg-white/5 hover:text-white text-gray-400 transition-colors flex">
                    <span className="material-symbols-outlined text-[20px]">notifications</span>
                    <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-status-warning"></span>
                </button>
            </div>
        </header>
    );
};

export default Header;
