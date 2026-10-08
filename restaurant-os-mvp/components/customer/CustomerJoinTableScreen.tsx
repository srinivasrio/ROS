'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, Loader2, CheckCircle2, XCircle, ArrowRight, ShieldCheck, Utensils } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface CustomerJoinTableScreenProps {
    restaurantId: string;
    tableNumber: string;
    customerName: string;
    customerMobile: string;
    sessionId: string;
    hostName: string;
    initialRequestId?: string | null;
    initialStatus?: 'pending' | 'rejected' | 'none';
    onApproved: () => void;
}

export function CustomerJoinTableScreen({
    restaurantId,
    tableNumber,
    customerName,
    customerMobile,
    sessionId,
    hostName,
    initialRequestId = null,
    initialStatus = 'none',
    onApproved,
}: CustomerJoinTableScreenProps) {
    const [state, setState] = useState<'prompt' | 'pending' | 'rejected'>(
        initialStatus === 'pending' ? 'pending' : initialStatus === 'rejected' ? 'rejected' : 'prompt'
    );
    const [requestId, setRequestId] = useState<string | null>(initialRequestId);
    const [submitting, setSubmitting] = useState(false);

    // Request to join
    const handleRequestJoin = async () => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/customer/table-session/join-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    restaurantId,
                    tableNumber,
                    requesterName: customerName,
                    requesterMobile: customerMobile,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setRequestId(data.requestId);
                if (data.status === 'approved') {
                    toast.success('Your table access is approved!');
                    onApproved();
                } else if (data.status === 'rejected') {
                    setState('rejected');
                } else {
                    setState('pending');
                    toast.info(`Join request sent to ${hostName || 'Table Host'}!`);
                }
            } else {
                const errData = await res.json().catch(() => null);
                toast.error(errData?.error || 'Failed to send request');
            }
        } catch (err) {
            toast.error('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // Realtime listener and polling when pending
    useEffect(() => {
        if (state !== 'pending' || !requestId) return;

        // Poll every 2 seconds
        const pollTimer = setInterval(async () => {
            try {
                const res = await fetch(`/api/customer/table-session/join-request?requestId=${encodeURIComponent(requestId)}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'approved') {
                        toast.success('Your request was approved! Welcome to dining.');
                        onApproved();
                    } else if (data.status === 'rejected') {
                        setState('rejected');
                    }
                }
            } catch (err) {
                console.error('Polling join request error:', err);
            }
        }, 2000);

        // Supabase Realtime
        const channelName = `join-status-${requestId}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'table_join_requests',
                    filter: `id=eq.${requestId}`,
                },
                (payload) => {
                    const row = payload.new as any;
                    if (row?.status === 'approved') {
                        toast.success('Your request was approved! Welcome to dining.');
                        onApproved();
                    } else if (row?.status === 'rejected') {
                        setState('rejected');
                    }
                }
            )
            .subscribe();

        return () => {
            clearInterval(pollTimer);
            supabase.removeChannel(channel);
        };
    }, [state, requestId, onApproved]);

    return (
        <div className="fixed inset-0 z-50 bg-[#EEF2F6] flex items-center justify-center p-4 font-sans text-slate-800">
            <div
                className="w-full max-w-md rounded-3xl p-7 sm:p-8 text-center flex flex-col items-center"
                style={{
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.12), 0 1px 3px rgba(15, 23, 42, 0.05)',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                }}
            >
                {state === 'prompt' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full flex flex-col items-center"
                    >
                        <div className="size-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-lg shadow-amber-500/10">
                            <Users size={30} />
                        </div>

                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-700 text-xs font-black uppercase tracking-wider mb-3">
                            <span>Active Table Session</span>
                        </div>

                        <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
                            Table {tableNumber} is Occupied
                        </h2>

                        <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed max-w-xs">
                            This table currently has an active dining session hosted by <span className="font-bold text-slate-800">{hostName}</span>.
                        </p>

                        <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left mb-6 space-y-2">
                            <p className="text-xs font-bold text-slate-700">Joining this table lets you:</p>
                            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                                <li>View the live digital menu together</li>
                                <li>Place shared or individual dishes on Table {tableNumber}</li>
                                <li>Keep orders synchronized with your group</li>
                            </ul>
                        </div>

                        <button
                            type="button"
                            disabled={submitting}
                            onClick={handleRequestJoin}
                            className="w-full py-4 rounded-2xl font-black text-sm tracking-wide bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {submitting ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <>
                                    <span>Request to Join Table {tableNumber}</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </motion.div>
                )}

                {state === 'pending' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full flex flex-col items-center"
                    >
                        <div className="size-16 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-500 mb-4 shadow-lg shadow-orange-500/10">
                            <Loader2 size={32} className="animate-spin" />
                        </div>

                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-black uppercase tracking-wider mb-3">
                            <span>Waiting for Host</span>
                        </div>

                        <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
                            Request Sent to {hostName}
                        </h2>

                        <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed max-w-xs">
                            A real-time prompt has appeared on the host&rsquo;s phone. As soon as they tap <span className="font-bold text-emerald-600">Approve</span>, your table menu will load automatically.
                        </p>

                        <div className="w-full p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-left">
                            <Loader2 size={20} className="animate-spin text-amber-600 shrink-0" />
                            <p className="text-xs text-amber-900 font-semibold leading-snug">
                                Waiting for live approval from {hostName}...
                            </p>
                        </div>
                    </motion.div>
                )}

                {state === 'rejected' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full flex flex-col items-center"
                    >
                        <div className="size-16 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500 mb-4 shadow-lg shadow-rose-500/10">
                            <XCircle size={32} />
                        </div>

                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-wider mb-3">
                            <span>Request Declined</span>
                        </div>

                        <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
                            Unable to Join Table {tableNumber}
                        </h2>

                        <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed max-w-xs">
                            The table host declined your request to join this session. If you are sitting at a different table, please scan that table&rsquo;s QR code.
                        </p>

                        <button
                            type="button"
                            onClick={() => {
                                window.location.href = `/${restaurantId}/customer`;
                            }}
                            className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all text-sm cursor-pointer shadow-lg"
                        >
                            Scan Another Table QR
                        </button>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
