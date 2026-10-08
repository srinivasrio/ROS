'use client';

import React, { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export default function CustomerSlugError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[CustomerSlugError] Client-side exception caught:', error);
    }, [error]);

    return (
        <div className="min-h-[80dvh] flex items-center justify-center p-6 bg-slate-50 font-sans text-slate-800">
            <div className="max-w-md w-full bg-white border border-slate-100 rounded-3xl p-8 text-center shadow-xl">
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-orange-50 border border-orange-100 text-orange-600 flex items-center justify-center shadow-md shadow-orange-500/10">
                    <AlertCircle className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2">
                    Something went wrong
                </h2>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                    A temporary display issue occurred while loading this page. Your order and dining session remain safe.
                </p>
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => reset()}
                        className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-orange-600/20 active:scale-95"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Try Again</span>
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95"
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        </div>
    );
}
