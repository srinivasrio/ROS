'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { OrderService } from '@/services/orders.service';
import { RestaurantService } from '@/services/restaurant.service';
import { 
    LogOut, Building2, Hash, BadgeCheck, Power, Radio, Loader2, 
    Phone, Store, Copy, Check, ChevronRight,
    UtensilsCrossed, LayoutGrid, UserCheck, Smartphone, Camera, X
} from 'lucide-react';
import { haptic, springSoft, useIsHydrated } from '../../components/ui';

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
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const isHydrated = useIsHydrated();
    const hasCache = isHydrated && Boolean(cachedProfileData && cachedProfileData.staffMobile === staffMobile);

    const [waiter, setWaiter] = useState<any>(() => hasCache ? cachedProfileData!.waiter : null);
    const [restaurantName, setRestaurantName] = useState(() => hasCache ? cachedProfileData!.restaurantName : '');
    const [loading, setLoading] = useState(!hasCache);
    const [confirmOut, setConfirmOut] = useState(false);
    const [copiedId, setCopiedId] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Modal dialogs for structured information
    const [showStaffModal, setShowStaffModal] = useState(false);
    const [showRestaurantModal, setShowRestaurantModal] = useState(false);

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

    // Handle Image Upload to Cloudflare R2
    const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file (PNG, JPG, or WEBP)');
            return;
        }

        if (file.size > 8 * 1024 * 1024) {
            toast.error('Image size must be under 8MB');
            return;
        }

        setUploadingImage(true);
        haptic.selection();

        try {
            const formData = new FormData();
            formData.append('file', file);
            if (waiter?.id) formData.append('waiterId', waiter.id);
            if (staffMobile) formData.append('mobile', staffMobile);
            if (restaurantId) formData.append('restaurantId', restaurantId);

            const res = await fetch('/api/waiter/profile-image', {
                method: 'POST',
                body: formData,
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'Failed to upload profile picture');
                haptic.heavy();
                return;
            }

            const newAvatarUrl = data.avatarUrl;
            setWaiter((prev: any) => ({ ...prev, avatar_url: newAvatarUrl }));

            // Update in-memory cache
            if (cachedProfileData?.waiter) {
                cachedProfileData.waiter.avatar_url = newAvatarUrl;
            }

            // Update localStorage session
            if (typeof window !== 'undefined') {
                const cleanMobile = staffMobile ? staffMobile.replace(/[^0-9]/g, '').slice(-10) : '';
                const cachedSession = localStorage.getItem('waiterSession') || (cleanMobile ? localStorage.getItem(`waiterSession_${cleanMobile}`) : null);
                if (cachedSession) {
                    const session = JSON.parse(cachedSession);
                    session.avatar_url = newAvatarUrl;
                    localStorage.setItem('waiterSession', JSON.stringify(session));
                    if (cleanMobile) {
                        localStorage.setItem(`waiterSession_${cleanMobile}`, JSON.stringify(session));
                    }
                }
            }

            toast.success('Profile picture updated successfully!');
            haptic.success();
        } catch (err) {
            console.error('Image upload failed:', err);
            toast.error('Network error. Failed to upload photo.');
        } finally {
            setUploadingImage(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

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
                const cleanMobile = staffMobile ? staffMobile.replace(/[^0-9]/g, '').slice(-10) : '';
                const cachedSession = localStorage.getItem('waiterSession') || (cleanMobile ? localStorage.getItem(`waiterSession_${cleanMobile}`) : null);
                const session = cachedSession ? JSON.parse(cachedSession) : {};
                session.is_online = nextState;
                session.availability_status = nextState ? 'available' : 'offline';
                localStorage.setItem('waiterSession', JSON.stringify(session));
                if (cleanMobile) {
                    localStorage.setItem(`waiterSession_${cleanMobile}`, JSON.stringify(session));
                }
                window.dispatchEvent(new CustomEvent('waiter-status-changed', { detail: { isOnline: nextState, availability_status: session.availability_status } }));
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

    const copyEmployeeId = () => {
        if (!waiter?.employee_id) return;
        navigator.clipboard?.writeText(waiter.employee_id);
        setCopiedId(true);
        toast.success(`Copied ID: ${waiter.employee_id}`);
        haptic.selection();
        setTimeout(() => setCopiedId(false), 2000);
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
    const formattedPhone = waiter?.mobile
        ? `+91 ${String(waiter.mobile).slice(-10)}`
        : (staffMobile ? `+91 ${staffMobile.slice(-10)}` : '—');
    const avatarImg = waiter?.avatar_url || null;

    return (
        <div className="min-h-full pb-32" style={{ backgroundColor: '#EEF2F6' }}>
            {/* Hidden File Input for Cloudflare R2 Avatar Upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarFileChange}
            />

            {/* Top Navigation Bar */}
            <header
                className="sticky top-0 z-30 flex items-center justify-between px-5 h-16 backdrop-blur-md"
                style={{
                    backgroundColor: 'rgba(238, 242, 246, 0.92)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.85)',
                    boxShadow: '0 2px 10px rgba(166, 180, 200, 0.18)',
                }}
            >
                <div>
                    <h1 className="text-base font-black text-slate-800 tracking-tight">Staff Profile</h1>
                    <p className="text-[11px] font-semibold text-slate-500">Service Credentials & Shift Hub</p>
                </div>
                
                {/* Realtime Live Indicator Chip */}
                <div
                    suppressHydrationWarning
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black transition-all ${
                        isOnline 
                            ? 'bg-emerald-500/15 text-emerald-700 border border-emerald-500/30' 
                            : 'bg-slate-300/40 text-slate-600 border border-slate-300'
                    }`}
                >
                    <span className={`size-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                    <span>{isOnline ? 'Online' : 'Offline'}</span>
                </div>
            </header>

            <main className="p-4 sm:p-5 space-y-5 max-w-lg mx-auto">
                {/* 1. HERO IDENTITY CARD WITH AVATAR UPLOAD */}
                <div
                    className="p-5 rounded-[28px] relative overflow-hidden"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '5px 5px 14px rgba(166, 180, 200, 0.4), -5px -5px 14px rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.9)',
                    }}
                >
                    {/* Subtle warm orange ambient background gleam */}
                    <div 
                        aria-hidden="true" 
                        className="absolute -top-12 -right-12 size-36 rounded-full bg-gradient-to-br from-orange-400/10 to-orange-500/5 blur-2xl pointer-events-none" 
                    />

                    <div className="flex items-center gap-4 relative z-10">
                        {/* Avatar with Cloudflare Image Upload Trigger */}
                        <div className="relative shrink-0">
                            <div
                                onClick={() => !uploadingImage && fileInputRef.current?.click()}
                                title="Click to upload profile photo"
                                className="p-1 rounded-[24px] cursor-pointer group transition-transform active:scale-95"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 2.5px 2.5px 5px rgba(166, 180, 200, 0.38), inset -2.5px -2.5px 5px rgba(255, 255, 255, 0.95)',
                                }}
                            >
                                <div className="size-[72px] rounded-[20px] overflow-hidden relative bg-gradient-to-br from-[#FF6B00] via-[#FF7D26] to-[#FF9344] shadow-[0_6px_18px_rgba(255,107,0,0.35)] flex items-center justify-center text-white font-black text-2xl tracking-tight">
                                    {avatarImg ? (
                                        <img
                                            src={avatarImg}
                                            alt={waiter?.name || 'Waiter'}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span suppressHydrationWarning>{initials}</span>
                                    )}

                                    {/* Uploading Overlay Spinner */}
                                    {uploadingImage && (
                                        <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center">
                                            <Loader2 size={22} className="animate-spin text-white" />
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Camera Action Badge */}
                            <button
                                type="button"
                                onClick={() => !uploadingImage && fileInputRef.current?.click()}
                                disabled={uploadingImage}
                                className="absolute -bottom-1 -right-1 size-7 rounded-full bg-[#EEF2F6] flex items-center justify-center border-2 border-white shadow-md text-orange-600 hover:text-orange-700 active:scale-90 transition-all cursor-pointer"
                                title="Upload Photo"
                            >
                                <Camera size={13} />
                            </button>
                        </div>

                        {/* Waiter Details & Chips */}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 suppressHydrationWarning className="text-xl font-black text-slate-800 tracking-tight truncate">
                                    {loading ? 'Loading…' : waiter?.name || 'Staff Waiter'}
                                </h2>
                                <span
                                    suppressHydrationWarning
                                    className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-500/10 border border-orange-500/20"
                                >
                                    {waiter?.role || 'Floor Waiter'}
                                </span>
                            </div>

                            <p suppressHydrationWarning className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1.5">
                                <Phone size={12} className="text-orange-500 shrink-0" />
                                <span>{formattedPhone}</span>
                            </p>

                            {/* Employee ID Pill with Quick Copy */}
                            {waiter?.employee_id && (
                                <div className="mt-2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={copyEmployeeId}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold text-slate-600 cursor-pointer active:scale-95 transition-all"
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.3), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                            border: '1px solid rgba(255, 255, 255, 0.8)',
                                        }}
                                        title="Click to copy Employee ID"
                                    >
                                        <Hash size={11} className="text-orange-500" />
                                        <span>ID: {waiter.employee_id}</span>
                                        {copiedId ? (
                                            <Check size={11} className="text-emerald-600 ml-0.5" />
                                        ) : (
                                            <Copy size={11} className="text-slate-400 ml-0.5" />
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. LIVE SHIFT & WORKLOAD CONTROL */}
                <section>
                    <div className="flex items-center justify-between px-1 mb-2.5">
                        <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-orange-500" />
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Shift Availability & Workload</h3>
                        </div>
                        <span className="text-[11px] font-bold text-slate-400">Live floor sync</span>
                    </div>

                    <div
                        suppressHydrationWarning
                        className="p-5 rounded-[26px] transition-all duration-300"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '4px 4px 12px rgba(166, 180, 200, 0.35), -4px -4px 12px rgba(255, 255, 255, 0.95)',
                            border: isOnline ? '1.5px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        {/* Toggle Bar */}
                        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200/70">
                            <div className="flex items-center gap-3">
                                <div
                                    suppressHydrationWarning
                                    className={`size-11 rounded-2xl flex items-center justify-center transition-all ${
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
                                    <Power size={18} className={isOnline ? 'animate-pulse' : ''} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 suppressHydrationWarning className="text-sm font-extrabold text-slate-800">
                                            {isOnline ? 'Active On Shift' : 'Shift On Pause'}
                                        </h4>
                                        <span
                                            suppressHydrationWarning
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                isOnline
                                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                                    : 'bg-slate-200 text-slate-600 border border-slate-300'
                                            }`}
                                        >
                                            <span className={`size-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                            {isOnline ? 'ONLINE' : 'OFFLINE'}
                                        </span>
                                    </div>
                                    <p suppressHydrationWarning className="text-[11.5px] font-medium text-slate-500 mt-0.5">
                                        {isOnline
                                            ? 'Receiving table orders & customer service calls'
                                            : 'Tap switch to resume alerts and table assignment'}
                                    </p>
                                </div>
                            </div>

                            {/* Liquid Glass Neumorphic Toggle Switch */}
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
                                        <Radio size={12} />
                                    )}
                                </span>
                            </button>
                        </div>

                        {/* Realtime Workload Metric Grid */}
                        <div className="grid grid-cols-2 gap-3 pt-4">
                            {/* Assigned Tables */}
                            <div
                                className="p-3 rounded-2xl flex items-center gap-3"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.3), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.75)',
                                }}
                            >
                                <div className="size-9 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-600 flex items-center justify-center shrink-0">
                                    <LayoutGrid size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Tables</p>
                                    <p suppressHydrationWarning className="text-base font-black text-slate-800">
                                        {workload.tables} <span className="text-xs font-semibold text-slate-500">Assigned</span>
                                    </p>
                                </div>
                            </div>

                            {/* Active Orders */}
                            <div
                                className="p-3 rounded-2xl flex items-center gap-3"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.3), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.75)',
                                }}
                            >
                                <div className="size-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 flex items-center justify-center shrink-0">
                                    <UtensilsCrossed size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Live Orders</p>
                                    <p suppressHydrationWarning className="text-base font-black text-slate-800">
                                        {workload.orders} <span className="text-xs font-semibold text-slate-500">Active</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. DETAILS BUTTONS (SEPARATE BUTTONS FOR RESTAURANT & STAFF) */}
                <section className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                        <span className="size-2 rounded-full bg-orange-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Information & Credentials</h3>
                    </div>

                    {/* Button 1: Staff & Account Details */}
                    <button
                        type="button"
                        onClick={() => {
                            haptic.selection();
                            setShowStaffModal(true);
                        }}
                        className="w-full p-4 rounded-[22px] flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.35), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div
                                className="size-10 rounded-xl flex items-center justify-center text-orange-600 shrink-0"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                }}
                            >
                                <UserCheck size={18} />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-sm font-black text-slate-800">Staff and Account Details</h4>
                                <p className="text-[11px] font-medium text-slate-500">View personal ID, mobile, and account verification</p>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-400 shrink-0 ml-2" />
                    </button>

                    {/* Button 2: Restaurant Details */}
                    <button
                        type="button"
                        onClick={() => {
                            haptic.selection();
                            setShowRestaurantModal(true);
                        }}
                        className="w-full p-4 rounded-[22px] flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.35), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div
                                className="size-10 rounded-xl flex items-center justify-center text-orange-600 shrink-0"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                }}
                            >
                                <Building2 size={18} />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-sm font-black text-slate-800">Restaurant Details</h4>
                                <p className="text-[11px] font-medium text-slate-500">Assigned outlet venue, tenant code & branch</p>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-slate-400 shrink-0 ml-2" />
                    </button>
                </section>

                {/* 4. SIGN OUT BUTTON */}
                <button
                    type="button"
                    onClick={() => setConfirmOut(true)}
                    className="w-full h-12 rounded-[22px] font-black text-sm text-rose-600 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer mt-4"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '3.5px 3.5px 10px rgba(166, 180, 200, 0.35), -3.5px -3.5px 10px rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(244, 63, 94, 0.35)',
                    }}
                >
                    <LogOut size={16} />
                    <span>End Shift & Sign Out</span>
                </button>
            </main>

            {/* MODAL 1: STAFF & ACCOUNT DETAILS */}
            <AnimatePresence>
                {showStaffModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" 
                            onClick={() => setShowStaffModal(false)} 
                        />
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 10 }}
                            transition={springSoft}
                            className="relative w-full max-w-[360px] rounded-[28px] p-5 z-10"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '8px 8px 24px rgba(166, 180, 200, 0.5), -8px -8px 24px rgba(255, 255, 255, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.9)',
                            }}
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className="size-9 rounded-xl flex items-center justify-center text-orange-600 shrink-0"
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                        }}
                                    >
                                        <UserCheck size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800">Staff & Account Details</h3>
                                        <p className="text-[10px] font-bold text-slate-400">Personal Staff Credentials</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowStaffModal(false)}
                                    className="size-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="divide-y divide-slate-200/70 mt-2">
                                <StructuredProfileRow
                                    icon={<UserCheck size={15} />}
                                    label="Staff Name"
                                    value={<span suppressHydrationWarning>{waiter?.name || 'Staff Member'}</span>}
                                />
                                <StructuredProfileRow
                                    icon={<Hash size={15} />}
                                    label="Employee ID"
                                    value={
                                        <span suppressHydrationWarning className="font-mono text-xs font-bold text-slate-700">
                                            {waiter?.employee_id || '—'}
                                        </span>
                                    }
                                />
                                <StructuredProfileRow
                                    icon={<Smartphone size={15} />}
                                    label="Primary Mobile"
                                    value={<span suppressHydrationWarning>{formattedPhone}</span>}
                                />
                                <StructuredProfileRow
                                    icon={<BadgeCheck size={15} />}
                                    label="Account Status"
                                    value={
                                        (waiter?.status || 'active').toLowerCase() === 'active' ? (
                                            <span suppressHydrationWarning className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-300">
                                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                                Active & Verified
                                            </span>
                                        ) : (
                                            <span suppressHydrationWarning className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                                                <span className="size-1.5 rounded-full bg-rose-500" />
                                                Suspended
                                            </span>
                                        )
                                    }
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowStaffModal(false)}
                                className="w-full mt-4 h-10 rounded-[16px] font-black text-xs text-slate-700 cursor-pointer transition-all active:scale-95"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: '3px 3px 6px rgba(166, 180, 200, 0.35), -3px -3px 6px rgba(255, 255, 255, 0.95)',
                                    border: '1px solid rgba(255, 255, 255, 0.85)',
                                }}
                            >
                                Done
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* MODAL 2: RESTAURANT DETAILS */}
            <AnimatePresence>
                {showRestaurantModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" 
                            onClick={() => setShowRestaurantModal(false)} 
                        />
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.92, opacity: 0, y: 10 }}
                            transition={springSoft}
                            className="relative w-full max-w-[360px] rounded-[28px] p-5 z-10"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '8px 8px 24px rgba(166, 180, 200, 0.5), -8px -8px 24px rgba(255, 255, 255, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.9)',
                            }}
                        >
                            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className="size-9 rounded-xl flex items-center justify-center text-orange-600 shrink-0"
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                        }}
                                    >
                                        <Building2 size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800">Restaurant Details</h3>
                                        <p className="text-[10px] font-bold text-slate-400">Assigned Branch & Outlet</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowRestaurantModal(false)}
                                    className="size-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="divide-y divide-slate-200/70 mt-2">
                                <StructuredProfileRow
                                    icon={<Building2 size={15} />}
                                    label="Restaurant Name"
                                    value={<span suppressHydrationWarning className="font-extrabold text-slate-900">{restaurantName || '—'}</span>}
                                />
                                <StructuredProfileRow
                                    icon={<Store size={15} />}
                                    label="Outlet Code / Tenant"
                                    value={<span suppressHydrationWarning className="font-mono text-xs">{restaurantId || (params?.restaurantCode as string) || '—'}</span>}
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => setShowRestaurantModal(false)}
                                className="w-full mt-4 h-10 rounded-[16px] font-black text-xs text-slate-700 cursor-pointer transition-all active:scale-95"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: '3px 3px 6px rgba(166, 180, 200, 0.35), -3px -3px 6px rgba(255, 255, 255, 0.95)',
                                    border: '1px solid rgba(255, 255, 255, 0.85)',
                                }}
                            >
                                Done
                            </button>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Sign Out Confirmation Modal */}
            <AnimatePresence>
                {confirmOut && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" 
                            onClick={() => setConfirmOut(false)} 
                        />
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.92, opacity: 0 }}
                            transition={springSoft}
                            className="relative w-full max-w-[320px] rounded-[28px] p-6 z-10"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '8px 8px 24px rgba(166, 180, 200, 0.5), -8px -8px 24px rgba(255, 255, 255, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.9)',
                            }}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div
                                    className="size-10 rounded-2xl flex items-center justify-center text-rose-600 shrink-0"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                    }}
                                >
                                    <LogOut size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-800">End Shift?</h3>
                                    <p className="text-xs font-semibold text-slate-500">Sign out of waiter panel</p>
                                </div>
                            </div>
                            <p className="text-[12.5px] font-medium text-slate-600 mt-3 leading-relaxed">
                                Signing out will mark your status as <strong className="text-slate-900 font-bold">Offline</strong>. Table requests will be paused or rerouted to other active staff.
                            </p>
                            <div className="flex gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setConfirmOut(false)}
                                    className="flex-1 h-11 rounded-[16px] font-black text-xs text-slate-700 transition-all active:scale-95 cursor-pointer"
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
                                    className="flex-1 h-11 rounded-[16px] font-black text-xs text-white bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_4px_12px_rgba(244,63,94,0.35)] transition-all active:scale-95 cursor-pointer"
                                >
                                    Confirm Sign Out
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function StructuredProfileRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 px-1 py-3">
            <div
                className="size-7 rounded-lg shrink-0 flex items-center justify-center text-orange-600"
                style={{
                    backgroundColor: '#EEF2F6',
                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.7)',
                }}
            >
                {icon}
            </div>
            <span className="flex-1 text-xs font-bold text-slate-600">{label}</span>
            <span suppressHydrationWarning className="text-xs font-extrabold text-slate-800 text-right max-w-[58%] truncate">{value}</span>
        </div>
    );
}
