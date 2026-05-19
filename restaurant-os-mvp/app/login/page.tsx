'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Mail, Lock, Loader2, ArrowRight, ShieldCheck, CheckCircle2, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UserService } from '@/app/services/users';
import { RestaurantService } from '@/app/services/restaurant.service';
import { toast } from 'sonner';
import Link from 'next/link';
import Navbar from "@/app/components/landing/Navbar";

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('phone');
    const [identifier, setIdentifier] = useState('');
    const [pin, setPin] = useState('');
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { user, error } = authMethod === 'phone' 
                ? await UserService.signInWithPhone(identifier, pin)
                : await UserService.signInWithEmail(identifier, pin);

            if (error) throw error;

            toast.success('Welcome back!');
            
            // Fetch profile to get restaurant_id
            const profile = await UserService.getCurrentProfile();
            if (profile?.restaurant_id) {
                router.push(`/${profile.restaurant_id}/portal`);
                return;
            }
            
            router.push('/');
        } catch (error: any) {
            toast.error(error.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        try {
            const { error } = await UserService.signInWithGoogle();
            if (error) throw error;
        } catch (error: any) {
            toast.error(error.message || 'Google Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 pt-24 relative overflow-hidden">
            <Navbar />
            {/* Background Accents to match public page */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#FF6B6B]/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#4ECDC4]/10 rounded-full blur-[120px] translate-x-1/4 translate-y-1/4" />

            <div className="max-w-md w-full relative z-10">
                {/* Brand */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black tracking-tight mb-2 text-foreground">
                        Welcome <span className="text-[#FF6B6B]">Back</span>
                    </h1>
                    <p className="text-black font-medium">
                        Use your mobile number or email to log in
                    </p>
                </div>

                <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-2xl border border-neutral-200 dark:border-white/5 p-8 rounded-[2rem] shadow-2xl relative">
                    {/* Method Toggle */}
                    <div className="flex p-1 bg-white/80 dark:bg-black/40 rounded-full mb-8 border border-neutral-200 dark:border-white/5">
                        <button 
                            onClick={() => { setAuthMethod('phone'); setIdentifier(''); }}
                            className={`flex-1 py-3 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                authMethod === 'phone' ? 'bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white shadow-lg shadow-[#FF6B6B]/30' : 'text-black hover:text-black'
                            }`}
                        >
                            <Phone size={14} /> Mobile
                        </button>
                        <button 
                            onClick={() => { setAuthMethod('email'); setIdentifier(''); }}
                            className={`flex-1 py-3 rounded-full text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                authMethod === 'email' ? 'bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white shadow-lg shadow-[#FF6B6B]/30' : 'text-black hover:text-black'
                            }`}
                        >
                            <Mail size={14} /> Email
                        </button>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-black ml-2">
                                {authMethod === 'phone' ? 'Mobile Number' : 'Email Address'}
                            </label>
                            <div className="relative group">
                                {authMethod === 'phone' ? (
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                ) : (
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                )}
                                <input 
                                    type={authMethod === 'phone' ? 'tel' : 'email'}
                                    required
                                    className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all placeholder:text-black text-sm font-medium"
                                    placeholder={authMethod === 'phone' ? '98765 43210' : 'name@restaurant.com'}
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-black ml-2">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                <input 
                                    type="password"
                                    required
                                    className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all placeholder:text-black text-sm font-medium"
                                    placeholder="••••••"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit"
                            disabled={loading || !identifier || !pin}
                            className="w-full py-4 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed rounded-full font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl shadow-[#FF6B6B]/25 text-white"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                <>
                                    Log In 
                                    <ArrowRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="relative py-8">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-white/5"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] items-center text-center uppercase tracking-[0.2em]">
                            <span className="bg-white dark:bg-neutral-900 px-4 text-black font-bold">Or connect with</span>
                        </div>
                    </div>

                    <button 
                        onClick={handleGoogleLogin}
                        type="button"
                        className="w-full flex items-center justify-center gap-3 py-4 bg-white text-black rounded-full font-bold hover:bg-neutral-100 transition-all active:scale-[0.98] shadow-lg text-sm"
                    >
                        <svg height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285f4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34a853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#fbbc05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.63l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ea4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
                        Continue with Google
                    </button>
                </div>

                <div className="mt-8 text-center pt-4">
                    <p className="text-black text-sm font-medium">
                        New to the platform? {' '}
                        <Link href="/register" className="text-[#FF6B6B] font-bold hover:underline transition-all">
                            Register Restaurant
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
