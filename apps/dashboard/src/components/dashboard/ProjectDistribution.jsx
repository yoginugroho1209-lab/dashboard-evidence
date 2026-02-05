import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

const ProjectDistribution = () => {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [hoveredIndex, setHoveredIndex] = useState(null);
    const navigate = useNavigate();

    // Color palette for projects
    const colors = [
        '#1b988d', // primary teal
        '#3b82f6', // blue
        '#8b5cf6', // purple
        '#f59e0b', // amber
        '#ef4444', // red
        '#10b981', // emerald
        '#ec4899', // pink
        '#06b6d4', // cyan
    ];

    const fetchProjectDistribution = async () => {
        setLoading(true);

        // Fetch all active projects
        const { data: projectsData } = await supabase
            .from('projects')
            .select('id, name')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (!projectsData || projectsData.length === 0) {
            setProjects([]);
            setLoading(false);
            return;
        }

        // Fetch evidence counts per project
        const { data: evidenceData } = await supabase
            .from('evidence')
            .select('project_id');

        // Count evidence per project
        const countMap = {};
        evidenceData?.forEach(e => {
            countMap[e.project_id] = (countMap[e.project_id] || 0) + 1;
        });

        // Combine with project data
        const projectsWithCounts = projectsData.map((project, index) => ({
            ...project,
            count: countMap[project.id] || 0,
            color: colors[index % colors.length]
        }));

        // Sort by count descending
        projectsWithCounts.sort((a, b) => b.count - a.count);

        setProjects(projectsWithCounts);
        setLoading(false);
    };

    useEffect(() => {
        fetchProjectDistribution();

        // Realtime subscription
        const channel = supabase
            .channel('project-distribution')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'evidence' },
                () => {
                    console.log('🔄 ProjectDistribution: Evidence changed');
                    fetchProjectDistribution();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'projects' },
                () => {
                    console.log('🔄 ProjectDistribution: Projects changed');
                    fetchProjectDistribution();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Calculate donut chart segments
    const chartData = useMemo(() => {
        const total = projects.reduce((sum, p) => sum + p.count, 0);
        if (total === 0) return { segments: [], total: 0 };

        let currentAngle = 0;
        const segments = projects.map((project, index) => {
            const percentage = (project.count / total) * 100;
            const angle = (project.count / total) * 360;
            const segment = {
                ...project,
                percentage,
                startAngle: currentAngle,
                endAngle: currentAngle + angle,
                index
            };
            currentAngle += angle;
            return segment;
        });

        return { segments, total };
    }, [projects]);

    // Generate SVG arc path
    const describeArc = (cx, cy, radius, startAngle, endAngle) => {
        const start = polarToCartesian(cx, cy, radius, endAngle);
        const end = polarToCartesian(cx, cy, radius, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

        return [
            "M", start.x, start.y,
            "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
        ].join(" ");
    };

    const polarToCartesian = (cx, cy, radius, angleInDegrees) => {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;
        return {
            x: cx + (radius * Math.cos(angleInRadians)),
            y: cy + (radius * Math.sin(angleInRadians))
        };
    };

    const handleProjectClick = (projectId) => {
        navigate(`/reports?project=${projectId}`);
    };

    return (
        <div className="rounded-xl border border-border-dark bg-surface-dark p-6 h-full">
            <div className="mb-6">
                <h3 className="font-heading text-lg font-bold text-white">Evidence by Project</h3>
                <p className="text-sm text-gray-400">Distribution across active projects</p>
            </div>

            {loading ? (
                // Skeleton loader
                <div className="flex items-center justify-center h-[200px]">
                    <div className="flex items-center gap-2 text-gray-500">
                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        <span>Loading...</span>
                    </div>
                </div>
            ) : projects.length === 0 || chartData.total === 0 ? (
                // Empty state
                <div className="flex flex-col items-center justify-center h-[200px] text-gray-500">
                    <span className="material-symbols-outlined text-4xl mb-2">pie_chart</span>
                    <p>No evidence data available</p>
                </div>
            ) : (
                <div className="flex flex-col lg:flex-row items-center gap-6">
                    {/* Donut Chart */}
                    <div className="relative">
                        <svg width="180" height="180" viewBox="0 0 180 180">
                            {chartData.segments.map((segment, index) => {
                                // Handle case where there's only one segment (full circle)
                                if (chartData.segments.length === 1) {
                                    return (
                                        <circle
                                            key={segment.id}
                                            cx="90"
                                            cy="90"
                                            r="70"
                                            fill="none"
                                            stroke={segment.color}
                                            strokeWidth={hoveredIndex === index ? 24 : 20}
                                            className="transition-all duration-200 cursor-pointer"
                                            onMouseEnter={() => setHoveredIndex(index)}
                                            onMouseLeave={() => setHoveredIndex(null)}
                                            onClick={() => handleProjectClick(segment.id)}
                                        />
                                    );
                                }

                                // Skip segments that are too small to render
                                if (segment.percentage < 0.5) return null;

                                return (
                                    <path
                                        key={segment.id}
                                        d={describeArc(90, 90, 70, segment.startAngle, segment.endAngle - 0.5)}
                                        fill="none"
                                        stroke={segment.color}
                                        strokeWidth={hoveredIndex === index ? 24 : 20}
                                        strokeLinecap="round"
                                        className="transition-all duration-200 cursor-pointer"
                                        style={{
                                            filter: hoveredIndex === index ? 'brightness(1.2)' : 'none'
                                        }}
                                        onMouseEnter={() => setHoveredIndex(index)}
                                        onMouseLeave={() => setHoveredIndex(null)}
                                        onClick={() => handleProjectClick(segment.id)}
                                    />
                                );
                            })}
                        </svg>

                        {/* Center text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-3xl font-bold text-white">{chartData.total}</span>
                            <span className="text-xs text-gray-400">Total Evidence</span>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex-1 w-full">
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                            {chartData.segments.slice(0, 6).map((segment, index) => (
                                <div
                                    key={segment.id}
                                    className={`flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer ${hoveredIndex === index ? 'bg-white/5' : 'hover:bg-white/5'
                                        }`}
                                    onMouseEnter={() => setHoveredIndex(index)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                    onClick={() => handleProjectClick(segment.id)}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div
                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: segment.color }}
                                        />
                                        <span className="text-sm text-gray-300 truncate">{segment.name}</span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-sm font-medium text-white">{segment.count}</span>
                                        <span className="text-xs text-gray-500">({segment.percentage.toFixed(1)}%)</span>
                                    </div>
                                </div>
                            ))}
                            {chartData.segments.length > 6 && (
                                <p className="text-xs text-gray-500 text-center pt-2">
                                    +{chartData.segments.length - 6} more projects
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Tooltip */}
            {hoveredIndex !== null && chartData.segments[hoveredIndex] && (
                <div className="mt-4 p-3 bg-[#1c1e20] border border-border-dark rounded-lg">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: chartData.segments[hoveredIndex].color }}
                            />
                            <span className="font-medium text-white">{chartData.segments[hoveredIndex].name}</span>
                        </div>
                        <span className="text-primary font-bold">
                            {chartData.segments[hoveredIndex].count} evidence ({chartData.segments[hoveredIndex].percentage.toFixed(1)}%)
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectDistribution;
