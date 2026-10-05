'use client';

import { useState, useCallback, Suspense } from 'react';
import { motion } from 'framer-motion';
import {
    ShieldCheck, Eye, EyeOff, Loader2, ArrowRight, Lock, Mail, Building2, Sparkles
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { setDineToken } from '@/lib/supabase';

function OwnerLoginInner() {
    const searchParams = useSearchParams();
    const [identifier, setIdentifier] = useState(searchParams.get('email') || searchParams.get('identifier') || '');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const errorParam = searchParams.get('error');
    const errorMessages: Record<string, string> = {
        session_expired: 'Your owner session has expired. Please sign in again.',
        unauthorized_panel: 'You do not have owner privileges to access this panel.',
        restaurant_suspended: 'Your restaurant account has been suspended. Please contact support.',
        invalid_restaurant: 'Tenant mismatch: You cannot access restaurants you do not manage.'
    };

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanId = identifier.trim();
        if (!cleanId || !password) {
            toast.error('Please enter both your email and password.');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: cleanId,
                    identifier: cleanId,
                    password,
                    panel: 'owner'
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            if (data.token) {
                setDineToken(data.token);
            }

            toast.success('Owner authentication successful! Redirecting...');
            const redirectParam = searchParams.get('redirect');
            const redirectUrl = (redirectParam && redirectParam.startsWith('/'))
                ? redirectParam
                : '/owner/dashboard';
            window.location.href = redirectUrl;

        } catch (err: any) {
            toast.error(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    }, [identifier, password]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
            {/* Background Gradients */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-100/60 blur-[130px] rounded-full -mr-48 -mt-48 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-violet-100/60 blur-[110px] rounded-full -ml-32 -mb-32 pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                {/* Brand Badge */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-600 mx-auto flex items-center justify-center shadow-xl shadow-indigo-500/25 mb-4 text-white">
                        <Building2 size={26} />
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">
                        <Sparkles size={11} /> Multi-Branch Architecture
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                        Dine in One Owner Portal
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        Manage your multi-branch restaurant enterprise
                    </p>
                </div>

                {/* Login Card */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xl shadow-slate-200/50">
                    {errorParam && (
                        <div className="mb-6 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-600 font-semibold">
                            {errorMessages[errorParam] || 'Authentication error. Please sign in again.'}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Owner Email / Username
                            </label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    required
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="owner@restaurant.com"
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Password
                            </label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                >
                                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> Authenticating...
                                </>
                            ) : (
                                <>
                                    Sign In to Owner Panel <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Instant 1-Click Launch Button for Development */}
                    <div className="mt-6 pt-5 border-t border-slate-150 text-center">
                        <p className="text-[11px] text-slate-400 mb-3">Quick Development Login:</p>
                        <a
                            href="/api/auth/owner/quick-access"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 rounded-xl transition-all"
                        >
                            <Sparkles size={13} className="text-indigo-500" />
                            1-Click Authenticate & Open Dashboard
                        </a>
                    </div>
                </div>

                <p className="text-center text-[11px] text-slate-400 mt-6 flex items-center justify-center gap-1.5">
                    <ShieldCheck size={13} className="text-emerald-500" /> End-to-end cryptographic tenant isolation active
                </p>
            </motion.div>
        </div>
    );
}

export default function OwnerLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
            <OwnerLoginInner />
        </Suspense>
    );
}
