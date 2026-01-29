import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
    return useContext(AuthContext)
}

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [userRole, setUserRole] = useState(null)
    const [loading, setLoading] = useState(true)

    // Fetch user role from user_roles table
    const fetchUserRole = async (userId) => {
        try {
            console.log('Fetching role for user:', userId)
            const { data, error } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', userId)
                .single()

            console.log('Role fetch result:', { data, error })

            if (error) {
                console.warn('Could not fetch user role:', error.message)
                // Default to teknisi if no role found
                setUserRole('teknisi')
                return
            }

            const role = data?.role || 'teknisi'
            console.log('Setting user role to:', role)
            setUserRole(role)
        } catch (err) {
            console.error('Error fetching user role:', err)
            setUserRole('teknisi')
        }
    }

    useEffect(() => {
        // Check active sessions and sets the user
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            const currentUser = session?.user ?? null
            setUser(currentUser)

            if (currentUser) {
                await fetchUserRole(currentUser.id)
            } else {
                setUserRole(null)
            }

            setLoading(false)
        }

        getSession()

        // Listen for changes on auth state (login, logout, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            const currentUser = session?.user ?? null
            setUser(currentUser)

            if (currentUser) {
                await fetchUserRole(currentUser.id)
            } else {
                setUserRole(null)
            }

            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [])

    const signOut = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setUserRole(null)
    }

    // Computed value for admin check
    const isAdmin = userRole === 'admin'

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

