'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ChefHat, Lock, Mail, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function SuperAdminLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('superadmin@dineinone.com');
    const [password, setPassword] = useState('Admin@12345');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !password) {
            toast.error('Please enter both email and password');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Authenticated as Super Admin! Redirecting...');
                router.push('/');
                router.refresh();
            } else {
                toast.error(data.error || 'Authentication failed');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error connecting to server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 px-4 py-12 selection:bg-sky-500 selection:text-white">
            <div className="relative w-full max-w-md">
                {/* Ambient glow backdrop */}
                <div className="absolute -top-16 -left-16 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl" />
                <div className="absolute -bottom-16 -right-16 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />

                <div className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/80 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                    {/* Header */}
                    <div className="text-center">
                        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600/20 text-sky-400 border border-sky-500/30 shadow-inner mb-4">
                            <ChefHat className="h-7 w-7" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Dine In One</h1>
                        <div className="mt-1.5 flex items-center justify-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-400 border border-sky-500/20">
                                <ShieldCheck className="h-3 w-3" /> Super Admin Portal
                            </span>
                        </div>
                        <p className="mt-3 text-xs text-slate-400">
                            Enterprise platform administration, tenant onboarding & statutory KYC controls.
                        </p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLogin} className="mt-7 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                Super Admin Email
                            </label>
                            <div className="relative">
                                <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="superadmin@dineinone.com"
                                    className="h-11 w-full rounded-xl border border-slate-700/80 bg-slate-800/60 pl-10 pr-4 text-sm text-white placeholder-slate-500 shadow-inner focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                Password
                            </label>
                            <div className="relative">
                                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••••••"
                                    className="h-11 w-full rounded-xl border border-slate-700/80 bg-slate-800/60 pl-10 pr-4 text-sm text-white placeholder-slate-500 shadow-inner focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
                                />
                            </div>
                        </div>

                        {/* Demo autofill button */}
                        <div className="flex items-center justify-between pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setEmail('superadmin@dineinone.com');
                                    setPassword('Admin@12345');
                                    toast.info('Super Admin demo credentials loaded');
                                }}
                                className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                            >
                                <Sparkles className="h-3 w-3" /> Use demo credentials
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 font-semibold text-white shadow-lg shadow-sky-600/20 hover:bg-sky-500 hover:shadow-sky-500/30 disabled:opacity-50 transition-all cursor-pointer"
                        >
                            {loading ? (
                                <>
                                    <RefreshCw className="h-4 w-4 animate-spin" /> Authenticating...
                                </>
                            ) : (
                                <>
                                    Enter Super Admin Portal <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Footer */}
                    <div className="mt-8 border-t border-slate-800/80 pt-4 text-center">
                        <p className="text-[11px] text-slate-500">
                            Protected by cryptographic token session & role enforcement.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
