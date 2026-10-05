import { createClient } from '@/lib/supabase';
import { resolveRestaurantId } from './utils.service';
import { realtimeManager } from '@/lib/realtime-manager';
import { supabase } from '@/lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export type DeliveryBoyStatus = 'active' | 'inactive' | 'on_delivery' | 'offline';

export type DeliveryAssignmentStatus =
    | 'ASSIGNED'
    | 'ACCEPTED'
    | 'PICKED_UP'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED'
    | 'REASSIGNED';

export interface DeliveryBoy {
    id: string;
    restaurant_id: string;
    employee_id: string;
    status: DeliveryBoyStatus;
    vehicle_type?: string;
    vehicle_number?: string;
    created_at: string;
    updated_at: string;
    // Joined from employees
    name?: string;
    mobile?: string;
    email?: string;
    avatar_url?: string;
}

export interface DeliverySettings {
    id: string;
    restaurant_id: string;
    enabled: boolean;
    delivery_fee: number;
    minimum_order_amount: number;
    max_delivery_radius_km?: number;
    estimated_delivery_minutes: number;
    created_at: string;
    updated_at: string;
}

export interface DeliveryAssignment {
    id: string;
    restaurant_id: string;
    order_id: string;
    delivery_boy_id: string;
    assigned_by?: string;
    status: DeliveryAssignmentStatus;
    assigned_at: string;
    accepted_at?: string;
    picked_up_at?: string;
    out_for_delivery_at?: string;
    delivered_at?: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    // Joined data
    delivery_boy?: DeliveryBoy;
    order?: any;
}

// Valid status transitions
const VALID_TRANSITIONS: Record<DeliveryAssignmentStatus, DeliveryAssignmentStatus[]> = {
    'ASSIGNED': ['ACCEPTED', 'CANCELLED', 'REASSIGNED'],
    'ACCEPTED': ['PICKED_UP', 'CANCELLED'],
    'PICKED_UP': ['OUT_FOR_DELIVERY', 'CANCELLED'],
    'OUT_FOR_DELIVERY': ['DELIVERED', 'CANCELLED'],
    'DELIVERED': [],
    'CANCELLED': [],
    'REASSIGNED': [],
};

// ────────────────────────────────────────────────────────────
// Service
// ────────────────────────────────────────────────────────────

