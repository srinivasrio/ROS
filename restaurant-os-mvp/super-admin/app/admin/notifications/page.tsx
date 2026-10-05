'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    Bell,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Shield,
    CreditCard,
    Building2,
    GitBranch,
    Headset,
    ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
            }
        } catch (err) {
            console.error('Failed to load notifications:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const markAllRead = async () => {
        try {
            const res = await fetch('/api/admin/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAllRead: true }),
            });
            if (res.ok) {
                toast.success('All notifications marked as read.');
                fetchNotifications();
            }
        } catch (err) {
            toast.error('Failed to mark read');
        }
    };

    const getIcon = (type: string) => {
        const t = (type || '').toUpperCase();
        switch (t) {
            case 'NEW_BRANCH':
                return <GitBranch size={16} className="text-cyan-600" />;
            case 'NEW_SUBSCRIPTION':
                return <CreditCard size={16} className="text-emerald-600" />;
            case 'SUPPORT_TICKET':
                return <Headset size={16} className="text-rose-600" />;
            case 'SECURITY_ALERT':
                return <Shield size={16} className="text-amber-600" />;
            default:
                return <Building2 size={16} className="text-indigo-600" />;
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-[#172033]">
                        Notification Center
                    </h1>
                    <p className="text-xs text-[#667085] mt-1 font-medium">
                        Real-time alerts regarding new tenant signups, payment confirmations, and critical operational events.
                    </p>
                </div>
                <button
                    onClick={markAllRead}
                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-neutral-50 text-[#172033] border border-[#E4E7EC] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span>Mark All Read</span>
                </button>
            </div>

            {/* Notifications Feed */}
            <div className="bg-white rounded-3xl border border-[#E4E7EC] shadow-xs divide-y divide-[#E4E7EC] overflow-hidden">
                {loading ? (
                    <div className="py-12 text-center text-neutral-400">
                        <div className="inline-block h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-2" />
                        <p className="font-semibold text-xs">Loading notifications feed...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="py-16 text-center text-neutral-400">
                        <Bell size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="font-bold text-xs text-[#172033]">You are completely caught up!</p>
                        <p className="text-[11px] text-[#667085] mt-1">No pending operational alerts.</p>
                    </div>
                ) : (
                    notifications.map((n) => (
                        <div
                            key={n.id}
                            className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
                                !n.is_read ? 'bg-indigo-50/30' : 'hover:bg-[#F5F7FC]/70'
                            }`}
                        >
                            <div className="flex items-start gap-3.5 min-w-0">
                                <div className="p-2.5 rounded-xl bg-white border border-[#E4E7EC] shadow-2xs shrink-0 mt-0.5">
                                    {getIcon(n.type)}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm text-[#172033]">{n.title}</p>
                                        {!n.is_read && (
                                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                                        )}
                                    </div>
                                    <p className="text-xs text-[#667085] mt-1 leading-relaxed">{n.message}</p>
                                    <span className="text-[10px] text-neutral-400 font-medium mt-2 inline-block">
                                        {new Date(n.created_at).toLocaleString('en-IN', {
                                            day: 'numeric',
                                            month: 'short',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                </div>
                            </div>

                            {n.link && (
                                <Link
                                    href={n.link}
                                    className="px-3 py-1.5 rounded-xl bg-white border border-[#E4E7EC] hover:border-indigo-300 text-indigo-700 text-xs font-bold transition-all shadow-2xs shrink-0 flex items-center gap-1"
                                >
                                    <span>Inspect</span>
                                    <ExternalLink size={12} />
                                </Link>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
