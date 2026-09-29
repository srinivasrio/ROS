'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
    Clock, ShieldCheck, Phone, CheckCircle2, 
    ArrowRight, LogOut, RefreshCw, AlertCircle, 
    Store, Lock, Sparkles, Building2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from "@/components/landing/Navbar";
import { toast } from 'sonner';

const LIFECYCLE_STAGES = [
    { key: 'PENDING', label: 'Request Submitted', desc: 'Request logged in review queue' },
    { key: 'CONTACTED', label: 'Owner Contacted', desc: 'Super Admin initiating outreach' },
    { key: 'ONBOARDING', label: 'Compliance Collection', desc: 'Legal docs & operating hours' },
    { key: 'VERIFICATION', label: 'Document Verification', desc: 'GST, FSSAI & PAN validation' },
    { key: 'PLAN_ASSIGNED', label: 'Plan Assigned', desc: 'Subscription tier configured' },
    { key: 'APPROVED', label: 'Approved', desc: 'Compliance cleared for launch' },
    { key: 'ACTIVE', label: 'Activated', desc: 'Full panel access unlocked' }
];

export default function WaitingApprovalPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState<{
        hasRestaurant: boolean;
        restaurant?: {
            id: string;
            name: string;
            status: string;
            subscriptionPlan?: string | null;
            address?: string;
            phone?: string;
            email?: string;
            businessType?: string;
            createdAt?: string;
        };
    } | null>(null);

    const fetchStatus = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        try {
            const res = await fetch('/api/auth/owner/status');
            const json = await res.json();
            if (res.ok) {
                setData(json);
                if (isManual) toast.success('Status updated');
            } else {
                toast.error(json.error || 'Failed to check status');
            }
        } catch (err) {
            console.error('Failed to fetch status:', err);
        } finally {
            setLoading(false);
            if (isManual) setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStatus();
        // Poll every 15 seconds
        const interval = setInterval(() => fetchStatus(), 15000);
        return () => clearInterval(interval);
    }, []);

    const handleSignOut = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (_) {}
        window.location.href = '/login';
    };

    const status = (data?.restaurant?.status || 'PENDING').toUpperCase();
    const isActive = status === 'ACTIVE' || status === 'APPROVED';
    const isRejected = status === 'REJECTED';
    const isSuspended = status === 'SUSPENDED';

    const getStageIndex = (s: string) => {
        const idx = LIFECYCLE_STAGES.findIndex(stage => stage.key === s);
        return idx !== -1 ? idx : 0;
    };

    const currentStageIdx = getStageIndex(status);

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 pt-24 pb-16 relative overflow-hidden">
            <Navbar />

            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#FF6B6B]/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#4ECDC4]/10 rounded-full blur-[120px] translate-x-1/4 translate-y-1/4 pointer-events-none" />

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-2xl w-full bg-card border border-border rounded-[2.5rem] p-6 sm:p-10 shadow-2xl relative z-10"
            >
                {/* Status Hero Icon */}
                <div className="text-center mb-6">
                    {isActive ? (
                        <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/20">
                            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                        </div>
                    ) : isRejected || isSuspended ? (
                        <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-red-500/20">
                            <AlertCircle className="w-10 h-10 text-red-500" />
                        </div>
                    ) : (
                        <div className="w-20 h-20 bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-[#FF6B6B]/30">
                            <Clock className="w-10 h-10 text-white animate-[spin_16s_linear_infinite]" />
                        </div>
                    )}

                    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest mb-3 border">
                        {isActive ? (
                            <span className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 px-3 py-1 rounded-full">
                                ● Activated & Ready
                            </span>
                        ) : isRejected ? (
                            <span className="text-red-500 border-red-500/30 bg-red-500/10 px-3 py-1 rounded-full">
                                ● Request Rejected
                            </span>
                        ) : isSuspended ? (
                            <span className="text-amber-500 border-amber-500/30 bg-amber-500/10 px-3 py-1 rounded-full">
                                ● Temporarily Suspended
                            </span>
                        ) : (
                            <span className="text-[#FF6B6B] border-[#FF6B6B]/30 bg-[#FF6B6B]/10 px-3 py-1 rounded-full">
                                ● {status.replace('_', ' ')}
                            </span>
                        )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                        {data?.restaurant?.name || 'Your Restaurant'}
                    </h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        ID: <span className="font-mono font-bold text-foreground">{data?.restaurant?.id || '—'}</span> • Type: <span className="font-bold text-foreground">{data?.restaurant?.businessType || 'Restaurant'}</span>
                    </p>
                </div>

                {/* Main Notification Box */}
                {isActive ? (
                    <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center mb-8">
                        <h3 className="font-black text-base text-emerald-600 dark:text-emerald-400">
                            Congratulations! Your Restaurant is Active.
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            Your compliance was verified and assigned plan is <strong className="text-foreground">{data?.restaurant?.subscriptionPlan || 'Active Tier'}</strong>. Full operational access is now enabled.
                        </p>
                        <button
                            onClick={() => router.push(`/${data?.restaurant?.id}/admin/dashboard`)}
                            className="mt-4 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/20 inline-flex items-center gap-2 cursor-pointer"
                        >
                            Open Admin Dashboard <ArrowRight size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="p-4 rounded-2xl bg-neutral-100 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/40 mb-8 flex gap-3.5 items-start">
                        <Lock className="w-5 h-5 text-[#FF6B6B] shrink-0 mt-0.5" />
                        <div className="text-xs text-muted-foreground">
                            <strong className="text-foreground font-bold">Operational Panels Locked:</strong>
                            <p className="mt-0.5 leading-relaxed">
                                Dine In One enforces strict compliance. Your Admin, Waiter, and KDS panels will unlock immediately once our Super Admin team verifies your documentation and activates your account.
                            </p>
                        </div>
                    </div>
                )}

                {/* 7-Stage Visual Lifecycle Stepper */}
                <div className="mb-8">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
                        Onboarding Pipeline Progress
                    </h4>
                    <div className="space-y-3">
                        {LIFECYCLE_STAGES.map((stage, idx) => {
                            const isPast = idx < currentStageIdx;
                            const isCurrent = idx === currentStageIdx;
                            const isFuture = idx > currentStageIdx;

                            return (
                                <div 
                                    key={stage.key}
                                    className={`flex items-center gap-3.5 p-3 rounded-2xl border transition-all ${
                                        isCurrent 
                                            ? 'bg-[#FF6B6B]/10 border-[#FF6B6B]/40 shadow-sm' 
                                            : isPast 
                                                ? 'bg-emerald-500/5 border-emerald-500/20' 
                                                : 'bg-background/40 border-border/40 opacity-50'
                                    }`}
                                >
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                        isPast 
                                            ? 'bg-emerald-500 text-white' 
                                            : isCurrent 
                                                ? 'bg-[#FF6B6B] text-white shadow-md shadow-[#FF6B6B]/30 animate-pulse' 
                                                : 'bg-neutral-200 dark:bg-neutral-800 text-muted-foreground'
                                    }`}>
                                        {isPast ? <CheckCircle2 size={15} /> : idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <p className={`text-xs font-bold ${
                                                isCurrent ? 'text-[#FF6B6B]' : isPast ? 'text-foreground' : 'text-muted-foreground'
                                            }`}>
                                                {stage.label}
                                            </p>
                                            {isCurrent && (
                                                <span className="text-[10px] font-black uppercase text-[#FF6B6B] tracking-wider">
                                                    Current Stage
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground truncate">
                                            {stage.desc}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <button
                        onClick={() => fetchStatus(true)}
                        disabled={refreshing}
                        className="flex-1 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-foreground font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        Check Status Again
                    </button>

                    <button
                        onClick={handleSignOut}
                        className="py-3 px-6 text-muted-foreground hover:text-foreground font-bold text-xs rounded-2xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                        <LogOut size={14} /> Sign Out
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
