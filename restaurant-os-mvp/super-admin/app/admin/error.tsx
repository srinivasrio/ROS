'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function SuperAdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('[SuperAdminErrorBoundary] Exception caught:', error);
    }, [error]);

    return (
        <div className="min-h-[70vh] flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white border border-[#E4E7EC] rounded-3xl p-8 text-center shadow-lg">
                <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-black text-[#172033] mb-2">
                    Console Exception Caught
                </h2>
                <p className="text-xs text-[#667085] mb-6 leading-relaxed">
                    A client-side rendering exception was caught safely. Refresh or retry below.
                </p>
                <div className="flex items-center justify-center gap-3">
                    <button
                        onClick={() => reset()}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Retry Section</span>
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        </div>
    );
}
