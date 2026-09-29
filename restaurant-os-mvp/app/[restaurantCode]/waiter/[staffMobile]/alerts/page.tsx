'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { OrderService } from '@/services/orders.service';
import { BellOff, RefreshCw, Check, CheckCheck, X, Phone } from 'lucide-react';
import { getServiceRequestDetails, preloadServiceOptions, subscribeServiceOptionsCache, parseRequesterMeta, cleanDisplayNote } from '@/lib/service-utils';
import { isVideoUrl } from '@/components/shared/homepage/ServiceCard';
import {
    AppButton, SectionLabel, SkeletonList, EmptyState, RequestTimerBadge, haptic, springSoft, useIsHydrated,
} from '../../components/ui';

interface ServiceRequest {
    id: number;
    table_id: number;
    tables: {
        table_number: string;
        assigned_waiter_id: string | null;
    };
    request_type: string;
    request_status: string;
    created_at: string;
    quantity?: number;
    notes?: string | null;
    assigned_waiter_id?: string | null;
    requester?: any;
}

const titleFor = (type: string) => {
    const map: Record<string, string> = {
        water: 'Water', cutlery: 'Cutlery', bill: 'Bill Request', bill_requested: 'Bill Request',
        call_waiter: 'Call Waiter', tissue: 'Tissue', glass: 'Extra Glass', glass_requested: 'Extra Glass',
        plate: 'Extra Plate', plate_requested: 'Extra Plate', straw: 'Straw', salt: 'Salt',
        pepper: 'Pepper', bowl: 'Finger Bowl', bowl_requested: 'Finger Bowl', sauce: 'Ketchup',
        sauce_requested: 'Ketchup', water_requested: 'Water', cutlery_requested: 'Cutlery',
        order_ready: 'Ready to Serve',
    };
    if (map[type]) return map[type];
    return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
};

// Persistent in-memory cache for instant Requests tab switching without screen reload/skeleton flash
let cachedAlertsData: {
    restaurantId: string;
    staffMobile: string;
    alerts: ServiceRequest[];
    waiterRecord: any;
} | null = null;

