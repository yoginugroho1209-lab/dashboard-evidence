import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth()
    const location = useLocation()

    // Show loading spinner while checking auth state
    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background-dark">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-slate-400 text-sm">Checking authentication...</span>
                </div>
            </div>
        )
    }

    // If not authenticated, redirect to login with the intended destination
    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return children
}

export default ProtectedRoute
