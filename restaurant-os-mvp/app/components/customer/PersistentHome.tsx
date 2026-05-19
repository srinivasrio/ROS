'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { HomepageBuilderService } from '@/app/services/homepage-builder.service';
import { HomepageCache } from '@/app/services/homepage-cache.service';
import { OrderService } from '@/app/services/orders';
import SharedHomepageLayout from '@/app/components/shared/homepage/SharedHomepageLayout';
import { SharedSkeleton } from '@/app/components/customer/SharedSkeleton';
import { useCartSafe } from '@/app/context/CartContext';
import { usePathname } from 'next/navigation';

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
    
    const isFirstRun = useRef(true);
    const scrollPos = useRef(0);

    const loadData = useCallback(async (showLoading = false) => {
        if (showLoading && !HomepageCache.get(restaurantId, tableNumber)) {
            setLoading(true);
        }

        try {
            const homepageData = await HomepageBuilderService.getHomepageData(restaurantId, tableNumber);
            HomepageCache.set(restaurantId, tableNumber, homepageData);

            setProfile(homepageData.profile);
            setTheme(homepageData.theme);
            setSections(homepageData.sections);
            setData(homepageData);

            const tableData = await OrderService.findTableAnywhere(tableNumber, restaurantId);
            if (tableData) {
                setDisplayTableNumber(tableData.display_name?.replace('Table ', '') || tableData.table_number?.toString() || tableNumber);
            }
        } catch (err: any) {
            console.error('Failed to load persistent home data:', err);
        } finally {
            setLoading(false);
        }
    }, [restaurantId, tableNumber]);

    useEffect(() => {
        loadData(isFirstRun.current && !cachedData);
        isFirstRun.current = false;
    }, [loadData, cachedData]);

    // Handle scroll persistence
    useEffect(() => {
        if (!isVisible) return;
        
        // Restore scroll
        window.scrollTo(0, scrollPos.current);

        const handleScroll = () => {
            if (isVisible) {
                scrollPos.current = window.scrollY;
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [isVisible]);

    const cartContext = useCartSafe();
    const addToCart = useCallback((item: any, qty: number) => cartContext?.addToCart?.(item, qty), [cartContext]);
    const updateQuantity = useCallback((itemId: string, delta: number) => cartContext?.updateQuantity?.(itemId, delta), [cartContext]);
    const getItemQtyInCart = useCallback((itemId: string) => cartContext?.getItemQtyInCart?.(itemId) || 0, [cartContext]);
    const addSpecialToCart = useCallback((item: any) => cartContext?.addSpecialToCart?.(item), [cartContext]);

    // If not visible, we still render it but hidden to keep state alive
    return (
        <div style={{ display: isVisible ? 'block' : 'none' }}>
            {!data ? (
                <SharedSkeleton type="home" />
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
