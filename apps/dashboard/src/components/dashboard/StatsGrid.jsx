import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';

// Animated number component
const AnimatedNumber = ({ value, duration = 500 }) => {
    const [displayValue, setDisplayValue] = useState(0);
    const previousValue = useRef(0);

    useEffect(() => {
        const startValue = previousValue.current;
        const endValue = value;
        const startTime = Date.now();

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(startValue + (endValue - startValue) * easeOut);

            setDisplayValue(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                previousValue.current = endValue;
            }
        };

        requestAnimationFrame(animate);
    }, [value, duration]);

    return <>{displayValue.toLocaleString()}</>;
};

const StatCard = ({ title, value, change, changeText, changeColor, icon, iconColor, bgIconColor, decorativeGlowColor, trendValue, trendUp }) => {
    const showTrend = trendValue !== undefined && trendValue !== null;

    return (
        <div className={`relative overflow-hidden rounded-xl border border-border-dark bg-surface-dark p-6 group hover:border-${decorativeGlowColor}/30 transition-all duration-300`}>
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-gray-400">{title}</p>
                    <h3 className="font-heading text-3xl font-bold text-white mt-2">
                        <AnimatedNumber value={value} />
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                        <p className={`flex items-center gap-1 text-xs ${changeColor}`}>
                            <span className="material-symbols-outlined text-[16px]">
                                {change === 'up' ? 'trending_up' : (change === 'check' ? 'check_circle' : 'schedule')}
                            </span>
                            <span>{changeText}</span>
                        </p>
                        {showTrend && (
                            <span className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full ${trendUp ? 'bg-status-success/10 text-status-success' :
                                    trendValue === 0 ? 'bg-gray-500/10 text-gray-400' :
                                        'bg-status-danger/10 text-status-danger'
                                }`}>
                                {trendUp && <span className="material-symbols-outlined text-[12px]">arrow_upward</span>}
                                {!trendUp && trendValue !== 0 && <span className="material-symbols-outlined text-[12px]">arrow_downward</span>}
                                {trendValue === 0 ? '–' : `${Math.abs(trendValue)}%`}
                            </span>
                        )}
                    </div>
                </div>
                <div className={`rounded-lg ${bgIconColor} p-3 ${iconColor}`}>
                    <span className="material-symbols-outlined">{icon}</span>
                </div>
            </div>
            {/* Decorative glow */}
            <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-${decorativeGlowColor}/10 blur-2xl transition-opacity opacity-50 group-hover:opacity-100`}></div>
        </div>
    )
}

const StatsGrid = () => {
    const [stats, setStats] = useState({
        totalPoints: 0,
        completed: 0,
        pending: 0,
        totalProjects: 0
    });
    const [trends, setTrends] = useState({
        points: null,
        completed: null,
        pending: null,
        projects: null
    });
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            // Total points (all points)
            const { count: totalPoints } = await supabase
                .from('points')
                .select('*', { count: 'exact', head: true });

            // Total projects (active only)
            const { count: totalProjects } = await supabase
                .from('projects')
                .select('*', { count: 'exact', head: true })
                .is('deleted_at', null);

            // Completed (points with evidence)
            const { data: evidenceData } = await supabase
                .from('evidence')
                .select('point_id');

            const completedPointIds = new Set(evidenceData?.map(e => e.point_id).filter(Boolean) || []);
            const completed = completedPointIds.size;

            // Pending (points without evidence)
            const pending = (totalPoints || 0) - completed;

            // Calculate trends (compare with last week)
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);

            const { count: evidenceLastWeek } = await supabase
                .from('evidence')
                .select('*', { count: 'exact', head: true })
                .lt('created_at', lastWeek.toISOString());

            const completedLastWeek = evidenceLastWeek || 0;
            const completedThisWeek = completed;

            // Calculate trend percentage
            let completedTrend = null;
            if (completedLastWeek > 0) {
                const weekDiff = completedThisWeek - completedLastWeek;
                completedTrend = Math.round((weekDiff / completedLastWeek) * 100);
            } else if (completedThisWeek > 0) {
                completedTrend = 100; // All new this week
            }

            setStats({
                totalPoints: totalPoints || 0,
                completed,
                pending: pending > 0 ? pending : 0,
                totalProjects: totalProjects || 0
            });

            setTrends({
                points: null, // Points don't typically have weekly trends
                completed: completedTrend,
                pending: null,
                projects: null
            });

            setLoading(false);
        } catch (error) {
            console.error('Error fetching stats:', error);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();

        // 🔄 REALTIME: Subscribe to points, evidence, and projects changes
        const channel = supabase
            .channel('dashboard-stats-enhanced')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'points' },
                () => { console.log('🔄 Stats: Points changed'); fetchStats(); }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'evidence' },
                () => { console.log('🔄 Stats: Evidence changed'); fetchStats(); }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'projects' },
                () => { console.log('🔄 Stats: Projects changed'); fetchStats(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const completionRate = stats.totalPoints > 0
        ? Math.round((stats.completed / stats.totalPoints) * 100)
        : 0;

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="rounded-xl border border-border-dark bg-surface-dark p-6 animate-pulse">
                        <div className="h-4 bg-gray-700 rounded w-24 mb-4"></div>
                        <div className="h-8 bg-gray-700 rounded w-16 mb-2"></div>
                        <div className="h-3 bg-gray-700 rounded w-32"></div>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
                title="Total Projects"
                value={stats.totalProjects}
                change="up"
                changeText="Active projects"
                changeColor="text-blue-400"
                icon="folder_open"
                iconColor="text-blue-400"
                bgIconColor="bg-blue-400/10"
                decorativeGlowColor="blue-400"
                trendValue={trends.projects}
                trendUp={trends.projects > 0}
            />
            <StatCard
                title="Total Points"
                value={stats.totalPoints}
                change="up"
                changeText="All KML points"
                changeColor="text-primary"
                icon="location_on"
                iconColor="text-primary"
                bgIconColor="bg-primary/10"
                decorativeGlowColor="primary"
                trendValue={trends.points}
                trendUp={trends.points > 0}
            />
            <StatCard
                title="Completed"
                value={stats.completed}
                change="check"
                changeText={`${completionRate}% completion rate`}
                changeColor="text-status-success"
                icon="task_alt"
                iconColor="text-status-success"
                bgIconColor="bg-status-success/10"
                decorativeGlowColor="status-success"
                trendValue={trends.completed}
                trendUp={trends.completed > 0}
            />
            <StatCard
                title="Pending"
                value={stats.pending}
                change="wait"
                changeText="Requires evidence"
                changeColor="text-status-warning"
                icon="warning"
                iconColor="text-status-warning"
                bgIconColor="bg-status-warning/10"
                decorativeGlowColor="status-warning"
                trendValue={trends.pending}
                trendUp={false}
            />
        </div>
    );
};

export default StatsGrid;
