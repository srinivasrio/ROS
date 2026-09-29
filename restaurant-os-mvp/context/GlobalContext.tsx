'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type PanelType = 'admin' | 'customer' | 'waiter' | 'kitchen' | 'supervisor';
export type ServiceType = 'dine-in' | 'takeaway' | 'delivery' | 'bar';

export interface GlobalContextState {
    restaurantId: string | null;
    branchId: string | null;
    panel: PanelType | null;
    staffId: string | null;
    tableId: string | null;
    orderId: string | null;
    sessionId: string | null;
    role: string | null;
    serviceType: ServiceType | null;
    mergeGroupId: string | null;
}

interface GlobalContextType extends GlobalContextState {
    loading: boolean;
    error: string | null;
    validateContext: (required: (keyof GlobalContextState)[]) => boolean;
    refreshContext: () => Promise<void>;
    updateContext: (updates: Partial<GlobalContextState>) => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function GlobalContextProvider({ children }: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();

    const restaurantCode = (params?.restaurantCode as string) || null;
    const branchCode = (params?.branchCode as string) || null;
    const tableId = (params?.tableId as string) || null;
    const orderId = (params?.orderId as string) || null;

    const [state, setState] = useState<GlobalContextState>({
        restaurantId: null,
        branchId: null,
        panel: null,
        staffId: null,
        tableId: null,
        orderId: null,
        sessionId: null,
        role: null,
        serviceType: null,
        mergeGroupId: null,
    });

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isInitialLoad = useRef(true);
    const stateRef = useRef(state);
    stateRef.current = state;

    const refreshContext = useCallback(async () => {
        try {
            // Only show hard loading state if we don't have any context yet
            // This prevents UI flashing during navigation
            if (isInitialLoad.current && !stateRef.current.restaurantId) {
                setLoading(true);
            }
            setError(null);

            // 1. Identify Panel
            let panel: PanelType | null = null;
            if (pathname.includes('/admin')) panel = 'admin';
            else if (pathname.includes('/waiter')) panel = 'waiter';
            else if (pathname.includes('/kds')) panel = 'kitchen';
            else if (pathname.includes('/supervisor')) panel = 'supervisor';
            else if (pathname.includes('/menu') || pathname.includes('/order')) panel = 'customer';

            // 2. Fetch Session & Profile (optional)
            let role = null;
            let staffId = null;
            let sessionId = null;
            let restaurantId = restaurantCode || null;

            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    sessionId = session.user.id;
                    const { data: profile } = await supabase
                        .from('users')
                        .select('role, restaurant_id, branch_id')
                        .eq('id', session.user.id)
                        .single();

                    if (profile) {
                        role = profile.role;
                        restaurantId = profile.restaurant_id || restaurantId;
                        
                        // If user has a specific staff record
                        const { data: staff } = await supabase
                            .from('staff')
                            .select('id')
                            .eq('user_id', session.user.id)
                            .maybeSingle();
                        
                        if (staff) staffId = staff.id;
                    }
                }
            } catch (_) {
                // Ignore auth session check failures in global context
            }

            // 3. Update State ONLY if changed to prevent cascading root re-renders
            setState(prev => {
                if (
                    prev.restaurantId === restaurantId &&
                    prev.branchId === branchCode &&
                    prev.panel === panel &&
                    prev.staffId === staffId &&
                    prev.tableId === tableId &&
                    prev.orderId === orderId &&
                    prev.sessionId === sessionId &&
                    prev.role === role
                ) {
                    return prev;
                }
                return {
                    ...prev,
                    restaurantId,
                    branchId: branchCode,
                    panel,
                    staffId,
                    tableId,
                    orderId,
                    sessionId,
                    role,
                };
            });

        } catch (err: any) {
            console.error('Global Context Error:', err);
            setError(err.message);
        } finally {
            isInitialLoad.current = false;
            setLoading(false);
        }
    }, [restaurantCode, branchCode, tableId, orderId, pathname]);

    useEffect(() => {
        refreshContext();
    }, [refreshContext]);

    const validateContext = useCallback((required: (keyof GlobalContextState)[]) => {
        const missing = required.filter(key => !state[key]);
        if (missing.length > 0) {
            console.error('Missing Context:', missing);
            toast.error(`Invalid Operational Context: ${missing.join(', ')}`);
            return false;
        }
        return true;
    }, [state]);

    const updateContext = useCallback((updates: Partial<GlobalContextState>) => {
        setState(prev => ({ ...prev, ...updates }));
    }, []);

    const value = useMemo(() => ({
        ...state,
        loading,
        error,
        validateContext,
        refreshContext,
        updateContext
    }), [state, loading, error, validateContext, refreshContext, updateContext]);

    return (
        <GlobalContext.Provider value={value}>
            {children}
        </GlobalContext.Provider>
    );
}

export function useGlobalContext() {
    const context = useContext(GlobalContext);
    if (context === undefined) {
        throw new Error('useGlobalContext must be used within a GlobalContextProvider');
    }
    return context;
}