export default function WaiterAlerts() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const { staffMobile } = useParams();
    const isHydrated = useIsHydrated();

    const hasCache = isHydrated && Boolean(
        cachedAlertsData &&
        cachedAlertsData.restaurantId === restaurantId &&
        cachedAlertsData.staffMobile === String(staffMobile)
    );

    const [alerts, setAlerts] = useState<ServiceRequest[]>(() => hasCache ? cachedAlertsData!.alerts : []);
    const [loading, setLoading] = useState(!hasCache);
    const [refreshing, setRefreshing] = useState(false);
    const [waiterRecord, setWaiterRecord] = useState<any>(() => hasCache ? cachedAlertsData!.waiterRecord : null);
    const activeRef = useRef(true);
    const resolvedRequestIdsRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        if (restaurantId && staffMobile) {
            cachedAlertsData = {
                restaurantId,
                staffMobile: String(staffMobile),
                alerts,
                waiterRecord,
            };
        }
    }, [restaurantId, staffMobile, alerts, waiterRecord]);

    const loadAlerts = async (wRecord = waiterRecord, background = false) => {
        if (!restaurantId || !wRecord?.id) return;
        if (!background) setRefreshing(true);
        try {
            const activeRequests = await OrderService.fetchActiveServiceRequests(restaurantId, wRecord.id);
            if (activeRef.current && activeRequests) {
                setAlerts(activeRequests.filter((req: any) => !resolvedRequestIdsRef.current.has(req.id)));
            }
        } catch (error: any) {
            console.error('Failed to load alerts:', error?.message || error);
        } finally {
            if (activeRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    };

    useEffect(() => {
        activeRef.current = true;
        if (restaurantLoading || !restaurantId || !staffMobile) return;

        let sub: { unsubscribe: () => void } | null = null;
        const cacheSub = subscribeServiceOptionsCache(restaurantId);

        const initializeData = async () => {
            try {
                const waiter = await OrderService.getStaffByMobile(staffMobile as string, restaurantId);
                if (!activeRef.current) return;
                setWaiterRecord(waiter);

                if (waiter?.id) {
                    await loadAlerts(waiter, hasCache);

                    sub = OrderService.subscribeToServiceRequests(
                        restaurantId,
                        (payload) => {
                            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
                                const newStatus = (payload.new as any)?.request_status;
                                const reqId = (payload.new as any)?.id || (payload.old as any)?.id;

                                if (payload.eventType === 'UPDATE' && (newStatus === 'completed' || newStatus === 'cancelled')) {
                                    if (reqId) {
                                        resolvedRequestIdsRef.current.add(reqId);
                                        setAlerts((prev) => prev.filter((a) => a.id !== reqId));
                                    }
                                    return;
                                } else if (payload.eventType === 'DELETE') {
                                    if (reqId) setAlerts((prev) => prev.filter((a) => a.id !== reqId));
                                    return;
                                }
                                loadAlerts(waiter, true);
                            }
                        },
                        waiter.id,
                    );

                    /* 15s silent polling — realtime handles instant updates */
                    const poll = setInterval(() => loadAlerts(waiter, true), 15000);
                    (activeRef as any).poll = poll;
                } else {
                    setLoading(false);
                }

                preloadServiceOptions(restaurantId);
            } catch (error) {
                console.error('Initialization failed:', error);
                if (activeRef.current) setLoading(false);
            }
        };

        initializeData();

        return () => {
            activeRef.current = false;
            if ((activeRef as any).poll) clearInterval((activeRef as any).poll);
            if (sub) sub.unsubscribe();
            cacheSub.unsubscribe();
        };
    }, [restaurantId, restaurantLoading, staffMobile]); // eslint-disable-line react-hooks/exhaustive-deps

    /* Group duplicates (table + type + status) - strictly filtered by assigned waiter */
    const waiterIdLower = waiterRecord?.id ? String(waiterRecord.id).toLowerCase() : null;
    const assignedAlerts = alerts.filter((a) => {
        if (!waiterIdLower) return false;
        if (a.request_status !== 'pending' && a.request_status !== 'accepted') return false;

        const reqAssigned = a.assigned_waiter_id ? String(a.assigned_waiter_id).toLowerCase() : null;
        const tableAssigned = (a as any).tables?.assigned_waiter_id ? String((a as any).tables.assigned_waiter_id).toLowerCase() : null;
        const coWaiters: string[] = Array.isArray((a as any).tables?.co_waiter_ids)
            ? (a as any).tables.co_waiter_ids.map((c: any) => String(c).toLowerCase())
            : [];

        if (a.request_type === 'table_access_request') {
            return reqAssigned === waiterIdLower || tableAssigned === waiterIdLower;
        }

        const isAssigned = (reqAssigned === waiterIdLower) || (tableAssigned === waiterIdLower) || coWaiters.includes(waiterIdLower);
        return isAssigned;
    });

    const grouped = Object.values(
        assignedAlerts
            .reduce((acc, a) => {
                const key = `${a.table_id}-${a.request_type}-${a.request_status}`;
                if (!acc[key]) acc[key] = { ...a, count: 0, ids: [] };
                acc[key].count += a.quantity || 1;
                acc[key].ids.push(a.id);
                return acc;
            }, {} as Record<string, ServiceRequest & { count: number; ids: number[] }>),
    ).sort((a, b) => {
        const aReady = a.request_type === 'order_ready' ? 1 : 0;
        const bReady = b.request_type === 'order_ready' ? 1 : 0;
        if (aReady !== bReady) return bReady - aReady;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const handleAccept = async (req: ServiceRequest & { ids: number[] }) => {
        if (!waiterRecord?.id) {
            toast.error('Profile still loading — try again.');
            return;
        }
        haptic.light();
        try {
            setAlerts((prev) => prev.map((a) => (req.ids.includes(a.id) ? { ...a, request_status: 'accepted' } : a)));
            for (const id of req.ids) {
                await OrderService.acceptServiceRequest(id, String(restaurantId), waiterRecord.id);
            }
            toast.success(`Accepted request from Table ${req.tables?.table_number}`);
        } catch (error: any) {
            toast.error(error.message || 'Failed to accept request');
            loadAlerts();
        }
    };

    const handleComplete = async (req: ServiceRequest & { ids: number[] }) => {
        haptic.light();
        try {
            req.ids.forEach((id) => resolvedRequestIdsRef.current.add(id));
            setAlerts((prev) => prev.filter((a) => !req.ids.includes(a.id)));
            toast.success(`${titleFor(req.request_type)} marked as Served!`);
            await OrderService.resolveMultipleServiceRequests(req.ids, waiterRecord?.id);
        } catch (error) {
            console.error(error);
            toast.error('Failed to update status');
            req.ids.forEach((id) => resolvedRequestIdsRef.current.delete(id));
            loadAlerts();
        }
    };

    const handleApproveAccess = async (req: ServiceRequest & { ids: number[] }, transferType: 'share' | 'transfer' = 'share') => {
        if (!waiterRecord?.id) {
            toast.error('Profile still loading — try again.');
            return;
        }
        haptic.success();
        try {
            for (const id of req.ids) {
                await OrderService.approveTableAccess(id, waiterRecord.id, transferType);
            }
            toast.success(`Approved table access for Table ${req.tables?.table_number}`);
            await loadAlerts();
        } catch (error: any) {
            console.error('Failed to approve table access:', error);
            toast.error(error.message || 'Failed to approve table access');
            loadAlerts();
        }
    };

    const handleDeclineAccess = async (req: ServiceRequest & { ids: number[] }) => {
        if (!waiterRecord?.id) {
            toast.error('Profile still loading — try again.');
            return;
        }
        haptic.light();
        try {
            for (const id of req.ids) {
                await OrderService.declineTableAccess(id, waiterRecord.id);
            }
            toast.success(`Declined table access request for Table ${req.tables?.table_number}`);
            await loadAlerts();
        } catch (error: any) {
            console.error('Failed to decline table access:', error);
            toast.error(error.message || 'Failed to decline table access');
            loadAlerts();
        }
    };

    if ((loading || restaurantLoading) && alerts.length === 0) {
        return (
            <div className="min-h-full" style={{ backgroundColor: '#EEF2F6' }}>
                <header
                    className="sticky top-0 z-30 flex items-center px-4 h-14"
                    style={{
                        backgroundColor: '#EEF2F6',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.9)',
                        boxShadow: '0 2px 8px rgba(166, 180, 200, 0.2)',
                    }}
                >
                    <h1 className="flex-1 text-center text-xl font-black text-slate-800 tracking-tight">Requests</h1>
                </header>
                <div className="p-4">
                    <SkeletonList count={3} height={110} />
                </div>
            </div>
        );
    }

    if (!waiterRecord && !loading && !restaurantLoading) {
        return (
            <div className="min-h-full" style={{ backgroundColor: '#EEF2F6' }}>
                <header
                    className="sticky top-0 z-30 flex items-center px-4 h-14"
                    style={{
                        backgroundColor: '#EEF2F6',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.9)',
                        boxShadow: '0 2px 8px rgba(166, 180, 200, 0.2)',
                    }}
                >
                    <h1 className="flex-1 text-center text-xl font-black text-slate-800 tracking-tight">Requests</h1>
                </header>
                <EmptyState
                    icon={<BellOff />}
                    title="Staff Profile Not Found"
                    body="We couldn't find a staff record linked to this sign-in."
                />
            </div>
        );
    }

    return (
        <div className="min-h-full pb-24" style={{ backgroundColor: '#EEF2F6' }}>
            {/* App bar */}
            <header
                className="sticky top-0 z-30 flex items-center px-4 h-14 gap-2"
                style={{
                    backgroundColor: '#EEF2F6',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.9)',
                    boxShadow: '0 2px 8px rgba(166, 180, 200, 0.2)',
                }}
            >
                <h1 className="flex-1 text-center text-xl font-black text-slate-800 tracking-tight">Requests</h1>
                <button
                    onClick={() => loadAlerts(undefined, false)}
                    aria-label="Refresh"
                    className="size-9 -mr-1 rounded-full flex items-center justify-center text-slate-600 active:scale-90 transition-all"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '2px 2px 5px rgba(166, 180, 200, 0.4), -2px -2px 5px rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.8)',
                    }}
                >
                    <RefreshCw size={17} className={refreshing ? 'animate-spin text-w-brand' : ''} />
                </button>
            </header>

            <main className="p-4 space-y-3.5">
                {grouped.length === 0 ? (
                    <EmptyState
                        icon={<BellOff />}
                        title="All Caught Up!"
                        body="No pending requests at this time."
                    />
                ) : (
                    <AnimatePresence mode="popLayout" initial={false}>
                        {grouped.map((req) => {
                            const details = getServiceRequestDetails(req.request_type, restaurantId || undefined);
                            const isReady = req.request_type === 'order_ready';
                            const isAccepted = req.request_status === 'accepted';
                            const isAccess = req.request_type === 'table_access_request';

                            return (
                                <motion.div
                                    key={req.ids[0]}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95, y: 12 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.93, transition: { duration: 0.16 } }}
                                    transition={springSoft}
                                    className="rounded-[22px] p-4"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: '3.5px 3.5px 8px rgba(166, 180, 200, 0.38), -3.5px -3.5px 8px rgba(255, 255, 255, 0.95)',
                                        border: !isAccepted
                                            ? '1.5px solid rgba(255, 107, 53, 0.55)'
                                            : '1px solid rgba(255, 255, 255, 0.85)',
                                    }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="relative size-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center"
                                            style={{
                                                backgroundColor: '#EEF2F6',
                                                boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.4), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                                border: '1px solid rgba(255, 255, 255, 0.8)',
                                            }}
                                        >
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
                                                <span className={details.color}><details.icon size={22} /></span>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-base font-black text-slate-800 tracking-tight">{titleFor(req.request_type)}</h3>
                                                {req.count > 1 && (
                                                    <span
                                                        className="px-1.5 py-0.5 rounded-md text-w-brand-deep text-[10px] font-black"
                                                        style={{
                                                            backgroundColor: '#EEF2F6',
                                                            boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.4), inset -1px -1px 2px rgba(255, 255, 255, 0.9)',
                                                            border: '1px solid rgba(255, 107, 53, 0.3)',
                                                        }}
                                                    >
                                                        Qty: {req.count}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                <span
                                                    className="px-2 py-0.5 rounded-md text-[11px] font-black text-slate-700"
                                                    style={{
                                                        backgroundColor: '#EEF2F6',
                                                        boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.35), inset -1px -1px 2px rgba(255, 255, 255, 0.9)',
                                                        border: '1px solid rgba(200, 212, 226, 0.5)',
                                                    }}
                                                >
                                                    Table {req.tables?.table_number || '?'}
                                                </span>
                                                {isReady && (
                                                    <span
                                                        className="px-2 py-0.5 rounded-md text-[#047857] text-[11px] font-black"
                                                        style={{
                                                            backgroundColor: '#EEF2F6',
                                                            boxShadow: 'inset 1px 1px 2px rgba(16, 185, 129, 0.3)',
                                                            border: '1px solid rgba(16, 185, 129, 0.4)',
                                                        }}
                                                    >
                                                        ✓ Ready to Serve
                                                    </span>
                                                )}
                                                <RequestTimerBadge since={req.created_at} />
                                            </div>
                                        </div>
                                    </div>

                                    {cleanDisplayNote(req.notes) && !isAccess && (
                                        <p
                                            className="mt-2.5 px-3 py-2 rounded-xl text-xs italic text-slate-600 font-semibold"
                                            style={{
                                                backgroundColor: '#E8EDF4',
                                                boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.3)',
                                            }}
                                        >
                                            Note: {cleanDisplayNote(req.notes)}
                                        </p>
                                    )}

                                    {isAccess && (() => {
                                        const reqMeta = parseRequesterMeta(req.notes);
                                        const accessNote = cleanDisplayNote(req.notes);
                                        return (
                                            <div
                                                className="mt-3 rounded-xl p-3 flex items-center gap-3"
                                                style={{
                                                    backgroundColor: '#EEF2F6',
                                                    boxShadow: 'inset 1.5px 1.5px 3px rgba(99, 102, 241, 0.25), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                                    border: '1px solid rgba(165, 180, 252, 0.6)',
                                                }}
                                            >
                                                <span className="size-9 rounded-full bg-[#4F46E5] text-white flex items-center justify-center text-sm font-black shrink-0 overflow-hidden shadow-sm">
                                                    {reqMeta.requester_avatar ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img src={reqMeta.requester_avatar} alt="" className="size-full object-cover" />
                                                    ) : (
                                                        String(reqMeta.requester_name || '?').charAt(0).toUpperCase()
                                                    )}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block text-[13px] font-black text-[#312E81] truncate">
                                                        Requester: {reqMeta.requester_name}
                                                    </span>
                                                    {reqMeta.requester_mobile && (
                                                        <span className="flex items-center gap-1 text-[11px] font-bold text-[#4F46E5] mt-0.5">
                                                            <Phone size={10} /> {reqMeta.requester_mobile}
                                                        </span>
                                                    )}
                                                    {accessNote && (
                                                        <p className="text-[11px] italic text-[#4338CA] mt-1 truncate font-medium">
                                                            &ldquo;{accessNote}&rdquo;
                                                        </p>
                                                    )}
                                                </span>
                                            </div>
                                        );
                                    })()}

                                    {/* Actions */}
                                    <div className="flex gap-2.5 mt-3.5">
                                        {isReady ? (
                                            <AppButton grow icon={<CheckCheck size={17} />} onClick={() => handleComplete(req)}>
                                                Mark as Served
                                            </AppButton>
                                        ) : isAccess ? (
                                             <>
                                                <AppButton variant="secondary" grow={2} icon={<X size={16} />} onClick={() => handleDeclineAccess(req)}>Decline</AppButton>
                                                <AppButton grow={3} icon={<CheckCheck size={17} />} onClick={() => handleApproveAccess(req, 'share')}>Approve (Share)</AppButton>
                                            </>
                                        ) : isAccepted ? (
                                            <AppButton variant="secondary" grow icon={<CheckCheck size={17} />} onClick={() => handleComplete(req)}>
                                                Mark as Completed
                                            </AppButton>
                                        ) : (
                                            <AppButton grow icon={<Check size={17} />} onClick={() => handleAccept(req)}>
                                                Accept Request
                                            </AppButton>
                                        )}
                                        {!isAccepted && !isReady && !isAccess && (
                                            <button
                                                onClick={() => handleComplete(req)}
                                                aria-label="Dismiss"
                                                className="size-[52px] shrink-0 rounded-[14px] flex items-center justify-center text-slate-500 active:scale-90 transition-transform"
                                                style={{
                                                    backgroundColor: '#EEF2F6',
                                                    boxShadow: '2.5px 2.5px 6px rgba(166, 180, 200, 0.35), -2.5px -2.5px 6px rgba(255, 255, 255, 0.95)',
                                                    border: '1px solid rgba(255, 255, 255, 0.85)',
                                                }}
                                            >
                                                <X size={18} />
                                            </button>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </main>
        </div>
    );
}

