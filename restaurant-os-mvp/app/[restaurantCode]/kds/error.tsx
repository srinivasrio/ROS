'use client';

import React, { useEffect } from 'react';
import { ChefHat, RefreshCw, AlertTriangle, Home } from 'lucide-react';

export default function KDSErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[KDS Exception Caught]:', error);
    }, [error]);

    const handleClearCacheAndReload = () => {
        try {
            if (typeof window !== 'undefined') {
                // Clear any corrupted KDS and order cache keys
                const keysToRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && (k.startsWith('kds') || k.startsWith('brand') || k.startsWith('active_orders'))) {
                        keysToRemove.push(k);
                    }
                }
                keysToRemove.forEach(k => localStorage.removeItem(k));
            }
        } catch {}
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-900 font-sans">
            <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/90 shadow-xl p-6 text-center space-y-4">
                <div className="size-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                    <ChefHat size={28} />
                </div>

                <div className="space-y-1.5">
                    <h2 className="text-lg font-black uppercase tracking-tight text-slate-900">
                        Kitchen Display System
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                        The kitchen screen encountered a temporary display issue.
                    </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs font-mono text-slate-600 break-all max-h-24 overflow-y-auto">
                    {error?.message || 'Unexpected display rendering error'}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                        type="button"
                        onClick={() => reset()}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
                    >
                        <RefreshCw size={14} />
                        <span>Reload Screen</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleClearCacheAndReload}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 border border-slate-200 active:scale-95 transition-all"
                    >
                        <span>Clear Cache & Reload</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
