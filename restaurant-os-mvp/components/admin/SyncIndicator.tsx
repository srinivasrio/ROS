'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

export interface SyncIndicatorProps {
    isRevalidating?: boolean;
    isSyncing?: boolean;
    lastSync?: Date | null;
    onRefresh?: () => void | Promise<void>;
    label?: string;
    className?: string;
}

/**
 * Subtle Background Sync Indicator.
 * Replaces intrusive full-screen loading spinners by letting the user know
 * fresh data is synchronizing silently in the background while they interact with cached UI.
 * Can also serve as a manual trigger for cache-refresh.
 */
export function SyncIndicator({
    isRevalidating,
    isSyncing,
    lastSync,
    onRefresh,
    label = 'Syncing...',
    className = ''
}: SyncIndicatorProps) {
    const active = Boolean(isSyncing || isRevalidating);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const timeString = mounted && lastSync ? lastSync.toLocaleTimeString() : null;
    const titleText = timeString ? `Last synced: ${timeString} (Click to refresh)` : 'Refresh section';

    return (
        <div className="flex items-center gap-1.5" suppressHydrationWarning>
            <AnimatePresence>
                {active && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 backdrop-blur-sm shadow-xs ${className}`}
                    >
                        <RefreshCw size={11} className="animate-spin text-orange-500" />
                        <span>{label}</span>
                    </motion.div>
                )}
            </AnimatePresence>

            {onRefresh && !active && (
                <button
                    onClick={() => onRefresh()}
                    title={titleText}
                    suppressHydrationWarning
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    aria-label="Refresh data"
                >
                    <RefreshCw size={13} />
                </button>
            )}
        </div>
    );
}

export default SyncIndicator;
