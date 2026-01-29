import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const Login = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Hardcoded Credential Mapping
    const CREDENTIAL_MAP = {
        'admin': {
            email: 'yoginugroho1209@gmail.com',
            // Backend password stays same as user input for simplicity or can be mapped
        },
        'user': {
            email: 'zarabetajrjr@gmail.com',
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Check if input matches a mapped username
            const mappedCreds = CREDENTIAL_MAP[username.toLowerCase()];

            // Determine email to use: mapped email OR original input (if they typed email directly)
            const emailToUse = mappedCreds ? mappedCreds.email : username;

            // 2. Attempt login with Supabase
            const { data, error } = await supabase.auth.signInWithPassword({
                email: emailToUse,
                password: password,
            });

            if (error) throw error;

            navigate('/');
        } catch (error) {
            console.error('Login error:', error);
            if (error.message === 'Invalid login credentials') {
                setError('Invalid username or password');
            } else if (error.message === 'Failed to fetch') {
                setError('Connection failed. Please check your internet connection or try again later.');
            } else {
                setError(error.message);
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="flex min-h-screen w-full bg-background-dark font-display selection:bg-primary/30 selection:text-white relative overflow-hidden items-center justify-center p-4">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "24px 24px" }}></div>
            </div>

            <div className="w-full max-w-md z-10 animate-[slideIn_0.5s_ease-out]">
                <div className="bg-surface-dark border border-border-dark rounded-xl shadow-2xl overflow-hidden p-8 backdrop-blur-sm bg-opacity-95">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary mb-4 shadow-[0_0_15px_-3px_rgba(27,152,141,0.4)]">
                            <span className="material-symbols-outlined text-[28px]">satellite_alt</span>
                        </div>
                        <h1 className="text-2xl font-heading font-bold text-white mb-2">Welcome Back</h1>
                        <p className="text-slate-400 text-sm">Sign in to Telkom Evidence Console</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form className="space-y-5" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Username</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <span className="material-symbols-outlined text-[20px]">person</span>
                                </div>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-input-bg border border-border-dark text-white text-sm rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-slate-600 transition-colors"
                                    placeholder="Enter username"
                                    required
                                    autoComplete="username"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between mb-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Password</label>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <span className="material-symbols-outlined text-[20px]">lock</span>
                                </div>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-input-bg border border-border-dark text-white text-sm rounded-lg pl-10 pr-10 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-slate-600 transition-colors"
                                    placeholder="Enter password"
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white transition-colors focus:outline-none"
                                >
                                    <span className="material-symbols-outlined text-[20px]">
                                        {showPassword ? 'visibility_off' : 'visibility'}
                                    </span>
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 mt-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </>
                            )}
                        </button>
                    </form>

                    {/* Hidden Register Link (Commented out per request to limit access) */}
                    {/* 
                    <div className="mt-6 pt-6 border-t border-border-dark text-center">
                        <p className="text-slate-400 text-sm">
                            Don't have an account?{' '}
                            <Link to="/register" className="text-white hover:text-primary font-medium transition-colors">Sign up</Link>
                        </p>
                    </div> 
                    */}
                </div>

                {/* Footer info */}
                <div className="text-center mt-6 text-xs text-slate-600 font-mono">
                    SECURE CONNECTION • v2.4.0
                </div>
            </div>
        </main>
    )
}

export default Login
