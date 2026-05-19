'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Store, User, Phone, MapPin, Building2, FileText, Clock, CreditCard, CheckCircle2, ArrowRight, ArrowLeft, Loader2, ShieldCheck, Calendar, Mail, Lock } from 'lucide-react';
import { RegistrationService, GlobalRegistrationData, MultiRestaurantData } from '@/app/services/registration';
import { UserService } from '@/app/services/users';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from "@/app/components/landing/Navbar";
import { supabase } from '@/lib/supabase';

const STEPS = [
    { title: 'Business Type', description: 'Choose your business model', icon: Building2 },
    { title: 'Authentication', description: 'Secure your account', icon: Lock },
    { title: 'Restaurant Info', description: 'Basic profile details', icon: Store },
    { title: 'Compliance', description: 'Legal registrations', icon: ShieldCheck },
    { title: 'Operations', description: 'Timings & Pricing', icon: Clock }
];

export default function RegisterPage() {
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [authMethod, setAuthMethod] = useState<'email' | 'phone'>('phone');
    const [identifier, setIdentifier] = useState(''); // primary auth field
    const [secondaryContact, setSecondaryContact] = useState(''); // the other contact method
    const [password, setPassword] = useState('');
    const [authenticatedUser, setAuthenticatedUser] = useState<any>(null);
    const [openingTime, setOpeningTime] = useState('09:00');
    const [closingTime, setClosingTime] = useState('22:00');
    
    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                // If the user is already authenticated but here, they need to fill profile details
                setAuthenticatedUser(session.user);
                setFormData((prev: any) => ({
                    ...prev,
                    email: session.user.email || prev.email,
                    ownerName: session.user.user_metadata?.full_name || prev.ownerName
                }));
                
                // Set auth method to email if coming from social/existing session
                if (session.user.email) setAuthMethod('email');
                
                // If they are at step 0, automatically move to step 1
                setStep(prev => prev === 0 ? 1 : prev);
            }
        };
        checkSession();
    }, []);
    
    const [formData, setFormData] = useState<any>({
        authMethod: 'phone',
        restaurantName: '',
        ownerName: '',
        mobileNumber: '',
        email: '',
        address: '',
        gstNumber: '',
        fssaiNumber: '',
        shopLicense: '',
        panCard: '',
        businessType: 'Proprietorship',
        serviceType: 'restaurant',
        openingDate: '',
        operatingHours: '',
        selectedPackage: 'Basic'
    });

    const router = useRouter();

    const handleNext = () => setStep(step + 1);
    const handleBack = () => setStep(step - 1);

    const handleGoogleSignup = async () => {
        setLoading(true);
        try {
            const { error } = await UserService.signInWithGoogle();
            if (error) throw error;
        } catch (error: any) {
            toast.error(error.message || 'Google signup failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // Transform single-restaurant form data into GlobalRegistrationData
            const globalData: GlobalRegistrationData = {
                ownerName: formData.ownerName,
                mobileNumber: identifier,
                email: secondaryContact,
                authMethod: 'email',
                selectedPackage: formData.selectedPackage,
                restaurants: [
                    {
                        name: formData.restaurantName,
                        serviceType: formData.serviceType,
                        address: formData.address,
                        openingDate: formData.openingDate,
                        operatingHours: { open: openingTime, close: closingTime },
                        gstNumber: formData.gstNumber,
                        fssaiNumber: formData.fssaiNumber,
                        shopLicense: formData.shopLicense,
                        panCard: formData.panCard,
                        businessType: formData.businessType as any,
                        branches: [
                            {
                                name: 'Main Branch',
                                address: formData.address,
                                phone: identifier,
                                isMain: true
                            }
                        ]
                    }
                ]
            };

            await RegistrationService.registerBusiness(globalData, password);
            
            toast.success('Registration successful! Waiting for admin approval.');
            router.push('/waiting-approval');
        } catch (error: any) {
            toast.error(error.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 pt-12 relative overflow-hidden">
            <Navbar />
            {/* Background Accents to match public page */}
            <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-[#FF6B6B]/10 rounded-full blur-[150px] -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#4ECDC4]/10 rounded-full blur-[150px] translate-x-1/4 translate-y-1/4" />

            <div className="max-w-lg w-full relative z-10 py-2">
                {/* Header */}
                <div className="text-center mb-4">
                    <h1 className="text-2xl font-black tracking-tight mb-1 text-foreground">
                        Register your <span className="text-[#FF6B6B]">Restaurant</span>
                    </h1>
                    <p className="text-black font-medium text-[10px] uppercase tracking-wider">
                        Step {step + 1} of {STEPS.length}: {STEPS[step].title}
                    </p>
                </div>

                {/* Progress Bar */}
                <div className="flex gap-2 mb-4 px-2">
                    {STEPS.map((_, i) => (
                        <div 
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                                i <= step ? 'bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] shadow-glow' : 'bg-white/5'
                            }`}
                        />
                    ))}
                </div>

                <div className="bg-white/60 dark:bg-neutral-900/60 backdrop-blur-2xl border border-neutral-200 dark:border-white/5 p-5 rounded-[2rem] shadow-2xl relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-4"
                        >
                            {/* STEP 0: BUSINESS TYPE SELECTION */}
                            {step === 0 && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 gap-4">
                                        {[
                                            { id: 'restaurant', label: 'Restaurant', desc: 'Dining, Food Menu, Kitchen', icon: Store },
                                            { id: 'bar', label: 'Bar / Pub', desc: 'Liquor, Peg Pricing, Bar Counter', icon: Building2 },
                                            { id: 'restaurant_bar', label: 'Restaurant + Bar', desc: 'Full hybrid model with all features', icon: FileText }
                                        ].map((type) => (
                                            <button
                                                key={type.id}
                                                onClick={() => {
                                                    setFormData({ ...formData, serviceType: type.id as any });
                                                    handleNext();
                                                }}
                                                className={`p-6 rounded-[1.5rem] border-2 transition-all text-left flex items-center gap-4 group ${
                                                    formData.serviceType === type.id 
                                                    ? 'bg-[#FF6B6B]/10 border-[#FF6B6B] shadow-lg shadow-[#FF6B6B]/10' 
                                                    : 'bg-white dark:bg-black/40 border-neutral-200 dark:border-white/5 hover:border-neutral-300 dark:hover:border-white/10'
                                                }`}
                                            >
                                                <div className={`p-3 rounded-xl transition-colors ${formData.serviceType === type.id ? 'bg-[#FF6B6B] text-white' : 'bg-neutral-100 dark:bg-neutral-800 text-black'}`}>
                                                    <type.icon size={24} />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-base">{type.label}</h4>
                                                    <p className="text-xs text-black font-medium">{type.desc}</p>
                                                </div>
                                                <ArrowRight className={`transition-all ${formData.serviceType === type.id ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'}`} size={20} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* STEP 1: AUTHENTICATION */}
                            {step === 1 && (
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        {/* Mobile Number */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-black ml-2">
                                                Mobile Number
                                            </label>
                                            <div className="relative group">
                                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={16} />
                                                <input 
                                                    type="tel"
                                                    className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all placeholder:text-black text-sm font-medium"
                                                    placeholder="98765 43210"
                                                    value={identifier}
                                                    onChange={(e) => setIdentifier(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Email Address */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-black ml-2">
                                                Email Address
                                            </label>
                                            <div className="relative group">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={16} />
                                                <input 
                                                    type="email"
                                                    className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all placeholder:text-black text-sm font-medium"
                                                    placeholder="owner@restaurant.com"
                                                    value={secondaryContact}
                                                    onChange={(e) => setSecondaryContact(e.target.value)}
                                                />
                                            </div>
                                        </div>

                                        {/* Password */}
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-black ml-2">Set Password</label>
                                            <div className="relative group">
                                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={16} />
                                                <input 
                                                    type="password"
                                                    className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all placeholder:text-black text-sm font-medium"
                                                    placeholder="••••••"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative py-1">
                                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5" /></div>
                                        <div className="relative flex justify-center text-[9px] uppercase tracking-[0.2em]"><span className="bg-white dark:bg-neutral-900 px-4 text-black font-bold">Or connect with</span></div>
                                    </div>

                                    <button 
                                        onClick={handleGoogleSignup}
                                        type="button"
                                        className="w-full flex items-center justify-center gap-3 py-3 bg-white text-black rounded-full font-bold hover:bg-neutral-100 transition-all active:scale-[0.98] shadow-lg text-xs"
                                    >
                                        <svg height="16" viewBox="0 0 24 24" width="16" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285f4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34a853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#fbbc05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.63l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ea4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
                                        Signup with Google
                                    </button>
                                </div>
                            )}

                            {/* STEP 2: RESTAURANT PROFILE */}
                            {step === 2 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-black ml-2">Restaurant Name</label>
                                        <div className="relative group">
                                            <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                            <input 
                                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all text-sm font-medium"
                                                value={formData.restaurantName}
                                                onChange={(e) => setFormData({...formData, restaurantName: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-black ml-2">Owner Name(s)</label>
                                        <div className="relative group">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                            <input 
                                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all text-sm font-medium"
                                                value={formData.ownerName}
                                                onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-black ml-2">Full Address</label>
                                        <div className="relative group">
                                            <MapPin className="absolute left-4 top-4 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                            <textarea 
                                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all text-sm font-medium h-24 resize-none"
                                                value={formData.address}
                                                onChange={(e) => setFormData({...formData, address: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-black ml-2">Business Type</label>
                                        <div className="relative group">
                                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                            <select 
                                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all text-sm font-medium appearance-none"
                                                value={formData.businessType}
                                                onChange={(e) => setFormData({...formData, businessType: e.target.value as any})}
                                            >
                                                <option className="bg-[#1a1a1e]">Proprietorship</option>
                                                <option className="bg-[#1a1a1e]">Pvt Ltd</option>
                                                <option className="bg-[#1a1a1e]">Partnership</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-black ml-2">Contact Number</label>
                                        <div className="relative group">
                                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                            <input 
                                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all text-sm font-medium"
                                                value={authMethod === 'phone' ? (identifier || formData.mobileNumber) : (secondaryContact || formData.mobileNumber)}
                                                onChange={(e) => setFormData({...formData, mobileNumber: e.target.value})}
                                                placeholder="98765 43210"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: COMPLIANCE */}
                            {step === 3 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-black ml-2">GST Number</label>
                                        <div className="relative group">
                                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                            <input 
                                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all text-sm font-medium"
                                                value={formData.gstNumber}
                                                onChange={(e) => setFormData({...formData, gstNumber: e.target.value})}
                                                placeholder="22AAAAA0000A1Z5"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-black ml-2">FSSAI License</label>
                                        <div className="relative group">
                                            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                            <input 
                                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all text-sm font-medium"
                                                value={formData.fssaiNumber}
                                                onChange={(e) => setFormData({...formData, fssaiNumber: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-black ml-2">PAN Card (Business/Owner)</label>
                                        <div className="relative group">
                                            <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                            <input 
                                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all text-sm font-medium"
                                                value={formData.panCard}
                                                onChange={(e) => setFormData({...formData, panCard: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-black ml-2">Shop & Establishment License</label>
                                        <div className="relative group">
                                            <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                            <input 
                                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all text-sm font-medium"
                                                value={formData.shopLicense}
                                                onChange={(e) => setFormData({...formData, shopLicense: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: OPERATIONS & PLAN */}
                            {step === 4 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center ml-2">
                                            <label className="text-xs font-bold uppercase tracking-widest text-black">Opening Date</label>
                                            <button 
                                                type="button"
                                                onClick={() => setFormData({...formData, openingDate: new Date().toISOString().split('T')[0]})}
                                                className="text-[10px] font-bold text-[#FF6B6B] hover:underline"
                                            >
                                                Today
                                            </button>
                                        </div>
                                        <div className="relative group">
                                            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                            <input 
                                                type="date"
                                                className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all text-sm font-medium invert-calendar"
                                                value={formData.openingDate}
                                                onChange={(e) => setFormData({...formData, openingDate: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-black ml-2">Operating Hours</label>
                                        <div className="flex gap-2 items-center">
                                            <div className="relative group flex-1">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                                <input 
                                                    type="time"
                                                    className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all text-sm font-medium invert-calendar"
                                                    value={openingTime}
                                                    onChange={(e) => setOpeningTime(e.target.value)}
                                                />
                                            </div>
                                            <span className="text-black font-bold">to</span>
                                            <div className="relative group flex-1">
                                                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-[#FF6B6B] transition-colors" size={18} />
                                                <input 
                                                    type="time"
                                                    className="w-full bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/5 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:border-[#FF6B6B]/50 transition-all text-sm font-medium invert-calendar"
                                                    value={closingTime}
                                                    onChange={(e) => setClosingTime(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="md:col-span-2 space-y-4">
                                        <label className="text-xs font-bold uppercase tracking-widest text-black ml-2">Choose Pricing Plan</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {['Basic', 'Pro', 'Enterprise'].map((pkg) => (
                                                <button
                                                    key={pkg}
                                                    type="button"
                                                    onClick={() => setFormData({...formData, selectedPackage: pkg})}
                                                    className={`p-6 rounded-[1.5rem] border transition-all text-left group ${
                                                        formData.selectedPackage === pkg 
                                                        ? 'bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] border-transparent shadow-xl shadow-[#FF6B6B]/20' 
                                                        : 'bg-white dark:bg-black/40 border-neutral-200 dark:border-white/5 hover:border-neutral-300 dark:hover:border-white/10'
                                                    }`}
                                                >
                                                    <CreditCard className={`mb-3 transition-colors ${formData.selectedPackage === pkg ? 'text-white' : 'text-[#FF6B6B]'}`} size={24} />
                                                    <h4 className="font-bold mb-1">{pkg}</h4>
                                                    <p className={`text-[10px] uppercase tracking-wider ${formData.selectedPackage === pkg ? 'text-white/80' : 'text-black'}`}>Select Plan</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* NAV BUTTONS */}
                            <div className="flex gap-4 pt-6">
                                {step > 0 && (
                                    <button 
                                        onClick={handleBack}
                                        className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-full font-bold flex items-center justify-center gap-2 transition-all border border-white/5 active:scale-[0.98]"
                                    >
                                        <ArrowLeft size={20} /> Back
                                    </button>
                                )}
                                <button 
                                    onClick={step === STEPS.length - 1 ? handleSubmit : handleNext}
                                    disabled={loading || (step === 1 && (!identifier || !secondaryContact || !password))}
                                    className={`flex-[2] py-4 rounded-full font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-xl text-white ${
                                        loading || (step === 0 && !password) ? 'bg-neutral-800 cursor-not-allowed opacity-50' : 'bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] shadow-[#FF6B6B]/20'
                                    }`}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                        <>
                                            {step === STEPS.length - 1 ? 'Complete Registration' : 'Next Step'} 
                                            <ArrowRight size={20} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Footer link */}
                <div className="mt-4 text-center border-t border-white/5 pt-4">
                    <p className="text-black text-sm font-medium">
                        Already have an account? {' '}
                        <Link href="/login" className="text-[#FF6B6B] font-bold hover:underline transition-all">
                            Log In
                        </Link>
                    </p>
                </div>
            </div>
            
            <style jsx global>{`
                .shadow-glow { box-shadow: 0 0 15px rgba(255, 107, 107, 0.4); }
                .invert-calendar::-webkit-calendar-picker-indicator { filter: invert(1); }
            `}</style>
        </div>
    );
}
