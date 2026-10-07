'use client';

import { useState, useCallback, Suspense, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    Eye, EyeOff, Loader2, ArrowRight, Lock, Mail, Building2, KeyRound
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { setDineToken } from '@/lib/supabase';
import { resetSessionExpiryState } from '@/lib/session-manager';
import { DineInOneLogo } from '@/components/shared/DineInOneLogo';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';

function AdminLoginInner() {
    const searchParams = useSearchParams();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [pin, setPin] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPin, setShowPin] = useState(false);
    const [loading, setLoading] = useState(false);

    const errorParam = searchParams.get('error');
    const errorMessages: Record<string, string> = {
        session_expired: 'Your admin session has expired. Please sign in again.',
        unauthorized_panel: 'You do not have administrative privileges to access this panel.',
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
        const cleanPin = pin.trim();

        if (!cleanId) {
            showWarningPopup({
                title: 'Missing Identifier',
                message: 'Mobile number or Email is compulsory to login.',
                type: 'warning'
            });
            return;
        }
        if (!password) {
            showWarningPopup({
                title: 'Missing Password',
                message: 'Password is compulsory to login.',
                type: 'warning'
            });
            return;
        }
        if (!cleanPin) {
            showWarningPopup({
                title: 'Missing PIN',
                message: 'Security PIN (4-6 digits) is compulsory to login.',
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
                    pin: cleanPin
                })
            });

            const data = await res.json();

            if (!res.ok) {
                const errMsg = data.error || 'Authentication failed. Please check your credentials.';
                showWarningPopup({
                    title: 'Authentication Failed',
                    message: errMsg,
                    type: 'error',
                    dismissText: 'Try Again'
                });
                return;
            }

            if (data.token) {
                setDineToken(data.token, 'admin');
                resetSessionExpiryState();
            }
            toast.success('Admin authentication successful! Redirecting...');

            const redirectParam = searchParams.get('redirect');
            const redirectUrl = (redirectParam && redirectParam.startsWith('/')) 
                ? redirectParam 
                : (data.redirectUrl || '/');
            window.location.href = redirectUrl;

        } catch (err: any) {
            const errMsg = err?.message || 'Login failed. Please check your credentials.';
            showWarningPopup({
                title: 'Authentication Failed',
                message: errMsg,
                type: 'error',
                dismissText: 'Try Again'
            });
        } finally {
            setLoading(false);
        }
    }, [identifier, password, pin, searchParams]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Ambient subtle pastel gradients */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-md w-full relative z-10">
                {/* Brand Header */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <DineInOneLogo size={64} className="mx-auto mb-4" />
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold uppercase tracking-wider mb-2">
                            <Building2 size={12} />
                            admin.dineinone.com
                        </div>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">
                        Restaurant Admin Portal
                    </h1>
                    <p className="text-sm text-slate-500 mt-2">
                        Enter your Mobile Number or Email, Password, and Security PIN to sign in.
                    </p>
                </motion.div>

                {/* Login Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xl shadow-slate-200/50"
                >
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Mobile Number or Email */}
                        <div>
                            <label
                                htmlFor="admin-email-input"
                                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
                            >
                                Mobile Number or Email *
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <Mail size={18} />
                                </div>
                                <input
                                    id="admin-email-input"
                                    type="text"
                                    autoComplete="username"
                                    required
                                    placeholder="e.g. 9876543210 or admin@restaurant.com"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all font-medium"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label
                                htmlFor="admin-password-input"
                                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
                            >
                                Password *
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <Lock size={18} />
                                </div>
                                <input
                                    id="admin-password-input"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Security PIN */}
                        <div>
                            <label
                                htmlFor="admin-pin-input"
                                className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5"
                            >
                                Security PIN (4-6 digits) *
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                                    <KeyRound size={18} />
                                </div>
                                <input
                                    id="admin-pin-input"
                                    type={showPin ? 'text' : 'password'}
                                    maxLength={6}
                                    required
                                    placeholder="•••• (4-6 digit PIN)"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                                    className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:bg-white focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 transition-all font-mono tracking-widest"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPin(!showPin)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                >
                                    {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1">
                                Set by the owner when provisioning or editing your administrator profile.
                            </p>
                        </div>

                        {/* Submit Button */}
                        <button
                            id="admin-login-submit-btn"
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 px-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Verifying admin access...
                                </>
                            ) : (
                                <>
                                    Sign In to Admin Console
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Security notice footer */}
                    <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                        <p className="text-xs text-slate-400 font-medium">
                            Strict tenant isolation active. Unauthorized administrative access attempts are audited and logged.
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default function AdminLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading admin portal...</div>}>
            <AdminLoginInner />
        </Suspense>
    );
}
