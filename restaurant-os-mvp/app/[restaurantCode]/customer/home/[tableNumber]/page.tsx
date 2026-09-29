'use client';

import { useEffect, useState, useCallback, use, useRef } from 'react';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { HomepageCache } from '@/services/homepage-cache.service';
import { OrderService } from '@/services/orders.service';
import SharedHomepageLayout from '@/components/shared/homepage/SharedHomepageLayout';
import HomepageSkeleton from '@/components/shared/homepage/HomepageSkeleton';
import { SharedSkeleton } from '@/components/customer/SharedSkeleton';
import { useCartSafe } from '@/context/CartContext';
import { useRouter } from 'next/navigation';
import { Utensils as LucideUtensils, AlertCircle as LucideAlertCircle } from 'lucide-react';

export default function CustomerHome({ params: paramsPromise }: any) {
    const params: any = use(paramsPromise);
    const { restaurantCode: restaurantId, tableNumber } = params;
    
    // Attempt to initialize from cache immediately
    const cachedData = HomepageCache.get(restaurantId, tableNumber);
    
    const [loading, setLoading] = useState(!cachedData);
    const [data, setData] = useState<any>(cachedData);
    const [profile, setProfile] = useState<any>(cachedData?.profile || null);
    const [theme, setTheme] = useState<any>(cachedData?.theme || null);
    const [sections, setSections] = useState<any>(cachedData?.sections || []);
    const [displayTableNumber, setDisplayTableNumber] = useState(tableNumber);
    const [tableNotFound, setTableNotFound] = useState(false);
    
    const isFirstRun = useRef(true);

    const loadData = useCallback(async (showLoading = false) => {
        // Only show loading if we don't have cached data
        if (showLoading && !HomepageCache.get(restaurantId, tableNumber)) {
            setLoading(true);
        }

        const normalized = String(tableNumber || '').trim().toLowerCase();
        const isVirtualMode = normalized === 'takeaway' || normalized === 'delivery';

        try {
            if (isVirtualMode) {
                setDisplayTableNumber(normalized === 'takeaway' ? 'Takeaway' : 'Delivery');
                setTableNotFound(false);
            } else {
                const tableData = await OrderService.findTableAnywhere(tableNumber, restaurantId);
                if (tableData) {
                    setDisplayTableNumber(tableData.display_name?.replace('Table ', '') || tableData.table_number?.toString() || tableNumber);
                    setTableNotFound(false);
                } else {
                    setTableNotFound(true);
                    setLoading(false);
                    return;
                }
            }

            const homepageData = await HomepageBuilderService.getHomepageData(restaurantId, tableNumber);

            // Update cache
            HomepageCache.set(restaurantId, tableNumber, homepageData);

            // Update state
            setProfile(homepageData.profile);
            setTheme(homepageData.theme);
            setSections(homepageData.sections);
            setData(homepageData);
        } catch (err: any) {
            console.error('Failed to load homepage data:', err);
        } finally {
            setLoading(false);
        }
    }, [restaurantId, tableNumber]);

    useEffect(() => {
        // Initial load
        loadData(isFirstRun.current && !cachedData);
        isFirstRun.current = false;
    }, [loadData]);

    useEffect(() => {
        let active = true;
        let sub: any = null;

        const setupSubs = async () => {
            try {
                sub = await HomepageBuilderService.subscribeToAll(restaurantId, (table, payload) => {
                    console.log(`Real-time update from ${table}:`, payload);
                    if (active && document.visibilityState === 'visible') {
                        loadData(false); // Background refresh only when visible
                    }
                });
                if (!active && sub) sub.unsubscribe();
            } catch (err) {
                console.error('Failed to setup subscriptions:', err);
            }
        };

        let lastVisFetch = Date.now();
        const handleVisibilityChange = () => {
            if (active && document.visibilityState === 'visible') {
                const now = Date.now();
                if (now - lastVisFetch > 45000) {
                    lastVisFetch = now;
                    loadData(false);
                }
            }
        };

        setupSubs();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            active = false;
            if (sub?.unsubscribe) sub.unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [restaurantId, loadData]);

    const cartContext = useCartSafe();
    const router = useRouter();

    const addToCart = useCallback((item: any, qty: number) => {
        cartContext?.addToCart?.(item, qty);
    }, [cartContext]);

    const updateQuantity = useCallback((itemId: string, delta: number) => {
        cartContext?.updateQuantity?.(itemId, delta);
    }, [cartContext]);

    const getItemQtyInCart = useCallback((itemId: string) => {
        return cartContext?.getItemQtyInCart?.(itemId) || 0;
    }, [cartContext]);
    
    const addSpecialToCart = useCallback((item: any) => {
        cartContext?.addSpecialToCart?.(item);
    }, [cartContext]);

    // Use cached rendering if available even while loading fresh data
    if (loading && !data) {
        return <HomepageSkeleton />;
    }

    if (!profile || !data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto">
                        <svg className="w-10 h-10 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-xl font-bold text-black">Unable to Load Menu</h2>
                        <p className="text-black">We're having trouble connecting to the restaurant's server. Please check your connection and try again.</p>
                    </div>
                    <button 
                        onClick={() => loadData(true)}
                        className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 active:scale-[0.98] transition-transform"
                    >
                        Retry Loading
                    </button>
                </div>
            </div>
        );
    }

    if (tableNotFound) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
                <div className="w-20 h-20 bg-rose-50 border border-rose-100 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-rose-500/10">
                    <LucideUtensils className="text-rose-500" size={36} />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-bold uppercase tracking-wider mb-4">
                    <LucideAlertCircle size={14} />
                    <span>Table Not Found</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                    No table named &ldquo;{tableNumber}&rdquo; in this restaurant
                </h2>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed max-w-xs">
                    Table <span className="font-bold text-slate-800">{tableNumber}</span> does not exist or has not been created by the restaurant admin. Customers can only view the menu and place orders from valid, admin-created tables.
                </p>
                <button 
                    onClick={() => window.location.reload()}
                    className="py-3.5 px-8 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20 text-sm cursor-pointer"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <SharedHomepageLayout 
            mode="customer"
            restaurantId={restaurantId}
            tableNumber={displayTableNumber}
            profile={profile}
            theme={theme}
            sections={sections}
            data={data}
            addToCart={addToCart}
            updateQuantity={updateQuantity}
            getItemQtyInCart={getItemQtyInCart}
            addSpecialToCart={addSpecialToCart}
        />
    );
}
