import { supabase } from '@/lib/supabase';

export interface ValidationContext {
    restaurantId?: string | null;
    branchId?: string | null;
    panel?: string | null;
    staffId?: string | null;
    tableId?: string | null;
    orderId?: string | null;
    userId?: string | null;
}

export class ContextValidationError extends Error {
    constructor(public message: string, public context: string) {
        super(message);
        this.name = 'ContextValidationError';
    }
}

export const ContextValidator = {
    /**
     * Validates if the given IDs belong to the correct restaurant and branch.
     * This is crucial for multi-tenant and branch-level isolation.
     */
    async validateOwnership(context: ValidationContext) {
        const { restaurantId, branchId, tableId, orderId, staffId } = context;

        if (!restaurantId) {
            throw new ContextValidationError('Restaurant context is required', 'restaurant_id');
        }

        // 1. Validate Branch belongs to Restaurant
        if (branchId) {
            const { data: branch, error } = await supabase
                .from('branches')
                .select('restaurant_id')
                .eq('id', branchId)
                .single();
            
            if (error || !branch || branch.restaurant_id !== restaurantId) {
                throw new ContextValidationError('Branch does not belong to this restaurant', 'branch_id');
            }
        }

        // 2. Validate Table belongs to Restaurant/Branch
        if (tableId) {
            const query = supabase
                .from('tables')
                .select('restaurant_id, branch_id')
                .eq('id', tableId)
                .single();
            
            const { data: table, error } = await query;

            if (error || !table || table.restaurant_id !== restaurantId) {
                throw new ContextValidationError('Table mismatch for this restaurant', 'table_id');
            }
            if (branchId && table.branch_id !== branchId) {
                throw new ContextValidationError('Table mismatch for this branch', 'branch_id');
            }
        }

        // 3. Validate Order belongs to Restaurant/Branch
        if (orderId) {
            const { data: order, error } = await supabase
                .from('orders')
                .select('restaurant_id, branch_id')
                .eq('id', orderId)
                .single();

            if (error || !order || order.restaurant_id !== restaurantId) {
                throw new ContextValidationError('Order mismatch for this restaurant', 'order_id');
            }
            if (branchId && order.branch_id !== branchId) {
                throw new ContextValidationError('Order mismatch for this branch', 'branch_id');
            }
        }

        // 4. Validate Staff belongs to Restaurant/Branch
        if (staffId) {
            const { data: staff, error } = await supabase
                .from('staff')
                .select('restaurant_id, branch_id')
                .eq('id', staffId)
                .single();

            if (error || !staff || staff.restaurant_id !== restaurantId) {
                throw new ContextValidationError('Staff mismatch for this restaurant', 'staff_id');
            }
            if (branchId && staff.branch_id !== branchId) {
                throw new ContextValidationError('Staff mismatch for this branch', 'branch_id');
            }
        }

        return true;
    }
};
