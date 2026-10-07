"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { toast, Toaster } from 'sonner';
import { ShieldCheck, Smartphone, CheckCircle2, ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { DineInOneLogo } from '@/components/shared/DineInOneLogo';

function MfaSetupContent() {
    const searchParams = useSearchParams();
    const userId = searchParams.get('userId');
    const router = useRouter();

    const [loadingDetails, setLoadingDetails] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    
    // User details from reset API
    const [userDetails, setUserDetails] = useState<{
        email: string;
        name: string;
        totpSecret: string;
        totpUri: string;
    } | null>(null);

    // Form states
    const [step, setStep] = useState(1); // 1: MFA Setup, 2: Success
    const [otpCode, setOtpCode] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

    useEffect(() => {
        if (!userId) {
            setFetchError('User ID is missing.');
            setLoadingDetails(false);
            return;
        }

        const fetchSetupDetails = async () => {
            try {
                const res = await fetch(`/api/auth/complete-mfa-reset?userId=${userId}`);
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to load MFA configuration details.');
                }
                const data = await res.json();
                setUserDetails(data);
            } catch (err: any) {
                console.error(err);
                setFetchError(err.message || 'MFA reset credentials not available.');
            } finally {
                setLoadingDetails(false);
            }
        };

        fetchSetupDetails();
    }, [userId]);

    const handleVerificationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (otpCode.length !== 6 || isNaN(Number(otpCode))) {
            toast.error('Please enter a valid 6-digit verification code.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/auth/complete-mfa-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    totpSecret: userDetails?.totpSecret,
                    otpCode
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Verification failed.');
            }

            const data = await res.json();
            toast.success('MFA successfully configured!');
            setRecoveryCodes(data.recoveryCodes || []);
            setStep(2);
        } catch (err: any) {
            toast.error(err.message || 'Failed to verify OTP code.');
        } finally {
            setSubmitting(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(recoveryCodes.join('\n'));
        toast.success('Recovery codes copied to clipboard!');
    };

    const downloadRecoveryCodes = () => {
        const content = `DINE IN ONE RECOVERY CODES\n` +
            `Keep these codes in a safe place. Each code can be used once to bypass MFA during login.\n\n` +
            recoveryCodes.join('\n') +
            `\n\nGenerated on: ${new Date().toLocaleString()}`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'dine_in_one_recovery_codes.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Recovery codes downloaded successfully!');
    };

    if (loadingDetails) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Generating security credentials...</p>
            </div>
        );
    }

    if (fetchError) {
        return (
            <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full text-center space-y-6 bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/50">
                    <div className="w-20 h-20 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto text-rose-500 border border-rose-100">
                        <ShieldCheck size={48} className="rotate-180 text-rose-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold mb-2 text-slate-900">Setup Error</h1>
                        <p className="text-slate-600 text-sm">
                            {fetchError}
                        </p>
                        <p className="text-slate-400 text-xs mt-3">
                            Please contact your Restaurant Administrator to request a new MFA reset.
                        </p>
                    </div>
                    <button 
                        onClick={() => router.push('/login')}
                        className="mt-6 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold transition-all w-full text-sm border border-slate-200"
                    >
                        Go to Login Page
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient background glows */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-orange-100/50 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-amber-100/50 rounded-full blur-[120px] translate-x-1/3 translate-y-1/3 pointer-events-none" />

            <div className="max-w-md w-full relative z-10">
                {/* Header branding */}
                <div className="text-center mb-8">
                    <DineInOneLogo size={64} className="mx-auto mb-4" />
                    <h1 className="text-3xl font-black tracking-tight mb-2 text-slate-900">
                        Dine In <span className="bg-gradient-to-r from-orange-500 to-red-600 bg-clip-text text-transparent">One</span>
                    </h1>
                    <p className="text-slate-500 text-xs uppercase tracking-widest font-black">
                        Two-Factor Authentication Setup
                    </p>
                </div>

                {/* Card Container */}
                <div className="bg-white border border-slate-200/80 p-8 rounded-3xl shadow-xl shadow-slate-200/50 relative">
                    {step === 1 && (
                        <form onSubmit={handleVerificationSubmit} className="space-y-6">
                            <div className="text-center mb-2">
                                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto text-orange-600 mb-3 border border-orange-100">
                                    <Smartphone size={24} />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900">MFA Recovery / Reset</h2>
                                <p className="text-slate-500 text-xs mt-1">
                                    Hello, {userDetails?.name || 'User'}. Scan the QR code using Google Authenticator, Microsoft Authenticator, or 2FAS.
                                </p>
                            </div>

                            {/* QR Code Container */}
                            <div className="flex flex-col items-center bg-white p-5 rounded-2xl mx-auto w-fit shadow-sm border border-slate-200">
                                {userDetails?.totpUri && (
                                    <QRCode value={userDetails.totpUri} size={150} />
                                )}
                            </div>

                            {/* Secret Key Display */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-center">
                                <span className="text-[9px] uppercase font-bold text-slate-500 block mb-1">Secret Key (Manual Entry)</span>
                                <code className="text-xs font-mono font-bold text-orange-600 selection:bg-orange-100">{userDetails?.totpSecret}</code>
                            </div>

                            {/* Verification Code */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-2">Verification Code</label>
                                <input 
                                    type="text"
                                    maxLength={6}
                                    required
                                    className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-center focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-slate-400 text-lg font-mono tracking-[0.3em] text-slate-900 font-bold"
                                    placeholder="000000"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                />
                            </div>

                            <button 
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-orange-500/20 text-sm cursor-pointer disabled:opacity-50"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={18} /> : (
                                    <>Verify & Enable MFA <ArrowRight size={18} /></>
                                )}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <div className="text-center py-4 space-y-6">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 border border-emerald-100">
                                <CheckCircle2 size={36} />
                            </div>
                            
                            <div>
                                <h2 className="text-xl font-black text-slate-900">Security Set Up!</h2>
                                <p className="text-slate-500 text-xs mt-1">
                                    Your new multi-factor authentication credentials are verified and active.
                                </p>
                            </div>

                            {recoveryCodes.length > 0 && (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-left space-y-4">
                                    <div>
                                        <h3 className="text-xs font-bold text-orange-600 uppercase tracking-wider">One-Time Backup Recovery Codes</h3>
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                            If you lose your MFA device, you can log in using one of these backup codes. Keep them secure, they will not be shown again.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs font-mono font-bold text-slate-800">
                                        {recoveryCodes.map((code, idx) => (
                                            <div key={idx} className="bg-white border border-slate-200 p-2 rounded-lg text-center select-all">
                                                {code}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-2.5 pt-1">
                                        <button 
                                            type="button"
                                            onClick={copyToClipboard}
                                            className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                                        >
                                            Copy
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={downloadRecoveryCodes}
                                            className="flex-1 py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg text-xs font-bold transition-all border border-orange-200 cursor-pointer"
                                        >
                                            Download .txt
                                        </button>
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={() => router.push('/login')}
                                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-500/20 text-sm cursor-pointer"
                            >
                                Go to Login Page
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

export default function MfaSetupPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                <p className="text-slate-500 text-sm font-semibold uppercase tracking-wider">Loading setup page...</p>
            </div>
        }>
            <Toaster richColors theme="light" position="top-right" />
            <MfaSetupContent />
        </Suspense>
    );
}

