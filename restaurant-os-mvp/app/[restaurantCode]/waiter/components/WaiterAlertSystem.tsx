'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { OrderService } from '@/services/orders.service';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { CheckCheck, BellRing, X, ArrowRightLeft, Users, Phone, LayoutGrid } from "lucide-react";
import { getServiceRequestDetails, preloadServiceOptions, subscribeServiceOptionsCache, parseRequesterMeta, cleanDisplayNote } from '@/lib/service-utils';
import { alertCountStore, haptic, springSoft, Spinner } from './ui';
import { isVideoUrl } from '@/components/shared/homepage/ServiceCard';
import WaiterOverloadModal from './WaiterOverloadModal';

// Same sound asset as the Flutter APK (assets/sounds/alert.mp3)
const ALERT_SOUND_URL = '/sounds/alert.mp3';

interface ServiceRequest {
    id: number;
    table_id: number;
    tables: {
        table_number: string;
        assigned_waiter_id?: string | null;
        co_waiter_ids?: string[] | null;
    };
    request_type: string;
    request_status: string;
    created_at: string;
    quantity?: number;
    notes?: string | null;
    assigned_waiter_id?: string;
}


/* ── Table-access / Handover dialog (Flutter TableAccessRequestSheet parity) ── */
function TableAccessAlert({ request, onApprove, onDecline, onDismiss }: {
    request: ServiceRequest & { count: number; ids?: number[] };
    onApprove: (transferType: 'share' | 'transfer') => Promise<void> | void;
    onDecline: () => Promise<void> | void;
    onDismiss: () => void;
}) {
    const [transferMode, setTransferMode] = useState<'share' | 'transfer'>('share');
    const [submitting, setSubmitting] = useState<'approve' | 'decline' | null>(null);

    const requester = parseRequesterMeta(request.notes);
    const cleanNote = cleanDisplayNote(request.notes);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={springSoft}
            className="relative w-[92vw] max-w-[370px] bg-white rounded-[28px] shadow-2xl p-5 overflow-hidden"
            style={{
                border: '2px solid #6366F1',
                boxShadow: '0 0 0 3px rgba(99,102,241,0.12), 0 24px 48px -12px rgba(99,102,241,0.28)',
            }}
        >
            {/* Ambient decorative gradient */}
            <div className="absolute -top-16 -right-16 size-36 bg-gradient-to-br from-indigo-100 to-indigo-50/20 rounded-full blur-2xl pointer-events-none -z-10" />

            {/* Header: Badge + Status + Dismiss */}
            <div className="flex items-center justify-between mb-3.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-[11px] font-black tracking-wide">
                    <ArrowRightLeft size={13} className="text-indigo-600" />
                    TABLE ACCESS REQUEST
                </span>
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200/80 text-amber-700 text-[10px] font-extrabold uppercase tracking-wider">
                        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Pending
                    </span>
                    <button
                        onClick={() => { haptic.light(); onDismiss(); }}
                        aria-label="Dismiss"
                        className="size-7 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>

            {/* Target Table Hero Card */}
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-indigo-50/70 border border-indigo-100/90 mb-3.5">
                <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-white shadow-xs border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <LayoutGrid size={18} />
                    </div>
                    <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600/80">Target Table</p>
                        <h4 className="text-base font-black text-slate-900 leading-tight">
                            Table {request.tables?.table_number || '—'}
                        </h4>
                    </div>
                </div>
                <span className="px-2 py-0.5 rounded-lg bg-white/90 text-slate-600 text-[10px] font-extrabold border border-indigo-100/70 shrink-0">
                    Assigned to You
                </span>
            </div>

            {/* Requester Profile Card */}
            <div className="rounded-2xl bg-slate-50/90 border border-slate-200/80 p-3.5 mb-3.5">
                <div className="flex items-center gap-3">
                    {/* Avatar with Initials Fallback */}
                    <div className="relative size-12 rounded-2xl overflow-hidden shrink-0 bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-black text-lg shadow-sm">
                        {requester.requester_avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={requester.requester_avatar}
                                alt={requester.requester_name}
                                className="size-full object-cover"
                            />
                        ) : (
                            <span>{requester.requester_name.charAt(0).toUpperCase() || 'W'}</span>
                        )}
                        <span className="absolute bottom-0.5 right-0.5 size-2.5 bg-emerald-500 rounded-full border-2 border-white" />
                    </div>

                    {/* Requester Details */}
                    <div className="min-w-0 flex-1">
                        <span className="inline-block px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 text-[9px] font-black uppercase tracking-wider">
                            Requesting Waiter
                        </span>
                        <h3 className="text-base font-black text-slate-900 tracking-tight truncate leading-snug">
                            {requester.requester_name}
                        </h3>
                        {requester.requester_mobile && (
                            <p className="flex items-center gap-1 text-xs font-semibold text-slate-500 mt-0.5">
                                <Phone size={11} className="text-indigo-500" />
                                {requester.requester_mobile}
                            </p>
                        )}
                    </div>
                </div>

                {/* Friendly explanation text */}
                <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 text-xs text-slate-600 leading-relaxed">
                    <span className="font-bold text-slate-800">{requester.requester_name}</span> has requested permission to manage Table {request.tables?.table_number}.
                    {cleanNote && (
                        <p className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200/80 italic text-slate-700 text-[11px]">
                            &ldquo;{cleanNote}&rdquo;
                        </p>
                    )}
                </div>
            </div>

            {/* Permission Mode Selector */}
            <div className="mb-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 px-0.5">
                    Select Permission Type
                </p>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/70">
                    <button
                        type="button"
                        onClick={() => { haptic.selection(); setTransferMode('share'); }}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-black transition-all ${
                            transferMode === 'share'
                                ? 'bg-white text-indigo-700 shadow-xs border border-indigo-100'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <Users size={13} />
                        Co-Waiter (Share)
                    </button>
                    <button
                        type="button"
                        onClick={() => { haptic.selection(); setTransferMode('transfer'); }}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-black transition-all ${
                            transferMode === 'transfer'
                                ? 'bg-white text-indigo-700 shadow-xs border border-indigo-100'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        <ArrowRightLeft size={13} />
                        Full Handover
                    </button>
                </div>

                {/* Dynamic guidance text */}
                <p className="text-[11px] text-slate-500 mt-2 px-1 leading-snug">
                    {transferMode === 'share' ? (
                        <span className="flex items-start gap-1">
                            <span className="text-emerald-600 font-bold">✓</span>
                            <span><strong>Shared Access:</strong> Both you and {requester.requester_name} can take orders, add items, and attend to Table {request.tables?.table_number}.</span>
                        </span>
                    ) : (
                        <span className="flex items-start gap-1">
                            <span className="text-amber-600 font-bold">⚠️</span>
                            <span><strong>Full Handover:</strong> Table {request.tables?.table_number} & active orders will be completely transferred to {requester.requester_name}.</span>
                        </span>
                    )}
                </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5">
                <button
                    type="button"
                    disabled={submitting !== null}
                    onClick={async () => {
                        setSubmitting('decline');
                        try {
                            await onDecline();
                        } finally {
                            setSubmitting(null);
                        }
                    }}
                    className="flex-1 h-12 rounded-[14px] bg-white border border-slate-300 text-slate-700 text-xs font-bold active:scale-[0.97] hover:bg-slate-50 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
                >
                    {submitting === 'decline' ? <Spinner className="size-4 border-slate-400 border-t-slate-700" /> : 'Decline'}
                </button>

                <button
                    type="button"
                    disabled={submitting !== null}
                    onClick={async () => {
                        setSubmitting('approve');
                        try {
                            await onApprove(transferMode);
                        } finally {
                            setSubmitting(null);
                        }
                    }}
                    className="flex-[1.8] h-12 rounded-[14px] bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-black shadow-[0_4px_14px_rgba(79,70,229,0.35)] active:scale-[0.97] transition-all disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                >
                    {submitting === 'approve' ? (
                        <Spinner className="size-4 text-white" />
                    ) : transferMode === 'share' ? (
                        <>
                            <CheckCheck size={16} />
                            Approve (Share)
                        </>
                    ) : (
                        <>
                            <ArrowRightLeft size={15} />
                            Approve & Transfer
                        </>
                    )}
                </button>
            </div>
        </motion.div>
    );
}

