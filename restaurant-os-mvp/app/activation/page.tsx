"use client";

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';
import { ShieldCheck, Lock, CheckCircle2, ArrowRight, Loader2, KeyRound } from 'lucide-react';

function ActivationContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const router = useRouter();

    const [loadingToken, setLoadingToken] = useState(true);
    const [tokenError, setTokenError] = useState<string | null>(null);
    
    // User details from token validation
    const [userDetails, setUserDetails] = useState<{
        email: string;
        name: string;
        role: string;
    } | null>(null);

    // Form states
    const [step, setStep] = useState(1); // 1: Password, 2: Success
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!token) {
            setTokenError('Activation token is missing.');
            setLoadingToken(false);
            return;
        }

        const validateToken = async () => {
            try {
                const res = await fetch(`/api/auth/activate?token=${token}`);
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to validate activation token.');
                }
                const data = await res.json();
                setUserDetails(data);
            } catch (err: any) {
                console.error(err);
                setTokenError(err.message || 'Invalid or expired activation link.');
            } finally {
                setLoadingToken(false);
            }
        };

        validateToken();
    }, [token]);

    const handleActivationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 12) {
            toast.error('Password must be at least 12 characters long.');
            return;
        }
        if (password !== confirmPassword) {
            toast.error('Passwords do not match.');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch('/api/auth/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    password
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Activation failed.');
            }

            toast.success('Account successfully activated!');
            setStep(2);
        } catch (err: any) {
            toast.error(err.message || 'Failed to activate account.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loadingToken) {
        return (
            <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                <p className="text-zinc-400 text-sm font-semibold uppercase tracking-wider">Validating invitation details...</p>
            </div>
        );
    }

    if (tokenError) {
        return (
            <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full text-center space-y-6 bg-neutral-900 p-8 rounded-3xl border border-neutral-800 shadow-2xl">
                    <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto text-red-500">
                        <ShieldCheck size={48} className="rotate-180 text-red-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold mb-2">Activation Link Expired</h1>
                        <p className="text-zinc-400 text-sm">
                            {tokenError}
                        </p>
                        <p className="text-zinc-500 text-xs mt-3">
                            Please contact your Restaurant Administrator or support to receive a new activation link.
                        </p>
                    </div>
                    <button 
                        onClick={() => router.push('/login')}
                        className="mt-6 px-6 py-3 bg-neutral-800 hover:bg-neutral-750 text-white rounded-xl font-bold transition-all w-full text-sm"
                    >
                        Go to Login Page
                    </button>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Ambient background glows */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-orange-500/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-red-500/5 rounded-full blur-[120px] translate-x-1/3 translate-y-1/3 pointer-events-none" />

            <div className="max-w-md w-full relative z-10">
                {/* Header branding */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black tracking-tight mb-2">
                        Dine In <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">One</span>
                    </h1>
                    <p className="text-zinc-400 text-xs uppercase tracking-widest font-black">
                        Secure Employee Onboarding
                    </p>
                </div>

                {/* Progress Indicators */}
                <div className="flex gap-2 mb-6">
                    {[1, 2].map((s) => (
                        <div 
                            key={s}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                                s <= step ? 'bg-orange-500' : 'bg-neutral-800'
                            }`}
                        />
                    ))}
                </div>

                {/* Card Container */}
                <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl shadow-2xl relative">
                    {step === 1 && (
                        <form onSubmit={handleActivationSubmit} className="space-y-6">
                            <div className="text-center mb-4">
                                <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto text-orange-500 mb-3">
                                    <KeyRound size={24} />
                                </div>
                                <h2 className="text-xl font-bold">Set Password</h2>
                                <p className="text-zinc-400 text-xs mt-1">
                                    Hello, {userDetails?.name || 'User'}. Please secure your account with a strong password.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-2">New Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-orange-500 transition-colors" size={16} />
                                        <input 
                                            type="password"
                                            required
                                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-700 text-sm font-medium text-white"
                                            placeholder="Min 12 chars, upper, lower, number, symbol"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-2">Confirm Password</label>
                                    <div className="relative group">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-orange-500 transition-colors" size={16} />
                                        <input 
                                            type="password"
                                            required
                                            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-orange-500/50 transition-all placeholder:text-zinc-700 text-sm font-medium text-white"
                                            placeholder="Repeat password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-750 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-orange-500/10 text-sm cursor-pointer disabled:opacity-50"
                            >
                                {submitting ? <Loader2 className="animate-spin" size={18} /> : (
                                    <>Activate Account <ArrowRight size={18} /></>
                                )}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <div className="text-center py-4 space-y-6">
                            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto text-green-500">
                                <CheckCircle2 size={36} />
                            </div>
                            
                            <div>
                                <h2 className="text-2xl font-black">Activation Complete!</h2>
                                <p className="text-zinc-400 text-xs mt-1">
                                    Your credentials have been successfully configured.
                                </p>
                            </div>

                            <div>
                                <p className="text-zinc-400 text-xs mb-4">
                                    Your staff account is now fully <span className="text-emerald-400 font-bold uppercase">Active</span>. You can now log in with your credentials to access your designated restaurant panel.
                                </p>
                            </div>

                            <button 
                                onClick={() => router.push('/login')}
                                className="w-full py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-750 text-white rounded-xl font-bold transition-all shadow-lg shadow-green-500/10 text-sm cursor-pointer"
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

export default function ActivationPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                <p className="text-zinc-400 text-sm font-semibold uppercase tracking-wider">Loading activation page...</p>
            </div>
        }>
            <Toaster richColors theme="dark" position="top-right" />
            <ActivationContent />
        </Suspense>
    );
}
