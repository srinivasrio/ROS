'use client';

import { useEffect, useState, useCallback, use, useRef } from 'react';
import { HomepageBuilderService } from '@/app/services/homepage-builder.service';
import { HomepageCache } from '@/app/services/homepage-cache.service';
import { OrderService } from '@/app/services/orders';
import SharedHomepageLayout from '@/app/components/shared/homepage/SharedHomepageLayout';
import { SharedSkeleton } from '@/app/components/customer/SharedSkeleton';
import { useCartSafe } from '@/app/context/CartContext';
import { useRouter } from 'next/navigation';

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
    
    const isFirstRun = useRef(true);

    const loadData = useCallback(async (showLoading = false) => {
        // Only show loading if we don't have cached data
        if (showLoading && !HomepageCache.get(restaurantId, tableNumber)) {
            setLoading(true);
        }

        try {
            const homepageData = await HomepageBuilderService.getHomepageData(restaurantId, tableNumber);

            // Update cache
            HomepageCache.set(restaurantId, tableNumber, homepageData);

            // Update state
            setProfile(homepageData.profile);
            setTheme(homepageData.theme);
            setSections(homepageData.sections);
            setData(homepageData);

            // Background table resolution
            const tableData = await OrderService.findTableAnywhere(tableNumber, restaurantId);
            if (tableData) {
                setDisplayTableNumber(tableData.display_name || tableData.table_number?.toString() || tableNumber);
            }
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
    }, [loadData, cachedData]);

    useEffect(() => {
        let active = true;
        let sub: any = null;

        const setupSubs = async () => {
            try {
                sub = await HomepageBuilderService.subscribeToAll(restaurantId, (table, payload) => {
                    console.log(`Real-time update from ${table}:`, payload);
                    if (active) loadData(false); // Background refresh
                });
                if (!active && sub) sub.unsubscribe();
            } catch (err) {
                console.error('Failed to setup subscriptions:', err);
            }
        };

        setupSubs();

        return () => {
            active = false;
            if (sub?.unsubscribe) sub.unsubscribe();
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
        return <SharedSkeleton type="home" />;
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
