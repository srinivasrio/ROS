import type { SupabaseClient } from '@supabase/supabase-js';

export interface Customer {
    id: string;
    restaurant_id: string;
    name?: string | null;
    mobile: string | null;
    email: string | null;
    date_of_birth: string | null;
    first_visit: string;
    last_visit: string;
    visit_count: number;
    order_count: number;
    total_spend: number;
    created_at: string;
    updated_at: string;
}

export interface CustomerListResult {
    customers: Customer[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export function createCustomerService(client: SupabaseClient) {
    return {
    /**
     * Upsert a customer from the welcome page (public, no auth).
     * If mobile exists for this restaurant, update; otherwise insert.
     */
    async upsertCustomer(
        restaurantId: string,
        data: { name?: string; mobile?: string; email?: string; dateOfBirth?: string }
    ): Promise<{ customerId: string; isReturning: boolean; customer: Customer }> {
        const { name, mobile, email, dateOfBirth } = data;
        const cleanMobile = mobile ? mobile.replace(/[^0-9]/g, '').slice(-10) : '';

        // Try to find existing customer by mobile first, then email
        let existing: any = null;

        if (cleanMobile && cleanMobile.length >= 10) {
            const { data: found } = await client
                .from('customers')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .or(`mobile.eq.${cleanMobile},mobile.eq.+91${cleanMobile},mobile.eq.91${cleanMobile},mobile.eq.0${cleanMobile},mobile.ilike.%${cleanMobile}%`)
                .maybeSingle();
            existing = found;
        } else if (mobile) {
            const { data: found } = await client
                .from('customers')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .eq('mobile', mobile)
                .maybeSingle();
            existing = found;
        }

        if (!existing && email) {
            const { data: found } = await client
                .from('customers')
                .select('*')
                .eq('restaurant_id', restaurantId)
                .eq('email', email.trim().toLowerCase())
                .maybeSingle();
            existing = found;
        }

        let targetCustomerId: string;
        let isReturning = false;
        let fullCustomer: any = null;

        if (existing) {
            targetCustomerId = existing.id;
            isReturning = true;

            // Update existing customer
            const updates: any = {
                last_visit: new Date().toISOString(),
                visit_count: (existing.visit_count || 0) + 1,
            };
            if (name && name.trim()) updates.name = name.trim();
            if (email && email.trim()) updates.email = email.trim().toLowerCase();
            if (dateOfBirth) updates.date_of_birth = dateOfBirth;
            if (mobile && mobile.trim()) updates.mobile = mobile.trim();

            const { data: updated } = await client
                .from('customers')
                .update(updates)
                .eq('id', existing.id)
                .select('*')
                .single();

            fullCustomer = updated || { ...existing, ...updates };
        } else {
            // Insert new customer
            const insertData: any = {
                restaurant_id: restaurantId,
            };
            if (name && name.trim()) insertData.name = name.trim();
            if (mobile && mobile.trim()) insertData.mobile = mobile.trim();
            if (email && email.trim()) insertData.email = email.trim().toLowerCase();
            if (dateOfBirth) insertData.date_of_birth = dateOfBirth;

            const { data: inserted, error } = await client
                .from('customers')
                .insert(insertData)
                .select('*')
                .single();

            if (error) throw error;
            targetCustomerId = inserted.id;
            fullCustomer = inserted;
        }

        // CRITICAL PERSISTENCE: Link all past/active unassigned orders matching this customer's mobile to their account
        if (cleanMobile && cleanMobile.length >= 10 && targetCustomerId) {
            try {
                await client
                    .from('orders')
                    .update({ customer_id: targetCustomerId })
                    .eq('restaurant_id', restaurantId)
                    .is('customer_id', null)
                    .or(`customer_phone.ilike.%${cleanMobile}%,delivery_phone.ilike.%${cleanMobile}%`);
            } catch (err) {
                console.warn('[CustomerService] Order link warning:', err);
            }
        }

        return { customerId: targetCustomerId, isReturning, customer: fullCustomer };
    },

    /**
     * Get customer by ID with tenant isolation.
     */
    async getCustomerById(restaurantId: string, customerId: string): Promise<Customer | null> {
        if (!restaurantId || !customerId) return null;
        const { data, error } = await client
            .from('customers')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .eq('id', customerId)
            .maybeSingle();

        if (error || !data) return null;
        return data as Customer;
    },

    /**
     * Fetch paginated customers for admin panel.
     */
    async fetchCustomers(
        restaurantId: string,
        options: {
            search?: string;
            page?: number;
            limit?: number;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
        } = {}
    ): Promise<CustomerListResult> {
        const {
            search = '',
            page = 1,
            limit = 20,
            sortBy = 'last_visit',
            sortOrder = 'desc',
        } = options;

        const offset = (page - 1) * limit;

        // Build query for count
        let countQuery = client
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .eq('restaurant_id', restaurantId);

        // Build query for data
        let dataQuery = client
            .from('customers')
            .select('*')
            .eq('restaurant_id', restaurantId)
            .order(sortBy, { ascending: sortOrder === 'asc' })
            .range(offset, offset + limit - 1);

        // Apply search filter
        if (search) {
            const searchFilter = `name.ilike.%${search}%,mobile.ilike.%${search}%,email.ilike.%${search}%`;
            countQuery = countQuery.or(searchFilter);
            dataQuery = dataQuery.or(searchFilter);
        }

        const [countResult, dataResult] = await Promise.all([
            countQuery,
            dataQuery,
        ]);

        const total = countResult.count || 0;

        return {
            customers: (dataResult.data || []) as Customer[],
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    },

    /**
     * Get a single customer profile with their order history.
     */
    async getCustomerProfile(
        customerId: string,
        restaurantId: string
    ): Promise<{ customer: Customer | null; orders: any[] }> {
        const [customerResult, ordersResult] = await Promise.all([
            client
                .from('customers')
                .select('*')
                .eq('id', customerId)
                .eq('restaurant_id', restaurantId)
                .maybeSingle(),
            client
                .from('orders')
                .select('id, order_number, status, total_amount, created_at, table_id, tables(table_number)')
                .eq('customer_id', customerId)
                .eq('restaurant_id', restaurantId)
                .order('created_at', { ascending: false })
                .limit(50),
        ]);

        const mappedOrders = (ordersResult.data || []).map((o: any) => {
            let tableNumber = '—';
            if (o.tables) {
                if (typeof o.tables === 'object' && o.tables.table_number) {
                    tableNumber = String(o.tables.table_number);
                } else if (Array.isArray(o.tables) && o.tables[0]?.table_number) {
                    tableNumber = String(o.tables[0].table_number);
                }
            }
            return {
                id: o.id,
                order_number: String(o.order_number ?? ''),
                status: o.status || 'unknown',
                total: Number(o.total_amount ?? o.total ?? 0),
                created_at: o.created_at,
                table_number: tableNumber,
                items: [],
            };
        });

        return {
            customer: customerResult.data as Customer | null,
            orders: mappedOrders,
        };
    },

    /**
     * Update customer details (admin only).
     */
    async updateCustomer(
        customerId: string,
        restaurantId: string,
        updates: Partial<Pick<Customer, 'name' | 'mobile' | 'email' | 'date_of_birth'>>
    ) {
        const { error } = await client
            .from('customers')
            .update(updates)
            .eq('id', customerId)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;
    },

    /**
     * Increment order count and total spend after an order is placed.
     */
    async incrementOrderStats(
        customerId: string,
        restaurantId: string,
        orderTotal: number
    ) {
        // Fetch current stats
        const { data: current } = await client
            .from('customers')
            .select('order_count, total_spend')
            .eq('id', customerId)
            .eq('restaurant_id', restaurantId)
            .single();

        if (!current) return;

        await client
            .from('customers')
            .update({
                order_count: (current.order_count || 0) + 1,
                total_spend: parseFloat(String(current.total_spend || 0)) + orderTotal,
                last_visit: new Date().toISOString(),
            })
            .eq('id', customerId)
            .eq('restaurant_id', restaurantId);
    },

    /**
     * Check if a customer exists by ID for this restaurant.
     */
    async checkCustomerExists(
        customerId: string,
        restaurantId: string
    ): Promise<boolean> {
        const { data } = await client
            .from('customers')
            .select('id')
            .eq('id', customerId)
            .eq('restaurant_id', restaurantId)
            .maybeSingle();
        return !!data;
    },

    /**
     * Get customer stats for admin dashboard.
     */
    async getCustomerStats(restaurantId: string) {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [totalResult, newThisWeekResult, returningResult] = await Promise.all([
            client
                .from('customers')
                .select('id', { count: 'exact', head: true })
                .eq('restaurant_id', restaurantId),
            client
                .from('customers')
                .select('id', { count: 'exact', head: true })
                .eq('restaurant_id', restaurantId)
                .gte('created_at', weekAgo),
            client
                .from('customers')
                .select('id', { count: 'exact', head: true })
                .eq('restaurant_id', restaurantId)
                .gt('visit_count', 1),
        ]);

        return {
            total: totalResult.count || 0,
            newThisWeek: newThisWeekResult.count || 0,
            returning: returningResult.count || 0,
        };
    },
    };
}
