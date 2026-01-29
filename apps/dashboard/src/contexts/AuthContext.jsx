import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

// ==========================================
// DAFTAR EMAIL ADMIN - Tambahkan email admin di sini
// ==========================================
const ADMIN_EMAILS = [
    'yoginugroho1209@gmail.com',
    // Tambahkan email admin lainnya di sini
]

export const useAuth = () => {
    return useContext(AuthContext)
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    // Check if user email is in admin list
    const checkIsAdmin = (email) => {
        if (!email) return false
        return ADMIN_EMAILS.includes(email.toLowerCase())
    }

    useEffect(() => {
        // Check active sessions and sets the user
        const getSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()
                setUser(session?.user ?? null)
            } catch (err) {
                console.error('Error getting session:', err)
            } finally {
                setLoading(false)
            }
        }

        getSession()

        // Listen for changes on auth state (login, logout, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    const signOut = async () => {
        await supabase.auth.signOut()
        setUser(null)
    }

    // Computed values based on user email
    const isAdmin = checkIsAdmin(user?.email)
    const userRole = isAdmin ? 'admin' : 'teknisi'

    const value = {
        user,
        userRole,
        isAdmin,
        loading,
        signOut
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
}

export default AuthContext



