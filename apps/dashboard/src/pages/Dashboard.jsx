import React from 'react'
import StatsGrid from '../components/dashboard/StatsGrid'
import ActivityChart from '../components/dashboard/ActivityChart'
import RecentUploads from '../components/dashboard/RecentUploads'
import Header from '../components/layout/Header'

const Dashboard = () => {
    return (
        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background-dark relative">
            {/* Subtle background mesh gradient */}
            <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-primary/5 to-transparent pointer-events-none z-0"></div>

            <Header />

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 z-10">
                <div className="max-w-[1200px] mx-auto flex flex-col gap-8">
                    <StatsGrid />
                    <ActivityChart />
                    <RecentUploads />
                </div>
            </div>
        </div>
    )
}

export default Dashboard
