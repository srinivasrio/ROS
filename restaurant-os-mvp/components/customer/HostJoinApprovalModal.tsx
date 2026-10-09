'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, UserPlus, Check, X, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface HostJoinApprovalModalProps {
    restaurantId: string;
    restaurantSlug?: string;
    tableNumber: string;
}

interface PendingJoinRequest {
    id: string;
    session_id: string;
    table_number: string;
    requester_customer_name: string;
    requester_customer_mobile: string;
    status: string;
    created_at: string;
}

export function HostJoinApprovalModal({
    restaurantId,
    restaurantSlug,
    tableNumber,
}: HostJoinApprovalModalProps) {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [pendingRequests, setPendingRequests] = useState<PendingJoinRequest[]>([]);
    const [respondingId, setRespondingId] = useState<string | null>(null);

    const getHostMobile = useCallback(() => {
        try {
            let m = localStorage.getItem(`ros_customer_mobile_${restaurantId}`) || 
                    (restaurantSlug ? localStorage.getItem(`ros_customer_mobile_${restaurantSlug}`) : '') || '';
            if (!m && typeof window !== 'undefined') {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('ros_customer_mobile_')) {
                        const val = localStorage.getItem(k);
                        if (val) {
                            m = val;
                            break;
                        }
                    }
                }
            }
            return m.replace(/\D/g, '').slice(-10);
        } catch {
            return '';
        }
    }, [restaurantId, restaurantSlug]);

    // Check active session and if this device is the host
    const checkHostStatus = useCallback(async () => {
        const mobile = getHostMobile();
        if (!mobile || !restaurantId || !tableNumber) return;

        try {
            const res = await fetch(
                `/api/customer/table-session/active?restaurantId=${encodeURIComponent(restaurantId)}&tableNumber=${encodeURIComponent(tableNumber)}&customerMobile=${encodeURIComponent(mobile)}`
            );
            if (res.ok) {
                const data = await res.json();
                if (data.hasActiveSession && data.isHost) {
                    setSessionId(data.sessionId);
                    setIsHost(true);
                } else {
                    setIsHost(false);
                }
            }
        } catch (err) {
            console.error('[HostJoinApproval] Error checking host status:', err);
        }
    }, [restaurantId, tableNumber, getHostMobile]);

    // Fetch pending requests for this session
    const fetchPendingRequests = useCallback(async (sid: string) => {
        const mobile = getHostMobile();
        if (!mobile || !sid) return;

        try {
            const res = await fetch(
                `/api/customer/table-session/pending-requests?sessionId=${encodeURIComponent(sid)}&hostMobile=${encodeURIComponent(mobile)}`
            );
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.requests)) {
                    setPendingRequests(data.requests);
                }
            }
        } catch (err) {
            console.error('[HostJoinApproval] Error fetching pending requests:', err);
        }
    }, [getHostMobile]);

    useEffect(() => {
        checkHostStatus();
    }, [checkHostStatus]);

    // Set up Realtime listener & polling when confirmed as Host
    useEffect(() => {
        if (!isHost || !sessionId) return;

        fetchPendingRequests(sessionId);

        // Supabase Realtime channel
        const channelName = `table-join-requests-${sessionId}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'table_join_requests',
                    filter: `session_id=eq.${sessionId}`,
                },
                (payload) => {
                    const row = payload.new as PendingJoinRequest;
                    if (row) {
                        if (row.status === 'pending') {
                            setPendingRequests((prev) => {
                                const exists = prev.some((r) => r.id === row.id);
                                if (exists) {
                                    return prev.map((r) => (r.id === row.id ? row : r));
                                }
                                toast.info(`New guest "${row.requester_customer_name}" requested to join Table ${tableNumber}!`);
                                return [...prev, row];
                            });
                        } else {
                            // Request was approved or rejected; remove from pending
                            setPendingRequests((prev) => prev.filter((r) => r.id !== row.id));
                        }
                    }
                }
            )
            .subscribe();

        // 2.5-second polling fallback
        const pollTimer = setInterval(() => {
            fetchPendingRequests(sessionId);
        }, 2500);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(pollTimer);
        };
    }, [isHost, sessionId, tableNumber, fetchPendingRequests]);

    const handleRespond = async (requestId: string, action: 'approve' | 'reject') => {
        const mobile = getHostMobile();
        if (!mobile || respondingId) return;

        setRespondingId(requestId);
        try {
            const res = await fetch('/api/customer/table-session/respond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId,
                    action,
                    hostMobile: mobile,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(
                    action === 'approve'
                        ? `Approved ${data.requesterName} to join your table!`
                        : `Declined request from ${data.requesterName}.`
                );
                setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
            } else {
                const errData = await res.json().catch(() => null);
                toast.error(errData?.error || 'Failed to update request');
            }
        } catch (err) {
            toast.error('Network error. Please try again.');
        } finally {
            setRespondingId(null);
        }
    };

    if (!isHost || pendingRequests.length === 0) {
        return null;
    }

    const currentRequest = pendingRequests[0];
    const maskedGuestMobile = `+91 ******${currentRequest.requester_customer_mobile.slice(-4)}`;

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
                {/* Icon header */}
                <div className="size-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-lg shadow-amber-500/10">
                    <UserPlus size={28} />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100/70 border border-amber-200 text-amber-800 text-[11px] font-black uppercase tracking-wider mb-2">
                    <Users size={12} />
                    <span>Table Join Request</span>
                </div>

                <h3 className="text-xl font-black text-slate-900 mb-1 tracking-tight">
                    {currentRequest.requester_customer_name}
                </h3>
                <p className="text-xs font-bold text-slate-500 mb-2">
                    Mobile: {maskedGuestMobile}
                </p>

                <p className="text-xs text-slate-600 mb-6 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    Wants to join your session at <span className="font-black text-slate-900">Table {tableNumber}</span>. If you approve, they can view the live menu and add items alongside you.
                </p>

                {/* Approve / Reject buttons */}
                <div className="grid grid-cols-2 gap-3 w-full">
                    <button
                        type="button"
                        disabled={respondingId === currentRequest.id}
                        onClick={() => handleRespond(currentRequest.id, 'reject')}
                        className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-700 font-bold text-xs transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        <X size={15} />
                        <span>Decline</span>
                    </button>

                    <button
                        type="button"
                        disabled={respondingId === currentRequest.id}
                        onClick={() => handleRespond(currentRequest.id, 'approve')}
                        className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                    >
                        {respondingId === currentRequest.id ? (
                            <Loader2 size={15} className="animate-spin" />
                        ) : (
                            <>
                                <Check size={15} />
                                <span>Approve</span>
                            </>
                        )}
                    </button>
                </div>

                {pendingRequests.length > 1 && (
                    <p className="text-[10px] text-slate-400 mt-3 font-semibold">
                        +{pendingRequests.length - 1} more pending request(s)
                    </p>
                )}
            </div>
        </div>
    );
}
