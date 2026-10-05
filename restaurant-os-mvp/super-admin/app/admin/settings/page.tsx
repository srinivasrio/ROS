'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Settings,
    Building2,
    CreditCard,
    Receipt,
    Shield,
    Bell,
    Database,
    Save,
    CheckCircle2,
    Sparkles,
    Sliders
} from 'lucide-react';
import { toast } from 'sonner';

function PlatformSettingsContent() {
    const searchParams = useSearchParams();
    const tabQuery = searchParams.get('tab') || 'profile';

    const [activeTab, setActiveTab] = useState(tabQuery);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/settings');
            if (res.ok) {
                const json = await res.json();
                setSettings(json.settings);
            }
        } catch (err) {
            console.error('Failed to load settings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSave = async (key: string, value: any) => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, value }),
            });
            if (res.ok) {
                toast.success('Configuration saved and platform audit trail updated!');
                fetchSettings();
            } else {
                toast.error('Failed to save settings');
            }
        } catch (err) {
            toast.error('Save failed');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="py-24 text-center">
                <div className="inline-block h-8 w-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-3" />
                <p className="text-xs font-bold text-[#667085]">Loading platform configuration...</p>
            </div>
        );
    }

    const profile = settings?.profile || {};
    const billing = settings?.billing || {};
    const subscriptions = settings?.subscriptions || {};
    const retention = settings?.dataRetention || {};

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-black tracking-tight text-[#172033]">
                    Platform Configuration & Headquarters Settings
                </h1>
                <p className="text-xs text-[#667085] mt-1 font-medium">
                    Master settings controlling platform branding, global GST tax policies, subscription tiers, and data retention windows.
                </p>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-[#E4E7EC] pb-2 overflow-x-auto">
                {[
                    { id: 'profile', label: 'Dine in One Profile', icon: Building2 },
                    { id: 'subscriptions', label: 'Subscription Tiers', icon: CreditCard },
                    { id: 'billing', label: 'Billing & Taxes', icon: Receipt },
                    { id: 'legal', label: 'Legal & Policies', icon: Shield },
                    { id: 'retention', label: 'Data Retention Rules', icon: Database },
                ].map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            activeTab === t.id
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'text-[#667085] hover:text-[#172033]'
                        }`}
                    >
                        <t.icon size={14} />
                        <span>{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Content Container */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E4E7EC] shadow-xs">
                {/* TAB: Profile */}
                {activeTab === 'profile' && (
                    <div className="space-y-5">
                        <div>
                            <h2 className="text-base font-extrabold text-[#172033]">Platform Profile & Branding</h2>
                            <p className="text-xs text-[#667085]">Used in system invoices, emails, and tenant onboarding agreements.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div>
                                <label className="font-bold text-[#172033]">Platform Brand Name</label>
                                <input
                                    type="text"
                                    defaultValue={profile.businessName}
                                    id="prof-name"
                                    className="mt-1 w-full p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-medium"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-[#172033]">Legal Corporate Entity</label>
                                <input
                                    type="text"
                                    defaultValue={profile.legalName}
                                    id="prof-legal"
                                    className="mt-1 w-full p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-medium"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-[#172033]">Founder Contact Email</label>
                                <input
                                    type="email"
                                    defaultValue={profile.email}
                                    id="prof-email"
                                    className="mt-1 w-full p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-medium"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-[#172033]">Support Phone</label>
                                <input
                                    type="text"
                                    defaultValue={profile.phone}
                                    id="prof-phone"
                                    className="mt-1 w-full p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-medium"
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="font-bold text-[#172033]">Headquarters Physical Address</label>
                                <input
                                    type="text"
                                    defaultValue={profile.address}
                                    id="prof-addr"
                                    className="mt-1 w-full p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-medium"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-[#E4E7EC] flex justify-end">
                            <button
                                onClick={() => {
                                    const val = {
                                        businessName: (document.getElementById('prof-name') as HTMLInputElement)?.value,
                                        legalName: (document.getElementById('prof-legal') as HTMLInputElement)?.value,
                                        email: (document.getElementById('prof-email') as HTMLInputElement)?.value,
                                        phone: (document.getElementById('prof-phone') as HTMLInputElement)?.value,
                                        address: (document.getElementById('prof-addr') as HTMLInputElement)?.value,
                                    };
                                    handleSave('profile', val);
                                }}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer transition-all"
                            >
                                <Save size={14} />
                                <span>Save Platform Profile</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB: Subscriptions */}
                {activeTab === 'subscriptions' && (
                    <div className="space-y-5">
                        <div>
                            <h2 className="text-base font-extrabold text-[#172033]">Subscription Pricing Configuration</h2>
                            <p className="text-xs text-[#667085]">Default evaluation windows and monthly recurring plan fees.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                            <div className="p-4 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] space-y-2">
                                <span className="font-bold text-[#172033]">Starter Tier (₹ / mo)</span>
                                <input
                                    type="number"
                                    defaultValue={subscriptions.starterMonthly || 1499}
                                    id="sub-starter"
                                    className="w-full p-2.5 bg-white border border-[#E4E7EC] rounded-xl font-bold"
                                />
                                <p className="text-[11px] text-[#667085]">Single outlet essentials</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] space-y-2">
                                <span className="font-bold text-[#172033]">Growth Tier (₹ / mo)</span>
                                <input
                                    type="number"
                                    defaultValue={subscriptions.growthMonthly || 3999}
                                    id="sub-growth"
                                    className="w-full p-2.5 bg-white border border-[#E4E7EC] rounded-xl font-bold"
                                />
                                <p className="text-[11px] text-[#667085]">Multi-branch standard tier</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] space-y-2">
                                <span className="font-bold text-[#172033]">Enterprise Tier (₹ / mo)</span>
                                <input
                                    type="number"
                                    defaultValue={subscriptions.enterpriseMonthly || 8999}
                                    id="sub-ent"
                                    className="w-full p-2.5 bg-white border border-[#E4E7EC] rounded-xl font-bold"
                                />
                                <p className="text-[11px] text-[#667085]">Full franchise deployment</p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-[#E4E7EC] flex justify-end">
                            <button
                                onClick={() => {
                                    const val = {
                                        starterMonthly: Number((document.getElementById('sub-starter') as HTMLInputElement)?.value),
                                        growthMonthly: Number((document.getElementById('sub-growth') as HTMLInputElement)?.value),
                                        enterpriseMonthly: Number((document.getElementById('sub-ent') as HTMLInputElement)?.value),
                                        trialDurationDays: 14,
                                    };
                                    handleSave('subscriptions', val);
                                }}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer transition-all"
                            >
                                <Save size={14} />
                                <span>Save Subscription Pricing</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB: Billing */}
                {activeTab === 'billing' && (
                    <div className="space-y-5">
                        <div>
                            <h2 className="text-base font-extrabold text-[#172033]">Billing & Tax Configuration</h2>
                            <p className="text-xs text-[#667085]">Indian GST and automated invoice serial number rules.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div>
                                <label className="font-bold text-[#172033]">Invoice Prefix</label>
                                <input
                                    type="text"
                                    defaultValue={billing.invoicePrefix || 'INV-2026-'}
                                    id="bill-prefix"
                                    className="mt-1 w-full p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-mono"
                                />
                            </div>
                            <div>
                                <label className="font-bold text-[#172033]">Applicable GST Rate (%)</label>
                                <input
                                    type="number"
                                    defaultValue={billing.gstRate || 18}
                                    id="bill-gst"
                                    className="mt-1 w-full p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl font-bold"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t border-[#E4E7EC] flex justify-end">
                            <button
                                onClick={() => {
                                    const val = {
                                        invoicePrefix: (document.getElementById('bill-prefix') as HTMLInputElement)?.value,
                                        gstRate: Number((document.getElementById('bill-gst') as HTMLInputElement)?.value),
                                        currency: 'INR',
                                    };
                                    handleSave('billing', val);
                                }}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer transition-all"
                            >
                                <Save size={14} />
                                <span>Save Tax Rules</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB: Data Retention */}
                {activeTab === 'retention' && (
                    <div className="space-y-5">
                        <div>
                            <h2 className="text-base font-extrabold text-[#172033]">Platform Data Retention Policies</h2>
                            <p className="text-xs text-[#667085]">Automated lifecycle purges and archival rules for soft-deleted tenants.</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                            <div className="p-4 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] space-y-2">
                                <span className="font-bold text-[#172033]">Soft Delete Retention Pool</span>
                                <input
                                    type="number"
                                    defaultValue={retention.softDeleteRetentionDays || 90}
                                    id="ret-days"
                                    className="w-full p-2.5 bg-white border border-[#E4E7EC] rounded-xl font-bold"
                                />
                                <p className="text-[11px] text-[#667085]">Days before permanent deletion</p>
                            </div>
                            <div className="p-4 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] space-y-2">
                                <span className="font-bold text-[#172033]">Audit Trail Retention</span>
                                <input
                                    type="number"
                                    defaultValue={retention.auditLogRetentionYears || 7}
                                    id="ret-years"
                                    className="w-full p-2.5 bg-white border border-[#E4E7EC] rounded-xl font-bold"
                                />
                                <p className="text-[11px] text-[#667085]">Years required by statutory audit</p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-[#E4E7EC] flex justify-end">
                            <button
                                onClick={() => {
                                    const val = {
                                        softDeleteRetentionDays: Number((document.getElementById('ret-days') as HTMLInputElement)?.value),
                                        auditLogRetentionYears: Number((document.getElementById('ret-years') as HTMLInputElement)?.value),
                                    };
                                    handleSave('data_retention', val);
                                }}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer transition-all"
                            >
                                <Save size={14} />
                                <span>Save Retention Policy</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB: Legal */}
                {activeTab === 'legal' && (
                    <div className="space-y-4 text-xs">
                        <h2 className="text-base font-extrabold text-[#172033]">Legal Documents & Policies</h2>
                        <div className="p-4 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] space-y-2">
                            <span className="font-bold text-[#172033]">Standard Master SaaS Subscription Agreement</span>
                            <p className="text-[#667085]">
                                All restaurant organizations onboarded accept the Dine in One Platform Terms of Service, 99.9% Uptime SLA, and Multi-Tenant Privacy Standard upon authentication.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function PlatformSettingsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-xs text-[#667085]">Loading platform settings...</div>}>
            <PlatformSettingsContent />
        </Suspense>
    );
}
