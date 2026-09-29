'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowRight,
    ArrowLeft,
    Building2,
    CheckCircle2,
    ClipboardList,
    Clock3,
    CreditCard,
    Mail,
    Phone,
    Search,
    ChefHat,
    LayoutGrid,
    ShieldCheck,
    Check,
    Info,
    AlertTriangle,
    Ban,
    CalendarDays,
    ExternalLink,
    Eye,
    FileText,
    History,
    MapPin,
    Pencil,
    Plus,
    RotateCcw,
    Sparkles,
    Trash2,
    Upload,
    Users,
    XCircle,
    X,
    LogOut,
    RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatAddress } from '@/lib/utils';

// ==========================================
// Types & Constants
// ==========================================

const STATUSES = [
    'PENDING',
    'CONTACTED',
    'ONBOARDING',
    'VERIFICATION',
    'PLAN_ASSIGNED',
    'APPROVED',
    'ACTIVE',
    'REJECTED',
    'SUSPENDED',
] as const;

export type Status = (typeof STATUSES)[number];

const STATUS_LABEL: Record<Status, string> = {
    PENDING: 'Pending',
    CONTACTED: 'Contacted',
    ONBOARDING: 'Onboarding',
    VERIFICATION: 'Verification',
    PLAN_ASSIGNED: 'Plan assigned',
    APPROVED: 'Approved',
    ACTIVE: 'Active',
    REJECTED: 'Rejected',
    SUSPENDED: 'Suspended',
};

const PIPELINE_ORDER: Status[] = [
    'PENDING',
    'CONTACTED',
    'ONBOARDING',
    'VERIFICATION',
    'PLAN_ASSIGNED',
    'APPROVED',
    'ACTIVE',
];

const PLANS = [
    {
        id: 'basic',
        name: 'Basic',
        price: '₹1,499/mo',
        tagline: 'Single outlet essentials',
        features: [
            '1 branch',
            'Up to 20 tables',
            'Digital menu & QR ordering',
            'Kitchen display (1 screen)',
            'Email support',
        ],
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '₹3,999/mo',
        tagline: 'Growing multi-outlet teams',
        features: [
            'Up to 5 branches',
            'Unlimited tables',
            'Waiter app & table transfers',
            'Kitchen display (3 screens)',
            'Sales analytics',
            'Priority support',
        ],
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: '₹8,999/mo',
        tagline: 'High volume & franchises',
        features: [
            'Unlimited branches',
            'Unlimited tables & KDS',
            'Franchise & custom roles',
            'Custom inventory & recipe costing',
            'Dedicated account manager & SLA',
            'Custom integrations & API access',
        ],
    },
];

export const validators = {
    gstin: (val: string) =>
        !val || /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(val.trim()),
    fssai: (val: string) => !val || /^[0-9]{14}$/.test(val.trim()),
    pan: (val: string) => !val || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val.trim()),
    phone: (val: string) =>
        !val || /^(?:\+91|91)?[6-9]\d{9}$/.test(val.replace(/[\s-]/g, '')),
    email: (val: string) =>
        !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()),
};

export type DocKind =
    | 'GSTIN Certificate'
    | 'FSSAI License'
    | 'PAN Card'
    | 'Shop & Establishment'
    | 'Trade License'
    | 'Cancelled Cheque';

export interface RestaurantDocument {
    id: string;
    kind: DocKind;
    fileName: string;
    sizeKb: number;
    uploadedAt: string;
    status: 'PENDING' | 'VERIFIED' | 'REJECTED';
    previewUrl: string;
}

export interface Branch {
    id: string;
    name: string;
    phone: string;
    address: string;
    active: boolean;
}

export interface AuditEvent {
    id: string;
    at: string;
    actor: string;
    type: 'STATUS' | 'PLAN' | 'ACTIVATION' | 'SUSPENSION' | 'REJECTION' | 'COMPLIANCE' | 'DOCUMENT' | 'OUTREACH' | 'BRANCH';
    title: string;
    detail?: string;
    reason?: string;
}

export interface RestaurantRecord {
    id: string;
    slug?: string;
    name: string;
    city?: string;
    address?: string;
    status: Status;
    submittedAt: string;
    createdAt?: string;
    owner: {
        name: string;
        phone: string;
        email: string;
        employeeApproved: boolean;
    };
    legal: {
        entityName: string;
        constitution: string;
        gstin: string;
        fssai: string;
        pan: string;
        shopLicence: string;
    };
    operations: {
        openingDate: string;
        workingDays: string[];
        opensAt: string;
        closesAt: string;
        seatingCapacity: number;
        serviceModes: string[];
        headquarters: string;
    };
    branches: Branch[];
    documents: RestaurantDocument[];
    plan: string | null;
    audit: AuditEvent[];
}

const fmt = (iso: string) => {
    try {
        return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
        return iso || '—';
    }
};

// Safe JSON parser to prevent Unexpected end of JSON input
async function safeJson(res: Response): Promise<{ ok: boolean; data: any }> {
    try {
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        return { ok: res.ok, data };
    } catch {
        return { ok: false, data: { error: `Server returned HTTP ${res.status}: ${res.statusText || 'Unknown error'}` } };
    }
}

// Target URL for restaurant customer & admin applications
const RESTAURANT_APP_URL = process.env.NEXT_PUBLIC_RESTAURANT_APP_URL || 'http://localhost:3000';

// ==========================================
// UI Helpers
// ==========================================

function StatusBadge({ status, size = 'sm' }: { status: Status; size?: 'sm' | 'md' }) {
    const STYLES: Record<Status, string> = {
        PENDING: 'bg-amber-50 text-amber-800 border-amber-200/80',
        CONTACTED: 'bg-sky-50 text-sky-700 border-sky-200/80',
        ONBOARDING: 'bg-blue-50 text-blue-700 border-blue-200/80',
        VERIFICATION: 'bg-purple-50 text-purple-700 border-purple-200/80',
        PLAN_ASSIGNED: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
        APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        ACTIVE: 'bg-emerald-600 text-white border-emerald-600',
        REJECTED: 'bg-rose-50 text-rose-700 border-rose-200/80',
        SUSPENDED: 'bg-rose-600 text-white border-rose-600',
    };

    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-tight whitespace-nowrap ${
                size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
            } ${STYLES[status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}
        >
            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
            {STATUS_LABEL[status] || status}
        </span>
    );
}

