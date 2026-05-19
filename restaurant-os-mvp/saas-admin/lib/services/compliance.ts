import { saasSupabase, primarySupabase } from "../supabase";

export interface RestaurantLegal {
    id: string;
    restaurant_ref: string;
    business_name: string;
    business_type: string;
    gst_number: string;
    fssai_number: string;
    license_number: string;
    pan_number: string;
    status: 'approved' | 'pending' | 'flagged';
    license_expiry_date: string;
    created_at: string;
}

export const ComplianceService = {
    async fetchAllComplianceData(): Promise<RestaurantLegal[]> {
        const { data, error } = await saasSupabase
            .from('restaurant_legal')
            .select('*')
            .order('license_expiry_date', { ascending: true });

        if (error) throw error;
        return data || [];
    },

    async updateComplianceStatus(id: string, status: RestaurantLegal['status']) {
        const { error } = await saasSupabase
            .from('restaurant_legal')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) throw error;
    },

    async fetchComplianceStats() {
        const { count: expired } = await saasSupabase
            .from('restaurant_legal')
            .select('*', { count: 'exact', head: true })
            .lt('license_expiry_date', new Date().toISOString());

        const { count: pending } = await saasSupabase
            .from('restaurant_legal')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        return {
            expiredLicenses: expired || 0,
            pendingVerifications: pending || 0,
            filingDiscrepancies: 0,
        };
    },

    async fetchStaffComplianceStats() {
        // Fetch real staff documentation stats from primary DB
        const { data: restaurants } = await primarySupabase
            .from('restaurant_profile')
            .select('restaurant_id, business_name');

        if (!restaurants) return [];

        const stats = await Promise.all(restaurants.map(async (res) => {
            const { count: total } = await primarySupabase
                .from('staff')
                .select('*', { count: 'exact', head: true })
                .eq('restaurant_id', res.restaurant_id);
            
            const { count: verified } = await primarySupabase
                .from('staff')
                .select('*', { count: 'exact', head: true })
                .eq('restaurant_id', res.restaurant_id)
                .not('aadhaar_id', 'is', null);

            return {
                restaurant: res.business_name,
                status: `${verified || 0}/${total || 0} Verified`,
                percent: total ? Math.round(((verified || 0) / (total || 0)) * 100) : 100
            };
        }));

        return stats;
    }
};
