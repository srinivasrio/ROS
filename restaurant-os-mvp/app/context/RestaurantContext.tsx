'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UserService, UserProfile } from '@/app/services/users';
import { RestaurantService } from '@/app/services/restaurant.service';
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
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const [resolvedRestaurantId, setResolvedRestaurantId] = useState<string | null>(null);
    const [businessType, setBusinessType] = useState<BusinessType>('restaurant');

    const fetchProfile = async () => {
        try {
            // Only trigger a hard loading state if we don't have a user yet
            // This prevents the "App still loading" flash on every navigation
            if (!user) setLoading(true);
            
            const profile = await UserService.getCurrentProfile();
            
            if (profile) {
                setUser(profile);
                
                // If user is logged in but has no restaurant_id and is not a SaaS admin, 
                // they might need to be redirected or warned.
                if (!profile.restaurant_id && profile.role !== 'saas_admin' && !pathname.includes('/waiting-approval')) {
                    console.warn('User logged in but has no restaurant_id');
                }
            } else {
                setUser(null);
                // If on a protected route, redirect to login is handled by middleware usually,
                // but we can also handle session expiration here.
            }
        } catch (error) {
            console.error('Error in RestaurantProvider:', error);
            toast.error('Failed to load restaurant environment');
        } finally {
            setLoading(false);
        }
    };

    // Derive restaurantId from URL if profile not loaded yet (for anonymous customers)
    const urlRestaurantIdFromPath = pathname?.split('/')[1] || null;
    const isTenantId = urlRestaurantIdFromPath && (/^\d+$/.test(urlRestaurantIdFromPath) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(urlRestaurantIdFromPath));

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
        // Skip profile fetch for purely public landing pages if needed, 
        // but for staff panels it's mandatory.
        const isPublicPage = pathname === '/' || pathname === '/login' || pathname === '/register' || pathname.startsWith('/home');
        
        if (!isPublicPage) {
            fetchProfile();
        } else {
            setLoading(false);
        }
    }, [pathname]);
    const value = React.useMemo(() => ({
        restaurantId: user?.restaurant_id || (isTenantId ? urlRestaurantIdFromPath : resolvedRestaurantId),
        restaurantName: user?.restaurant_name || null,
        businessType,
        featureFlags,
        user,
        loading,
        refreshProfile: fetchProfile
    }), [user, isTenantId, urlRestaurantIdFromPath, resolvedRestaurantId, businessType, featureFlags, loading, fetchProfile]);

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
