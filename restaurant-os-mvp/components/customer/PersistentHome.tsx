'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { HomepageCache } from '@/services/homepage-cache.service';
import { OrderService } from '@/services/orders.service';
import SharedHomepageLayout from '@/components/shared/homepage/SharedHomepageLayout';
import HomepageSkeleton from '@/components/shared/homepage/HomepageSkeleton';
import { SharedSkeleton } from '@/components/customer/SharedSkeleton';
import { useCartSafe } from '@/context/CartContext';
import { usePathname } from 'next/navigation';
import { Utensils as LucideUtensils, AlertCircle as LucideAlertCircle } from 'lucide-react';

export function PersistentHome({ restaurantId, tableNumber }: { restaurantId: string, tableNumber: string }) {
    const pathname = usePathname();
    const isVisible = pathname.includes('/home/');
    
    // Cache the data
    const cachedData = HomepageCache.get(restaurantId, tableNumber);
    const [loading, setLoading] = useState(!cachedData);
    const [data, setData] = useState<any>(cachedData);
    const [profile, setProfile] = useState<any>(cachedData?.profile || null);
    const [theme, setTheme] = useState<any>(cachedData?.theme || null);
    const [sections, setSections] = useState<any>(cachedData?.sections || []);
    const [displayTableNumber, setDisplayTableNumber] = useState(tableNumber);
    const [tableNotFound, setTableNotFound] = useState(false);
    
    const isFirstRun = useRef(true);
    const scrollPos = useRef(0);

    const loadData = useCallback(async (showLoading = false) => {
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
            HomepageCache.set(restaurantId, tableNumber, homepageData);

            setProfile(homepageData.profile);
            setTheme(homepageData.theme);
            setSections(homepageData.sections);
            setData(homepageData);
        } catch (err: any) {
            console.error('Failed to load persistent home data:', err);
        } finally {
            setLoading(false);
        }
    }, [restaurantId, tableNumber]);

    useEffect(() => {
        loadData(isFirstRun.current && !cachedData);
        isFirstRun.current = false;
    }, [loadData]);

    useEffect(() => {
        if (!isVisible) return;

        let active = true;
        let sub: any = null;

        const setupSubs = async () => {
            try {
                sub = await HomepageBuilderService.subscribeToAll(restaurantId, (table, payload) => {
                    if (active && document.visibilityState === 'visible') {
                        loadData(false);
                    }
                });
                if (!active && sub) sub.unsubscribe();
            } catch (err) {
                console.error('Failed to setup homepage subscriptions:', err);
            }
        };

        let lastVisibilityFetch = Date.now();
        const handleVisibilityChange = () => {
            if (active && document.visibilityState === 'visible') {
                const now = Date.now();
                // Only re-query on tab focus if more than 45s elapsed since last sync
                if (now - lastVisibilityFetch > 45000) {
                    lastVisibilityFetch = now;
                    loadData(false);
                }
            }
        };

        setupSubs();
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            active = false;
            if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [restaurantId, loadData, isVisible]);

    // Handle scroll persistence
    useEffect(() => {
        if (!isVisible) return;
        
        const container = document.getElementById('customer-scroll-container');
        if (container) {
            container.scrollTop = scrollPos.current;

            const handleScroll = () => {
                if (isVisible) {
                    scrollPos.current = container.scrollTop;
                }
            };

            container.addEventListener('scroll', handleScroll, { passive: true });
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [isVisible]);

    const cartContext = useCartSafe();
    const addToCart = useCallback((item: any, qty: number) => cartContext?.addToCart?.(item, qty), [cartContext]);
    const updateQuantity = useCallback((itemId: string, delta: number) => cartContext?.updateQuantity?.(itemId, delta), [cartContext]);
    const getItemQtyInCart = useCallback((itemId: string) => cartContext?.getItemQtyInCart?.(itemId) || 0, [cartContext]);
    const addSpecialToCart = useCallback((item: any) => cartContext?.addSpecialToCart?.(item), [cartContext]);

    // If not visible, we still render it but hidden to keep state alive
    // Use visibility:hidden + height:0 instead of display:none so Next.js Image
    // fill components maintain their layout dimensions and don't flash blank on re-show
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
                    onClick={() => loadData(true)}
                    className="py-3.5 px-8 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20 text-sm cursor-pointer"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div style={isVisible ? undefined : { visibility: 'hidden' as const, height: 0, overflow: 'hidden', pointerEvents: 'none' as const }}>
            {!data ? (
                <HomepageSkeleton />
            ) : (
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
            )}
        </div>
    );
}
