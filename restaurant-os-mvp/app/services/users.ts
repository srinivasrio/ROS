import { supabase } from '@/lib/supabase';

export type UserRole = 'customer' | 'waiter' | 'kitchen' | 'restaurant_admin' | 'saas_admin';

export interface UserProfile {
    id: string;
    email: string;
    phone?: string;
    name?: string;
    restaurant_name?: string;
    role: UserRole;
    restaurant_id?: string;
    is_approved: boolean;
    created_at: string;
}

export const UserService = {
    async getCurrentProfile(): Promise<UserProfile | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
        return data;
    },

    async fetchPendingUsers(): Promise<UserProfile[]> {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'restaurant_admin')
            .eq('is_approved', false)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async fetchApprovedUsers(): Promise<UserProfile[]> {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('role', 'restaurant_admin')
            .eq('is_approved', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async fetchRestaurantStaff(restaurantId: string): Promise<UserProfile[]> {
        const { data, error } = await supabase
            .from('users')
            .select('*')
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
