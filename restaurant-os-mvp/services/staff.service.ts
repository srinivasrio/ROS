import { createClient } from '@/lib/supabase';
import { resolveRestaurantId } from './utils.service';
import { coalesceRequest } from '@/lib/data-cache';

export interface Staff {
    id: string;
    employee_id?: string;
    name: string;
    email?: string;
    role: string;
    mobile: string;
    pin?: string;
    status: 'pending_activation' | 'verified' | 'active' | 'inactive';
    approval_status?: 'pending_verification' | 'awaiting_admin_approval' | 'approved' | 'rejected' | 'suspended';
    address?: string;
    aadhaar_id?: string;
    id_document_url?: string;
    joining_date?: string;
    activation_token?: string;
    branch_id?: string | null;
    monthly_salary?: number;
    per_day_salary?: number | null;
    overtime_per_hour?: number | null;
    is_online?: boolean;
    availability_status?: string;
    vehicle_type?: string | null;
    vehicle_number?: string | null;
}

export const StaffService = {
    async fetchStaff(restaurantId: string): Promise<Staff[]> {
        if (!restaurantId) return [];
        return coalesceRequest(`staff-${restaurantId}`, async () => {
            const rid = await resolveRestaurantId(restaurantId);

            // 1. Try internal Next.js API route first for reliability (bypasses browser CORS / adblockers)
            try {
                const res = await fetch(`/api/admin/employees?restaurantId=${encodeURIComponent(rid)}`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.employees && Array.isArray(json.employees)) {
                        return json.employees as Staff[];
                    }
                }
            } catch (apiErr) {
                console.warn('[StaffService] /api/admin/employees fallback to supabase:', apiErr);
            }

            // 2. Fallback to direct supabase client
            const supabase = createClient();
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .eq('restaurant_id', rid)
                .eq('is_deleted', false)
                .order('name', { ascending: true });

            if (error) {
                console.error('Error fetching employees:', error?.message || error);
                return [];
            }
            return data as Staff[];
        });
    },

    async createStaff(staff: Omit<Staff, 'id' | 'status'> & { restaurant_id: string }): Promise<any> {
        const res = await fetch('/api/auth/employee/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(staff)
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to create employee');
        }

        return await res.json();
    },

    async updateStaff(id: string, restaurantId: string, updates: Partial<Staff> & { vehicle_type?: string | null; vehicle_number?: string | null }): Promise<void> {
        const supabase = createClient();
        const { vehicle_type, vehicle_number, ...employeeUpdates } = updates as any;

        const { error } = await supabase
            .from('employees')
            .update(employeeUpdates)
            .eq('id', id)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;

        // If employee role is delivery_boy or vehicle details are supplied
        if (updates.role === 'delivery_boy') {
            await supabase
                .from('delivery_boys')
                .upsert({
                    restaurant_id: restaurantId,
                    employee_id: id,
                    status: 'active',
                    vehicle_type: vehicle_type || null,
                    vehicle_number: vehicle_number || null,
                }, { onConflict: 'restaurant_id,employee_id' });
        } else if (updates.role && updates.role !== 'delivery_boy') {
            // Deactivate delivery boy status if role changed away
            await supabase
                .from('delivery_boys')
                .update({ status: 'inactive' })
                .eq('employee_id', id)
                .eq('restaurant_id', restaurantId);
        } else if (vehicle_type !== undefined || vehicle_number !== undefined) {
            // Role wasn't changed, but vehicle details might have been updated
            const { data: dbBoy } = await supabase
                .from('delivery_boys')
                .select('id')
                .eq('employee_id', id)
                .maybeSingle();

            if (dbBoy) {
                await supabase
                    .from('delivery_boys')
                    .update({
                        vehicle_type: vehicle_type || null,
                        vehicle_number: vehicle_number || null,
                    })
                    .eq('employee_id', id);
            }
        }
    },

    async deleteStaff(id: string, restaurantId?: string): Promise<void> {
        await this.softDeleteStaff(id, restaurantId);
    },

    async approveStaff(employeeId: string, restaurantId?: string): Promise<void> {
        const res = await fetch('/api/auth/employee/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, action: 'approve', restaurantId })
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to approve employee');
        }
    },

    async rejectStaff(employeeId: string, restaurantId?: string): Promise<void> {
        const res = await fetch('/api/auth/employee/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, action: 'reject', restaurantId })
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to reject employee');
        }
    },

    async suspendStaff(employeeId: string, restaurantId?: string): Promise<void> {
        const res = await fetch('/api/auth/employee/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, action: 'suspend', restaurantId })
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to suspend employee');
        }
    },

    async softDeleteStaff(employeeId: string, restaurantId?: string): Promise<void> {
        const res = await fetch('/api/auth/employee/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, action: 'delete', restaurantId })
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to delete employee');
        }
    },

    async permanentDeleteStaff(employeeId: string, restaurantId?: string): Promise<void> {
        const res = await fetch('/api/auth/employee/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, action: 'permanent_delete', restaurantId })
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to permanently delete employee');
        }
    },

    async restoreStaff(employeeId: string, restaurantId?: string): Promise<void> {
        const res = await fetch('/api/auth/employee/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId, action: 'restore', restaurantId })
        });
        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || 'Failed to restore employee');
        }
    },


    async fetchDeletedStaff(restaurantId: string): Promise<Staff[]> {
        if (!restaurantId) return [];
        const rid = await resolveRestaurantId(restaurantId);

        // 1. Try internal Next.js API route first
        try {
            const res = await fetch(`/api/admin/employees?restaurantId=${encodeURIComponent(rid)}&includeDeleted=true`);
            if (res.ok) {
                const json = await res.json();
                if (json.employees && Array.isArray(json.employees)) {
                    return json.employees as Staff[];
                }
            }
        } catch (apiErr) {
            console.warn('[StaffService] /api/admin/employees fallback to supabase:', apiErr);
        }

        // 2. Fallback to direct supabase client
        const supabase = createClient();
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('restaurant_id', rid)
            .eq('is_deleted', true)
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching deleted staff:', error?.message || error);
            return [];
        }
        return data as Staff[];
    }
};
