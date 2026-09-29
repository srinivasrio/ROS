'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, ShieldCheck, ArrowRight, Server, RefreshCw } from 'lucide-react';

const SUPER_ADMIN_URL = process.env.NEXT_PUBLIC_SUPER_ADMIN_URL || 'http://localhost:3005';

export default function SuperAdminRedirectPage() {
    const [secondsLeft, setSecondsLeft] = useState(3);
    const [isOnline, setIsOnline] = useState<boolean | null>(null);

    // Check if the standalone super admin server on port 3005 is online
    useEffect(() => {
        let isMounted = true;
        const checkHealth = async () => {
            try {
                const res = await fetch(`${SUPER_ADMIN_URL}/api/auth/login`, {
                    method: 'GET',
                    mode: 'no-cors'
                });
                if (isMounted) setIsOnline(true);
            } catch {
                if (isMounted) setIsOnline(false);
            }
        };

        checkHealth();

        // Countdown auto-redirect
        const timer = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    window.location.href = SUPER_ADMIN_URL;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, []);

    return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-6 text-slate-100">
            <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-2xl text-center">
                {/* Brand Badge */}
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 shadow-lg shadow-amber-500/20 ring-4 ring-white/10">
                    <ShieldCheck className="h-8 w-8" />
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3.5 py-1 text-xs font-semibold text-amber-300 mb-3">
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    Dedicated Standalone Portal
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                    Super Admin Moved to Port 3005
                </h1>

                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                    The Dine In One Super Admin panel has been decoupled from the restaurant customer/admin website into its own standalone platform for enhanced security and independent scaling.
                </p>

                {/* Server Status Card */}
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4 mb-6 text-left">
                    <div className="flex items-center justify-between text-xs mb-2">
                        <span className="flex items-center gap-2 text-slate-300 font-medium">
                            <Server className="h-4 w-4 text-sky-400" />
                            Standalone Super Admin Service
                        </span>
                        <span className="font-mono text-slate-400">Port 3005</span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                        <span className="text-slate-400">Target Address:</span>
                        <a 
                            href={SUPER_ADMIN_URL}
                            className="font-mono text-amber-400 hover:underline flex items-center gap-1"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {SUPER_ADMIN_URL}
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                </div>

                {/* Launch Button & Counter */}
                <div className="space-y-3">
                    <a
                        href={SUPER_ADMIN_URL}
                        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3.5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-amber-500 transition-all cursor-pointer font-medium"
                    >
                        Launch Super Admin Portal
                        <ArrowRight className="h-4 w-4" />
                    </a>

                    <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                        <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />
                        Redirecting in {secondsLeft} seconds...
                    </p>
                </div>

                {/* CLI Help */}
                <div className="mt-6 pt-6 border-t border-white/10 text-xs text-slate-400 text-left space-y-1.5">
                    <p className="font-semibold text-slate-300">To run the standalone portal locally:</p>
                    <div className="rounded-xl bg-black/40 px-3 py-2 font-mono text-[11px] text-amber-300 select-all">
                        npm run dev:superadmin
                    </div>
                </div>
            </div>
        </div>
    );
}
