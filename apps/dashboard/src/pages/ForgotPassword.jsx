import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/update-password`,
            });

            if (error) throw error;

            setMessage('Cek email Anda untuk link reset password.');
        } catch (error) {
            console.error('Reset password error:', error);
            setError(error.message);
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
                            <span className="material-symbols-outlined text-[28px]">lock_reset</span>
                        </div>
                        <h1 className="text-2xl font-heading font-bold text-white mb-2">Lupa Password</h1>
                        <p className="text-slate-400 text-sm">Masukkan email Anda untuk mereset password</p>
                    </div>

                    {/* Messages */}
                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">error</span>
                            {error}
                        </div>
                    )}

                    {message && (
                        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">check_circle</span>
                            {message}
                        </div>
                    )}

                    {/* Form */}
                    <form className="space-y-5" onSubmit={handleResetPassword}>
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

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 mt-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    Mengirim...
                                </>
                            ) : (
                                <>
                                    <span>Kirim Link Reset</span>
                                    <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">send</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-border-dark text-center">
                        <Link to="/login" className="text-slate-400 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                            Kembali ke Login
                        </Link>
                    </div>
                </div>

                {/* Footer info */}
                <div className="text-center mt-6 text-xs text-slate-600 font-mono">
                    SECURE CONNECTION • v2.4.0
                </div>
            </div>
        </main>
    )
}

export default ForgotPassword
