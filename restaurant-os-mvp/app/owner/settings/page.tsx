'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOwner } from '@/context/OwnerContext';
import {
    Building2, Shield, FileText, AlertTriangle, CheckCircle2,
    Lock, Mail, Phone, MapPin, Globe, Save, RefreshCw,
    Clock, ExternalLink, Trash2, X, ChevronRight, Info
} from 'lucide-react';

interface RestaurantProfile {
    id: string;
    name: string;
    legal_name?: string;
    phone?: string;
    email?: string;
    address?: any;
    logo_url?: string;
    status?: string;
    created_at?: string;
}

interface TermsData {
    terms_version: string;
    accepted_at: string;
    ip_address?: string;
    user_agent?: string;
    is_current?: boolean;
}

export default function SettingsPage() {
    const { restaurant, setRestaurant } = useOwner();
    const [activeTab, setActiveTab] = useState<'profile' | 'branches' | 'security' | 'terms' | 'danger'>('profile');
    
    // Profile State
    const [profile, setProfile] = useState<RestaurantProfile>({
        id: '',
        name: '',
        legal_name: '',
        phone: '',
        email: '',
        address: '',
        logo_url: ''
    });
    
    // Terms State
    const [terms, setTerms] = useState<TermsData>({
        terms_version: 'v2.4.0',
        accepted_at: new Date().toISOString()
    });

    // Deletion State
    const [deletionRequest, setDeletionRequest] = useState<any>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteReason, setDeleteReason] = useState('Business closure');
    
    // Modal for Terms viewing
    const [showTermsModal, setShowTermsModal] = useState(false);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/owner/settings');
            if (res.ok) {
                const data = await res.json();
                if (data.restaurant) {
                    setProfile({
                        id: data.restaurant.id || '',
                        name: data.restaurant.name || '',
                        legal_name: data.restaurant.legal_name || '',
                        phone: data.restaurant.phone || '',
                        email: data.restaurant.email || '',
                        address: typeof data.restaurant.address === 'string' 
                            ? data.restaurant.address 
                            : data.restaurant.address ? JSON.stringify(data.restaurant.address) : '',
                        logo_url: data.restaurant.logo_url || '',
                        status: data.restaurant.status,
                        created_at: data.restaurant.created_at
                    });
                }
                if (data.terms) {
                    setTerms(data.terms);
                }
                if (data.deletionRequest) {
                    setDeletionRequest(data.deletionRequest);
                }
            }
        } catch (err) {
            console.error('[Settings] Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Fetch initial settings
    useEffect(() => {
        fetchSettings();
    }, []);

    // Save Profile
    async function handleSaveProfile(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        setErrorMsg(null);
        setSaveSuccess(false);

        try {
            const res = await fetch('/api/owner/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: profile.name,
                    legal_name: profile.legal_name,
                    phone: profile.phone,
                    email: profile.email,
                    address: profile.address,
                    logo_url: profile.logo_url
                })
            });

            if (res.ok) {
                const data = await res.json();
                setSaveSuccess(true);
                if (restaurant) {
                    setRestaurant({ ...restaurant, name: profile.name, logoUrl: profile.logo_url });
                }
                setTimeout(() => setSaveSuccess(false), 3000);
            } else {
                const err = await res.json();
                setErrorMsg(err.error || 'Failed to update profile');
            }
        } catch (err: any) {
            setErrorMsg(err.message || 'Error updating settings');
        } finally {
            setSaving(false);
        }
    }

    // Accept latest terms
    async function handleAcceptTerms() {
        setSaving(true);
        try {
            const res = await fetch('/api/owner/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'accept_terms', terms_version: 'v2.4.1' })
            });
            if (res.ok) {
                setTerms(prev => ({
                    ...prev,
                    terms_version: 'v2.4.1',
                    accepted_at: new Date().toISOString()
                }));
                setShowTermsModal(false);
            }
        } catch (err) {
            console.error('Failed to accept terms:', err);
        } finally {
            setSaving(false);
        }
    }

    // Submit deletion request
    async function handleRequestDeletion() {
        if (deleteConfirmText !== 'DELETE RESTAURANT') return;
        setSaving(true);
        try {
            const res = await fetch('/api/owner/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'request_deletion', reason: deleteReason })
            });
            if (res.ok) {
                const data = await res.json();
                setDeletionRequest(data.deletionRequest);
                setShowDeleteModal(false);
                setDeleteConfirmText('');
            }
        } catch (err) {
            console.error('Failed to request deletion:', err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">Settings</h2>
                    <p className="text-sm text-neutral-400 mt-0.5">Manage organization profile, security, and governance</p>
                </div>
                <button
                    onClick={() => fetchSettings()}
                    disabled={loading}
                    className="p-2.5 self-start sm:self-auto rounded-xl border border-neutral-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-800/80 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-zinc-700 transition cursor-pointer shadow-xs"
                    title="Refresh settings"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-500' : ''} />
                </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-neutral-200/60 dark:border-zinc-800/80 pb-3 overflow-x-auto scrollbar-none">
                {[
                    { id: 'profile', label: 'Restaurant Profile', icon: Building2 },
                    { id: 'branches', label: 'Branch Settings', icon: Globe },
                    { id: 'security', label: 'Security & Access', icon: Shield },
                    { id: 'terms', label: 'Terms & Privacy', icon: FileText },
                    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, danger: true },
                ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                isActive
                                    ? tab.danger
                                        ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 shadow-sm'
                                        : 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/40 shadow-sm'
                                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-zinc-800/40'
                            }`}
                        >
                            <Icon size={14} className={isActive ? (tab.danger ? 'text-rose-500' : 'text-indigo-500') : 'text-neutral-400'} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab 1: Restaurant Profile */}
            {activeTab === 'profile' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <form onSubmit={handleSaveProfile} className="premium-glass-card rounded-3xl border border-neutral-200/40 dark:border-zinc-800/40 p-6 lg:p-8 space-y-6">
                        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-zinc-800/60 pb-4">
                            <div>
                                <h3 className="text-base font-black text-neutral-800 dark:text-white">Business Information</h3>
                                <p className="text-xs text-neutral-400 mt-0.5">Primary information displayed on customer receipts and bills</p>
                            </div>
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200/60">
                                {profile.status || 'Active'}
                            </span>
                        </div>

                        {errorMsg && (
                            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 text-rose-600 rounded-2xl text-xs font-semibold">
                                {errorMsg}
                            </div>
                        )}

                        {saveSuccess && (
                            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-emerald-600 rounded-2xl text-xs font-semibold flex items-center gap-2">
                                <CheckCircle2 size={16} /> Changes saved successfully!
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1.5">
                                    Brand / Trading Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={profile.name}
                                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="e.g. Spice Route Hospitality"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1.5">
                                    Registered Legal Name (for GST / Invoices)
                                </label>
                                <input
                                    type="text"
                                    value={profile.legal_name || ''}
                                    onChange={(e) => setProfile({ ...profile, legal_name: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="e.g. Spice Route Foods Private Limited"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1.5">
                                    Primary Contact Email
                                </label>
                                <input
                                    type="email"
                                    value={profile.email || ''}
                                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="owner@restaurant.com"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1.5">
                                    Primary Contact Phone
                                </label>
                                <input
                                    type="text"
                                    value={profile.phone || ''}
                                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="+91 98765 43210"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1.5">
                                    Registered Corporate / Headquarters Address
                                </label>
                                <textarea
                                    rows={2}
                                    value={profile.address || ''}
                                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="Suite 401, Central Business Park..."
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-300 mb-1.5">
                                    Brand Logo URL
                                </label>
                                <input
                                    type="url"
                                    value={profile.logo_url || ''}
                                    onChange={(e) => setProfile({ ...profile, logo_url: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200/80 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="https://example.com/logo.png"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-neutral-100 dark:border-zinc-800/60">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-indigo-500/25 transition-all cursor-pointer disabled:opacity-50"
                            >
                                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                Save Changes
                            </button>
                        </div>
                    </form>
                </motion.div>
            )}

            {/* Tab 2: Branch Settings */}
            {activeTab === 'branches' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="premium-glass-card rounded-3xl border border-neutral-200/40 dark:border-zinc-800/40 p-6 lg:p-8 space-y-6">
                        <div className="border-b border-neutral-100 dark:border-zinc-800/60 pb-4">
                            <h3 className="text-base font-black text-neutral-800 dark:text-white">Multi-Branch Operation Defaults</h3>
                            <p className="text-xs text-neutral-400 mt-0.5">Control how branch settings inherit from the organization</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-neutral-50/50 dark:bg-zinc-800/30 rounded-2xl">
                                <div>
                                    <p className="text-sm font-bold text-neutral-800 dark:text-white">Unified Menu Pricing</p>
                                    <p className="text-xs text-neutral-400">Apply the same menu pricing across all active branches by default</p>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600">Enabled</span>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-neutral-50/50 dark:bg-zinc-800/30 rounded-2xl">
                                <div>
                                    <p className="text-sm font-bold text-neutral-800 dark:text-white">Cross-Branch Employee Floating</p>
                                    <p className="text-xs text-neutral-400">Allow supervisors to temporarily assign staff to other branches during rush hours</p>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600">Enabled</span>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-neutral-50/50 dark:bg-zinc-800/30 rounded-2xl">
                                <div>
                                    <p className="text-sm font-bold text-neutral-800 dark:text-white">Branch Table QR Generation</p>
                                    <p className="text-xs text-neutral-400">Branch-isolated cryptographic QR codes for instant order placement</p>
                                </div>
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600">Active</span>
                            </div>
                        </div>

                        <div className="pt-2">
                            <a
                                href="/owner/branches"
                                className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                            >
                                Manage individual branch details & hours in Branches Panel <ChevronRight size={14} />
                            </a>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Tab 3: Security & Access */}
            {activeTab === 'security' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="premium-glass-card rounded-3xl border border-neutral-200/40 dark:border-zinc-800/40 p-6 lg:p-8 space-y-6">
                        <div className="border-b border-neutral-100 dark:border-zinc-800/60 pb-4">
                            <h3 className="text-base font-black text-neutral-800 dark:text-white">Security & Tenant Isolation</h3>
                            <p className="text-xs text-neutral-400 mt-0.5">Strict architectural enforcement protects your organization data</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <Shield size={18} className="text-indigo-600 dark:text-indigo-400" />
                                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Row Level Security (RLS)</h4>
                                </div>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                    Supabase PostgreSQL policies enforce that queries from your account can strictly access records where <code className="text-[11px] bg-white dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">restaurant_id = your_tenant</code>.
                                </p>
                            </div>

                            <div className="p-4 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/30 rounded-2xl">
                                <div className="flex items-center gap-3 mb-2">
                                    <Lock size={18} className="text-violet-600 dark:text-violet-400" />
                                    <h4 className="text-sm font-bold text-neutral-900 dark:text-white">Super Admin Isolation</h4>
                                </div>
                                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                    Owner accounts have strictly scoped restaurant permissions and cannot access platform-level Super Admin controls or other restaurants.
                                </p>
                            </div>
                        </div>

                        <div className="p-4 bg-neutral-50/50 dark:bg-zinc-800/30 rounded-2xl space-y-2">
                            <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Active Session Information</p>
                            <div className="flex items-center justify-between text-xs text-neutral-500">
                                <span>Role: <strong className="text-indigo-600 font-bold uppercase">Restaurant Owner</strong></span>
                                <span>Token Expiry: <strong className="text-neutral-700 dark:text-neutral-300">8 hours sliding</strong></span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Tab 4: Terms & Privacy */}
            {activeTab === 'terms' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="premium-glass-card rounded-3xl border border-neutral-200/40 dark:border-zinc-800/40 p-6 lg:p-8 space-y-6">
                        <div className="border-b border-neutral-100 dark:border-zinc-800/60 pb-4">
                            <h3 className="text-base font-black text-neutral-800 dark:text-white">Terms of Service & Privacy Acceptance</h3>
                            <p className="text-xs text-neutral-400 mt-0.5">Cryptographic record of legal terms compliance</p>
                        </div>

                        <div className="p-5 bg-gradient-to-br from-indigo-50/80 to-violet-50/80 dark:from-zinc-900 dark:to-zinc-800/40 border border-indigo-100/60 dark:border-zinc-800 rounded-2xl space-y-4">
                            <div className="flex items-start justify-between flex-wrap gap-3">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Legal Compliance</span>
                                    <h4 className="text-base font-black text-neutral-800 dark:text-white mt-0.5">Dine in One Master Service Agreement</h4>
                                </div>
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-bold border border-emerald-200">
                                    <CheckCircle2 size={13} /> Active & Accepted
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-xs">
                                <div className="p-3 bg-white/80 dark:bg-zinc-800/80 rounded-xl border border-neutral-100 dark:border-zinc-700/50">
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Version</p>
                                    <p className="text-sm font-black text-neutral-800 dark:text-white font-mono mt-0.5">{terms.terms_version}</p>
                                </div>
                                <div className="p-3 bg-white/80 dark:bg-zinc-800/80 rounded-xl border border-neutral-100 dark:border-zinc-700/50">
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Accepted On</p>
                                    <p className="text-sm font-black text-neutral-800 dark:text-white mt-0.5">
                                        {new Date(terms.accepted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                                <div className="p-3 bg-white/80 dark:bg-zinc-800/80 rounded-xl border border-neutral-100 dark:border-zinc-700/50">
                                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Audit Record</p>
                                    <p className="text-xs font-mono text-neutral-600 dark:text-neutral-300 truncate mt-0.5">
                                        IP: {terms.ip_address || '127.0.0.1'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setShowTermsModal(true)}
                                    className="px-4 py-2 bg-white dark:bg-zinc-800 border border-neutral-200/80 dark:border-zinc-700 text-xs font-bold text-neutral-700 dark:text-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors cursor-pointer flex items-center gap-1.5"
                                >
                                    <FileText size={13} /> View Full Agreement
                                </button>
                                {terms.terms_version !== 'v2.4.1' && (
                                    <button
                                        onClick={handleAcceptTerms}
                                        disabled={saving}
                                        className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-colors cursor-pointer"
                                    >
                                        Accept Latest (v2.4.1)
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Tab 5: Danger Zone & Deletion Lifecycle */}
            {activeTab === 'danger' && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                    <div className="premium-glass-card rounded-3xl border border-rose-200/50 dark:border-rose-900/30 p-6 lg:p-8 space-y-6">
                        <div className="border-b border-neutral-100 dark:border-zinc-800/60 pb-4">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={18} className="text-rose-500" />
                                <h3 className="text-base font-black text-rose-600 dark:text-rose-400">Restaurant Deletion Lifecycle</h3>
                            </div>
                            <p className="text-xs text-neutral-400 mt-0.5">Safe multi-stage lifecycle with a 30-day retention grace period</p>
                        </div>

                        {/* Lifecycle Progress Bar */}
                        <div className="p-5 bg-neutral-50/60 dark:bg-zinc-800/40 rounded-2xl space-y-4">
                            <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Current Organization State</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {[
                                    { step: '1. Active', desc: 'Full operation', active: !deletionRequest },
                                    { step: '2. Requested', desc: 'Pending grace', active: deletionRequest?.status === 'PENDING' },
                                    { step: '3. Soft Deleted', desc: '30-day retention', active: deletionRequest?.status === 'SOFT_DELETED' },
                                    { step: '4. Permanent', desc: 'Irreversible purge', active: deletionRequest?.status === 'COMPLETED' },
                                ].map((s, i) => (
                                    <div
                                        key={i}
                                        className={`p-3 rounded-xl border text-center transition-all ${
                                            s.active
                                                ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 shadow-sm'
                                                : 'bg-white/50 dark:bg-zinc-800/20 border-neutral-200/40 dark:border-zinc-800 text-neutral-400'
                                        }`}
                                    >
                                        <p className="text-xs font-black">{s.step}</p>
                                        <p className="text-[10px] mt-0.5 opacity-80">{s.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {deletionRequest ? (
                            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex items-start gap-3">
                                <Info size={18} className="text-amber-600 mt-0.5 shrink-0" />
                                <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                                    <p className="font-bold">Deletion Request Pending</p>
                                    <p>
                                        A request to delete this organization was initiated on {new Date(deletionRequest.requested_at).toLocaleDateString()}.
                                        Your restaurant data is protected in retention until {new Date(deletionRequest.scheduled_deletion_at).toLocaleDateString()}.
                                    </p>
                                    <p className="font-semibold text-amber-900 dark:text-amber-100">
                                        Note: Restoration during the retention period requires Super Admin approval for security.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs text-neutral-500 leading-relaxed">
                                    Requesting deletion will gracefully initiate the 30-day retention countdown. Historical order records, customer invoices, and audit logs are safely sealed for compliance before any final database purge.
                                </p>
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-2"
                                >
                                    <Trash2 size={14} /> Request Restaurant Deletion
                                </button>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Terms Modal */}
            <AnimatePresence>
                {showTermsModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-zinc-900 rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-neutral-200 dark:border-zinc-800 max-h-[85vh] flex flex-col"
                        >
                            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-zinc-800">
                                <div>
                                    <h3 className="text-base font-black text-neutral-900 dark:text-white">Dine in One Master Service Terms</h3>
                                    <p className="text-xs text-neutral-400">Version 2.4.1 — Effective September 2026</p>
                                </div>
                                <button onClick={() => setShowTermsModal(false)} className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-400">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="overflow-y-auto py-4 text-xs text-neutral-600 dark:text-neutral-300 space-y-4 pr-2">
                                <h4 className="font-bold text-neutral-900 dark:text-white">1. Multi-Branch Tenant Isolation</h4>
                                <p>
                                    Dine in One guarantees cryptographic and database-level isolation of all restaurant data. A restaurant owner may only access data belonging to their verified organization. Super Administrators retain platform operational oversight.
                                </p>
                                <h4 className="font-bold text-neutral-900 dark:text-white">2. Data Retention & Deletion Policy</h4>
                                <p>
                                    Upon requesting restaurant deletion, an immutable 30-day retention period begins. Restoration during this window requires dual authorization by the Owner and Super Admin.
                                </p>
                                <h4 className="font-bold text-neutral-900 dark:text-white">3. Billing, Invoicing & Taxes</h4>
                                <p>
                                    All subscription billing, branch tiers, and invoices are governed by Indian tax regulations (GST compliant). Invoices are stored securely in private storage vaults.
                                </p>
                            </div>

                            <div className="pt-4 border-t border-neutral-100 dark:border-zinc-800 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowTermsModal(false)}
                                    className="px-4 py-2 border border-neutral-200 dark:border-zinc-700 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleAcceptTerms}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
                                >
                                    Acknowledge & Accept
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Deletion Confirmation Modal */}
            <AnimatePresence>
                {showDeleteModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 dark:border-rose-900/50 space-y-4"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
                                <AlertTriangle size={24} />
                            </div>

                            <div>
                                <h3 className="text-base font-black text-neutral-900 dark:text-white">Confirm Restaurant Deletion Request</h3>
                                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                                    This starts a 30-day retention period. All branches will be marked for deactivation. To confirm, type <strong className="text-rose-600 font-mono">DELETE RESTAURANT</strong> below.
                                </p>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-neutral-500 mb-1">Reason for Deletion</label>
                                <select
                                    value={deleteReason}
                                    onChange={(e) => setDeleteReason(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-zinc-700 text-xs bg-white dark:bg-zinc-900"
                                >
                                    <option value="Business closure">Business closure</option>
                                    <option value="Switching to another platform">Switching to another platform</option>
                                    <option value="Temporary pause">Temporary pause</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-neutral-500 mb-1">Confirmation Phrase</label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder="DELETE RESTAURANT"
                                    className="w-full px-3 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                                    className="px-4 py-2 border border-neutral-200 dark:border-zinc-700 text-xs font-bold text-neutral-600 rounded-xl"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleRequestDeletion}
                                    disabled={deleteConfirmText !== 'DELETE RESTAURANT' || saving}
                                    className="px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl disabled:opacity-40 hover:bg-rose-700"
                                >
                                    Confirm Request
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
