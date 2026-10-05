'use client';

import { useState, useEffect } from 'react';
import { Clock as LucideClock, AlertTriangle, Flame } from 'lucide-react';

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
    const isWarning = !isOverdue && timeLeft < 120;
    const absTime = Math.abs(timeLeft);
    const mins = Math.floor(absTime / 60);
    const secs = absTime % 60;
    const formattedTime = `${isOverdue ? '-' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

    return (
        <div suppressHydrationWarning className={`flex items-center gap-1 shrink-0 ${className}`}>
            <div
                suppressHydrationWarning
                className={`px-1.5 py-0.5 rounded font-mono font-black text-[9px] flex items-center gap-1 border transition-all duration-300 shadow-2xs ${
                    isOverdue
                        ? 'text-rose-700 bg-rose-50 border-rose-200'
                        : isWarning
                        ? 'text-amber-800 bg-amber-50 border-amber-200'
                        : 'text-emerald-700 bg-emerald-50 border-emerald-200/80'
                }`}
            >
                {isOverdue ? (
                    <AlertTriangle size={10} className="shrink-0 text-rose-600 animate-bounce" />
                ) : isWarning ? (
                    <Flame size={10} className="shrink-0 text-amber-600 animate-pulse" />
                ) : (
                    <LucideClock size={10} className="shrink-0 text-emerald-600" />
                )}

                <div className="flex items-center gap-0.5">
                    {isOverdue && <span className="text-[8px] font-black tracking-wider text-rose-600">OVERDUE</span>}
                    <span suppressHydrationWarning className="tracking-tight">{formattedTime}</span>
                </div>
            </div>

            {showControls && onExtend && (
                <div className="flex items-center gap-0.5">
                    {[1, 2, 5].map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onExtend(m);
                            }}
                            className="text-[8px] font-bold bg-white hover:bg-orange-50 hover:text-orange-700 text-slate-700 px-1 py-0.2 rounded border border-slate-200 shadow-2xs hover:border-orange-300 active:scale-95 transition-all"
                            title={`Extend by ${m} minute${m > 1 ? 's' : ''}`}
                        >
                            +{m}m
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
