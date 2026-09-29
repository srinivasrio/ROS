'use client';

import { ReactNode } from 'react';

export default function DeliveryLayout({ children }: { children: ReactNode }) {
    return (
        <div className="min-h-screen bg-[#e8edf5] dark:bg-[#15181e] text-slate-800 dark:text-slate-100 antialiased selection:bg-orange-500/20">
            {children}
        </div>
    );
}
