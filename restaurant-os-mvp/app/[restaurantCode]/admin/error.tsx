'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[AdminErrorBoundary] Caught unhandled exception:', error);
    }, [error]);

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 rounded-3xl p-8 text-center shadow-xl shadow-black/5">
                <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-black text-neutral-900 dark:text-white mb-2">
                    Something went wrong
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-6 leading-relaxed">
                    A temporary interface issue occurred while loading this administrative view. Your data is safe.
                </p>
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => reset()}
                        className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-orange-600/20"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Try Again</span>
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-neutral-700 dark:text-neutral-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        </div>
    );
}
