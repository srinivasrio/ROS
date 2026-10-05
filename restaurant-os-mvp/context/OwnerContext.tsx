'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export interface RestaurantItem {
    id: string;
    restaurant_id?: string;
    branch_id?: string;
    internal_id?: string;
    name: string;
    code?: string;
    status: string;
    phone?: string;
    email?: string;
    address?: any;
    is_main_branch?: boolean;
    created_at?: string;
    subscription_plan?: string;
    adminId?: string;
    adminName?: string;
    adminEmail?: string;
    adminMobile?: string;
    adminPassword?: string;
    adminPin?: string;
}

// Backwards-compatible alias for components still referencing Branch
export type Branch = RestaurantItem;

interface OwnerContextType {
    /** Currently selected restaurant ID, or 'all' for aggregate view */
    selectedRestaurantId: string;
    /** Set the selected restaurant */
    setSelectedRestaurant: (restaurantId: string) => void;
    /** All restaurants belonging to this owner */
    restaurants: RestaurantItem[];
    setRestaurants: (restaurants: RestaurantItem[]) => void;
    /** Currently selected restaurant object (null if 'all') */
    currentRestaurant: RestaurantItem | null;
    /** Whether we're in "All Restaurants" aggregate mode */
    isAllRestaurants: boolean;

    // Backwards-compatible aliases
    selectedBranchId: string;
    setSelectedBranch: (branchId: string) => void;
    branches: RestaurantItem[];
    setBranches: (branches: RestaurantItem[]) => void;
    currentBranch: RestaurantItem | null;
    isAllBranches: boolean;

    /** Restaurant summary info */
    restaurant: {
        id: string;
        name: string;
        logoUrl?: string;
        plan?: string;
        planSlug?: string;
        hasOwnerPanel?: boolean;
        hasMultiRestaurant?: boolean;
        maxBranches?: number;
        branchCount?: number;
        remainingBranches?: number;
        primaryEntitlement?: any;
    } | null;
    setRestaurant: (r: any) => void;

    /** Sidebar collapsed state */
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (v: boolean) => void;

    /** Mobile sidebar open */
    mobileSidebarOpen: boolean;
    setMobileSidebarOpen: (v: boolean) => void;
}

const OwnerContext = createContext<OwnerContextType | null>(null);

export function OwnerProvider({ children }: { children: React.ReactNode }) {
    const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>('all');
    const [restaurants, setRestaurants] = useState<RestaurantItem[]>([]);
    const [restaurant, setRestaurant] = useState<any>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

    const setSelectedRestaurant = useCallback((restaurantId: string) => {
        setSelectedRestaurantId(restaurantId);
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('owner_selected_restaurant', restaurantId);
            sessionStorage.setItem('owner_selected_branch', restaurantId);
            document.cookie = `dine_restaurant_id=${restaurantId}; path=/; max-age=86400; SameSite=Lax`;
        }
    }, []);

    // Backwards compatibility alias
    const setSelectedBranch = setSelectedRestaurant;

    // Restore restaurant selection from session storage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem('owner_selected_restaurant') || sessionStorage.getItem('owner_selected_branch');
            if (saved) {
                setSelectedRestaurantId(saved);
            }
        }
    }, []);

    const currentRestaurant = selectedRestaurantId === 'all' 
        ? null 
        : restaurants.find(r => r.id === selectedRestaurantId) || null;

    const isAllRestaurants = selectedRestaurantId === 'all';

    return (
        <OwnerContext.Provider value={{
            selectedRestaurantId,
            setSelectedRestaurant,
            restaurants,
            setRestaurants,
            currentRestaurant,
            isAllRestaurants,

            // Aliases
            selectedBranchId: selectedRestaurantId,
            setSelectedBranch,
            branches: restaurants,
            setBranches: setRestaurants,
            currentBranch: currentRestaurant,
            isAllBranches: isAllRestaurants,

            restaurant,
            setRestaurant,
            sidebarCollapsed,
            setSidebarCollapsed,
            mobileSidebarOpen,
            setMobileSidebarOpen,
        }}>
            {children}
        </OwnerContext.Provider>
    );
}

export function useOwner() {
    const ctx = useContext(OwnerContext);
    if (!ctx) throw new Error('useOwner must be used within <OwnerProvider>');
    return ctx;
}
