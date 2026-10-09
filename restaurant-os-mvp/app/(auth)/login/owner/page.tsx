'use client';

import { useState, useCallback, Suspense, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    ShieldCheck, Eye, EyeOff, Loader2, ArrowRight, Lock, Mail, Sparkles
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { setDineToken } from '@/lib/supabase';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { DineInOneWaveLogo } from '@/components/auth/DineInOneWaveLogo';

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

    useEffect(() => {
        if (errorParam && errorMessages[errorParam]) {
            showWarningPopup({
                title: errorParam === 'session_expired' ? 'Session Expired' : 'Access Restricted',
                message: errorMessages[errorParam],
                type: 'warning',
                dismissText: 'Understand'
            });
        }
    }, [errorParam]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanId = identifier.trim();
        if (!cleanId || !password) {
            showWarningPopup({
                title: 'Missing Credentials',
                message: 'Please enter both your email and password.',
                type: 'warning'
            });
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: cleanId.includes('@') ? cleanId : undefined,
                    mobile: !cleanId.includes('@') ? cleanId : undefined,
                    identifier: cleanId,
                    password,
                    panel: 'owner',
                    portal: 'owner',
                    role: 'owner'
                })
            });

            const data = await res.json();
            if (!res.ok) {
                showWarningPopup({
                    title: 'Authentication Failed',
                    message: data.error || 'Invalid owner credentials.',
                    type: 'warning'
                });
                return;
            }

            if (data.token) {
                setDineToken(data.token);
            }

            toast.success('Welcome back, Owner!');
            const targetUrl = searchParams.get('redirect') || data.redirectUrl || '/owner/branches';
            window.location.href = targetUrl;
        } catch (err: any) {
            showWarningPopup({
                title: 'Connection Error',
                message: 'Failed to connect to authentication service.',
                type: 'warning'
            });
        } finally {
            setLoading(false);
        }
    }, [identifier, password, searchParams]);

    return (
        <AuthBackground className="min-h-screen py-10 px-4 flex flex-col justify-center items-center">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                {/* Dine In One Wave Animated Logo above card */}
                <div className="text-center mb-6 flex flex-col items-center">
                    <DineInOneWaveLogo size="lg" />
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-slate-200/80 text-[10px] font-black text-indigo-700 uppercase tracking-widest shadow-xs backdrop-blur-md">
                        <Sparkles size={11} className="text-indigo-600" />
                        <span>Owner Enterprise Portal</span>
                    </div>
                </div>

                {/* Pure White Crisp Login Card */}
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                    <div className="mb-6">
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                            Owner Sign In
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Access multi-branch analytics, finances, and enterprise controls.
                        </p>
                    </div>

                    {errorParam && (
                        <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-600 font-semibold">
                            {errorMessages[errorParam] || 'Authentication error. Please sign in again.'}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
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
                                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
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
                                    className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl text-sm font-black shadow-lg shadow-indigo-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
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

                    {/* Quick Launch */}
                    <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                        <p className="text-[11px] text-slate-400 mb-2.5">Development Quick Access:</p>
                        <a
                            href="/api/auth/owner/quick-access"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 rounded-xl transition-all border border-slate-200"
                        >
                            <Sparkles size={13} className="text-indigo-500" />
                            1-Click Authenticate & Open Dashboard
                        </a>
                    </div>
                </div>

                <p className="text-center text-[11px] text-slate-500 mt-6 flex items-center justify-center gap-1.5 font-medium">
                    <ShieldCheck size={14} className="text-emerald-500" /> End-to-end cryptographic tenant isolation active
                </p>
            </motion.div>
        </AuthBackground>
    );
}

export default function OwnerLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
            <OwnerLoginInner />
        </Suspense>
    );
}
