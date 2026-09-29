import { supabase } from '@/lib/supabase';

import { HomepageBuilderService } from './homepage-builder.service';

export interface BranchRegistrationData {
    name: string;
    address: string;
    phone: string;
    isMain: boolean;
}

export interface MultiRestaurantData {
    name: string;
    serviceType: 'restaurant' | 'bar' | 'restaurant_bar';
    address: string;
    openingDate: string;
    operatingHours: any;
    branches: BranchRegistrationData[];
    gstNumber: string;
    fssaiNumber: string;
    shopLicense: string;
    panCard: string;
    businessType: 'Proprietorship' | 'Pvt Ltd' | 'Partnership';
}

export interface GlobalRegistrationData {
    ownerName: string;
    mobileNumber: string;
    email: string;
    selectedPackage: string;
    authMethod: 'email' | 'phone';
    restaurants: MultiRestaurantData[];
}

export const RegistrationService = {
    async registerBusiness(data: GlobalRegistrationData, password?: string) {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Registration failed');
        }

        return await res.json();
    },

    async getRegistrationDetails(restaurantId: string) {
        if (!restaurantId) return null;

        // Fetch basic info
        const { data: restaurant, error: resError } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', restaurantId)
            .single();

        if (resError) {
            console.error('Error fetching restaurant registration details:', resError);
            return null;
        }

        // Fetch legal info
        const { data: legalInfo, error: legalError } = await supabase
            .from('restaurant_legal')
            .select('*')
            .eq('restaurant_ref', restaurantId)
            .single();

        if (legalError && legalError.code !== 'PGRST116') {
            console.error('Error fetching restaurant legal details:', legalError);
        }

        return {
            ...restaurant,
            legal: legalInfo || null
        };
    },

    async updateGstSettings(restaurantId: string, gst: number, cgst: number, sgst: number) {
        if (!restaurantId) return false;

        const { error: restErr } = await supabase
            .from('restaurants')
            .update({
                gst_percentage: gst,
                cgst_percentage: cgst,
                sgst_percentage: sgst,
                updated_at: new Date().toISOString()
            })
            .eq('id', restaurantId);

        if (restErr) console.error('Error updating restaurants GST:', restErr);

        const { error: profErr } = await supabase
            .from('restaurant_profile')
            .update({
                gst_percentage: gst,
                cgst_percentage: cgst,
                sgst_percentage: sgst,
                tax_percentage: gst
            })
            .eq('restaurant_id', restaurantId);

        if (profErr) console.error('Error updating restaurant_profile GST:', profErr);

        return !restErr;
    }
};
