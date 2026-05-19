'use client';

import { useState, useEffect } from 'react';
import { Clock as LucideClock } from 'lucide-react';

interface CountdownTimerProps {
    estimatedEnd?: string;
    status: string;
    className?: string;
    onExtend?: (mins: number) => void;
    showControls?: boolean;
}

export default function CountdownTimer({ estimatedEnd, status, className = '', onExtend, showControls = false }: CountdownTimerProps) {
    const [timeLeft, setTimeLeft] = useState<number | null>(null);

    useEffect(() => {
        if (status !== 'preparing' || !estimatedEnd) {
            setTimeLeft(null);
            return;
        }

        const update = () => {
            const target = new Date(estimatedEnd).getTime();
            const now = Date.now();
            setTimeLeft(Math.floor((target - now) / 1000));
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [estimatedEnd, status]);

    if (timeLeft === null) return null;

    const isOverdue = timeLeft < 0;
    const absTime = Math.abs(timeLeft);
    const mins = Math.floor(absTime / 60);
    const secs = absTime % 60;
    
    let colorClass = 'text-emerald-600 bg-emerald-50/50 border-emerald-100 shadow-[0_2px_10px_-3px_rgba(16,185,129,0.1)]';
    if (isOverdue) {
        colorClass = 'text-rose-600 bg-rose-50 border-rose-200 shadow-[0_2px_12px_-3px_rgba(225,29,72,0.2)] animate-pulse';
    } else if (timeLeft < 120) {
        colorClass = 'text-amber-600 bg-amber-50 border-amber-200 shadow-[0_2px_10px_-3px_rgba(245,158,11,0.15)]';
    }

    return (
        <div className={`flex flex-col items-end gap-1.5 shrink-0 max-w-full ${className}`}>
            <div className={`px-2 py-0.5 rounded-lg font-mono font-black text-[8px] flex items-center gap-1 border transition-colors duration-500 ${colorClass} uppercase tracking-tight whitespace-nowrap overflow-hidden`}>
                <LucideClock size={8} className={isOverdue ? 'animate-spin-slow shrink-0' : 'shrink-0'} />
                <span className="flex items-center gap-0.5 min-w-0">
                    {isOverdue && <span className="hidden xs:inline">OVERDUE</span>}
                    {isOverdue ? '-' : ''}{mins}m {secs}s
                </span>
            </div>
            {showControls && onExtend && (
                <div className="flex gap-1">
                    {[1, 2, 5, 10].map(m => (
                        <button 
                            key={m}
                            onClick={(e) => { e.stopPropagation(); onExtend(m); }}
                            className="text-[7px] font-bold bg-white hover:bg-neutral-900 hover:text-white text-black px-1.5 py-0.5 rounded-md border border-neutral-200/60 shadow-sm transition-all active:scale-90 hover:border-neutral-900"
                        >
                            +{m}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
