"use client";

import { motion } from "framer-motion";
import { Clock, ShieldCheck, Mail, ArrowLeft, LogOut, Phone } from "lucide-react";
import Link from "next/link";
import { UserService } from "@/app/services/users";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/landing/Navbar";

const WaitingApproval = () => {
    const router = useRouter();

    const handleSignOut = async () => {
        await UserService.signOut();
        router.push("/");
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 pt-24 relative overflow-hidden">
            <Navbar />
            {/* Background Effects to match public page */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-[#FF6B6B]/10 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#4ECDC4]/10 rounded-full blur-[120px] translate-x-1/4 translate-y-1/4" />

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-w-md w-full bg-white/60 dark:bg-neutral-900/60 backdrop-blur-3xl border border-neutral-200 dark:border-white/5 rounded-[2.5rem] p-8 md:p-10 shadow-2xl text-center relative z-10"
            >
                <motion.div 
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="w-20 h-20 bg-gradient-to-br from-[#FF6B6B] to-[#FF8E53] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-[#FF6B6B]/30"
                >
                    <Clock className="w-10 h-10 text-white animate-[spin_12s_linear_infinite]" />
                </motion.div>

                <h1 className="text-3xl font-black mb-3 text-foreground" >
                    Application <span className="text-[#FF6B6B]">Pending</span>
                </h1>
                
                <p className="text-black dark:text-black text-base mb-8 leading-relaxed font-medium" >
                    Welcome to the <span className="text-foreground font-bold">Dine In One</span> family! 
                    Our administrators are currently reviewing your restaurant's details.
                </p>

                <div className="space-y-3 mb-8 text-left">
                    <div className="flex gap-4 p-4 rounded-2xl bg-white dark:bg-white/5 border border-neutral-100 dark:border-white/5 shadow-sm">
                        <div className="w-12 h-12 rounded-xl bg-[#FF6B6B]/10 flex items-center justify-center shrink-0">
                            <ShieldCheck className="w-6 h-6 text-[#FF6B6B]" />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-foreground">Security Audit</h4>
                            <p className="text-[11px] text-black font-medium">Verification of ownership and licenses.</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-4 p-4 rounded-2xl bg-white dark:bg-white/5 border border-neutral-100 dark:border-white/5 shadow-sm">
                        <div className="w-12 h-12 rounded-xl bg-[#4ECDC4]/10 flex items-center justify-center shrink-0">
                            <Phone className="w-6 h-6 text-[#4ECDC4]" />
                        </div>
                        <div>
                            <h4 className="font-bold text-sm text-foreground">SMS Notification</h4>
                            <p className="text-[11px] text-black font-medium">You'll receive an SMS as soon as access is granted.</p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full py-5 bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] text-white font-black rounded-full hover:opacity-90 transition-all active:scale-[0.98] shadow-xl shadow-[#FF6B6B]/30"
                    >
                        Check Status Again
                    </button>
                    
                    <button 
                        onClick={handleSignOut}
                        className="flex items-center justify-center gap-2 text-black hover:text-white transition-colors py-2 font-bold text-sm mt-2"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-8 right-8 w-2 h-2 rounded-full bg-[#FF6B6B] animate-ping" />
            </motion.div>

            <footer className="mt-12 text-black text-sm flex items-center gap-6 relative z-10" >
                <Link href="/" className="hover:text-black transition-colors font-medium">Public Website</Link>
                <div className="w-1.5 h-1.5 bg-neutral-800 rounded-full" />
                <Link href="#" className="hover:text-black transition-colors font-medium">Support Center</Link>
            </footer>
        </div>
    );
};

export default WaitingApproval;
