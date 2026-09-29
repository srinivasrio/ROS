'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { OrderService } from '@/services/orders.service';
import { RestaurantService } from '@/services/restaurant.service';
import { LogOut, Building2, Hash, BadgeCheck, Info, Camera, Power, Radio, Loader2, Users } from 'lucide-react';
import { AppButton, SectionLabel, haptic, springSoft, useIsHydrated } from '../../components/ui';

const supabase = createClient();

// Persistent in-memory cache for instant tab switching without screen reload/flicker
let cachedProfileData: {
    staffMobile: string;
    restaurantId: string;
    waiter: any;
    restaurantName: string;
    isOnline: boolean;
    workload: { tables: number; orders: number };
} | null = null;

export default function WaiterProfile() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const params = useParams();
    const staffMobile = params.staffMobile as string;
    const router = useRouter();

    const isHydrated = useIsHydrated();
    const hasCache = isHydrated && Boolean(cachedProfileData && cachedProfileData.staffMobile === staffMobile);

    const [waiter, setWaiter] = useState<any>(() => hasCache ? cachedProfileData!.waiter : null);
    const [restaurantName, setRestaurantName] = useState(() => hasCache ? cachedProfileData!.restaurantName : '');
    const [loading, setLoading] = useState(!hasCache);
    const [confirmOut, setConfirmOut] = useState(false);

    // Online / Offline state
    const [isOnline, setIsOnline] = useState<boolean>(() => hasCache ? (cachedProfileData?.isOnline ?? false) : false);
    const [togglingStatus, setTogglingStatus] = useState<boolean>(false);
    const [workload, setWorkload] = useState<{ tables: number; orders: number }>(() => hasCache ? (cachedProfileData?.workload || { tables: 0, orders: 0 }) : { tables: 0, orders: 0 });

    useEffect(() => {
        let active = true;

        // Immediate client restoration from localStorage if not cached in memory
        if (!waiter && typeof window !== 'undefined') {
            try {
                const cachedSession = localStorage.getItem(`waiterSession_${staffMobile}`) || localStorage.getItem('waiterSession');
                if (cachedSession) {
                    const parsed = JSON.parse(cachedSession);
                    if (parsed?.id) {
                        setWaiter(parsed);
                        setIsOnline(Boolean(parsed.is_online));
                        setLoading(false);
                    }
                }
            } catch (_) {}
        }

        (async () => {
            if (!restaurantId) return;
            try {
                let currentOnline = isOnline;
                // 1. Fetch authenticated waiter status from server
                const statusRes = await fetch('/api/waiter/status');
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    if (active) {
                        currentOnline = Boolean(statusData.is_online);
                        setIsOnline(currentOnline);
                    }
                }

                // 2. Fetch staff record
                let staffRecord = waiter;
                let tableCount = workload.tables;
                let orderCount = workload.orders;
                if (staffMobile) {
                    const record = await OrderService.getStaffByMobile(staffMobile, restaurantId);
                    if (active && record) {
                        staffRecord = record;
                        setWaiter(record);
                        if (record.is_online !== undefined) {
                            currentOnline = Boolean(record.is_online);
                            setIsOnline(currentOnline);
                        }

                        // Fetch active tables and active orders count for workload
                        const { count: tc } = await supabase
                            .from('tables')
                            .select('*', { count: 'exact', head: true })
                            .eq('restaurant_id', restaurantId)
                            .eq('assigned_waiter_id', record.id)
                            .in('status', ['occupied', 'eating', 'cooking', 'placed', 'need_bill', 'billing', 'bill_requested', 'on_hold']);

                        const { count: oc } = await supabase
                            .from('orders')
                            .select('*', { count: 'exact', head: true })
                            .eq('restaurant_id', restaurantId)
                            .eq('waiter_id', record.id)
                            .eq('is_completed', false)
                            .not('status', 'in', '("paid","cancelled","completed")');

                        tableCount = tc ?? record.active_tables_count ?? 0;
                        orderCount = oc ?? record.active_orders_count ?? 0;
                        if (active) {
                            setWorkload({ tables: tableCount, orders: orderCount });
                        }
                    }
                }

                let rName = restaurantName;
                const targetResId = restaurantId || (params?.restaurantCode as string);
                if (targetResId) {
                    try {
                        const info = await RestaurantService.getRestaurantInfo(targetResId);
                        if (active && info?.name) {
                            rName = info.name;
                            setRestaurantName(info.name);
                        }
                    } catch (e) {
                        console.error('Failed to get restaurant info in profile:', e);
                    }
                }

                if (restaurantId && staffMobile) {
                    cachedProfileData = {
                        staffMobile,
                        restaurantId,
                        waiter: staffRecord,
                        restaurantName: rName,
                        isOnline: currentOnline,
                        workload: { tables: tableCount, orders: orderCount }
                    };
                }
            } catch (err) {
                console.error('Failed to load profile:', err);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [restaurantId, restaurantLoading, staffMobile]);

    // Self-managed Online / Offline Toggle
    const handleToggleOnline = async () => {
        setTogglingStatus(true);
        const nextState = !isOnline;
        haptic.selection();

        try {
            const cached = typeof window !== 'undefined' ? localStorage.getItem('waiterSession') : null;
            const waiterSession = cached ? JSON.parse(cached) : null;

            const res = await fetch('/api/waiter/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isOnline: nextState,
                    waiterId: waiterSession?.id || waiter?.id,
                    mobile: staffMobile,
                    restaurantId: restaurantId
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'Failed to update status');
                haptic.heavy();
                return;
            }

            setIsOnline(nextState);
            if (typeof window !== 'undefined') {
                const cachedSession = localStorage.getItem('waiterSession');
                if (cachedSession) {
                    const session = JSON.parse(cachedSession);
                    session.is_online = nextState;
                    session.availability_status = nextState ? 'available' : 'offline';
                    localStorage.setItem('waiterSession', JSON.stringify(session));
                }
            }

            if (nextState) {
                toast.success('You are now Online and ready to receive orders & service requests.');
                haptic.success();
            } else {
                toast.info('You are now Offline. Order alerts paused.');
                haptic.light();
            }
        } catch (err) {
            console.error('Status toggle error:', err);
            toast.error('Network error. Failed to update status.');
        } finally {
            setTogglingStatus(false);
        }
    };

    const signOut = async () => {
        try {
            const cached = typeof window !== 'undefined' ? localStorage.getItem('waiterSession') : null;
            const waiterSession = cached ? JSON.parse(cached) : null;

            // Set waiter offline before signing out
            await fetch('/api/waiter/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isOnline: false,
                    waiterId: waiterSession?.id || waiter?.id,
                    mobile: staffMobile,
                    restaurantId: restaurantId
                }),
            }).catch(() => {});

            // Call logout to invalidate server session & clear cookie
            await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        } catch (_) {}

        localStorage.removeItem('waiterSession');
        haptic.light();
        router.push(`/${restaurantId}/waiter/login`);
    };

    const initials = (waiter?.name || 'W').charAt(0).toUpperCase();

    return (
        <div className="min-h-full pb-28" style={{ backgroundColor: '#EEF2F6' }}>
            <header
                className="sticky top-0 z-30 flex items-center px-4 h-14"
                style={{
                    backgroundColor: '#EEF2F6',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.85)',
                    boxShadow: '0 2px 8px rgba(166, 180, 200, 0.25)',
                }}
            >
                <h1 className="flex-1 text-center text-lg font-black text-slate-800 tracking-tight">Waiter Profile</h1>
            </header>

            <main className="p-5 space-y-4">
                {/* Profile card */}
                <div
                    className="p-5 rounded-[24px]"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.4), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.85)',
                    }}
                >
                    <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                            {/* Recessed outer frame for avatar */}
                            <div
                                className="p-1 rounded-[22px]"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 2.5px 2.5px 5px rgba(166, 180, 200, 0.38), inset -2.5px -2.5px 5px rgba(255, 255, 255, 0.95)',
                                }}
                            >
                                <div className="size-[64px] rounded-[18px] bg-gradient-to-br from-[#FF6B35] to-[#FF8C42] shadow-[0_4px_14px_rgba(255,107,53,0.35)] flex items-center justify-center">
                                    <span suppressHydrationWarning className="font-display text-[26px] font-black text-white">{initials}</span>
                                </div>
                            </div>
                            <span
                                className="absolute -bottom-0.5 -right-0.5 size-6 rounded-full bg-[#EEF2F6] flex items-center justify-center"
                                style={{
                                    boxShadow: '2px 2px 4px rgba(166, 180, 200, 0.4), -1px -1px 3px rgba(255, 255, 255, 0.95)',
                                    border: '1px solid rgba(255, 255, 255, 0.9)',
                                }}
                            >
                                <Camera size={11} className="text-orange-600" />
                            </span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                                <h2 suppressHydrationWarning className="text-lg font-black text-slate-800 tracking-tight truncate">
                                    {loading ? '…' : waiter?.name || 'Staff Waiter'}
                                </h2>
                                <span
                                    suppressHydrationWarning
                                    className="px-2.5 py-0.5 rounded-lg text-orange-600 text-[10px] font-black uppercase tracking-wider shrink-0"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.75)',
                                    }}
                                >
                                    {waiter?.role || 'waiter'}
                                </span>
                            </div>
                            <p suppressHydrationWarning className="text-xs font-bold text-slate-500 mt-1">
                                {waiter?.mobile ? `+91 ${String(waiter.mobile).slice(-10)}` : staffMobile}
                            </p>
                            {waiter?.employee_id && (
                                <div className="mt-1">
                                    <span
                                        suppressHydrationWarning
                                        className="inline-block px-2 py-0.5 rounded-md font-mono text-[11px] font-bold text-slate-500"
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: 'inset 1px 1px 2.5px rgba(166, 180, 200, 0.35), inset -1px -1px 2.5px rgba(255, 255, 255, 0.9)',
                                        }}
                                    >
                                        ID: {waiter.employee_id}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Waiter Online / Offline Switch Card */}
                <section>
                    <div className="flex items-center gap-2 px-1 mb-2.5">
                        <span className="size-1.5 rounded-full bg-orange-500" />
                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Service Availability</h3>
                    </div>
                    <div
                        suppressHydrationWarning
                        className="p-5 rounded-[24px] transition-all duration-300"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.38), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                            border: isOnline ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                                <div
                                    suppressHydrationWarning
                                    className={`size-12 rounded-2xl flex items-center justify-center transition-all ${
                                        isOnline
                                            ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.35)]'
                                            : 'text-slate-400'
                                    }`}
                                    style={!isOnline ? {
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.7)',
                                    } : undefined}
                                >
                                    <Radio size={20} className={isOnline ? 'animate-pulse' : ''} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 suppressHydrationWarning className="text-sm font-extrabold text-slate-800">
                                            {isOnline ? 'Availability: Online' : 'Availability: Offline'}
                                        </h4>
                                        <span
                                            suppressHydrationWarning
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase ${
                                                isOnline
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-300/80 shadow-[inset_1px_1px_2px_rgba(16,185,129,0.15)]'
                                                    : 'bg-slate-100 text-slate-500 border border-slate-300/80'
                                            }`}
                                        >
                                            <span className={`size-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
                                            {isOnline ? 'Online' : 'Offline'}
                                        </span>
                                    </div>
                                    <p suppressHydrationWarning className="text-[11.5px] font-medium text-slate-500 mt-0.5 leading-relaxed">
                                        {isOnline
                                            ? 'Receiving customer table calls and new order notifications.'
                                            : 'You are marked offline. Toggle to start receiving order alerts.'}
                                    </p>
                                </div>
                            </div>

                            {/* Neumorphic Toggle Switch */}
                            <button
                                suppressHydrationWarning
                                onClick={handleToggleOnline}
                                disabled={togglingStatus}
                                className="relative shrink-0 w-14 h-8 rounded-full p-1 cursor-pointer disabled:opacity-50 transition-all duration-300"
                                style={{
                                    backgroundColor: isOnline ? '#10B981' : '#CBD5E1',
                                    boxShadow: 'inset 2.5px 2.5px 5px rgba(0, 0, 0, 0.2), inset -2px -2px 4px rgba(255, 255, 255, 0.6)',
                                }}
                                aria-label="Toggle Online Status"
                            >
                                <span
                                    suppressHydrationWarning
                                    className={`flex items-center justify-center size-6 rounded-full bg-[#EEF2F6] transform transition-transform duration-200 ease-in-out ${
                                        isOnline ? 'translate-x-6 text-emerald-600' : 'translate-x-0 text-slate-400'
                                    }`}
                                    style={{
                                        boxShadow: '2px 2px 5px rgba(0, 0, 0, 0.25), -1px -1px 3px rgba(255, 255, 255, 0.95)',
                                    }}
                                >
                                    {togglingStatus ? (
                                        <Loader2 size={13} className="animate-spin text-slate-500" />
                                    ) : (
                                        <Power size={13} />
                                    )}
                                </span>
                            </button>
                        </div>
                    </div>
                </section>

                {/* Restaurant details */}
                <section>
                    <div className="flex items-center gap-2 px-1 mb-2.5">
                        <span className="size-1.5 rounded-full bg-orange-500" />
                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500">Restaurant details</h3>
                    </div>
                    <div
                        className="rounded-[24px] p-2 overflow-hidden"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.38), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        <div className="divide-y divide-slate-200/60">
                            <ProfileRow icon={<Building2 size={16} />} label="Restaurant" value={<span suppressHydrationWarning>{restaurantName || '—'}</span>} />
                            <ProfileRow icon={<Hash size={16} />} label="Tenant ID" value={<span suppressHydrationWarning className="font-mono text-xs">{restaurantId || '—'}</span>} />
                            <ProfileRow
                                icon={<BadgeCheck size={16} />}
                                label="Account Status"
                                value={
                                    (waiter?.status || 'active').toLowerCase() === 'active' ? (
                                        <span suppressHydrationWarning className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100/80 text-emerald-700 border border-emerald-200/80">
                                            <span className="size-1.5 rounded-full bg-emerald-500" />
                                            Active Account
                                        </span>
                                    ) : (
                                        <span suppressHydrationWarning className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-700 border border-rose-200">
                                            <span className="size-1.5 rounded-full bg-rose-500" />
                                            Inactive Account
                                        </span>
                                    )
                                }
                            />
                            <ProfileRow
                                icon={<Radio size={16} />}
                                label="Availability"
                                value={
                                    isOnline ? (
                                        <span suppressHydrationWarning className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100/80 text-emerald-700 border border-emerald-200/80">
                                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Online
                                        </span>
                                    ) : (
                                        <span suppressHydrationWarning className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                                            <span className="size-1.5 rounded-full bg-amber-500" />
                                            Offline
                                        </span>
                                    )
                                }
                            />
                            <ProfileRow
                                icon={<Users size={16} />}
                                label="Active Workload"
                                value={
                                    <span suppressHydrationWarning className="font-black text-slate-800">
                                        {workload.tables} Tables • {workload.orders} Orders
                                    </span>
                                }
                            />
                        </div>
                    </div>
                </section>

                {/* App version */}
                <div
                    className="rounded-[20px] px-4 py-3.5 flex items-center gap-3"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.85)',
                    }}
                >
                    <div
                        className="size-7 rounded-lg flex items-center justify-center text-orange-600 shrink-0"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                        }}
                    >
                        <Info size={15} />
                    </div>
                    <span className="flex-1 text-xs font-bold text-slate-600">App Version</span>
                    <span
                        className="text-[11px] font-mono font-bold text-slate-500 px-2.5 py-0.5 rounded-md"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.3), inset -1px -1px 2px rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        v2.4.0 (Build 412)
                    </span>
                </div>

                {/* Sign out */}
                <button
                    type="button"
                    onClick={() => setConfirmOut(true)}
                    className="w-full h-12 rounded-[20px] font-black text-sm text-rose-600 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-2"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '3.5px 3.5px 8px rgba(166, 180, 200, 0.4), -3.5px -3.5px 8px rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(244, 63, 94, 0.3)',
                    }}
                >
                    <LogOut size={17} />
                    Sign Out
                </button>
            </main>

            {/* Sign out confirm */}
            {confirmOut && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-6">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setConfirmOut(false)} />
                    <motion.div
                        initial={{ scale: 0.92, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={springSoft}
                        className="relative w-full max-w-[320px] rounded-[28px] p-6 z-10"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '8px 8px 24px rgba(166, 180, 200, 0.5), -8px -8px 24px rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.9)',
                        }}
                    >
                        <div className="flex items-center gap-2.5 mb-2">
                            <div
                                className="size-8 rounded-xl flex items-center justify-center text-rose-600"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                }}
                            >
                                <LogOut size={16} />
                            </div>
                            <h3 className="text-lg font-black text-slate-800">Sign Out</h3>
                        </div>
                        <p className="text-[13px] font-medium text-slate-600 mt-2 leading-relaxed">
                            Signing out will set your waiter status to <strong className="text-slate-900 font-bold">Offline</strong> and end your active shift. Are you sure?
                        </p>
                        <div className="flex gap-3 mt-6">
                            <button
                                type="button"
                                onClick={() => setConfirmOut(false)}
                                className="flex-1 h-11 rounded-[16px] font-black text-xs text-slate-700 transition-all active:scale-95"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: '3px 3px 6px rgba(166, 180, 200, 0.38), -3px -3px 6px rgba(255, 255, 255, 0.95)',
                                    border: '1px solid rgba(255, 255, 255, 0.85)',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={signOut}
                                className="flex-1 h-11 rounded-[16px] font-black text-xs text-white bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_4px_12px_rgba(244,63,94,0.35)] transition-all active:scale-95"
                            >
                                Sign Out
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}

function ProfileRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 px-3.5 py-3">
            <div
                className="size-8 rounded-xl shrink-0 flex items-center justify-center text-orange-600"
                style={{
                    backgroundColor: '#EEF2F6',
                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.7)',
                }}
            >
                {icon}
            </div>
            <span className="flex-1 text-xs font-bold text-slate-600">{label}</span>
            <span suppressHydrationWarning className="text-xs font-extrabold text-slate-800 text-right max-w-[55%] truncate">{value}</span>
        </div>
    );
}
