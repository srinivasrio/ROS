import { primarySupabase as supabase, primarySupabaseAdmin, saasSupabase } from '../supabase';

export type UserRole = 'customer' | 'waiter' | 'kitchen' | 'restaurant_admin' | 'saas_admin';

export interface UserProfile {
    id: string;
    email: string;
    name?: string;
    restaurant_name?: string;
    role: UserRole;
    restaurant_id?: string;
    is_approved: boolean;
    created_at: string;
    // Enriched data from SaaS DB
    business_details?: any;
    legal_details?: any;
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
        const res = await fetch('/api/restaurants?status=pending');
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to fetch pending restaurants');
        }
        return res.json();
    },

    async fetchApprovedUsers(): Promise<UserProfile[]> {
        const res = await fetch('/api/restaurants?status=approved');
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed to fetch approved restaurants');
        }
        return res.json();
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

    async approveUser(userId: string, restaurantName: string): Promise<void> {
        // Call server-side API route that uses service role key (bypasses RLS)
        const res = await fetch('/api/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, restaurantName }),
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Approval failed');
        }
    },

    async deleteUser(userId: string): Promise<void> {
        const res = await fetch('/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Deletion failed');
        }
    },

    async signOut(): Promise<void> {
        await supabase.auth.signOut();
    }
};
