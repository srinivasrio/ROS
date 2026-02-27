'use client';

import { useState, useEffect } from 'react';

interface TimerProps {
    startTime: string;
    endTime?: string;
    className?: string;
    prefix?: string;
    variant?: 'default' | 'digital';
}

export default function Timer({ startTime, endTime, className = '', prefix = '', variant = 'default' }: TimerProps) {
    const [timeDisplay, setTimeDisplay] = useState('');

    useEffect(() => {
        const updateTime = () => {
            const start = new Date(startTime).getTime();
            const end = endTime ? new Date(endTime).getTime() : Date.now();
            const diff = Math.max(0, Math.floor((end - start) / 1000)); // Seconds

            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;

            // Format as HH:MM:SS
            const hh = hours.toString().padStart(2, '0');
            const mm = minutes.toString().padStart(2, '0');
            const ss = seconds.toString().padStart(2, '0');

            const formatted = `${hh}:${mm}:${ss}`;

            if (endTime) {
                setTimeDisplay(formatted);
            } else {
                setTimeDisplay(`${formatted} ago`);
            }
        };

        updateTime();

        // Only interval if no endTime (live ticking)
        if (!endTime) {
            const interval = setInterval(updateTime, 1000);
            return () => clearInterval(interval);
        }
    }, [startTime, endTime, variant]);

    return (
        <span className={className}>
            {prefix}{timeDisplay}
        </span>
    );
}
