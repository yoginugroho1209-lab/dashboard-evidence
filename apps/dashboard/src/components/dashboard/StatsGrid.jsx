import React from 'react';

const StatCard = ({ title, value, change, changeText, changeColor, icon, iconColor, bgIconColor, decorativeGlowColor }) => {
    return (
        <div className={`relative overflow-hidden rounded-xl border border-border-dark bg-surface-dark p-6 group hover:border-${decorativeGlowColor}/30 transition-all duration-300`}>
            <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium text-gray-400">{title}</p>
                    <h3 className="font-heading text-3xl font-bold text-white mt-2">{value}</h3>
                    <p className={`flex items-center gap-1 text-xs ${changeColor} mt-1`}>
                        <span className="material-symbols-outlined text-[16px]">{change === 'up' ? 'trending_up' : (change === 'check' ? 'check_circle' : 'schedule')}</span>
                        <span>{changeText}</span>
                    </p>
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
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
                title="Total Points"
                value="245"
                change="up"
                changeText="+12% from last week"
                changeColor="text-primary"
                icon="location_on"
                iconColor="text-primary"
                bgIconColor="bg-primary/10"
                decorativeGlowColor="primary"
            />
            <StatCard
                title="Completed"
                value="189"
                change="check"
                changeText="98% completion rate"
                changeColor="text-status-success"
                icon="task_alt"
                iconColor="text-status-success"
                bgIconColor="bg-status-success/10"
                decorativeGlowColor="status-success"
            />
            <StatCard
                title="Pending Review"
                value="56"
                change="wait"
                changeText="Requires attention"
                changeColor="text-status-warning"
                icon="warning"
                iconColor="text-status-warning"
                bgIconColor="bg-status-warning/10"
                decorativeGlowColor="status-warning"
            />
        </div>
    );
};

export default StatsGrid;