/* ── Service-request dialog (Flutter IncomingRequestAlertSheet) ── */
function IncomingRequestAlert({ request, details, onAccept, onDismiss }: {
    request: ServiceRequest & { count: number };
    details: { label: string; icon: any; image?: string | null; color: string };
    onAccept: () => Promise<void> | void;
    onDismiss: () => void;
}) {
    const [submitting, setSubmitting] = useState(false);
    const Icon = details.icon;
    const cleanNote = cleanDisplayNote(request.notes);
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={springSoft}
            className="relative w-[88vw] max-w-[340px] bg-white rounded-[28px] shadow-2xl p-5"
            style={{ border: '2px solid #FF6B35', boxShadow: '0 0 0 3px rgba(255,107,53,0.1), 0 24px 48px -12px rgba(255,107,53,0.25)' }}
        >
            <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-w-brand-soft text-w-brand text-[11px] font-black tracking-wide">
                    <BellRing size={13} /> NEW SERVICE REQUEST
                </span>
                <button onClick={() => { haptic.light(); onDismiss(); }} aria-label="Dismiss" className="size-8 rounded-full hover:bg-w-canvas flex items-center justify-center text-w-muted">
                    <X size={17} />
                </button>
            </div>

            <div className="flex items-center gap-4">
                <div className="size-[72px] rounded-[18px] bg-[#F1F5F9] overflow-hidden shrink-0 flex items-center justify-center">
                    {details.image ? (
                        isVideoUrl(details.image) ? (
                            <video
                                src={encodeURI(details.image)}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="size-full object-cover pointer-events-none"
                            />
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={details.image} alt="" className="size-full object-cover" />
                        )
                    ) : (
                        <span className={details.color}><Icon size={30} /></span>
                    )}
                </div>
                <div className="min-w-0">
                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-w-border text-[11px] font-extrabold text-w-ink mb-1.5">
                        Table {request.tables?.table_number}
                    </span>
                    <h3 className="text-xl font-black text-w-ink tracking-tight leading-tight">{details.label}</h3>
                    {request.count > 1 && (
                        <p className="text-sm font-bold text-w-brand mt-0.5">Quantity: {request.count}</p>
                    )}
                    {cleanNote && <p className="text-xs italic text-w-ink-soft mt-1">Note: {cleanNote}</p>}
                </div>
            </div>

            <div className="flex gap-2.5 mt-5">
                <button
                    disabled={submitting}
                    onClick={() => { haptic.light(); onDismiss(); }}
                    className="flex-1 h-12 rounded-[14px] bg-white border-[1.5px] border-w-border-strong text-w-ink-soft text-sm font-bold active:scale-[0.97] transition-transform disabled:opacity-50"
                >
                    Dismiss
                </button>
                <button
                    disabled={submitting}
                    onClick={async () => {
                        setSubmitting(true);
                        haptic.success();
                        try {
                            await onAccept();
                        } finally {
                            setSubmitting(false);
                        }
                    }}
                    className="flex-[2] h-12 rounded-[14px] bg-w-brand text-white text-sm font-extrabold shadow-[0_4px_12px_rgba(255,107,53,0.35)] active:scale-[0.97] transition-transform inline-flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    {submitting ? (
                        <Spinner className="size-4 text-white" />
                    ) : (
                        <>
                            <CheckCheck size={18} /> Accept Request
                        </>
                    )}
                </button>
            </div>
        </motion.div>
    );
}

