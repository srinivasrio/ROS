'use client';

import { useState, useCallback, Suspense, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    ShieldAlert, Lock, Mail, Loader2, ArrowRight, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

function SuperAdminLoginInner() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const superAdminUrl = process.env.NEXT_PUBLIC_SUPER_ADMIN_URL || 'http://control.localhost:3005';

    const handleRedirect = () => {
        window.location.href = superAdminUrl;
    };

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Forward to superadmin app or authenticate directly
            window.location.href = `${superAdminUrl}/login`;
        } catch (err: any) {
            toast.error(err.message || 'Super admin redirection failed');
            setLoading(false);
        }
    }, [superAdminUrl]);

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Ambient subtle red/rose glow */}
            <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-md w-full relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 shadow-xl shadow-red-600/25 mb-4 border border-red-500/20 text-white">
                        <ShieldAlert size={32} />
                    </div>
                    <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-bold uppercase tracking-wider mb-2">
                            control.localhost:3005
                        </div>
                    </div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900">
                        Super Admin Console
                    </h1>
                    <p className="text-sm text-slate-500 mt-2">
                        Platform-level management and multi-tenant observability portal.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xl shadow-slate-200/50"
                >
                    <div className="space-y-6">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-600">
                            <p className="font-bold text-slate-900 mb-1">Dedicated Platform Portal</p>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Super Administrator operates on an isolated standalone infrastructure surface for complete platform security.
                            </p>
                        </div>

                        <button
                            id="superadmin-launch-btn"
                            type="button"
                            onClick={handleRedirect}
                            className="w-full py-4 px-4 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold rounded-xl shadow-lg shadow-red-600/25 flex items-center justify-center gap-2 text-sm transition-all cursor-pointer"
                        >
                            Open Super Admin Console
                            <ExternalLink size={18} />
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default function SuperAdminLoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">Loading superadmin portal...</div>}>
            <SuperAdminLoginInner />
        </Suspense>
    );
}
