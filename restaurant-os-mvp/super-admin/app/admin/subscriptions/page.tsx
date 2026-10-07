'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    Zap,
    CreditCard,
    Search,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    ArrowUpRight,
    Sparkles,
    Shield,
    IndianRupee,
    ChevronRight,
    RefreshCw,
    Plus,
    Check,
    X,
    Filter,
    Edit3,
    ArrowRight,
    RotateCcw,
    AlertCircle,
    Ban,
    ArrowDownRight,
    Layers,
    DollarSign,
    Building2,
    User,
    Eye,
    Download,
    History,
    Tag,
    FileText,
    CheckCircle,
    ExternalLink,
    MoreVertical,
    Copy,
    Archive,
    Sliders,
    TrendingUp,
    ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';

type SubTab = 'overview' | 'plans' | 'active' | 'trial' | 'expired' | 'payments' | 'registrations';

// Number animation counter component
function AnimatedCounter({ value, prefix = '', suffix = '' }: { value: number; prefix?: string; suffix?: string }) {
    const [displayVal, setDisplayVal] = useState(0);

    useEffect(() => {
        let start = 0;
        const end = value;
        if (start === end) {
            setDisplayVal(end);
            return;
        }

        const duration = 600;
        const stepTime = Math.max(16, Math.floor(duration / Math.max(end, 1)));
        const step = Math.max(1, Math.ceil(end / 30));

        const timer = setInterval(() => {
            start += step;
            if (start >= end) {
                setDisplayVal(end);
                clearInterval(timer);
            } else {
                setDisplayVal(start);
            }
        }, stepTime);

        return () => clearInterval(timer);
    }, [value]);

    return (
        <span>
            {prefix}
            {displayVal.toLocaleString('en-IN')}
            {suffix}
        </span>
    );
}

const ALL_FEATURES_CATALOG: {
    key: string;
    label: string;
    category: 'ordering' | 'operations' | 'management' | 'intelligence' | 'multi_unit' | 'addon';
    categoryLabel: string;
    minPlan: string;
    desc: string;
}[] = [
    // Ordering & Menus
    { key: 'qr_ordering', label: 'QR Digital Ordering', category: 'ordering', categoryLabel: 'Ordering & Menus', minPlan: 'Standard', desc: 'Contactless QR codes for dining tables to allow mobile ordering.' },
    { key: 'digital_menu', label: 'Digital Menu', category: 'ordering', categoryLabel: 'Ordering & Menus', minPlan: 'Standard', desc: 'Online digital menu catalog with veg/non-veg tags, descriptions, and pictures.' },
    { key: 'customer_ordering', label: 'Customer Ordering', category: 'ordering', categoryLabel: 'Ordering & Menus', minPlan: 'Standard', desc: 'Direct cart checkout and order placement from customer mobile browser.' },
    { key: 'table_management', label: 'Table Management', category: 'ordering', categoryLabel: 'Ordering & Menus', minPlan: 'Standard', desc: 'Live floor plan, physical table numbering, occupancy status, and QR generation.' },
    { key: 'menu_management', label: 'Menu Management', category: 'ordering', categoryLabel: 'Ordering & Menus', minPlan: 'Standard', desc: 'Admin menu editor, price configuration, item variants, categories, and availability toggle.' },
    { key: 'offers_discounts', label: 'Offers & Discounts', category: 'ordering', categoryLabel: 'Ordering & Menus', minPlan: 'Standard', desc: 'Promo coupon codes, percentage/flat discounts, and bill-level discount management.' },
    { key: 'central_menu', label: 'Central Menu Management', category: 'ordering', categoryLabel: 'Ordering & Menus', minPlan: 'Pro', desc: 'Master menu catalog propagated across multiple branch restaurants in 1 click.' },

    // Operations & Kitchen
    { key: 'pos', label: 'POS Billing & Checkout', category: 'operations', categoryLabel: 'Operations & Kitchen', minPlan: 'Standard', desc: 'Cashier checkout terminal, cash/UPI payment collection, and instant bill generation.' },
    { key: 'waiter_panel', label: 'Waiter Panel', category: 'operations', categoryLabel: 'Operations & Kitchen', minPlan: 'Standard', desc: 'Mobile order punch portal, assigned table tracking, and digital service calls.' },
    { key: 'kds', label: 'Kitchen Display System (KDS)', category: 'operations', categoryLabel: 'Operations & Kitchen', minPlan: 'Standard', desc: 'Live real-time digital kitchen order ticket screen for cooking line staff.' },
    { key: 'delivery', label: 'Delivery Management', category: 'operations', categoryLabel: 'Operations & Kitchen', minPlan: 'Growth', desc: 'Online delivery orders, driver assignment, real-time live GPS tracking, and delivery zones.' },
    { key: 'inventory', label: 'Inventory & Stock Management', category: 'operations', categoryLabel: 'Operations & Kitchen', minPlan: 'Growth', desc: 'Raw material tracking, supplier purchase orders, and stock consumption logs.' },
    { key: 'recipe_inventory', label: 'Recipe-Level Inventory', category: 'operations', categoryLabel: 'Operations & Kitchen', minPlan: 'Growth', desc: 'Automatic ingredient deduction per menu dish ordered and portion tracking.' },
    { key: 'low_stock_alerts', label: 'Low-Stock Alerts', category: 'operations', categoryLabel: 'Operations & Kitchen', minPlan: 'Growth', desc: 'Automated warnings and notifications when inventory items hit reorder thresholds.' },

    // Staff & Management
    { key: 'staff_management', label: 'Staff Management', category: 'management', categoryLabel: 'Staff & Management', minPlan: 'Standard', desc: 'Create employees, assign roles (waiter, cook, cashier), and mobile login PINs.' },
    { key: 'advanced_staff', label: 'Advanced Staff Management', category: 'management', categoryLabel: 'Staff & Management', minPlan: 'Growth', desc: 'Shift scheduling, attendance audit logs, and performance metrics.' },
    { key: 'multi_restaurant_staff', label: 'Multi-Restaurant Staff Floating', category: 'management', categoryLabel: 'Staff & Management', minPlan: 'Pro', desc: 'Allow employees to work across multiple branches with shared permissions.' },

    // Multi-Unit & Owner
    { key: 'owner_panel', label: 'Owner Panel', category: 'multi_unit', categoryLabel: 'Multi-Unit & Owner', minPlan: 'Pro', desc: 'Founder dashboard to oversee high-level revenue and business accounts.' },
    { key: 'multi_restaurant', label: 'Multi-Restaurant Dashboard', category: 'multi_unit', categoryLabel: 'Multi-Unit & Owner', minPlan: 'Pro', desc: 'Manage 2+ independent restaurant locations from a single master view.' },
    { key: 'cross_restaurant_performance', label: 'Cross-Restaurant Performance', category: 'multi_unit', categoryLabel: 'Multi-Unit & Owner', minPlan: 'Pro', desc: 'Side-by-side branch sales comparisons, peak-hour benchmarking, and leaderboard matrix.' },

    // Intelligence & Reports
    { key: 'basic_reports', label: 'Basic Reports', category: 'intelligence', categoryLabel: 'Intelligence & Reports', minPlan: 'Standard', desc: 'Daily sales totals, payment method breakdown, and item volume summaries.' },
    { key: 'customer_order_history', label: 'Customer Order History', category: 'intelligence', categoryLabel: 'Intelligence & Reports', minPlan: 'Standard', desc: 'Past customer orders, visit timestamps, and digital receipt lookups.' },
    { key: 'advanced_reports', label: 'Advanced Reports', category: 'intelligence', categoryLabel: 'Intelligence & Reports', minPlan: 'Growth', desc: 'Hourly sales heatmaps, discount leak audits, category profit margins, and tax filing CSVs.' },
    { key: 'advanced_analytics', label: 'Advanced Customer Analytics', category: 'intelligence', categoryLabel: 'Intelligence & Reports', minPlan: 'Growth', desc: 'Customer retention cohorts, repeat diner frequency, and average ticket size analysis.' },
    { key: 'consolidated_reports', label: 'Consolidated Multi-Branch Reports', category: 'intelligence', categoryLabel: 'Intelligence & Reports', minPlan: 'Pro', desc: 'Cross-branch revenue aggregation, franchise royal calculations, and unified export.' },

    // Add-on
    { key: 'whatsapp_bills', label: 'WhatsApp Digital Bills (Add-on)', category: 'addon', categoryLabel: 'Add-on', minPlan: 'Paid Add-on', desc: 'Automatic instant delivery of PDF receipts, order updates, and marketing messages via WhatsApp.' }
];

function SubscriptionsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const rawTab = (searchParams.get('tab') || 'overview').toLowerCase();

    // Automatically redirect registration request tabs to Owners Pending Approval
    useEffect(() => {
        if (rawTab === 'requests' || rawTab === 'registrations' || rawTab === 'pending') {
            router.replace('/admin/owners?tab=pending');
        }
    }, [rawTab, router]);

    // Map URL param to tab
    const initialTab: SubTab = useMemo(() => {
        if (rawTab === 'plans') return 'plans';
        if (rawTab === 'active') return 'active';
        if (rawTab === 'trial') return 'trial';
        if (rawTab === 'expired' || rawTab === 'cancelled') return 'expired';
        if (rawTab === 'payments') return 'payments';
        return 'overview';
    }, [rawTab]);

    const [activeTab, setActiveTab] = useState<SubTab>(initialTab);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Filter & Search states
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState('ALL');
    const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED'>('ALL');
    const [annualPricingToggle, setAnnualPricingToggle] = useState(false);

    // Registration Request Action States
    const [selectedReqForAction, setSelectedReqForAction] = useState<any | null>(null);
    const [actionModalType, setActionModalType] = useState<'approve' | 'reject' | 'request_payment' | 'change_plan' | 'set_quota' | 'suspend' | 'cancel' | 'mark_payment' | 'undo_payment' | null>(null);
    const [reqActionQuota, setReqActionQuota] = useState<number | string>('');
    const [reqActionPlan, setReqActionPlan] = useState<string>('standard');
    const [reqActionNotes, setReqActionNotes] = useState<string>('');
    const [reqActionReason, setReqActionReason] = useState<string>('');
    const [reqFilterStatus, setReqFilterStatus] = useState<'ALL' | 'PENDING_APPROVAL' | 'PENDING_PAYMENT' | 'ACTIVE' | 'REJECTED'>('ALL');

    // Modal States
    const [selectedSub, setSelectedSub] = useState<any | null>(null);
    const [changePlanSub, setChangePlanSub] = useState<any | null>(null);
    const [extendSub, setExtendSub] = useState<any | null>(null);
    const [extendTrialSub, setExtendTrialSub] = useState<any | null>(null);
    const [convertTrialSub, setConvertTrialSub] = useState<any | null>(null);
    const [suspendSub, setSuspendSub] = useState<any | null>(null);
    const [cancelSub, setCancelSub] = useState<any | null>(null);
    const [reactivateSub, setReactivateSub] = useState<any | null>(null);
    const [createPlanOpen, setCreatePlanOpen] = useState(false);
    const [editPlan, setEditPlan] = useState<any | null>(null);
    const [manualPayOpen, setManualPayOpen] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Feature Overrides Modal States
    const [overrideSub, setOverrideSub] = useState<any | null>(null);
    const [overrideFeatureKey, setOverrideFeatureKey] = useState<string>('whatsapp_bills');
    const [overrideEnabled, setOverrideEnabled] = useState<boolean>(true);
    const [overrideReason, setOverrideReason] = useState<string>('');
    const [overrideExpiryDays, setOverrideExpiryDays] = useState<number | ''>(30);
    const [overrideCategoryFilter, setOverrideCategoryFilter] = useState<string>('ALL');
    const [overrideSearch, setOverrideSearch] = useState<string>('');

    // Form inputs for modals
    const [modalPlanSlug, setModalPlanSlug] = useState('growth');
    const [modalBillingCycle, setModalBillingCycle] = useState<'monthly' | 'annual'>('monthly');
    const [modalDays, setModalDays] = useState<number | string>('');
    const [modalReason, setModalReason] = useState('');
    const [modalAmount, setModalAmount] = useState<number | string>('');
    const [modalPayMethod, setModalPayMethod] = useState('UPI AutoDebit');
    const [modalNotes, setModalNotes] = useState('');
    const [modalTargetRestId, setModalTargetRestId] = useState('');

    // Plan form state
    const [planForm, setPlanForm] = useState<{
        name: string;
        slug: string;
        tagline: string;
        priceMonthly: number | string;
        priceAnnual: number | string;
        trialDays: number | string;
        features: string[];
        featureInput: string;
        maxBranches: number | string;
        maxEmployees: number | string;
        maxOrdersPerMonth: string;
        isPopular: boolean;
    }>({
        name: '',
        slug: '',
        tagline: '',
        priceMonthly: '',
        priceAnnual: '',
        trialDays: '',
        features: ['Up to 5 Branches', 'Real-Time POS & KDS', 'QR Digital Ordering', 'Basic Reports'],
        featureInput: '',
        maxBranches: '',
        maxEmployees: '',
        maxOrdersPerMonth: '',
        isPopular: false
    });

    const handleTabChange = (tab: SubTab) => {
        setActiveTab(tab);
        const url = tab === 'overview' ? '/admin/subscriptions' : `/admin/subscriptions?tab=${tab}`;
        window.history.pushState(null, '', url);
    };

    const fetchSubscriptions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/subscriptions');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            } else {
                toast.error('Failed to load subscriptions data');
            }
        } catch (err) {
            console.error('Failed to load subscriptions:', err);
            toast.error('Network error loading subscriptions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSubscriptions();
    }, []);

    // Sync active tab with url changes
    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    // Copy to clipboard helper
    const handleCopy = (text: string, label = 'ID') => {
        navigator.clipboard.writeText(text);
        toast.success(`Copied ${label}: ${text}`);
    };

    // ==========================================
    // ACTION HANDLERS
    // ==========================================

    const handleRegistrationAction = async (actionName: string, reqId: string, additionalParams: any = {}) => {
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: actionName,
                    requestId: reqId,
                    ...additionalParams
                })
            });
            const result = await res.json();
            if (res.ok) {
                toast.success(result.message || 'Action executed successfully');
                setActionModalType(null);
                setSelectedReqForAction(null);
                fetchSubscriptions();
            } else {
                toast.error(result.error || 'Failed to execute action');
            }
        } catch (err: any) {
            console.error('Registration action error:', err);
            toast.error('Network error executing registration action');
        } finally {
            setActionLoading(false);
        }
    };

    const handleChangePlan = async () => {
        if (!changePlanSub) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: changePlanSub.restaurantId,
                    action: 'change_plan',
                    planSlug: modalPlanSlug,
                    billingCycle: modalBillingCycle
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || 'Plan changed successfully!');
                setChangePlanSub(null);
                fetchSubscriptions();
            } else {
                toast.error(json.error || 'Failed to change plan');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error executing request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleExtendSubscription = async () => {
        if (!extendSub) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: extendSub.restaurantId,
                    action: 'extend_subscription',
                    days: modalDays
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || 'Subscription extended successfully!');
                setExtendSub(null);
                fetchSubscriptions();
            } else {
                toast.error(json.error || 'Failed to extend subscription');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error executing request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleExtendTrial = async () => {
        if (!extendTrialSub) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: extendTrialSub.restaurantId,
                    action: 'extend_trial',
                    trialDays: modalDays
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || 'Trial extended successfully!');
                setExtendTrialSub(null);
                fetchSubscriptions();
            } else {
                toast.error(json.error || 'Failed to extend trial');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error executing request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleConvertTrialToPaid = async () => {
        if (!convertTrialSub) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: convertTrialSub.restaurantId,
                    action: 'convert_trial_to_paid',
                    planSlug: modalPlanSlug,
                    billingCycle: modalBillingCycle,
                    recordInitialPayment: true
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || 'Converted trial to paid subscription!');
                setConvertTrialSub(null);
                fetchSubscriptions();
            } else {
                toast.error(json.error || 'Failed to convert trial');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error executing request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleSuspend = async () => {
        if (!suspendSub) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: suspendSub.restaurantId,
                    action: 'suspend',
                    reason: modalReason || 'Administrative suspension'
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success('Restaurant subscription suspended.');
                setSuspendSub(null);
                fetchSubscriptions();
            } else {
                toast.error(json.error || 'Failed to suspend subscription');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error executing request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleCancel = async () => {
        if (!cancelSub) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: cancelSub.restaurantId,
                    action: cancelSub.status === 'TRIAL' ? 'cancel_trial' : 'cancel',
                    reason: modalReason || 'Cancelled by Super Admin'
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success('Subscription cancelled.');
                setCancelSub(null);
                fetchSubscriptions();
            } else {
                toast.error(json.error || 'Failed to cancel subscription');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error executing request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReactivate = async () => {
        if (!reactivateSub) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: reactivateSub.restaurantId,
                    action: 'reactivate',
                    planSlug: modalPlanSlug,
                    billingCycle: modalBillingCycle
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success('Subscription successfully reactivated!');
                setReactivateSub(null);
                fetchSubscriptions();
            } else {
                toast.error(json.error || 'Failed to reactivate subscription');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error executing request');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRecordManualPayment = async () => {
        if (!modalTargetRestId || !modalAmount) {
            toast.error('Please select a restaurant and enter valid amount.');
            return;
        }
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: modalTargetRestId,
                    action: 'record_manual_payment',
                    amount: modalAmount,
                    paymentMethod: modalPayMethod,
                    notes: modalNotes,
                    days: modalDays || 30
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || 'Payment recorded successfully!');
                setManualPayOpen(false);
                fetchSubscriptions();
            } else {
                toast.error(json.error || 'Failed to record payment');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error recording payment');
        } finally {
            setActionLoading(false);
        }
    };

    // ==========================================
    // FEATURE OVERRIDE HANDLERS
    // ==========================================
    const handleSetFeatureOverride = async (fKey?: string, en?: boolean, reas?: string, days?: number | '') => {
        if (!overrideSub) return;
        const targetKey = fKey || overrideFeatureKey;
        const isEn = en !== undefined ? en : overrideEnabled;
        const reasonText = reas !== undefined ? reas : overrideReason;
        const numDays = days !== undefined ? days : overrideExpiryDays;

        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: overrideSub.restaurantId,
                    action: 'set_feature_override',
                    featureKey: targetKey,
                    enabled: isEn,
                    reason: reasonText || `Administrative feature override (${isEn ? 'enabled' : 'disabled'})`,
                    expiryDays: numDays === '' ? 0 : Number(numDays)
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || 'Feature override updated successfully');
                await fetchSubscriptions();
                setOverrideSub((prev: any) => {
                    if (!prev) return null;
                    const updatedOverrides = (prev.overrides || []).filter((o: any) => o.feature_key !== targetKey);
                    updatedOverrides.push(json.override || {
                        feature_key: targetKey,
                        enabled: isEn,
                        reason: reasonText,
                        starts_at: new Date().toISOString(),
                        expires_at: numDays ? new Date(Date.now() + Number(numDays) * 86400000).toISOString() : null
                    });
                    const updatedFeatures = { ...(prev.features || {}), [targetKey]: isEn };
                    const availableFeatures = Object.keys(updatedFeatures).filter((k) => updatedFeatures[k]);
                    const lockedFeatures = Object.keys(updatedFeatures).filter((k) => !updatedFeatures[k]);
                    return {
                        ...prev,
                        overrides: updatedOverrides,
                        features: updatedFeatures,
                        availableFeatures,
                        lockedFeatures,
                        hasWhatsAppBills: Boolean(updatedFeatures.whatsapp_bills)
                    };
                });
                setOverrideReason('');
            } else {
                toast.error(json.error || 'Failed to update feature override');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error updating feature override');
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemoveFeatureOverride = async (featureKey: string) => {
        if (!overrideSub) return;
        setActionLoading(true);
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: overrideSub.restaurantId,
                    action: 'remove_feature_override',
                    featureKey
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || `Override for "${featureKey}" removed`);
                await fetchSubscriptions();
                setOverrideSub((prev: any) => {
                    if (!prev) return null;
                    const updatedOverrides = (prev.overrides || []).filter((o: any) => o.feature_key !== featureKey);
                    return {
                        ...prev,
                        overrides: updatedOverrides
                    };
                });
            } else {
                toast.error(json.error || 'Failed to remove feature override');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error removing feature override');
        } finally {
            setActionLoading(false);
        }
    };

    // Plan CRUD Handlers
    const handleSavePlan = async (isEditing: boolean) => {
        if (!planForm.name || !planForm.slug) {
            toast.error('Plan name and slug are required.');
            return;
        }
        setActionLoading(true);
        try {
            const endpoint = '/api/admin/subscriptions';
            const method = isEditing ? 'PATCH' : 'POST';
            const body = isEditing
                ? {
                    action: 'update_plan',
                    id: editPlan?.id,
                    name: planForm.name,
                    tagline: planForm.tagline,
                    priceMonthly: Number(planForm.priceMonthly) || 0,
                    priceAnnual: Number(planForm.priceAnnual) || 0,
                    trialDays: Number(planForm.trialDays) || 0,
                    features: planForm.features,
                    maxBranches: Number(planForm.maxBranches) || 1,
                    maxEmployees: Number(planForm.maxEmployees) || 1,
                    maxOrdersPerMonth: planForm.maxOrdersPerMonth || null,
                    isPopular: planForm.isPopular
                }
                : {
                    action: 'create_plan',
                    name: planForm.name,
                    slug: planForm.slug,
                    tagline: planForm.tagline,
                    priceMonthly: Number(planForm.priceMonthly) || 0,
                    priceAnnual: Number(planForm.priceAnnual) || 0,
                    trialDays: Number(planForm.trialDays) || 0,
                    features: planForm.features,
                    maxBranches: Number(planForm.maxBranches) || 1,
                    maxEmployees: Number(planForm.maxEmployees) || 1,
                    maxOrdersPerMonth: planForm.maxOrdersPerMonth || null,
                    isPopular: planForm.isPopular
                };

            const res = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(json.message || 'Plan saved successfully!');
                setCreatePlanOpen(false);
                setEditPlan(null);
                fetchSubscriptions();
            } else {
                toast.error(json.error || 'Failed to save plan');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error saving plan');
        } finally {
            setActionLoading(false);
        }
    };

    const handleTogglePlanActive = async (plan: any) => {
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'toggle_plan_status',
                    id: plan.id,
                    isActive: !plan.is_active
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(`Plan ${plan.name} is now ${!plan.is_active ? 'Active' : 'Inactive'}.`);
                fetchSubscriptions();
            }
        } catch (err: any) {
            toast.error(err.message || 'Error updating plan');
        }
    };

    const handleArchivePlan = async (plan: any) => {
        if (!confirm(`Are you sure you want to archive plan "${plan.name}"?`)) return;
        try {
            const res = await fetch('/api/admin/subscriptions', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'archive_plan',
                    id: plan.id
                })
            });
            const json = await res.json();
            if (res.ok && json.success) {
                toast.success(`Plan "${plan.name}" archived.`);
                fetchSubscriptions();
            }
        } catch (err: any) {
            toast.error(err.message || 'Error archiving plan');
        }
    };

    // Filtered lists
    const summary = data?.summary || {
        total: 0,
        active: 0,
        trial: 0,
        expiringSoon: 0,
        expiredCancelled: 0,
        mrr: 0,
        arr: 0,
        failedPaymentsCount: 0,
        failedPaymentsAmount: 0
    };

    const allSubscriptions: any[] = data?.subscriptions || [];
    const allPlans: any[] = data?.plans || [];
    const allPayments: any[] = data?.payments || [];
    const allRegistrationRequests: any[] = data?.registrationRequests || [];
    const pendingRequestsCount: number = data?.summary?.pendingRequestsCount || 0;
    const statusDistribution = data?.statusDistribution || [];

    // Filter Registration Requests
    const filteredRegistrationRequests = allRegistrationRequests.filter((req: any) => {
        const matchesStatus =
            reqFilterStatus === 'ALL' ||
            (reqFilterStatus === 'PENDING_APPROVAL' && req.approvalStatus === 'PENDING_APPROVAL') ||
            (reqFilterStatus === 'PENDING_PAYMENT' && (req.approvalStatus === 'PENDING_PAYMENT' || req.paymentStatus === 'PENDING_PAYMENT' || req.paymentStatus === 'PENDING')) ||
            (reqFilterStatus === 'ACTIVE' && req.approvalStatus === 'ACTIVE') ||
            (reqFilterStatus === 'REJECTED' && req.approvalStatus === 'REJECTED');

        const matchesSearch =
            !search ||
            req.restaurantName?.toLowerCase().includes(search.toLowerCase()) ||
            req.ownerName?.toLowerCase().includes(search.toLowerCase()) ||
            req.ownerEmail?.toLowerCase().includes(search.toLowerCase()) ||
            req.restaurantId?.includes(search) ||
            req.requestNumber?.toLowerCase().includes(search.toLowerCase()) ||
            req.paymentReference?.toLowerCase().includes(search.toLowerCase());

        return matchesStatus && matchesSearch;
    });
    const revenueTrend = data?.revenueTrend || [];
    const upcomingRenewals = data?.upcomingRenewals || [];
    const failedPaymentAlerts = data?.failedPaymentAlerts || [];
    const recentActivity = data?.recentActivity || [];

    // Filter Active
    const activeList = allSubscriptions.filter((s) => {
        const matchesStatus = s.status === 'ACTIVE';
        const matchesSearch =
            !search ||
            s.restaurantName.toLowerCase().includes(search.toLowerCase()) ||
            s.ownerName.toLowerCase().includes(search.toLowerCase()) ||
            s.restaurantId.includes(search) ||
            s.plan.toLowerCase().includes(search.toLowerCase());
        const matchesPlan = planFilter === 'ALL' || s.planSlug.toLowerCase() === planFilter.toLowerCase();
        return matchesStatus && matchesSearch && matchesPlan;
    });

    // Filter Trial
    const trialList = allSubscriptions.filter((s) => {
        const matchesStatus = s.status === 'TRIAL';
        const matchesSearch =
            !search ||
            s.restaurantName.toLowerCase().includes(search.toLowerCase()) ||
            s.ownerName.toLowerCase().includes(search.toLowerCase()) ||
            s.restaurantId.includes(search);
        return matchesStatus && matchesSearch;
    });

    // Filter Expired / Cancelled
    const expiredList = allSubscriptions.filter((s) => {
        const matchesStatus = s.status === 'EXPIRED' || s.status === 'CANCELLED' || s.status === 'SUSPENDED';
        const matchesSearch =
            !search ||
            s.restaurantName.toLowerCase().includes(search.toLowerCase()) ||
            s.ownerName.toLowerCase().includes(search.toLowerCase()) ||
            s.restaurantId.includes(search);
        return matchesStatus && matchesSearch;
    });

    // Filter Payments
    const filteredPayments = allPayments.filter((p) => {
        const matchesStatus = paymentFilter === 'ALL' || p.status === paymentFilter;
        const matchesSearch =
            !search ||
            p.restaurantName.toLowerCase().includes(search.toLowerCase()) ||
            p.ownerName.toLowerCase().includes(search.toLowerCase()) ||
            p.restaurantId.includes(search) ||
            p.paymentId.toLowerCase().includes(search.toLowerCase()) ||
            p.invoiceNumber.toLowerCase().includes(search.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    return (
        <div className="space-y-6">
            {/* Top Command Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-black tracking-tight text-[#172033]">
                            Subscription Management
                        </h1>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Production Live
                        </span>
                    </div>
                    <p className="text-xs text-[#667085] mt-1 font-medium">
                        Complete subscription lifecycle management enforcing independent restaurant tenancy (Owner → Restaurant → Subscription).
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchSubscriptions}
                        className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-neutral-50 text-[#172033] border border-[#E4E7EC] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        <span>Sync Subscriptions</span>
                    </button>
                    <button
                        onClick={() => {
                            setModalTargetRestId(allSubscriptions[0]?.restaurantId || '');
                            setModalAmount(4999);
                            setManualPayOpen(true);
                        }}
                        className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-neutral-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                        <IndianRupee size={14} />
                        <span>Record Payment</span>
                    </button>
                    <button
                        onClick={() => {
                            setPlanForm({
                                name: '',
                                slug: '',
                                tagline: '',
                                priceMonthly: '',
                                priceAnnual: '',
                                trialDays: '',
                                features: ['Multi-Branch Support', 'Real-Time POS & KDS', 'QR Digital Ordering'],
                                featureInput: '',
                                maxBranches: '',
                                maxEmployees: '',
                                maxOrdersPerMonth: '',
                                isPopular: false
                            });
                            setCreatePlanOpen(true);
                        }}
                        className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shadow-indigo-600/20"
                    >
                        <Plus size={14} />
                        <span>Create Plan</span>
                    </button>
                </div>
            </div>

            {/* Sub-Navigation Tabs Bar */}
            <div className="bg-white p-1.5 rounded-2xl border border-[#E4E7EC] shadow-2xs flex items-center gap-1 overflow-x-auto">
                <button
                    onClick={() => handleTabChange('overview')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        activeTab === 'overview'
                            ? 'bg-[#172033] text-white shadow-xs'
                            : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FC]'
                    }`}
                >
                    <Zap size={14} />
                    <span>Overview</span>
                </button>

                <button
                    onClick={() => handleTabChange('registrations')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        activeTab === 'registrations'
                            ? 'bg-[#172033] text-white shadow-xs'
                            : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FC]'
                    }`}
                >
                    <Building2 size={14} />
                    <span>Restaurant Registrations</span>
                    {allRegistrationRequests.filter((r: any) => r.approvalStatus === 'PENDING_APPROVAL' || r.paymentStatus === 'PENDING' || r.approvalStatus === 'PENDING_PAYMENT').length > 0 && (
                        <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                            activeTab === 'registrations' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800'
                        }`}>
                            {allRegistrationRequests.filter((r: any) => r.approvalStatus === 'PENDING_APPROVAL' || r.paymentStatus === 'PENDING' || r.approvalStatus === 'PENDING_PAYMENT').length}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => handleTabChange('plans')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        activeTab === 'plans'
                            ? 'bg-[#172033] text-white shadow-xs'
                            : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FC]'
                    }`}
                >
                    <CreditCard size={14} />
                    <span>Plans & Pricing</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-100 text-neutral-700 font-mono font-bold">
                        {allPlans.length}
                    </span>
                </button>

                <button
                    onClick={() => handleTabChange('active')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        activeTab === 'active'
                            ? 'bg-[#172033] text-white shadow-xs'
                            : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FC]'
                    }`}
                >
                    <CheckCircle2 size={14} />
                    <span>Active Subscriptions</span>
                    <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                        activeTab === 'active' ? 'bg-emerald-500 text-white' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                        {summary.active}
                    </span>
                </button>

                <button
                    onClick={() => handleTabChange('trial')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        activeTab === 'trial'
                            ? 'bg-[#172033] text-white shadow-xs'
                            : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FC]'
                    }`}
                >
                    <Clock size={14} />
                    <span>Trial Restaurants</span>
                    <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                        activeTab === 'trial' ? 'bg-cyan-500 text-white' : 'bg-cyan-100 text-cyan-800'
                    }`}>
                        {summary.trial}
                    </span>
                </button>

                <button
                    onClick={() => handleTabChange('expired')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        activeTab === 'expired'
                            ? 'bg-[#172033] text-white shadow-xs'
                            : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FC]'
                    }`}
                >
                    <AlertTriangle size={14} />
                    <span>Expired / Cancelled</span>
                    {summary.expiredCancelled > 0 && (
                        <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                            activeTab === 'expired' ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-800'
                        }`}>
                            {summary.expiredCancelled}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => handleTabChange('payments')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                        activeTab === 'payments'
                            ? 'bg-[#172033] text-white shadow-xs'
                            : 'text-[#667085] hover:text-[#172033] hover:bg-[#F5F7FC]'
                    }`}
                >
                    <DollarSign size={14} />
                    <span>Payment Records</span>
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-100 text-neutral-700 font-mono font-bold">
                        {allPayments.length}
                    </span>
                </button>
            </div>

            {/* ==========================================
                TAB 1: OVERVIEW DASHBOARD
            ========================================== */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Failed Payment Alert (if any) */}
                    {failedPaymentAlerts.length > 0 && (
                        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                                    <AlertCircle size={18} />
                                </div>
                                <div>
                                    <p className="font-extrabold text-sm text-rose-950">
                                        {failedPaymentAlerts.length} Failed Billing Incident{failedPaymentAlerts.length > 1 ? 's' : ''} Require Immediate Attention
                                    </p>
                                    <p className="text-xs text-rose-800/90 mt-0.5 leading-relaxed">
                                        Total unpaid debt: ₹{summary.failedPaymentsAmount.toLocaleString('en-IN')}. Subscriptions may be subject to automatic service suspension.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleTabChange('payments')}
                                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer shadow-xs"
                            >
                                View Payment Incidents
                            </button>
                        </div>
                    )}

                    {/* 8 Animated KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* 1. Total Subscriptions */}
                        <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs hover:shadow-md transition-all group">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase text-[#667085] tracking-wider">
                                    Total Subscriptions
                                </span>
                                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform">
                                    <Layers size={16} />
                                </div>
                            </div>
                            <p className="text-2xl font-black text-[#172033] mt-2">
                                <AnimatedCounter value={summary.total} />
                            </p>
                            <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                                Across all independent restaurants
                            </p>
                        </div>

                        {/* 2. Active Subscriptions */}
                        <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs hover:shadow-md transition-all group">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase text-[#667085] tracking-wider">
                                    Active Subscriptions
                                </span>
                                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
                                    <CheckCircle2 size={16} />
                                </div>
                            </div>
                            <p className="text-2xl font-black text-[#172033] mt-2">
                                <AnimatedCounter value={summary.active} />
                            </p>
                            <p className="text-[11px] text-emerald-700 font-bold mt-0.5">
                                Live paying SaaS tenants
                            </p>
                        </div>

                        {/* 3. Trial Restaurants */}
                        <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs hover:shadow-md transition-all group">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase text-[#667085] tracking-wider">
                                    Trial Restaurants
                                </span>
                                <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600 group-hover:scale-105 transition-transform">
                                    <Clock size={16} />
                                </div>
                            </div>
                            <p className="text-2xl font-black text-[#172033] mt-2">
                                <AnimatedCounter value={summary.trial} />
                            </p>
                            <p className="text-[11px] text-cyan-700 font-bold mt-0.5">
                                14-day evaluation accounts
                            </p>
                        </div>

                        {/* 4. Expiring Soon */}
                        <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs hover:shadow-md transition-all group">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase text-[#667085] tracking-wider">
                                    Expiring Soon
                                </span>
                                <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:scale-105 transition-transform">
                                    <AlertTriangle size={16} />
                                </div>
                            </div>
                            <p className="text-2xl font-black text-[#172033] mt-2">
                                <AnimatedCounter value={summary.expiringSoon} />
                            </p>
                            <p className="text-[11px] text-amber-700 font-bold mt-0.5">
                                Renewals within 7 days
                            </p>
                        </div>

                        {/* 5. Expired / Cancelled */}
                        <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs hover:shadow-md transition-all group">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase text-[#667085] tracking-wider">
                                    Expired / Cancelled
                                </span>
                                <div className="p-2 rounded-xl bg-neutral-100 text-neutral-600 group-hover:scale-105 transition-transform">
                                    <Ban size={16} />
                                </div>
                            </div>
                            <p className="text-2xl font-black text-[#172033] mt-2">
                                <AnimatedCounter value={summary.expiredCancelled} />
                            </p>
                            <p className="text-[11px] text-neutral-500 font-medium mt-0.5">
                                Inactive or churned
                            </p>
                        </div>

                        {/* 6. MRR */}
                        <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs hover:shadow-md transition-all group">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase text-[#667085] tracking-wider">
                                    Monthly Rec. Revenue
                                </span>
                                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform">
                                    <IndianRupee size={16} />
                                </div>
                            </div>
                            <p className="text-2xl font-black text-[#172033] mt-2">
                                <AnimatedCounter value={summary.mrr} prefix="₹" />
                            </p>
                            <p className="text-[11px] text-indigo-700 font-bold mt-0.5">
                                Current monthly run rate
                            </p>
                        </div>

                        {/* 7. Annual Run-Rate (ARR) */}
                        <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs hover:shadow-md transition-all group">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase text-[#667085] tracking-wider">
                                    Annual Run-Rate
                                </span>
                                <div className="p-2 rounded-xl bg-violet-50 text-violet-600 group-hover:scale-105 transition-transform">
                                    <TrendingUp size={16} />
                                </div>
                            </div>
                            <p className="text-2xl font-black text-[#172033] mt-2">
                                <AnimatedCounter value={summary.arr} prefix="₹" />
                            </p>
                            <p className="text-[11px] text-violet-700 font-bold mt-0.5">
                                Projected 12-month ARR
                            </p>
                        </div>

                        {/* 8. Failed Payments */}
                        <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs hover:shadow-md transition-all group">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold uppercase text-[#667085] tracking-wider">
                                    Failed Payments
                                </span>
                                <div className={`p-2 rounded-xl ${summary.failedPaymentsCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'} group-hover:scale-105 transition-transform`}>
                                    <AlertCircle size={16} />
                                </div>
                            </div>
                            <p className="text-2xl font-black text-[#172033] mt-2">
                                <AnimatedCounter value={summary.failedPaymentsCount} />
                            </p>
                            <p className={`text-[11px] font-bold mt-0.5 ${summary.failedPaymentsCount > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                                {summary.failedPaymentsCount > 0 ? `₹${summary.failedPaymentsAmount.toLocaleString('en-IN')} pending` : 'All payments settled'}
                            </p>
                        </div>
                    </div>

                    {/* Middle Section: Status Distribution Chart & Revenue Trend */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Status Distribution */}
                        <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-5">
                            <div>
                                <h3 className="text-base font-extrabold text-[#172033]">
                                    Subscription Status Distribution
                                </h3>
                                <p className="text-xs text-[#667085] mt-0.5">
                                    Live ratio of active paying subscribers vs trials and past due accounts.
                                </p>
                            </div>

                            {/* Proportional Segment Bar */}
                            <div className="h-4 w-full bg-neutral-100 rounded-full overflow-hidden flex shadow-inner">
                                {statusDistribution.map((item: any, i: number) => (
                                    <div
                                        key={i}
                                        style={{ width: `${Math.max(item.percentage, item.count > 0 ? 5 : 0)}%`, backgroundColor: item.color }}
                                        className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                                        title={`${item.status}: ${item.count} (${item.percentage}%)`}
                                    />
                                ))}
                            </div>

                            {/* Legend cards */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                {statusDistribution.map((item: any, i: number) => (
                                    <div key={i} className="p-3 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                            <div>
                                                <span className="text-xs font-bold text-[#172033] block">{item.status}</span>
                                                <span className="text-[10px] text-neutral-400 font-mono">{item.percentage}% of fleet</span>
                                            </div>
                                        </div>
                                        <span className="text-sm font-black text-[#172033] font-mono">{item.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Revenue Trend Chart */}
                        <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-5 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-base font-extrabold text-[#172033]">
                                            6-Month Revenue Run-Rate
                                        </h3>
                                        <p className="text-xs text-[#667085] mt-0.5">
                                            Aggregated monthly SaaS billing collections and active renewals.
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                                        MRR: ₹{summary.mrr.toLocaleString('en-IN')}
                                    </span>
                                </div>
                            </div>

                            {/* Bars */}
                            <div className="pt-4 pb-2">
                                <div className="flex items-end justify-between gap-3 h-40">
                                    {revenueTrend.map((m: any, idx: number) => {
                                        const maxRev = Math.max(...revenueTrend.map((r: any) => r.revenue), 10000);
                                        const heightPercent = Math.max(10, Math.round((m.revenue / maxRev) * 100));
                                        const isCurrent = idx === revenueTrend.length - 1;

                                        return (
                                            <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                                                <div className="text-[10px] font-bold text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    ₹{m.revenue > 0 ? (m.revenue >= 1000 ? `${(m.revenue / 1000).toFixed(1)}k` : m.revenue) : '0'}
                                                </div>
                                                <div className="w-full bg-[#F5F7FC] rounded-t-xl overflow-hidden h-32 flex items-end justify-center p-1">
                                                    <div
                                                        style={{ height: `${heightPercent}%` }}
                                                        className={`w-full rounded-t-lg transition-all duration-700 ${
                                                            isCurrent
                                                                ? 'bg-indigo-600 shadow-md shadow-indigo-600/30'
                                                                : 'bg-indigo-200 group-hover:bg-indigo-300'
                                                        }`}
                                                    />
                                                </div>
                                                <span className={`text-[11px] font-mono font-bold ${isCurrent ? 'text-indigo-600' : 'text-neutral-500'}`}>
                                                    {m.month}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row: Upcoming Renewals & Recent Activity Stream */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Upcoming Renewals */}
                        <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-extrabold text-[#172033]">Upcoming Renewals</h3>
                                    <p className="text-xs text-[#667085] mt-0.5">
                                        Accounts nearing trial expiration or monthly subscription billing cycle.
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleTabChange('active')}
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                                >
                                    <span>All Accounts</span>
                                    <ChevronRight size={13} />
                                </button>
                            </div>

                            <div className="divide-y divide-[#E4E7EC]">
                                {upcomingRenewals.length > 0 ? (
                                    upcomingRenewals.map((sub: any) => (
                                        <div key={sub.id} className="py-3 flex items-center justify-between text-xs gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-bold text-[#172033] truncate">{sub.restaurantName}</p>
                                                    <span className={`px-2 py-0.2 rounded-md text-[9px] font-bold uppercase ${
                                                        sub.status === 'TRIAL' ? 'bg-cyan-100 text-cyan-800' : 'bg-indigo-100 text-indigo-800'
                                                    }`}>
                                                        {sub.plan}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                                                    Owner: {sub.ownerName} • ID: {sub.restaurantId}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0 flex items-center gap-3">
                                                <div>
                                                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                                        sub.daysRemaining !== null && sub.daysRemaining <= 3
                                                            ? 'bg-rose-100 text-rose-800 animate-pulse'
                                                            : sub.daysRemaining !== null && sub.daysRemaining <= 7
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-emerald-100 text-emerald-800'
                                                    }`}>
                                                        {sub.daysRemaining !== null ? `${sub.daysRemaining} days left` : 'Active'}
                                                    </span>
                                                    <p className="text-[11px] font-bold text-[#172033] mt-0.5">
                                                        ₹{sub.price.toLocaleString('en-IN')}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (sub.status === 'TRIAL') {
                                                            setExtendTrialSub(sub);
                                                            setModalDays(14);
                                                        } else {
                                                            setExtendSub(sub);
                                                            setModalDays(30);
                                                        }
                                                    }}
                                                    className="p-1.5 rounded-lg border border-[#E4E7EC] hover:bg-neutral-100 text-neutral-600 transition-colors cursor-pointer"
                                                    title="Extend"
                                                >
                                                    <Clock size={13} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="py-6 text-xs text-neutral-400 text-center italic">No upcoming renewals found.</p>
                                )}
                            </div>
                        </div>

                        {/* Recent Activity Stream */}
                        <div className="bg-white rounded-3xl border border-[#E4E7EC] p-6 shadow-2xs space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-extrabold text-[#172033]">
                                        Subscription Audit Stream
                                    </h3>
                                    <p className="text-xs text-[#667085] mt-0.5">
                                        Real-time ledger events for plan modifications, extensions, and manual invoices.
                                    </p>
                                </div>
                                <Link
                                    href="/admin/audit-logs"
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                >
                                    <span>Full Audit Log</span>
                                    <ChevronRight size={13} />
                                </Link>
                            </div>

                            <div className="divide-y divide-[#E4E7EC]">
                                {recentActivity.length > 0 ? (
                                    recentActivity.map((act: any) => (
                                        <div key={act.id} className="py-3 flex items-start justify-between text-xs gap-3">
                                            <div className="space-y-0.5 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-[#172033]">{act.action}</span>
                                                    {act.restaurantName && (
                                                        <span className="text-[10px] text-indigo-600 font-mono">
                                                            {act.restaurantName}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-[#667085] leading-relaxed">
                                                    {act.description}
                                                </p>
                                            </div>
                                            <span className="text-[10px] text-neutral-400 font-mono shrink-0 whitespace-nowrap">
                                                {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="py-6 text-xs text-neutral-400 text-center italic">No recent subscription activity.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: RESTAURANT REGISTRATION REQUESTS */}
            {activeTab === 'registrations' && (
                <div className="space-y-6">

                    {/* Top KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-3xl border border-[#E4E7EC] shadow-2xs">
                            <div className="flex items-center justify-between text-neutral-500 mb-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-[#667085]">Total Requests</span>
                                <div className="p-2 rounded-xl bg-neutral-100 text-neutral-700">
                                    <Building2 size={16} />
                                </div>
                            </div>
                            <div className="text-2xl font-black text-[#172033] font-mono">
                                <AnimatedCounter value={allRegistrationRequests.length} />
                            </div>
                            <span className="text-[11px] text-neutral-500 mt-1 block">Lifetime restaurant registrations</span>
                        </div>

                        <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-2xs bg-amber-50/20">
                            <div className="flex items-center justify-between text-amber-700 mb-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Pending Approval</span>
                                <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                                    <Clock size={16} />
                                </div>
                            </div>
                            <div className="text-2xl font-black text-amber-700 font-mono">
                                <AnimatedCounter value={allRegistrationRequests.filter((r: any) => r.approvalStatus === 'PENDING_APPROVAL').length} />
                            </div>
                            <span className="text-[11px] text-amber-700 font-medium mt-1 block">Awaiting payment & Super Admin review</span>
                        </div>

                        <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-2xs bg-emerald-50/20">
                            <div className="flex items-center justify-between text-emerald-700 mb-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Payment Received</span>
                                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                                    <IndianRupee size={16} />
                                </div>
                            </div>
                            <div className="text-2xl font-black text-emerald-700 font-mono">
                                <AnimatedCounter value={allRegistrationRequests.filter((r: any) => r.paymentStatus === 'RECEIVED').length} />
                            </div>
                            <span className="text-[11px] text-emerald-700 font-medium mt-1 block">Manual payments confirmed</span>
                        </div>

                        <div className="bg-white p-5 rounded-3xl border border-indigo-200 shadow-2xs bg-indigo-50/20">
                            <div className="flex items-center justify-between text-indigo-700 mb-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">Active Approved</span>
                                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-800">
                                    <CheckCircle2 size={16} />
                                </div>
                            </div>
                            <div className="text-2xl font-black text-indigo-700 font-mono">
                                <AnimatedCounter value={allRegistrationRequests.filter((r: any) => r.approvalStatus === 'ACTIVE').length} />
                            </div>
                            <span className="text-[11px] text-indigo-700 font-medium mt-1 block">Fully activated live tenants</span>
                        </div>
                    </div>

                    {/* Filter & Search Bar */}
                    <div className="bg-white p-4 rounded-3xl border border-[#E4E7EC] shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                            {(['ALL', 'PENDING_APPROVAL', 'PENDING_PAYMENT', 'ACTIVE', 'REJECTED'] as const).map((st) => (
                                <button
                                    key={st}
                                    onClick={() => setReqFilterStatus(st)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                        reqFilterStatus === st
                                            ? 'bg-[#172033] text-white shadow-xs'
                                            : 'bg-[#F5F7FC] text-[#667085] hover:text-[#172033] border border-[#E4E7EC]'
                                    }`}
                                >
                                    {st === 'ALL' && `All (${allRegistrationRequests.length})`}
                                    {st === 'PENDING_APPROVAL' && `Pending Approval (${allRegistrationRequests.filter((r: any) => r.approvalStatus === 'PENDING_APPROVAL').length})`}
                                    {st === 'PENDING_PAYMENT' && `Payment Pending (${allRegistrationRequests.filter((r: any) => r.paymentStatus === 'PENDING' || r.paymentStatus === 'PENDING_PAYMENT' || r.approvalStatus === 'PENDING_PAYMENT').length})`}
                                    {st === 'ACTIVE' && `Active (${allRegistrationRequests.filter((r: any) => r.approvalStatus === 'ACTIVE').length})`}
                                    {st === 'REJECTED' && `Rejected (${allRegistrationRequests.filter((r: any) => r.approvalStatus === 'REJECTED').length})`}
                                </button>
                            ))}
                        </div>

                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-2.5 text-neutral-400" size={15} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by restaurant, ID, owner..."
                                className="w-full pl-9 pr-4 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-medium focus:outline-none focus:border-indigo-600 focus:bg-white transition-colors"
                            />
                        </div>
                    </div>

                    {/* Registration Requests Table */}
                    <div className="bg-white rounded-3xl border border-[#E4E7EC] shadow-2xs overflow-hidden">
                        <div className="p-5 border-b border-[#E4E7EC] flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-extrabold text-[#172033]">
                                    Pending & Historical Registration Requests
                                </h3>
                                <p className="text-xs text-[#667085] mt-0.5">
                                    Manual payment verification, plan assignment, and Super Admin quota override controls.
                                </p>
                            </div>
                            <span className="text-xs text-neutral-400 font-mono">
                                Showing {filteredRegistrationRequests.length} of {allRegistrationRequests.length} requests
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-bold text-[#667085] uppercase tracking-wider">
                                        <th className="py-3 px-4">Request # & Date</th>
                                        <th className="py-3 px-4">Owner</th>
                                        <th className="py-3 px-4">Restaurant Details</th>
                                        <th className="py-3 px-4">Selected Plan</th>
                                        <th className="py-3 px-4">Quota Limit</th>
                                        <th className="py-3 px-4">Amount Due</th>
                                        <th className="py-3 px-4">Payment Status</th>
                                        <th className="py-3 px-4">Approval Status</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E4E7EC] text-xs">
                                    {filteredRegistrationRequests.length > 0 ? (
                                        filteredRegistrationRequests.map((req: any) => {
                                            const isPending = req.approvalStatus === 'PENDING_APPROVAL' || req.approvalStatus === 'PENDING_PAYMENT';
                                            const isActive = req.approvalStatus === 'ACTIVE';
                                            const isRejected = req.approvalStatus === 'REJECTED';
                                            const isPaymentReceived = req.paymentStatus === 'RECEIVED';

                                            return (
                                                <tr key={req.id} className="hover:bg-[#F9FAFB] transition-colors">
                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <div className="font-mono font-bold text-[#172033]">{req.requestNumber}</div>
                                                        <div className="text-[10px] text-neutral-400 font-mono">
                                                            {new Date(req.createdAt).toLocaleDateString('en-IN', {
                                                                day: '2-digit',
                                                                month: 'short',
                                                                year: 'numeric'
                                                            })}
                                                        </div>
                                                    </td>

                                                    <td className="py-3 px-4">
                                                        <div className="font-bold text-[#172033]">{req.ownerName}</div>
                                                        <div className="text-[11px] text-neutral-500 font-mono">{req.ownerEmail || '—'}</div>
                                                        {req.ownerPhone && (
                                                            <div className="text-[10px] text-neutral-400 font-mono">{req.ownerPhone}</div>
                                                        )}
                                                    </td>

                                                    <td className="py-3 px-4">
                                                        <div className="font-bold text-[#172033]">{req.restaurantName}</div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="font-mono text-[11px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                                                                {req.restaurantId}
                                                            </span>
                                                            <button
                                                                onClick={() => handleCopy(req.restaurantId, 'Restaurant ID')}
                                                                className="text-neutral-400 hover:text-neutral-600 p-0.5 cursor-pointer"
                                                                title="Copy 12-digit Restaurant ID"
                                                            >
                                                                <Copy size={11} />
                                                            </button>
                                                        </div>
                                                    </td>

                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1 ${
                                                            req.planSlug === 'pro'
                                                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                                                : req.planSlug === 'growth'
                                                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                                                : req.planSlug === 'enterprise'
                                                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                        }`}>
                                                            {req.planName || req.planSlug}
                                                        </span>
                                                    </td>

                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <div className="font-mono font-bold text-[#172033]">
                                                            {req.effectiveLimit} restaurant{req.effectiveLimit > 1 ? 's' : ''}
                                                        </div>
                                                        <div className="text-[10px]">
                                                            {req.customQuota ? (
                                                                <span className="text-amber-700 font-semibold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                                    Super Admin Override
                                                                </span>
                                                            ) : (
                                                                <span className="text-neutral-500 font-normal">
                                                                    Plan Default ({req.planLimit})
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    <td className="py-3 px-4 whitespace-nowrap font-mono font-extrabold text-[#172033]">
                                                        ₹{req.amountDue?.toLocaleString('en-IN') || 0}
                                                    </td>

                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                                isPaymentReceived
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : 'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                {isPaymentReceived ? 'Payment Verified' : 'Payment Pending'}
                                                            </span>
                                                        </div>
                                                        {req.paymentReference && (
                                                            <div className="flex items-center gap-1 mt-1 text-[10px] text-neutral-600 font-mono">
                                                                <span>Ref: {req.paymentReference}</span>
                                                                <button
                                                                    onClick={() => handleCopy(req.paymentReference, 'Payment Ref')}
                                                                    className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
                                                                >
                                                                    <Copy size={10} />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td className="py-3 px-4 whitespace-nowrap">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                            isActive
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : isPending
                                                                ? 'bg-amber-100 text-amber-800 animate-pulse'
                                                                : isRejected
                                                                ? 'bg-rose-100 text-rose-800'
                                                                : req.approvalStatus === 'SUSPENDED'
                                                                ? 'bg-purple-100 text-purple-800'
                                                                : 'bg-neutral-100 text-neutral-800'
                                                        }`}>
                                                            {req.approvalStatus}
                                                        </span>
                                                    </td>

                                                    <td className="py-3 px-4 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {isPending && (
                                                                <>
                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedReqForAction(req);
                                                                            setReqActionPlan(req.planSlug || 'standard');
                                                                            setReqActionQuota(req.customQuota || req.planLimit || 1);
                                                                            setActionModalType('approve');
                                                                        }}
                                                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                                                        title="Approve registration and activate restaurant"
                                                                    >
                                                                        <Check size={13} />
                                                                        <span>Approve</span>
                                                                    </button>

                                                                    {!isPaymentReceived ? (
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedReqForAction(req);
                                                                                setActionModalType('mark_payment');
                                                                            }}
                                                                            className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                                                            title="Mark manual payment received"
                                                                        >
                                                                            <IndianRupee size={12} />
                                                                            <span>Mark Paid</span>
                                                                        </button>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => {
                                                                                setSelectedReqForAction(req);
                                                                                setActionModalType('undo_payment');
                                                                            }}
                                                                            className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                                                            title="Undo Payment Received (Revert to Pending Payment)"
                                                                        >
                                                                            <RotateCcw size={12} />
                                                                            <span>Undo Pay</span>
                                                                        </button>
                                                                    )}

                                                                    <button
                                                                        onClick={() => {
                                                                            setSelectedReqForAction(req);
                                                                            setReqActionNotes('');
                                                                            setActionModalType('request_payment');
                                                                        }}
                                                                        className="p-1.5 rounded-lg border border-[#E4E7EC] hover:bg-neutral-100 text-neutral-600 transition-colors cursor-pointer"
                                                                        title="Request payment / details"
                                                                    >
                                                                        <CreditCard size={13} />
                                                                    </button>
                                                                </>
                                                            )}

                                                            {!isPending && isPaymentReceived && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedReqForAction(req);
                                                                        setActionModalType('undo_payment');
                                                                    }}
                                                                    className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                                                                    title="Undo Payment Received (Revert to Pending Payment)"
                                                                >
                                                                    <RotateCcw size={12} />
                                                                    <span>Undo Pay</span>
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={() => {
                                                                    setSelectedReqForAction(req);
                                                                    setReqActionQuota(req.customQuota || req.effectiveLimit || 1);
                                                                    setActionModalType('set_quota');
                                                                }}
                                                                className="p-1.5 rounded-lg border border-[#E4E7EC] hover:bg-neutral-100 text-neutral-600 transition-colors cursor-pointer"
                                                                title="Set / Adjust Restaurant Limit (Manual Quota Override)"
                                                            >
                                                                <Sliders size={13} />
                                                            </button>

                                                            <button
                                                                onClick={() => {
                                                                    setSelectedReqForAction(req);
                                                                    setReqActionPlan(req.planSlug || 'standard');
                                                                    setActionModalType('change_plan');
                                                                }}
                                                                className="p-1.5 rounded-lg border border-[#E4E7EC] hover:bg-neutral-100 text-neutral-600 transition-colors cursor-pointer"
                                                                title="Change / Confirm Subscription Plan"
                                                            >
                                                                <Edit3 size={13} />
                                                            </button>

                                                            {isPending && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedReqForAction(req);
                                                                        setReqActionReason('');
                                                                        setActionModalType('reject');
                                                                    }}
                                                                    className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                                                                    title="Reject Registration"
                                                                >
                                                                    <Ban size={13} />
                                                                </button>
                                                            )}

                                                            {isActive && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedReqForAction(req);
                                                                        setReqActionReason('');
                                                                        setActionModalType('suspend');
                                                                    }}
                                                                    className="p-1.5 rounded-lg border border-purple-200 hover:bg-purple-50 text-purple-600 transition-colors cursor-pointer"
                                                                    title="Suspend Restaurant"
                                                                >
                                                                    <Ban size={13} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center text-neutral-400">
                                                <Building2 className="mx-auto mb-2 opacity-40" size={32} />
                                                <p className="text-sm font-bold text-neutral-600">No registration requests found</p>
                                                <p className="text-xs text-neutral-400 mt-1">
                                                    When Owners register new restaurants or branches, requests will appear here for payment verification and activation.
                                                </p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                TAB 2: PLANS & PRICING COMMAND
            ========================================== */}
            {activeTab === 'plans' && (
                <div className="space-y-6">
                    {/* Header Controls */}
                    <div className="bg-white p-5 rounded-3xl border border-[#E4E7EC] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <h2 className="text-base font-extrabold text-[#172033]">
                                SaaS Tier Architecture
                            </h2>
                            <p className="text-xs text-[#667085] mt-0.5">
                                Configure feature tiers, branch limits, pricing rules, and free-trial duration for tenant onboarding.
                            </p>
                        </div>

                        {/* Annual vs Monthly Toggle */}
                        <div className="flex items-center gap-3 bg-[#F5F7FC] p-1.5 rounded-2xl border border-[#E4E7EC]">
                            <button
                                onClick={() => setAnnualPricingToggle(false)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    !annualPricingToggle
                                        ? 'bg-white text-[#172033] shadow-xs'
                                        : 'text-[#667085] hover:text-[#172033]'
                                }`}
                            >
                                Monthly Billing
                            </button>
                            <button
                                onClick={() => setAnnualPricingToggle(true)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                    annualPricingToggle
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'text-[#667085] hover:text-[#172033]'
                                }`}
                            >
                                <span>Annual Billing</span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-100 text-emerald-800">
                                    Save ~17%
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Plans Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {allPlans.map((plan: any) => {
                            const isPopular = plan.is_popular;
                            const price = annualPricingToggle ? plan.price_annual : plan.price_monthly;
                            const cycleLabel = annualPricingToggle ? '/ year' : '/ month';
                            const isArchived = plan.is_archived;

                            return (
                                <div
                                    key={plan.id}
                                    className={`relative bg-white rounded-3xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-lg ${
                                        isPopular
                                            ? 'border-indigo-600 ring-2 ring-indigo-600/10'
                                            : isArchived
                                            ? 'border-neutral-200 opacity-60'
                                            : 'border-[#E4E7EC]'
                                    }`}
                                >
                                    {isPopular && (
                                        <div className="bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider text-center py-1.5">
                                            Most Popular Choice
                                        </div>
                                    )}

                                    <div className="p-6 space-y-5">
                                        {/* Plan Header */}
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-lg font-black text-[#172033]">{plan.name}</h3>
                                                    <span className={`px-2 py-0.2 rounded-full text-[9px] font-bold uppercase ${
                                                        plan.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'
                                                    }`}>
                                                        {plan.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-[#667085] mt-1 leading-relaxed">
                                                    {plan.tagline || 'Essential multi-outlet restaurant management solution.'}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Pricing Block */}
                                        <div className="p-4 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC]">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-3xl font-black text-[#172033]">
                                                    ₹{price.toLocaleString('en-IN')}
                                                </span>
                                                <span className="text-xs font-semibold text-[#667085]">{cycleLabel}</span>
                                            </div>
                                            {plan.trial_days > 0 && (
                                                <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-cyan-700">
                                                    <Clock size={12} />
                                                    <span>{plan.trial_days}-day complimentary evaluation</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Quota Limits */}
                                        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                                            <div className="p-2.5 rounded-xl bg-white border border-[#E4E7EC]">
                                                <span className="text-[10px] text-neutral-400 block">BRANCH LIMIT</span>
                                                <span className="font-extrabold text-[#172033]">
                                                    {plan.max_branches >= 999 ? 'Unlimited' : `${plan.max_branches} Outlets`}
                                                </span>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-white border border-[#E4E7EC]">
                                                <span className="text-[10px] text-neutral-400 block">STAFF LIMIT</span>
                                                <span className="font-extrabold text-[#172033]">
                                                    {plan.max_employees >= 999 ? 'Unlimited' : `${plan.max_employees} Staff`}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Features List */}
                                        <div className="space-y-2.5 pt-2">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                                                Included Capabilities
                                            </span>
                                            <ul className="space-y-2 text-xs">
                                                {(plan.features || []).map((feat: string, i: number) => (
                                                    <li key={i} className="flex items-start gap-2 text-[#172033]">
                                                        <div className="p-0.5 rounded-full bg-emerald-100 text-emerald-700 mt-0.5 shrink-0">
                                                            <Check size={11} />
                                                        </div>
                                                        <span className="font-medium">{feat}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Action Footer */}
                                    <div className="p-4 bg-[#F5F7FC] border-t border-[#E4E7EC] flex items-center justify-between gap-2">
                                        <button
                                            onClick={() => {
                                                setEditPlan(plan);
                                                setPlanForm({
                                                    name: plan.name,
                                                    slug: plan.slug,
                                                    tagline: plan.tagline || '',
                                                    priceMonthly: plan.price_monthly,
                                                    priceAnnual: plan.price_annual,
                                                    trialDays: plan.trial_days || 14,
                                                    features: plan.features || [],
                                                    featureInput: '',
                                                    maxBranches: plan.max_branches || 1,
                                                    maxEmployees: plan.max_employees || 10,
                                                    maxOrdersPerMonth: plan.max_orders_per_month || '',
                                                    isPopular: plan.is_popular || false
                                                });
                                            }}
                                            className="flex-1 py-2 bg-white hover:bg-neutral-50 text-[#172033] border border-[#E4E7EC] rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                        >
                                            <Edit3 size={13} />
                                            <span>Edit Plan</span>
                                        </button>

                                        <button
                                            onClick={() => handleTogglePlanActive(plan)}
                                            className={`px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                                plan.is_active
                                                    ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-300'
                                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                                            }`}
                                        >
                                            {plan.is_active ? 'Deactivate' : 'Activate'}
                                        </button>

                                        {!isArchived && (
                                            <button
                                                onClick={() => handleArchivePlan(plan)}
                                                className="p-2 hover:bg-rose-50 text-neutral-400 hover:text-rose-600 rounded-xl transition-colors cursor-pointer"
                                                title="Archive Plan"
                                            >
                                                <Archive size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ==========================================
                TAB 3: ACTIVE SUBSCRIPTIONS
            ========================================== */}
            {activeTab === 'active' && (
                <div className="space-y-4">
                    {/* Filter & Search Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-[#E4E7EC] shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={15} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search active subscribers by restaurant, owner, or ID..."
                                className="w-full pl-10 pr-4 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs text-[#172033] placeholder-neutral-400 focus:outline-none focus:border-indigo-600 focus:bg-white font-medium"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#667085]">Filter Plan:</span>
                            <select
                                value={planFilter}
                                onChange={(e) => setPlanFilter(e.target.value)}
                                className="bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#172033] px-3 py-2 focus:outline-none focus:border-indigo-600 cursor-pointer"
                            >
                                <option value="ALL">All Active Plans</option>
                                {allPlans.map((p) => (
                                    <option key={p.id} value={p.slug}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Active Subscriptions Table */}
                    <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-black uppercase tracking-wider text-[#667085]">
                                        <th className="p-4 w-44">Owner</th>
                                        <th className="p-4 w-48">Restaurant / Location</th>
                                        <th className="p-4 w-36">restaurant_id</th>
                                        <th className="p-4 w-28">Plan</th>
                                        <th className="p-4 w-24">Cycle</th>
                                        <th className="p-4 w-24">Price</th>
                                        <th className="p-4 w-28">Start Date</th>
                                        <th className="p-4 w-32">Renewal Date</th>
                                        <th className="p-4 w-36">Features</th>
                                        <th className="p-4 w-24">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E4E7EC]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={11} className="py-12 text-center text-neutral-400">
                                                <div className="inline-block h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-2" />
                                                <p className="font-semibold text-xs">Loading active subscriptions...</p>
                                            </td>
                                        </tr>
                                    ) : activeList.length === 0 ? (
                                        <tr>
                                            <td colSpan={11} className="py-12 text-center text-neutral-400">
                                                <CheckCircle2 size={32} className="mx-auto mb-2 opacity-30" />
                                                <p className="font-bold text-xs text-[#172033]">No active subscriptions found</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        activeList.map((sub) => (
                                            <tr key={sub.id} className="hover:bg-[#F5F7FC]/80 transition-colors">
                                                {/* Owner */}
                                                <td className="p-4">
                                                    <div className="font-bold text-[#172033]">{sub.ownerName}</div>
                                                    <div className="text-[11px] text-neutral-400 truncate max-w-[170px]">{sub.ownerEmail}</div>
                                                </td>

                                                {/* Restaurant */}
                                                <td className="p-4">
                                                    <div className="font-bold text-[#172033] flex items-center gap-1.5">
                                                        <span>{sub.restaurantName}</span>
                                                    </div>
                                                    <span className="text-[10px] text-neutral-400 font-mono">
                                                        Max {sub.maxBranches} branches
                                                    </span>
                                                </td>

                                                {/* restaurant_id */}
                                                <td className="p-4 font-mono text-[11px] text-[#172033]">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-extrabold">{sub.restaurantId}</span>
                                                        <button
                                                            onClick={() => handleCopy(sub.restaurantId, 'Restaurant ID')}
                                                            className="text-neutral-400 hover:text-indigo-600 transition-colors"
                                                            title="Copy ID"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Plan */}
                                                <td className="p-4">
                                                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        {sub.plan}
                                                    </span>
                                                </td>

                                                {/* Billing Cycle */}
                                                <td className="p-4 text-neutral-600 font-medium">
                                                    {sub.billingCycle}
                                                </td>

                                                {/* Price */}
                                                <td className="p-4 font-mono font-bold text-[#172033]">
                                                    ₹{sub.price.toLocaleString('en-IN')}
                                                </td>

                                                {/* Start Date */}
                                                <td className="p-4 text-neutral-500 font-mono text-[11px]">
                                                    {new Date(sub.currentPeriodStart).toLocaleDateString()}
                                                </td>

                                                {/* Renewal Date */}
                                                <td className="p-4">
                                                    <div className="font-mono text-[11px] text-[#172033] font-bold">
                                                        {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : 'Continuous'}
                                                    </div>
                                                    {sub.daysRemaining !== null && (
                                                        <span className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                                                            sub.isExpiringSoon ? 'bg-amber-100 text-amber-800' : 'text-neutral-400'
                                                        }`}>
                                                            {sub.daysRemaining} days remaining
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Features */}
                                                <td className="p-4">
                                                    <button
                                                        onClick={() => setOverrideSub(sub)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#F5F7FC] hover:bg-indigo-50 text-indigo-700 border border-[#E4E7EC] hover:border-indigo-200 transition-all cursor-pointer group shadow-2xs"
                                                        title="View & Manage Feature Entitlements & Overrides"
                                                    >
                                                        <Sliders size={12} className="text-neutral-400 group-hover:text-indigo-600 transition-colors" />
                                                        <span>{sub.availableFeatures?.length || (sub.features ? Object.values(sub.features).filter(Boolean).length : 0)} Active</span>
                                                        {sub.overrides && sub.overrides.length > 0 && (
                                                            <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 text-[9px] font-black">
                                                                +{sub.overrides.length}
                                                            </span>
                                                        )}
                                                        {sub.hasWhatsAppBills && (
                                                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-black" title="WhatsApp Bills Add-on Active">
                                                                WA
                                                            </span>
                                                        )}
                                                    </button>
                                                </td>

                                                {/* Status */}
                                                <td className="p-4">
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <CheckCircle size={10} />
                                                        Active
                                                    </span>
                                                </td>

                                                {/* Actions */}
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => setSelectedSub(sub)}
                                                            className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                                                            title="View Details"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => setOverrideSub(sub)}
                                                            className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Feature Entitlements & Overrides"
                                                        >
                                                            <Sliders size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setChangePlanSub(sub);
                                                                setModalPlanSlug(sub.planSlug);
                                                                setModalBillingCycle(sub.billingCycle.toLowerCase() === 'annual' ? 'annual' : 'monthly');
                                                            }}
                                                            className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            Change Plan
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setExtendSub(sub);
                                                                setModalDays(30);
                                                            }}
                                                            className="px-2 py-1 text-xs font-bold text-neutral-700 hover:bg-neutral-100 border border-[#E4E7EC] rounded-lg transition-colors cursor-pointer"
                                                            title="Extend"
                                                        >
                                                            Extend
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setSuspendSub(sub);
                                                                setModalReason('');
                                                            }}
                                                            className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Suspend"
                                                        >
                                                            <Ban size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                TAB 4: TRIAL RESTAURANTS
            ========================================== */}
            {activeTab === 'trial' && (
                <div className="space-y-4">
                    {/* Filter & Search Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-[#E4E7EC] shadow-2xs flex items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={15} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search trial restaurants by name, owner, or ID..."
                                className="w-full pl-10 pr-4 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs text-[#172033] placeholder-neutral-400 focus:outline-none focus:border-indigo-600 focus:bg-white font-medium"
                            />
                        </div>
                        <span className="text-xs font-mono font-bold text-neutral-500">
                            {trialList.length} Accounts in Evaluation
                        </span>
                    </div>

                    {/* Trial Table */}
                    <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-black uppercase tracking-wider text-[#667085]">
                                        <th className="p-4 w-48">Owner</th>
                                        <th className="p-4 w-52">Restaurant / Location</th>
                                        <th className="p-4 w-36">restaurant_id</th>
                                        <th className="p-4 w-32">Trial Start</th>
                                        <th className="p-4 w-36">Trial Expiry</th>
                                        <th className="p-4 w-36">Days Remaining</th>
                                        <th className="p-4 w-36">Features</th>
                                        <th className="p-4 w-28">Trial Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E4E7EC]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center text-neutral-400">
                                                <div className="inline-block h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-2" />
                                                <p className="font-semibold text-xs">Loading trial accounts...</p>
                                            </td>
                                        </tr>
                                    ) : trialList.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center text-neutral-400">
                                                <Clock size={32} className="mx-auto mb-2 opacity-30" />
                                                <p className="font-bold text-xs text-[#172033]">No restaurants currently in trial</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        trialList.map((sub) => {
                                            const isUrgent = sub.daysRemaining !== null && sub.daysRemaining <= 3;

                                            return (
                                                <tr key={sub.id} className="hover:bg-[#F5F7FC]/80 transition-colors">
                                                    {/* Owner */}
                                                    <td className="p-4">
                                                        <div className="font-bold text-[#172033]">{sub.ownerName}</div>
                                                        <div className="text-[11px] text-neutral-400 truncate max-w-[170px]">{sub.ownerEmail}</div>
                                                    </td>

                                                    {/* Restaurant */}
                                                    <td className="p-4">
                                                        <div className="font-bold text-[#172033]">{sub.restaurantName}</div>
                                                        <span className="text-[10px] text-cyan-700 font-bold bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200 inline-block mt-0.5">
                                                            14-Day Free Evaluation
                                                        </span>
                                                    </td>

                                                    {/* restaurant_id */}
                                                    <td className="p-4 font-mono text-[11px] text-[#172033]">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-extrabold">{sub.restaurantId}</span>
                                                            <button
                                                                onClick={() => handleCopy(sub.restaurantId, 'Restaurant ID')}
                                                                className="text-neutral-400 hover:text-indigo-600 transition-colors"
                                                            >
                                                                <Copy size={12} />
                                                            </button>
                                                        </div>
                                                    </td>

                                                    {/* Trial Start */}
                                                    <td className="p-4 text-neutral-500 font-mono text-[11px]">
                                                        {sub.trialStartsAt ? new Date(sub.trialStartsAt).toLocaleDateString() : '—'}
                                                    </td>

                                                    {/* Trial Expiry */}
                                                    <td className="p-4 font-mono text-[11px] font-bold text-[#172033]">
                                                        {sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString() : '—'}
                                                    </td>

                                                    {/* Days Remaining */}
                                                    <td className="p-4">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold ${
                                                            isUrgent
                                                                ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                                                                : 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                                                        }`}>
                                                            <Clock size={11} />
                                                            {sub.daysRemaining !== null ? `${sub.daysRemaining} days left` : 'Expired'}
                                                        </span>
                                                    </td>

                                                    {/* Features */}
                                                    <td className="p-4">
                                                        <button
                                                            onClick={() => setOverrideSub(sub)}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#F5F7FC] hover:bg-indigo-50 text-indigo-700 border border-[#E4E7EC] hover:border-indigo-200 transition-all cursor-pointer group shadow-2xs"
                                                            title="View & Manage Feature Entitlements & Overrides"
                                                        >
                                                            <Sliders size={12} className="text-neutral-400 group-hover:text-indigo-600 transition-colors" />
                                                            <span>{sub.availableFeatures?.length || (sub.features ? Object.values(sub.features).filter(Boolean).length : 0)} Active</span>
                                                            {sub.overrides && sub.overrides.length > 0 && (
                                                                <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 text-[9px] font-black">
                                                                    +{sub.overrides.length}
                                                                </span>
                                                            )}
                                                        </button>
                                                    </td>

                                                    {/* Trial Status */}
                                                    <td className="p-4">
                                                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-50 text-cyan-700 border border-cyan-200">
                                                            In Trial
                                                        </span>
                                                    </td>

                                                    {/* Actions */}
                                                    <td className="p-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button
                                                                onClick={() => setOverrideSub(sub)}
                                                                className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                                                title="Feature Entitlements & Overrides"
                                                            >
                                                                <Sliders size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setExtendTrialSub(sub);
                                                                    setModalDays(14);
                                                                }}
                                                                className="px-2.5 py-1 text-xs font-bold text-neutral-700 hover:bg-neutral-100 border border-[#E4E7EC] rounded-lg transition-colors cursor-pointer"
                                                            >
                                                                Extend Trial
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setConvertTrialSub(sub);
                                                                    setModalPlanSlug('growth');
                                                                    setModalBillingCycle('monthly');
                                                                }}
                                                                className="px-3 py-1 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                                            >
                                                                Convert to Paid
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setCancelSub(sub);
                                                                    setModalReason('');
                                                                }}
                                                                className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                                title="Cancel Trial"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                TAB 5: EXPIRED / CANCELLED
            ========================================== */}
            {activeTab === 'expired' && (
                <div className="space-y-4">
                    {/* Filter & Search Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-[#E4E7EC] shadow-2xs flex items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={15} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search expired or cancelled accounts by restaurant, owner, or ID..."
                                className="w-full pl-10 pr-4 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs text-[#172033] placeholder-neutral-400 focus:outline-none focus:border-indigo-600 focus:bg-white font-medium"
                            />
                        </div>
                        <span className="text-xs font-mono font-bold text-neutral-500">
                            {expiredList.length} Churned / Inactive Accounts
                        </span>
                    </div>

                    {/* Expired Table */}
                    <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-black uppercase tracking-wider text-[#667085]">
                                        <th className="p-4 w-48">Owner</th>
                                        <th className="p-4 w-52">Restaurant / Location</th>
                                        <th className="p-4 w-36">restaurant_id</th>
                                        <th className="p-4 w-32">Previous Plan</th>
                                        <th className="p-4 w-36">Expiry / Cancel Date</th>
                                        <th className="p-4 w-36">Features</th>
                                        <th className="p-4 w-32">Status</th>
                                        <th className="p-4 w-36">Previous Billing</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E4E7EC]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center text-neutral-400">
                                                <div className="inline-block h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-2" />
                                                <p className="font-semibold text-xs">Loading inactive accounts...</p>
                                            </td>
                                        </tr>
                                    ) : expiredList.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center text-neutral-400">
                                                <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                                                <p className="font-bold text-xs text-[#172033]">Zero expired or cancelled accounts</p>
                                                <p className="text-[11px] text-neutral-400 mt-0.5">All onboarded restaurants maintain active or trial standing.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        expiredList.map((sub) => (
                                            <tr key={sub.id} className="hover:bg-[#F5F7FC]/80 transition-colors">
                                                {/* Owner */}
                                                <td className="p-4">
                                                    <div className="font-bold text-[#172033]">{sub.ownerName}</div>
                                                    <div className="text-[11px] text-neutral-400 truncate max-w-[170px]">{sub.ownerEmail}</div>
                                                </td>

                                                {/* Restaurant */}
                                                <td className="p-4">
                                                    <div className="font-bold text-[#172033]">{sub.restaurantName}</div>
                                                </td>

                                                {/* restaurant_id */}
                                                <td className="p-4 font-mono text-[11px] text-[#172033]">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-extrabold">{sub.restaurantId}</span>
                                                        <button
                                                            onClick={() => handleCopy(sub.restaurantId, 'Restaurant ID')}
                                                            className="text-neutral-400 hover:text-indigo-600 transition-colors"
                                                        >
                                                            <Copy size={12} />
                                                        </button>
                                                    </div>
                                                </td>

                                                {/* Previous Plan */}
                                                <td className="p-4">
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-100 text-neutral-700">
                                                        {sub.plan}
                                                    </span>
                                                </td>

                                                {/* Expiry / Cancel Date */}
                                                <td className="p-4 text-neutral-500 font-mono text-[11px]">
                                                    {sub.canceledAt
                                                        ? new Date(sub.canceledAt).toLocaleDateString()
                                                        : sub.currentPeriodEnd
                                                        ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                                                        : '—'}
                                                </td>

                                                {/* Features */}
                                                <td className="p-4">
                                                    <button
                                                        onClick={() => setOverrideSub(sub)}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-[#F5F7FC] hover:bg-indigo-50 text-indigo-700 border border-[#E4E7EC] hover:border-indigo-200 transition-all cursor-pointer group shadow-2xs"
                                                        title="View & Manage Feature Entitlements & Overrides"
                                                    >
                                                        <Sliders size={12} className="text-neutral-400 group-hover:text-indigo-600 transition-colors" />
                                                        <span>{sub.availableFeatures?.length || (sub.features ? Object.values(sub.features).filter(Boolean).length : 0)} Active</span>
                                                        {sub.overrides && sub.overrides.length > 0 && (
                                                            <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 text-[9px] font-black">
                                                                +{sub.overrides.length}
                                                            </span>
                                                        )}
                                                    </button>
                                                </td>

                                                {/* Status */}
                                                <td className="p-4">
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800">
                                                        {sub.status}
                                                    </span>
                                                </td>

                                                {/* Previous Billing */}
                                                <td className="p-4 font-mono text-xs text-[#172033]">
                                                    {sub.lastInvoice ? (
                                                        <span>₹{Number(sub.lastInvoice.total || sub.price).toLocaleString('en-IN')}</span>
                                                    ) : (
                                                        <span className="text-neutral-400">None</span>
                                                    )}
                                                </td>

                                                {/* Actions */}
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => setOverrideSub(sub)}
                                                            className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Feature Entitlements & Overrides"
                                                        >
                                                            <Sliders size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setReactivateSub(sub);
                                                                setModalPlanSlug(sub.planSlug || 'growth');
                                                                setModalBillingCycle('monthly');
                                                            }}
                                                            className="px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            Reactivate
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedSub(sub)}
                                                            className="px-2.5 py-1 text-xs font-bold text-neutral-600 hover:bg-neutral-100 border border-[#E4E7EC] rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            View History
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                TAB 6: PAYMENT RECORDS
            ========================================== */}
            {activeTab === 'payments' && (
                <div className="space-y-4">
                    {/* Filter & Search Bar */}
                    <div className="bg-white p-4 rounded-2xl border border-[#E4E7EC] shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={15} />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search payments by restaurant, owner, transaction ID, or invoice..."
                                className="w-full pl-10 pr-4 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs text-[#172033] placeholder-neutral-400 focus:outline-none focus:border-indigo-600 focus:bg-white font-medium"
                            />
                        </div>

                        {/* Filter Status Buttons */}
                        <div className="flex items-center gap-1.5 overflow-x-auto">
                            {(['ALL', 'COMPLETED', 'PENDING', 'FAILED', 'REFUNDED'] as const).map((filterStatus) => (
                                <button
                                    key={filterStatus}
                                    onClick={() => setPaymentFilter(filterStatus)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        paymentFilter === filterStatus
                                            ? 'bg-indigo-600 text-white shadow-2xs'
                                            : 'bg-[#F5F7FC] text-[#667085] hover:text-[#172033]'
                                    }`}
                                >
                                    {filterStatus.charAt(0) + filterStatus.slice(1).toLowerCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Payments Table */}
                    <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-black uppercase tracking-wider text-[#667085]">
                                        <th className="p-4 w-44">Owner</th>
                                        <th className="p-4 w-48">Restaurant / Location</th>
                                        <th className="p-4 w-32">restaurant_id</th>
                                        <th className="p-4 w-28">Amount</th>
                                        <th className="p-4 w-36">Payment ID</th>
                                        <th className="p-4 w-36">Payment Date</th>
                                        <th className="p-4 w-36">Payment Method</th>
                                        <th className="p-4 w-28">Status</th>
                                        <th className="p-4 w-32">Invoice</th>
                                        <th className="p-4 text-right">Refund Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#E4E7EC]">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={10} className="py-12 text-center text-neutral-400">
                                                <div className="inline-block h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-2" />
                                                <p className="font-semibold text-xs">Loading payment records...</p>
                                            </td>
                                        </tr>
                                    ) : filteredPayments.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="py-12 text-center text-neutral-400">
                                                <DollarSign size={32} className="mx-auto mb-2 opacity-30" />
                                                <p className="font-bold text-xs text-[#172033]">No payment transactions found</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredPayments.map((pay) => {
                                            const isCompleted = pay.status === 'COMPLETED';
                                            const isFailed = pay.status === 'FAILED';
                                            const isRefunded = pay.status === 'REFUNDED';

                                            return (
                                                <tr key={pay.id} className="hover:bg-[#F5F7FC]/80 transition-colors">
                                                    {/* Owner */}
                                                    <td className="p-4">
                                                        <div className="font-bold text-[#172033]">{pay.ownerName}</div>
                                                        <div className="text-[11px] text-neutral-400 truncate max-w-[150px]">{pay.ownerEmail}</div>
                                                    </td>

                                                    {/* Restaurant */}
                                                    <td className="p-4">
                                                        <div className="font-bold text-[#172033]">{pay.restaurantName}</div>
                                                    </td>

                                                    {/* restaurant_id */}
                                                    <td className="p-4 font-mono text-[11px] text-[#172033]">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-extrabold">{pay.restaurantId}</span>
                                                            <button
                                                                onClick={() => handleCopy(pay.restaurantId, 'Restaurant ID')}
                                                                className="text-neutral-400 hover:text-indigo-600 transition-colors"
                                                            >
                                                                <Copy size={12} />
                                                            </button>
                                                        </div>
                                                    </td>

                                                    {/* Amount */}
                                                    <td className="p-4 font-mono font-black text-[#172033] text-sm">
                                                        ₹{pay.amount.toLocaleString('en-IN')}
                                                    </td>

                                                    {/* Payment ID */}
                                                    <td className="p-4 font-mono text-[11px] text-neutral-600">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="truncate max-w-[120px]">{pay.paymentId}</span>
                                                            <button
                                                                onClick={() => handleCopy(pay.paymentId, 'Transaction ID')}
                                                                className="text-neutral-400 hover:text-indigo-600 transition-colors"
                                                            >
                                                                <Copy size={11} />
                                                            </button>
                                                        </div>
                                                    </td>

                                                    {/* Payment Date */}
                                                    <td className="p-4 font-mono text-[11px] text-neutral-500">
                                                        {new Date(pay.paymentDate).toLocaleDateString()}
                                                        <span className="block text-[10px] text-neutral-400">
                                                            {new Date(pay.paymentDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </td>

                                                    {/* Payment Method */}
                                                    <td className="p-4">
                                                        <div className="font-medium text-[#172033]">{pay.paymentMethod}</div>
                                                        <span className="text-[10px] text-neutral-400 font-mono">{pay.paymentGateway}</span>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="p-4">
                                                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                            isCompleted
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : isFailed
                                                                ? 'bg-rose-100 text-rose-800'
                                                                : isRefunded
                                                                ? 'bg-amber-100 text-amber-800'
                                                                : 'bg-neutral-100 text-neutral-700'
                                                        }`}>
                                                            {pay.status}
                                                        </span>
                                                    </td>

                                                    {/* Invoice */}
                                                    <td className="p-4">
                                                        <span className="font-mono text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                                                            {pay.invoiceNumber}
                                                        </span>
                                                    </td>

                                                    {/* Refund Status */}
                                                    <td className="p-4 text-right font-mono text-[11px]">
                                                        {isRefunded ? (
                                                            <span className="text-amber-700 font-bold">Refund Processed</span>
                                                        ) : (
                                                            <span className="text-neutral-400">None</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 1: VIEW SUBSCRIPTION DETAILS DRAWER
            ========================================== */}
            {selectedSub && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-2xl rounded-3xl border border-[#E4E7EC] p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                        {/* Header */}
                        <div className="flex items-start justify-between border-b border-[#E4E7EC] pb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        {selectedSub.plan} Tier
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                        selectedSub.status === 'ACTIVE'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : selectedSub.status === 'TRIAL'
                                            ? 'bg-cyan-100 text-cyan-800'
                                            : 'bg-rose-100 text-rose-800'
                                    }`}>
                                        {selectedSub.status}
                                    </span>
                                </div>
                                <h3 className="text-xl font-black text-[#172033] mt-2">
                                    {selectedSub.restaurantName}
                                </h3>
                                <p className="text-xs text-neutral-400 font-mono mt-0.5">
                                    Independent Restaurant ID: {selectedSub.restaurantId}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedSub(null)}
                                className="p-1 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Owner & Location Overview */}
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="p-4 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] space-y-1">
                                <span className="text-[10px] font-bold uppercase text-[#667085] tracking-wider block">
                                    OWNER RELATIONSHIP
                                </span>
                                <p className="font-extrabold text-sm text-[#172033]">{selectedSub.ownerName}</p>
                                <p className="text-neutral-500 font-mono text-[11px]">{selectedSub.ownerEmail}</p>
                                <p className="text-neutral-500 font-mono text-[11px]">{selectedSub.ownerPhone}</p>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] space-y-1">
                                <span className="text-[10px] font-bold uppercase text-[#667085] tracking-wider block">
                                    SUBSCRIPTION TIMELINE
                                </span>
                                <p className="font-semibold text-neutral-700">
                                    Cycle: <strong className="text-[#172033]">{selectedSub.billingCycle}</strong>
                                </p>
                                <p className="text-neutral-600 font-mono text-[11px]">
                                    Current Period: {new Date(selectedSub.currentPeriodStart).toLocaleDateString()} &rarr; {selectedSub.currentPeriodEnd ? new Date(selectedSub.currentPeriodEnd).toLocaleDateString() : 'N/A'}
                                </p>
                                {selectedSub.daysRemaining !== null && (
                                    <p className="text-indigo-600 font-bold font-mono text-[11px]">
                                        {selectedSub.daysRemaining} days remaining in cycle
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Quota & Pricing Matrix */}
                        <div className="p-4 rounded-2xl border border-[#E4E7EC] space-y-3">
                            <span className="text-[10px] font-bold uppercase text-[#667085] tracking-wider block">
                                ALLOCATED QUOTA & BILLING RATE
                            </span>
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="p-3 bg-neutral-50 rounded-xl">
                                    <span className="text-[10px] text-neutral-400 block font-mono">RATE</span>
                                    <span className="text-base font-black text-[#172033]">
                                        ₹{selectedSub.price.toLocaleString('en-IN')}
                                    </span>
                                </div>
                                <div className="p-3 bg-neutral-50 rounded-xl">
                                    <span className="text-[10px] text-neutral-400 block font-mono">MAX BRANCHES</span>
                                    <span className="text-base font-black text-[#172033]">
                                        {selectedSub.maxBranches}
                                    </span>
                                </div>
                                <div className="p-3 bg-neutral-50 rounded-xl">
                                    <span className="text-[10px] text-neutral-400 block font-mono">STAFF QUOTA</span>
                                    <span className="text-base font-black text-[#172033]">
                                        {selectedSub.maxEmployees}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Features & Entitlements Overview */}
                        <div className="p-4 rounded-2xl border border-[#E4E7EC] space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase text-[#667085] tracking-wider block">
                                    SUBSCRIPTION ENTITLEMENTS & ADD-ONS
                                </span>
                                <button
                                    onClick={() => {
                                        const sub = selectedSub;
                                        setSelectedSub(null);
                                        setOverrideSub(sub);
                                    }}
                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                                >
                                    <Sliders size={12} />
                                    <span>Manage Overrides</span>
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                                {(selectedSub.availableFeatures || []).map((fKey: string) => (
                                    <span
                                        key={fKey}
                                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1"
                                    >
                                        <Check size={10} className="text-emerald-600" />
                                        {fKey.replace(/_/g, ' ')}
                                    </span>
                                ))}
                                {(selectedSub.lockedFeatures || []).slice(0, 6).map((fKey: string) => (
                                    <span
                                        key={fKey}
                                        className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-neutral-100 text-neutral-400 border border-neutral-200 line-through"
                                    >
                                        {fKey.replace(/_/g, ' ')}
                                    </span>
                                ))}
                                {(selectedSub.lockedFeatures || []).length > 6 && (
                                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium text-neutral-400">
                                        +{(selectedSub.lockedFeatures || []).length - 6} more locked
                                    </span>
                                )}
                            </div>

                            {selectedSub.overrides && selectedSub.overrides.length > 0 && (
                                <div className="pt-2 border-t border-[#E4E7EC] flex items-center gap-2">
                                    <span className="text-[10px] font-black text-amber-700 uppercase bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                        {selectedSub.overrides.length} Active Override{selectedSub.overrides.length > 1 ? 's' : ''}
                                    </span>
                                    <span className="text-[11px] text-neutral-500 font-medium truncate">
                                        {selectedSub.overrides.map((o: any) => o.feature_key).join(', ')}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="pt-2 flex items-center justify-end gap-3">
                            <button
                                onClick={() => {
                                    const sub = selectedSub;
                                    setSelectedSub(null);
                                    setOverrideSub(sub);
                                }}
                                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                                <Sliders size={13} />
                                <span>Feature Overrides</span>
                            </button>
                            <button
                                onClick={() => {
                                    const sub = selectedSub;
                                    setSelectedSub(null);
                                    setChangePlanSub(sub);
                                    setModalPlanSlug(sub.planSlug);
                                    setModalBillingCycle(sub.billingCycle.toLowerCase() === 'annual' ? 'annual' : 'monthly');
                                }}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Change Plan
                            </button>
                            <button
                                onClick={() => {
                                    const sub = selectedSub;
                                    setSelectedSub(null);
                                    setExtendSub(sub);
                                    setModalDays(30);
                                }}
                                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Extend Period
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 2: CHANGE PLAN MODAL
            ========================================== */}
            {changePlanSub && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl border border-[#E4E7EC] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between border-b border-[#E4E7EC] pb-3">
                            <div>
                                <h3 className="text-base font-extrabold text-[#172033]">
                                    Change Subscription Plan
                                </h3>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    Select tier and billing cadence for {changePlanSub.restaurantName}.
                                </p>
                            </div>
                            <button
                                onClick={() => setChangePlanSub(null)}
                                className="p-1 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-[#172033] block mb-1.5">
                                    Target Plan Tier
                                </label>
                                <div className="grid grid-cols-1 gap-2.5">
                                    {allPlans.map((p) => (
                                        <div
                                            key={p.id}
                                            onClick={() => setModalPlanSlug(p.slug)}
                                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                                modalPlanSlug === p.slug
                                                    ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-600/10'
                                                    : 'bg-white border-[#E4E7EC] hover:bg-neutral-50'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-extrabold text-sm text-[#172033]">{p.name}</span>
                                                    {p.is_popular && (
                                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-indigo-100 text-indigo-700">
                                                            Popular
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-neutral-500 mt-0.5">{p.tagline}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="font-black text-sm text-[#172033]">
                                                    ₹{(modalBillingCycle === 'annual' ? p.price_annual : p.price_monthly).toLocaleString('en-IN')}
                                                </span>
                                                <span className="text-[10px] text-neutral-400 block font-mono">
                                                    {modalBillingCycle === 'annual' ? '/yr' : '/mo'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#172033] block mb-1.5">
                                    Billing Cadence
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setModalBillingCycle('monthly')}
                                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                            modalBillingCycle === 'monthly'
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-white text-neutral-700 border-[#E4E7EC]'
                                        }`}
                                    >
                                        Monthly Billing
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setModalBillingCycle('annual')}
                                        className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                            modalBillingCycle === 'annual'
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : 'bg-white text-neutral-700 border-[#E4E7EC]'
                                        }`}
                                    >
                                        Annual (Save 17%)
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E4E7EC]">
                            <button
                                onClick={() => setChangePlanSub(null)}
                                className="px-4 py-2 border border-[#E4E7EC] hover:bg-neutral-100 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleChangePlan}
                                disabled={actionLoading}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                            >
                                {actionLoading ? 'Updating Plan...' : 'Apply Plan Change'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 3: EXTEND SUBSCRIPTION MODAL
            ========================================== */}
            {extendSub && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl border border-[#E4E7EC] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between border-b border-[#E4E7EC] pb-3">
                            <div>
                                <h3 className="text-base font-extrabold text-[#172033]">
                                    Extend Active Subscription
                                </h3>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    Add grace period or manual cycle time for {extendSub.restaurantName}.
                                </p>
                            </div>
                            <button
                                onClick={() => setExtendSub(null)}
                                className="p-1 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-[#172033] block mb-2">
                                    Quick Days Extension
                                </label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[15, 30, 60, 90].map((d) => (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => setModalDays(d)}
                                            className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                                modalDays === d
                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                    : 'bg-white text-neutral-700 border-[#E4E7EC] hover:bg-neutral-50'
                                            }`}
                                        >
                                            +{d} Days
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#172033] block mb-1">
                                    Custom Days
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="365"
                                    placeholder="30"
                                    value={modalDays}
                                    onChange={(e) => setModalDays(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full px-3.5 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#172033] focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E4E7EC]">
                            <button
                                onClick={() => setExtendSub(null)}
                                className="px-4 py-2 border border-[#E4E7EC] hover:bg-neutral-100 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExtendSubscription}
                                disabled={actionLoading}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                            >
                                {actionLoading ? 'Extending...' : `Confirm +${modalDays} Days Extension`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 4: EXTEND TRIAL MODAL
            ========================================== */}
            {extendTrialSub && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl border border-[#E4E7EC] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between border-b border-[#E4E7EC] pb-3">
                            <div>
                                <h3 className="text-base font-extrabold text-[#172033]">
                                    Extend Complimentary Trial
                                </h3>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    Add evaluation days for {extendTrialSub.restaurantName}.
                                </p>
                            </div>
                            <button
                                onClick={() => setExtendTrialSub(null)}
                                className="p-1 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-[#172033] block mb-2">
                                    Trial Extension Duration
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[7, 14, 30].map((d) => (
                                        <button
                                            key={d}
                                            type="button"
                                            onClick={() => setModalDays(d)}
                                            className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                                modalDays === d
                                                    ? 'bg-cyan-600 text-white border-cyan-600'
                                                    : 'bg-white text-neutral-700 border-[#E4E7EC] hover:bg-neutral-50'
                                            }`}
                                        >
                                            +{d} Days
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E4E7EC]">
                            <button
                                onClick={() => setExtendTrialSub(null)}
                                className="px-4 py-2 border border-[#E4E7EC] hover:bg-neutral-100 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExtendTrial}
                                disabled={actionLoading}
                                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                            >
                                {actionLoading ? 'Extending Trial...' : `Extend Trial (+${modalDays} Days)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 5: CONVERT TRIAL TO PAID
            ========================================== */}
            {convertTrialSub && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-3xl border border-[#E4E7EC] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between border-b border-[#E4E7EC] pb-3">
                            <div>
                                <h3 className="text-base font-extrabold text-[#172033]">
                                    Convert Trial to Paid Subscription
                                </h3>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    Promote {convertTrialSub.restaurantName} to active paid standing.
                                </p>
                            </div>
                            <button
                                onClick={() => setConvertTrialSub(null)}
                                className="p-1 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-[#172033] block mb-1.5">
                                    Choose Paid Plan
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {allPlans.filter(p => !p.slug.includes('trial')).map((p) => (
                                        <div
                                            key={p.id}
                                            onClick={() => setModalPlanSlug(p.slug)}
                                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                                                modalPlanSlug === p.slug
                                                    ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-600/10'
                                                    : 'bg-white border-[#E4E7EC]'
                                            }`}
                                        >
                                            <div>
                                                <span className="font-extrabold text-sm text-[#172033]">{p.name}</span>
                                                <p className="text-xs text-neutral-500">{p.tagline}</p>
                                            </div>
                                            <span className="font-black text-sm text-[#172033]">
                                                ₹{(modalBillingCycle === 'annual' ? p.price_annual : p.price_monthly).toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                                <CheckCircle size={15} className="text-emerald-600 shrink-0" />
                                <span>Automatically generates invoice & marks initial paid payment.</span>
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E4E7EC]">
                            <button
                                onClick={() => setConvertTrialSub(null)}
                                className="px-4 py-2 border border-[#E4E7EC] hover:bg-neutral-100 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConvertTrialToPaid}
                                disabled={actionLoading}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                            >
                                {actionLoading ? 'Converting...' : 'Confirm Conversion to Paid'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 6: SUSPEND SUBSCRIPTION
            ========================================== */}
            {suspendSub && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl border border-rose-200 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between border-b border-[#E4E7EC] pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                                    <Ban size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-[#172033]">
                                        Suspend Subscription
                                    </h3>
                                    <p className="text-xs text-neutral-500">{suspendSub.restaurantName}</p>
                                </div>
                            </div>
                            <button onClick={() => setSuspendSub(null)} className="p-1 rounded-xl text-neutral-400">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs text-neutral-600 leading-relaxed">
                                Suspending this subscription will immediately lock digital ordering, POS, and KDS access for this restaurant location.
                            </p>
                            <div>
                                <label className="text-xs font-bold text-[#172033] block mb-1">
                                    Reason for Suspension (Audit Log)
                                </label>
                                <textarea
                                    rows={3}
                                    value={modalReason}
                                    onChange={(e) => setModalReason(e.target.value)}
                                    placeholder="e.g. Non-payment of subscription dues / compliance violation..."
                                    className="w-full p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-medium text-[#172033] focus:outline-none focus:border-rose-600 focus:bg-white"
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E4E7EC]">
                            <button
                                onClick={() => setSuspendSub(null)}
                                className="px-4 py-2 border border-[#E4E7EC] hover:bg-neutral-100 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleSuspend}
                                disabled={actionLoading}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                            >
                                {actionLoading ? 'Suspending...' : 'Confirm Suspension'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 7: CANCEL SUBSCRIPTION
            ========================================== */}
            {cancelSub && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl border border-rose-200 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between border-b border-[#E4E7EC] pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                                    <AlertTriangle size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-[#172033]">
                                        Cancel Subscription
                                    </h3>
                                    <p className="text-xs text-neutral-500">{cancelSub.restaurantName}</p>
                                </div>
                            </div>
                            <button onClick={() => setCancelSub(null)} className="p-1 rounded-xl text-neutral-400">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <p className="text-xs text-neutral-600 leading-relaxed">
                                Terminating this subscription marks the account as churned/cancelled.
                            </p>
                            <div>
                                <label className="text-xs font-bold text-[#172033] block mb-1">
                                    Cancellation Reason
                                </label>
                                <textarea
                                    rows={2}
                                    value={modalReason}
                                    onChange={(e) => setModalReason(e.target.value)}
                                    placeholder="e.g. Owner requested offboarding..."
                                    className="w-full p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-medium text-[#172033] focus:outline-none focus:border-rose-600 focus:bg-white"
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E4E7EC]">
                            <button
                                onClick={() => setCancelSub(null)}
                                className="px-4 py-2 border border-[#E4E7EC] hover:bg-neutral-100 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={actionLoading}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                            >
                                {actionLoading ? 'Cancelling...' : 'Confirm Cancellation'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 8: REACTIVATE SUBSCRIPTION
            ========================================== */}
            {reactivateSub && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl border border-emerald-200 p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between border-b border-[#E4E7EC] pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                                    <RotateCcw size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-[#172033]">
                                        Reactivate Subscription
                                    </h3>
                                    <p className="text-xs text-neutral-500">{reactivateSub.restaurantName}</p>
                                </div>
                            </div>
                            <button onClick={() => setReactivateSub(null)} className="p-1 rounded-xl text-neutral-400">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-[#172033] block mb-1">
                                    Select Plan Tier
                                </label>
                                <select
                                    value={modalPlanSlug}
                                    onChange={(e) => setModalPlanSlug(e.target.value)}
                                    className="w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#172033]"
                                >
                                    {allPlans.filter(p => !p.slug.includes('trial')).map(p => (
                                        <option key={p.id} value={p.slug}>{p.name} - ₹{p.price_monthly}/mo</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E4E7EC]">
                            <button
                                onClick={() => setReactivateSub(null)}
                                className="px-4 py-2 border border-[#E4E7EC] hover:bg-neutral-100 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReactivate}
                                disabled={actionLoading}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                            >
                                {actionLoading ? 'Reactivating...' : 'Reactivate Now'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 9: CREATE / EDIT PLAN MODAL
            ========================================== */}
            {(createPlanOpen || editPlan) && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-xl rounded-3xl border border-[#E4E7EC] p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between border-b border-[#E4E7EC] pb-3">
                            <div>
                                <h3 className="text-base font-extrabold text-[#172033]">
                                    {editPlan ? `Edit Plan: ${editPlan.name}` : 'Create New Subscription Plan'}
                                </h3>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    Configure pricing, multi-outlet allowances, and included software modules.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setCreatePlanOpen(false);
                                    setEditPlan(null);
                                }}
                                className="p-1 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-[#172033] block mb-1">Plan Name *</label>
                                    <input
                                        type="text"
                                        value={planForm.name}
                                        onChange={(e) => {
                                            const n = e.target.value;
                                            setPlanForm({
                                                ...planForm,
                                                name: n,
                                                slug: editPlan ? planForm.slug : n.toLowerCase().replace(/\s+/g, '-')
                                            });
                                        }}
                                        placeholder="e.g. Growth Pro"
                                        className="w-full px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-medium focus:outline-none focus:border-indigo-600 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033] block mb-1">Slug Identifier *</label>
                                    <input
                                        type="text"
                                        disabled={!!editPlan}
                                        value={planForm.slug}
                                        onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                        placeholder="e.g. growth-pro"
                                        className="w-full px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-mono text-[11px] disabled:opacity-50"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-[#172033] block mb-1">Tagline / Subtitle</label>
                                <input
                                    type="text"
                                    value={planForm.tagline}
                                    onChange={(e) => setPlanForm({ ...planForm, tagline: e.target.value })}
                                    placeholder="Brief positioning statement..."
                                    className="w-full px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-medium focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="font-bold text-[#172033] block mb-1">Monthly (₹) *</label>
                                    <input
                                        type="number"
                                        placeholder="4999"
                                        value={planForm.priceMonthly}
                                        onChange={(e) => setPlanForm({ ...planForm, priceMonthly: e.target.value === '' ? '' : Number(e.target.value) })}
                                        className="w-full px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-bold font-mono focus:outline-none focus:border-indigo-600 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033] block mb-1">Annual (₹) *</label>
                                    <input
                                        type="number"
                                        placeholder="49990"
                                        value={planForm.priceAnnual}
                                        onChange={(e) => setPlanForm({ ...planForm, priceAnnual: e.target.value === '' ? '' : Number(e.target.value) })}
                                        className="w-full px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-bold font-mono focus:outline-none focus:border-indigo-600 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033] block mb-1">Trial Days</label>
                                    <input
                                        type="number"
                                        placeholder="14"
                                        value={planForm.trialDays}
                                        onChange={(e) => setPlanForm({ ...planForm, trialDays: e.target.value === '' ? '' : Number(e.target.value) })}
                                        className="w-full px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-bold font-mono focus:outline-none focus:border-indigo-600 focus:bg-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-[#172033] block mb-1">Max Branches Quota</label>
                                    <input
                                        type="number"
                                        placeholder="5"
                                        value={planForm.maxBranches}
                                        onChange={(e) => setPlanForm({ ...planForm, maxBranches: e.target.value === '' ? '' : Number(e.target.value) })}
                                        className="w-full px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-bold font-mono focus:outline-none focus:border-indigo-600 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033] block mb-1">Max Staff Members</label>
                                    <input
                                        type="number"
                                        placeholder="50"
                                        value={planForm.maxEmployees}
                                        onChange={(e) => setPlanForm({ ...planForm, maxEmployees: e.target.value === '' ? '' : Number(e.target.value) })}
                                        className="w-full px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-bold font-mono focus:outline-none focus:border-indigo-600 focus:bg-white"
                                    />
                                </div>
                            </div>

                            {/* Features list manager */}
                            <div>
                                <label className="font-bold text-[#172033] block mb-1">Features Included</label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={planForm.featureInput}
                                        onChange={(e) => setPlanForm({ ...planForm, featureInput: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                if (planForm.featureInput.trim()) {
                                                    setPlanForm({
                                                        ...planForm,
                                                        features: [...planForm.features, planForm.featureInput.trim()],
                                                        featureInput: ''
                                                    });
                                                }
                                            }
                                        }}
                                        placeholder="Add feature capability..."
                                        className="flex-1 px-3 py-1.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-medium focus:outline-none focus:border-indigo-600 focus:bg-white"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (planForm.featureInput.trim()) {
                                                setPlanForm({
                                                    ...planForm,
                                                    features: [...planForm.features, planForm.featureInput.trim()],
                                                    featureInput: ''
                                                });
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-neutral-900 text-white rounded-xl font-bold cursor-pointer hover:bg-neutral-800"
                                    >
                                        Add
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {planForm.features.map((feat, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-neutral-100 text-[#172033] font-medium"
                                        >
                                            <span>{feat}</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const updated = planForm.features.filter((_, i) => i !== idx);
                                                    setPlanForm({ ...planForm, features: updated });
                                                }}
                                                className="text-neutral-400 hover:text-rose-600"
                                            >
                                                <X size={12} />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="plan-popular"
                                    checked={planForm.isPopular}
                                    onChange={(e) => setPlanForm({ ...planForm, isPopular: e.target.checked })}
                                    className="rounded border-[#E4E7EC] text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                                />
                                <label htmlFor="plan-popular" className="font-bold text-[#172033] cursor-pointer">
                                    Designate as &quot;Most Popular Choice&quot; Badge
                                </label>
                            </div>
                        </div>

                        <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#E4E7EC]">
                            <button
                                onClick={() => {
                                    setCreatePlanOpen(false);
                                    setEditPlan(null);
                                }}
                                className="px-4 py-2 border border-[#E4E7EC] hover:bg-neutral-100 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleSavePlan(!!editPlan)}
                                disabled={actionLoading}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                            >
                                {actionLoading ? 'Saving...' : editPlan ? 'Save Changes' : 'Create Tier'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 10: RECORD MANUAL PAYMENT MODAL
            ========================================== */}
            {manualPayOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-3xl border border-[#E4E7EC] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between border-b border-[#E4E7EC] pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                                    <IndianRupee size={18} />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-[#172033]">
                                        Record Offline Payment
                                    </h3>
                                    <p className="text-xs text-neutral-500">
                                        Log direct bank transfer, cash, or offline payment.
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setManualPayOpen(false)} className="p-1 rounded-xl text-neutral-400">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-3.5 text-xs">
                            <div>
                                <label className="font-bold text-[#172033] block mb-1">Target Restaurant *</label>
                                <select
                                    value={modalTargetRestId}
                                    onChange={(e) => setModalTargetRestId(e.target.value)}
                                    className="w-full p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-bold text-[#172033]"
                                >
                                    {allSubscriptions.map((s) => (
                                        <option key={s.restaurantId} value={s.restaurantId}>
                                            {s.restaurantName} ({s.restaurantId}) - {s.ownerName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="font-bold text-[#172033] block mb-1">Amount (₹) *</label>
                                    <input
                                        type="number"
                                        placeholder="4999"
                                        value={modalAmount}
                                        onChange={(e) => setModalAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-bold font-mono focus:outline-none focus:border-indigo-600 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033] block mb-1">Method</label>
                                    <select
                                        value={modalPayMethod}
                                        onChange={(e) => setModalPayMethod(e.target.value)}
                                        className="w-full p-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-bold text-[#172033]"
                                    >
                                        <option value="UPI AutoDebit">UPI AutoDebit</option>
                                        <option value="Direct Bank Transfer (NEFT/RTGS)">NEFT / RTGS</option>
                                        <option value="Corporate Cheque">Corporate Cheque</option>
                                        <option value="Cash Settlement">Cash Settlement</option>
                                        <option value="Card Terminal POS">Card Terminal POS</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-[#172033] block mb-1">Notes / Transaction Reference</label>
                                <input
                                    type="text"
                                    value={modalNotes}
                                    onChange={(e) => setModalNotes(e.target.value)}
                                    placeholder="e.g. UTR #98234789234 confirmed by bank"
                                    className="w-full px-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-medium focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E4E7EC]">
                            <button
                                onClick={() => setManualPayOpen(false)}
                                className="px-4 py-2 border border-[#E4E7EC] hover:bg-neutral-100 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRecordManualPayment}
                                disabled={actionLoading}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                            >
                                {actionLoading ? 'Recording...' : 'Record Payment & Mark Paid'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==========================================
                MODAL 7: FEATURE OVERRIDES & ENTITLEMENTS MODAL
            ========================================== */}
            {overrideSub && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl rounded-3xl border border-[#E4E7EC] p-6 shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                        {/* Modal Header */}
                        <div className="flex items-start justify-between border-b border-[#E4E7EC] pb-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        {overrideSub.plan} Plan
                                    </span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                        overrideSub.status === 'ACTIVE'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : overrideSub.status === 'TRIAL'
                                            ? 'bg-cyan-100 text-cyan-800'
                                            : 'bg-rose-100 text-rose-800'
                                    }`}>
                                        {overrideSub.status}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
                                        {overrideSub.availableFeatures?.length || (overrideSub.features ? Object.values(overrideSub.features).filter(Boolean).length : 0)} / 25 Features Enabled
                                    </span>
                                    {overrideSub.overrides && overrideSub.overrides.length > 0 && (
                                        <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                                            {overrideSub.overrides.length} Custom Override{overrideSub.overrides.length > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-xl font-black text-[#172033] mt-2 flex items-center gap-2">
                                    <Sliders className="text-indigo-600" size={20} />
                                    <span>Feature Entitlements & Overrides</span>
                                    <span className="text-neutral-400 font-normal">|</span>
                                    <span>{overrideSub.restaurantName}</span>
                                </h3>
                                <p className="text-xs text-neutral-400 font-mono mt-0.5">
                                    Independent Restaurant ID: <strong className="text-[#172033] font-bold">{overrideSub.restaurantId}</strong> • Owner: <strong className="text-[#172033] font-bold">{overrideSub.ownerName}</strong> ({overrideSub.ownerEmail})
                                </p>
                            </div>
                            <button
                                onClick={() => setOverrideSub(null)}
                                className="p-1 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Top One-Click SaaS Actions Bar */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {/* 1. WhatsApp Bills Add-on */}
                            <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider">
                                            PAID ADD-ON
                                        </span>
                                        <span className="text-xs font-mono font-bold text-emerald-700">₹499/mo</span>
                                    </div>
                                    <h4 className="font-extrabold text-xs text-[#172033]">WhatsApp Digital Bills</h4>
                                    <p className="text-[11px] text-neutral-500 mt-0.5">Instant delivery of PDF bills & order updates via WhatsApp.</p>
                                </div>
                                <div className="mt-3">
                                    {overrideSub.hasWhatsAppBills || overrideSub.features?.whatsapp_bills ? (
                                        <div className="flex items-center justify-between">
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                                                <CheckCircle size={12} /> Active
                                            </span>
                                            <button
                                                onClick={() => handleRemoveFeatureOverride('whatsapp_bills')}
                                                disabled={actionLoading}
                                                className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                                            >
                                                Revoke
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleSetFeatureOverride('whatsapp_bills', true, 'Super Admin granted WhatsApp Bills add-on', 30)}
                                            disabled={actionLoading}
                                            className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                                        >
                                            + Grant WhatsApp Add-on
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 2. Delivery Management Override */}
                            <div className="p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/40 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase text-indigo-800 tracking-wider">
                                            GROWTH PLAN+
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-indigo-600">Operations</span>
                                    </div>
                                    <h4 className="font-extrabold text-xs text-[#172033]">Delivery Management</h4>
                                    <p className="text-[11px] text-neutral-500 mt-0.5">Delivery orders, driver assignment, GPS tracking & zones.</p>
                                </div>
                                <div className="mt-3">
                                    {overrideSub.features?.delivery ? (
                                        <div className="flex items-center justify-between">
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                                                <CheckCircle size={12} /> Enabled
                                            </span>
                                            {(overrideSub.overrides || []).some((o: any) => o.feature_key === 'delivery') && (
                                                <button
                                                    onClick={() => handleRemoveFeatureOverride('delivery')}
                                                    disabled={actionLoading}
                                                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                                                >
                                                    Remove Override
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleSetFeatureOverride('delivery', true, 'Temporary Delivery feature trial granted by Super Admin', 30)}
                                            disabled={actionLoading}
                                            className="w-full py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                                        >
                                            + Grant Delivery Access
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* 3. Inventory Management Override */}
                            <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider">
                                            GROWTH PLAN+
                                        </span>
                                        <span className="text-[10px] font-mono font-bold text-amber-600">Stock Control</span>
                                    </div>
                                    <h4 className="font-extrabold text-xs text-[#172033]">Inventory & Recipes</h4>
                                    <p className="text-[11px] text-neutral-500 mt-0.5">Raw materials, recipe auto-deduction & low stock alerts.</p>
                                </div>
                                <div className="mt-3">
                                    {overrideSub.features?.inventory ? (
                                        <div className="flex items-center justify-between">
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                                                <CheckCircle size={12} /> Enabled
                                            </span>
                                            {(overrideSub.overrides || []).some((o: any) => o.feature_key === 'inventory') && (
                                                <button
                                                    onClick={() => handleRemoveFeatureOverride('inventory')}
                                                    disabled={actionLoading}
                                                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 underline cursor-pointer"
                                                >
                                                    Remove Override
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleSetFeatureOverride('inventory', true, 'Temporary Inventory feature trial granted by Super Admin', 30)}
                                            disabled={actionLoading}
                                            className="w-full py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                                        >
                                            + Grant Inventory Access
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Active Overrides Ledger Table (if any overrides exist for this restaurant) */}
                        {overrideSub.overrides && overrideSub.overrides.length > 0 && (
                            <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-extrabold text-xs text-amber-900 flex items-center gap-1.5">
                                        <AlertCircle size={14} className="text-amber-600" />
                                        <span>Active Restaurant Feature Overrides ({overrideSub.overrides.length})</span>
                                    </h4>
                                    <span className="text-[10px] text-amber-700 font-mono font-bold">
                                        Overrides supersede base plan rules
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="border-b border-amber-200/80 text-[10px] font-black uppercase text-amber-800 tracking-wider">
                                                <th className="py-2 pr-3">Feature</th>
                                                <th className="py-2 px-3">State</th>
                                                <th className="py-2 px-3">Reason</th>
                                                <th className="py-2 px-3">Granted By</th>
                                                <th className="py-2 px-3">Expires At</th>
                                                <th className="py-2 pl-3 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-amber-200/50">
                                            {overrideSub.overrides.map((ov: any) => {
                                                const isExpired = ov.expires_at && new Date(ov.expires_at).getTime() < Date.now();
                                                return (
                                                    <tr key={ov.id || ov.feature_key} className="hover:bg-amber-100/40">
                                                        <td className="py-2.5 pr-3 font-mono font-bold text-[#172033]">
                                                            {ov.feature_key}
                                                        </td>
                                                        <td className="py-2.5 px-3">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                                                ov.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                            }`}>
                                                                {ov.enabled ? 'Enabled' : 'Disabled'}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-neutral-600 text-[11px] max-w-xs truncate" title={ov.reason}>
                                                            {ov.reason || 'Super Admin override'}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-neutral-500 font-mono text-[10px]">
                                                            {ov.created_by || 'Admin'}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-mono text-[10px]">
                                                            {ov.expires_at ? (
                                                                <span className={isExpired ? 'text-rose-600 font-bold' : 'text-neutral-700'}>
                                                                    {new Date(ov.expires_at).toLocaleDateString()}
                                                                    {isExpired ? ' (Expired)' : ''}
                                                                </span>
                                                            ) : (
                                                                <span className="text-indigo-600 font-bold">Indefinite</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 pl-3 text-right">
                                                            <button
                                                                onClick={() => handleRemoveFeatureOverride(ov.feature_key)}
                                                                disabled={actionLoading}
                                                                className="px-2 py-1 text-xs font-bold text-rose-600 hover:bg-rose-100/80 rounded-lg transition-colors cursor-pointer"
                                                            >
                                                                Revoke
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Search & Category Filter */}
                        <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                <div className="relative flex-1 w-full">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
                                    <input
                                        type="text"
                                        value={overrideSearch}
                                        onChange={(e) => setOverrideSearch(e.target.value)}
                                        placeholder="Search 25 entitlements (e.g. delivery, pos, reports)..."
                                        className="w-full pl-9 pr-3 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-indigo-600 focus:bg-white"
                                    />
                                </div>
                                <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                                    {[
                                        { id: 'ALL', label: 'All (25)' },
                                        { id: 'ordering', label: 'Ordering' },
                                        { id: 'operations', label: 'Operations' },
                                        { id: 'management', label: 'Staff' },
                                        { id: 'multi_unit', label: 'Multi-Store' },
                                        { id: 'intelligence', label: 'Reports' },
                                        { id: 'addon', label: 'Add-ons' },
                                    ].map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setOverrideCategoryFilter(cat.id)}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                                                overrideCategoryFilter === cat.id
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-[#F5F7FC] text-neutral-600 hover:bg-neutral-200/60'
                                            }`}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Features Table */}
                            <div className="border border-[#E4E7EC] rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-[#F5F7FC] sticky top-0 z-10 border-b border-[#E4E7EC]">
                                        <tr className="text-[10px] font-black uppercase text-[#667085] tracking-wider">
                                            <th className="p-3 w-56">Feature</th>
                                            <th className="p-3 w-32">Min. Plan</th>
                                            <th className="p-3">Description</th>
                                            <th className="p-3 w-28">Status</th>
                                            <th className="p-3 text-right w-36">Override</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#E4E7EC]">
                                        {ALL_FEATURES_CATALOG
                                            .filter((f) => {
                                                if (overrideCategoryFilter !== 'ALL' && f.category !== overrideCategoryFilter) return false;
                                                if (overrideSearch.trim()) {
                                                    const q = overrideSearch.toLowerCase();
                                                    return f.label.toLowerCase().includes(q) || f.key.toLowerCase().includes(q) || f.desc.toLowerCase().includes(q);
                                                }
                                                return true;
                                            })
                                            .map((feat) => {
                                                const isEnabled = Boolean(overrideSub.features?.[feat.key]);
                                                const existingOverride = (overrideSub.overrides || []).find((o: any) => o.feature_key === feat.key);

                                                return (
                                                    <tr key={feat.key} className="hover:bg-[#F5F7FC]/70 transition-colors">
                                                        <td className="p-3">
                                                            <div className="font-extrabold text-[#172033] flex items-center gap-1.5">
                                                                <span>{feat.label}</span>
                                                            </div>
                                                            <span className="font-mono text-[10px] text-neutral-400">
                                                                {feat.key}
                                                            </span>
                                                        </td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                feat.minPlan === 'Paid Add-on'
                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                    : feat.minPlan === 'Standard'
                                                                    ? 'bg-blue-50 text-blue-700'
                                                                    : feat.minPlan === 'Growth'
                                                                    ? 'bg-purple-50 text-purple-700'
                                                                    : 'bg-indigo-100 text-indigo-800'
                                                            }`}>
                                                                {feat.minPlan}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-[11px] text-neutral-500">
                                                            {feat.desc}
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="flex flex-col items-start gap-1">
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                                                                    isEnabled
                                                                        ? 'bg-emerald-100 text-emerald-800'
                                                                        : 'bg-neutral-100 text-neutral-400'
                                                                }`}>
                                                                    {isEnabled ? 'Enabled' : 'Locked'}
                                                                </span>
                                                                {existingOverride && (
                                                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-100 text-amber-800">
                                                                        Override
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            {existingOverride ? (
                                                                <button
                                                                    onClick={() => handleRemoveFeatureOverride(feat.key)}
                                                                    disabled={actionLoading}
                                                                    className="px-2.5 py-1 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                                                                >
                                                                    Remove
                                                                </button>
                                                            ) : isEnabled ? (
                                                                <button
                                                                    onClick={() => handleSetFeatureOverride(feat.key, false, `Administrative disable override for ${feat.label}`, 30)}
                                                                    disabled={actionLoading}
                                                                    className="px-2 py-1 text-xs font-bold text-neutral-600 hover:bg-neutral-100 border border-[#E4E7EC] rounded-lg transition-colors cursor-pointer"
                                                                    title="Force disable this feature for this restaurant"
                                                                >
                                                                    Disable
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleSetFeatureOverride(feat.key, true, `Administrative grant override for ${feat.label}`, 30)}
                                                                    disabled={actionLoading}
                                                                    className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                                                                >
                                                                    Grant (30d)
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Custom Override Form Accordion/Section */}
                        <div className="p-4 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] space-y-3">
                            <span className="text-[10px] font-bold uppercase text-[#667085] tracking-wider block">
                                CONFIGURE CUSTOM ENTITLEMENT OVERRIDE
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                                <div>
                                    <label className="font-bold text-[#172033] block mb-1">Feature</label>
                                    <select
                                        value={overrideFeatureKey}
                                        onChange={(e) => setOverrideFeatureKey(e.target.value)}
                                        className="w-full p-2 bg-white border border-[#E4E7EC] rounded-xl font-bold text-[#172033]"
                                    >
                                        {ALL_FEATURES_CATALOG.map((f) => (
                                            <option key={f.key} value={f.key}>
                                                {f.label} ({f.key})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033] block mb-1">Access State</label>
                                    <select
                                        value={overrideEnabled ? 'true' : 'false'}
                                        onChange={(e) => setOverrideEnabled(e.target.value === 'true')}
                                        className="w-full p-2 bg-white border border-[#E4E7EC] rounded-xl font-bold text-[#172033]"
                                    >
                                        <option value="true">Grant / Enable Feature</option>
                                        <option value="false">Revoke / Force Disable</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033] block mb-1">Duration</label>
                                    <select
                                        value={overrideExpiryDays}
                                        onChange={(e) => setOverrideExpiryDays(e.target.value === '0' ? '' : Number(e.target.value))}
                                        className="w-full p-2 bg-white border border-[#E4E7EC] rounded-xl font-bold text-[#172033]"
                                    >
                                        <option value={7}>7 Days (Trial)</option>
                                        <option value={14}>14 Days (Evaluation)</option>
                                        <option value={30}>30 Days (1 Month)</option>
                                        <option value={90}>90 Days (Quarter)</option>
                                        <option value={365}>365 Days (1 Year)</option>
                                        <option value={0}>Indefinite / Permanent</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="font-bold text-[#172033] block mb-1">Reason (Auditable) *</label>
                                    <input
                                        type="text"
                                        value={overrideReason}
                                        onChange={(e) => setOverrideReason(e.target.value)}
                                        placeholder="e.g. Paid offline add-on / beta trial"
                                        className="w-full px-3 py-1.5 bg-white border border-[#E4E7EC] rounded-xl font-medium focus:outline-none focus:border-indigo-600"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-1">
                                <button
                                    onClick={() => handleSetFeatureOverride()}
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {actionLoading ? <RefreshCw className="animate-spin" size={13} /> : <Check size={13} />}
                                    <span>Apply Override to Restaurant</span>
                                </button>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between border-t border-[#E4E7EC] pt-4">
                            <span className="text-xs text-neutral-400">
                                Overrides are stored in <code className="text-[#172033] font-mono">restaurant_feature_overrides</code> and audited permanently.
                            </span>
                            <button
                                onClick={() => setOverrideSub(null)}
                                className="px-5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ==================================================== */}
            {/* REGISTRATION ACTION MODALS (Approve, Quota, Plan, etc) */}
            {/* ==================================================== */}

            {/* 1. APPROVE MODAL */}
            {actionModalType === 'approve' && selectedReqForAction && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                    <CheckCircle size={18} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-[#172033] text-base">Approve Registration</h3>
                                    <p className="text-xs text-[#667085]">Verify payment and activate restaurant & admin credentials</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="bg-[#F8F9FC] border border-[#E4E7EC] rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Restaurant Name:</span>
                                <span className="font-bold text-[#172033]">{selectedReqForAction.restaurantName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">12-Digit Restaurant ID:</span>
                                <span className="font-mono font-bold text-indigo-600">{selectedReqForAction.restaurantId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Owner:</span>
                                <span className="font-medium text-[#172033]">{selectedReqForAction.ownerName || 'Owner'} ({selectedReqForAction.ownerEmail || 'N/A'})</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Payment Method & Ref:</span>
                                <span className="font-medium text-[#172033]">{selectedReqForAction.paymentMethod} · <span className="font-mono">{selectedReqForAction.paymentReference || 'No Ref'}</span></span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Payment Status:</span>
                                <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${selectedReqForAction.paymentStatus === 'RECEIVED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {selectedReqForAction.paymentStatus || 'PENDING'}
                                </span>
                            </div>
                        </div>

                        {/* Plan & Quota Selection */}
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-[#172033] block mb-1.5">Confirmed Subscription Plan</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { slug: 'standard', name: 'Standard', price: 999, limit: 1 },
                                        { slug: 'growth', name: 'Growth', price: 1499, limit: 1 },
                                        { slug: 'pro', name: 'Pro', price: 2999, limit: 2 }
                                    ].map((p) => (
                                        <button
                                            key={p.slug}
                                            type="button"
                                            onClick={() => {
                                                setReqActionPlan(p.slug);
                                                if (reqActionQuota === 1 || reqActionQuota === 2) {
                                                    setReqActionQuota(p.limit);
                                                }
                                            }}
                                            className={`p-2.5 rounded-xl border text-left transition-all ${
                                                reqActionPlan === p.slug
                                                    ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500/20'
                                                    : 'border-[#E4E7EC] hover:border-neutral-300 bg-white'
                                            }`}
                                        >
                                            <p className="text-xs font-bold text-[#172033]">{p.name}</p>
                                            <p className="text-[11px] text-[#667085]">₹{p.price.toLocaleString('en-IN')}/mo</p>
                                            <p className="text-[10px] font-semibold text-indigo-600 mt-1">Default: {p.limit} {p.limit === 1 ? 'branch' : 'branches'}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Quota override info */}
                            <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <label className="text-xs font-bold text-amber-950 block">Restaurant Quota / Branch Limit</label>
                                        <p className="text-[11px] text-amber-800">Plan default: {reqActionPlan === 'pro' ? 2 : 1} location(s). Override manually if needed:</p>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            type="number"
                                            min="1"
                                            max="50"
                                            placeholder="1"
                                            value={reqActionQuota}
                                            onChange={(e) => setReqActionQuota(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                                            className="w-16 px-2 py-1 bg-white border border-amber-300 rounded-lg text-center font-bold text-xs text-[#172033]"
                                        />
                                        <span className="text-xs font-bold text-neutral-600">branches</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-amber-700 italic">
                                    {reqActionQuota !== (reqActionPlan === 'pro' ? 2 : 1)
                                        ? `⚠️ Super Admin Manual Override active (Effective Limit: ${reqActionQuota})`
                                        : `✓ Using Plan Default Limit (${reqActionQuota})`}
                                </p>
                            </div>
                        </div>

                        {/* Audit info warning */}
                        <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5">
                            <Shield className="text-emerald-700 shrink-0 mt-0.5" size={16} />
                            <p className="text-[11px] text-emerald-900 leading-relaxed">
                                Approving this request will immediately mark the restaurant as <span className="font-bold">ACTIVE</span>, activate the Restaurant Admin account credentials for <span className="font-mono font-bold">{selectedReqForAction.restaurantId}</span>, and generate a paid invoice record. This action is permanently audited.
                            </p>
                        </div>

                        {/* Modal Actions */}
                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleRegistrationAction('approve_registration', selectedReqForAction.id, {
                                    planSlug: reqActionPlan,
                                    customQuota: reqActionQuota !== (reqActionPlan === 'pro' ? 2 : 1) ? reqActionQuota : null,
                                    amountDue: selectedReqForAction.amountDue
                                })}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {actionLoading ? <RefreshCw className="animate-spin" size={13} /> : <Check size={13} />}
                                <span>Confirm Approval & Activate</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. SET / ADJUST RESTAURANT LIMIT MODAL */}
            {actionModalType === 'set_quota' && selectedReqForAction && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                                    <Sliders size={16} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-[#172033] text-sm">Adjust Restaurant Limit</h3>
                                    <p className="text-[11px] text-[#667085]">Super Admin Manual Quota Override</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="bg-[#F8F9FC] border border-[#E4E7EC] rounded-xl p-3 space-y-1.5 text-xs">
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Restaurant:</span>
                                <span className="font-bold text-[#172033]">{selectedReqForAction.restaurantName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Current Plan:</span>
                                <span className="font-bold text-indigo-600 uppercase">{selectedReqForAction.planSlug || 'Standard'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Plan Default Limit:</span>
                                <span className="font-bold text-[#172033]">{selectedReqForAction.planLimit || 1} restaurant(s)</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-[#172033] block">
                                Super Admin Override Limit:
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    min="1"
                                    max="100"
                                    placeholder="1"
                                    value={reqActionQuota}
                                    onChange={(e) => setReqActionQuota(e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                                    className="w-24 px-3 py-2 bg-white border border-[#E4E7EC] rounded-xl font-bold text-sm text-[#172033] focus:outline-none focus:border-indigo-600"
                                />
                                <span className="text-xs text-[#667085]">authorized restaurant branches</span>
                            </div>
                            <p className="text-[11px] text-[#667085]">
                                {reqActionQuota === selectedReqForAction.planLimit
                                    ? `Matches the ${selectedReqForAction.planName} plan default.`
                                    : `Overriding plan limit (${selectedReqForAction.planLimit}) to ${reqActionQuota}. Both default and override values will be recorded.`}
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                            <button
                                type="button"
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleRegistrationAction('set_registration_quota', selectedReqForAction.id, {
                                    customQuota: reqActionQuota,
                                    restaurant_id: selectedReqForAction.restaurantId,
                                    ownerId: selectedReqForAction.ownerId
                                })}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {actionLoading ? <RefreshCw className="animate-spin" size={13} /> : <Check size={13} />}
                                <span>Save Quota Override</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. CHANGE / CONFIRM PLAN MODAL */}
            {actionModalType === 'change_plan' && selectedReqForAction && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                                    <Edit3 size={16} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-[#172033] text-sm">Change Subscription Plan</h3>
                                    <p className="text-[11px] text-[#667085]">{selectedReqForAction.restaurantName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-2.5">
                            {[
                                { slug: 'standard', name: 'Standard', price: '₹999/mo', limit: '1 Restaurant', desc: 'Core POS, QR Dining & Staff' },
                                { slug: 'growth', name: 'Growth', price: '₹1,499/mo', limit: '1 Restaurant', desc: 'Adds Delivery & Inventory Management' },
                                { slug: 'pro', name: 'Pro', price: '₹2,999/mo', limit: '2 Restaurants', desc: 'Multi-branch (2 units), Analytics, Unlimited Staff' },
                                { slug: 'enterprise', name: 'Enterprise', price: '₹9,999/mo', limit: '10 Restaurants', desc: 'Full custom SLA, dedicated hosting & all modules' }
                            ].map((p) => (
                                <button
                                    key={p.slug}
                                    type="button"
                                    onClick={() => setReqActionPlan(p.slug)}
                                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                                        reqActionPlan === p.slug
                                            ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                                            : 'border-[#E4E7EC] hover:border-neutral-300 bg-white'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-extrabold text-[#172033]">{p.name}</span>
                                            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">{p.limit}</span>
                                        </div>
                                        <p className="text-[11px] text-[#667085] mt-0.5">{p.desc}</p>
                                    </div>
                                    <span className="text-xs font-black text-[#172033]">{p.price}</span>
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                            <button
                                type="button"
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleRegistrationAction('change_registration_plan', selectedReqForAction.id, { planSlug: reqActionPlan })}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {actionLoading ? <RefreshCw className="animate-spin" size={13} /> : <Check size={13} />}
                                <span>Confirm Plan Change</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. REQUEST PAYMENT / DETAILS MODAL */}
            {actionModalType === 'request_payment' && selectedReqForAction && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                                    <CreditCard size={16} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-[#172033] text-sm">Request Payment / Details</h3>
                                    <p className="text-[11px] text-[#667085]">{selectedReqForAction.restaurantName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                            <p className="font-bold">Subscription Amount Due: ₹{selectedReqForAction.amountDue || 999}</p>
                            <p className="text-[11px]">Owner: {selectedReqForAction.ownerName} ({selectedReqForAction.ownerEmail})</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-[#172033] block">
                                Notes / Payment Instructions to Owner:
                            </label>
                            <textarea
                                rows={3}
                                value={reqActionNotes}
                                onChange={(e) => setReqActionNotes(e.target.value)}
                                placeholder="e.g. Please share the 12-digit UTR number for your UPI transfer of ₹999 to pay@restaurantos."
                                className="w-full p-2.5 bg-white border border-[#E4E7EC] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-amber-500"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                            <button
                                type="button"
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleRegistrationAction('request_payment', selectedReqForAction.id, { notes: reqActionNotes })}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {actionLoading ? <RefreshCw className="animate-spin" size={13} /> : <Check size={13} />}
                                <span>Send Payment Request</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. REJECT REGISTRATION MODAL */}
            {actionModalType === 'reject' && selectedReqForAction && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
                                    <Ban size={16} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-[#172033] text-sm">Reject Registration Request</h3>
                                    <p className="text-[11px] text-[#667085]">{selectedReqForAction.restaurantName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
                            <p className="font-bold">Are you sure you want to reject this request?</p>
                            <p className="text-[11px] mt-0.5">The restaurant will remain inactive and the owner will be notified.</p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-[#172033] block">
                                Rejection Reason:
                            </label>
                            <textarea
                                rows={3}
                                value={reqActionReason}
                                onChange={(e) => setReqActionReason(e.target.value)}
                                placeholder="e.g. Invalid payment reference, duplicate branch registration, or incomplete details."
                                className="w-full p-2.5 bg-white border border-[#E4E7EC] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-rose-500"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                            <button
                                type="button"
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleRegistrationAction('reject_registration', selectedReqForAction.id, { reason: reqActionReason })}
                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {actionLoading ? <RefreshCw className="animate-spin" size={13} /> : <Ban size={13} />}
                                <span>Reject Request</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. CONFIRM MARK PAYMENT RECEIVED MODAL */}
            {actionModalType === 'mark_payment' && selectedReqForAction && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                    <IndianRupee size={16} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-[#172033] text-sm">Confirm Payment Received</h3>
                                    <p className="text-[11px] text-[#667085]">{selectedReqForAction.restaurantName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 space-y-1">
                            <p className="font-bold flex items-center gap-1.5">
                                <CheckCircle size={14} className="text-emerald-600" />
                                Mark Registration Fee as Received?
                            </p>
                            <p className="text-[11px] text-emerald-700">
                                This will mark the registration payment as verified. You can undo this at any time using the "Undo Pay" option.
                            </p>
                        </div>

                        <div className="bg-[#F8F9FC] border border-[#E4E7EC] rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Restaurant Name:</span>
                                <span className="font-bold text-[#172033]">{selectedReqForAction.restaurantName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">12-Digit Restaurant ID:</span>
                                <span className="font-mono font-bold text-indigo-600">{selectedReqForAction.restaurantId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Amount Due:</span>
                                <span className="font-mono font-bold text-emerald-700">₹{selectedReqForAction.amountDue?.toLocaleString('en-IN') || 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Payment Reference / UTR:</span>
                                <span className="font-mono text-[#172033] font-medium">{selectedReqForAction.paymentReference || 'None provided'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Owner Contact:</span>
                                <span className="text-[#172033]">{selectedReqForAction.ownerName} ({selectedReqForAction.ownerEmail || 'N/A'})</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                            <button
                                type="button"
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleRegistrationAction('mark_payment_received', selectedReqForAction.id)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {actionLoading ? <RefreshCw className="animate-spin" size={13} /> : <Check size={13} />}
                                <span>Confirm Payment Received</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 7. UNDO PAYMENT RECEIVED MODAL */}
            {actionModalType === 'undo_payment' && selectedReqForAction && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                                    <RotateCcw size={16} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-[#172033] text-sm">Undo Payment Received</h3>
                                    <p className="text-[11px] text-[#667085]">{selectedReqForAction.restaurantName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1">
                            <p className="font-bold flex items-center gap-1.5">
                                <AlertTriangle size={14} className="text-amber-600" />
                                Revert Payment Status to PENDING?
                            </p>
                            <p className="text-[11px] text-amber-800 leading-relaxed">
                                Use this option if this restaurant was marked as paid by mistake. The payment status will immediately revert to <strong>PENDING</strong> and the verification record will be reset.
                            </p>
                        </div>

                        <div className="bg-[#F8F9FC] border border-[#E4E7EC] rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Restaurant Name:</span>
                                <span className="font-bold text-[#172033]">{selectedReqForAction.restaurantName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">12-Digit Restaurant ID:</span>
                                <span className="font-mono font-bold text-indigo-600">{selectedReqForAction.restaurantId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Current Status:</span>
                                <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                                    VERIFIED (RECEIVED)
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Amount Due:</span>
                                <span className="font-mono font-bold text-[#172033]">₹{selectedReqForAction.amountDue?.toLocaleString('en-IN') || 0}</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                            <button
                                type="button"
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleRegistrationAction('undo_payment_received', selectedReqForAction.id)}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {actionLoading ? <RefreshCw className="animate-spin" size={13} /> : <RotateCcw size={13} />}
                                <span>Revert to Pending Payment</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 8. SUSPEND REGISTRATION MODAL */}
            {actionModalType === 'suspend' && selectedReqForAction && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                                    <Ban size={16} />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-[#172033] text-sm">Suspend Restaurant</h3>
                                    <p className="text-[11px] text-[#667085]">{selectedReqForAction.restaurantName}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="p-1 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-800 space-y-1">
                            <p className="font-bold flex items-center gap-1.5">
                                <AlertTriangle size={14} className="text-purple-600" />
                                Suspend this restaurant registration?
                            </p>
                            <p className="text-[11px] text-purple-700">
                                This will deactivate the restaurant and its branches, temporarily restricting owner and staff operations until reactivated.
                            </p>
                        </div>

                        <div className="bg-[#F8F9FC] border border-[#E4E7EC] rounded-xl p-3.5 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-[#667085]">Restaurant Name:</span>
                                <span className="font-bold text-[#172033]">{selectedReqForAction.restaurantName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-[#667085]">12-Digit Restaurant ID:</span>
                                <span className="font-mono font-bold text-indigo-600">{selectedReqForAction.restaurantId}</span>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-[#172033] block">
                                Reason for Suspension (Optional):
                            </label>
                            <textarea
                                rows={3}
                                value={reqActionReason}
                                onChange={(e) => setReqActionReason(e.target.value)}
                                placeholder="e.g. Non-payment, violation of terms, or administrative review."
                                className="w-full p-2.5 bg-white border border-[#E4E7EC] rounded-xl text-xs text-[#172033] focus:outline-none focus:border-purple-500"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E4E7EC]">
                            <button
                                type="button"
                                onClick={() => { setActionModalType(null); setSelectedReqForAction(null); }}
                                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={actionLoading}
                                onClick={() => handleRegistrationAction('suspend_registration', selectedReqForAction.id, { reason: reqActionReason })}
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                            >
                                {actionLoading ? <RefreshCw className="animate-spin" size={13} /> : <Ban size={13} />}
                                <span>Suspend Restaurant</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

export default function SubscriptionsPage() {
    return (
        <Suspense
            fallback={
                <div className="py-24 text-center">
                    <div className="inline-block h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-3" />
                    <p className="text-xs font-bold text-[#667085]">Loading subscription control center...</p>
                </div>
            }
        >
            <SubscriptionsContent />
        </Suspense>
    );
}
