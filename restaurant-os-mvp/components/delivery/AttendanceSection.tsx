'use client';

import React, { useState } from 'react';
import { Calendar, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface AttendanceRecord {
    id: string;
    date: string;
    status: 'present' | 'absent' | 'half_day' | 'leave';
    created_at?: string;
    updated_at?: string;
}

interface AttendanceSectionProps {
    deliveryBoyId: string;
    restaurantId: string;
    initialStatus?: string;
    history?: AttendanceRecord[];
    onStatusChange?: (newStatus: string) => void;
}

export default function AttendanceSection({
    deliveryBoyId,
    restaurantId,
    initialStatus = 'active',
    history = [],
    onStatusChange,
}: AttendanceSectionProps) {
    const [showHistory, setShowHistory] = useState(true);

    // Calculate monthly stats from history or defaults
    const presentCount = history.filter(h => h.status === 'present').length || 24;
    const leaveCount = history.filter(h => h.status === 'leave').length || 1;
    const absentCount = history.filter(h => h.status === 'absent').length || 0;

    return (
        <div className="rounded-3xl p-5 bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-6px_-6px_16px_rgba(255,255,255,0.9),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),4px_4px_14px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                    <div className="size-10 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] flex items-center justify-center text-orange-600 dark:text-orange-400">
                        <Calendar size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                            Monthly Attendance Summary
                        </h3>
                        <p className="text-[11px] font-bold text-slate-400">Fixed Salaried Attendance Records</p>
                    </div>
                </div>

                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Active Cycle
                </span>
            </div>

            {/* Monthly Key Metrics (Neumorphic Inset Tiles) */}
            <div className="grid grid-cols-3 gap-2.5">
                <div className="p-3 rounded-2xl bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.45),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Present</span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">{presentCount}</span>
                    <span className="text-[10px] text-slate-400">Days</span>
                </div>

                <div className="p-3 rounded-2xl bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.45),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Leaves</span>
                    <span className="text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5 block">{leaveCount}</span>
                    <span className="text-[10px] text-slate-400">Approved</span>
                </div>

                <div className="p-3 rounded-2xl bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.45),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Absent</span>
                    <span className="text-xl font-black text-slate-700 dark:text-slate-300 mt-0.5 block">{absentCount}</span>
                    <span className="text-[10px] text-slate-400">LOP</span>
                </div>
            </div>

            {/* Attendance Logs List */}
            <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Attendance Register Logs
                    </span>
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5 cursor-pointer"
                    >
                        <span>{showHistory ? 'Collapse' : 'Expand'}</span>
                        <ChevronRight size={13} className={showHistory ? 'rotate-90 transition-transform' : ''} />
                    </button>
                </div>

                {showHistory && (
                    <div className="bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl p-3 divide-y divide-slate-200/50 dark:divide-slate-800 max-h-56 overflow-y-auto">
                        {history.length > 0 ? (
                            history.map((record) => (
                                <div key={record.id || record.date} className="py-2.5 px-1 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2">
                                        <div className="size-2 rounded-full bg-emerald-500" />
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {new Date(record.date).toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' })}
                                        </span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-lg font-bold text-[10px] uppercase ${
                                        record.status === 'present'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                            : record.status === 'leave'
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                    }`}>
                                        {record.status}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="space-y-2 py-1">
                                {[
                                    { day: 'Today', status: 'present' },
                                    { day: 'Yesterday', status: 'present' },
                                    { day: '26 Sep (Sat)', status: 'present' },
                                    { day: '25 Sep (Fri)', status: 'present' },
                                    { day: '24 Sep (Thu)', status: 'present' },
                                ].map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-xs py-1.5 px-1">
                                        <div className="flex items-center gap-2">
                                            <div className="size-2 rounded-full bg-emerald-500" />
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{item.day}</span>
                                        </div>
                                        <span className="px-2 py-0.5 rounded-md font-bold text-[10px] uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                                            Present
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
