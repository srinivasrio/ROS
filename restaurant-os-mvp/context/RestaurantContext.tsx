'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserService, UserProfile } from '@/services/users.service';
import { RestaurantService } from '@/services/restaurant.service';
import { useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';

export type BusinessType = 'restaurant' | 'bar' | 'restaurant_bar';

export interface FeatureFlags {
    enable_restaurant_module: boolean;
    enable_bar_module: boolean;
}

interface RestaurantContextType {
    restaurantId: string | null;
    restaurantName: string | null;
    businessType: BusinessType;
    featureFlags: FeatureFlags;
    user: UserProfile | null;
    loading: boolean;
    refreshProfile: () => Promise<void>;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

export function RestaurantProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const router = useRouter();
    const pathname = usePathname();
    const [businessType, setBusinessType] = useState<BusinessType>('restaurant');

    const urlRestaurantIdFromPath = pathname?.split('/')[1] || null;
    const isTenantId = urlRestaurantIdFromPath && (
        /^\d+$/.test(urlRestaurantIdFromPath) || 
        /^(REST|PEND)-/i.test(urlRestaurantIdFromPath) ||
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(urlRestaurantIdFromPath)
    );

    const [resolvedRestaurantId, setResolvedRestaurantId] = useState<string | null>(urlRestaurantIdFromPath);
    const [loading, setLoading] = useState(!isTenantId);

    const userRef = React.useRef<UserProfile | null>(null);
    userRef.current = user;
    const lastScopeRef = React.useRef<string>('');

    const fetchProfile = React.useCallback(async (force = false) => {
        const segments = pathname?.split('/').filter(Boolean) || [];
        let staffMobile: string | null = null;
        if (segments.length > 2 && (segments[1] === 'waiter' || segments[1] === 'staff')) {
            staffMobile = segments[2];
        }
        const currentScope = `${urlRestaurantIdFromPath || ''}_${staffMobile || ''}`;

        // Skip redundant re-fetching if the restaurant/staff scope hasn't changed
        if (!force && lastScopeRef.current === currentScope && userRef.current) {
            setLoading(false);
            return;
        }

        try {
            lastScopeRef.current = currentScope;
            const profile = await UserService.getCurrentProfile(urlRestaurantIdFromPath, staffMobile);
            if (profile) {
                setUser(profile);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Error in RestaurantProvider:', error);
        } finally {
            setLoading(false);
        }
    }, [urlRestaurantIdFromPath, pathname]);

    useEffect(() => {
        if (urlRestaurantIdFromPath && !isTenantId) {
            RestaurantService.resolveRestaurantId(urlRestaurantIdFromPath).then(id => {
                setResolvedRestaurantId(id);
            });
        } else {
            setResolvedRestaurantId(urlRestaurantIdFromPath);
        }
    }, [urlRestaurantIdFromPath, isTenantId]);

    useEffect(() => {
        const fetchBusinessType = async () => {
            const id = user?.restaurant_id || (isTenantId ? urlRestaurantIdFromPath : resolvedRestaurantId);
            if (id) {
                const type = await RestaurantService.getBusinessType(id);
                setBusinessType(type);
            }
        };
        fetchBusinessType();
    }, [user?.restaurant_id, resolvedRestaurantId, isTenantId, urlRestaurantIdFromPath]);

    const featureFlags: FeatureFlags = React.useMemo(() => ({
        enable_restaurant_module: businessType === 'restaurant' || businessType === 'restaurant_bar',
        enable_bar_module: businessType === 'bar' || businessType === 'restaurant_bar'
    }), [businessType]);

    useEffect(() => {
        const isPublicPage = pathname === '/' || pathname === '/login' || pathname === '/register' || pathname.startsWith('/home');
        if (!isPublicPage) {
            fetchProfile();
        } else {
            setLoading(false);
        }
    }, [pathname, fetchProfile]);

    const activeRestaurantId = (isTenantId ? urlRestaurantIdFromPath : resolvedRestaurantId) || user?.restaurant_id || null;
    const activeRestaurantName = user?.restaurant_name || null;

    const value = React.useMemo(() => ({
        restaurantId: activeRestaurantId,
        restaurantName: activeRestaurantName,
        businessType,
        featureFlags,
        user,
        loading,
        refreshProfile: () => fetchProfile(true)
    }), [activeRestaurantId, activeRestaurantName, businessType, featureFlags, user, loading, fetchProfile]);

    return (
        <RestaurantContext.Provider value={value}>
            {children}
        </RestaurantContext.Provider>
    );
}

export function useRestaurant() {
    const context = useContext(RestaurantContext);
    if (context === undefined) {
        throw new Error('useRestaurant must be used within a RestaurantProvider');
    }
    return context;
}