function PipelineStepper({ status }: { status: Status }) {
    const currentIndex = PIPELINE_ORDER.indexOf(status);
    const isSpecial = status === 'REJECTED' || status === 'SUSPENDED';

    return (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
            <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Onboarding pipeline
                </span>
                {isSpecial ? (
                    <span className="text-xs font-semibold text-rose-600">
                        Pipeline halted: {STATUS_LABEL[status]}
                    </span>
                ) : (
                    <span className="text-xs font-semibold text-slate-600">
                        Step {currentIndex + 1} of {PIPELINE_ORDER.length}
                    </span>
                )}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {PIPELINE_ORDER.map((s, idx) => {
                    const done = currentIndex > idx;
                    const current = currentIndex === idx && !isSpecial;
                    return (
                        <div key={s} className="flex flex-col items-center text-center">
                            <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                                    done
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : current
                                        ? 'bg-sky-600 text-white ring-4 ring-sky-100 shadow-sm'
                                        : 'bg-slate-100 text-slate-400'
                                }`}
                            >
                                {done ? <Check className="h-4 w-4" /> : idx + 1}
                            </div>
                            <span
                                className={`mt-1.5 hidden truncate text-[11px] font-medium sm:block ${
                                    current
                                        ? 'font-bold text-sky-700'
                                        : done
                                        ? 'text-slate-800 font-semibold'
                                        : 'text-slate-400'
                                }`}
                            >
                                {STATUS_LABEL[s]}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function MetricCard({
    label,
    value,
    icon,
    tone = 'default',
}: {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    tone?: 'default' | 'warning' | 'violet' | 'success';
}) {
    const tones = {
        default: 'bg-sky-50 text-sky-600',
        warning: 'bg-amber-50 text-amber-600',
        violet: 'bg-purple-50 text-purple-600',
        success: 'bg-emerald-50 text-emerald-600',
    };

    return (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] transition-all hover:shadow-md">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
                    {icon}
                </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        </div>
    );
}

function SectionCard({
    title,
    description,
    action,
    children,
}: {
    title: string;
    description?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-4 mb-4">
                <div>
                    <h2 className="text-base font-bold text-slate-900">{title}</h2>
                    {description ? <p className="text-xs text-slate-500 mt-0.5">{description}</p> : null}
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    const displayValue = typeof value === 'object' && value !== null && !React.isValidElement(value)
        ? formatAddress(value)
        : (value || '—');
    return (
        <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500">{label}</p>
            <div className="text-sm font-semibold text-slate-800">{displayValue}</div>
        </div>
    );
}

// ==========================================
// Main Component
// ==========================================

type Tab = 'ALL' | Status;
const TABS: Tab[] = ['ALL', ...STATUSES];

export default function SuperAdminDashboard() {
    const [restaurants, setRestaurants] = useState<RestaurantRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('ALL');
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Detail view state
    const [detailTab, setDetailTab] = useState<'owner' | 'kyc' | 'ops' | 'plan' | 'audit'>('owner');
    const [rejectOpen, setRejectOpen] = useState(false);
    const [suspendOpen, setSuspendOpen] = useState(false);
    const [reasonText, setReasonText] = useState('');

    // Modal for editing/adding branch
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [branchModalOpen, setBranchModalOpen] = useState(false);

    // Add restaurant modal state
    const [addModalOpen, setAddModalOpen] = useState(false);
    const [submittingAdd, setSubmittingAdd] = useState(false);
    const [addForm, setAddForm] = useState({
        name: '',
        ownerName: '',
        phone: '',
        email: '',
        address: '',
        businessType: 'Restaurant',
        businessConstitution: 'Proprietorship',
        gstNumber: '',
        fssaiNumber: '',
        panNumber: '',
        shopLicense: '',
        subscriptionPlan: 'Basic',
        status: 'PENDING' as Status,
    });

    // Document upload state
    const [docKind, setDocKind] = useState<DocKind>('GSTIN Certificate');
    const [uploadingDoc, setUploadingDoc] = useState(false);

    // Fetch restaurants from backend API
    const loadRestaurants = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/restaurants');
            const { ok, data } = await safeJson(res);
            if (!ok) {
                toast.error(data.error || 'Failed to load restaurants from server');
                return;
            }
            if (data.success && data.restaurants) {
                const parsed: RestaurantRecord[] = data.restaurants.map((r: any) => {
                    const city = r.address ? r.address.split(',')[0].trim() : 'Unknown';
                    const storedLegal = {
                        entityName: r.businessConstitution ? `${r.name}` : r.name,
                        constitution: r.businessConstitution || 'Proprietorship / Private Limited',
                        gstin: r.gstNumber || '',
                        fssai: r.fssaiNumber || '',
                        pan: r.panNumber || '',
                        shopLicence: r.shopLicense || '',
                    };

                    const storedOps = {
                        openingDate: r.openingDate || r.createdAt || new Date().toISOString(),
                        workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                        opensAt: '10:00 AM',
                        closesAt: '11:00 PM',
                        seatingCapacity: 48,
                        serviceModes: ['Dine-in', 'Takeaway', 'Bar'],
                        headquarters: r.address || 'Main Branch',
                    };

                    const defaultAudit: AuditEvent[] = [
                        {
                            id: `aud-${r.id}-sub`,
                            at: r.createdAt || new Date().toISOString(),
                            actor: r.ownerName || 'Applicant',
                            type: 'STATUS',
                            title: 'New restaurant request submitted',
                            detail: `Submitted with name "${r.name}" (${r.businessType || 'Restaurant'}).`,
                        },
                    ];

                    if (r.status === 'ACTIVE') {
                        defaultAudit.unshift({
                            id: `aud-${r.id}-act`,
                            at: r.createdAt || new Date().toISOString(),
                            actor: 'Super Admin',
                            type: 'ACTIVATION',
                            title: 'Platform activated',
                            detail: 'Admin, Waiter, and Kitchen displays operational.',
                        });
                    }

                    return {
                        id: r.id,
                        slug: r.slug || r.id,
                        name: r.name,
                        city: city,
                        address: r.address,
                        status: (r.status || 'PENDING').toUpperCase() as Status,
                        submittedAt: r.createdAt || new Date().toISOString(),
                        createdAt: r.createdAt,
                        owner: {
                            name: r.ownerName || 'Owner',
                            phone: r.phone || '—',
                            email: r.email || '—',
                            employeeApproved: r.status === 'ACTIVE',
                        },
                        legal: storedLegal,
                        operations: storedOps,
                        branches: [],
                        documents: [],
                        plan: r.subscriptionPlan ? r.subscriptionPlan.toLowerCase() : null,
                        audit: defaultAudit,
                    };
                });
                setRestaurants(parsed);
            }
        } catch (err: any) {
            console.error('Failed to load restaurants:', err);
            toast.error('Failed to load restaurants from server');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRestaurants();
    }, []);

    // Filter counts
    const counts = useMemo(() => {
        const map = { ALL: restaurants.length } as Record<Tab, number>;
        for (const s of STATUSES) map[s] = restaurants.filter((r) => r.status === s).length;
        return map;
    }, [restaurants]);

    // Filtered list
    const results = useMemo(() => {
        const q = query.trim().toLowerCase();
        return restaurants
            .filter((r) => (tab === 'ALL' ? true : r.status === tab))
            .filter((r) =>
                !q
                    ? true
                    : [r.name, r.owner.name, r.owner.phone, r.owner.email, r.id, r.city]
                          .join(' ')
                          .toLowerCase()
                          .includes(q),
            )
            .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    }, [restaurants, tab, query]);

    // Active restaurant for detail view
    const selectedRestaurant = useMemo(() => {
        return restaurants.find((r) => r.id === selectedId) || null;
    }, [restaurants, selectedId]);

    // Status updater API
    const updateStatus = async (id: string, newStatus: Status, reason?: string) => {
        try {
            const res = await fetch(`/api/restaurants/${id}/status`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, reason }),
            });
            const { ok, data } = await safeJson(res);
            if (ok && data.success) {
                toast.success(`Status updated to ${STATUS_LABEL[newStatus]}`);
                setRestaurants((prev) =>
                    prev.map((r) => {
                        if (r.id !== id) return r;
                        const newAuditItem: AuditEvent = {
                            id: `aud-${Date.now()}`,
                            at: new Date().toISOString(),
                            actor: 'Super Admin',
                            type: newStatus === 'ACTIVE' ? 'ACTIVATION' : newStatus === 'REJECTED' ? 'REJECTION' : newStatus === 'SUSPENDED' ? 'SUSPENSION' : 'STATUS',
                            title: `Status transitioned to ${STATUS_LABEL[newStatus]}`,
                            reason,
                        };
                        return {
                            ...r,
                            status: newStatus,
                            audit: [newAuditItem, ...r.audit],
                        };
                    }),
                );
            } else {
                toast.error(data.error || 'Failed to update status');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error updating status');
        }
    };

    // Plan assigner API
    const assignPlan = async (id: string, planId: string) => {
        try {
            const res = await fetch(`/api/restaurants/${id}/plan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: planId.toUpperCase() }),
            });
            const { ok, data } = await safeJson(res);
            if (ok && data.success) {
                toast.success(`Plan assigned: ${planId.toUpperCase()}`);
                setRestaurants((prev) =>
                    prev.map((r) => {
                        if (r.id !== id) return r;
                        const newAuditItem: AuditEvent = {
                            id: `aud-${Date.now()}`,
                            at: new Date().toISOString(),
                            actor: 'Super Admin',
                            type: 'PLAN',
                            title: `Assigned ${planId.toUpperCase()} Subscription Plan`,
                        };
                        return {
                            ...r,
                            plan: planId,
                            status: r.status === 'PENDING' || r.status === 'CONTACTED' || r.status === 'ONBOARDING' || r.status === 'VERIFICATION' ? 'PLAN_ASSIGNED' : r.status,
                            audit: [newAuditItem, ...r.audit],
                        };
                    }),
                );
            } else {
                toast.error(data.error || 'Failed to assign plan');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error assigning plan');
        }
    };

    // Legal save API
    const saveLegalDetails = async (id: string, legalData: any) => {
        try {
            const res = await fetch(`/api/restaurants/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    legalBusinessName: legalData.entityName,
                    entityName: legalData.entityName,
                    businessConstitution: legalData.constitution,
                    gstNumber: legalData.gstin,
                    fssaiNumber: legalData.fssai,
                    panNumber: legalData.pan,
                    shopLicense: legalData.shopLicence,
                }),
            });
            const { ok, data } = await safeJson(res);
            if (ok && data.success) {
                toast.success('Legal and KYC details saved');
                setRestaurants((prev) =>
                    prev.map((r) => (r.id === id ? { ...r, legal: legalData } : r)),
                );
            } else {
                toast.error(data.error || 'Failed to save details');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error saving legal details');
        }
    };

    // Document file upload handler
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingDoc(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', `compliance/${id}`);

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            });
            const { ok, data } = await safeJson(res);

            if (ok && data.url) {
                const newDoc: RestaurantDocument = {
                    id: `doc-${Date.now()}`,
                    kind: docKind,
                    fileName: file.name,
                    sizeKb: Math.round(file.size / 1024),
                    uploadedAt: new Date().toISOString(),
                    status: 'PENDING',
                    previewUrl: data.url,
                };
                setRestaurants((prev) =>
                    prev.map((r) => {
                        if (r.id !== id) return r;
                        return {
                            ...r,
                            documents: [newDoc, ...r.documents],
                        };
                    }),
                );
                toast.success(`${docKind} uploaded successfully`);
            } else {
                toast.error(data.error || 'Upload failed');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error uploading file');
        } finally {
            setUploadingDoc(false);
            e.target.value = '';
        }
    };

    // Create new restaurant handler
    const handleCreateRestaurant = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!addForm.name.trim()) {
            toast.error('Restaurant name is required');
            return;
        }
        setSubmittingAdd(true);
        try {
            const res = await fetch('/api/restaurants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(addForm),
            });
            const { ok, data } = await safeJson(res);
            if (ok && data.success) {
                toast.success(`Restaurant "${addForm.name}" created successfully!`);
                setAddModalOpen(false);
                setAddForm({
                    name: '',
                    ownerName: '',
                    phone: '',
                    email: '',
                    address: '',
                    businessType: 'Restaurant',
                    businessConstitution: 'Proprietorship',
                    gstNumber: '',
                    fssaiNumber: '',
                    panNumber: '',
                    shopLicense: '',
                    subscriptionPlan: 'Basic',
                    status: 'PENDING',
                });
                await loadRestaurants();
            } else {
                toast.error(data.error || 'Failed to create restaurant');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error creating restaurant');
        } finally {
            setSubmittingAdd(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-800 antialiased font-sans">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
                <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
                    <button
                        onClick={() => setSelectedId(null)}
                        className="flex items-center gap-3 transition-opacity hover:opacity-80 text-left cursor-pointer"
                    >
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
                            <ChefHat className="h-5 w-5" />
                        </span>
                        <span className="leading-tight">
                            <span className="block text-sm font-bold tracking-tight text-slate-900">Dine In One</span>
                            <span className="block text-xs text-slate-500 font-medium">Super Admin Portal</span>
                        </span>
                    </button>

                    <nav className="hidden items-center gap-1 md:flex">
                        <button
                            onClick={() => setSelectedId(null)}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold bg-sky-50 text-sky-700 transition-colors"
                        >
                            <LayoutGrid className="h-4 w-4" /> Request inbox
                        </button>
                    </nav>

                    <div className="flex items-center gap-3">
                        <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 sm:flex border border-emerald-200/60">
                            <ShieldCheck className="h-3.5 w-3.5" /> Super Admin
                        </span>
                        <button
                            onClick={() => setAddModalOpen(true)}
                            className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-sky-700 transition-colors cursor-pointer"
                        >
                            <Plus className="h-3.5 w-3.5" /> Add restaurant
                        </button>
                        <button
                            onClick={loadRestaurants}
                            disabled={loading}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={async () => {
                                await fetch('/api/auth/logout', { method: 'POST' });
                                window.location.href = '/login';
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Sign Out"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                            S
                        </span>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
                {/* VIEW 1: REQUEST INBOX */}
                {!selectedRestaurant ? (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Request inbox</h1>
                                <p className="mt-1 text-sm text-slate-500 font-medium">
                                    Request → Contact → Onboarding → Verification → Plan → Approval → Activation
                                </p>
                            </div>
                            <button
                                onClick={() => setAddModalOpen(true)}
                                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-700 transition-colors cursor-pointer self-start sm:self-auto"
                            >
                                <Plus className="h-4 w-4" /> Add new restaurant
                            </button>
                        </div>

                        {/* KPI Ribbon */}
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                            <MetricCard label="Total requests" value={counts.ALL} icon={<ClipboardList className="h-5 w-5" />} />
                            <MetricCard
                                label="Pending review"
                                value={counts.PENDING}
                                tone="warning"
                                icon={<Clock3 className="h-5 w-5" />}
                            />
                            <MetricCard
                                label="Onboarding"
                                value={counts.ONBOARDING + counts.CONTACTED + counts.VERIFICATION}
                                tone="violet"
                                icon={<Building2 className="h-5 w-5" />}
                            />
                            <MetricCard
                                label="Plan assigned"
                                value={counts.PLAN_ASSIGNED}
                                icon={<CreditCard className="h-5 w-5" />}
                            />
                            <MetricCard
                                label="Active restaurants"
                                value={counts.ACTIVE}
                                tone="success"
                                icon={<CheckCircle2 className="h-5 w-5" />}
                            />
                        </div>

                        {/* Filter and Table Container */}
                        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.02)]">
                            <div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:p-5">
                                <div className="relative">
                                    <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="Search by restaurant, owner, phone, email or restaurant ID"
                                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition-all"
                                    />
                                </div>
                                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                                    {TABS.map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setTab(t)}
                                            className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                                                tab === t
                                                    ? 'border-sky-600 bg-sky-600 text-white shadow-sm'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:border-sky-400 hover:text-sky-600'
                                            }`}
                                        >
                                            {t === 'ALL' ? 'All' : STATUS_LABEL[t]}
                                            <span
                                                className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none font-bold ${
                                                    tab === t ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                                                }`}
                                            >
                                                {counts[t]}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {results.length === 0 ? (
                                <div className="p-12 text-center">
                                    <p className="text-base font-semibold text-slate-800">No requests match this view</p>
                                    <p className="mt-1 text-sm text-slate-500">Try another status tab or clear your search term.</p>
                                </div>
                            ) : (
                                <ul className="divide-y divide-slate-100">
                                    {results.map((r) => (
                                        <li
                                            key={r.id}
                                            className="group flex flex-col gap-3 p-4 transition-colors duration-200 hover:bg-sky-50/40 sm:flex-row sm:items-center sm:justify-between sm:p-5"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2.5">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedId(r.id);
                                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                                        }}
                                                        className="text-base font-bold tracking-tight text-slate-900 hover:text-sky-600 text-left transition-colors cursor-pointer"
                                                    >
                                                        {r.name}
                                                    </button>
                                                    <StatusBadge status={r.status} />
                                                </div>
                                                <p className="mt-1 truncate text-sm text-slate-500 font-medium">
                                                    {r.owner.name} · {r.city} · {r.id}
                                                </p>
                                                <p className="mt-0.5 text-xs text-slate-400">
                                                    Submitted {fmt(r.submittedAt)}
                                                </p>
                                            </div>

                                            <div className="flex shrink-0 items-center gap-2">
                                                <a
                                                    href={`tel:${r.owner.phone}`}
                                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                                                    title={`Call ${r.owner.phone}`}
                                                >
                                                    <Phone className="h-4 w-4" />
                                                </a>
                                                <a
                                                    href={`mailto:${r.owner.email}`}
                                                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                                                    title={`Email ${r.owner.email}`}
                                                >
                                                    <Mail className="h-4 w-4" />
                                                </a>
                                                <button
                                                    onClick={() => {
                                                        setSelectedId(r.id);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-700 transition-colors cursor-pointer"
                                                >
                                                    Review <ArrowRight className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                ) : (
                    /* VIEW 2: RESTAURANT REVIEW DETAIL PAGE */
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <button
                            onClick={() => setSelectedId(null)}
                            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-sky-600 transition-colors cursor-pointer"
                        >
                            <ArrowLeft className="h-4 w-4" /> Back to request inbox
                        </button>

                        {/* Detail Header */}
                        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.02)] space-y-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                                            {selectedRestaurant.name}
                                        </h1>
                                        <StatusBadge status={selectedRestaurant.status} size="md" />
                                    </div>
                                    <p className="mt-1 text-sm text-slate-500 font-medium">
                                        {selectedRestaurant.id} · {selectedRestaurant.city} · Submitted {fmt(selectedRestaurant.submittedAt)}
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <a
                                        href={`tel:${selectedRestaurant.owner.phone}`}
                                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                        <Phone className="h-3.5 w-3.5 text-slate-500" /> Call owner
                                    </a>
                                    <a
                                        href={`mailto:${selectedRestaurant.owner.email}`}
                                        className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                    >
                                        <Mail className="h-3.5 w-3.5 text-slate-500" /> Email owner
                                    </a>
                                    {selectedRestaurant.status === 'ACTIVE' ? (
                                        <>
                                            <a
                                                href={`${RESTAURANT_APP_URL}/${selectedRestaurant.id}/admin/dashboard`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5 text-slate-500" /> Open Admin
                                            </a>
                                            <a
                                                href={`${RESTAURANT_APP_URL}/${selectedRestaurant.id}/customer`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                                            >
                                                <Eye className="h-3.5 w-3.5 text-slate-500" /> Public Menu
                                            </a>
                                        </>
                                    ) : null}
                                </div>
                            </div>

                            {/* Stepper */}
                            <PipelineStepper status={selectedRestaurant.status} />

                            {/* Action Bar */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                                <div className="text-xs text-slate-500">
                                    {selectedRestaurant.status === 'SUSPENDED' ? (
                                        <span className="font-semibold text-rose-600">Restaurant is suspended. Admin & customer access disabled.</span>
                                    ) : selectedRestaurant.status === 'REJECTED' ? (
                                        <span className="font-semibold text-rose-600">Request rejected.</span>
                                    ) : !selectedRestaurant.plan ? (
                                        <span className="text-amber-600 font-semibold">Assign a subscription plan before approving activation.</span>
                                    ) : (
                                        <span>Advance lifecycle or take regulatory actions.</span>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {selectedRestaurant.status === 'PENDING' && (
                                        <button
                                            onClick={() => updateStatus(selectedRestaurant.id, 'CONTACTED')}
                                            className="rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer"
                                        >
                                            Mark contacted
                                        </button>
                                    )}
                                    {selectedRestaurant.status === 'CONTACTED' && (
                                        <button
                                            onClick={() => updateStatus(selectedRestaurant.id, 'ONBOARDING')}
                                            className="rounded-xl bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 transition-colors cursor-pointer"
                                        >
                                            Start onboarding
                                        </button>
                                    )}
                                    {selectedRestaurant.status === 'ONBOARDING' && (
                                        <button
                                            onClick={() => updateStatus(selectedRestaurant.id, 'VERIFICATION')}
                                            className="rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 transition-colors cursor-pointer"
                                        >
                                            Send for verification
                                        </button>
                                    )}
                                    {(selectedRestaurant.status === 'VERIFICATION' || selectedRestaurant.status === 'PLAN_ASSIGNED') && (
                                        <button
                                            onClick={() => updateStatus(selectedRestaurant.id, 'APPROVED')}
                                            className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                                        >
                                            Approve compliance
                                        </button>
                                    )}
                                    {selectedRestaurant.status === 'APPROVED' && (
                                        <button
                                            disabled={!selectedRestaurant.plan}
                                            onClick={() => updateStatus(selectedRestaurant.id, 'ACTIVE')}
                                            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm cursor-pointer"
                                        >
                                            <Sparkles className="h-3.5 w-3.5 inline mr-1" /> Activate restaurant
                                        </button>
                                    )}
                                    {selectedRestaurant.status !== 'REJECTED' && selectedRestaurant.status !== 'ACTIVE' && (
                                        <button
                                            onClick={() => {
                                                setReasonText('');
                                                setRejectOpen(true);
                                            }}
                                            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                                        >
                                            Reject
                                        </button>
                                    )}
                                    {selectedRestaurant.status === 'ACTIVE' && (
                                        <button
                                            onClick={() => {
                                                setReasonText('');
                                                setSuspendOpen(true);
                                            }}
                                            className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                                        >
                                            Suspend
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="flex gap-2 overflow-x-auto rounded-xl bg-slate-200/60 p-1">
                            {[
                                { id: 'owner', label: 'Owner & outreach' },
                                { id: 'kyc', label: 'Legal & KYC' },
                                { id: 'ops', label: 'Operations & branches' },
                                { id: 'plan', label: 'Subscription plan' },
                                { id: 'audit', label: 'Audit trail' },
                            ].map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setDetailTab(t.id as any)}
                                    className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all cursor-pointer ${
                                        detailTab === t.id
                                            ? 'bg-white text-slate-900 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {/* TAB 1: OWNER & OUTREACH */}
                        {detailTab === 'owner' && (
                            <div className="grid gap-5 lg:grid-cols-2 animate-in fade-in duration-200">
                                <SectionCard title="Owner identity" description="Primary applicant contact info">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <Field label="Full name" value={selectedRestaurant.owner.name} />
                                        <Field label="Phone number" value={selectedRestaurant.owner.phone} />
                                        <Field label="Email address" value={selectedRestaurant.owner.email} />
                                        <Field
                                            label="Staff sync status"
                                            value={
                                                selectedRestaurant.owner.employeeApproved ? (
                                                    <span className="text-emerald-600 font-semibold">Active & Approved</span>
                                                ) : (
                                                    <span className="text-amber-600 font-semibold">Pending activation</span>
                                                )
                                            }
                                        />
                                        <div className="sm:col-span-2">
                                            <Field label="Full Address" value={selectedRestaurant.address} />
                                        </div>
                                    </div>
                                </SectionCard>

                                <SectionCard title="Direct outreach" description="Reach out to owner to verify details">
                                    <div className="space-y-3">
                                        <a
                                            href={`tel:${selectedRestaurant.owner.phone}`}
                                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-600 text-sm font-semibold text-white hover:bg-sky-700 transition-colors shadow-xs"
                                        >
                                            <Phone className="h-4 w-4" /> Call {selectedRestaurant.owner.name} ({selectedRestaurant.owner.phone})
                                        </a>
                                        <a
                                            href={`mailto:${selectedRestaurant.owner.email}`}
                                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
                                        >
                                            <Mail className="h-4 w-4" /> Email {selectedRestaurant.owner.email}
                                        </a>
                                    </div>
                                </SectionCard>
                            </div>
                        )}

                        {/* TAB 2: LEGAL & KYC */}
                        {detailTab === 'kyc' && (
                            <div className="grid gap-5 lg:grid-cols-2 animate-in fade-in duration-200">
                                <SectionCard
                                    title="Legal entity & KYC"
                                    description="Statutory details and compliance registration"
                                    action={
                                        <button
                                            onClick={() => saveLegalDetails(selectedRestaurant.id, selectedRestaurant.legal)}
                                            className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                                        >
                                            Save changes
                                        </button>
                                    }
                                >
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-1 sm:col-span-2">
                                            <label className="text-xs font-semibold text-slate-600">Legal entity name</label>
                                            <input
                                                value={selectedRestaurant.legal.entityName}
                                                onChange={(e) => {
                                                    const updated = { ...selectedRestaurant.legal, entityName: e.target.value };
                                                    setRestaurants((prev) =>
                                                        prev.map((r) => (r.id === selectedRestaurant.id ? { ...r, legal: updated } : r)),
                                                    );
                                                }}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-sky-500 focus:outline-none"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-600">Business constitution</label>
                                            <input
                                                value={selectedRestaurant.legal.constitution}
                                                onChange={(e) => {
                                                    const updated = { ...selectedRestaurant.legal, constitution: e.target.value };
                                                    setRestaurants((prev) =>
                                                        prev.map((r) => (r.id === selectedRestaurant.id ? { ...r, legal: updated } : r)),
                                                    );
                                                }}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-sky-500 focus:outline-none"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-600">Shop & Establishment License</label>
                                            <input
                                                value={selectedRestaurant.legal.shopLicence}
                                                placeholder="e.g. KA/BLR/2026/001"
                                                onChange={(e) => {
                                                    const updated = { ...selectedRestaurant.legal, shopLicence: e.target.value };
                                                    setRestaurants((prev) =>
                                                        prev.map((r) => (r.id === selectedRestaurant.id ? { ...r, legal: updated } : r)),
                                                    );
                                                }}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-sky-500 focus:outline-none"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-600">GSTIN (15 characters)</label>
                                            <input
                                                value={selectedRestaurant.legal.gstin}
                                                placeholder="37AABCS1429B1ZQ"
                                                onChange={(e) => {
                                                    const val = e.target.value.toUpperCase();
                                                    const updated = { ...selectedRestaurant.legal, gstin: val };
                                                    setRestaurants((prev) =>
                                                        prev.map((r) => (r.id === selectedRestaurant.id ? { ...r, legal: updated } : r)),
                                                    );
                                                }}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-sky-500 focus:outline-none uppercase"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-semibold text-slate-600">FSSAI Licence (14 digits)</label>
                                            <input
                                                value={selectedRestaurant.legal.fssai}
                                                placeholder="10019011000123"
                                                onChange={(e) => {
                                                    const updated = { ...selectedRestaurant.legal, fssai: e.target.value };
                                                    setRestaurants((prev) =>
                                                        prev.map((r) => (r.id === selectedRestaurant.id ? { ...r, legal: updated } : r)),
                                                    );
                                                }}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-sky-500 focus:outline-none"
                                            />
                                        </div>

                                        <div className="space-y-1 sm:col-span-2">
                                            <label className="text-xs font-semibold text-slate-600">PAN Card (10 characters)</label>
                                            <input
                                                value={selectedRestaurant.legal.pan}
                                                placeholder="ABCDE1234F"
                                                onChange={(e) => {
                                                    const val = e.target.value.toUpperCase();
                                                    const updated = { ...selectedRestaurant.legal, pan: val };
                                                    setRestaurants((prev) =>
                                                        prev.map((r) => (r.id === selectedRestaurant.id ? { ...r, legal: updated } : r)),
                                                    );
                                                }}
                                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs focus:border-sky-500 focus:outline-none uppercase"
                                            />
                                        </div>
                                    </div>
                                </SectionCard>

                                <SectionCard title="Compliance documents" description="Uploaded statutory certificates & licenses">
                                    <div className="mb-4 flex flex-wrap gap-2">
                                        <select
                                            value={docKind}
                                            onChange={(e) => setDocKind(e.target.value as DocKind)}
                                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 bg-white"
                                        >
                                            <option value="GSTIN Certificate">GSTIN Certificate</option>
                                            <option value="FSSAI License">FSSAI License</option>
                                            <option value="PAN Card">PAN Card</option>
                                            <option value="Shop & Establishment">Shop & Establishment</option>
                                            <option value="Trade License">Trade License</option>
                                            <option value="Cancelled Cheque">Cancelled Cheque</option>
                                        </select>
                                        <label className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 text-xs font-semibold cursor-pointer shadow-xs transition-colors">
                                            <Upload className="h-3.5 w-3.5" />
                                            {uploadingDoc ? 'Uploading...' : 'Upload document'}
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => handleFileUpload(e, selectedRestaurant.id)}
                                                accept=".pdf,.png,.jpg,.jpeg"
                                                disabled={uploadingDoc}
                                            />
                                        </label>
                                    </div>

                                    {selectedRestaurant.documents.length === 0 ? (
                                        <p className="text-center py-6 text-xs text-slate-400">
                                            No compliance documents uploaded yet.
                                        </p>
                                    ) : (
                                        <ul className="divide-y divide-slate-100">
                                            {selectedRestaurant.documents.map((doc) => (
                                                <li key={doc.id} className="py-2.5 flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-slate-800">{doc.kind}</p>
                                                        <p className="text-[11px] text-slate-400 truncate">{doc.fileName} · {doc.sizeKb} KB</p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <a
                                                            href={doc.previewUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-xs font-semibold text-sky-600 hover:underline"
                                                        >
                                                            View
                                                        </a>
                                                        <button
                                                            onClick={() => {
                                                                setRestaurants((prev) =>
                                                                    prev.map((r) =>
                                                                        r.id === selectedRestaurant.id
                                                                            ? { ...r, documents: r.documents.filter((d) => d.id !== doc.id) }
                                                                            : r
                                                                    ),
                                                                );
                                                                toast.success('Document removed');
                                                            }}
                                                            className="text-rose-500 hover:text-rose-700 p-1"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </SectionCard>
                            </div>
                        )}

                        {/* TAB 3: OPERATIONS & BRANCHES */}
                        {detailTab === 'ops' && (
                            <div className="space-y-5 animate-in fade-in duration-200">
                                <SectionCard title="Operational details" description="Timings, capacity, and headquarters">
                                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                        <Field label="Opening date" value={fmt(selectedRestaurant.operations.openingDate)} />
                                        <Field label="Operating hours" value={`${selectedRestaurant.operations.opensAt} - ${selectedRestaurant.operations.closesAt}`} />
                                        <Field label="Seating capacity" value={`${selectedRestaurant.operations.seatingCapacity} seats`} />
                                        <Field label="Service modes" value={selectedRestaurant.operations.serviceModes.join(', ')} />
                                    </div>
                                </SectionCard>

                                <SectionCard
                                    title="Secondary branches"
                                    description="Manage additional branch outlets operating under this restaurant"
                                    action={
                                        <button
                                            onClick={() => {
                                                setEditingBranch({
                                                    id: `br-${Date.now()}`,
                                                    name: '',
                                                    phone: '',
                                                    address: '',
                                                    active: true,
                                                });
                                                setBranchModalOpen(true);
                                            }}
                                            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-sky-700 shadow-xs transition-colors cursor-pointer"
                                        >
                                            <Plus className="h-3.5 w-3.5" /> Add branch
                                        </button>
                                    }
                                >
                                    {selectedRestaurant.branches.length === 0 ? (
                                        <p className="text-center py-6 text-xs text-slate-400">
                                            Single branch outlet. No secondary branches added.
                                        </p>
                                    ) : (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            {selectedRestaurant.branches.map((b) => (
                                                <div key={b.id} className="rounded-xl border border-slate-200 p-4 space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="font-bold text-sm text-slate-900">{b.name}</h4>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                                            Active
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500">{formatAddress(b.address)}</p>
                                                    <p className="text-xs text-slate-600 font-semibold">{b.phone}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </SectionCard>
                            </div>
                        )}

                        {/* TAB 4: SUBSCRIPTION PLAN */}
                        {detailTab === 'plan' && (
                            <SectionCard
                                title="Subscription plan"
                                description="Select and assign the SaaS tier for this restaurant."
                            >
                                <div className="grid gap-4 lg:grid-cols-3">
                                    {PLANS.map((p) => {
                                        const isCurrent = selectedRestaurant.plan?.toLowerCase() === p.id.toLowerCase();
                                        return (
                                            <div
                                                key={p.id}
                                                className={`rounded-2xl border p-5 transition-all duration-200 ${
                                                    isCurrent
                                                        ? 'border-sky-500 bg-sky-50/50 shadow-md ring-2 ring-sky-500/20'
                                                        : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h3 className="font-bold text-base text-slate-900">{p.name}</h3>
                                                        <p className="text-xs text-slate-500">{p.tagline}</p>
                                                    </div>
                                                    {isCurrent && (
                                                        <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                                                            Assigned
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-3 text-2xl font-bold text-slate-900">{p.price}</p>
                                                <ul className="mt-4 space-y-2 text-xs text-slate-600">
                                                    {p.features.map((f) => (
                                                        <li key={f} className="flex items-center gap-2">
                                                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                            <span>{f}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                                <button
                                                    disabled={isCurrent}
                                                    onClick={() => assignPlan(selectedRestaurant.id, p.id)}
                                                    className={`mt-5 w-full rounded-xl py-2 text-xs font-bold transition-colors cursor-pointer ${
                                                        isCurrent
                                                            ? 'bg-slate-100 text-slate-400 cursor-default'
                                                            : 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs'
                                                    }`}
                                                >
                                                    {isCurrent ? 'Current Plan' : `Assign ${p.name}`}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </SectionCard>
                        )}

                        {/* TAB 5: AUDIT TRAIL */}
                        {detailTab === 'audit' && (
                            <SectionCard title="Lifecycle audit trail" description="Immutable history of administrative actions">
                                <ul className="space-y-3">
                                    {selectedRestaurant.audit.map((a) => (
                                        <li key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 bg-slate-50/50">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
                                                <History className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-xs font-bold text-slate-800">{a.title}</p>
                                                    <span className="text-[11px] text-slate-400">{fmt(a.at)}</span>
                                                </div>
                                                {a.detail ? <p className="text-xs text-slate-600 mt-0.5">{a.detail}</p> : null}
                                                {a.reason ? (
                                                    <p className="text-xs text-rose-600 font-semibold mt-1">Reason: {a.reason}</p>
                                                ) : null}
                                                <p className="text-[10px] text-slate-400 mt-1">Actor: {a.actor}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </SectionCard>
                        )}
                    </div>
                )}
            </main>

            {/* REASON MODAL FOR REJECT / SUSPEND */}
            {(rejectOpen || suspendOpen) && selectedRestaurant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900">
                            {rejectOpen ? 'Reject Restaurant Request' : 'Suspend Restaurant'}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                            Please provide a clear regulatory or administrative reason for this action.
                        </p>
                        <textarea
                            rows={3}
                            value={reasonText}
                            onChange={(e) => setReasonText(e.target.value)}
                            placeholder="Enter reason..."
                            className="mt-4 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-800 focus:outline-none focus:border-sky-500"
                        />
                        <div className="mt-5 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setRejectOpen(false);
                                    setSuspendOpen(false);
                                }}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={!reasonText.trim()}
                                onClick={() => {
                                    if (rejectOpen) {
                                        updateStatus(selectedRestaurant.id, 'REJECTED', reasonText.trim());
                                        setRejectOpen(false);
                                    } else {
                                        updateStatus(selectedRestaurant.id, 'SUSPENDED', reasonText.trim());
                                        setSuspendOpen(false);
                                    }
                                }}
                                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                            >
                                Confirm {rejectOpen ? 'Rejection' : 'Suspension'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD RESTAURANT MODAL */}
            {addModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Add New Restaurant</h3>
                                <p className="text-xs text-slate-500">Create and onboard a new restaurant into the platform</p>
                            </div>
                            <button
                                onClick={() => setAddModalOpen(false)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRestaurant} className="mt-4 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-semibold text-slate-700">
                                        Restaurant Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        required
                                        value={addForm.name}
                                        onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                                        placeholder="e.g. Spice Symphony"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700">
                                        Owner Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        required
                                        value={addForm.ownerName}
                                        onChange={(e) => setAddForm({ ...addForm, ownerName: e.target.value })}
                                        placeholder="e.g. Ramesh Kumar"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700">
                                        Phone Number <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        required
                                        value={addForm.phone}
                                        onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                                        placeholder="e.g. +91 9876543210"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700">Owner Email</label>
                                    <input
                                        type="email"
                                        value={addForm.email}
                                        onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                                        placeholder="e.g. owner@example.com"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700">Business Type</label>
                                    <select
                                        value={addForm.businessType}
                                        onChange={(e) => setAddForm({ ...addForm, businessType: e.target.value })}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500 bg-white"
                                    >
                                        <option value="Restaurant">Restaurant</option>
                                        <option value="Fine Dining">Fine Dining</option>
                                        <option value="Cafe / Bistro">Cafe / Bistro</option>
                                        <option value="Fast Food / QSR">Fast Food / QSR</option>
                                        <option value="Bar & Kitchen">Bar & Kitchen</option>
                                        <option value="Cloud Kitchen">Cloud Kitchen</option>
                                    </select>
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-xs font-semibold text-slate-700">Address / City</label>
                                    <input
                                        value={addForm.address}
                                        onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                                        placeholder="Street, Landmark, City (e.g. Indiranagar, Bengaluru)"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700">Subscription Plan</label>
                                    <select
                                        value={addForm.subscriptionPlan}
                                        onChange={(e) => setAddForm({ ...addForm, subscriptionPlan: e.target.value })}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500 bg-white"
                                    >
                                        <option value="Basic">Basic (₹1,499/mo)</option>
                                        <option value="Pro">Pro (₹3,999/mo)</option>
                                        <option value="Enterprise">Enterprise (₹8,999/mo)</option>
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700">Initial Status</label>
                                    <select
                                        value={addForm.status}
                                        onChange={(e) => setAddForm({ ...addForm, status: e.target.value as Status })}
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500 bg-white"
                                    >
                                        <option value="PENDING">Pending</option>
                                        <option value="ACTIVE">Active (Instant Live)</option>
                                        <option value="ONBOARDING">Onboarding</option>
                                    </select>
                                </div>

                                <div className="sm:col-span-2 border-t border-slate-100 pt-3">
                                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Legal & Statutory KYC (Optional)</h4>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700">Business Constitution</label>
                                    <input
                                        value={addForm.businessConstitution}
                                        onChange={(e) => setAddForm({ ...addForm, businessConstitution: e.target.value })}
                                        placeholder="e.g. Private Limited / Partnership"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700">GSTIN</label>
                                    <input
                                        value={addForm.gstNumber}
                                        onChange={(e) => setAddForm({ ...addForm, gstNumber: e.target.value.toUpperCase() })}
                                        placeholder="15-character GST number"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500 uppercase"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700">FSSAI Licence</label>
                                    <input
                                        value={addForm.fssaiNumber}
                                        onChange={(e) => setAddForm({ ...addForm, fssaiNumber: e.target.value })}
                                        placeholder="14-digit FSSAI number"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-700">PAN Number</label>
                                    <input
                                        value={addForm.panNumber}
                                        onChange={(e) => setAddForm({ ...addForm, panNumber: e.target.value.toUpperCase() })}
                                        placeholder="10-character PAN"
                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-sky-500 uppercase"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setAddModalOpen(false)}
                                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submittingAdd}
                                    className="flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                                >
                                    {submittingAdd ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 animate-spin" /> Creating...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4" /> Add Restaurant
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
