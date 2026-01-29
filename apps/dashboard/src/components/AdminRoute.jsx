import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * AdminRoute - Wrapper component for admin-only routes
 * Redirects non-admin users to /upload-evidence
 */
const AdminRoute = ({ children }) => {
    const { user, isAdmin, loading } = useAuth()
    const location = useLocation()

    // Show loading spinner while checking auth state
    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background-dark">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-400 text-sm">Checking authorization...</span>
                </div>
            </div>
        )
    }

    // If not authenticated, redirect to login
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    // If not admin, redirect to upload-evidence (the only page teknisi can access)
    if (!isAdmin) {
        return <Navigate to="/upload-evidence" replace />
    }

    return children
}

export default AdminRoute
