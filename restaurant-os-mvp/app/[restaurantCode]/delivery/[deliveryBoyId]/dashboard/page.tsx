'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import {
    Home as LucideHome,
    Package,
    MapPin,
    User,
    Navigation,
    Phone,
    Clock,
    CheckCircle2,
    AlertCircle,
    Bell,
    Power,
    LogOut,
    Search,
    ShieldCheck,
    Bike,
    Building2,
    Calendar,
    ChevronRight,
    Camera,
    RefreshCw,
    Sparkles,
    AlertTriangle,
    FileText,
    CreditCard,
    ArrowLeft,
    HelpCircle,
    UtensilsCrossed
} from 'lucide-react';

import DeliveryCard, { DeliveryAssignment } from '@/components/delivery/DeliveryCard';
import DeliveryMap from '@/components/delivery/DeliveryMap';
import OrderDetailsModal from '@/components/delivery/OrderDetailsModal';
import DeliveryConfirmationModal from '@/components/delivery/DeliveryConfirmationModal';
import ReportIssueModal from '@/components/delivery/ReportIssueModal';
import AttendanceSection from '@/components/delivery/AttendanceSection';
import SalarySection from '@/components/delivery/SalarySection';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

// Exactly 4 sections: More has been removed
type NavSection = 'home' | 'deliveries' | 'map' | 'profile';
type DeliveryFilterTab = 'assigned' | 'active' | 'completed';
type ProfileSubSection = 'menu' | 'personal' | 'vehicle' | 'attendance' | 'salary' | 'leaves';

