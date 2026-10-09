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
    participantCount?: number;
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
    participantCount = 1,
    initialRequestId = null,
    initialStatus = 'none',
    onApproved,
}: CustomerJoinTableScreenProps) {
    const [state, setState] = useState<'prompt' | 'pending' | 'rejected'>(
        initialStatus === 'pending' ? 'pending' : initialStatus === 'rejected' ? 'rejected' : 'prompt'
    );
    const [requestId, setRequestId] = useState<string | null>(initialRequestId);
    const [submitting, setSubmitting] = useState(false);

    // Sanitize display table number: if it's a long cryptographic token, don't show the 32-char string as title
    const isTableNumberClean = Boolean(tableNumber && tableNumber.length < 16 && tableNumber !== 'Dining');
    const displayTableNumber = isTableNumberClean ? tableNumber : '';
    const headingTitle = isTableNumberClean ? `Table ${tableNumber} is Occupied` : 'This Table is Occupied';
    const benefitTableText = isTableNumberClean ? `Table ${tableNumber}` : 'your table';

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
        <div className="fixed inset-0 z-50 bg-[#EEF2F6] flex items-center justify-center p-4 sm:p-6 font-sans text-slate-800 overflow-y-auto">
            <div
                className="w-full max-w-md rounded-3xl p-6 sm:p-8 text-center flex flex-col items-center my-auto transition-all"
                style={{
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 20px 45px rgba(15, 23, 42, 0.1), 0 4px 12px rgba(0, 0, 0, 0.04)',
                    border: '1px solid rgba(226, 232, 240, 0.9)',
                }}
            >
                {state === 'prompt' && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="w-full flex flex-col items-center"
                    >
                        {/* Top Icon Badge */}
                        <div className="size-16 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-orange-600 mb-4 shadow-md shadow-orange-500/10">
                            <Users size={28} />
                        </div>

                        {/* Status Pill */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-black uppercase tracking-wider mb-2">
                            <span className="size-2 rounded-full bg-orange-500 animate-pulse" />
                            <span>Active Table Session</span>
                        </div>

                        {/* Main Heading */}
                        <h2 className="text-2xl font-black text-slate-900 mb-1.5 tracking-tight">
                            {headingTitle}
                        </h2>

                        {/* Host & Participant info */}
                        <p className="text-xs text-slate-500 font-medium mb-5 leading-relaxed max-w-xs">
                            This table already has an active dining session hosted by <span className="font-bold text-slate-800">{hostName || 'Table Host'}</span>
                            {participantCount > 1 ? ` with ${participantCount} guests` : ''}.
                        </p>

                        {/* 3-item Benefits List */}
                        <div className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left mb-5 space-y-2.5">
                            <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                                Benefits of joining this table:
                            </p>
                            <ul className="text-xs text-slate-700 space-y-2">
                                <li className="flex items-center gap-2">
                                    <span className="size-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                                    <span>View the live digital menu together</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="size-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                                    <span>Place shared or individual dishes on {benefitTableText}</span>
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="size-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-black shrink-0">3</span>
                                    <span>Keep orders and bill synchronized with your table</span>
                                </li>
                            </ul>
                        </div>

                        {/* Notice text */}
                        <p className="text-[11px] text-slate-400 font-medium mb-4 leading-normal">
                            Your request will be sent to the table host. You can order after approval.
                        </p>

                        {/* Action Button */}
                        <button
                            type="button"
                            disabled={submitting}
                            onClick={handleRequestJoin}
                            className="w-full py-3.5 px-5 rounded-2xl font-black text-sm tracking-wide bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Sending Request...</span>
                                </>
                            ) : (
                                <>
                                    <span>Request to Join Table</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>

                        {/* Secondary table reference info */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                            <span>Table:</span>
                            <span className="font-semibold text-slate-600">
                                {isTableNumberClean ? tableNumber : `QR Session (#${tableNumber?.slice(0, 8)})`}
                            </span>
                        </div>
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

                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-xs font-black uppercase tracking-wider mb-2">
                            <span>Waiting for Host</span>
                        </div>

                        <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
                            Request Sent
                        </h2>

                        <p className="text-xs text-slate-500 font-medium mb-5 leading-relaxed max-w-xs">
                            Your join request has been sent to <span className="font-bold text-slate-800">{hostName || 'the table host'}</span>. You can order as soon as they approve.
                        </p>

                        <div className="w-full p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center gap-3 text-left mb-4">
                            <Loader2 size={20} className="animate-spin text-amber-600 shrink-0" />
                            <p className="text-xs text-amber-900 font-semibold leading-snug">
                                Waiting for live approval from {hostName || 'the host'}...
                            </p>
                        </div>

                        <button
                            type="button"
                            disabled={true}
                            className="w-full py-3.5 px-5 rounded-2xl font-black text-sm tracking-wide bg-slate-100 text-slate-500 border border-slate-200 flex items-center justify-center gap-2 cursor-not-allowed opacity-90"
                        >
                            <Loader2 size={16} className="animate-spin text-orange-500" />
                            <span>Request Sent</span>
                        </button>
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

                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-wider mb-2">
                            <span>Request Declined</span>
                        </div>

                        <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
                            Unable to Join Table {displayTableNumber}
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
