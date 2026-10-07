import { supabase } from '@/lib/supabase';

export type UserRole = 'customer' | 'waiter' | 'kitchen' | 'restaurant_admin' | 'saas_admin' | 'supervisor';

export interface UserProfile {
    id: string;
    email: string;
    phone?: string;
    name?: string;
    restaurant_name?: string;
    role: UserRole;
    restaurant_id?: string;
    branch_id?: string;
    branchId?: string;
    branch_name?: string;
    is_approved: boolean;
    created_at: string;
}

const profileCache = new Map<string, { profile: UserProfile | null; expiresAt: number }>();
const PROFILE_TTL_MS = 30000; // 30s in-memory cache

export const UserService = {
    clearProfileCache() {
        profileCache.clear();
    },

    async getCurrentProfile(restaurantId?: string | null, staffMobile?: string | null, forceRefresh: boolean = false, panel?: string | null): Promise<UserProfile | null> {
        let detectedPanel = panel;
        if (!detectedPanel && typeof window !== 'undefined') {
            const p = window.location.pathname.toLowerCase();
            if (p.startsWith('/owner') || p.includes('/owner')) detectedPanel = 'owner';
            else if (p.includes('/admin')) detectedPanel = 'admin';
            else if (p.includes('/waiter')) detectedPanel = 'waiter';
            else if (p.includes('/kds') || p.includes('/kitchen')) detectedPanel = 'kds';
            else if (p.includes('/delivery')) detectedPanel = 'delivery';
        }
        const cacheKey = `${restaurantId || 'default'}_${staffMobile || 'default'}_${detectedPanel || 'default'}`;
        const now = Date.now();
        if (!forceRefresh) {
            const cached = profileCache.get(cacheKey);
            if (cached && cached.expiresAt > now) {
                return cached.profile;
            }
        }

        try {
            const params = new URLSearchParams();
            if (restaurantId) params.set('restaurantId', restaurantId);
            if (staffMobile) params.set('staffMobile', staffMobile);
            if (detectedPanel) params.set('panel', detectedPanel);
            const query = params.toString();
            const url = query ? `/api/auth/session?${query}` : '/api/auth/session';
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.authenticated && data.user) {
                    const u = data.user;
                    // Map new role values to old role names for backward compatibility
                    let mappedRole: UserRole = 'customer';
                    const roleUpper = (u.role || '').toUpperCase();
                    if (roleUpper === 'ADMIN' || roleUpper === 'RESTAURANT_ADMIN') mappedRole = 'restaurant_admin';
                    else if (roleUpper === 'SUPER_ADMIN' || roleUpper === 'SUPERADMIN' || roleUpper === 'SAAS_ADMIN') mappedRole = 'saas_admin';
                    else if (roleUpper === 'WAITER') mappedRole = 'waiter';
                    else if (roleUpper === 'CHEF' || roleUpper === 'KITCHEN') mappedRole = 'kitchen';
                    else if (roleUpper === 'SUPERVISOR') mappedRole = 'supervisor';

                    const profile: UserProfile = {
                        id: u.id,
                        email: u.email || '',
                        name: u.name,
                        role: mappedRole,
                        restaurant_id: u.restaurant_id,
                        branch_id: u.branch_id || u.branchId,
                        branchId: u.branch_id || u.branchId,
                        branch_name: u.branch_name,
                        is_approved: true,
                        created_at: new Date().toISOString()
                    };
                    profileCache.set(cacheKey, { profile, expiresAt: now + PROFILE_TTL_MS });
                    return profile;
                }
            }
        } catch (err) {
            console.error('Failed to fetch JWT session profile:', err);
        }

        profileCache.set(cacheKey, { profile: null, expiresAt: now + 5000 });
        return null;
    },

    async fetchPendingUsers(): Promise<UserProfile[]> {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, phone, name, restaurant_name, role, restaurant_id, is_approved, created_at')
            .eq('role', 'restaurant_admin')
            .eq('is_approved', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async fetchApprovedUsers(): Promise<UserProfile[]> {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, phone, name, restaurant_name, role, restaurant_id, is_approved, created_at')
            .eq('role', 'restaurant_admin')
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async fetchRestaurantStaff(restaurantId: string): Promise<UserProfile[]> {
        const { data, error } = await supabase
            .from('users')
            .select('id, email, phone, name, restaurant_name, role, restaurant_id, is_approved, created_at')
            .eq('restaurant_id', restaurantId)
            .in('role', ['waiter', 'kitchen'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async approveUser(userId: string): Promise<void> {
        const { error } = await supabase
            .from('users')
            .update({ is_approved: true })
            .eq('id', userId);

        if (error) throw error;
    },

    async deleteUser(userId: string): Promise<void> {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) throw error;
    },

    async signOut(): Promise<void> {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            console.error('API logout failed:', e);
        }
        await supabase.auth.signOut();
    },

    async signInWithPhone(mobile: string, pin: string): Promise<{ user: any, error: any }> {
        // Use server-side API to look up the email by phone number.
        // This bypasses the RLS policy that blocks anonymous reads on the users table.
        let email: string | null = null;
        try {
            const res = await fetch('/api/lookup-phone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile }),
            });
            if (res.ok) {
                const data = await res.json();
                email = data.email || null;
            }
        } catch (err) {
            console.error('Phone lookup failed:', err);
        }

        if (!email) {
            // If no user found by phone, return a clear error instead of a confusing fallback
            return { user: null, error: { message: 'No account found with this mobile number. Please check your number or use Email login.' } };
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: pin
        });
        return { user: data.user, error };
    },

    async signInWithEmail(email: string, pin: string): Promise<{ user: any, error: any }> {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: pin
        });
        return { user: data.user, error };
    },

    async signInWithGoogle(): Promise<{ data: any, error: any }> {
        // Replace 0.0.0.0 with localhost to avoid Safari "restricted network port" error
        const origin = window.location.origin.replace('0.0.0.0', 'localhost');
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${origin}/auth/callback`,
                queryParams: {
                    prompt: 'select_account'
                }
            }
        });
        if (error) throw error;
        return { data, error };
    }
};