export const DeliveryService = {
    // ── Resolve ──
    async resolveRestaurantId(idOrSlug: string): Promise<string> {
        if (!idOrSlug) return '';
        return resolveRestaurantId(idOrSlug);
    },

    // ════════════════════════════════════════════════════════
    // DELIVERY SETTINGS
    // ════════════════════════════════════════════════════════

    async getSettings(restaurantId: string): Promise<DeliverySettings | null> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) return null;

        const client = createClient();
        const { data, error } = await client
            .from('delivery_settings')
            .select('*')
            .eq('restaurant_id', rid)
            .maybeSingle();

        if (error) {
            console.error('[DeliveryService] getSettings error:', error.message);
            return null;
        }
        return data;
    },

    async upsertSettings(
        restaurantId: string,
        settings: Partial<Omit<DeliverySettings, 'id' | 'restaurant_id' | 'created_at' | 'updated_at'>>
    ): Promise<DeliverySettings | null> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) throw new Error('Invalid restaurant ID');

        const client = createClient();
        const { data, error } = await client
            .from('delivery_settings')
            .upsert({
                restaurant_id: rid,
                ...settings,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'restaurant_id' })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // ════════════════════════════════════════════════════════
    // DELIVERY BOYS
    // ════════════════════════════════════════════════════════

    async getDeliveryBoys(restaurantId: string): Promise<DeliveryBoy[]> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) return [];

        const client = createClient();
        const { data, error } = await client
            .from('delivery_boys')
            .select('*')
            .eq('restaurant_id', rid)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[DeliveryService] getDeliveryBoys error:', error.message);
            return [];
        }
        return data || [];
    },

    async getActiveDeliveryBoys(restaurantId: string): Promise<DeliveryBoy[]> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) return [];

        const client = createClient();
        const { data, error } = await client
            .from('delivery_boys')
            .select('*')
            .eq('restaurant_id', rid)
            .in('status', ['active', 'on_delivery'])
            .order('status', { ascending: true }); // 'active' first

        if (error) {
            console.error('[DeliveryService] getActiveDeliveryBoys error:', error.message);
            return [];
        }
        return data || [];
    },

    async getDeliveryBoyById(id: string, restaurantId: string): Promise<DeliveryBoy | null> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) return null;

        const client = createClient();
        const { data, error } = await client
            .from('delivery_boys')
            .select('*')
            .eq('id', id)
            .eq('restaurant_id', rid)
            .maybeSingle();

        if (error) {
            console.error('[DeliveryService] getDeliveryBoyById error:', error.message);
            return null;
        }
        return data;
    },

    async getDeliveryBoyByEmployeeId(employeeId: string, restaurantId: string): Promise<DeliveryBoy | null> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) return null;

        const client = createClient();
        const { data, error } = await client
            .from('delivery_boys')
            .select('*')
            .eq('employee_id', employeeId)
            .eq('restaurant_id', rid)
            .maybeSingle();

        if (error) {
            console.error('[DeliveryService] getDeliveryBoyByEmployeeId error:', error.message);
            return null;
        }
        return data;
    },

    async createDeliveryBoy(
        restaurantId: string,
        employeeId: string,
        extra?: { vehicle_type?: string; vehicle_number?: string }
    ): Promise<DeliveryBoy> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) throw new Error('Invalid restaurant ID');

        const client = createClient();
        const { data, error } = await client
            .from('delivery_boys')
            .insert({
                restaurant_id: rid,
                employee_id: employeeId,
                status: 'active',
                vehicle_type: extra?.vehicle_type || null,
                vehicle_number: extra?.vehicle_number || null,
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error('This employee is already registered as a delivery boy');
            }
            throw error;
        }
        return data;
    },

    async updateDeliveryBoy(
        id: string,
        restaurantId: string,
        updates: Partial<Pick<DeliveryBoy, 'status' | 'vehicle_type' | 'vehicle_number'>>
    ): Promise<void> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) throw new Error('Invalid restaurant ID');

        const client = createClient();
        const { error } = await client
            .from('delivery_boys')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('restaurant_id', rid);

        if (error) throw error;
    },

    async deleteDeliveryBoy(id: string, restaurantId: string): Promise<void> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) throw new Error('Invalid restaurant ID');

        // Check for active assignments before deleting
        const client = createClient();
        const { data: activeAssignments } = await client
            .from('delivery_assignments')
            .select('id')
            .eq('delivery_boy_id', id)
            .eq('restaurant_id', rid)
            .not('status', 'in', '("DELIVERED","CANCELLED","REASSIGNED")')
            .limit(1);

        if (activeAssignments && activeAssignments.length > 0) {
            throw new Error('Cannot delete delivery boy with active assignments. Complete or reassign them first.');
        }

        const { error } = await client
            .from('delivery_boys')
            .delete()
            .eq('id', id)
            .eq('restaurant_id', rid);

        if (error) throw error;
    },

    // ════════════════════════════════════════════════════════
    // DELIVERY ASSIGNMENTS
    // ════════════════════════════════════════════════════════

    async getAssignments(
        restaurantId: string,
        filters?: { status?: DeliveryAssignmentStatus | DeliveryAssignmentStatus[]; deliveryBoyId?: string; limit?: number }
    ): Promise<DeliveryAssignment[]> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) return [];

        const client = createClient();
        let query = client
            .from('delivery_assignments')
            .select('*')
            .eq('restaurant_id', rid)
            .order('assigned_at', { ascending: false });

        if (filters?.status) {
            if (Array.isArray(filters.status)) {
                query = query.in('status', filters.status);
            } else {
                query = query.eq('status', filters.status);
            }
        }

        if (filters?.deliveryBoyId) {
            query = query.eq('delivery_boy_id', filters.deliveryBoyId);
        }

        if (filters?.limit) {
            query = query.limit(filters.limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[DeliveryService] getAssignments error:', error.message);
            return [];
        }
        return data || [];
    },

    async getAssignmentById(id: string, restaurantId: string): Promise<DeliveryAssignment | null> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) return null;

        const client = createClient();
        const { data, error } = await client
            .from('delivery_assignments')
            .select('*')
            .eq('id', id)
            .eq('restaurant_id', rid)
            .maybeSingle();

        if (error) {
            console.error('[DeliveryService] getAssignmentById error:', error.message);
            return null;
        }
        return data;
    },

    async getActiveAssignmentForOrder(orderId: string, restaurantId: string): Promise<DeliveryAssignment | null> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) return null;

        const client = createClient();
        const { data, error } = await client
            .from('delivery_assignments')
            .select('*')
            .eq('order_id', orderId)
            .eq('restaurant_id', rid)
            .not('status', 'in', '("CANCELLED","REASSIGNED")')
            .maybeSingle();

        if (error) {
            console.error('[DeliveryService] getActiveAssignmentForOrder error:', error.message);
            return null;
        }
        return data;
    },

    async createAssignment(
        restaurantId: string,
        orderId: string,
        deliveryBoyId: string,
        assignedBy: string
    ): Promise<DeliveryAssignment> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) throw new Error('Invalid restaurant ID');

        const client = createClient();

        // Validate order exists, belongs to restaurant, is DELIVERY type, and is ready
        const { data: order, error: orderErr } = await client
            .from('orders')
            .select('id, status, order_type, restaurant_id')
            .eq('id', orderId)
            .eq('restaurant_id', rid)
            .maybeSingle();

        if (orderErr || !order) {
            throw new Error('Order not found or does not belong to this restaurant');
        }
        if (order.order_type !== 'DELIVERY') {
            throw new Error('Order is not a delivery order');
        }
        if (!['placed', 'preparing', 'ready'].includes(order.status)) {
            throw new Error(`Cannot assign delivery boy: Order is in "${order.status}" status`);
        }

        // Validate delivery boy exists and belongs to restaurant
        const { data: boy, error: boyErr } = await client
            .from('delivery_boys')
            .select('id, status, restaurant_id')
            .eq('id', deliveryBoyId)
            .eq('restaurant_id', rid)
            .maybeSingle();

        if (boyErr || !boy) {
            throw new Error('Delivery boy not found or does not belong to this restaurant');
        }
        if (boy.status === 'inactive' || boy.status === 'offline') {
            throw new Error(`Delivery boy is ${boy.status}. Only active delivery boys can be assigned.`);
        }

        // Check for existing active assignment on this order
        const existing = await this.getActiveAssignmentForOrder(orderId, rid);
        if (existing) {
            if (existing.delivery_boy_id === deliveryBoyId) {
                return existing;
            }
            if (!['ASSIGNED', 'ACCEPTED'].includes(existing.status)) {
                throw new Error(`Cannot reassign: delivery boy has already picked up this order (${existing.status})`);
            }
            // Mark previous assignment as REASSIGNED
            await client
                .from('delivery_assignments')
                .update({
                    status: 'REASSIGNED',
                    cancelled_at: new Date().toISOString(),
                    cancellation_reason: 'Reassigned by admin',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
        }

        // If order was placed, advance to preparing
        if (order.status === 'placed') {
            await client
                .from('orders')
                .update({ status: 'preparing' })
                .eq('id', orderId)
                .eq('restaurant_id', rid);
        }

        // Create assignment
        const { data, error } = await client
            .from('delivery_assignments')
            .insert({
                restaurant_id: rid,
                order_id: orderId,
                delivery_boy_id: deliveryBoyId,
                assigned_by: assignedBy,
                status: 'ASSIGNED',
                assigned_at: new Date().toISOString(),
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                throw new Error('This order already has an active delivery assignment');
            }
            throw error;
        }
        return data;
    },

    async updateAssignmentStatus(
        assignmentId: string,
        restaurantId: string,
        newStatus: DeliveryAssignmentStatus,
        extra?: { cancellation_reason?: string; notes?: string }
    ): Promise<DeliveryAssignment> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) throw new Error('Invalid restaurant ID');

        const client = createClient();

        // Fetch current assignment
        const { data: assignment, error: fetchErr } = await client
            .from('delivery_assignments')
            .select('*')
            .eq('id', assignmentId)
            .eq('restaurant_id', rid)
            .maybeSingle();

        if (fetchErr || !assignment) {
            throw new Error('Assignment not found or does not belong to this restaurant');
        }

        // Validate status transition
        const currentStatus = assignment.status as DeliveryAssignmentStatus;
        const allowedNext = VALID_TRANSITIONS[currentStatus];
        if (!allowedNext || !allowedNext.includes(newStatus)) {
            throw new Error(`Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: ${allowedNext?.join(', ') || 'none'}`);
        }

        // Build update payload with timestamp for the specific status
        const update: any = {
            status: newStatus,
            updated_at: new Date().toISOString(),
        };

        const now = new Date().toISOString();
        switch (newStatus) {
            case 'ACCEPTED': update.accepted_at = now; break;
            case 'PICKED_UP': update.picked_up_at = now; break;
            case 'OUT_FOR_DELIVERY': update.out_for_delivery_at = now; break;
            case 'DELIVERED': update.delivered_at = now; break;
            case 'CANCELLED':
                update.cancelled_at = now;
                if (extra?.cancellation_reason) update.cancellation_reason = extra.cancellation_reason;
                break;
            case 'REASSIGNED':
                update.cancelled_at = now;
                break;
        }

        if (extra?.notes) update.notes = extra.notes;

        const { data, error } = await client
            .from('delivery_assignments')
            .update(update)
            .eq('id', assignmentId)
            .eq('restaurant_id', rid)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async reassignDelivery(
        assignmentId: string,
        restaurantId: string,
        newDeliveryBoyId: string,
        assignedBy: string
    ): Promise<DeliveryAssignment> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) throw new Error('Invalid restaurant ID');

        // Get current assignment
        const current = await this.getAssignmentById(assignmentId, rid);
        if (!current) throw new Error('Assignment not found');

        // Can only reassign before pickup
        if (!['ASSIGNED', 'ACCEPTED'].includes(current.status)) {
            throw new Error(`Cannot reassign after ${current.status}. Only ASSIGNED or ACCEPTED assignments can be reassigned.`);
        }

        // Mark current assignment as REASSIGNED
        await this.updateAssignmentStatus(assignmentId, rid, 'REASSIGNED');

        // Create new assignment for the same order
        return this.createAssignment(rid, current.order_id, newDeliveryBoyId, assignedBy);
    },

    // ════════════════════════════════════════════════════════
    // DELIVERY ORDERS (filtered view of orders)
    // ════════════════════════════════════════════════════════

    async getDeliveryOrders(
        restaurantId: string,
        filters?: { status?: string; limit?: number }
    ): Promise<any[]> {
        const rid = await resolveRestaurantId(restaurantId);
        if (!rid) return [];

        const client = createClient();
        let query = client
            .from('orders')
            .select('*')
            .eq('restaurant_id', rid)
            .eq('order_type', 'DELIVERY')
            .order('created_at', { ascending: false });

        if (filters?.status) {
            query = query.eq('status', filters.status);
        }

        if (filters?.limit) {
            query = query.limit(filters.limit);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[DeliveryService] getDeliveryOrders error:', error.message);
            return [];
        }
        return data || [];
    },

    // ════════════════════════════════════════════════════════
    // REALTIME SUBSCRIPTIONS
    // ════════════════════════════════════════════════════════

    subscribeToAssignments(
        restaurantId: string,
        onChange: (payload: RealtimePostgresChangesPayload<any>) => void
    ) {
        if (!restaurantId) return { unsubscribe: () => {} };

        let resolvedId = restaurantId;
        let isCancelled = false;
        let sub: { unsubscribe: () => void } | null = null;

        resolveRestaurantId(restaurantId).then(rid => {
            if (isCancelled || !rid) return;
            resolvedId = rid;

            const channelKey = `delivery-assignments:${rid}`;
            sub = realtimeManager.subscribe(
                channelKey,
                () => supabase
                    .channel(channelKey)
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'delivery_assignments',
                            filter: `restaurant_id=eq.${rid}`,
                        },
                        (payload) => {
                            const rec = (payload.new || payload.old) as any;
                            if (rec?.restaurant_id && String(rec.restaurant_id) !== String(rid)) return;
                            realtimeManager.dispatch(channelKey, payload);
                        }
                    ),
                onChange
            );
        });

        return {
            unsubscribe: () => {
                isCancelled = true;
                sub?.unsubscribe();
            }
        };
    },

    subscribeToDeliveryBoys(
        restaurantId: string,
        onChange: (payload: RealtimePostgresChangesPayload<any>) => void
    ) {
        if (!restaurantId) return { unsubscribe: () => {} };

        let isCancelled = false;
        let sub: { unsubscribe: () => void } | null = null;

        resolveRestaurantId(restaurantId).then(rid => {
            if (isCancelled || !rid) return;

            const channelKey = `delivery-boys:${rid}`;
            sub = realtimeManager.subscribe(
                channelKey,
                () => supabase
                    .channel(channelKey)
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'delivery_boys',
                            filter: `restaurant_id=eq.${rid}`,
                        },
                        (payload) => {
                            const rec = (payload.new || payload.old) as any;
                            if (rec?.restaurant_id && String(rec.restaurant_id) !== String(rid)) return;
                            realtimeManager.dispatch(channelKey, payload);
                        }
                    ),
                onChange
            );
        });

        return {
            unsubscribe: () => {
                isCancelled = true;
                sub?.unsubscribe();
            }
        };
    },

    subscribeToMyAssignments(
        deliveryBoyId: string,
        restaurantId: string,
        onChange: (payload: RealtimePostgresChangesPayload<any>) => void
    ) {
        if (!deliveryBoyId || !restaurantId) return { unsubscribe: () => {} };

        let isCancelled = false;
        let sub: { unsubscribe: () => void } | null = null;

        resolveRestaurantId(restaurantId).then(rid => {
            if (isCancelled || !rid) return;

            const channelKey = `my-deliveries:${deliveryBoyId}`;
            sub = realtimeManager.subscribe(
                channelKey,
                () => supabase
                    .channel(channelKey)
                    .on(
                        'postgres_changes',
                        {
                            event: '*',
                            schema: 'public',
                            table: 'delivery_assignments',
                            filter: `delivery_boy_id=eq.${deliveryBoyId}`,
                        },
                        (payload) => {
                            realtimeManager.dispatch(channelKey, payload);
                        }
                    ),
                onChange
            );
        });

        return {
            unsubscribe: () => {
                isCancelled = true;
                sub?.unsubscribe();
            }
        };
    },
};
