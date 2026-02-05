import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';

const ActivityChart = () => {
    const [period, setPeriod] = useState('7'); // '7', '30', '90'
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hoveredIndex, setHoveredIndex] = useState(null);

    // Fetch evidence data grouped by date
    const fetchActivityData = async () => {
        setLoading(true);

        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const { data: evidenceData, error } = await supabase
            .from('evidence')
            .select('created_at')
            .gte('created_at', startDate.toISOString())
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error fetching activity data:', error);
            setLoading(false);
            return;
        }

        // Group by date
        const dailyCounts = {};

        // Initialize all dates with 0
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (days - 1 - i));
            const dateKey = date.toISOString().split('T')[0];
            dailyCounts[dateKey] = 0;
        }

        // Count evidence per day
        evidenceData?.forEach(item => {
            const dateKey = new Date(item.created_at).toISOString().split('T')[0];
            if (dailyCounts.hasOwnProperty(dateKey)) {
                dailyCounts[dateKey]++;
            }
        });

        // Convert to array
        const chartData = Object.entries(dailyCounts).map(([date, count]) => ({
            date,
            count,
            label: formatDateLabel(date)
        }));

        setData(chartData);
        setLoading(false);
    };

    // Format date for x-axis labels
    const formatDateLabel = (dateStr) => {
        const date = new Date(dateStr);
        const days = parseInt(period);

        if (days <= 7) {
            return date.toLocaleDateString('id-ID', { weekday: 'short' });
        } else if (days <= 30) {
            return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        } else {
            return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        }
    };

    useEffect(() => {
        fetchActivityData();

        // Realtime subscription
        const channel = supabase
            .channel('activity-chart')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'evidence' },
                () => {
                    console.log('🔄 ActivityChart: Evidence changed');
                    fetchActivityData();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [period]);

    // Calculate chart dimensions and path
    const chartConfig = useMemo(() => {
        if (data.length === 0) return null;

        const maxCount = Math.max(...data.map(d => d.count), 1);
        const width = 1000;
        const height = 200;
        const padding = 20;

        // Generate points
        const points = data.map((d, i) => ({
            x: padding + (i * (width - 2 * padding) / (data.length - 1 || 1)),
            y: height - padding - ((d.count / maxCount) * (height - 2 * padding)),
            count: d.count,
            label: d.label,
            date: d.date
        }));

        // Generate smooth bezier path
        let path = `M ${points[0]?.x || 0} ${points[0]?.y || height - padding}`;

        for (let i = 1; i < points.length; i++) {
            const prev = points[i - 1];
            const curr = points[i];
            const cpx = (prev.x + curr.x) / 2;
            path += ` Q ${prev.x + (curr.x - prev.x) / 3} ${prev.y}, ${cpx} ${(prev.y + curr.y) / 2}`;
            path += ` T ${curr.x} ${curr.y}`;
        }

        // Area path (for gradient fill)
        const areaPath = path + ` L ${points[points.length - 1]?.x || width - padding} ${height - padding} L ${padding} ${height - padding} Z`;

        // Y-axis labels
        const yLabels = [];
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
            yLabels.push(Math.round(maxCount * (1 - i / steps)));
        }

        return { points, path, areaPath, yLabels, maxCount, width, height, padding };
    }, [data]);

    // Get display labels (show subset for readability)
    const displayLabels = useMemo(() => {
        if (data.length === 0) return [];

        const days = parseInt(period);
        if (days <= 7) {
            return data.map(d => d.label);
        } else {
            // Show every nth label
            const step = Math.ceil(data.length / 7);
            return data.map((d, i) => (i % step === 0 || i === data.length - 1) ? d.label : '');
        }
    }, [data, period]);

    const periodLabels = {
        '7': 'Last 7 Days',
        '30': 'Last 30 Days',
        '90': 'This Quarter'
    };

    // Calculate total uploads
    const totalUploads = data.reduce((sum, d) => sum + d.count, 0);

    return (
        <div className="rounded-xl border border-border-dark bg-surface-dark p-6">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h3 className="font-heading text-lg font-bold text-white">Activity Trend</h3>
                    <p className="text-sm text-gray-400">
                        {loading ? 'Loading...' : `${totalUploads} uploads in ${periodLabels[period].toLowerCase()}`}
                    </p>
                </div>
                <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="rounded-lg border border-border-dark bg-[#131416] px-3 py-1.5 text-sm text-gray-300 focus:border-primary focus:ring-1 focus:ring-primary outline-none cursor-pointer transition-colors hover:border-gray-600"
                >
                    <option value="7">Last 7 Days</option>
                    <option value="30">Last 30 Days</option>
                    <option value="90">This Quarter</option>
                </select>
            </div>

            <div className="relative h-[240px] w-full">
                {loading ? (
                    // Skeleton loader
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex items-center gap-2 text-gray-500">
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                            <span>Loading chart...</span>
                        </div>
                    </div>
                ) : chartConfig ? (
                    <>
                        {/* Y-axis labels */}
                        <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between text-xs text-gray-600 font-mono">
                            {chartConfig.yLabels.map((label, i) => (
                                <span key={i}>{label}</span>
                            ))}
                        </div>

                        {/* Chart SVG */}
                        <svg
                            className="absolute left-10 right-0 top-0 h-[200px] w-[calc(100%-40px)]"
                            preserveAspectRatio="none"
                            viewBox={`0 0 ${chartConfig.width} ${chartConfig.height}`}
                        >
                            <defs>
                                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="#1b988d" stopOpacity="0.4"></stop>
                                    <stop offset="100%" stopColor="#1b988d" stopOpacity="0"></stop>
                                </linearGradient>
                            </defs>

                            {/* Grid lines */}
                            {chartConfig.yLabels.map((_, i) => (
                                <line
                                    key={i}
                                    x1={chartConfig.padding}
                                    y1={chartConfig.padding + (i * (chartConfig.height - 2 * chartConfig.padding) / (chartConfig.yLabels.length - 1))}
                                    x2={chartConfig.width - chartConfig.padding}
                                    y2={chartConfig.padding + (i * (chartConfig.height - 2 * chartConfig.padding) / (chartConfig.yLabels.length - 1))}
                                    stroke="#374151"
                                    strokeWidth="1"
                                    strokeDasharray="4 4"
                                    opacity="0.3"
                                />
                            ))}

                            {/* Area fill */}
                            <path
                                d={chartConfig.areaPath}
                                fill="url(#chartGradient)"
                                className="transition-all duration-500"
                            />

                            {/* Line */}
                            <path
                                d={chartConfig.path}
                                fill="none"
                                stroke="#1b988d"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="3"
                                className="transition-all duration-500"
                                style={{
                                    strokeDasharray: 2000,
                                    strokeDashoffset: 0,
                                    animation: 'drawLine 1s ease-out forwards'
                                }}
                            />

                            {/* Data Points */}
                            {chartConfig.points.map((point, i) => (
                                <g key={i}>
                                    {/* Hover area */}
                                    <circle
                                        cx={point.x}
                                        cy={point.y}
                                        r="20"
                                        fill="transparent"
                                        className="cursor-pointer"
                                        onMouseEnter={() => setHoveredIndex(i)}
                                        onMouseLeave={() => setHoveredIndex(null)}
                                    />
                                    {/* Visible point */}
                                    <circle
                                        cx={point.x}
                                        cy={point.y}
                                        r={hoveredIndex === i ? 6 : 4}
                                        fill="#131416"
                                        stroke="#1b988d"
                                        strokeWidth="2"
                                        className="transition-all duration-200"
                                    />
                                </g>
                            ))}
                        </svg>

                        {/* Tooltip */}
                        {hoveredIndex !== null && chartConfig.points[hoveredIndex] && (
                            <div
                                className="absolute z-20 bg-[#1c1e20] border border-border-dark rounded-lg px-3 py-2 shadow-xl pointer-events-none transition-all duration-150"
                                style={{
                                    left: `calc(40px + ${(chartConfig.points[hoveredIndex].x / chartConfig.width) * 100}% - 50px)`,
                                    top: `${(chartConfig.points[hoveredIndex].y / chartConfig.height) * 200 - 50}px`
                                }}
                            >
                                <p className="text-xs text-gray-400">{new Date(chartConfig.points[hoveredIndex].date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                                <p className="text-lg font-bold text-primary">{chartConfig.points[hoveredIndex].count} uploads</p>
                            </div>
                        )}

                        {/* X-axis labels */}
                        <div className="absolute left-10 right-0 bottom-0 flex justify-between px-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            {displayLabels.map((label, i) => (
                                <span key={i} className="text-center" style={{ minWidth: '40px' }}>{label}</span>
                            ))}
                        </div>
                    </>
                ) : (
                    // Empty state
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-gray-500">
                            <span className="material-symbols-outlined text-4xl mb-2">show_chart</span>
                            <p>No activity data available</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Animation keyframes */}
            <style>{`
                @keyframes drawLine {
                    from {
                        stroke-dashoffset: 2000;
                    }
                    to {
                        stroke-dashoffset: 0;
                    }
                }
            `}</style>
        </div>
    );
};

export default ActivityChart;