export default function DeliveryBoyDashboard() {
    const params = useParams();
    const router = useRouter();
    const restaurantCode = (params?.restaurantCode as string) || '';
    const deliveryBoyId = (params?.deliveryBoyId as string) || '';

    // ── Navigation State (Exactly 4 sections) ──
    const [activeSection, setActiveSection] = useState<NavSection>('home');
    const [deliveryTab, setDeliveryTab] = useState<DeliveryFilterTab>('active');
    const [profileSubSection, setProfileSubSection] = useState<ProfileSubSection>('menu');

    // ── Delivery Data State ──
    const [assignments, setAssignments] = useState<DeliveryAssignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // ── Profile State ──
    const [profile, setProfile] = useState<any>(null);
    const [isOnline, setIsOnline] = useState(true);
    const [togglingOnline, setTogglingOnline] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Modal States ──
    const [selectedOrderDetails, setSelectedOrderDetails] = useState<DeliveryAssignment | null>(null);
    const [confirmDeliveryAssignment, setConfirmDeliveryAssignment] = useState<DeliveryAssignment | null>(null);
    const [reportIssueAssignment, setReportIssueAssignment] = useState<DeliveryAssignment | null>(null);

    // ── Track Mount State ──
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // ── Notification Audio Effect on New Assignment ──
    const prevAssignmentIdsRef = useRef<Set<string>>(new Set());

    const playAssignmentNotification = useCallback(() => {
        try {
            if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
            }
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
            osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.4);
        } catch {
            // AudioContext not allowed before user gesture
        }
    }, []);

    // ── Fetch Assignments (Silent background polling) ──
    const fetchAssignments = useCallback(async (isBackground = false) => {
        if (!restaurantCode || !deliveryBoyId) return;
        if (!isBackground && isMountedRef.current) setLoading(true);
        if (isBackground && isMountedRef.current) setIsRefreshing(true);

        try {
            const res = await fetch(`/api/delivery/assignments?restaurantId=${restaurantCode}&deliveryBoyId=${deliveryBoyId}`);
            if (res.ok && isMountedRef.current) {
                const data = await res.json();
                const fetched: DeliveryAssignment[] = data.assignments || [];

                // Check for newly assigned deliveries to alert employee
                const currentAssigned = fetched.filter(a => a.status === 'ASSIGNED');
                const hasNew = currentAssigned.some(a => !prevAssignmentIdsRef.current.has(a.id));
                if (hasNew && prevAssignmentIdsRef.current.size > 0) {
                    playAssignmentNotification();
                    toast.info('New Delivery Assigned! Check your deliveries list.', {
                        icon: '📦',
                    });
                }

                prevAssignmentIdsRef.current = new Set(fetched.map(a => a.id));
                setAssignments(fetched);
            }
        } catch (err) {
            console.error('[DeliveryDashboard] Fetch error:', err);
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
                setIsRefreshing(false);
            }
        }
    }, [restaurantCode, deliveryBoyId, playAssignmentNotification]);

    // ── Fetch Profile ──
    const fetchProfile = useCallback(async () => {
        if (!deliveryBoyId || !restaurantCode) return;
        try {
            const res = await fetch(`/api/delivery/profile?deliveryBoyId=${deliveryBoyId}&restaurantId=${restaurantCode}`);
            if (res.ok && isMountedRef.current) {
                const data = await res.json();
                if (data.profile) {
                    setProfile(data.profile);
                    setIsOnline(data.profile.availabilityStatus === 'active');
                }
            }
        } catch (err) {
            console.error('[DeliveryDashboard] Profile error:', err);
        }
    }, [deliveryBoyId, restaurantCode]);

    useEffect(() => {
        fetchAssignments();
        fetchProfile();
    }, [fetchAssignments, fetchProfile]);

    // ── 15-second Silent Polling for Fresh Deliveries ──
    useEffect(() => {
        const interval = setInterval(() => {
            if (isMountedRef.current && isOnline) {
                fetchAssignments(true);
            }
        }, 15000);
        return () => clearInterval(interval);
    }, [fetchAssignments, isOnline]);

    // ── Update Delivery Status ──
    const handleUpdateStatus = async (assignmentId: string, newStatus: string, extra?: any) => {
        if (isMountedRef.current) setUpdatingId(assignmentId);
        try {
            const query = new URLSearchParams({
                restaurantId: restaurantCode,
                deliveryBoyId: deliveryBoyId,
            }).toString();

            const res = await fetch(`/api/delivery/status?${query}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-restaurant-id': restaurantCode,
                },
                body: JSON.stringify({
                    assignmentId,
                    status: newStatus,
                    restaurantId: restaurantCode,
                    deliveryBoyId,
                    ...extra,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast.success(`Delivery status updated to ${newStatus.replace(/_/g, ' ')}`);
            await fetchAssignments(true);
        } catch (err: any) {
            toast.error(err.message || 'Failed to update delivery status');
        } finally {
            if (isMountedRef.current) setUpdatingId(null);
        }
    };

    // ── Report Issue on Order ──
    const handleSubmitIssue = async (assignmentId: string, issueType: string, description: string) => {
        try {
            const query = new URLSearchParams({
                restaurantId: restaurantCode,
                deliveryBoyId: deliveryBoyId,
            }).toString();

            const res = await fetch(`/api/delivery/status?${query}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-restaurant-id': restaurantCode,
                },
                body: JSON.stringify({
                    assignmentId,
                    status: 'CANCELLED',
                    cancellation_reason: `${issueType}${description ? ': ' + description : ''}`,
                    notes: `Reported issue by delivery employee: ${issueType}. ${description}`,
                    restaurantId: restaurantCode,
                    deliveryBoyId,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            toast.warning('Issue reported and flagged for restaurant manager.');
            await fetchAssignments(true);
        } catch (err: any) {
            toast.error(err.message || 'Failed to report issue');
            throw err;
        }
    };

    // ── Toggle Online / Offline ──
    const handleToggleOnline = async () => {
        if (togglingOnline) return;
        setTogglingOnline(true);
        const nextStatus = isOnline ? 'offline' : 'active';
        try {
            const query = new URLSearchParams({
                restaurantId: restaurantCode,
                deliveryBoyId: deliveryBoyId,
            }).toString();

            const res = await fetch(`/api/delivery/profile?${query}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-restaurant-id': restaurantCode,
                },
                body: JSON.stringify({
                    deliveryBoyId,
                    status: nextStatus,
                    restaurantId: restaurantCode,
                }),
            });
            if (res.ok) {
                setIsOnline(!isOnline);
                toast.success(isOnline ? 'You are now Offline • On break' : 'You are now Online • Ready for deliveries');
            }
        } catch (err) {
            toast.error('Failed to update status');
        } finally {
            setTogglingOnline(false);
        }
    };

    // ── Profile Photo Upload ──
    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingPhoto(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('deliveryBoyId', deliveryBoyId);
            fd.append('restaurantId', restaurantCode);

            const query = new URLSearchParams({
                restaurantId: restaurantCode,
                deliveryBoyId: deliveryBoyId,
            }).toString();

            const res = await fetch(`/api/delivery/profile?${query}`, {
                method: 'POST',
                headers: {
                    'x-restaurant-id': restaurantCode,
                },
                body: fd,
            });
            const d = await res.json();
            if (d.success && d.avatarUrl) {
                setProfile((prev: any) => ({ ...prev, avatarUrl: d.avatarUrl }));
                toast.success('Profile photo updated successfully');
            }
        } catch {
            toast.error('Failed to upload photo');
        } finally {
            setUploadingPhoto(false);
        }
    };

    // ── Sign Out ──
    const handleSignOut = () => {
        if (!confirm('Are you sure you want to sign out from Dine in One?')) return;
        localStorage.removeItem('dine_token');
        router.push(`/${restaurantCode}/delivery/login`);
    };

    // ── Categorized Deliveries ──
    const activeDeliveries = useMemo(() => {
        return assignments.filter(a => ['ACCEPTED', 'PICKED_UP', 'OUT_FOR_DELIVERY'].includes(a.status));
    }, [assignments]);

    const assignedDeliveries = useMemo(() => {
        return assignments.filter(a => a.status === 'ASSIGNED');
    }, [assignments]);

    const completedDeliveries = useMemo(() => {
        return assignments.filter(a => ['DELIVERED', 'CANCELLED', 'REASSIGNED'].includes(a.status));
    }, [assignments]);

    // Primary current focus delivery (highest urgency for Hero card & Map)
    const currentFocusDelivery = useMemo(() => {
        return activeDeliveries[0] || assignedDeliveries[0] || null;
    }, [activeDeliveries, assignedDeliveries]);

    // Filtered list for Deliveries Tab
    const displayedDeliveries = useMemo(() => {
        let baseList: DeliveryAssignment[] = [];
        if (deliveryTab === 'assigned') baseList = assignedDeliveries;
        else if (deliveryTab === 'active') baseList = activeDeliveries;
        else if (deliveryTab === 'completed') baseList = completedDeliveries;

        if (!searchQuery.trim()) return baseList;

        const q = searchQuery.toLowerCase().trim();
        return baseList.filter(a => {
            const oNum = String(a.order?.order_number || '');
            const cName = (a.order?.customer_name || '').toLowerCase();
            const cPhone = (a.order?.delivery_phone || a.order?.customer_phone || '').toLowerCase();
            const addr = (a.order?.delivery_address || '').toLowerCase();
            return oNum.includes(q) || cName.includes(q) || cPhone.includes(q) || addr.includes(q);
        });
    }, [deliveryTab, assignedDeliveries, activeDeliveries, completedDeliveries, searchQuery]);

    // Today's Work Overview counts
    const todayAssignedCount = assignments.length;
    const todayPendingCount = assignedDeliveries.length + activeDeliveries.length;
    const todayCompletedCount = completedDeliveries.filter(a => a.status === 'DELIVERED').length;

    return (
        <div className="max-w-md mx-auto w-full min-h-screen bg-[#e8edf5] dark:bg-[#15181e] text-slate-800 dark:text-slate-100 flex flex-col relative pb-28 font-sans selection:bg-orange-500/20">
            {/* ── Top Bar / Header (Showing ONLY Restaurant Information) ── */}
            <header className="sticky top-0 z-30 bg-[#e8edf5]/90 dark:bg-[#1a1e26]/90 backdrop-blur-xl border-b border-white/60 dark:border-white/5 px-4 py-3.5 shadow-[-4px_-4px_12px_rgba(255,255,255,0.8),4px_4px_12px_rgba(163,177,198,0.35)] dark:shadow-[-2px_-2px_8px_rgba(255,255,255,0.02),2px_2px_10px_rgba(0,0,0,0.6)]">
                <div className="flex items-center justify-between gap-3">
                    {/* Restaurant Branding Only (No delivery boy info in header) */}
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-10 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] p-1 flex items-center justify-center shrink-0 border border-white/60 dark:border-white/5 overflow-hidden">
                            {profile?.restaurantLogo ? (
                                <img src={profile.restaurantLogo} alt="Restaurant" className="size-full rounded-xl object-cover" />
                            ) : (
                                <Building2 size={20} className="text-orange-600 dark:text-orange-400" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate leading-tight">
                                {profile?.restaurantName || 'Dine in One'}
                            </h1>
                            <p className="text-[11px] font-bold text-orange-600 dark:text-orange-400 tracking-wide truncate">
                                {profile?.branchName || 'Dispatch & Kitchen'}
                            </p>
                        </div>
                    </div>

                    {/* Online / Offline Status Toggle & Refresh */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            disabled={togglingOnline}
                            onClick={handleToggleOnline}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                isOnline
                                    ? 'bg-[#e8edf5] dark:bg-[#1a1e26] text-emerald-600 dark:text-emerald-400 shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] border border-emerald-500/30'
                                    : 'bg-[#e2e8f2] dark:bg-[#13161c] text-slate-500 dark:text-slate-400 shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4)]'
                            }`}
                            title="Toggle Shift Work Status"
                        >
                            <span className={`size-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                            <span>{isOnline ? 'Online' : 'Offline'}</span>
                        </button>

                        <button
                            onClick={() => { fetchAssignments(false); fetchProfile(); }}
                            className="p-2 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer"
                            title="Refresh Data"
                        >
                            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-orange-500' : ''} />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Main Content Area ── */}
            <main className="flex-1 px-4 py-4 w-full">
                {/* ══════════════════════════════════════════════════
                    SECTION 1: HOME (Clean Daily Work Overview)
                   ══════════════════════════════════════════════════ */}
                {activeSection === 'home' && (
                    <div className="space-y-4">
                        {/* Offline Warning if currently offline */}
                        {!isOnline && (
                            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                                    <span>You are currently <b>Offline</b>. Go Online to receive deliveries.</span>
                                </div>
                                <button
                                    onClick={handleToggleOnline}
                                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-[11px] shrink-0 shadow-md cursor-pointer"
                                >
                                    Go Online
                                </button>
                            </div>
                        )}

                        {/* Daily Work Summary Cards (Neumorphic) */}
                        <div>
                            <div className="flex items-center justify-between mb-2.5 px-1">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    Today's Work Summary
                                </h3>
                                <span className="text-[11px] font-semibold text-slate-400">Fixed Salaried</span>
                            </div>

                            <div className="grid grid-cols-3 gap-2.5">
                                {/* Assigned */}
                                <div 
                                    onClick={() => { setActiveSection('deliveries'); setDeliveryTab('assigned'); }}
                                    className="bg-[#e8edf5] dark:bg-[#1a1e26] p-3.5 rounded-3xl shadow-[-5px_-5px_12px_rgba(255,255,255,0.9),5px_5px_12px_rgba(163,177,198,0.4)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),3px_3px_10px_rgba(0,0,0,0.5)] border border-white/60 dark:border-white/5 cursor-pointer active:scale-98 transition-all"
                                >
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned</p>
                                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{todayAssignedCount}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Orders total</p>
                                </div>

                                {/* Active / Pending */}
                                <div 
                                    onClick={() => { setActiveSection('deliveries'); setDeliveryTab('active'); }}
                                    className="bg-[#e8edf5] dark:bg-[#1a1e26] p-3.5 rounded-3xl shadow-[-5px_-5px_12px_rgba(255,255,255,0.9),5px_5px_12px_rgba(163,177,198,0.4)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),3px_3px_10px_rgba(0,0,0,0.5)] border border-white/60 dark:border-white/5 cursor-pointer active:scale-98 transition-all"
                                >
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending</p>
                                    <p className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1">{todayPendingCount}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">In progress</p>
                                </div>

                                {/* Completed */}
                                <div 
                                    onClick={() => { setActiveSection('deliveries'); setDeliveryTab('completed'); }}
                                    className="bg-[#e8edf5] dark:bg-[#1a1e26] p-3.5 rounded-3xl shadow-[-5px_-5px_12px_rgba(255,255,255,0.9),5px_5px_12px_rgba(163,177,198,0.4)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),3px_3px_10px_rgba(0,0,0,0.5)] border border-white/60 dark:border-white/5 cursor-pointer active:scale-98 transition-all"
                                >
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Delivered</p>
                                    <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{todayCompletedCount}</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Completed</p>
                                </div>
                            </div>
                        </div>

                        {/* Hero / Focus Delivery Action Card */}
                        <div>
                            <div className="flex items-center justify-between mb-2 px-1">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    Current Delivery Action
                                </h3>
                                {currentFocusDelivery && (
                                    <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400">
                                        Urgent
                                    </span>
                                )}
                            </div>

                            {currentFocusDelivery ? (
                                <DeliveryCard
                                    assignment={currentFocusDelivery}
                                    isUpdating={updatingId === currentFocusDelivery.id}
                                    onUpdateStatus={handleUpdateStatus}
                                    onOpenDetails={(a) => setSelectedOrderDetails(a)}
                                    onReportIssue={(a) => setReportIssueAssignment(a)}
                                    onConfirmDelivery={(a) => setConfirmDeliveryAssignment(a)}
                                />
                            ) : (
                                <div className="bg-[#e8edf5] dark:bg-[#1a1e26] rounded-3xl p-6 shadow-[-6px_-6px_16px_rgba(255,255,255,0.9),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),4px_4px_14px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/5 text-center space-y-2">
                                    <div className="size-12 rounded-2xl bg-[#e2e8f2] dark:bg-[#13161c] text-orange-600 mx-auto flex items-center justify-center">
                                        <Package size={24} />
                                    </div>
                                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100">
                                        Standing by for Deliveries
                                    </h4>
                                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                                        You have no active orders right now. When the kitchen or manager assigns an order, it will appear here instantly.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════
                    SECTION 2: DELIVERIES (Primary Working Section)
                   ══════════════════════════════════════════════════ */}
                {activeSection === 'deliveries' && (
                    <div className="space-y-4">
                        {/* Sub-tabs: Assigned, Active, Completed (Neumorphic Track) */}
                        <div className="bg-[#e2e8f2] dark:bg-[#13161c] p-1.5 rounded-2xl shadow-[inset_2px_2px_5px_rgba(163,177,198,0.45),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] grid grid-cols-3 gap-1">
                            <button
                                onClick={() => setDeliveryTab('assigned')}
                                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    deliveryTab === 'assigned'
                                        ? 'bg-[#e8edf5] dark:bg-[#1f242e] text-blue-600 dark:text-blue-400 shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),2px_2px_6px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_6px_rgba(0,0,0,0.5)]'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                                }`}
                            >
                                <span>Assigned</span>
                                {assignedDeliveries.length > 0 && (
                                    <span className="size-4.5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-black">
                                        {assignedDeliveries.length}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => setDeliveryTab('active')}
                                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    deliveryTab === 'active'
                                        ? 'bg-[#e8edf5] dark:bg-[#1f242e] text-orange-600 dark:text-orange-400 shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),2px_2px_6px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_6px_rgba(0,0,0,0.5)]'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                                }`}
                            >
                                <span>Active</span>
                                {activeDeliveries.length > 0 && (
                                    <span className="size-4.5 rounded-full bg-orange-600 text-white text-[10px] flex items-center justify-center font-black">
                                        {activeDeliveries.length}
                                    </span>
                                )}
                            </button>

                            <button
                                onClick={() => setDeliveryTab('completed')}
                                className={`py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    deliveryTab === 'completed'
                                        ? 'bg-[#e8edf5] dark:bg-[#1f242e] text-emerald-600 dark:text-emerald-400 shadow-[-2px_-2px_6px_rgba(255,255,255,0.9),2px_2px_6px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_6px_rgba(0,0,0,0.5)]'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                                }`}
                            >
                                <span>Completed</span>
                                {completedDeliveries.length > 0 && (
                                    <span className="size-4.5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-black">
                                        {completedDeliveries.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Search Input (Neumorphic Inset) */}
                        <div className="relative">
                            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search by order #, customer, address..."
                                className="w-full pl-9 pr-4 py-3 bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.45),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl text-xs text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none"
                            />
                        </div>

                        {/* Delivery Cards List */}
                        <div className="space-y-3.5">
                            {displayedDeliveries.length > 0 ? (
                                displayedDeliveries.map((assignment) => (
                                    <DeliveryCard
                                        key={assignment.id}
                                        assignment={assignment}
                                        isUpdating={updatingId === assignment.id}
                                        onUpdateStatus={handleUpdateStatus}
                                        onOpenDetails={(a) => setSelectedOrderDetails(a)}
                                        onReportIssue={(a) => setReportIssueAssignment(a)}
                                        onConfirmDelivery={(a) => setConfirmDeliveryAssignment(a)}
                                    />
                                ))
                            ) : (
                                <div className="text-center py-16 bg-[#e8edf5] dark:bg-[#1a1e26] rounded-3xl shadow-[-6px_-6px_16px_rgba(255,255,255,0.9),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),4px_4px_14px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/5 p-6">
                                    <div className="size-14 rounded-2xl bg-[#e2e8f2] dark:bg-[#13161c] text-slate-400 mx-auto flex items-center justify-center mb-3">
                                        <Package size={26} />
                                    </div>
                                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">
                                        {searchQuery ? 'No matching deliveries found' : `No ${deliveryTab} deliveries`}
                                    </h4>
                                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                                        {deliveryTab === 'assigned'
                                            ? 'New orders assigned by the restaurant will appear here.'
                                            : deliveryTab === 'active'
                                                ? 'Orders currently picked up and on the way will show here.'
                                                : 'Delivered orders will be archived here for your records.'}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════
                    SECTION 3: MAP (Navigation & Location Information)
                   ══════════════════════════════════════════════════ */}
                {activeSection === 'map' && (
                    <div className="space-y-3">
                        <DeliveryMap
                            activeDelivery={currentFocusDelivery}
                            restaurantLat={profile?.restaurantLat}
                            restaurantLng={profile?.restaurantLng}
                            restaurantName={profile?.restaurantName}
                            restaurantAddress={profile?.restaurantAddress}
                            onUpdateStatus={handleUpdateStatus}
                            onOpenDetails={(a) => setSelectedOrderDetails(a)}
                        />
                    </div>
                )}

                {/* ══════════════════════════════════════════════════
                    SECTION 4: PROFILE (Separate Buttons Architecture)
                   ══════════════════════════════════════════════════ */}
                {activeSection === 'profile' && (
                    <div className="space-y-4">
                        {/* If in a sub-section, show back button bar */}
                        {profileSubSection !== 'menu' && (
                            <button
                                onClick={() => setProfileSubSection('menu')}
                                className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                            >
                                <ArrowLeft size={16} />
                                <span>Back to Profile Menu</span>
                            </button>
                        )}

                        {/* Top Employee Profile Card (always visible) */}
                        <div className="bg-[#e8edf5] dark:bg-[#1a1e26] rounded-3xl p-5 shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),4px_4px_14px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="relative group">
                                    <div className="size-18 rounded-2xl bg-[#e2e8f2] dark:bg-[#12151b] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.02)] flex items-center justify-center overflow-hidden">
                                        {profile?.avatarUrl ? (
                                            <img
                                                src={profile.avatarUrl}
                                                alt={profile.name}
                                                className="size-full object-cover"
                                            />
                                        ) : (
                                            <User size={30} className="text-slate-400" />
                                        )}
                                    </div>
                                    <button
                                        disabled={uploadingPhoto}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute -bottom-1 -right-1 p-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md cursor-pointer"
                                        title="Change Photo"
                                    >
                                        <Camera size={12} />
                                    </button>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePhotoUpload}
                                        className="hidden"
                                    />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <h3 className="text-base font-black text-slate-900 dark:text-white truncate">
                                            {profile?.name || 'Delivery Executive'}
                                        </h3>
                                        <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-400 mt-0.5">
                                        Emp ID: <span className="font-mono text-slate-700 dark:text-slate-300">{profile?.empCode || 'EMP-DEL-001'}</span>
                                    </p>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                                            Salaried Employee
                                        </span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            isOnline ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-slate-200 text-slate-500'
                                        }`}>
                                            {isOnline ? 'Online' : 'Offline'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Sub-Section 1: Main Menu of Separate Section Buttons ── */}
                        {profileSubSection === 'menu' && (
                            <div className="space-y-4">
                                <div className="space-y-2.5">
                                    {/* 1. Personal Information Button */}
                                    <button
                                        onClick={() => setProfileSubSection('personal')}
                                        className="w-full p-4 rounded-3xl bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-5px_-5px_12px_rgba(255,255,255,0.9),5px_5px_12px_rgba(163,177,198,0.4)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),3px_3px_10px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] border border-white/60 dark:border-white/5 flex items-center justify-between text-left transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3.5">
                                            <div className="size-11 rounded-2xl bg-[#e2e8f2] dark:bg-[#13161c] text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                                <User size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 dark:text-white">Personal Information</h4>
                                                <p className="text-[11px] text-slate-400">Phone, employee code & branch details</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-400" />
                                    </button>

                                    {/* 2. Vehicle Information Button */}
                                    <button
                                        onClick={() => setProfileSubSection('vehicle')}
                                        className="w-full p-4 rounded-3xl bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-5px_-5px_12px_rgba(255,255,255,0.9),5px_5px_12px_rgba(163,177,198,0.4)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),3px_3px_10px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] border border-white/60 dark:border-white/5 flex items-center justify-between text-left transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3.5">
                                            <div className="size-11 rounded-2xl bg-[#e2e8f2] dark:bg-[#13161c] text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                                                <Bike size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 dark:text-white">Vehicle Information</h4>
                                                <p className="text-[11px] text-slate-400">{profile?.vehicleType || 'Motorcycle'} ({profile?.vehicleNumber || 'Standard'})</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-400" />
                                    </button>

                                    {/* 3. Attendance Summary Button */}
                                    <button
                                        onClick={() => setProfileSubSection('attendance')}
                                        className="w-full p-4 rounded-3xl bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-5px_-5px_12px_rgba(255,255,255,0.9),5px_5px_12px_rgba(163,177,198,0.4)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),3px_3px_10px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] border border-white/60 dark:border-white/5 flex items-center justify-between text-left transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3.5">
                                            <div className="size-11 rounded-2xl bg-[#e2e8f2] dark:bg-[#13161c] text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                                <Calendar size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 dark:text-white">Attendance Summary</h4>
                                                <p className="text-[11px] text-slate-400">Monthly shift summary & logs</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-400" />
                                    </button>

                                    {/* 4. Salary & Compensation Button */}
                                    <button
                                        onClick={() => setProfileSubSection('salary')}
                                        className="w-full p-4 rounded-3xl bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-5px_-5px_12px_rgba(255,255,255,0.9),5px_5px_12px_rgba(163,177,198,0.4)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),3px_3px_10px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] border border-white/60 dark:border-white/5 flex items-center justify-between text-left transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3.5">
                                            <div className="size-11 rounded-2xl bg-[#e2e8f2] dark:bg-[#13161c] text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                <CreditCard size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 dark:text-white">Salary & Compensation</h4>
                                                <p className="text-[11px] text-slate-400">Fixed monthly pay breakdown & payslips</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-400" />
                                    </button>

                                    {/* 5. Leaves & Documents Button */}
                                    <button
                                        onClick={() => setProfileSubSection('leaves')}
                                        className="w-full p-4 rounded-3xl bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-5px_-5px_12px_rgba(255,255,255,0.9),5px_5px_12px_rgba(163,177,198,0.4)] dark:shadow-[-3px_-3px_8px_rgba(255,255,255,0.02),3px_3px_10px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] border border-white/60 dark:border-white/5 flex items-center justify-between text-left transition-all cursor-pointer"
                                    >
                                        <div className="flex items-center gap-3.5">
                                            <div className="size-11 rounded-2xl bg-[#e2e8f2] dark:bg-[#13161c] text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                                                <FileText size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-slate-900 dark:text-white">Leaves & Documents</h4>
                                                <p className="text-[11px] text-slate-400">Leave balance & verified identity</p>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} className="text-slate-400" />
                                    </button>
                                </div>

                                {/* Emergency Helplines (Shown in bottom of profile section as required) */}
                                <div className="bg-[#e8edf5] dark:bg-[#1a1e26] rounded-3xl p-5 shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),4px_4px_14px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/5 space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                                        <HelpCircle size={16} className="text-red-500" />
                                        <span>Emergency Helplines & Support</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <a
                                            href={`tel:${profile?.restaurantPhone || '+919876543210'}`}
                                            className="p-3 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] text-center block cursor-pointer"
                                        >
                                            <Phone size={16} className="text-orange-500 mx-auto mb-1" />
                                            <span className="font-bold block text-slate-800 dark:text-slate-200">Kitchen Dispatch</span>
                                            <span className="text-[10px] text-slate-400">{profile?.restaurantPhone || 'Direct Call'}</span>
                                        </a>
                                        <a
                                            href={`tel:${profile?.managerPhone || '+919876543210'}`}
                                            className="p-3 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] text-center block cursor-pointer"
                                        >
                                            <Phone size={16} className="text-emerald-500 mx-auto mb-1" />
                                            <span className="font-bold block text-slate-800 dark:text-slate-200">Manager Desk</span>
                                            <span className="text-[10px] text-slate-400">{profile?.managerPhone || 'Direct Call'}</span>
                                        </a>
                                    </div>

                                    {profile?.emergencyContact?.phone && (
                                        <a
                                            href={`tel:${profile.emergencyContact.phone}`}
                                            className="w-full py-2.5 px-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs flex items-center justify-center gap-2"
                                        >
                                            <Phone size={14} />
                                            <span>Emergency Police/Ambulance Desk: {profile.emergencyContact.phone}</span>
                                        </a>
                                    )}
                                </div>

                                {/* Sign Out Button */}
                                <button
                                    onClick={handleSignOut}
                                    className="w-full py-3.5 rounded-3xl bg-[#e8edf5] dark:bg-[#1a1e26] shadow-[-4px_-4px_10px_rgba(255,255,255,0.9),4px_4px_10px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.6)] border border-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
                                >
                                    <LogOut size={16} />
                                    <span>Sign Out from Account</span>
                                </button>
                            </div>
                        )}

                        {/* ── Sub-Section 2: Personal Information View ── */}
                        {profileSubSection === 'personal' && (
                            <div className="bg-[#e8edf5] dark:bg-[#1a1e26] rounded-3xl p-5 shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),4px_4px_14px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/5 space-y-4">
                                <div className="flex items-center gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                                    <User size={18} className="text-blue-500" />
                                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Personal Information</h3>
                                </div>

                                <div className="bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl p-4 space-y-2.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Full Name:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{profile?.name || '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Employee ID:</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{profile?.empCode || '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Mobile Number:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{profile?.mobile || '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Role:</span>
                                        <span className="font-bold text-emerald-600">Salaried Delivery Staff</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Assigned Restaurant:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{profile?.restaurantName || 'Dine in One'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Reporting Branch:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{profile?.branchName || 'Dispatch Hub'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Reporting Manager:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{profile?.managerName || 'Operations Manager'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Joining Date:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{profile?.joiningDate?.split('T')[0] || '2026-09-27'}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Sub-Section 3: Vehicle Information View ── */}
                        {profileSubSection === 'vehicle' && (
                            <div className="bg-[#e8edf5] dark:bg-[#1a1e26] rounded-3xl p-5 shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),4px_4px_14px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/5 space-y-4">
                                <div className="flex items-center gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                                    <Bike size={18} className="text-orange-500" />
                                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Vehicle Information</h3>
                                </div>

                                <div className="bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] rounded-2xl p-4 space-y-2.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Assigned Vehicle:</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">{profile?.vehicleType || 'Motorcycle'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Registration Number:</span>
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{profile?.vehicleNumber || 'Standard'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Fuel & Allowance:</span>
                                        <span className="font-bold text-emerald-600">Company Sponsored</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Thermal Bag:</span>
                                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 size={13} /> Issued & Active
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Sub-Section 4: Attendance Summary View ── */}
                        {profileSubSection === 'attendance' && (
                            <AttendanceSection
                                deliveryBoyId={deliveryBoyId}
                                restaurantId={restaurantCode}
                                initialStatus={profile?.availabilityStatus}
                                history={profile?.attendance?.history}
                                onStatusChange={(s) => setIsOnline(s === 'active')}
                            />
                        )}

                        {/* ── Sub-Section 5: Salary & Compensation View ── */}
                        {profileSubSection === 'salary' && (
                            <SalarySection
                                salary={profile?.salary}
                                employeeName={profile?.name}
                                employeeCode={profile?.empCode}
                            />
                        )}

                        {/* ── Sub-Section 6: Leaves & Documents View ── */}
                        {profileSubSection === 'leaves' && (
                            <div className="bg-[#e8edf5] dark:bg-[#1a1e26] rounded-3xl p-5 shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),4px_4px_14px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/5 space-y-4">
                                <div className="flex items-center gap-2 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                                    <FileText size={18} className="text-teal-500" />
                                    <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">Leave Balance & Documents</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5 text-xs">
                                    <div className="p-3 bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4)] rounded-2xl">
                                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Casual Leaves</span>
                                        <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">4 Remaining</span>
                                    </div>
                                    <div className="p-3 bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4)] rounded-2xl">
                                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Medical Leaves</span>
                                        <span className="text-base font-black text-slate-900 dark:text-white mt-0.5 block">3 Remaining</span>
                                    </div>
                                </div>

                                <div className="bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.4)] rounded-2xl p-4 space-y-2 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Driving License:</span>
                                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 size={13} /> Verified
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Aadhaar / ID Card:</span>
                                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 size={13} /> Verified
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Bank Account for Salary:</span>
                                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 size={13} /> Linked
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ── Fixed Bottom Navigation (Exactly 4 sections: Home, Deliveries, Map, Profile) ── */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#e8edf5]/95 dark:bg-[#1a1e26]/95 backdrop-blur-xl border-t border-white/60 dark:border-white/5 max-w-md mx-auto shadow-[-6px_-6px_16px_rgba(255,255,255,0.9),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.02),4px_4px_14px_rgba(0,0,0,0.6)]">
                <div className="grid grid-cols-4 h-18 px-2">
                    {/* 1. Home */}
                    <button
                        onClick={() => { setActiveSection('home'); setProfileSubSection('menu'); }}
                        className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                            activeSection === 'home'
                                ? 'text-orange-600 dark:text-orange-400 font-black'
                                : 'text-slate-400 dark:text-slate-500 font-bold hover:text-slate-700'
                        }`}
                    >
                        <div className={`p-1.5 rounded-xl transition-all ${
                            activeSection === 'home' 
                                ? 'bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)]' 
                                : ''
                        }`}>
                            <LucideHome size={20} className={activeSection === 'home' ? 'scale-110' : ''} />
                        </div>
                        <span className="text-[10px] tracking-tight">Home</span>
                    </button>

                    {/* 2. Deliveries (with active badge) */}
                    <button
                        onClick={() => { setActiveSection('deliveries'); setProfileSubSection('menu'); }}
                        className={`flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
                            activeSection === 'deliveries'
                                ? 'text-orange-600 dark:text-orange-400 font-black'
                                : 'text-slate-400 dark:text-slate-500 font-bold hover:text-slate-700'
                        }`}
                    >
                        <div className="relative">
                            <div className={`p-1.5 rounded-xl transition-all ${
                                activeSection === 'deliveries' 
                                    ? 'bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)]' 
                                    : ''
                            }`}>
                                <Package size={20} className={activeSection === 'deliveries' ? 'scale-110' : ''} />
                            </div>
                            {activeDeliveries.length + assignedDeliveries.length > 0 && (
                                <span className="absolute -top-1 -right-2 size-4.5 rounded-full bg-orange-600 text-white font-black text-[9px] flex items-center justify-center shadow-md">
                                    {activeDeliveries.length + assignedDeliveries.length}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] tracking-tight">Deliveries</span>
                    </button>

                    {/* 3. Map */}
                    <button
                        onClick={() => { setActiveSection('map'); setProfileSubSection('menu'); }}
                        className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                            activeSection === 'map'
                                ? 'text-orange-600 dark:text-orange-400 font-black'
                                : 'text-slate-400 dark:text-slate-500 font-bold hover:text-slate-700'
                        }`}
                    >
                        <div className={`p-1.5 rounded-xl transition-all ${
                            activeSection === 'map' 
                                ? 'bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)]' 
                                : ''
                        }`}>
                            <MapPin size={20} className={activeSection === 'map' ? 'scale-110' : ''} />
                        </div>
                        <span className="text-[10px] tracking-tight">Map</span>
                    </button>

                    {/* 4. Profile (Contains separate section buttons) */}
                    <button
                        onClick={() => { setActiveSection('profile'); setProfileSubSection('menu'); }}
                        className={`flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                            activeSection === 'profile'
                                ? 'text-orange-600 dark:text-orange-400 font-black'
                                : 'text-slate-400 dark:text-slate-500 font-bold hover:text-slate-700'
                        }`}
                    >
                        <div className={`p-1.5 rounded-xl transition-all ${
                            activeSection === 'profile' 
                                ? 'bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)]' 
                                : ''
                        }`}>
                            <User size={20} className={activeSection === 'profile' ? 'scale-110' : ''} />
                        </div>
                        <span className="text-[10px] tracking-tight">Profile</span>
                    </button>
                </div>
            </nav>

            {/* ── Modals ── */}
            {selectedOrderDetails && (
                <OrderDetailsModal
                    assignment={selectedOrderDetails}
                    onClose={() => setSelectedOrderDetails(null)}
                />
            )}

            {confirmDeliveryAssignment && (
                <DeliveryConfirmationModal
                    assignment={confirmDeliveryAssignment}
                    onClose={() => setConfirmDeliveryAssignment(null)}
                    onConfirm={handleUpdateStatus}
                />
            )}

            {reportIssueAssignment && (
                <ReportIssueModal
                    assignment={reportIssueAssignment}
                    onClose={() => setReportIssueAssignment(null)}
                    onSubmitIssue={handleSubmitIssue}
                />
            )}
        </div>
    );
}
