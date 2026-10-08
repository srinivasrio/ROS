'use client';

import { useState, useCallback, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, ShieldAlert, Sparkles } from 'lucide-react';
import { showWarningPopup } from '@/components/shared/WarningPopupCard';
import { AuthBackground } from '@/components/auth/AuthBackground';
import { DineInOneWaveLogo } from '@/components/auth/DineInOneWaveLogo';

function SuperAdminLoginInner() {
    const superAdminUrl = process.env.NEXT_PUBLIC_SUPER_ADMIN_URL || 'http://control.localhost:3005';

    const handleRedirect = () => {
        try {
            window.location.href = superAdminUrl;
        } catch (err: any) {
            showWarningPopup({
                title: 'Connection Notice',
                message: err?.message || 'Could not redirect to Super Admin Console.',
                type: 'warning'
            });
        }
    };

    return (
        <AuthBackground className="min-h-screen py-10 px-4 flex flex-col justify-center items-center">
            <div className="max-w-md w-full relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-6 flex flex-col items-center"
                >
                    <DineInOneWaveLogo size="lg" />
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/80 border border-slate-200/80 text-rose-700 text-xs font-black uppercase tracking-wider shadow-xs backdrop-blur-md">
                        <ShieldAlert size={12} className="text-rose-600" />
                        <span>Platform Super Admin</span>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white border border-slate-100 rounded-3xl p-7 sm:p-8 shadow-2xl relative overflow-hidden"
                >
                    <div className="mb-6">
                        <h2 className="text-2xl font-black tracking-tight text-slate-900">
                            Super Admin Console
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            Platform-level multi-tenant management and infrastructure observability.
                        </p>
                    </div>

                    <div className="space-y-5">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-600">
                            <p className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                                <Sparkles size={14} className="text-rose-500" />
                                Dedicated Platform Surface
                            </p>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Super Administrator operates on an isolated standalone infrastructure surface for absolute multi-tenant platform security.
                            </p>
                        </div>

                        <button
                            id="superadmin-launch-btn"
                            type="button"
                            onClick={handleRedirect}
                            className="w-full py-4 px-4 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-black rounded-2xl shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
                        >
                            Open Super Admin Console
                            <ExternalLink size={18} />
                        </button>
                    </div>
                </motion.div>
            </div>
        </AuthBackground>
    );
}

export default function SuperAdminLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading superadmin portal...</div>}>
            <SuperAdminLoginInner />
        </Suspense>
    );
}
