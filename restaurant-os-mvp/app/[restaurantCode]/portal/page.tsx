"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChefHat as LucideChefHat, LayoutDashboard as LucideLayoutDashboard, UserCheck as LucideUserCheck, ShieldAlert as LucideShieldAlert, LogOut, ShoppingBag as LucideShoppingBag } from 'lucide-react';
import { UserService, UserProfile } from '@/app/services/users';
import { RestaurantService } from '@/app/services/restaurant.service';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function Home() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessError, setAccessError] = useState<string | null>(null);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [defaultTable, setDefaultTable] = useState<string>('1');
    const router = useRouter();
    const params = useParams();
    const restaurantCode = params.restaurantCode as string;

    const handleLogout = () => setShowLogoutModal(true);

    const confirmLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    useEffect(() => {
        const checkRole = async () => {
            try {
                const userProfile = await UserService.getCurrentProfile();
                setProfile(userProfile);
                
                if (!userProfile) {
                    // Authenticated but no profile = Incomplete Registration
                    router.push('/register');
                    return;
                }

                // Security check: Ensure user belongs to this restaurant
                const resolvedId = await RestaurantService.resolveRestaurantId(restaurantCode);
                
                // Allow saas_admin to bypass this check
                if (userProfile.role !== 'saas_admin' && userProfile.restaurant_id !== resolvedId) {
                    console.error('Restaurant ID mismatch:', { userProfileId: userProfile.restaurant_id, resolvedId, restaurantCode });
                    setAccessError("You don't have access to this restaurant's portal.");
                    setLoading(false);
                    return;
                }

                // Fetch first table to determine default table number
                let defaultTab = '1';
                try {
                    const { data: tablesData } = await supabase
                        .from('tables')
                        .select('table_number, id')
                        .eq('restaurant_id', resolvedId)
                        .limit(1);
                    if (tablesData && tablesData.length > 0) {
                        defaultTab = tablesData[0].table_number || String(tablesData[0].id) || '1';
                    }
                } catch (tableErr) {
                    console.error("Failed to fetch default table", tableErr);
                }
                setDefaultTable(defaultTab);
                
                // If not an admin, auto-redirect to their specific panel
                if (userProfile.role === 'waiter') {
                    router.push(`/${restaurantCode}/waiter/${userProfile.phone || 'default'}/dashboard`);
                } else if (userProfile.role === 'kitchen') {
                    router.push(`/${restaurantCode}/kds`);
                } else if (userProfile.role === 'customer') {
                    router.push(`/${restaurantCode}/customer/home/${defaultTab}`);
                }
            } catch (err) {
                console.error("Failed to load profile", err);
                setAccessError("Failed to identify your role.");
            } finally {
                setLoading(false);
            }
        };
        checkRole();
    }, [router, restaurantCode]);

    if (loading) {
        return (
            <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4" />
                <p className="text-black font-medium">Identifying your role...</p>
            </div>
        );
    }

    if (accessError) {
        return (
            <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full text-center space-y-6 bg-neutral-900 p-8 rounded-3xl border border-neutral-800 shadow-2xl">
                    <div className="w-20 h-20 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto text-red-500">
                        <LucideShieldAlert size={48} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                        <p className="text-black">
                            {accessError}
                        </p>
                    </div>
                    <button 
                        onClick={confirmLogout}
                        className="mt-6 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors w-full"
                    >
                        Sign Out
                    </button>
                </div>
            </main>
        );
    }

    if (profile?.role === 'saas_admin') {
        return (
            <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full text-center space-y-6 bg-neutral-900 p-8 rounded-3xl border border-neutral-800 shadow-2xl">
                    <div className="w-20 h-20 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto text-orange-500">
                        <LucideShieldAlert size={48} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold mb-2">Wrong Dashboard</h1>
                        <p className="text-black">
                            You are identified as a <span className="text-orange-500 font-bold uppercase">SaaS Admin</span>. 
                            Platform management is restricted to the dedicated SaaS Admin Panel.
                        </p>
                    </div>
                    <div className="pt-4">
                        <p className="text-xs text-black italic">Redirecting to SaaS Admin is not automated to prevent cross-domain issues in local dev.</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <>
        <main className="min-h-screen bg-white text-black flex flex-col items-center justify-center p-4">
            <div className="max-w-4xl w-full">
                <div className="text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
                        Dine in One
                    </h1>
                    <p className="text-black text-lg md:text-xl font-medium">
                        Welcome back, {profile?.name || 'Staff member'}
                    </p>
                    <p className="text-black text-sm mt-2">Verified role: <span className="uppercase font-bold text-orange-500">{profile?.role}</span></p>
                    <button
                        onClick={handleLogout}
                        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-neutral-200 text-black hover:text-red-500 hover:border-red-300 hover:bg-red-50 transition-all text-sm font-semibold"
                    >
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Admin Dashboard - Only for Admins */}
                    {['restaurant_admin'].includes(profile?.role || '') && (
                        <Link
                            href={`/${profile?.restaurant_id || restaurantCode}/admin/dashboard`}
                            className="group relative bg-white border border-neutral-200 rounded-3xl p-8 hover:border-orange-400 hover:shadow-xl hover:shadow-orange-100 transition-all duration-300 shadow-sm"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="p-3 bg-orange-50 text-orange-500 rounded-2xl group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                    <LucideLayoutDashboard size={32} />
                                </div>
                                <span className="text-black group-hover:text-orange-500 transition-colors font-bold text-lg">→</span>
                            </div>
                            <h2 className="text-2xl font-bold mb-2 text-black group-hover:text-orange-500 transition-colors">Admin Portal</h2>
                            <p className="text-black text-sm">Manage menu, staff, tables, and view analytics.</p>
                        </Link>
                    )}
                    {/* Waiter Dashboard - For Admins and Waiters */}
                    {['restaurant_admin', 'waiter'].includes(profile?.role || '') && (
                        <Link
                            href={`/${profile?.restaurant_id || restaurantCode}/waiter/dashboard`}
                            className="group relative bg-white border border-neutral-200 rounded-3xl p-8 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-100 transition-all duration-300 shadow-sm"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="p-3 bg-blue-50 text-blue-500 rounded-2xl group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                    <LucideUserCheck size={32} />
                                </div>
                                <span className="text-black group-hover:text-blue-500 transition-colors font-bold text-lg">→</span>
                            </div>
                            <h2 className="text-2xl font-bold mb-2 text-black group-hover:text-blue-500 transition-colors">Waiter Panel</h2>
                            <p className="text-black text-sm">Take orders, manage tables, and track status.</p>
                        </Link>
                    )}

                    {/* Kitchen Display - For Admins and Kitchen */}
                    {['restaurant_admin', 'kitchen'].includes(profile?.role || '') && (
                        <Link
                            href={`/${profile?.restaurant_id || restaurantCode}/kds`}
                            className="group relative bg-white border border-neutral-200 rounded-3xl p-8 hover:border-green-400 hover:shadow-xl hover:shadow-green-100 transition-all duration-300 shadow-sm"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="p-3 bg-green-50 text-green-500 rounded-2xl group-hover:bg-green-500 group-hover:text-white transition-colors">
                                    <LucideChefHat size={32} />
                                </div>
                                <span className="text-black group-hover:text-green-500 transition-colors font-bold text-lg">→</span>
                            </div>
                            <h2 className="text-2xl font-bold mb-2 text-black group-hover:text-green-500 transition-colors">Kitchen Display</h2>
                            <p className="text-black text-sm">View incoming orders and manage preparation.</p>
                        </Link>
                    )}

                    {/* Customer Portal - For Admins and Customers */}
                    {['restaurant_admin', 'customer'].includes(profile?.role || '') && (
                        <Link
                            href={`/${profile?.restaurant_id || restaurantCode}/customer/home/${defaultTable}`}
                            className="group relative bg-white border border-neutral-200 rounded-3xl p-8 hover:border-purple-400 hover:shadow-xl hover:shadow-purple-100 transition-all duration-300 shadow-sm"
                        >
                            <div className="flex items-center justify-between mb-8">
                                <div className="p-3 bg-purple-50 text-purple-500 rounded-2xl group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                    <LucideShoppingBag size={32} />
                                </div>
                                <span className="text-black group-hover:text-purple-500 transition-colors font-bold text-lg">→</span>
                            </div>
                            <h2 className="text-2xl font-bold mb-2 text-black group-hover:text-purple-500 transition-colors">Customer Portal</h2>
                            <p className="text-black text-sm">Browse menu, place orders, and call for service.</p>
                        </Link>
                    )}
                </div>

                <div className="mt-16 text-center text-black text-sm">
                    <p>© 2024 Dine in One. All rights reserved.</p>
                </div>
            </div>
        </main>

            {/* Logout Confirmation Modal */}
            <AnimatePresence>
                {showLogoutModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        {/* Backdrop */}
                        <div
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={() => setShowLogoutModal(false)}
                        />

                        {/* Modal Card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
                            className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center"
                        >
                            {/* Icon */}
                            <div className="mx-auto mb-5 w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                                <LogOut size={28} className="text-red-500" />
                            </div>

                            {/* Title */}
                            <h3 className="text-xl font-bold text-black mb-2">
                                Logout
                            </h3>

                            {/* Message */}
                            <p className="text-black text-sm mb-8">
                                Are you sure you want to sign out? You&apos;ll need to log in again to access the portal.
                            </p>

                            {/* Buttons */}
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowLogoutModal(false)}
                                    className="flex-1 py-3 px-4 rounded-xl border border-neutral-200 text-black font-semibold text-sm hover:bg-neutral-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmLogout}
                                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold text-sm hover:from-red-600 hover:to-red-700 transition-all shadow-lg shadow-red-200"
                                >
                                    Yes, Logout
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
