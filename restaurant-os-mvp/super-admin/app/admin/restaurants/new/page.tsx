'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    UtensilsCrossed,
    Users,
    GitBranch,
    CreditCard,
    CheckCircle2,
    ArrowLeft,
    ArrowRight,
    Sparkles,
    Building2,
    Mail,
    Phone,
    MapPin,
    ShieldCheck,
    Calendar,
    AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

export default function CreateRestaurantWizard() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);

    // Form Data
    const [formData, setFormData] = useState({
        // Step 1: Restaurant
        restaurantName: '',
        legalName: '',
        phone: '',
        email: '',
        address: '',
        businessType: 'Restaurant & Bar',
        gstNumber: '',
        fssaiNumber: '',
        // Step 2: Owner
        ownerMode: 'new' as 'new' | 'existing',
        ownerName: '',
        ownerEmail: '',
        ownerPhone: '',
        existingOwnerId: '',
        // Step 3: Branch
        branchName: 'Main Central Branch',
        branchCode: 'BR-MAIN-01',
        branchPhone: '',
        branchEmail: '',
        branchAddress: '',
        // Step 4: Subscription
        plan: 'growth',
        subscriptionType: 'trial' as 'trial' | 'active',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });

    const updateField = (field: string, value: any) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // Step validation
    const validateStep = (step: number) => {
        if (step === 1) {
            if (!formData.restaurantName.trim()) {
                toast.error('Restaurant brand name is required');
                return false;
            }
            if (!formData.email.trim()) {
                toast.error('Contact email is required');
                return false;
            }
            if (!formData.phone.trim()) {
                toast.error('Contact phone is required');
                return false;
            }
            return true;
        }
        if (step === 2) {
            if (formData.ownerMode === 'new') {
                if (!formData.ownerName.trim()) {
                    toast.error('Owner full name is required');
                    return false;
                }
                if (!formData.ownerEmail.trim()) {
                    toast.error('Owner email is required');
                    return false;
                }
            }
            return true;
        }
        if (step === 3) {
            if (!formData.branchName.trim()) {
                toast.error('Branch outlet name is required');
                return false;
            }
            return true;
        }
        return true;
    };

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep((prev) => Math.min(prev + 1, 5));
        }
    };

    const prevStep = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    };

    // Final Submission
    const handleFinalSubmit = async () => {
        setSubmitting(true);
        try {
            const payload = {
                name: formData.restaurantName,
                ownerName: formData.ownerName || formData.restaurantName + ' Admin',
                email: formData.email,
                phone: formData.phone,
                address: formData.address,
                businessType: formData.businessType,
                gstNumber: formData.gstNumber,
                fssaiNumber: formData.fssaiNumber,
                subscriptionPlan: formData.plan,
                status: formData.subscriptionType === 'active' ? 'ACTIVE' : 'TRIAL',
            };

            const res = await fetch('/api/restaurants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success('Restaurant organization successfully provisioned!');
                router.push(`/admin/restaurants/${data.restaurant.id}`);
            } else {
                toast.error(data.error || 'Failed to provision restaurant');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error communicating with server');
        } finally {
            setSubmitting(false);
        }
    };

    const STEPS = [
        { id: 1, title: 'Restaurant', icon: UtensilsCrossed },
        { id: 2, title: 'Owner Account', icon: Users },
        { id: 3, title: 'Initial Branch', icon: GitBranch },
        { id: 4, title: 'Subscription', icon: CreditCard },
        { id: 5, title: 'Confirmation', icon: CheckCircle2 },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Top Navigation */}
            <div className="flex items-center justify-between">
                <Link
                    href="/admin/restaurants"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#667085] hover:text-[#172033] transition-colors"
                >
                    <ArrowLeft size={14} />
                    <span>Back to Restaurants</span>
                </Link>
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                    <Sparkles size={12} />
                    <span>Multi-Tenant Onboarding Engine</span>
                </div>
            </div>

            {/* Stepper Header */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#E4E7EC] shadow-2xs">
                <div className="flex items-center justify-between relative">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#F0F2F5] -translate-y-1/2 z-0 hidden sm:block" />
                    {STEPS.map((s) => {
                        const isDone = s.id < currentStep;
                        const isCurrent = s.id === currentStep;

                        return (
                            <div key={s.id} className="relative z-10 flex flex-col items-center gap-1.5">
                                <div
                                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                                        isDone
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : isCurrent
                                            ? 'bg-indigo-600 text-white ring-4 ring-indigo-50 shadow-md shadow-indigo-600/20'
                                            : 'bg-white border border-[#E4E7EC] text-neutral-400'
                                    }`}
                                >
                                    {isDone ? <CheckCircle2 size={16} /> : s.id}
                                </div>
                                <span
                                    className={`text-[11px] font-bold hidden sm:block ${
                                        isCurrent ? 'text-[#172033]' : 'text-[#667085]'
                                    }`}
                                >
                                    {s.title}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Wizard Form Body */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#E4E7EC] shadow-xs">
                {/* STEP 1: Restaurant Info */}
                {currentStep === 1 && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-5"
                    >
                        <div>
                            <h2 className="text-lg font-extrabold text-[#172033]">
                                Step 1 — Restaurant Brand & Organization
                            </h2>
                            <p className="text-xs text-[#667085]">
                                Primary business identity and legal tax credentials.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#172033]">Restaurant Name *</label>
                                <input
                                    type="text"
                                    value={formData.restaurantName}
                                    onChange={(e) => updateField('restaurantName', e.target.value)}
                                    placeholder="e.g. Spice Route Hospitality"
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#172033]">Legal Entity Name</label>
                                <input
                                    type="text"
                                    value={formData.legalName}
                                    onChange={(e) => updateField('legalName', e.target.value)}
                                    placeholder="e.g. Spice Route LLP"
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#172033]">Official Phone *</label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={(e) => updateField('phone', e.target.value)}
                                    placeholder="+91 98765 43210"
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#172033]">Official Email *</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => updateField('email', e.target.value)}
                                    placeholder="admin@spiceroute.in"
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                                <label className="text-xs font-bold text-[#172033]">Registered Headquarters Address</label>
                                <textarea
                                    rows={2}
                                    value={formData.address}
                                    onChange={(e) => updateField('address', e.target.value)}
                                    placeholder="102 Marine Boulevard, Chennai, Tamil Nadu - 600001"
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#172033]">GST Identification # (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.gstNumber}
                                    onChange={(e) => updateField('gstNumber', e.target.value)}
                                    placeholder="33AAAAA0000A1Z5"
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#172033]">FSSAI License # (Optional)</label>
                                <input
                                    type="text"
                                    value={formData.fssaiNumber}
                                    onChange={(e) => updateField('fssaiNumber', e.target.value)}
                                    placeholder="10020042000123"
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* STEP 2: Owner */}
                {currentStep === 2 && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-5"
                    >
                        <div>
                            <h2 className="text-lg font-extrabold text-[#172033]">
                                Step 2 — Platform Owner Assignment
                            </h2>
                            <p className="text-xs text-[#667085]">
                                Associate this restaurant with an owner identity. A secure password setup link will be generated.
                            </p>
                        </div>

                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={() => updateField('ownerMode', 'new')}
                                className={`flex-1 p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                                    formData.ownerMode === 'new'
                                        ? 'border-indigo-600 bg-indigo-50/50'
                                        : 'border-[#E4E7EC] hover:bg-neutral-50'
                                }`}
                            >
                                <p className="text-xs font-bold text-[#172033]">Create New Owner Account</p>
                                <p className="text-[11px] text-[#667085] mt-1">
                                    Provisions a fresh owner account and triggers an email onboarding invitation.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => updateField('ownerMode', 'existing')}
                                className={`flex-1 p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                                    formData.ownerMode === 'existing'
                                        ? 'border-indigo-600 bg-indigo-50/50'
                                        : 'border-[#E4E7EC] hover:bg-neutral-50'
                                }`}
                            >
                                <p className="text-xs font-bold text-[#172033]">Select Existing Owner</p>
                                <p className="text-[11px] text-[#667085] mt-1">
                                    Attach to an established owner managing other restaurant brands.
                                </p>
                            </button>
                        </div>

                        {formData.ownerMode === 'new' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-[#172033]">Owner Full Name *</label>
                                    <input
                                        type="text"
                                        value={formData.ownerName}
                                        onChange={(e) => updateField('ownerName', e.target.value)}
                                        placeholder="e.g. Ravi Kumar"
                                        className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-[#172033]">Owner Login Email *</label>
                                    <input
                                        type="email"
                                        value={formData.ownerEmail}
                                        onChange={(e) => updateField('ownerEmail', e.target.value)}
                                        placeholder="ravi@spiceroute.in"
                                        className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-[#172033]">Mobile Number</label>
                                    <input
                                        type="text"
                                        value={formData.ownerPhone}
                                        onChange={(e) => updateField('ownerPhone', e.target.value)}
                                        placeholder="+91 99887 76655"
                                        className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-1 pt-2">
                                <label className="text-xs font-bold text-[#172033]">Choose Owner</label>
                                <select
                                    value={formData.existingOwnerId}
                                    onChange={(e) => updateField('existingOwnerId', e.target.value)}
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 cursor-pointer"
                                >
                                    <option value="">Select an owner profile...</option>
                                    <option value="owner-1">Ravi Kumar (ravi@spiceroute.in)</option>
                                    <option value="owner-2">Priya Sundaram (priya@coastalflavours.in)</option>
                                    <option value="owner-3">Suresh Reddy (suresh@chettinad.com)</option>
                                </select>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* STEP 3: Branch */}
                {currentStep === 3 && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-5"
                    >
                        <div>
                            <h2 className="text-lg font-extrabold text-[#172033]">
                                Step 3 — Primary Branch Outlet
                            </h2>
                            <p className="text-xs text-[#667085]">
                                Every restaurant must have at least one physical outlet provisioned for POS and table QR codes.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#172033]">Branch Name *</label>
                                <input
                                    type="text"
                                    value={formData.branchName}
                                    onChange={(e) => updateField('branchName', e.target.value)}
                                    placeholder="e.g. Nellore Central Branch"
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#172033]">Branch Internal Code</label>
                                <input
                                    type="text"
                                    value={formData.branchCode}
                                    onChange={(e) => updateField('branchCode', e.target.value)}
                                    placeholder="e.g. BR-NEL-01"
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white font-mono"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#172033]">Branch Phone</label>
                                <input
                                    type="text"
                                    value={formData.branchPhone}
                                    onChange={(e) => updateField('branchPhone', e.target.value)}
                                    placeholder="+91 861 2345678"
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#172033]">Branch Email</label>
                                <input
                                    type="email"
                                    value={formData.branchEmail}
                                    onChange={(e) => updateField('branchEmail', e.target.value)}
                                    placeholder="nellore@spiceroute.in"
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                                <label className="text-xs font-bold text-[#172033]">Physical Outlet Address</label>
                                <input
                                    type="text"
                                    value={formData.branchAddress}
                                    onChange={(e) => updateField('branchAddress', e.target.value)}
                                    placeholder="Plot 45, Trunk Road, Gandhi Nagar, Nellore - 524001"
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 focus:bg-white"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* STEP 4: Subscription */}
                {currentStep === 4 && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-5"
                    >
                        <div>
                            <h2 className="text-lg font-extrabold text-[#172033]">
                                Step 4 — SaaS Subscription & Billing Plan
                            </h2>
                            <p className="text-xs text-[#667085]">
                                Select the pricing tier and trial evaluation parameters for this organization.
                            </p>
                        </div>

                        {/* Plan Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {[
                                { id: 'starter', name: 'Starter Tier', price: '₹1,499 / mo', desc: '1 outlet, 20 tables, QR ordering & basic KDS' },
                                { id: 'growth', name: 'Growth Tier', price: '₹3,999 / mo', desc: 'Multi-outlet, unlimited tables, split KDS & live analytics' },
                                { id: 'enterprise', name: 'Enterprise', price: '₹8,999 / mo', desc: 'Unlimited branches, custom API, dedicated support & SLA' },
                            ].map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => updateField('plan', p.id)}
                                    className={`p-4 rounded-2xl border text-left cursor-pointer transition-all ${
                                        formData.plan === p.id
                                            ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/10'
                                            : 'border-[#E4E7EC] hover:bg-neutral-50'
                                    }`}
                                >
                                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">{p.name}</span>
                                    <p className="text-base font-black text-[#172033] mt-1">{p.price}</p>
                                    <p className="text-[11px] text-[#667085] mt-1">{p.desc}</p>
                                </button>
                            ))}
                        </div>

                        {/* Status Toggle: Trial vs Active */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#172033]">Evaluation Mode</label>
                                <select
                                    value={formData.subscriptionType}
                                    onChange={(e) => updateField('subscriptionType', e.target.value)}
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600 cursor-pointer font-bold"
                                >
                                    <option value="trial">14-Day Free Evaluation Trial</option>
                                    <option value="active">Active Paid Subscription (Immediate)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-[#172033]">Billing Cycle Ends / Trial Expiry</label>
                                <input
                                    type="date"
                                    value={formData.endDate}
                                    onChange={(e) => updateField('endDate', e.target.value)}
                                    className="w-full text-xs p-3 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600"
                                />
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* STEP 5: Confirmation Summary */}
                {currentStep === 5 && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-5"
                    >
                        <div>
                            <h2 className="text-lg font-extrabold text-[#172033]">
                                Step 5 — Confirmation & Provisioning Review
                            </h2>
                            <p className="text-xs text-[#667085]">
                                Verify all onboarding parameters before generating tenant databases and branches.
                            </p>
                        </div>

                        <div className="divide-y divide-[#E4E7EC] rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] p-5 space-y-4 text-xs">
                            <div className="flex justify-between items-center pb-2">
                                <span className="font-bold text-[#667085]">Restaurant Brand</span>
                                <span className="font-black text-[#172033]">{formData.restaurantName}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="font-bold text-[#667085]">Legal Entity</span>
                                <span className="text-[#172033]">{formData.legalName || 'Sole Proprietorship'}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="font-bold text-[#667085]">Owner Contact</span>
                                <span className="text-[#172033]">{formData.ownerName || formData.ownerEmail}</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="font-bold text-[#667085]">Initial Outlet</span>
                                <span className="text-[#172033]">{formData.branchName} ({formData.branchCode})</span>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                <span className="font-bold text-[#667085]">Selected Plan</span>
                                <span className="font-bold text-indigo-700 uppercase">{formData.plan}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="font-bold text-[#667085]">Initial Status</span>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    {formData.subscriptionType === 'active' ? 'Active Paid' : '14-Day Free Trial'}
                                </span>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-3">
                            <ShieldCheck size={18} className="text-indigo-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-indigo-900 leading-relaxed">
                                Upon confirmation, our multi-tenant provisioner will auto-seed default menu categories, POS configuration, QR codes, and log the action in the platform audit trail.
                            </p>
                        </div>
                    </motion.div>
                )}

                {/* Footer Controls */}
                <div className="mt-8 pt-6 border-t border-[#E4E7EC] flex items-center justify-between">
                    {currentStep > 1 ? (
                        <button
                            type="button"
                            onClick={prevStep}
                            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E4E7EC] hover:bg-neutral-50 text-[#172033] rounded-xl text-xs font-bold cursor-pointer transition-all"
                        >
                            <ArrowLeft size={14} />
                            <span>Previous Step</span>
                        </button>
                    ) : (
                        <div />
                    )}

                    {currentStep < 5 ? (
                        <button
                            type="button"
                            onClick={nextStep}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 cursor-pointer transition-all"
                        >
                            <span>Next: {STEPS[currentStep].title}</span>
                            <ArrowRight size={14} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleFinalSubmit}
                            disabled={submitting}
                            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-600/20 cursor-pointer transition-all disabled:opacity-60"
                        >
                            {submitting ? (
                                <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle2 size={15} />
                                    <span>Provision Restaurant</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
