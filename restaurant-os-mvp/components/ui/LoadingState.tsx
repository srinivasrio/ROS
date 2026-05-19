import React from 'react';
import { motion } from 'framer-motion';

interface LoadingStateProps {
    message?: string;
    fullScreen?: boolean;
}

export function LoadingState({ message = 'Loading...', fullScreen = false }: LoadingStateProps) {
    const containerClasses = fullScreen 
        ? "h-screen flex items-center justify-center bg-[#FDFCFD] dark:bg-zinc-950" 
        : "h-full min-h-[50vh] flex items-center justify-center bg-[#FDFCFD] dark:bg-zinc-950 w-full rounded-3xl";

    return (
        <div className={containerClasses}>
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-5 bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-sm border border-neutral-100 dark:border-zinc-800"
            >
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-orange-100 dark:border-orange-500/10 rounded-full" />
                    <div className="w-12 h-12 border-4 border-orange-500 rounded-full border-t-transparent animate-spin absolute top-0 left-0" />
                </div>
                <p className="text-zinc-600 dark:text-zinc-400 font-medium tracking-wide">{message}</p>
            </motion.div>
        </div>
    );
}
