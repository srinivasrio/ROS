'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldAlert, Lock, ArrowLeft, LogOut, ShieldX } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect } from 'react';

function AccessDeniedContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const reason = searchParams.get('reason') || '';

    useEffect(() => {
        if (reason === 'unauthenticated') {
            router.replace('/login');
        }
    }, [reason, router]);

    if (reason === 'unauthenticated') {
        return null;
    }

    // Map security reason code to clear, safe user-facing messaging
    const getSecurityInfo = (code: string) => {
        switch (code) {
            case 'wrong_waiter_credentials':
                return {
                    title: 'Wrong Waiter Credentials',
                    subtitle: 'Invalid Waiter Identity',
                    description: 'The waiter mobile number or employee identity in the requested URL does not match your active authenticated session. URL parameter modification is strictly prohibited.',
                    badge: 'Waiter Identity Mismatch'
                };
            case 'invalid_staff_identity':
                return {
                    title: 'Invalid Staff Identity',
                    subtitle: 'Access Denied',
                    description: 'The staff credentials or employee identity specified in the request could not be verified against your authenticated account.',
                    badge: 'Security Verification Failed'
                };
            case 'invalid_restaurant':
                return {
                    title: 'Invalid Restaurant Identity',
                    subtitle: 'Tenant Isolation Violation',
                    description: 'You do not have authorization to access resources or panels belonging to this restaurant. Tenant boundaries are strictly enforced.',
                    badge: 'Tenant Boundary Block'
                };
            case 'unauthorized_panel':
                return {
                    title: 'Unauthorized Staff Panel',
                    subtitle: 'Role Permission Denied',
                    description: 'Your assigned staff role does not have permission to access this management panel.',
                    badge: 'Role Authorization Denied'
                };
            case 'account_inactive':
                return {
                    title: 'Staff Account Inactive',
                    subtitle: 'Activation Required',
                    description: 'This staff account is currently inactive, pending activation, or suspended. Only explicitly activated staff can access management panels.',
                    badge: 'Account Not Active'
                };
            case 'unauthenticated':
                return {
                    title: 'Authentication Required',
                    subtitle: 'Access Denied',
                    description: 'You must be signed in with an authorized, active staff account to access this restaurant management panel.',
                    badge: 'Session Required'
                };
            default:
                return {
                    title: 'Invalid Staff Credentials',
                    subtitle: 'Access Denied',
                    description: 'Access to this restaurant management panel has been blocked due to an authorization or identity mismatch.',
                    badge: 'Security Alert'
                };
        }
    };

    const info = getSecurityInfo(reason);

    const handleSignOut = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (_) {}
        window.location.href = '/login';
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/10 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-amber-600/10 rounded-full blur-[120px] pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="max-w-md w-full bg-slate-900/90 border border-red-500/20 rounded-[2rem] p-8 shadow-2xl backdrop-blur-xl relative z-10 text-center"
            >
                {/* Security Shield Icon */}
                <div className="relative mx-auto mb-6 w-20 h-20">
                    <div className="w-20 h-20 bg-red-500/10 border border-red-500/30 rounded-3xl flex items-center justify-center shadow-lg shadow-red-500/20">
                        <ShieldAlert className="w-10 h-10 text-red-500 animate-pulse" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center">
                        <Lock className="w-3.5 h-3.5 text-amber-400" />
                    </div>
                </div>

                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-500/10 border border-red-500/25 text-red-400 mb-4">
                    <ShieldX size={13} />
                    {info.badge}
                </div>

                {/* Headline & Subtitle */}
                <h1 className="text-2xl font-black text-white tracking-tight mb-1">
                    {info.title}
                </h1>
                <p className="text-xs font-semibold uppercase tracking-wider text-red-400/90 mb-4">
                    {info.subtitle}
                </p>

                {/* Description */}
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 leading-relaxed text-left mb-6">
                    <p>{info.description}</p>
                    <p className="mt-2 text-[11px] text-slate-400 font-medium">
                        URL tampering, parameter manipulation, and unauthorized cross-tenant requests are logged and monitored.
                    </p>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <Link
                        href="/login"
                        className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <ArrowLeft size={16} />
                        Return to Staff Login
                    </Link>

                    <button
                        onClick={handleSignOut}
                        className="w-full py-3 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-700/50"
                    >
                        <LogOut size={14} />
                        Sign Out All Sessions
                    </button>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 text-[11px] text-slate-500">
                    Dine in One Enterprise Security • Zero Trust Architecture
                </div>
            </motion.div>
        </div>
    );
}

export default function AccessDeniedPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="text-sm font-medium text-slate-400">Loading security verification...</div>
            </div>
        }>
            <AccessDeniedContent />
        </Suspense>
    );
}
