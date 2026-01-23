import React from 'react'

const Technicians = () => {
    return (
        <main className="flex-1 flex flex-col items-center justify-center h-full bg-[#131416] text-white">
            <div className="text-center p-8 border border-white/10 rounded-2xl bg-[#1c1e20] max-w-lg">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary mb-6 animate-pulse">
                    <span className="material-symbols-outlined text-[40px]">engineering</span>
                </div>
                <h1 className="text-2xl font-bold font-heading mb-2">Technician Management</h1>
                <p className="text-slate-400 mb-6">This module is currently under development. You will be able to manage field technicians, assign tasks, and track performance here.</p>
                <button className="px-6 py-2.5 rounded bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium">
                    Notify when available
                </button>
            </div>
        </main>
    )
}

export default Technicians
