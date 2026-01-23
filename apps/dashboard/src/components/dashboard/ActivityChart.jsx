import React from 'react';

const ActivityChart = () => {
    return (
        <div className="rounded-xl border border-border-dark bg-surface-dark p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h3 className="font-heading text-lg font-bold text-white">Activity Trend</h3>
                    <p className="text-sm text-gray-400">Upload volume over the last 7 days</p>
                </div>
                <select className="rounded-lg border border-border-dark bg-[#131416] px-3 py-1.5 text-sm text-gray-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none">
                    <option>Last 7 Days</option>
                    <option>Last 30 Days</option>
                    <option>This Quarter</option>
                </select>
            </div>
            <div className="relative h-[240px] w-full">
                {/* Grid Lines */}
                <div className="absolute inset-0 flex flex-col justify-between text-xs text-gray-600 font-mono">
                    <div className="flex w-full items-center border-b border-dashed border-gray-800 pb-1"><span>200</span></div>
                    <div className="flex w-full items-center border-b border-dashed border-gray-800 pb-1"><span>150</span></div>
                    <div className="flex w-full items-center border-b border-dashed border-gray-800 pb-1"><span>100</span></div>
                    <div className="flex w-full items-center border-b border-dashed border-gray-800 pb-1"><span>50</span></div>
                    <div className="flex w-full items-center border-b border-gray-700 pb-1"><span>0</span></div>
                </div>
                {/* Chart SVG */}
                <svg className="absolute inset-0 h-full w-full pt-6" preserveAspectRatio="none" viewBox="0 0 1000 240">
                    <defs>
                        <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#1b988d" stopOpacity="0.3"></stop>
                            <stop offset="100%" stopColor="#1b988d" stopOpacity="0"></stop>
                        </linearGradient>
                    </defs>
                    <path d="M0 180 Q 142 180, 142 120 T 285 140 T 428 80 T 571 160 T 714 60 T 857 100 T 1000 40 V 240 H 0 Z" fill="url(#chartGradient)"></path>
                    <path d="M0 180 Q 142 180, 142 120 T 285 140 T 428 80 T 571 160 T 714 60 T 857 100 T 1000 40" fill="none" stroke="#1b988d" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3"></path>
                    {/* Data Points */}
                    <circle cx="142" cy="120" fill="#131416" r="4" stroke="#1b988d" strokeWidth="2"></circle>
                    <circle cx="285" cy="140" fill="#131416" r="4" stroke="#1b988d" strokeWidth="2"></circle>
                    <circle cx="428" cy="80" fill="#131416" r="4" stroke="#1b988d" strokeWidth="2"></circle>
                    <circle cx="571" cy="160" fill="#131416" r="4" stroke="#1b988d" strokeWidth="2"></circle>
                    <circle cx="714" cy="60" fill="#131416" r="4" stroke="#1b988d" strokeWidth="2"></circle>
                    <circle cx="857" cy="100" fill="#131416" r="4" stroke="#1b988d" strokeWidth="2"></circle>
                    <circle cx="1000" cy="40" fill="#131416" r="4" stroke="#1b988d" strokeWidth="2"></circle>
                </svg>
            </div>
            <div className="mt-4 flex justify-between px-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <span>Mon</span>
                <span>Tue</span>
                <span>Wed</span>
                <span>Thu</span>
                <span>Fri</span>
                <span>Sat</span>
                <span>Sun</span>
            </div>
        </div>
    );
};

export default ActivityChart;
