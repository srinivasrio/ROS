'use client';

import React from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { TimeRange } from '@/app/services/analytics';

interface TimeFilterProps {
    value: TimeRange;
    onChange: (range: TimeRange) => void;
    onCustomRange?: (start: Date, end: Date) => void;
}

export const TimeFilter: React.FC<TimeFilterProps> = ({ value, onChange }) => {
    const options: { label: string; value: TimeRange }[] = [
        { label: 'Today', value: 'today' },
        { label: 'Yesterday', value: 'yesterday' },
        { label: 'Last 7 Days', value: '7d' },
        { label: 'Last 30 Days', value: '30d' },
        { label: 'Custom Range', value: 'custom' },
    ];

    return (
        <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-1 shadow-sm">
            {options.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                        value === opt.value
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
            
            {value === 'custom' && (
                <div className="flex items-center gap-2 ml-2 px-3 py-2 text-sm text-zinc-500 border-l border-zinc-200 dark:border-zinc-800">
                    <Calendar className="w-4 h-4" />
                    <span>Select Dates</span>
                    <ChevronDown className="w-4 h-4" />
                </div>
            )}
        </div>
    );
};
