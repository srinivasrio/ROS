import { supabase } from '@/lib/supabase';
import { saasSupabase } from '@/saas-admin/lib/supabase';
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
        // 1. Sign up user in Primary Supabase (Auth)
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: data.email,
            password: password || Math.random().toString(36).slice(-12),
            options: {
                data: {
                    name: data.ownerName,
                    role: 'restaurant_admin',
                    phone: data.mobileNumber,
                }
            }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Signup failed');
        const ownerId = authData.user.id;

        // 2. Create profile in Primary DB (users table)
        const { error: profileError } = await supabase
            .from('users')
            .upsert({
                id: ownerId,
                name: data.ownerName,
                email: data.email,
                phone: data.mobileNumber,
                role: 'restaurant_admin',
                is_approved: false
            });

        if (profileError) throw profileError;

        const results = [];

        // 3. Create Restaurants and Branches
        for (const resData of data.restaurants) {
            const datePart = '2026' + new Date().toISOString().slice(5, 10).replace(/-/g, '');
            const randomPart = Math.floor(1000 + Math.random() * 9000).toString();
            const restaurantId = `${datePart}${randomPart}`;

            const { data: restaurant, error: resError } = await saasSupabase
                .from('restaurants')
                .insert({
                    id: restaurantId,
                    name: resData.name,
                    owner_name: data.ownerName,
                    owner_id: ownerId,
                    phone: data.mobileNumber,
                    email: data.email,
                    address: resData.address,
                    opening_date: resData.openingDate,
                    operating_hours: resData.operatingHours,
                    subscription_plan: data.selectedPackage,
                    status: 'inactive'
                })
                .select()
                .single();

            if (resError) throw resError;

            // 3.1 Create restaurant_profile in Primary DB
            const { error: resProfileError } = await supabase
                .from('restaurant_profile')
                .upsert({
                    restaurant_id: restaurantId,
                    name: resData.name,
                    business_type: resData.serviceType,
                    phone: data.mobileNumber,
                    email: data.email,
                    address: resData.address,
                    opening_time: resData.operatingHours.open,
                    closing_time: resData.operatingHours.close,
                });

            if (resProfileError) throw resProfileError;

            // Link restaurant_id to the user profile in primary DB
            const { error: userUpdateError } = await supabase
                .from('users')
                .update({ restaurant_id: restaurantId })
                .eq('id', ownerId);

            if (userUpdateError) throw userUpdateError;

            // 3.2 Create Branches
            for (const branchData of resData.branches) {
                const branchId = `${restaurantId}-B${Math.floor(10 + Math.random() * 89)}`;
                const { error: branchError } = await supabase
                    .from('branches')
                    .insert({
                        id: branchId,
                        restaurant_id: restaurantId,
                        name: branchData.name,
                        address: branchData.address,
                        phone: branchData.phone,
                        is_main_branch: branchData.isMain
                    });
                
                if (branchError) throw branchError;
            }

            // 4. Save legal/compliance data in Secondary DB
            const { error: legalError } = await saasSupabase
                .from('restaurant_legal')
                .insert({
                    restaurant_ref: restaurantId,
                    business_name: resData.name,
                    business_type: resData.businessType,
                    gst_number: resData.gstNumber,
                    fssai_number: resData.fssaiNumber,
                    license_number: resData.fssaiNumber,
                    pan_number: resData.panCard,
                    shop_establishment_license: resData.shopLicense,
                    status: 'pending'
                });

            if (legalError) throw legalError;

            // 5. Initialize Default Services for the new restaurant
            try {
                await HomepageBuilderService.initializeDefaultServices(restaurantId);
            } catch (initError) {
                console.error('Failed to initialize default services:', initError);
                // We don't throw here to not block the whole registration if just defaults fail
            }

            results.push({ restaurantId });
        }

        return { ownerId, results };
    },

    async getRegistrationDetails(restaurantId: string) {
        if (!restaurantId) return null;

        // Fetch basic info
        const { data: restaurant, error: resError } = await saasSupabase
            .from('restaurants')
            .select('*')
            .eq('id', restaurantId)
            .single();

        if (resError) {
            console.error('Error fetching restaurant registration details:', resError);
            return null;
        }

        // Fetch legal info
        const { data: legalInfo, error: legalError } = await saasSupabase
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
    }
};
