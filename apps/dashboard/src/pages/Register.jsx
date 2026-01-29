import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const Register = () => {
    const navigate = useNavigate();
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleRegister = async (e) => {
        e.preventDefault();
        setError(null);

        // Validate passwords match
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        // Validate password length
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);

        // Create user in Supabase Auth
        const { data, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    first_name: firstName,
                    last_name: lastName,
                    full_name: `${firstName} ${lastName}`,
                }
            }
        });

        if (signUpError) {
            setError(signUpError.message);
            setLoading(false);
            return;
        }

        // If successful, create user role as teknisi
        if (data.user) {
            // Insert role into user_roles table (default: teknisi)
            const { error: roleError } = await supabase
                .from('user_roles')
                .insert([
                    {
                        user_id: data.user.id,
                        role: 'teknisi',
                    }
                ]);

            if (roleError) {
                console.warn('Could not create user role:', roleError.message);
            }

            // Also create technician profile for backward compatibility
            const { error: profileError } = await supabase
                .from('technicians')
                .insert([
                    {
                        user_id: data.user.id,
                        full_name: `${firstName} ${lastName}`,
                        role: 'technician',
                    }
                ]);

            if (profileError) {
                console.warn('Could not create technician profile:', profileError.message);
            }
        }

        setLoading(false);
        setSuccess(true);

        // Redirect to login after 2 seconds
        setTimeout(() => {
            navigate('/login');
        }, 2000);
    }

    return (
        <main className="flex min-h-screen w-full bg-background-dark font-display selection:bg-primary/30 selection:text-white relative overflow-hidden items-center justify-center p-4">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0">
                <div className="absolute top-0 right-0 w-full h-[500px] bg-gradient-to-br from-primary/10 to-transparent pointer-events-none"></div>
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "24px 24px" }}></div>
            </div>

            <div className="w-full max-w-md z-10 animate-[slideIn_0.5s_ease-out]">
                <div className="bg-surface-dark border border-border-dark rounded-xl shadow-2xl overflow-hidden p-8 backdrop-blur-sm bg-opacity-95">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white mb-4">
                            <span className="material-symbols-outlined text-[24px]">person_add</span>
                        </div>
                        <h1 className="text-2xl font-heading font-bold text-white mb-2">Create Account</h1>
                        <p className="text-slate-400 text-sm">Join the Telkom Evidence platform</p>
                    </div>

                    {/* Success Message */}
                    {success && (
                        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            Account created! Redirecting to login...
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form className="space-y-4" onSubmit={handleRegister}>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">First Name</label>
                                <input
                                    type="text"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full bg-input-bg border border-border-dark text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-slate-600 transition-colors"
                                    placeholder="John"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Last Name</label>
                                <input
                                    type="text"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="w-full bg-input-bg border border-border-dark text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-slate-600 transition-colors"
                                    placeholder="Doe"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Email Address</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <span className="material-symbols-outlined text-[20px]">mail</span>
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-input-bg border border-border-dark text-white text-sm rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-slate-600 transition-colors"
                                    placeholder="name@telkom.co.id"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <span className="material-symbols-outlined text-[20px]">lock</span>
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-input-bg border border-border-dark text-white text-sm rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-slate-600 transition-colors"
                                    placeholder="Min. 6 characters"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Confirm Password</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                                    <span className="material-symbols-outlined text-[20px]">lock_reset</span>
                                </div>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full bg-input-bg border border-border-dark text-white text-sm rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary placeholder-slate-600 transition-colors"
                                    placeholder="Confirm your password"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || success}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    Creating account...
                                </>
                            ) : (
                                <span>Create Account</span>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-border-dark text-center">
                        <p className="text-slate-400 text-sm">
                            Already have an account?{' '}
                            <Link to="/login" className="text-white hover:text-primary font-medium transition-colors">Sign in</Link>
                        </p>
                    </div>
                </div>
            </div>
        </main>
    )
}

export default Register