/* ── System root (logic identical to previous build) ─────────── */
export default function WaiterAlertSystem() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const [alerts, setAlerts] = useState<ServiceRequest[]>([]);
    const [hiddenRequests, setHiddenRequests] = useState<Set<number>>(new Set());
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const isFirstLoad = useRef(true);
    const params = useParams();
    const staffMobile = params?.staffMobile as string;
    const [currentWaiter, setCurrentWaiter] = useState<any>(null);

    useEffect(() => {
        let active = true;
        try {
            const cached = localStorage.getItem('waiterSession');
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed?.id) setCurrentWaiter(parsed);
            }
        } catch (_) {}

        const fetchWaiter = async () => {
            if (restaurantId && staffMobile) {
                try {
                    const waiter = await OrderService.getStaffByMobile(staffMobile, restaurantId);
                    if (active && waiter) setCurrentWaiter(waiter);
                } catch (err) {
                    console.error('[WaiterAlertSystem] Failed to fetch waiter profile:', err);
                }
            }
        };
        fetchWaiter();
        return () => { active = false; };
    }, [restaurantId, staffMobile]);

    useEffect(() => {
        audioRef.current = new Audio(ALERT_SOUND_URL);
        audioRef.current.load();
    }, []);

    useEffect(() => {
        if (!restaurantId) return;
        preloadServiceOptions(restaurantId);
        const sub = subscribeServiceOptionsCache(restaurantId);
        return () => {
            sub.unsubscribe();
        };
    }, [restaurantId]);



    useEffect(() => {
        let active = true;
        let debounceTimer: NodeJS.Timeout;

        const fetchAlerts = async () => {
            if (!restaurantId || !active || !currentWaiter?.id) return;
            try {
                const activeRequests = await OrderService.fetchActiveServiceRequests(restaurantId, currentWaiter.id);
                if (active && activeRequests) {
                    setAlerts((prev) => {
                        const completing = prev.filter((req) => req.request_status === 'completed');
                        const completingIds = new Set(completing.map((r) => r.id));
                        const activeFiltered = activeRequests.filter((req: any) => !completingIds.has(req.id));
                        return [...activeFiltered, ...completing];
                    });
                }
            } catch (err: any) {
                const msg = String(err?.message || err);
                if (!msg.toLowerCase().includes('failed to fetch')) {
                    console.error('[WaiterAlertSystem] Failed to fetch alerts:', msg);
                }
            }
        };

        const debouncedRefresh = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (active) fetchAlerts();
            }, 1000);
        };

        if (!restaurantLoading && currentWaiter?.id) fetchAlerts();
        if (!restaurantId || !currentWaiter?.id) return;

        const sub = OrderService.subscribeToServiceRequests(
            restaurantId,
            () => {
                isFirstLoad.current = false;
                debouncedRefresh();
            },
            currentWaiter.id,
        );

        /* 25s silent polling — realtime handles instant updates */
        const poll = setInterval(() => {
            if (active) fetchAlerts();
        }, 25000);

        return () => {
            active = false;
            clearTimeout(debounceTimer);
            clearInterval(poll);
            if (sub) sub.unsubscribe();
        };
    }, [restaurantId, restaurantLoading, currentWaiter?.id]);



    const handleDismissGroup = async (requestIds: number[]) => {
        setHiddenRequests((prev) => {
            const next = new Set(prev);
            requestIds.forEach((id) => next.add(id));
            return next;
        });
    };

    const handleAcceptGroup = async (requestIds: number[]) => {
        if (!restaurantId || !currentWaiter?.id) return;
        setAlerts((prev) =>
            prev.map((alert) => (requestIds.includes(alert.id) ? { ...alert, request_status: 'accepted' } : alert)),
        );
        try {
            await Promise.all(requestIds.map((id) => OrderService.acceptServiceRequest(id, restaurantId, currentWaiter.id)));
        } catch (err: any) {
            console.error('Failed to accept some requests:', err);
            try {
                const activeRequests = await OrderService.fetchActiveServiceRequests(restaurantId, currentWaiter.id);
                if (activeRequests) setAlerts(activeRequests);
            } catch (fetchErr) {
                console.error('Failed to revert optimistic update:', fetchErr);
            }
            if (!err?.message?.includes('already been accepted')) {
                toast.error(err.message || 'Failed to accept service request.');
            }
        }
    };

    const handleServedGroup = async (requestIds: number[]) => {
        if (!restaurantId) return;
        setAlerts((prev) =>
            prev.map((alert) => (requestIds.includes(alert.id) ? { ...alert, request_status: 'completed' } : alert)),
        );
        try {
            await Promise.all(requestIds.map((id) => OrderService.completeServiceRequest(id, restaurantId, currentWaiter?.id)));
            setTimeout(() => {
                setAlerts((prev) => prev.filter((alert) => !requestIds.includes(alert.id)));
            }, 1500);
        } catch (err: any) {
            console.error('Failed to complete requests:', err?.message);
            if (currentWaiter?.id) {
                const activeRequests = await OrderService.fetchActiveServiceRequests(restaurantId, currentWaiter.id).catch(() => null);
                if (activeRequests) setAlerts(activeRequests);
            }
            toast.error(err.message || 'Failed to complete service request.');
        }
    };

    const visibleAlerts = alerts.filter((req) => {
        if (hiddenRequests.has(req.id)) return false;
        // Kitchen order-ready popups are handled exclusively by OrderReadyModal
        if (req.request_type === 'order_ready') return false;

        // Strict waiter routing check:
        if (!currentWaiter?.id) return false;
        const waiterIdLower = String(currentWaiter.id).toLowerCase();
        const reqAssigned = req.assigned_waiter_id ? String(req.assigned_waiter_id).toLowerCase() : null;
        const tableAssigned = req.tables?.assigned_waiter_id ? String(req.tables.assigned_waiter_id).toLowerCase() : null;
        const coWaiters: string[] = Array.isArray(req.tables?.co_waiter_ids)
            ? req.tables.co_waiter_ids.map((c: any) => String(c).toLowerCase())
            : [];

        // For table access request, only the primary table owner can receive & approve it
        if (req.request_type === 'table_access_request') {
            return reqAssigned === waiterIdLower || tableAssigned === waiterIdLower;
        }

        // For customer service requests: must be primary assigned waiter or approved co-waiter
        const isAssigned = (reqAssigned === waiterIdLower) || (tableAssigned === waiterIdLower) || coWaiters.includes(waiterIdLower);
        if (!isAssigned) return false;

        return true;
    });

    /* BottomNav badge feed — strictly count only alerts assigned to this waiter */
    const pendingCount = visibleAlerts.filter((a) => a.request_status !== 'completed').length;
    useEffect(() => {
        alertCountStore.set(pendingCount);
    }, [pendingCount]);

    /* Audio alert — strictly trigger only on visible alerts for this waiter */
    const prevAlertIds = useRef<Set<number>>(new Set());
    useEffect(() => {
        const currentIds = new Set(visibleAlerts.map((a) => a.id));
        const hasNewAlert = visibleAlerts.some((a) => !prevAlertIds.current.has(a.id));

        if (hasNewAlert && !isFirstLoad.current) {
            haptic.heavy();
            const playPromise = audioRef.current?.play();
            if (playPromise !== undefined) {
                playPromise.catch((error) => {
                    console.warn('Audio playback failed:', error);
                });
            }
        }

        prevAlertIds.current = currentIds;
        if (visibleAlerts.length > 0) isFirstLoad.current = false;
    }, [visibleAlerts]);

    const groupedAlerts = Object.values(
        visibleAlerts.reduce((acc, alert) => {
            const key = `${alert.table_id}-${alert.request_type}-${alert.request_status}`;
            if (!acc[key]) acc[key] = { ...alert, count: 0, ids: [] };
            acc[key].count += alert.quantity || 1;
            acc[key].ids.push(alert.id);
            return acc;
        }, {} as Record<string, ServiceRequest & { count: number; ids: number[] }>),
    ).filter((r) => r.request_status === 'pending');

    const topAlert = groupedAlerts[groupedAlerts.length - 1];

    return (
        <>
        <AnimatePresence>
            {topAlert && restaurantId && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-black/40">
                    {topAlert.request_type === 'table_access_request' ? (
                        <TableAccessAlert
                            key={topAlert.id}
                            request={topAlert}
                            onApprove={async (transferType) => {
                                const approverId = currentWaiter?.id || currentWaiter?.employee_id || staffMobile;
                                if (!approverId) {
                                    toast.error('Staff profile still loading, please try again.');
                                    return;
                                }
                                haptic.success();
                                handleDismissGroup(topAlert.ids);
                                try {
                                    for (const id of topAlert.ids) {
                                        await OrderService.approveTableAccess(id, approverId, transferType);
                                    }
                                    const meta = parseRequesterMeta(topAlert.notes);
                                    if (transferType === 'transfer') {
                                        toast.success(`Table ${topAlert.tables?.table_number || ''} transferred to ${meta.requester_name}`);
                                    } else {
                                        toast.success(`Shared Table ${topAlert.tables?.table_number || ''} with ${meta.requester_name}`);
                                    }
                                } catch (err: any) {
                                    console.error('Failed to approve table access:', err);
                                    toast.error(err.message || 'Failed to approve table access');
                                    if (currentWaiter?.id && restaurantId) {
                                        const refreshed = await OrderService.fetchActiveServiceRequests(restaurantId, currentWaiter.id).catch(() => null);
                                        if (refreshed) setAlerts(refreshed);
                                    }
                                }
                            }}
                            onDecline={async () => {
                                const declinerId = currentWaiter?.id || currentWaiter?.employee_id || staffMobile;
                                if (!declinerId) {
                                    toast.error('Staff profile still loading, please try again.');
                                    return;
                                }
                                haptic.light();
                                handleDismissGroup(topAlert.ids);
                                try {
                                    for (const id of topAlert.ids) {
                                        await OrderService.declineTableAccess(id, declinerId);
                                    }
                                    toast.info(`Declined table access request for Table ${topAlert.tables?.table_number || ''}`);
                                } catch (err: any) {
                                    console.error('Failed to decline table access:', err);
                                    toast.error(err.message || 'Failed to decline request');
                                    if (currentWaiter?.id && restaurantId) {
                                        const refreshed = await OrderService.fetchActiveServiceRequests(restaurantId, currentWaiter.id).catch(() => null);
                                        if (refreshed) setAlerts(refreshed);
                                    }
                                }
                            }}
                            onDismiss={() => handleDismissGroup(topAlert.ids)}
                        />
                    ) : (
                        <IncomingRequestAlert
                            key={topAlert.id}
                            request={topAlert}
                            details={getServiceRequestDetails(topAlert.request_type, restaurantId || undefined)}
                            onAccept={async () => {
                                handleDismissGroup(topAlert.ids);
                                await handleAcceptGroup(topAlert.ids);
                                toast.success(`Accepted request from Table ${topAlert.tables?.table_number}`);
                            }}
                            onDismiss={() => handleDismissGroup(topAlert.ids)}
                        />
                    )}

                    {groupedAlerts.length > 1 && (
                        <div className="absolute bottom-8 w-num text-white/60 text-xs font-bold bg-black/50 px-4 py-2 rounded-full backdrop-blur">
                            +{groupedAlerts.length - 1} more alert{groupedAlerts.length > 2 ? 's' : ''}
                        </div>
                    )}
                </div>
            )}
        </AnimatePresence>
        <WaiterOverloadModal waiterRecord={currentWaiter} />
        </>
    );
}

