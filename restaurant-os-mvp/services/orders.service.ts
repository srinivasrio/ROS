import { supabase } from '@/lib/supabase';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { ContextValidator } from '@/lib/context-validator';
import { resolveRestaurantId as cachedResolve } from './utils.service';
import { realtimeManager } from '@/lib/realtime-manager';
import { coalesceRequest, adminCacheManager } from '@/lib/data-cache';
import { CustomerCache } from './homepage-cache.service';
import { CustomerService } from './customers.service';
import { getCategoryMenuItemImage } from '@/lib/utils';
import { isComboItem } from '@/lib/combo-utils';

export type OrderStatus = 'queued' | 'placed' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled';

export interface OrderItem {
    id: string; // Cast BigInt to string for frontend
    name: string;
    quantity: number;
    notes?: string;
    price: number;
    status: OrderStatus; // Added status
    served_at?: string; // Timestamptz
    preparing_at?: string;
    estimated_end_at?: string;
    ready_at?: string;
    extended_minutes?: number;
    image_url?: string;
    item_type?: string;
    combo_id?: string;
    combo_name?: string;
    combo_image?: string;
    combo_items?: any;
    tax_percent?: number;
    cgst_percent?: number;
    sgst_percent?: number;
}

export interface Order {
    id: string;
    order_number: number; // Sequential Order Number
    table_id?: number | null; // Can be null if it's a merged order
    merge_group_id?: string | null; // Set if it's a merged order
    restaurant_id: string;
    customer_id?: string;
    status: OrderStatus;
    total_amount: number;
    gst_amount?: number;
    cgst_amount?: number;
    sgst_amount?: number;
    amount_paid?: number;
    paid_by?: string;
    discount_amount?: number;
    coupon_code?: string | null;
    table_number?: string; // Mapped from tables join
    table_name?: string; // Resolved display name (e.g. Table 1, Table 1+2)
    created_at: string;
    is_completed?: boolean;
    completed_at?: string; // Timestamptz
    items?: OrderItem[]; // Populated via join and mapping
    associated_table_ids?: number[]; // Physical table IDs associated with this order/group
    waiter_id?: string;
    waiter_name?: string;
    waiter_avatar?: string;
    waiter_mobile?: string;
    waiter_employee_id?: string;
    order_type?: string;
    delivery_address?: string;
    delivery_phone?: string;
    customer_phone?: string;
    customer_name?: string;
    delivery_notes?: string;
    delivery_fee?: number;
    delivery_lat?: number | null;
    delivery_lng?: number | null;
    customer_lat?: number | null;
    customer_lng?: number | null;
    delivery_assignment?: {
        id: string;
        status: string;
        delivery_boy_id: string;
        assigned_at?: string;
        accepted_at?: string;
        picked_up_at?: string;
        out_for_delivery_at?: string;
        delivered_at?: string;
        delivery_boy?: {
            id: string;
            name: string;
            mobile: string;
            avatar_url?: string | null;
            vehicle_type?: string;
            vehicle_number?: string;
        } | null;
    } | null;
}

export interface TableMergeGroup {
    id: string;
    display_name: string;
    total_capacity: number;
    status: 'available' | 'occupied';
    created_at: string;
}

export interface RestaurantArea {
    id: string;
    restaurant_id: string;
    name: string;
    display_order: number;
    created_at?: string;
    updated_at?: string;
}

// ... UUID helper ...

// Helper to generate BigInt-ish IDs (since DB is bigint and no serial)
const generateId = () => Math.floor(Date.now() + Math.random() * 1000);

const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

async function retryOperation<T>(operation: () => Promise<T>, maxAttempts = 3, delay = 1000): Promise<T> {
    let lastError: any;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (err: any) {
            lastError = err;
            if (err.code === '23505') {
                throw err; // Stop retrying on duplicate key
            }
            if (attempt < maxAttempts) {
                console.warn(`[Retry] Attempt ${attempt} failed. Retrying in ${delay * attempt}ms...`, err);
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
            }
        }
    }
    throw lastError;
}

const lastPresenceTracked = new Map<string, number>();
const lastStaleChecked = new Map<string, number>();
const inFlightStaleChecks = new Set<string>();

function formatError(err: any): string {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    return err.message || err.details || err.hint || err.code || (typeof err === 'object' ? JSON.stringify(err) : String(err));
}

function isTransientNetworkError(err: any): boolean {
    if (!err) return false;
    const msg = String(err?.message || err?.details || err || '').toLowerCase();
    return msg.includes('failed to fetch') ||
           msg.includes('network') ||
           msg.includes('timeout') ||
           msg.includes('connection refused') ||
           msg.includes('load failed') ||
           msg.includes('aborted');
}


export const OrderService = {
    async resolveRestaurantId(idOrSlug: string): Promise<string> {
        if (!idOrSlug) return '';
        return cachedResolve(idOrSlug);
    },

    /**
     * Defensive checks to verify if an entity ID belongs to a tenant during DELETE events.
     * Prevents cross-tenant DELETE broadcasts from triggering unnecessary re-queries.
     */
    isOrderKnownForTenant(orderId: string | number, tenantId: string): boolean {
        if (!orderId || !tenantId) return false;
        const sOrderId = String(orderId);
        const activeCached = adminCacheManager.get<Order[]>(`orders-${tenantId}`, { tenantId })?.data;
        if (Array.isArray(activeCached) && activeCached.some(o => String(o.id) === sOrderId)) return true;
        const tablesCached = adminCacheManager.get<{ orders?: Order[] }>(`tables-${tenantId}`, { tenantId })?.data;
        if (Array.isArray(tablesCached?.orders) && tablesCached.orders.some(o => String(o.id) === sOrderId)) return true;
        const historyCached = adminCacheManager.get<Order[]>(`history-${tenantId}`, { tenantId })?.data;
        if (Array.isArray(historyCached) && historyCached.some(o => String(o.id) === sOrderId)) return true;
        const kdsCached = adminCacheManager.get<{ orders?: Order[] }>(`kds-${tenantId}`, { tenantId })?.data;
        if (Array.isArray(kdsCached?.orders) && kdsCached.orders.some(o => String(o.id) === sOrderId)) return true;
        return false;
    },

    isTableKnownForTenant(tableId: string | number, tenantId: string): boolean {
        if (!tableId || !tenantId) return false;
        const sTableId = String(tableId);
        const tablesCached = adminCacheManager.get<{ tables?: any[] }>(`tables-${tenantId}`, { tenantId })?.data;
        if (Array.isArray(tablesCached?.tables) && tablesCached.tables.some(t => String(t.id) === sTableId)) return true;
        return false;
    },

    isOrderItemKnownForTenant(itemId: string | number, tenantId: string): boolean {
        if (!itemId || !tenantId) return false;
        const sItemId = String(itemId);
        const activeCached = adminCacheManager.get<Order[]>(`orders-${tenantId}`, { tenantId })?.data;
        if (Array.isArray(activeCached)) {
            for (const o of activeCached) {
                if (Array.isArray(o.items) && o.items.some((i: any) => String(i.id) === sItemId)) return true;
            }
        }
        const tablesCached = adminCacheManager.get<{ orders?: Order[] }>(`tables-${tenantId}`, { tenantId })?.data;
        if (Array.isArray(tablesCached?.orders)) {
            for (const o of tablesCached.orders) {
                if (Array.isArray(o.items) && o.items.some((i: any) => String(i.id) === sItemId)) return true;
            }
        }
        return false;
    },

    isMergeGroupKnownForTenant(groupId: string, tenantId: string): boolean {
        if (!groupId || !tenantId) return false;
        const tablesCached = adminCacheManager.get<{ mergeGroups?: any[] }>(`tables-${tenantId}`, { tenantId })?.data;
        if (Array.isArray(tablesCached?.mergeGroups) && tablesCached.mergeGroups.some(g => String(g.id) === String(groupId))) return true;
        return false;
    },

    isMenuItemKnownForTenant(itemId: string | number, tenantId: string): boolean {
        if (!itemId || !tenantId) return false;
        const sItemId = String(itemId);
        const menuCached = adminCacheManager.get<{ items?: any[] }>(`menu-${tenantId}`, { tenantId })?.data;
        if (Array.isArray(menuCached?.items) && menuCached.items.some(i => String(i.id) === sItemId)) return true;
        return false;
    },

    isServiceRequestKnownForTenant(requestId: string | number, tenantId: string): boolean {
        if (!requestId || !tenantId) return false;
        const sReqId = String(requestId);
        const reqsCached = adminCacheManager.get<any[]>(`service-requests-${tenantId}`, { tenantId })?.data;
        if (Array.isArray(reqsCached) && reqsCached.some((r: any) => String(r.id) === sReqId)) return true;
        return false;
    },


    async getStaffByMobile(mobile: string, restaurantId: string) {
        const actualRestaurantId = await this.resolveRestaurantId(restaurantId);
        if (!actualRestaurantId) return null;

        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('mobile', mobile)
            .eq('restaurant_id', actualRestaurantId);

        if (error) {
            console.error('Error fetching staff by mobile:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            return null;
        }

        // If multiple exist, prioritize the one with 'waiter' role since this is mainly used in waiter contexts
        const waiterStaff = data.find(s => s.role?.toLowerCase() === 'waiter');
        if (waiterStaff) {
            return waiterStaff;
        }

        return data[0];
    },

    /**
     * Finds the active waiter with the lowest workload score.
     * Workload hierarchy:
     * 1. Active tables count (tables occupied/eating/with active orders)
     * 2. Active orders count (uncompleted active orders)
     * 3. last_assigned_at (least recently assigned first)
     */
    async getLeastBusyWaiter(restaurantId: string) {
        const actualRestaurantId = await this.resolveRestaurantId(restaurantId);
        if (!actualRestaurantId) return null;

        // 1. Try atomic DB function first
        try {
            const { data: waiterId, error: rpcErr } = await supabase.rpc('get_least_busy_waiter', {
                p_restaurant_id: actualRestaurantId
            });

            if (!rpcErr && waiterId) {
                const { data: staffMember } = await supabase
                    .from('staff')
                    .select('*')
                    .eq('id', waiterId)
                    .maybeSingle();

                if (staffMember) {
                    return staffMember;
                }
            }
        } catch (err) {
            console.warn('[getLeastBusyWaiter] RPC get_least_busy_waiter failed, falling back to JS calculation:', err);
        }

        // 2. Fallback JS calculation
        const { data: staffData, error: staffError } = await supabase
            .from('employees')
            .select('*')
            .eq('restaurant_id', actualRestaurantId)
            .ilike('role', 'waiter')
            .eq('status', 'active')
            .eq('is_deleted', false);

        if (staffError) {
            console.error('[getLeastBusyWaiter] Error fetching staff:', staffError);
            return null;
        }

        if (!staffData || staffData.length === 0) {
            return null;
        }

        // Filter strictly active & online waiters (available, busy, online; not offline or break)
        const availableStaff = staffData.filter(s => {
            const status = (s.availability_status || '').toLowerCase();
            return s.status === 'active' &&
                   !s.is_deleted &&
                   (s.is_online === true || status === 'available' || status === 'busy' || status === 'online') &&
                   status !== 'offline' && status !== 'break';
        });

        if (availableStaff.length === 0) {
            return null;
        }

        // Fetch all physical tables assigned to waiters at this restaurant
        const { data: tablesData } = await supabase
            .from('tables')
            .select('id, assigned_waiter_id, status')
            .eq('restaurant_id', actualRestaurantId)
            .not('assigned_waiter_id', 'is', null);

        // Fetch all active merge groups
        const { data: groupsData } = await supabase
            .from('table_merge_groups')
            .select('id, assigned_waiter_id, status')
            .eq('restaurant_id', actualRestaurantId)
            .not('assigned_waiter_id', 'is', null);

        // Fetch all active uncompleted orders
        const { data: activeOrdersData } = await supabase
            .from('orders')
            .select('id, waiter_id, table_id, merge_group_id, status, is_completed')
            .eq('restaurant_id', actualRestaurantId)
            .not('waiter_id', 'is', null)
            .eq('is_completed', false)
            .not('status', 'in', '("cancelled","paid","completed")');

        // Calculate active tables (unique table/group keys) and orders count per waiter
        const activeTablesPerWaiter: Record<string, Set<string>> = {};
        const activeOrdersPerWaiter: Record<string, number> = {};

        availableStaff.forEach(s => {
            activeTablesPerWaiter[s.id] = new Set();
            activeOrdersPerWaiter[s.id] = 0;
        });

        // Count active assigned tables
        (tablesData || []).forEach(t => {
            if (t.assigned_waiter_id && activeTablesPerWaiter[t.assigned_waiter_id]) {
                if (t.status !== 'empty' && t.status !== 'free' && t.status !== 'available' && t.status !== 'cleaning') {
                    activeTablesPerWaiter[t.assigned_waiter_id].add(`table_${t.id}`);
                }
            }
        });

        // Count active assigned merge groups
        (groupsData || []).forEach(g => {
            if (g.assigned_waiter_id && activeTablesPerWaiter[g.assigned_waiter_id]) {
                if (g.status !== 'empty' && g.status !== 'free' && g.status !== 'available' && g.status !== 'cleaning') {
                    activeTablesPerWaiter[g.assigned_waiter_id].add(`group_${g.id}`);
                }
            }
        });

        // Count active orders and tables with active orders
        (activeOrdersData || []).forEach(o => {
            if (o.waiter_id && activeOrdersPerWaiter[o.waiter_id] !== undefined) {
                activeOrdersPerWaiter[o.waiter_id]++;
                if (o.table_id && activeTablesPerWaiter[o.waiter_id]) {
                    activeTablesPerWaiter[o.waiter_id].add(`table_${o.table_id}`);
                } else if (o.merge_group_id && activeTablesPerWaiter[o.waiter_id]) {
                    activeTablesPerWaiter[o.waiter_id].add(`group_${o.merge_group_id}`);
                }
            }
        });

        // Map and sort staff by (activeTablesCount ASC, activeOrdersCount ASC, lastAssigned ASC NULLS FIRST)
        const waitersWithWorkload = availableStaff.map(waiter => {
            const activeTablesCount = activeTablesPerWaiter[waiter.id]?.size || 0;
            const activeOrdersCount = activeOrdersPerWaiter[waiter.id] || 0;
            const lastAssigned = waiter.last_assigned_at ? new Date(waiter.last_assigned_at).getTime() : 0;

            return {
                waiter,
                activeTablesCount,
                activeOrdersCount,
                lastAssigned
            };
        });

        waitersWithWorkload.sort((a, b) => {
            if (a.activeTablesCount !== b.activeTablesCount) {
                return a.activeTablesCount - b.activeTablesCount;
            }
            if (a.activeOrdersCount !== b.activeOrdersCount) {
                return a.activeOrdersCount - b.activeOrdersCount;
            }
            if (a.lastAssigned !== b.lastAssigned) {
                return a.lastAssigned - b.lastAssigned;
            }
            return String(a.waiter.id).localeCompare(String(b.waiter.id));
        });

        return waitersWithWorkload[0].waiter;
    },

    /**
     * Tracks customer presence at a table/group based on interactions.
     * Transitions status from empty/free to customer_present and updates timestamps.
    /**
     * Puts a table On Hold when opened by a waiter or customer
     */
    async holdTable(tableIdentifier: string | number, restaurantId: string, waiterId?: string) {
        if (!tableIdentifier || typeof tableIdentifier === 'object' || String(tableIdentifier).trim() === '{}') return;
        const actualRestaurantId = await this.resolveRestaurantId(restaurantId);
        if (!actualRestaurantId) return;

        const physicalTable = await this.findTableAnywhere(tableIdentifier, actualRestaurantId);
        if (!physicalTable) return;

        const isGroup = 'display_name' in physicalTable;
        const recordId = physicalTable.id;
        const currentStatus = physicalTable.status;
        const now = new Date().toISOString();

        // Only place on hold if empty, free, or already on_hold
        if (currentStatus !== 'empty' && currentStatus !== 'free' && currentStatus !== 'customer_present' && currentStatus !== 'on_hold') {
            return;
        }

        // Assign specific waiter if provided, else keep existing, else assign least busy waiter
        let assignedWaiterId = waiterId || physicalTable.assigned_waiter_id;
        let waiterAssignedJustNow = false;
        if (!assignedWaiterId) {
            const leastBusy = await this.getLeastBusyWaiter(actualRestaurantId);
            if (leastBusy) {
                assignedWaiterId = leastBusy.id;
                waiterAssignedJustNow = true;
            }
        }

        const updateData: any = {
            status: 'on_hold',
            last_activity_at: now
        };

        if (assignedWaiterId) {
            updateData.assigned_waiter_id = assignedWaiterId;
        }

        if (isGroup) {
            await supabase.from('table_merge_groups').update(updateData).eq('id', recordId);
            const { data: memberTables } = await supabase.from('tables').select('id').eq('merged_group_id', recordId);
            if (memberTables && memberTables.length > 0) {
                await supabase.from('tables').update(updateData).in('id', memberTables.map(t => t.id));
            }
        } else {
            await supabase.from('tables').update(updateData).eq('id', recordId);
        }

        if (waiterAssignedJustNow && assignedWaiterId) {
            await supabase.from('employees').update({ last_assigned_at: now }).eq('id', assignedWaiterId);
        }
    },

    /**
     * Releases hold when waiter/customer leaves opened table, restoring it to empty if no active order exists
     */
    async releaseTableHold(tableIdentifier: string | number, restaurantId: string) {
        if (!tableIdentifier || typeof tableIdentifier === 'object' || String(tableIdentifier).trim() === '{}') return;
        const actualRestaurantId = await this.resolveRestaurantId(restaurantId);
        if (!actualRestaurantId) return;

        const physicalTable = await this.findTableAnywhere(tableIdentifier, actualRestaurantId);
        if (!physicalTable) return;

        // CRITICAL: releaseTableHold ONLY releases tables that are currently 'on_hold'.
        // Never touch tables that are cleaning, dirty, occupied, need_bill, billing, etc.
        // A table must ONLY become available when waiter or admin explicitly clears the table.
        if (physicalTable.status !== 'on_hold') {
            return;
        }

        const isGroup = 'display_name' in physicalTable;
        const recordId = physicalTable.id;

        // Check if there are active orders for this table
        const activeOrder = await this.getActiveOrderForTable(tableIdentifier, actualRestaurantId);

        // If an active in-progress order exists, do not release
        if (activeOrder && !activeOrder.is_completed && !['paid', 'cancelled'].includes(activeOrder.status)) {
            return;
        }

        // Check if there is any recently completed/paid order on this table that hasn't been cleared yet
        // If so, the table belongs in 'cleaning' state until staff explicitly clears it.
        const { data: recentOrder } = await supabase
            .from('orders')
            .select('id, status, is_completed')
            .eq(isGroup ? 'merge_group_id' : 'table_id', recordId)
            .eq('restaurant_id', actualRestaurantId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (recentOrder && (recentOrder.status === 'paid' || recentOrder.is_completed)) {
            // Table has completed payment and is awaiting cleaning; do not mark available!
            return;
        }

        // Release hold & return table to available ONLY if it is still 'on_hold'
        const resetData = {
            status: 'available',
            assigned_waiter_id: null,
            co_waiter_ids: [],
            customer_present_at: null,
            last_activity_at: null,
            alert_status: null,
            transferred_from_waiter_id: null,
            transferred_to_waiter_id: null
        };

        if (isGroup) {
            await supabase.from('table_merge_groups').update(resetData).eq('id', recordId).eq('status', 'on_hold');
            const { data: memberTables } = await supabase.from('tables').select('id').eq('merged_group_id', recordId);
            if (memberTables && memberTables.length > 0) {
                await supabase.from('tables').update(resetData).in('id', memberTables.map(t => t.id)).eq('status', 'on_hold');
            }
        } else {
            await supabase.from('tables').update(resetData).eq('id', recordId).eq('status', 'on_hold');
        }
    },

    /**
     * Tracks customer presence when scanning or viewing table.
     * Performs auto-waiter assignment if no waiter is assigned.
     */
    async trackCustomerPresence(tableIdentifier: string | number, restaurantId: string, customStatus?: string, forcedWaiterId?: string) {
        const actualRestaurantId = await this.resolveRestaurantId(restaurantId);
        if (!actualRestaurantId) return;

        // Cooldown check: Skip standard presence tracking if run within the last 60 seconds
        const presenceKey = `${actualRestaurantId}-${tableIdentifier}`;
        const lastTime = lastPresenceTracked.get(presenceKey);
        const nowMs = Date.now();
        if (!customStatus && lastTime && nowMs - lastTime < 60000) {
            return;
        }
        if (!customStatus) {
            lastPresenceTracked.set(presenceKey, nowMs);
        }

        const physicalTable = await this.findTableAnywhere(tableIdentifier, actualRestaurantId);
        if (!physicalTable) {
            console.warn(`[trackCustomerPresence] Could not resolve table: ${tableIdentifier}`);
            return;
        }

        const isGroup = 'display_name' in physicalTable;
        const recordId = physicalTable.id;
        const currentStatus = physicalTable.status;
        const now = new Date().toISOString();

        // 1. Determine status change
        let nextStatus = currentStatus;
        if (customStatus) {
            nextStatus = customStatus;
        } else if (currentStatus === 'empty' || currentStatus === 'free' || currentStatus === 'customer_present' || currentStatus === 'available') {
            nextStatus = 'on_hold';
        }

        // 2. Resolve/Assign waiter if not already assigned
        // If table is free/available, allow forcedWaiterId to seat/assign.
        // If table is already occupied/eating, strictly preserve physicalTable.assigned_waiter_id to prevent table hijacking.
        const isTableFree = ['available', 'free', 'empty'].includes((currentStatus || '').toLowerCase());
        let assignedWaiterId: string | null = physicalTable.assigned_waiter_id || forcedWaiterId || null;
        let waiterAssignedJustNow = false;
        if (!assignedWaiterId) {
            const leastBusyWaiter = await this.getLeastBusyWaiter(actualRestaurantId);
            if (leastBusyWaiter) {
                assignedWaiterId = leastBusyWaiter.id;
                waiterAssignedJustNow = true;
            }
        }

        // 3. Update table/group status and presence timestamps
        const updateData: any = {
            status: nextStatus,
            customer_present_at: physicalTable.customer_present_at || now,
            last_activity_at: now
        };

        if (assignedWaiterId) {
            updateData.assigned_waiter_id = assignedWaiterId;
        }

        if (isGroup) {
            // Update merge group
            const { error: groupError } = await supabase
                .from('table_merge_groups')
                .update(updateData)
                .eq('id', recordId);

            if (groupError) {
                console.error('[trackCustomerPresence] Failed to update merge group:', groupError);
            }

            // Also update all constituent physical tables
            const { data: memberTables } = await supabase
                .from('tables')
                .select('id')
                .eq('merged_group_id', recordId);

            if (memberTables && memberTables.length > 0) {
                const memberIds = memberTables.map(t => t.id);
                await supabase
                    .from('tables')
                    .update(updateData)
                    .in('id', memberIds);
            }
        } else {
            // Update individual physical table
            const { error: tableError } = await supabase
                .from('tables')
                .update(updateData)
                .eq('id', recordId);

            if (tableError) {
                console.error('[trackCustomerPresence] Failed to update physical table:', tableError);
            }
        }

        // 4. Update waiter's last_assigned_at if they were newly assigned to prevent race condition ties
        if (waiterAssignedJustNow && assignedWaiterId) {
            await supabase
                .from('staff')
                .update({ last_assigned_at: now })
                .eq('id', assignedWaiterId);
        }
    },

    /**
     * Checks all tables and merge groups for inactivity.
     * If a table has been inactive for more than 4 hours, auto-resets it.
     */
    async checkAndResetStaleTables(restaurantId: string) {
        try {
            const actualRestaurantId = await this.resolveRestaurantId(restaurantId);
            if (!actualRestaurantId) return;

            // In-flight guard: don't run concurrent checks for the same restaurant
            if (inFlightStaleChecks.has(actualRestaurantId)) return;

            // Throttle: run at most once every 5 minutes per restaurant to prevent duplicate load
            const nowMs = Date.now();
            const lastCheck = lastStaleChecked.get(actualRestaurantId);
            if (lastCheck && nowMs - lastCheck < 300000) {
                return;
            }
            lastStaleChecked.set(actualRestaurantId, nowMs);
            inFlightStaleChecks.add(actualRestaurantId);

            try {
                // 4 hours ago threshold for generic inactivity; 15 minutes for on_hold tables
            const threshold = new Date(nowMs - 4 * 60 * 60 * 1000).toISOString();
            const holdThreshold = new Date(nowMs - 15 * 60 * 1000).toISOString();

            // 1. Check stale tables (either inactive for 4h or on_hold for 15m)
            const { data: staleTables, error: tablesError } = await supabase
                .from('tables')
                .select('*')
                .eq('restaurant_id', actualRestaurantId)
                .eq('is_merged', false)
                .or(`and(status.eq.on_hold,last_activity_at.lt.${holdThreshold}),and(last_activity_at.not.is.null,last_activity_at.lt.${threshold})`);

            if (tablesError) {
                console.warn('[checkAndResetStaleTables] Error checking tables:', formatError(tablesError));
            } else if (staleTables && staleTables.length > 0) {
            for (const table of staleTables) {
                console.log(`[checkAndResetStaleTables] Resetting stale table ${table.table_number}`);
                // Archive pending orders
                await supabase
                    .from('orders')
                    .update({ is_completed: true, status: 'paid', completed_at: new Date().toISOString() })
                    .eq('table_id', table.id)
                    .eq('restaurant_id', actualRestaurantId)
                    .eq('is_completed', false);

                // Delete pending alerts/service requests
                await supabase
                    .from('service_requests')
                    .delete()
                    .eq('table_id', table.id);

                // Reset table properties to genuinely available
                await supabase
                    .from('tables')
                    .update({
                        status: 'available',
                        assigned_waiter_id: null,
                        co_waiter_ids: [],
                        customer_present_at: null,
                        last_activity_at: null,
                        alert_status: null,
                        transferred_from_waiter_id: null,
                        transferred_to_waiter_id: null
                    })
                    .eq('id', table.id);
            }
        }

        // 2. Check stale merge groups
        const { data: staleGroups, error: groupsError } = await supabase
            .from('table_merge_groups')
            .select('*')
            .eq('restaurant_id', actualRestaurantId)
            .not('last_activity_at', 'is', null)
            .lt('last_activity_at', threshold);

        if (groupsError) {
            console.warn('[checkAndResetStaleTables] Error checking merge groups:', formatError(groupsError));
        } else if (staleGroups && staleGroups.length > 0) {
            for (const group of staleGroups) {
                console.log(`[checkAndResetStaleTables] Resetting stale merge group ${group.id}`);
                // Archive pending orders
                await supabase
                    .from('orders')
                    .update({ is_completed: true })
                    .eq('merge_group_id', group.id)
                    .eq('restaurant_id', actualRestaurantId)
                    .eq('is_completed', false);

                // Get constituent tables to clear their alerts
                const { data: memberTables } = await supabase
                    .from('tables')
                    .select('id')
                    .eq('merged_group_id', group.id);

                if (memberTables && memberTables.length > 0) {
                    const memberIds = memberTables.map(t => t.id);
                    await supabase
                        .from('service_requests')
                        .delete()
                        .in('table_id', memberIds);
                }

                // Reset merge group status and unmerge tables
                await this.clearTable(group.id, actualRestaurantId);
            }
        }
            } finally {
                inFlightStaleChecks.delete(actualRestaurantId);
            }
        } catch (err: any) {
            console.warn('[checkAndResetStaleTables] Failed to check/reset stale tables:', formatError(err));
        }
    },

    /**
     * Fetch all active orders (placed, preparing, ready) with their items.
     */
    async fetchActiveOrders(restaurantId: string, waiterId?: string) {
        return coalesceRequest(`active_orders:${restaurantId}:${waiterId || 'all'}`, async () => {
            const actualId = await this.resolveRestaurantId(restaurantId);
            
            let query = supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        menu_items!order_items_menu_item_id_restaurant_fkey (name, image_url)
                    ),
                    staff:waiter_id (name, mobile, avatar_url, role, employee_id),
                    tables:table_id (table_number)
                `)
                .eq('is_completed', false) // Only active orders
                .in('status', ['placed', 'preparing', 'ready', 'served', 'paid'])
                .order('created_at', { ascending: true });

            query = query.eq('restaurant_id', actualId);

            if (waiterId) {
                // Either assigned to me or unassigned
                query = query.or(`waiter_id.eq.${waiterId},waiter_id.is.null`);
            }

            let data: any = null;
            let error: any = null;
            for (let attempt = 1; attempt <= 2; attempt++) {
                const res = await query;
                data = res.data;
                error = res.error;
                if (!error) break;
                if (isTransientNetworkError(error) && attempt < 2) {
                    await new Promise(r => setTimeout(r, 600));
                    continue;
                }
                break;
            }

            if (error) {
                if (isTransientNetworkError(error)) {
                    console.warn('[fetchActiveOrders] Transient network error encountered:', formatError(error));
                    return [];
                }
                console.error('Error fetching orders:', formatError(error));
                throw new Error(`Error fetching orders: ${formatError(error)}`);
            }

            // Fetch delivery assignments for active delivery orders
            const deliveryOrderIds = (data || [])
                .filter((o: any) => o.order_type === 'DELIVERY')
                .map((o: any) => o.id);

            let deliveryAssignmentsMap: Record<string, any> = {};

            if (deliveryOrderIds.length > 0) {
                try {
                    const { data: assignments } = await supabase
                        .from('delivery_assignments')
                        .select('id, order_id, status, delivery_boy_id, assigned_at, accepted_at, picked_up_at, out_for_delivery_at, delivered_at')
                        .in('order_id', deliveryOrderIds)
                        .not('status', 'in', '("CANCELLED","REASSIGNED")');

                    if (assignments && assignments.length > 0) {
                        const boyIds = [...new Set(assignments.map(a => a.delivery_boy_id).filter(Boolean))];
                        const { data: boys } = boyIds.length > 0 ? await supabase
                            .from('delivery_boys')
                            .select('id, employee_id, vehicle_type, vehicle_number')
                            .in('id', boyIds) : { data: [] };

                        const empIds = [...new Set((boys || []).map(b => b.employee_id).filter(Boolean))];
                        const { data: emps } = empIds.length > 0 ? await supabase
                            .from('employees')
                            .select('id, name, mobile, avatar_url')
                            .in('id', empIds) : { data: [] };

                        const empMap = new Map((emps || []).map(e => [e.id, e]));
                        const boyMap = new Map((boys || []).map(b => [b.id, {
                            ...b,
                            name: empMap.get(b.employee_id)?.name || 'Delivery Partner',
                            mobile: empMap.get(b.employee_id)?.mobile || '',
                            avatar_url: empMap.get(b.employee_id)?.avatar_url || null,
                        }]));

                        for (const a of assignments) {
                            const db = boyMap.get(a.delivery_boy_id);
                            deliveryAssignmentsMap[a.order_id] = {
                                ...a,
                                delivery_boy: db,
                            };
                        }
                    }
                } catch (e) {
                    console.error('Error fetching active delivery assignments:', e);
                }
            }

            // Transform for easier consumption
            return data?.map((order: any) => ({
                ...order,
                delivery_assignment: deliveryAssignmentsMap[order.id] || null,
                waiter_name: order.staff?.name,
                waiter_avatar: order.staff?.avatar_url,
                waiter_mobile: order.staff?.mobile,
                waiter_role: order.staff?.role,
                waiter_employee_id: order.staff?.employee_id,
                table_number: order.tables?.table_number,
                items: order.order_items
                    .filter((item: any) => item.status !== 'queued') // Filter out queued items from KDS/Active view
                    .map((item: any) => {
                        const mi = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items;
                        const resolvedName = item.combo_name || mi?.name || item.name || item.item_name || (item.item_type === 'combo' ? 'Combo' : (item.item_type === 'special' ? 'Special' : `Item #${item.menu_item_id || item.id}`));
                        const resolvedImage = item.combo_image || mi?.image_url || item.image_url;
                        let parsedComboItems = item.combo_items;
                        if (typeof parsedComboItems === 'string') {
                            try {
                                parsedComboItems = JSON.parse(parsedComboItems);
                            } catch {
                                parsedComboItems = null;
                            }
                        }
                        return {
                            ...item,
                            id: String(item.id), // Ensure string for frontend
                            name: resolvedName,
                            quantity: item.quantity,
                            notes: item.notes,
                            price: item.price_at_time, // CORRECT COLUMN
                            status: item.status || order.status, // Fallback to order status if null
                            served_at: item.served_at,
                            preparing_at: item.preparing_at,
                            estimated_end_at: item.estimated_end_at,
                            ready_at: item.ready_at,
                            extended_minutes: item.extended_minutes,
                            image_url: resolvedImage,
                            item_type: item.item_type || (parsedComboItems ? 'combo' : 'standard'),
                            combo_items: parsedComboItems
                        };
                    })
            })) as Order[];
        });
    },

    /**
     * Fetch completed/history orders (served, paid, cancelled).
     */
    async fetchHistoryOrders(restaurantId: string) {
        return coalesceRequest(`history_orders:${restaurantId}`, async () => {
            const actualId = await this.resolveRestaurantId(restaurantId);

            let query = supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        menu_items!order_items_menu_item_id_restaurant_fkey (name, image_url)
                    ),
                    tables:table_id (table_number)
                `)
                .eq('is_completed', true) // Only archived orders
                .in('status', ['served', 'paid', 'cancelled'])
                .order('created_at', { ascending: false });

            const { data, error } = await query.eq('restaurant_id', actualId);

            if (error) {
                console.error('Error fetching history:', error);
                throw error;
            }

            return data?.map(order => ({
                ...order,
                table_number: (order as any).tables?.table_number,
                items: order.order_items.map((item: any) => {
                    let parsedComboItems = item.combo_items;
                    if (typeof parsedComboItems === 'string') {
                        try {
                            parsedComboItems = JSON.parse(parsedComboItems);
                        } catch {
                            parsedComboItems = null;
                        }
                    }
                    return {
                        ...item,
                        id: String(item.id),
                        name: item.combo_name || item.menu_items?.name || item.name || item.item_name || (item.item_type === 'combo' ? 'Combo' : (item.item_type === 'special' ? 'Special' : 'Unknown Item')),
                        quantity: item.quantity,
                        notes: item.notes,
                        price: item.price_at_time,
                        served_at: item.served_at,
                        image_url: item.combo_image || item.menu_items?.image_url || item.image_url,
                        item_type: item.item_type || (parsedComboItems ? 'combo' : 'standard'),
                        combo_items: parsedComboItems
                    };
                })
            })) as Order[];
        });
    },

    /**
     * Fetch table information including restaurant_id.
     */
    async getTableInfo(tableId: number) {
        const { data, error } = await supabase
            .from('tables')
            .select('*')
            .eq('id', tableId)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Fetch merge group information including restaurant_id.
     */
    async getMergeGroupInfo(mergeGroupId: string) {
        const { data, error } = await supabase
            .from('table_merge_groups')
            .select('*')
            .eq('id', mergeGroupId)
            .maybeSingle();

        if (error) throw error;
        return data;
    },

    /**
     * Find table and restaurant info from a table ID (used for redirection)
     */
    async findTableAnywhere(tableId: string | number, restaurantId?: string): Promise<any> {
        if (tableId === undefined || tableId === null || tableId === '' || typeof tableId === 'object') return null;
        const rawString = String(tableId).trim();
        if (!rawString || rawString === '{}' || rawString === '[]' || rawString === '[object Object]' || rawString === 'undefined' || rawString === 'null' || rawString === 'NaN') return null;

        const actualRestaurantId = restaurantId ? (await this.resolveRestaurantId(restaurantId)) : undefined;

        const applyRestaurantFilter = (q: any) => {
            if (!restaurantId) return q;
            if (actualRestaurantId && actualRestaurantId !== restaurantId) {
                return q.or(`restaurant_id.eq.${restaurantId},restaurant_id.eq.${actualRestaurantId}`);
            }
            return q.eq('restaurant_id', restaurantId);
        };

        const decoded = decodeURIComponent(rawString).trim();
        const withoutPrefix = decoded.replace(/^table\s*[-_]?\s*/i, '').trim();
        const withPrefix = withoutPrefix ? ('Table ' + withoutPrefix) : '';
        const compact = decoded.replace(/\s+/g, '');
        const compactNoPrefix = withoutPrefix.replace(/\s+/g, '');
        const spacedPlus = withoutPrefix.replace(/\s*\+\s*/g, ' + ');
        const densePlus = withoutPrefix.replace(/\s*\+\s*/g, '+');
        const tableSpacedPlus = 'Table ' + spacedPlus;
        const tableDensePlus = 'Table ' + densePlus;

        const candidates = Array.from(new Set([
            decoded,
            withoutPrefix,
            withPrefix,
            compact,
            compactNoPrefix,
            spacedPlus,
            densePlus,
            tableSpacedPlus,
            tableDensePlus
        ].filter(Boolean)));

        // 1. UUID check for table_merge_groups
        if (decoded.includes('-') && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded)) {
            let uuidQuery = supabase.from('table_merge_groups').select('*').eq('id', decoded);
            uuidQuery = applyRestaurantFilter(uuidQuery);
            const { data: byUuid } = await uuidQuery.maybeSingle();
            if (byUuid) return byUuid;
        }

        // 2. table_merge_groups check by display_name
        let mgQuery = supabase.from('table_merge_groups').select('*').in('display_name', candidates);
        mgQuery = applyRestaurantFilter(mgQuery);
        const { data: mergeGroup } = await mgQuery.maybeSingle();
        if (mergeGroup) return mergeGroup;

        // 3. Physical tables check by table_number
        let tQuery = supabase.from('tables').select('*').in('table_number', candidates);
        tQuery = applyRestaurantFilter(tQuery);
        const { data: physicalTable } = await tQuery.maybeSingle();
        if (physicalTable) {
            if (physicalTable.is_merged && physicalTable.merged_group_id) {
                // If table is merged into a group, resolve to the merge group
                return this.findTableAnywhere(physicalTable.merged_group_id, restaurantId);
            }
            return physicalTable;
        }

        // 4. Fallback: check physical tables by primary key ID (bigint)
        const numId = Number(withoutPrefix);
        if (!isNaN(numId) && Number.isInteger(numId)) {
            let tableByIdQuery = supabase.from('tables').select('*').eq('id', numId);
            tableByIdQuery = applyRestaurantFilter(tableByIdQuery);
            const { data: byId } = await tableByIdQuery.maybeSingle();
            if (byId) {
                if (byId.is_merged && byId.merged_group_id) {
                    return this.findTableAnywhere(byId.merged_group_id, restaurantId);
                }
                return byId;
            }
        }

        return null;
    },

    /**
     * Verify if a table exists and return its info.
     */
    async verifyTableExists(restaurantId: string, tableId: number | string) {
        if (!tableId || typeof tableId === 'object' || String(tableId).trim() === '{}' || String(tableId).trim() === '[object Object]') return null;
        if (!restaurantId || typeof restaurantId === 'object' || String(restaurantId).trim() === '{}') return null;
        const normalized = String(tableId).trim().toLowerCase();
        if (normalized === 'takeaway' || normalized === 'delivery') {
            return {
                id: normalized,
                table_number: normalized,
                display_name: normalized === 'takeaway' ? 'Takeaway' : 'Delivery',
                is_virtual: true,
            } as any;
        }
        const actualId = await this.resolveRestaurantId(restaurantId);
        return this.findTableAnywhere(tableId, actualId);
    },

    /**
     * Add a new table to the database.
     */
    async addTable(tableNumber: string, capacity: number, restaurantId: string, areaId?: string) {
        const actualRestaurantId = await this.resolveRestaurantId(restaurantId);
        
        let finalAreaId = areaId;
        if (!finalAreaId) {
            const { data: defaultArea } = await supabase
                .from('restaurant_areas')
                .select('id')
                .eq('restaurant_id', actualRestaurantId)
                .order('display_order', { ascending: true })
                .limit(1)
                .single();
            if (defaultArea) {
                finalAreaId = defaultArea.id;
            }
        }

        // 1. Check if table_number already exists for this area
        let query = supabase
            .from('tables')
            .select('id')
            .eq('restaurant_id', actualRestaurantId)
            .eq('table_number', tableNumber);
            
        if (finalAreaId) {
            query = query.eq('area_id', finalAreaId);
        }

        const { data: existingTable } = await query.maybeSingle();

        if (existingTable) {
            throw new Error(`Table '${tableNumber}' already exists in this area.`);
        }

        // 2. Insert into tables (Database auto-generates the ID)
        const { data, error } = await supabase
            .from('tables')
            .insert({
                table_number: tableNumber,
                capacity: capacity,
                status: 'free',
                is_merged: false,
                restaurant_id: actualRestaurantId,
                area_id: finalAreaId || null
            })
            .select()
            .single();

        if (error) {
            console.error('[addTable] Supabase Error:', error);
            throw new Error(error.message || 'Failed to add table');
        }
        return data;
    },

    /**
     * Update an existing table.
     */
    async updateTable(tableId: number, tableNumber: string, capacity: number, restaurantId: string, areaId?: string) {
        const actualRestaurantId = await this.resolveRestaurantId(restaurantId);
        
        let finalAreaId = areaId;
        if (!finalAreaId) {
            // Check existing table's area if not provided
            const { data: currentTable } = await supabase
                .from('tables')
                .select('area_id')
                .eq('id', tableId)
                .single();
            if (currentTable?.area_id) {
                finalAreaId = currentTable.area_id;
            } else {
                const { data: defaultArea } = await supabase
                    .from('restaurant_areas')
                    .select('id')
                    .eq('restaurant_id', actualRestaurantId)
                    .order('display_order', { ascending: true })
                    .limit(1)
                    .single();
                if (defaultArea) finalAreaId = defaultArea.id;
            }
        }

        // Check if new table_number already exists for a DIFFERENT table in the same area
        let query = supabase
            .from('tables')
            .select('id')
            .eq('restaurant_id', actualRestaurantId)
            .eq('table_number', tableNumber)
            .neq('id', tableId);
            
        if (finalAreaId) {
            query = query.eq('area_id', finalAreaId);
        }

        const { data: existingTable } = await query.maybeSingle();

        if (existingTable) {
            throw new Error(`Table '${tableNumber}' already exists in this area.`);
        }

        const { data, error } = await supabase
            .from('tables')
            .update({ table_number: tableNumber, capacity: capacity, area_id: finalAreaId || null })
            .eq('id', tableId)
            .eq('restaurant_id', actualRestaurantId)
            .select()
            .single();

        if (error) {
            console.error('[updateTable] Supabase Error:', error);
            throw new Error(error.message || 'Failed to update table');
        }
        return data;
    },

    /**
     * Delete a table (only empty/free tables).
     */
    async deleteTable(tableId: number, restaurantId: string) {
        const actualRestaurantId = await this.resolveRestaurantId(restaurantId);

        // 1. Check if there are any active (non-completed) orders on this table
        const { data: activeOrders } = await supabase
            .from('orders')
            .select('id, status')
            .eq('table_id', tableId)
            .eq('restaurant_id', actualRestaurantId)
            .eq('is_completed', false)
            .limit(1);

        if (activeOrders && activeOrders.length > 0) {
            throw new Error('Cannot delete table while it has an active order. Please settle or clear the table first.');
        }

        // 2. Dissociate past orders from this table to ensure historical stats remain safe
        await supabase
            .from('orders')
            .update({ table_id: null })
            .eq('table_id', tableId)
            .eq('restaurant_id', actualRestaurantId);

        // 3. Delete any waiter assignments for this table
        await supabase
            .from('waiter_assignments')
            .delete()
            .eq('table_id', tableId);

        // 4. Delete the table record
        const { error } = await supabase
            .from('tables')
            .delete()
            .eq('id', tableId)
            .eq('restaurant_id', actualRestaurantId);
        if (error) throw error;
    },

    /**
     * Fetch all physical tables.
     */
    async fetchTables(restaurantId: string, waiterId?: string) {
        return coalesceRequest(`tables:${restaurantId}:${waiterId || 'all'}`, async () => {
            const actualId = await this.resolveRestaurantId(restaurantId);

            try {
                // Run asynchronously to not block table fetching
                this.checkAndResetStaleTables(actualId).catch(err => console.error('Failed to reset stale tables:', err));
            } catch (resetErr) {
                console.error('Failed to reset stale tables:', resetErr);
            }

            let query = supabase
                .from('tables')
                .select('*, restaurant_areas(name), assigned_waiter:employees!tables_assigned_waiter_id_fkey(id, name, avatar_url)')
                .order('table_number', { ascending: true });

            query = query.eq('restaurant_id', actualId);

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching tables:', error);
                throw error;
            }
            
            // Map area_name, assigned_waiter_name, and assigned_waiter_avatar onto table objects
            const mappedData = (data || []).map((t: any) => ({
                ...t,
                area_name: t.restaurant_areas?.name || 'Default Area',
                assigned_waiter_name: t.assigned_waiter?.name || t.assigned_waiter_name || null,
                assigned_waiter_avatar: t.assigned_waiter?.avatar_url || t.assigned_waiter_avatar || null,
            }));
            
            return mappedData;
        });
    },

    /**
     * Fetch all areas for a restaurant.
     */
    async fetchAreas(restaurantId: string): Promise<RestaurantArea[]> {
        return coalesceRequest(`areas:${restaurantId}`, async () => {
            const actualId = await this.resolveRestaurantId(restaurantId);
            const { data, error } = await supabase
                .from('restaurant_areas')
                .select('*')
                .eq('restaurant_id', actualId)
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: true });
                
            if (error) {
                console.error('Error fetching areas:', error);
                throw error;
            }
            return data || [];
        });
    },

    /**
     * Create a new area for a restaurant.
     */
    async createArea(restaurantId: string, name: string, displayOrder: number = 0) {
        const actualId = await this.resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('restaurant_areas')
            .insert({
                restaurant_id: actualId,
                name: name,
                display_order: displayOrder
            })
            .select()
            .single();

        if (error) throw new Error(error.message || 'Failed to create area');
        return data;
    },

    /**
     * Update an existing area.
     */
    async updateArea(areaId: string, restaurantId: string, updates: Partial<RestaurantArea>) {
        const actualId = await this.resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('restaurant_areas')
            .update(updates)
            .eq('id', areaId)
            .eq('restaurant_id', actualId)
            .select()
            .single();

        if (error) throw new Error(error.message || 'Failed to update area');
        return data;
    },

    /**
     * Delete an area (only if it has no tables).
     */
    async deleteArea(areaId: string, restaurantId: string) {
        const actualId = await this.resolveRestaurantId(restaurantId);
        
        // Check for tables
        const { count, error: countError } = await supabase
            .from('tables')
            .select('*', { count: 'exact', head: true })
            .eq('area_id', areaId)
            .eq('restaurant_id', actualId);
            
        if (countError) throw new Error(countError.message);
        if (count && count > 0) throw new Error('Cannot delete area containing tables');

        const { error } = await supabase
            .from('restaurant_areas')
            .delete()
            .eq('id', areaId)
            .eq('restaurant_id', actualId);

        if (error) throw new Error(error.message || 'Failed to delete area');
        return true;
    },

    /**
     * Fetch all active table merge groups.
     */
    async fetchMergeGroups(restaurantId: string, waiterId?: string) {
        return coalesceRequest(`merge_groups:${restaurantId}:${waiterId || 'all'}`, async () => {
            const actualId = await this.resolveRestaurantId(restaurantId);

            try {
                // Run asynchronously to not block merge group fetching
                this.checkAndResetStaleTables(actualId).catch(err => console.error('Failed to reset stale merge groups:', err));
            } catch (resetErr) {
                console.error('Failed to reset stale merge groups:', resetErr);
            }

            let query = supabase
                .from('table_merge_groups')
                .select('*')
                .order('created_at', { ascending: false });

            query = query.eq('restaurant_id', actualId);

            const { data, error } = await query;

            if (error) {
                console.error('Error fetching merge groups:', formatError(error));
                throw new Error(`Error fetching merge groups: ${formatError(error)}`);
            }
            return data as TableMergeGroup[];
        });
    },

    /**
     * Merge multiple free tables into a single virtual group.
     */
    async mergeTables(tableIds: number[], restaurantId: string, branchId?: string) {
        if (!tableIds || tableIds.length < 2) throw new Error('Need at least 2 tables to merge.');

        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        // 0. Validate Context (Basic)
        try {
            await ContextValidator.validateOwnership({ restaurantId: actualRestaurantId, branchId });
        } catch (e) {
            console.warn('Ownership validation in mergeTables:', e);
        }

        // 1. Verify all tables are free, not already merged, and belong to the restaurant
        let query = supabase
            .from('tables')
            .select('id, table_number, capacity, status, is_merged, restaurant_id')
            .in('id', tableIds);

        if (actualRestaurantId === restaurantId) {
            query = query.eq('restaurant_id', restaurantId);
        } else {
            query = query.or(`restaurant_id.eq.${restaurantId},restaurant_id.eq.${actualRestaurantId}`);
        }

        const { data: tablesToMerge, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        if (!tablesToMerge || tablesToMerge.length !== tableIds.length) {
            throw new Error('Some tables could not be found or do not belong to this restaurant.');
        }

        // Check if any of these tables have unarchived active orders
        const { data: activeOrders } = await supabase
            .from('orders')
            .select('id, table_id')
            .in('table_id', tableIds)
            .eq('is_completed', false);

        if (activeOrders && activeOrders.length > 0) {
            throw new Error('Cannot merge tables that currently have active orders.');
        }

        let totalCapacity = 0;
        const tableNumbers: string[] = [];
        for (const t of tablesToMerge) {
            if (t.status === 'on_hold') {
                throw new Error(`Table ${t.table_number || t.id} is currently opened by another waiter.`);
            }
            if (t.status !== 'empty' && t.status !== 'free' && t.status !== 'available') {
                throw new Error(`Table ${t.table_number || t.id} is occupied.`);
            }
            if (t.is_merged) throw new Error(`Table ${t.table_number || t.id} is already merged.`);
            totalCapacity += t.capacity || 0;
            tableNumbers.push(String(t.table_number));
        }

        // Generate friendly name: "Table 1 + 2 + 3"
        const displayName = `Table ` + tableNumbers.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(' + ');

        // 2. Create the Merge Group
        const mergeGroupId = generateUUID();
        const { data: newGroup, error: insertError } = await supabase
            .from('table_merge_groups')
            .insert({
                id: mergeGroupId,
                display_name: displayName,
                total_capacity: totalCapacity,
                status: 'empty',
                restaurant_id: actualRestaurantId || restaurantId
            })
            .select()
            .single();

        if (insertError) throw insertError;

        // 3. Update the physical tables
        const { error: updateError } = await supabase
            .from('tables')
            .update({
                status: 'empty',
                is_merged: true,
                merged_group_id: mergeGroupId
            })
            .in('id', tableIds);

        if (updateError) {
            // Rollback group creation (basic compensation)
            await supabase.from('table_merge_groups').delete().eq('id', mergeGroupId);
            throw updateError;
        }

        return newGroup;
    },

    /**
     * Unmerge a merged table group.
     * Ensures all physical tables are freed and merge group is removed.
     */
    async unmergeTables(mergeGroupId: string, restaurantId: string, branchId?: string, force = true) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        // 0. Validate Ownership (non-blocking warning if mismatch)
        try {
            await ContextValidator.validateOwnership({ restaurantId: actualRestaurantId, branchId });
        } catch (e) {
            console.warn('Ownership validation in unmergeTables:', e);
        }

        // 1. Ensure no active orders for this merge group (archive if force=true)
        const { data: activeOrders, error: ordersError } = await supabase
            .from('orders')
            .select('id, status, is_completed')
            .eq('merge_group_id', mergeGroupId)
            .eq('is_completed', false);

        if (ordersError) {
            console.warn('Error checking orders in unmergeTables:', ordersError);
        }

        if (activeOrders && activeOrders.length > 0) {
            const unpaidOrders = activeOrders.filter(o => o.status !== 'paid');
            if (unpaidOrders.length > 0 && !force) {
                throw new Error('Cannot unmerge: there are still active unpaid orders.');
            }
            // Archive any orders for the group so tables can be freed
            await supabase
                .from('orders')
                .update({ is_completed: true, status: 'paid', completed_at: new Date().toISOString() })
                .eq('merge_group_id', mergeGroupId)
                .eq('is_completed', false);
        }

        // 2. Clear physical tables back to available & unmerged
        const { error: tablesError } = await supabase
            .from('tables')
            .update({
                status: 'available',
                is_merged: false,
                merged_group_id: null,
                assigned_waiter_id: null,
                co_waiter_ids: [],
                customer_present_at: null,
                last_activity_at: null,
                alert_status: null,
                transferred_from_waiter_id: null,
                transferred_to_waiter_id: null
            })
            .eq('merged_group_id', mergeGroupId);

        if (tablesError) {
            console.error('Error updating tables in unmergeTables:', tablesError);
            throw tablesError;
        }

        // 3. Delete the merge group
        const { error: deleteError } = await supabase
            .from('table_merge_groups')
            .delete()
            .eq('id', mergeGroupId);

        if (deleteError) {
            console.error('Error deleting table merge group in unmergeTables:', deleteError);
            throw deleteError;
        }

        // 4. Dismiss any dangling alerts
        await this.dismissTableAlert(mergeGroupId, actualRestaurantId).catch(() => {});
    },

    /**
     * Subscribe to real-time changes on the 'orders' table.
     * Support optional waiterId for waiter-specific channels.
     */
    subscribeToOrders(restaurantId: string, onChange: (payload: RealtimePostgresChangesPayload<Order>) => void, waiterId?: string, branchId?: string) {
        let isCancelled = false;
        let subHandle: { unsubscribe: () => void } | null = null;

        const init = (resolvedId: string) => {
            if (isCancelled) return;
            const channelKey = `orders:${resolvedId}:${branchId || 'main'}:${waiterId || 'all'}`;
            const filter = `restaurant_id=eq.${resolvedId}`;

            subHandle = realtimeManager.subscribe<Order>(
                channelKey,
                () => {
                    const channel = supabase
                        .channel(`orders-channel-${resolvedId}-${branchId || 'main'}-${waiterId || 'all'}`)
                        .on(
                            'postgres_changes',
                            { 
                                event: '*', 
                                schema: 'public', 
                                table: 'orders',
                                filter: filter
                            },
                            (payload) => {
                                realtimeManager.dispatch(channelKey, payload);
                            }
                        );
                    channel.subscribe();
                    return channel;
                },
                (payload) => {
                    const newRec = payload.new as any;
                    const oldRec = payload.old as any;
                    const rec = newRec || oldRec;
                    if (!rec) return;

                    // Strict tenant isolation: verify restaurant_id
                    if (rec.restaurant_id != null) {
                        if (String(rec.restaurant_id) !== String(resolvedId)) return;
                    } else if (payload.eventType === 'DELETE') {
                        // On DELETE without restaurant_id in WAL, verify order belongs to this tenant
                        const isKnown = OrderService.isOrderKnownForTenant(rec.id, resolvedId);
                        if (!isKnown) return;
                    } else {
                        // Drop unknown un-scoped events
                        return;
                    }

                    if (branchId && rec.branch_id !== branchId) return;
                    if (waiterId && (!rec.waiter_id || String(rec.waiter_id).toLowerCase() !== String(waiterId).toLowerCase())) return;
                    onChange(payload as unknown as RealtimePostgresChangesPayload<Order>);
                }
            );
        };

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId);
        const isNumeric = /^\d+$/.test(restaurantId);
        const isStandardTenant = /^REST-|^PEND-/i.test(restaurantId);

        if (isUUID || isNumeric || isStandardTenant) {
            init(restaurantId);
        } else {
            this.resolveRestaurantId(restaurantId).then(resolvedId => {
                if (!isCancelled) {
                    init(resolvedId || restaurantId);
                }
            });
        }

        return {
            unsubscribe: () => {
                isCancelled = true;
                if (subHandle) subHandle.unsubscribe();
            }
        };
    },

    /**
     * Subscribe to real-time changes on the 'orders' table specifically for a single table.
     * Essential for customer devices to avoid global/restaurant-wide broadcasts.
     */
    subscribeToTableOrders(restaurantId: string, tableId: number | string, onChange: (payload: RealtimePostgresChangesPayload<Order>) => void) {
        let isCancelled = false;
        let subHandle: { unsubscribe: () => void } | null = null;

        const init = (resolvedId: string) => {
            if (isCancelled) return;
            const channelKey = `table-orders:${resolvedId}:${tableId}`;
            const filter = `table_id=eq.${tableId}`;

            subHandle = realtimeManager.subscribe<Order>(
                channelKey,
                () => {
                    const channel = supabase
                        .channel(`table-orders-channel-${resolvedId}-${tableId}`)
                        .on(
                            'postgres_changes',
                            {
                                event: '*',
                                schema: 'public',
                                table: 'orders',
                                filter: filter
                            },
                            (payload) => {
                                realtimeManager.dispatch(channelKey, payload);
                            }
                        );
                    channel.subscribe();
                    return channel;
                },
                (payload) => {
                    const newRec = payload.new as any;
                    const oldRec = payload.old as any;
                    const rec = newRec || oldRec;
                    if (!rec) return;

                    // Strict tenant & table isolation
                    if (rec.restaurant_id != null) {
                        if (String(rec.restaurant_id) !== String(resolvedId)) return;
                    } else if (payload.eventType === 'DELETE') {
                        const isKnown = OrderService.isOrderKnownForTenant(rec.id, resolvedId);
                        if (!isKnown) return;
                    } else {
                        return;
                    }

                    if (tableId != null && rec.table_id != null && String(rec.table_id) !== String(tableId)) return;
                    onChange(payload as unknown as RealtimePostgresChangesPayload<Order>);
                }
            );
        };

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId);
        const isNumeric = /^\d+$/.test(restaurantId);
        const isStandardTenant = /^REST-|^PEND-/i.test(restaurantId);

        if (isUUID || isNumeric || isStandardTenant) {
            init(restaurantId);
        } else {
            this.resolveRestaurantId(restaurantId).then(resolvedId => {
                if (!isCancelled) {
                    init(resolvedId || restaurantId);
                }
            });
        }

        return {
            unsubscribe: () => {
                isCancelled = true;
                if (subHandle) subHandle.unsubscribe();
            }
        };
    },

    /**
     * Subscribe to real-time changes on the 'order_items' table specifically for a single order.
     * Essential for customer devices to avoid restaurant-wide broadcasts of all items.
     */
    subscribeToOrderItemsSpecific(restaurantId: string, orderId: string, onChange: (payload: RealtimePostgresChangesPayload<any>) => void) {
        let isCancelled = false;
        let subHandle: { unsubscribe: () => void } | null = null;

        const init = (resolvedId: string) => {
            if (isCancelled) return;
            const channelKey = `order-items-specific:${resolvedId}:${orderId}`;
            const filter = `order_id=eq.${orderId}`;

            subHandle = realtimeManager.subscribe(
                channelKey,
                () => {
                    const channel = supabase
                        .channel(`order-items-specific-channel-${resolvedId}-${orderId}`)
                        .on(
                            'postgres_changes',
                            {
                                event: '*',
                                schema: 'public',
                                table: 'order_items',
                                filter: filter
                            },
                            (payload) => {
                                realtimeManager.dispatch(channelKey, payload);
                            }
                        );
                    channel.subscribe();
                    return channel;
                },
                (payload) => {
                    const newRec = payload.new as any;
                    const oldRec = payload.old as any;
                    const rec = newRec || oldRec;
                    if (!rec) return;

                    // Strict tenant & order isolation
                    if (rec.restaurant_id != null) {
                        if (String(rec.restaurant_id) !== String(resolvedId)) return;
                    } else if (payload.eventType === 'DELETE') {
                        const isKnown = OrderService.isOrderItemKnownForTenant(rec.id, resolvedId);
                        if (!isKnown) return;
                    } else {
                        return;
                    }

                    if (orderId != null && rec.order_id != null && String(rec.order_id) !== String(orderId)) return;
                    onChange(payload);
                }
            );
        };

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId);
        const isNumeric = /^\d+$/.test(restaurantId);
        const isStandardTenant = /^REST-|^PEND-/i.test(restaurantId);

        if (isUUID || isNumeric || isStandardTenant) {
            init(restaurantId);
        } else {
            this.resolveRestaurantId(restaurantId).then(resolvedId => {
                if (!isCancelled) {
                    init(resolvedId || restaurantId);
                }
            });
        }

        return {
            unsubscribe: () => {
                isCancelled = true;
                if (subHandle) subHandle.unsubscribe();
            }
        };
    },

    /**
     * Subscribe to real-time changes on the 'order_items' table.
     * Essential for KDS to know when items are added to an order.
     */
    subscribeToOrderItems(restaurantId: string, onChange: (payload: RealtimePostgresChangesPayload<any>) => void, branchId?: string) {
        let isCancelled = false;
        let subHandle: { unsubscribe: () => void } | null = null;

        const init = (resolvedId: string) => {
            if (isCancelled) return;
            const channelKey = `order-items:${resolvedId}:${branchId || 'main'}`;
            const filter = `restaurant_id=eq.${resolvedId}`;

            subHandle = realtimeManager.subscribe(
                channelKey,
                () => {
                    const channel = supabase
                        .channel(`order-items-channel-${resolvedId}-${branchId || 'main'}`)
                        .on(
                            'postgres_changes',
                            { 
                                event: '*', 
                                schema: 'public', 
                                table: 'order_items',
                                filter: filter
                            },
                            (payload) => {
                                realtimeManager.dispatch(channelKey, payload);
                            }
                        );
                    channel.subscribe();
                    return channel;
                },
                (payload) => {
                    const rec = (payload.new || payload.old) as any;
                    if (!rec) return;

                    // Strict tenant isolation
                    if (rec.restaurant_id != null) {
                        if (String(rec.restaurant_id) !== String(resolvedId)) return;
                    } else if (payload.eventType === 'DELETE') {
                        const isKnown = OrderService.isOrderItemKnownForTenant(rec.id, resolvedId);
                        if (!isKnown) return;
                    } else {
                        return;
                    }

                    if (branchId && rec.branch_id !== branchId) return;
                    onChange(payload);
                }
            );
        };

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId);
        const isNumeric = /^\d+$/.test(restaurantId);
        const isStandardTenant = /^REST-|^PEND-/i.test(restaurantId);

        if (isUUID || isNumeric || isStandardTenant) {
            init(restaurantId);
        } else {
            this.resolveRestaurantId(restaurantId).then(resolvedId => {
                if (!isCancelled) {
                    init(resolvedId || restaurantId);
                }
            });
        }

        return {
            unsubscribe: () => {
                isCancelled = true;
                if (subHandle) subHandle.unsubscribe();
            }
        };
    },

    subscribeToMenuItems(restaurantId: string, onChange: (payload: RealtimePostgresChangesPayload<any>) => void, branchId?: string) {
        let isCancelled = false;
        let subHandle: { unsubscribe: () => void } | null = null;

        const init = (resolvedId: string) => {
            if (isCancelled) return;
            const channelKey = `menu-items:${resolvedId}:${branchId || 'main'}`;
            const filter = `restaurant_id=eq.${resolvedId}`;

            subHandle = realtimeManager.subscribe(
                channelKey,
                () => {
                    const channel = supabase
                        .channel(`menu_items_channel-${resolvedId}-${branchId || 'main'}`)
                        .on(
                            'postgres_changes',
                            { 
                                event: '*', 
                                schema: 'public', 
                                table: 'menu_items',
                                filter: filter
                            },
                            (payload) => {
                                realtimeManager.dispatch(channelKey, payload);
                            }
                        );
                    channel.subscribe();
                    return channel;
                },
                (payload) => {
                    const rec = (payload.new || payload.old) as any;
                    if (!rec) return;

                    // Strict tenant isolation
                    if (rec.restaurant_id != null) {
                        if (String(rec.restaurant_id) !== String(resolvedId)) return;
                    } else if (payload.eventType === 'DELETE') {
                        const isKnown = OrderService.isMenuItemKnownForTenant(rec.id, resolvedId);
                        if (!isKnown) return;
                    } else {
                        return;
                    }

                    if (branchId && rec.branch_id !== branchId) return;
                    onChange(payload);
                }
            );
        };

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId);
        const isNumeric = /^\d+$/.test(restaurantId);
        const isStandardTenant = /^REST-|^PEND-/i.test(restaurantId);

        if (isUUID || isNumeric || isStandardTenant) {
            init(restaurantId);
        } else {
            this.resolveRestaurantId(restaurantId).then(resolvedId => {
                if (!isCancelled) {
                    init(resolvedId || restaurantId);
                }
            });
        }

        return {
            unsubscribe: () => {
                isCancelled = true;
                if (subHandle) subHandle.unsubscribe();
            }
        };
    },

    /**
     * Subscribe to real-time changes on the 'tables' table.
     */
    subscribeToTables(restaurantId: string, onChange: (payload: RealtimePostgresChangesPayload<any>) => void, branchId?: string) {
        let isCancelled = false;
        let subHandle: { unsubscribe: () => void } | null = null;

        const init = (resolvedId: string) => {
            if (isCancelled) return;
            const channelKey = `tables:${resolvedId}:${branchId || 'main'}`;
            const filter = `restaurant_id=eq.${resolvedId}`;

            subHandle = realtimeManager.subscribe(
                channelKey,
                () => {
                    const channel = supabase
                        .channel(`tables-channel-${resolvedId}-${branchId || 'main'}`)
                        .on(
                            'postgres_changes',
                            { 
                                event: '*', 
                                schema: 'public', 
                                table: 'tables',
                                filter: filter
                            },
                            (payload) => {
                                realtimeManager.dispatch(channelKey, payload);
                            }
                        );
                    channel.subscribe();
                    return channel;
                },
                (payload) => {
                    const rec = (payload.new || payload.old) as any;
                    if (!rec) return;

                    // Strict tenant isolation
                    if (rec.restaurant_id != null) {
                        if (String(rec.restaurant_id) !== String(resolvedId)) return;
                    } else if (payload.eventType === 'DELETE') {
                        const isKnown = OrderService.isTableKnownForTenant(rec.id, resolvedId);
                        if (!isKnown) return;
                    } else {
                        return;
                    }

                    if (branchId && rec.branch_id !== branchId) return;
                    onChange(payload);
                }
            );
        };

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId);
        const isNumeric = /^\d+$/.test(restaurantId);
        const isStandardTenant = /^REST-|^PEND-/i.test(restaurantId);

        if (isUUID || isNumeric || isStandardTenant) {
            init(restaurantId);
        } else {
            this.resolveRestaurantId(restaurantId).then(resolvedId => {
                if (!isCancelled) {
                    init(resolvedId || restaurantId);
                }
            });
        }

        return {
            unsubscribe: () => {
                isCancelled = true;
                if (subHandle) subHandle.unsubscribe();
            }
        };
    },

    /**
     * Subscribe to real-time changes on table_merge_groups.
     */
    subscribeToMergeGroups(restaurantId: string, onChange: (payload: RealtimePostgresChangesPayload<any>) => void, branchId?: string) {
        let isCancelled = false;
        let subHandle: { unsubscribe: () => void } | null = null;

        const init = (resolvedId: string) => {
            if (isCancelled) return;
            const channelKey = `merge-groups:${resolvedId}:${branchId || 'main'}`;
            const filter = `restaurant_id=eq.${resolvedId}`;

            subHandle = realtimeManager.subscribe(
                channelKey,
                () => {
                    const channel = supabase
                        .channel(`merge-groups-channel-${resolvedId}-${branchId || 'main'}`)
                        .on(
                            'postgres_changes',
                            { 
                                event: '*', 
                                schema: 'public', 
                                table: 'table_merge_groups',
                                filter: filter
                            },
                            (payload) => {
                                realtimeManager.dispatch(channelKey, payload);
                            }
                        );
                    channel.subscribe();
                    return channel;
                },
                (payload) => {
                    const rec = (payload.new || payload.old) as any;
                    if (!rec) return;

                    // Strict tenant isolation
                    if (rec.restaurant_id != null) {
                        if (String(rec.restaurant_id) !== String(resolvedId)) return;
                    } else if (payload.eventType === 'DELETE') {
                        const isKnown = OrderService.isMergeGroupKnownForTenant(rec.id, resolvedId);
                        if (!isKnown) return;
                    } else {
                        return;
                    }

                    if (branchId && rec.branch_id !== branchId) return;
                    onChange(payload);
                }
            );
        };

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId);
        const isNumeric = /^\d+$/.test(restaurantId);
        const isStandardTenant = /^REST-|^PEND-/i.test(restaurantId);

        if (isUUID || isNumeric || isStandardTenant) {
            init(restaurantId);
        } else {
            this.resolveRestaurantId(restaurantId).then(resolvedId => {
                if (!isCancelled) {
                    init(resolvedId || restaurantId);
                }
            });
        }

        return {
            unsubscribe: () => {
                isCancelled = true;
                if (subHandle) subHandle.unsubscribe();
            }
        };
    },

    /**
     * Subscribe to real-time changes on restaurant_areas.
     */
    subscribeToAreas(restaurantId: string, onChange: (payload: RealtimePostgresChangesPayload<any>) => void) {
        let isCancelled = false;
        let subHandle: { unsubscribe: () => void } | null = null;

        const init = (resolvedId: string) => {
            if (isCancelled) return;
            const channelKey = `areas:${resolvedId}`;
            const filter = `restaurant_id=eq.${resolvedId}`;

            subHandle = realtimeManager.subscribe(
                channelKey,
                () => {
                    const channel = supabase
                        .channel(`areas-channel-${resolvedId}`)
                        .on(
                            'postgres_changes',
                            { 
                                event: '*', 
                                schema: 'public', 
                                table: 'restaurant_areas',
                                filter: filter
                            },
                            (payload) => {
                                realtimeManager.dispatch(channelKey, payload);
                            }
                        );
                    channel.subscribe();
                    return channel;
                },
                (payload) => {
                    const rec = (payload.new || payload.old) as any;
                    if (!rec) return;

                    if (rec.restaurant_id != null) {
                        if (String(rec.restaurant_id) !== String(resolvedId)) return;
                    }
                    onChange(payload);
                }
            );
        };

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId);
        const isNumeric = /^\d+$/.test(restaurantId);
        const isStandardTenant = /^REST-|^PEND-/i.test(restaurantId);

        if (isUUID || isNumeric || isStandardTenant) {
            init(restaurantId);
        } else {
            this.resolveRestaurantId(restaurantId).then(resolvedId => {
                if (!isCancelled) {
                    init(resolvedId || restaurantId);
                }
            });
        }

        return {
            unsubscribe: () => {
                isCancelled = true;
                if (subHandle) subHandle.unsubscribe();
            }
        };
    },

    /**
     * Update the status of a specific order.
     */
    async updateOrderStatus(orderId: string, restaurantId: string, status: OrderStatus, staffId?: string, branchId?: string) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        // Verify staff authorization if staffId is provided
        if (staffId) {
            const { data: ord } = await supabase
                .from('orders')
                .select('waiter_id, table_id, merge_group_id')
                .eq('id', orderId)
                .maybeSingle();

            if (ord) {
                const staffIdLower = String(staffId).toLowerCase();
                let isPrivileged = false;
                try {
                    const { data: emp } = await supabase.from('employees').select('role').eq('id', staffId).maybeSingle();
                    if (emp?.role && ['admin', 'supervisor', 'restaurant_admin', 'manager', 'chef'].includes(emp.role.toLowerCase())) {
                        isPrivileged = true;
                    }
                } catch (_) {}

                if (!isPrivileged) {
                    const targetTableId = ord.table_id || ord.merge_group_id;
                    const physicalTable = targetTableId ? await this.findTableAnywhere(targetTableId, actualRestaurantId) : null;
                    const assignedWaiterId = physicalTable?.assigned_waiter_id || ord.waiter_id;
                    const coWaiters: string[] = Array.isArray(physicalTable?.co_waiter_ids)
                        ? physicalTable.co_waiter_ids.map((id: any) => String(id).toLowerCase())
                        : [];

                    const isAssigned = assignedWaiterId && String(assignedWaiterId).toLowerCase() === staffIdLower;
                    const isCo = coWaiters.includes(staffIdLower);

                    if (!isAssigned && !isCo && assignedWaiterId) {
                        throw new Error(`Unauthorized: You are not assigned to manage Order ${orderId}.`);
                    }
                }
            }
        }

        // 1. Cascade update to all items FIRST
        // This ensures that when the "Order Updated" realtime event fires (step 2),
        // the items are ALREADY in the correct state for any listeners fetching full details.
        let itemsQuery = supabase.from('order_items').update({ 
            status
        }).eq('order_id', orderId);

        if (status === 'preparing') {
            itemsQuery = itemsQuery.or('status.eq.placed,status.eq.queued,status.is.null') as any;
        } else if (status === 'ready') {
            itemsQuery = itemsQuery.or('status.eq.placed,status.eq.preparing,status.is.null') as any;
        } else if (status === 'served') {
            itemsQuery = supabase.from('order_items').update({ 
                status,
                served_at: new Date().toISOString()
            }).eq('order_id', orderId).neq('status', 'paid') as any;
        } else if (status === 'placed') {
            itemsQuery = supabase.from('order_items').update({
                status
            }).eq('order_id', orderId).eq('status', 'queued') as any;
        }

        const { error: itemsError } = await itemsQuery;

        if (itemsError) {
            console.error('Failed to cascade status to items', itemsError);
            throw itemsError; // Fail fast if items fail
        }

        // 2. Update Order Status (Second) with tenant and branch scoping enforced atomically
        let orderUpdateQuery = supabase
            .from('orders')
            .update({ 
                status
            })
            .eq('id', orderId)
            .eq('restaurant_id', actualRestaurantId);

        if (branchId) {
            orderUpdateQuery = orderUpdateQuery.eq('branch_id', branchId);
        }

        const { data: updatedOrder, error } = await orderUpdateQuery
            .select('table_id, merge_group_id')
            .single();

        if (error) throw error;

        // 3. Cleanup Alerts if Served/Paid/Cancelled
        if (['served', 'paid', 'cancelled'].includes(status) && updatedOrder) {
            let tableIdsToClear: number[] = [];

            if (updatedOrder.merge_group_id) {
                // If it's a merged order, gather all table IDs in that merge group
                const { data: mergedTables } = await supabase
                    .from('tables')
                    .select('id')
                    .eq('merged_group_id', updatedOrder.merge_group_id);

                if (mergedTables) {
                    tableIdsToClear = mergedTables.map(t => t.id);
                }
            } else if (updatedOrder.table_id) {
                // Otherwise, just clear the specific table
                tableIdsToClear = [updatedOrder.table_id];
            }

            if (tableIdsToClear.length > 0) {
                await supabase
                    .from('service_requests')
                    .update({
                        request_status: 'completed',
                        completed_at: new Date().toISOString()
                    })
                    .in('table_id', tableIdsToClear)
                    .eq('request_type', 'order_ready')
                    .eq('request_status', 'pending');
            }
        }
    },

    /**
     * Temporary: Helper to create a test order for verification
     * Auto-seeds menu_items and tables if empty.
     */
    async createTestOrder(tableId: number, restaurantId: string) {
        // 0. Ensure Table exists (for FK)
        const { data: table } = await supabase.from('tables')
            .select('id')
            .eq('id', tableId)
            .eq('restaurant_id', restaurantId)
            .single();
            
        if (!table) {
            console.log('Seeding Table', tableId);
            const { error: tableErr } = await supabase.from('tables').insert({
                id: tableId,
                table_number: String(tableId),
                status: 'free',
                restaurant_id: restaurantId
            });
            if (tableErr) console.error('Table Seed Error', tableErr);
        }

        // 1. Ensure a Menu Item exists to link to
        let { data: menuItem } = await supabase.from('menu_items')
            .select('id')
            .eq('restaurant_id', restaurantId)
            .limit(1)
            .single();

        if (!menuItem) {
            console.log('Seeding Menu Items...');
            let { data: cat } = await supabase.from('categories')
                .select('id')
                .eq('restaurant_id', restaurantId)
                .limit(1)
                .single();
            if (!cat) {
                const catId = generateId();
                const { data: newCat, error: catErr } = await supabase.from('categories').insert({
                    id: catId,
                    name: 'Starters',
                    slug: 'starters',
                    restaurant_id: restaurantId
                }).select().single();

                cat = newCat || { id: catId };
            }

            const menuId = generateId();
            const { data: newItem, error: menuErr } = await supabase.from('menu_items').insert({
                id: menuId,
                name: 'Test Biryani',
                price: 350,
                category_id: cat?.id,
                description: 'Delicious test item',
                is_available: true,
                restaurant_id: restaurantId
            }).select().single();

            if (menuErr) {
                console.error('Seeding error', menuErr);
                throw menuErr;
            }
            menuItem = newItem;
        }

        if (!menuItem) throw new Error('Failed to find or create menu item');

        // 2. Create Order
        const orderId = generateUUID();
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .insert({
                id: orderId, // Manually Generate UUID
                table_id: tableId,
                status: 'placed',
                total_amount: 450,
                is_completed: false,
                restaurant_id: restaurantId
            })
            .select()
            .single();

        if (orderError) throw orderError;

        // 3. Create Order Items linked to Menu Item
        const { error: itemsError } = await supabase
            .from('order_items')
            .insert([
                {
                    id: generateId(), // Manual ID
                    order_id: order.id,
                    menu_item_id: menuItem.id,
                    quantity: 1,
                    price_at_time: 350, // CORRECT COLUMN
                    notes: 'Spicy',
                    restaurant_id: restaurantId
                }
            ]);

        if (itemsError) throw itemsError;
        return order;
    },

    /**
     * Create a real order from the Waiter Panel or Customer Panel.
     */
    async createOrder(
        tableIdentifier: string | number,
        items: any[],
        restaurantId: string,
        initialStatus: OrderStatus = 'placed',
        waiterId?: string,
        couponCode?: string,
        discountAmount?: number,
        transactionId?: string,
        customerId?: string,
        orderOptions?: {
            orderType?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
            activeOrderId?: string;
            existingOrderId?: string;
            deliveryAddress?: string;
            deliveryPhone?: string;
            deliveryNotes?: string;
            deliveryFee?: number;
            deliveryZoneId?: string;
            deliveryLat?: number;
            deliveryLng?: number;
            customerLat?: number;
            customerLng?: number;
            customerPhone?: string;
            customerName?: string;
        }
    ) {
        // 0. Resolve restaurantId slug → actual ID
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;
        const finalTransactionId = transactionId || generateUUID();

        // 1. Idempotency Check by transaction_id
        if (finalTransactionId) {
            const { data: dupOrder } = await supabase
                .from('orders')
                .select('id')
                .eq('transaction_id', finalTransactionId)
                .maybeSingle();
                
            if (dupOrder) {
                console.log(`[createOrder] Duplicate transaction detected. Order ${dupOrder.id} already exists.`);
                // Verify if order items are already there
                const { data: dupItems } = await supabase
                    .from('order_items')
                    .select('id')
                    .eq('order_id', dupOrder.id);
                    
                if (!dupItems || dupItems.length === 0) {
                    const orderItems = items.map(item => {
                        const isComboOrSpecial = item.item_type === 'combo' || item.item_type === 'special';
                        const numMenuId = Number(item.menu_item_id);
                        const validMenuId = (!isComboOrSpecial && !isNaN(numMenuId) && numMenuId > 0) ? numMenuId : null;
                        const row: any = {
                            order_id: dupOrder.id,
                            restaurant_id: actualRestaurantId,
                            menu_item_id: validMenuId,
                            quantity: item.quantity,
                            notes: item.notes || '',
                            price_at_time: item.price,
                            status: initialStatus === 'queued' ? 'queued' : 'placed',
                            item_type: item.item_type || (item.combo_name ? 'combo' : 'standard'),
                            combo_id: item.combo_id || null,
                            combo_name: item.combo_name || item.name || null,
                            combo_image: item.combo_image || item.image_url || null,
                            combo_items: item.combo_items || null,
                            tax_percent: item.tax_percent ?? item.gst_percentage ?? 5,
                            cgst_percent: item.cgst_percent ?? item.cgst_percentage ?? ((item.tax_percent ?? item.gst_percentage ?? 5) / 2),
                            sgst_percent: item.sgst_percent ?? item.sgst_percentage ?? ((item.tax_percent ?? item.gst_percentage ?? 5) / 2),
                        };
                        if (typeof item.id === 'number' && !isNaN(item.id)) {
                            row.id = item.id;
                        }
                        return row;
                    });
                    await retryOperation(async () => await supabase.from('order_items').insert(orderItems));
                }
                return { id: dupOrder.id };
            }
        }

        const tableStr = String(tableIdentifier || '').trim().toLowerCase();
        const isTakeaway = orderOptions?.orderType === 'TAKEAWAY' || tableStr === 'takeaway';
        const isDelivery = orderOptions?.orderType === 'DELIVERY' || tableStr === 'delivery';
        const isTakeawayOrDelivery = isTakeaway || isDelivery;
        const resolvedOrderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' = isDelivery ? 'DELIVERY' : (isTakeaway ? 'TAKEAWAY' : (orderOptions?.orderType || 'DINE_IN'));

        let identifierColumn = 'table_id';
        let identifierValue: string | number | null = tableIdentifier;
        let isMerged = false;
        let existingOrder: any = null;
        let finalWaiterId: string | null = null;

        if (!isTakeawayOrDelivery) {
            // 2. Resolve the table identifier → actual DB row FIRST
            const physicalTable = await this.findTableAnywhere(tableIdentifier, actualRestaurantId);
            if (!physicalTable) {
                console.error(`[createOrder] Table "${tableIdentifier}" not found for restaurant "${actualRestaurantId}". Order rejected.`);
                throw new Error(`Table "${tableIdentifier}" does not exist in this restaurant. Customers can only order from admin-created tables.`);
            }

            const isGroupRecord = 'display_name' in physicalTable;

            if (isGroupRecord || physicalTable.merged_group_id) {
                isMerged = true;
                identifierColumn = 'merge_group_id';
                identifierValue = isGroupRecord ? physicalTable.id : physicalTable.merged_group_id;
            } else {
                identifierColumn = 'table_id';
                identifierValue = physicalTable.id;
            }

            // Check for existing active (non-completed) order on this table
            const { data: exOrder } = await supabase
                .from('orders')
                .select('id, total_amount, waiter_id, gst_amount, cgst_amount, sgst_amount, delivery_fee, discount_amount, customer_id, customer_phone, status')
                .eq(identifierColumn, identifierValue)
                .eq('restaurant_id', actualRestaurantId)
                .eq('is_completed', false)
                .in('status', ['placed', 'preparing', 'ready', 'served'])
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            existingOrder = exOrder;

            // Preserve table's currently assigned waiter (from physicalTable or active order)
            const tableAssignedWaiterId = physicalTable?.assigned_waiter_id || existingOrder?.waiter_id || null;

            // SERVER-SIDE AUTHORIZATION CHECK:
            // A waiter cannot create or place food orders for a table assigned to another waiter
            // unless explicitly granted access (as primary assigned waiter, approved co-waiter, or admin/supervisor).
            if (waiterId && tableAssignedWaiterId) {
                const assignedStr = String(tableAssignedWaiterId).toLowerCase();
                const waiterStr = String(waiterId).toLowerCase();
                const coWaiters = Array.isArray(physicalTable.co_waiter_ids)
                    ? physicalTable.co_waiter_ids.map((id: any) => String(id).toLowerCase())
                    : [];

                if (waiterStr !== assignedStr && !coWaiters.includes(waiterStr)) {
                    let isPrivileged = false;
                    try {
                        const { data: emp } = await supabase
                            .from('employees')
                            .select('role')
                            .eq('id', waiterId)
                            .maybeSingle();
                        if (emp?.role && ['admin', 'supervisor', 'restaurant_admin', 'manager'].includes(emp.role.toLowerCase())) {
                            isPrivileged = true;
                        }
                    } catch (_) {}

                    if (!isPrivileged) {
                        throw new Error(`Unauthorized: Table ${physicalTable?.table_number || physicalTable?.id} is assigned to another waiter. You must request access and receive approval before creating or placing orders for this table.`);
                    }
                }
            }

            // On assigned tables, the assigned waiter takes precedence over arbitrary waiterId to prevent hijacking
            let candidateWaiterId = tableAssignedWaiterId || waiterId || null;

            if (candidateWaiterId) {
                const { data: waiterCheck } = await supabase
                    .from('employees')
                    .select('id, status, is_online, availability_status')
                    .eq('id', candidateWaiterId)
                    .maybeSingle();

                const isActive = waiterCheck &&
                    waiterCheck.status?.toLowerCase() === 'active' &&
                    waiterCheck.is_online === true &&
                    !['offline', 'break'].includes((waiterCheck.availability_status || '').toLowerCase());

                if (isActive) {
                    finalWaiterId = candidateWaiterId;
                }
            }

            if (initialStatus !== 'queued') {
                await this.trackCustomerPresence(tableIdentifier, actualRestaurantId, 'eating', finalWaiterId || undefined);
                const updatedTable = await this.findTableAnywhere(tableIdentifier, actualRestaurantId);
                if (updatedTable?.assigned_waiter_id) {
                    const { data: updatedWaiterCheck } = await supabase
                        .from('employees')
                        .select('id, status, is_online, availability_status')
                        .eq('id', updatedTable.assigned_waiter_id)
                        .maybeSingle();

                    const isUpActive = updatedWaiterCheck &&
                        updatedWaiterCheck.status?.toLowerCase() === 'active' &&
                        updatedWaiterCheck.is_online === true &&
                        !['offline', 'break'].includes((updatedWaiterCheck.availability_status || '').toLowerCase());

                    if (isUpActive) {
                        finalWaiterId = updatedTable.assigned_waiter_id;
                    }
                }
            }

            // Only assign least busy waiter if no ACTIVE waiter is assigned to this table or order
            if (!finalWaiterId) {
                const tableIdNum = identifierColumn === 'table_id' ? Number(identifierValue) : null;
                const groupIdStr = identifierColumn === 'merge_group_id' ? String(identifierValue) : null;

                try {
                    const { data: assignResult, error: assignErr } = await supabase.rpc('assign_least_busy_waiter', {
                        p_restaurant_id: actualRestaurantId,
                        p_table_id: tableIdNum,
                        p_merge_group_id: groupIdStr,
                        p_order_id: null
                    });

                    if (assignErr) {
                        console.error('[createOrder] Error in assign_least_busy_waiter RPC:', assignErr);
                    } else if (assignResult) {
                        if (assignResult.id) {
                            finalWaiterId = assignResult.id;
                        }
                        if (assignResult.is_overloaded) {
                            this.broadcastWaitersOverloaded(actualRestaurantId).catch(err => {
                                console.error('[createOrder] broadcastWaitersOverloaded error:', err);
                            });
                        }
                    }
                } catch (err) {
                    console.error('[createOrder] RPC assign_least_busy_waiter exception:', err);
                }

                if (!finalWaiterId) {
                    const leastBusy = await this.getLeastBusyWaiter(actualRestaurantId);
                    if (leastBusy) {
                        finalWaiterId = leastBusy.id;
                    }
                }
            }
        } else if (isTakeaway) {
            // Check for existing active Takeaway order for this customer / phone / activeOrderId
            const activeOrderId = orderOptions?.activeOrderId || orderOptions?.existingOrderId;
            const custPhone = orderOptions?.customerPhone || orderOptions?.deliveryPhone || null;
            const cleanDigits = custPhone ? custPhone.replace(/\D/g, '').slice(-10) : null;

            if (activeOrderId) {
                const { data: exTakeaway } = await supabase
                    .from('orders')
                    .select('id, total_amount, waiter_id, gst_amount, cgst_amount, sgst_amount, delivery_fee, discount_amount, customer_id, customer_phone, status')
                    .eq('id', activeOrderId)
                    .eq('restaurant_id', actualRestaurantId)
                    .eq('order_type', 'TAKEAWAY')
                    .eq('is_completed', false)
                    .in('status', ['placed', 'preparing', 'ready'])
                    .maybeSingle();

                if (exTakeaway) {
                    existingOrder = exTakeaway;
                }
            }

            if (!existingOrder && customerId) {
                const { data: exTakeaway } = await supabase
                    .from('orders')
                    .select('id, total_amount, waiter_id, gst_amount, cgst_amount, sgst_amount, delivery_fee, discount_amount, customer_id, customer_phone, status')
                    .eq('customer_id', customerId)
                    .eq('restaurant_id', actualRestaurantId)
                    .eq('order_type', 'TAKEAWAY')
                    .eq('is_completed', false)
                    .in('status', ['placed', 'preparing', 'ready'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (exTakeaway) {
                    existingOrder = exTakeaway;
                }
            }

            if (!existingOrder && cleanDigits) {
                const { data: exTakeaway } = await supabase
                    .from('orders')
                    .select('id, total_amount, waiter_id, gst_amount, cgst_amount, sgst_amount, delivery_fee, discount_amount, customer_id, customer_phone, status')
                    .eq('restaurant_id', actualRestaurantId)
                    .eq('order_type', 'TAKEAWAY')
                    .eq('is_completed', false)
                    .or(`customer_phone.ilike.%${cleanDigits}%,delivery_phone.ilike.%${cleanDigits}%`)
                    .in('status', ['placed', 'preparing', 'ready'])
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (exTakeaway) {
                    existingOrder = exTakeaway;
                }
            }
        }

        // 3. Resolve GST Settings & Calculate Total
        const { data: resGstData } = await supabase
            .from('restaurants')
            .select('gst_percentage, cgst_percentage, sgst_percentage')
            .eq('id', actualRestaurantId)
            .maybeSingle();

        const defaultGst = resGstData?.gst_percentage != null ? Number(resGstData.gst_percentage) : 5;
        const defaultCgst = resGstData?.cgst_percentage != null ? Number(resGstData.cgst_percentage) : defaultGst / 2;
        const defaultSgst = resGstData?.sgst_percentage != null ? Number(resGstData.sgst_percentage) : defaultGst / 2;

        const menuIds = items.map(i => Number(i.menu_item_id)).filter(id => !isNaN(id) && id > 0);
        let menuItemsGstMap = new Map<number, { gst: number; cgst: number; sgst: number }>();
        if (menuIds.length > 0) {
            const { data: mData } = await supabase
                .from('menu_items')
                .select('id, gst_percentage, cgst_percentage, sgst_percentage, tax_percent')
                .in('id', menuIds);
            (mData || []).forEach(m => {
                const itemGst = m.gst_percentage != null ? Number(m.gst_percentage) : (m.tax_percent != null ? Number(m.tax_percent) : defaultGst);
                const itemCgst = m.cgst_percentage != null ? Number(m.cgst_percentage) : (itemGst / 2);
                const itemSgst = m.sgst_percentage != null ? Number(m.sgst_percentage) : (itemGst / 2);
                menuItemsGstMap.set(m.id, { gst: itemGst, cgst: itemCgst, sgst: itemSgst });
            });
        }

        let subtotal = 0;
        let newItemsGst = 0;
        let newItemsCgst = 0;
        let newItemsSgst = 0;

        const preparedItems = items.map(item => {
            const itemPrice = Number(item.price) || 0;
            const itemQty = Number(item.quantity) || 1;
            const itemSubtotal = itemPrice * itemQty;
            subtotal += itemSubtotal;

            const mGst = item.menu_item_id ? menuItemsGstMap.get(Number(item.menu_item_id)) : null;
            const itemGstRate = item.gst_percentage != null ? Number(item.gst_percentage) : (item.tax_percent != null ? Number(item.tax_percent) : (mGst ? mGst.gst : defaultGst));
            const itemCgstRate = item.cgst_percentage != null ? Number(item.cgst_percentage) : (mGst ? mGst.cgst : (itemGstRate / 2));
            const itemSgstRate = item.sgst_percentage != null ? Number(item.sgst_percentage) : (mGst ? mGst.sgst : (itemGstRate / 2));

            const itemGstAmount = (itemSubtotal * itemGstRate) / 100;
            const itemCgstAmount = (itemSubtotal * itemCgstRate) / 100;
            const itemSgstAmount = (itemSubtotal * itemSgstRate) / 100;

            newItemsGst += itemGstAmount;
            newItemsCgst += itemCgstAmount;
            newItemsSgst += itemSgstAmount;

            return {
                ...item,
                tax_percent: itemGstRate,
                cgst_percent: itemCgstRate,
                sgst_percent: itemSgstRate,
            };
        });

        const ceil2 = (num: number) => {
            const n = Number(num || 0);
            const clean = Math.round(n * 1e8) / 1e8;
            return Math.ceil(clean * 100) / 100;
        };
        const round2 = ceil2;
        const cgstAmount = ceil2(newItemsCgst);
        const sgstAmount = ceil2(newItemsSgst);
        const tax = ceil2(cgstAmount + sgstAmount);
        // Resolve delivery fee & zone server-side via PostGIS
        let resolvedDeliveryFee = 0;
        let resolvedDeliveryZoneId: string | null = orderOptions?.deliveryZoneId || null;

        if (isDelivery) {
            const cLat = orderOptions?.customerLat || orderOptions?.deliveryLat;
            const cLng = orderOptions?.customerLng || orderOptions?.deliveryLng;

            // If a specific delivery zone ID was provided, verify it is not deactivated
            if (orderOptions?.deliveryZoneId) {
                const { data: zData } = await supabase
                    .from('delivery_zones')
                    .select('id, name, enabled')
                    .eq('id', orderOptions.deliveryZoneId)
                    .maybeSingle();

                if (zData && !zData.enabled) {
                    throw new Error(`Cannot place order: delivery zone "${zData.name}" has been deactivated.`);
                }
            }

            if (cLat == null || cLng == null) {
                throw new Error('Cannot place delivery order: customer location coordinates are required to verify delivery eligibility.');
            }

            // Fetch restaurant delivery settings for radius & origin
            const { data: dSettings } = await supabase
                .from('delivery_settings')
                .select('latitude, longitude, delivery_order_radius, max_delivery_radius_km, delivery_fee')
                .eq('restaurant_id', actualRestaurantId)
                .maybeSingle();

            const restLat = dSettings?.latitude != null ? Number(dSettings.latitude) : null;
            const restLng = dSettings?.longitude != null ? Number(dSettings.longitude) : null;
            const deliveryRadius = dSettings?.delivery_order_radius != null 
                ? Number(dSettings.delivery_order_radius) 
                : (dSettings?.max_delivery_radius_km != null ? Number(dSettings.max_delivery_radius_km) : 5.0);

            if (restLat == null || restLng == null) {
                throw new Error('Cannot place delivery order: restaurant location has not been configured yet.');
            }

            // ══════════════════════════════════════════════════════════════
            // CONDITION 1: Customer location should be inside the delivery radius
            // ══════════════════════════════════════════════════════════════
            const R = 6371;
            const dLat = ((Number(cLat) - restLat) * Math.PI) / 180;
            const dLng = ((Number(cLng) - restLng) * Math.PI) / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((restLat * Math.PI) / 180) *
                Math.cos((Number(cLat) * Math.PI) / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distKm = Number((R * c).toFixed(2));

            if (distKm > deliveryRadius) {
                throw new Error(`Cannot place delivery order: your delivery address is ${distKm} km away, which is outside the restaurant delivery radius of ${deliveryRadius} km (Condition 1 failed).`);
            }

            // Check if customer location falls inside a deactivated zone
            const { data: deactivatedZones } = await supabase.rpc('check_deactivated_zone', {
                p_restaurant_id: actualRestaurantId,
                p_lat: Number(cLat),
                p_lng: Number(cLng),
            });

            if (deactivatedZones && deactivatedZones.length > 0) {
                throw new Error(`Cannot place delivery order: delivery zone "${deactivatedZones[0].zone_name}" has been deactivated by the restaurant.`);
            }

            // ══════════════════════════════════════════════════════════════
            // CONDITION 2: Customer location inside ANY active delivery zone
            // ══════════════════════════════════════════════════════════════
            const { data: matchedZones } = await supabase.rpc('check_delivery_zone', {
                p_restaurant_id: actualRestaurantId,
                p_lat: Number(cLat),
                p_lng: Number(cLng),
            });

            if (!matchedZones || matchedZones.length === 0) {
                throw new Error('Cannot place delivery order: your delivery address is not inside any active delivery zone (Condition 2 failed).');
            }

            // Both Condition 1 and Condition 2 are satisfied!
            const zone = matchedZones[0];
            resolvedDeliveryFee = Number(zone.delivery_fee) || 0;
            resolvedDeliveryZoneId = zone.zone_id;

            if (Number(zone.minimum_order_amount) > 0 && subtotal < Number(zone.minimum_order_amount)) {
                throw new Error(`Minimum order amount for ${zone.zone_name} is ₹${zone.minimum_order_amount}. Your subtotal is ₹${subtotal}.`);
            }
        }

        const deliveryFee = resolvedDeliveryFee;
        const newItemsTotal = round2(subtotal + tax + deliveryFee);

        let orderId: string;
        let finalTotal = newItemsTotal;

        // Resolve Customer ID if not directly provided but phone/name is available
        let finalCustomerId = customerId || null;
        const custPhone = orderOptions?.customerPhone || orderOptions?.deliveryPhone || null;
        if (!finalCustomerId && custPhone) {
            try {
                const upsertRes = await CustomerService.upsertCustomer(actualRestaurantId, {
                    name: orderOptions?.customerName,
                    mobile: custPhone,
                });
                if (upsertRes?.customerId) {
                    finalCustomerId = upsertRes.customerId;
                }
            } catch (err) {
                console.warn('[createOrder] Customer upsert fallback warning:', err);
            }
        }

        if (existingOrder) {
            orderId = existingOrder.id;

            // Fetch all current items from DB for this existing order to guarantee exact math
            const { data: existingDbItems } = await supabase
                .from('order_items')
                .select('price_at_time, quantity, tax_percent, cgst_percent, sgst_percent')
                .eq('order_id', existingOrder.id);

            let combinedSubtotal = 0;
            let combinedCgst = 0;
            let combinedSgst = 0;

            (existingDbItems || []).forEach(it => {
                const p = Number(it.price_at_time || 0);
                const q = Number(it.quantity || 1);
                const lineSub = p * q;
                combinedSubtotal += lineSub;
                const cr = Number(it.cgst_percent ?? (it.tax_percent ? it.tax_percent / 2 : 2.5));
                const sr = Number(it.sgst_percent ?? (it.tax_percent ? it.tax_percent / 2 : 2.5));
                combinedCgst += (lineSub * cr) / 100;
                combinedSgst += (lineSub * sr) / 100;
            });

            // Add the newly added items
            preparedItems.forEach(it => {
                const p = Number(it.price || 0);
                const q = Number(it.quantity || 1);
                const lineSub = p * q;
                combinedSubtotal += lineSub;
                const cr = Number(it.cgst_percent ?? (it.tax_percent ? it.tax_percent / 2 : 2.5));
                const sr = Number(it.sgst_percent ?? (it.tax_percent ? it.tax_percent / 2 : 2.5));
                combinedCgst += (lineSub * cr) / 100;
                combinedSgst += (lineSub * sr) / 100;
            });

            const finalCombinedSubtotal = round2(combinedSubtotal);
            const finalCombinedCgst = round2(combinedCgst);
            const finalCombinedSgst = round2(combinedSgst);
            const finalCombinedTax = round2(finalCombinedCgst + finalCombinedSgst);
            const orderDeliveryFee = round2(Number(existingOrder.delivery_fee || 0));
            const orderDiscount = round2(Number(existingOrder.discount_amount || 0));
            finalTotal = round2(finalCombinedSubtotal + finalCombinedTax + orderDeliveryFee - orderDiscount);

            const orderUpdate: any = { 
                total_amount: finalTotal,
                gst_amount: finalCombinedTax,
                cgst_amount: finalCombinedCgst,
                sgst_amount: finalCombinedSgst
            };

            // Associate customer to table order if missing
            if (finalCustomerId && !existingOrder.customer_id) {
                orderUpdate.customer_id = finalCustomerId;
            }
            if (custPhone && !existingOrder.customer_phone) {
                orderUpdate.customer_phone = custPhone;
            }

            // Update waiter_id if waiterId was explicitly provided or if existing waiter was inactive/missing and finalWaiterId is active
            if (waiterId) {
                orderUpdate.waiter_id = waiterId;
            } else if (finalWaiterId && (!existingOrder.waiter_id || existingOrder.waiter_id !== finalWaiterId)) {
                orderUpdate.waiter_id = finalWaiterId;
            }

            await retryOperation(async () => await supabase
                .from('orders')
                .update(orderUpdate)
                .eq('id', orderId));
        } else {
            // Create a brand-new order
            orderId = generateUUID();
            const effectiveStatus = isTakeawayOrDelivery ? 'placed' : (initialStatus || 'placed');
            const calculatedSubtotal = round2(subtotal);
            const calculatedDeliveryFee = round2(deliveryFee);
            const calculatedDiscount = round2(discountAmount || 0);
            finalTotal = round2(calculatedSubtotal + tax + calculatedDeliveryFee - calculatedDiscount);

            const orderInsert: any = {
                id: orderId,
                status: effectiveStatus,
                total_amount: finalTotal,
                gst_amount: tax,
                cgst_amount: cgstAmount,
                sgst_amount: sgstAmount,
                amount_paid: 0,
                is_completed: false,
                waiter_id: finalWaiterId || null,
                restaurant_id: actualRestaurantId,
                coupon_code: couponCode || null,
                discount_amount: calculatedDiscount,
                transaction_id: finalTransactionId,
                order_type: resolvedOrderType,
                delivery_address: orderOptions?.deliveryAddress || null,
                delivery_phone: orderOptions?.deliveryPhone || custPhone || null,
                delivery_notes: orderOptions?.deliveryNotes || (orderOptions?.customerName ? `Customer: ${orderOptions.customerName}` : null),
                delivery_fee: calculatedDeliveryFee,
                delivery_zone_id: resolvedDeliveryZoneId,
                delivery_lat: orderOptions?.deliveryLat || null,
                delivery_lng: orderOptions?.deliveryLng || null,
                customer_lat: orderOptions?.customerLat || null,
                customer_lng: orderOptions?.customerLng || null,
                customer_phone: custPhone,
            };
            if (finalCustomerId) orderInsert.customer_id = finalCustomerId;
            if (!isTakeawayOrDelivery && identifierValue) {
                orderInsert[identifierColumn] = identifierValue;
            }

            try {
                await retryOperation(async () => await supabase.from('orders').insert(orderInsert));
            } catch (err: any) {
                if (err.code === '23505') {
                    // Unique constraint violation occurred on insert retry
                    const { data: existing } = await supabase
                        .from('orders')
                        .select('id')
                        .eq('transaction_id', finalTransactionId)
                        .single();
                    if (existing) {
                        orderId = existing.id;
                    } else {
                        throw err;
                    }
                } else {
                    throw err;
                }
            }
        }

        // 5. Insert Order Items
        const orderItems = preparedItems.map(item => {
            const isComboOrSpecial = item.item_type === 'combo' || item.item_type === 'special';
            const numMenuId = Number(item.menu_item_id);
            const validMenuId = (!isComboOrSpecial && !isNaN(numMenuId) && numMenuId > 0) ? numMenuId : null;
            const row: any = {
                order_id: orderId,
                restaurant_id: actualRestaurantId,
                menu_item_id: validMenuId,
                quantity: item.quantity,
                notes: item.notes || '',
                price_at_time: item.price,
                status: isTakeawayOrDelivery ? 'placed' : (initialStatus === 'queued' ? 'queued' : 'placed'),
                item_type: item.item_type || (item.combo_name ? 'combo' : 'standard'),
                combo_id: item.combo_id || null,
                combo_name: item.combo_name || item.name || null,
                combo_image: item.combo_image || item.image_url || null,
                combo_items: item.combo_items || null,
                tax_percent: item.tax_percent,
                cgst_percent: item.cgst_percent,
                sgst_percent: item.sgst_percent,
            };
            if (typeof item.id === 'number' && !isNaN(item.id)) {
                row.id = item.id;
            }
            return row;
        });

        try {
            await retryOperation(async () => await supabase.from('order_items').insert(orderItems));
        } catch (err: any) {
            if (err.code === '23505') {
                console.log('[createOrder] Order items already inserted, ignoring duplicate.');
            } else {
                throw err;
            }
        }

        // 6. Ensure table status, assigned waiter, and waiter's last_assigned_at are updated (Dine In only)
        if (!isTakeawayOrDelivery && identifierValue) {
            try {
                const nowIso = new Date().toISOString();
                const tableUpdate: any = {
                    status: 'occupied',
                    last_activity_at: nowIso
                };
                if (finalWaiterId) {
                    tableUpdate.assigned_waiter_id = finalWaiterId;
                }

                if (identifierColumn === 'table_id') {
                    await supabase.from('tables').update(tableUpdate).eq('id', identifierValue);
                } else if (identifierColumn === 'merge_group_id') {
                    await supabase.from('table_merge_groups').update(tableUpdate).eq('id', identifierValue);
                    await supabase.from('tables').update(tableUpdate).eq('merged_group_id', identifierValue);
                }

                if (finalWaiterId) {
                    await supabase.from('employees').update({ last_assigned_at: nowIso }).eq('id', finalWaiterId);
                }
            } catch (e) {
                console.error('[createOrder] Error updating table status and waiter last_assigned_at:', e);
            }
        }

        return { id: orderId };
    },

    /**
     * Updates an existing order with a coupon code and discount amount.
     */
    async updateOrderCoupon(orderId: string, restaurantId: string, couponCode: string, discountAmount: number) {
        const { error } = await supabase
            .from('orders')
            .update({
                coupon_code: couponCode,
                discount_amount: discountAmount
            })
            .eq('id', orderId)
            .eq('restaurant_id', restaurantId);

        if (error) {
            console.error('Error updating order coupon:', error);
            throw error;
        }
        return true;
    },

    /**
     * Delete an entire order (Cancellation).
     */
    async deleteOrder(orderId: string, restaurantId: string) {
        // 1. Delete items first (Cascade usually handles this, but good to be explicit)
        // Note: items don't have restaurant_id, but the order does.
        await supabase.from('order_items').delete().eq('order_id', orderId);

        // 2. Delete Order
        const { error } = await supabase
            .from('orders')
            .delete()
            .eq('id', orderId)
            .eq('restaurant_id', restaurantId);
        if (error) throw error;
    },

    /**
     * Delete a specific order item.
     */
    async deleteOrderItem(itemId: string, restaurantId: string) {
        // 1. Get Item details for price calculation
        // We join with orders to check restaurant_id
        const { data: item } = await supabase
            .from('order_items')
            .select('price_at_time, quantity, order_id, orders!inner(restaurant_id)')
            .eq('id', itemId)
            .eq('orders.restaurant_id', restaurantId)
            .single();

        if (!item) return;

        // 2. Delete Item
        const { error } = await supabase.from('order_items').delete().eq('id', itemId);
        if (error) throw error;

        // 3. Update Order Total
        const amountDeduction = item.price_at_time * item.quantity;

        // Get current total
        const { data: order } = await supabase
            .from('orders')
            .select('total_amount, order_items(id)')
            .eq('id', item.order_id)
            .single();

        if (order) {
            // If no items left, delete order?
            if (order.order_items.length === 0) { // Note: array might still contain the deleted one depending on fetch timing, but here we assume it returns current
                // Actually fetch active items count
                const { count } = await supabase.from('order_items').select('*', { count: 'exact', head: true }).eq('order_id', item.order_id);
                if (count === 0) {
                    await this.deleteOrder(item.order_id, restaurantId);
                    return;
                }
            }

            // Update total
            await supabase
                .from('orders')
                .update({ total_amount: order.total_amount - amountDeduction })
                .eq('id', item.order_id)
                .eq('restaurant_id', restaurantId);
        }
    },

    /**
     * Fetch active delivery assignment for an order with delivery boy employee details
     */
    async getDeliveryAssignmentForOrder(orderId: string): Promise<any | null> {
        try {
            const { data: da } = await supabase
                .from('delivery_assignments')
                .select('id, status, delivery_boy_id, assigned_at, accepted_at, picked_up_at, out_for_delivery_at, delivered_at')
                .eq('order_id', orderId)
                .not('status', 'in', '("CANCELLED","REASSIGNED")')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (da && da.delivery_boy_id) {
                const { data: db } = await supabase
                    .from('delivery_boys')
                    .select('id, vehicle_type, vehicle_number, employee_id')
                    .eq('id', da.delivery_boy_id)
                    .maybeSingle();

                if (db && db.employee_id) {
                    const { data: emp } = await supabase
                        .from('employees')
                        .select('name, mobile, avatar_url')
                        .eq('id', db.employee_id)
                        .maybeSingle();

                    return {
                        ...da,
                        delivery_boy: {
                            id: db.id,
                            name: emp?.name || 'Delivery Partner',
                            mobile: emp?.mobile || '',
                            avatar_url: emp?.avatar_url || null,
                            vehicle_type: db.vehicle_type,
                            vehicle_number: db.vehicle_number,
                        }
                    };
                }
            }
        } catch (e) {
            console.error('Error fetching delivery assignment:', e);
        }
        return null;
    },

    /**
     * Fetch full details for a specific order by ID.
     */
    async getOrderDetails(orderId: string, restaurantId: string) {
        const actualRestaurantId = await this.resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (
                    *,
                    menu_items!order_items_menu_item_id_restaurant_fkey (name, image_url)
                ),
                tables:table_id (table_number, assigned_waiter_id, co_waiter_ids),
                table_merge_groups:merge_group_id (display_name, assigned_waiter_id)
            `)
            .eq('id', orderId)
            .eq('restaurant_id', actualRestaurantId)
            .maybeSingle();

        if (error) {
            console.error('Error fetching order details:', error);
            // return null or throw? For notification context, null is safer to avoid crashing
            return null;
        }

        if (!data) return null;

        // Fetch delivery assignment if exists
        const deliveryAssignment = await this.getDeliveryAssignmentForOrder(orderId);

        // Transform
        return {
            ...data,
            delivery_assignment: deliveryAssignment,
            table_number: (data as any).table_merge_groups?.display_name || (data as any).tables?.table_number,
            items: data.order_items.map((item: any) => ({
                ...item,
                id: String(item.id),
                name: item.combo_name || item.menu_items?.name || item.name || item.item_name || (item.item_type === 'combo' ? 'Combo' : (item.item_type === 'special' ? 'Special' : 'Unknown Item')),
                quantity: item.quantity,
                notes: item.notes,
                price: item.price_at_time,
                status: item.status || data.status,
                served_at: item.served_at,
                image_url: item.combo_image || item.menu_items?.image_url || item.image_url
            }))
        } as Order;
    },

    /**
     * Fetch active order for a specific table or merge group.
     */
    async getActiveOrderForTable(tableIdentifier: number | string, restaurantId: string) {
        if (tableIdentifier === undefined || tableIdentifier === null || tableIdentifier === '' || typeof tableIdentifier === 'object') return null;
        const strId = String(tableIdentifier).trim();
        if (!strId || strId === '{}' || strId === '[]' || strId === '[object Object]' || strId === 'undefined' || strId === 'null' || strId === 'NaN') {
            return null;
        }

        if (!restaurantId || typeof restaurantId === 'object') return null;
        const strRest = String(restaurantId).trim();
        if (!strRest || strRest === '{}' || strRest === 'undefined' || strRest === 'null') {
            return null;
        }

        // Resolve the restaurant slug → actual ID
        const actualRestaurantId = (await this.resolveRestaurantId(strRest)) || strRest;

        let identifierColumn: 'table_id' | 'merge_group_id' = 'table_id';
        let identifierValue: number | string | null = null;
        let isMerged = false;

        const physicalTable = await this.findTableAnywhere(strId, actualRestaurantId);
        
        if (physicalTable) {
            // Check if it's a merge group (from table_merge_groups)
            const isGroupRecord = 'display_name' in physicalTable;
            
            if (isGroupRecord || physicalTable.merged_group_id) {
                isMerged = true;
                identifierColumn = 'merge_group_id';
                identifierValue = isGroupRecord ? physicalTable.id : physicalTable.merged_group_id;
            } else {
                identifierColumn = 'table_id';
                identifierValue = physicalTable.id; // actual bigint DB id
            }
        } else if (typeof tableIdentifier === 'string' && tableIdentifier.includes('-') && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tableIdentifier)) {
            // Already a merge-group UUID
            isMerged = true;
            identifierColumn = 'merge_group_id';
            identifierValue = tableIdentifier;
        } else {
            // Table could not be resolved. Check if tableIdentifier itself is a valid numeric bigint
            const cleanNum = Number(strId.replace(/^table\s*[-_]?\s*/i, '').trim());
            if (!isNaN(cleanNum) && Number.isInteger(cleanNum)) {
                identifierColumn = 'table_id';
                identifierValue = cleanNum;
            } else {
                // Do not query orders table_id with non-numeric string (e.g. "Table 1", "1+2") which crashes Postgres with 22P02
                return null;
            }
        }

        if (!identifierValue) return null;

        const startTime = Date.now();
        let data: any = null;

        try {
            let query = supabase
                .from('orders')
                .select(`
                    *,
                    order_items (
                        *,
                        menu_items!order_items_menu_item_id_restaurant_fkey (name, image_url, preparation_time)
                    ),
                    tables (
                        status
                    ),
                    table_merge_groups (
                        status
                    )
                `)
                .eq(identifierColumn, identifierValue)
                .eq('is_completed', false);

            if (actualRestaurantId === restaurantId) {
                query = query.eq('restaurant_id', restaurantId);
            } else {
                query = query.or(`restaurant_id.eq.${restaurantId},restaurant_id.eq.${actualRestaurantId}`);
            }

            const { data: orderData, error } = await query
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) {
                if (error.code !== 'PGRST116') {
                    console.warn(`[getActiveOrderForTable] Query notice for table "${strId}":`, error.message || error.code || 'No active order');
                }
                return null;
            }
            data = orderData;
        } catch (err: any) {
            console.error('Exception fetching order for table:', err);
            return null;
        }

        if (!data) return null;

        // Fetch associated physical table IDs if it's a merge group or a single table
        let associatedTableIds: number[] = [];
        if (isMerged && identifierColumn === 'merge_group_id') {
            const { data: tables } = await supabase
                .from('tables')
                .select('id')
                .eq('merged_group_id', identifierValue);
            if (tables) associatedTableIds = tables.map(t => t.id);
        } else if (identifierColumn === 'table_id') {
            associatedTableIds = [Number(identifierValue)];
        }

        const rawTableName = physicalTable?.display_name || (physicalTable?.table_number ? String(physicalTable.table_number) : String(tableIdentifier));
        const resolvedTableName = rawTableName.toLowerCase().startsWith('table') ? rawTableName : `Table ${rawTableName}`;

        const deliveryAssignment = await this.getDeliveryAssignmentForOrder(data.id);

        return {
            ...data,
            delivery_assignment: deliveryAssignment,
            table_name: resolvedTableName,
            table_number: resolvedTableName,
            associated_table_ids: associatedTableIds,
            items: await this.enrichOrderItemsWithCombos(
                data.order_items.map((item: any) => {
                    const mi = Array.isArray(item.menu_items) ? item.menu_items[0] : item.menu_items;
                    const resolvedName = item.combo_name || mi?.name || item.name || item.item_name || (item.item_type === 'combo' ? 'Combo' : (item.item_type === 'special' ? 'Special' : `Item #${item.menu_item_id || item.id}`));
                    const resolvedImage = item.combo_image || mi?.image_url || item.image_url;
                    let parsedComboItems = item.combo_items;
                    if (typeof parsedComboItems === 'string') {
                        try {
                            parsedComboItems = JSON.parse(parsedComboItems);
                        } catch {
                            parsedComboItems = null;
                        }
                    }
                    return {
                        ...item,
                        id: String(item.id),
                        name: resolvedName,
                        quantity: item.quantity,
                        notes: item.notes,
                        price: item.price_at_time,
                        status: item.status || data.status,
                        served_at: item.served_at,
                        preparing_at: item.preparing_at,
                        estimated_end_at: item.estimated_end_at,
                        ready_at: item.ready_at,
                        extended_minutes: item.extended_minutes,
                        image_url: resolvedImage,
                        item_type: item.item_type || (parsedComboItems ? 'combo' : 'standard'),
                        combo_items: parsedComboItems
                    };
                }),
                actualRestaurantId
            )
        } as Order;
    },

    /**
     * Enriches order items with constituent combo items and their individual pricing
     * by cross-referencing today_specials and menu_items if combo_items is missing or lacks prices.
     */
    async enrichOrderItemsWithCombos(orderItems: any[], restaurantId: string): Promise<any[]> {
        if (!orderItems || orderItems.length === 0) return [];

        const hasCombos = orderItems.some((item) => {
            const isCombo = isComboItem(item);
            let subs = item.combo_items;
            if (typeof subs === 'string') {
                try { subs = JSON.parse(subs); } catch { subs = null; }
            }
            const needsSubs = !Array.isArray(subs) || subs.length === 0;
            const needsPrices = Array.isArray(subs) && subs.some((s: any) => s.price == null || Number(s.price) === 0);
            return isCombo || needsSubs || needsPrices;
        });

        if (!hasCombos) {
            return orderItems;
        }

        try {
            const [specialsRes, menuItemsRes] = await Promise.all([
                supabase
                    .from('today_specials')
                    .select(`
                        id,
                        title,
                        special_price,
                        image_url,
                        is_combo,
                        special_type,
                        items:today_special_items(
                            quantity,
                            menu_item_id,
                            menu_item:menu_items(
                                id,
                                name,
                                price,
                                image_url,
                                item_type,
                                is_veg
                            )
                        )
                    `)
                    .eq('restaurant_id', restaurantId),
                supabase
                    .from('menu_items')
                    .select('id, name, price, image_url, item_type, is_veg')
                    .eq('restaurant_id', restaurantId)
            ]);

            const specials = specialsRes.data || [];
            const menuItems = menuItemsRes.data || [];

            const menuItemsById = new Map<string, any>();
            const menuItemsByName = new Map<string, any>();
            menuItems.forEach((mi: any) => {
                menuItemsById.set(String(mi.id), mi);
                if (mi.name) {
                    menuItemsByName.set(mi.name.trim().toLowerCase(), mi);
                }
            });

            return orderItems.map((item) => {
                const isCombo = isComboItem(item);
                let parsedComboItems = item.combo_items;
                if (typeof parsedComboItems === 'string') {
                    try {
                        parsedComboItems = JSON.parse(parsedComboItems);
                    } catch {
                        parsedComboItems = null;
                    }
                }

                if (!isCombo && (!Array.isArray(parsedComboItems) || parsedComboItems.length === 0)) {
                    return item;
                }

                // If sub-items are missing, find matching special in today_specials
                if (!Array.isArray(parsedComboItems) || parsedComboItems.length === 0) {
                    const matchedSpecial = specials.find((s: any) =>
                        (item.combo_id && String(s.id) === String(item.combo_id)) ||
                        (item.combo_name && s.title?.trim().toLowerCase() === item.combo_name.trim().toLowerCase()) ||
                        (item.name && s.title?.trim().toLowerCase() === item.name.trim().toLowerCase())
                    );

                    if (matchedSpecial && matchedSpecial.items && matchedSpecial.items.length > 0) {
                        parsedComboItems = matchedSpecial.items.map((si: any) => {
                            const mi = si.menu_item || (si.menu_item_id ? menuItemsById.get(String(si.menu_item_id)) : null);
                            const name = mi?.name || 'Item';
                            const price = Number(mi?.price || 0);
                            const image_url = mi?.image_url || getCategoryMenuItemImage(name);
                            const item_type = mi?.item_type || (mi?.is_veg ? 'Veg' : 'Non-Veg');

                            return {
                                menu_item_id: si.menu_item_id || mi?.id || null,
                                name,
                                quantity: Number(si.quantity) || 1,
                                price,
                                image_url,
                                item_type,
                            };
                        });

                        // Fire background update to persist backfilled combo_items into order_items
                        if (item.id) {
                            supabase
                                .from('order_items')
                                .update({
                                    combo_items: parsedComboItems,
                                    combo_id: matchedSpecial.id,
                                    combo_name: item.combo_name || matchedSpecial.title,
                                    item_type: 'combo'
                                })
                                .eq('id', item.id)
                                .then();
                        }
                    }
                }

                // If we have sub-items, ensure each sub-item has individual price, image, item_type
                if (Array.isArray(parsedComboItems) && parsedComboItems.length > 0) {
                    parsedComboItems = parsedComboItems.map((sub: any) => {
                        let price = Number(sub.price || 0);
                        let img = sub.image_url;
                        let type = sub.item_type;

                        const matchedMi = (sub.menu_item_id ? menuItemsById.get(String(sub.menu_item_id)) : null) ||
                                          (sub.name ? menuItemsByName.get(sub.name.trim().toLowerCase()) : null);

                        if (matchedMi) {
                            if (!price) price = Number(matchedMi.price || 0);
                            if (!img) img = matchedMi.image_url;
                            if (!type) type = matchedMi.item_type || (matchedMi.is_veg ? 'Veg' : 'Non-Veg');
                        }

                        if (!img) img = getCategoryMenuItemImage(sub.name || 'Item');

                        return {
                            ...sub,
                            name: sub.name || matchedMi?.name || 'Item',
                            quantity: Number(sub.quantity) || 1,
                            price,
                            image_url: img,
                            item_type: type || 'Veg',
                            menu_item_id: sub.menu_item_id || matchedMi?.id || null
                        };
                    });
                }

                return {
                    ...item,
                    item_type: isCombo ? 'combo' : item.item_type,
                    combo_items: parsedComboItems
                };
            });
        } catch (err) {
            console.error('[enrichOrderItemsWithCombos] Error enriching combo items:', err);
            return orderItems;
        }
    },

    /**
     * Settle the bill for an order.
     * Marks order as 'paid' AND updates amount_paid.
     */
    async settleBill(orderId: string, restaurantId: string, _frontendTotal?: number, paidBy: string = 'System', staffId?: string) {
        // 1. Fetch latest total from DB to ensure we don't use stale frontend data
        const { data: order, error: fetchError } = await supabase
            .from('orders')
            .select('total_amount, discount_amount, table_id, merge_group_id, waiter_id')
            .eq('id', orderId)
            .eq('restaurant_id', restaurantId)
            .single();

        if (fetchError || !order) throw fetchError || new Error('Order not found');

        // Staff authorization check
        if (staffId) {
            const staffIdLower = String(staffId).toLowerCase();
            let isPrivileged = false;
            try {
                const { data: emp } = await supabase.from('employees').select('role').eq('id', staffId).maybeSingle();
                if (emp?.role && ['admin', 'supervisor', 'restaurant_admin', 'manager'].includes(emp.role.toLowerCase())) {
                    isPrivileged = true;
                }
            } catch (_) {}

            if (!isPrivileged) {
                const targetTableId = order.table_id || order.merge_group_id;
                const physicalTable = targetTableId ? await this.findTableAnywhere(targetTableId, restaurantId) : null;
                const assignedWaiterId = physicalTable?.assigned_waiter_id || order.waiter_id;
                const coWaiters: string[] = Array.isArray(physicalTable?.co_waiter_ids)
                    ? physicalTable.co_waiter_ids.map((id: any) => String(id).toLowerCase())
                    : [];

                const isAssigned = assignedWaiterId && String(assignedWaiterId).toLowerCase() === staffIdLower;
                const isCo = coWaiters.includes(staffIdLower);

                if (!isAssigned && !isCo && assignedWaiterId) {
                    throw new Error(`Unauthorized: You are not assigned to Table ${physicalTable?.table_number || targetTableId} and cannot settle its bill.`);
                }
            }
        }

        // 2. Settle fully based on DB total minus discount AND set completed_at
        const payableAmount = (order.total_amount || 0) - (order.discount_amount || 0);
        const { error } = await supabase
            .from('orders')
            .update({
                status: 'paid',
                amount_paid: payableAmount,
                paid_by: paidBy,
                completed_at: new Date().toISOString(), // Set completed time
                is_completed: true // Mark completed so it leaves active orders
            })
            .eq('id', orderId)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;

        // 4. Update table status to 'cleaning' (valid table_status enum) and mark all items as paid in parallel
        // Retain assigned waiter so they can see their table in "Needs Cleaning" state and clear it
        const now = new Date().toISOString();
        const tableUpdate: any = { status: 'cleaning', last_activity_at: now };
        if (order.waiter_id) {
            tableUpdate.assigned_waiter_id = order.waiter_id;
        }

        const updatePromises: PromiseLike<any>[] = [
            supabase.from('order_items').update({ status: 'paid' }).eq('order_id', orderId)
        ];

        if (order.merge_group_id) {
            updatePromises.push(
                supabase.from('table_merge_groups').update(tableUpdate).eq('id', order.merge_group_id),
                supabase.from('tables').update(tableUpdate).eq('merged_group_id', order.merge_group_id)
            );
        } else if (order.table_id) {
            updatePromises.push(
                supabase.from('tables').update(tableUpdate).eq('id', order.table_id)
            );
        }

        await Promise.all(updatePromises);

        // 5. Recalculate waiter workload
        if (order.waiter_id) {
            try {
                await supabase.rpc('calculate_waiter_workload', { waiter_uuid: order.waiter_id });
            } catch (_) {}
        }
    },

    /**
     * Record payment for a Takeaway order prior to handover.
     * Records payment status as Paid and the selected payment method (Cash/UPI/Card).
     */
    async confirmTakeawayPayment(
        orderId: string, 
        restaurantId: string, 
        paymentMethod: 'Cash' | 'UPI' | 'Card', 
        amount?: number, 
        staffId?: string
    ) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        const { data: order, error: fetchErr } = await supabase
            .from('orders')
            .select('id, total_amount, discount_amount, paid_by, amount_paid, is_completed, status, order_type')
            .eq('id', orderId)
            .eq('restaurant_id', actualRestaurantId)
            .single();

        if (fetchErr || !order) {
            throw fetchErr || new Error('Order not found');
        }

        if (order.is_completed) {
            throw new Error('This order has already been completed and handed over.');
        }

        const ceil2 = (num: number) => {
            const n = Number(num || 0);
            const clean = Math.round(n * 1e8) / 1e8;
            return Math.ceil(clean * 100) / 100;
        };

        const payableAmount = amount != null 
            ? ceil2(amount) 
            : ceil2(Math.max(0, Number(order.total_amount || 0) - Number(order.discount_amount || 0)));

        // Update payment details on orders
        const { data: updated, error: updateErr } = await supabase
            .from('orders')
            .update({
                paid_by: paymentMethod,
                amount_paid: payableAmount,
                status: 'paid', // Record payment status as Paid
            })
            .eq('id', orderId)
            .eq('restaurant_id', actualRestaurantId)
            .select()
            .single();

        if (updateErr) throw updateErr;

        // Mark items as paid in parallel
        await supabase
            .from('order_items')
            .update({ status: 'paid' })
            .eq('order_id', orderId);

        return updated;
    },

    /**
     * Complete Takeaway order handover.
     * Ensures order is paid before marking as handed over/completed.
     */
    async completeTakeawayHandover(orderId: string, restaurantId: string, staffId?: string) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        const { data: order, error: fetchErr } = await supabase
            .from('orders')
            .select('id, total_amount, discount_amount, paid_by, amount_paid, is_completed, status, order_type')
            .eq('id', orderId)
            .eq('restaurant_id', actualRestaurantId)
            .single();

        if (fetchErr || !order) {
            throw fetchErr || new Error('Order not found');
        }

        if (order.is_completed) {
            throw new Error('Order is already handed over and completed.');
        }

        // Safety: verify payment is confirmed
        const ceil2 = (num: number) => {
            const n = Number(num || 0);
            const clean = Math.round(n * 1e8) / 1e8;
            return Math.ceil(clean * 100) / 100;
        };
        const payableAmount = ceil2(Math.max(0, Number(order.total_amount || 0) - Number(order.discount_amount || 0)));
        const isPaid = !!order.paid_by || order.status === 'paid' || (order.amount_paid != null && order.amount_paid >= payableAmount);

        if (!isPaid) {
            throw new Error('Safety check failed: Takeaway order cannot be handed over before payment confirmation.');
        }

        const now = new Date().toISOString();

        // Mark as handed over/completed
        const { data: completedOrder, error: updateErr } = await supabase
            .from('orders')
            .update({
                status: 'served', // Standard ROS status for handed over/completed
                is_completed: true,
                completed_at: now
            })
            .eq('id', orderId)
            .eq('restaurant_id', actualRestaurantId)
            .select()
            .single();

        if (updateErr) throw updateErr;

        // Cascade items to served with served_at timestamp
        await supabase
            .from('order_items')
            .update({
                status: 'served',
                served_at: now
            })
            .eq('order_id', orderId);

        return completedOrder;
    },

    /**
     * Request bill for a table with waiter authorization check.
     */
    async requestBill(tableId: string | number, restaurantId: string, staffId?: string) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;
        const physicalTable = await this.findTableAnywhere(tableId, actualRestaurantId);
        if (!physicalTable) throw new Error('Table not found');

        if (staffId && physicalTable.assigned_waiter_id) {
            const staffIdLower = String(staffId).toLowerCase();
            const assignedStr = String(physicalTable.assigned_waiter_id).toLowerCase();
            const coWaiters: string[] = Array.isArray(physicalTable.co_waiter_ids)
                ? physicalTable.co_waiter_ids.map((id: any) => String(id).toLowerCase())
                : [];

            let isPrivileged = false;
            try {
                const { data: emp } = await supabase.from('employees').select('role').eq('id', staffId).maybeSingle();
                if (emp?.role && ['admin', 'supervisor', 'restaurant_admin', 'manager'].includes(emp.role.toLowerCase())) {
                    isPrivileged = true;
                }
            } catch (_) {}

            if (!isPrivileged && staffIdLower !== assignedStr && !coWaiters.includes(staffIdLower)) {
                throw new Error(`Unauthorized: You are not assigned to Table ${physicalTable.table_number || physicalTable.id} and cannot request a bill.`);
            }
        }

        const isGroup = 'display_name' in physicalTable;
        const ids = isGroup && physicalTable.member_tables 
            ? physicalTable.member_tables.map((t: any) => t.id) 
            : [physicalTable.id];

        await supabase.from('tables').update({ status: 'need_bill' }).in('id', ids).eq('restaurant_id', actualRestaurantId);
    },

    /**
     * Helper to verify if a waiter currently has active management access to a table.
     */
    async verifyWaiterTableAccess(tableIdentifier: string | number, waiterId: string, restaurantId?: string): Promise<{ authorized: boolean; reason?: string; table?: any }> {
        const actualRestaurantId = restaurantId ? ((await this.resolveRestaurantId(restaurantId)) || restaurantId) : undefined;
        let physicalTable: any = null;
        if (actualRestaurantId) {
            physicalTable = await this.findTableAnywhere(tableIdentifier, actualRestaurantId);
        } else {
            const { data } = await supabase.from('tables').select('*').eq('id', tableIdentifier).maybeSingle();
            physicalTable = data;
        }
        if (!physicalTable) {
            return { authorized: false, reason: 'Table not found' };
        }

        if (!physicalTable.assigned_waiter_id) {
            return { authorized: true, table: physicalTable };
        }

        const waiterStr = String(waiterId).toLowerCase();
        const assignedStr = String(physicalTable.assigned_waiter_id).toLowerCase();
        const coWaiters = Array.isArray(physicalTable.co_waiter_ids)
            ? physicalTable.co_waiter_ids.map((id: any) => String(id).toLowerCase())
            : [];

        if (waiterStr === assignedStr || coWaiters.includes(waiterStr)) {
            return { authorized: true, table: physicalTable };
        }

        try {
            const { data: emp } = await supabase.from('employees').select('role').eq('id', waiterId).maybeSingle();
            if (emp?.role && ['admin', 'supervisor', 'restaurant_admin', 'manager'].includes(emp.role.toLowerCase())) {
                return { authorized: true, table: physicalTable };
            }
        } catch (_) {}

        return { 
            authorized: false, 
            reason: `Table is assigned to another waiter (${physicalTable.assigned_waiter_name || 'other staff'}).`, 
            table: physicalTable 
        };
    },

    /**
     * Update the status of a specific order item.
     */
    async updateOrderItemStatus(itemId: string, restaurantId: string, status: OrderStatus, staffId?: string) {
        // Enforce permission check when marking as served
        if (status === 'served' && staffId) {
            const { data: itemInfo } = await supabase
                .from('order_items')
                .select('order_id, orders(table_id, waiter_id, restaurant_id)')
                .eq('id', itemId)
                .maybeSingle();

            if (itemInfo?.orders) {
                const orderData: any = itemInfo.orders;
                const tableId = orderData.table_id;
                const actualRestId = (await this.resolveRestaurantId(orderData.restaurant_id || restaurantId)) || restaurantId;

                const physicalTable = await this.findTableAnywhere(tableId, actualRestId);
                const assignedWaiterId = physicalTable?.assigned_waiter_id || orderData.waiter_id;
                const coWaiters: string[] = Array.isArray(physicalTable?.co_waiter_ids)
                    ? physicalTable.co_waiter_ids.map((id: any) => String(id).toLowerCase())
                    : [];

                // Check staff role
                const { data: staffMember } = await supabase
                    .from('staff')
                    .select('id, role')
                    .eq('id', staffId)
                    .maybeSingle();

                const isAdmin = staffMember?.role && ['admin', 'supervisor', 'restaurant_admin'].includes(staffMember.role);
                const staffIdLower = String(staffId).toLowerCase();
                const isAssigned = assignedWaiterId && String(assignedWaiterId).toLowerCase() === staffIdLower;
                const isCo = coWaiters.includes(staffIdLower);

                if (!isAdmin && !isAssigned && !isCo && assignedWaiterId) {
                    throw new Error('Unauthorized: Only the assigned waiter or approved co-waiters can mark items as served.');
                }
            }
        }

        // 1. Update the Item
        const updateData: any = { status };
        
        if (status === 'preparing') {
            const now = new Date();
            updateData.preparing_at = now.toISOString();
            
            // Get preparation_time from associated menu_item
            const { data: itemData } = await supabase
                .from('order_items')
                .select('menu_items(preparation_time)')
                .eq('id', itemId)
                .single();
            
            const prepTime = (itemData as any)?.menu_items?.preparation_time || 15;
            const estimatedEnd = new Date(now.getTime() + prepTime * 60000);
            updateData.estimated_end_at = estimatedEnd.toISOString();
            updateData.extended_minutes = 0;
        } else if (status === 'ready') {
            updateData.ready_at = new Date().toISOString();
        } else if (status === 'served') {
            updateData.served_at = new Date().toISOString();
        }

        const { data: item, error } = await supabase
            .from('order_items')
            .update(updateData)
            .eq('id', itemId)
            .select('order_id')
            .single();

        if (error) throw error;
        if (!item) return;

        // Trigger "Order Ready" Alert if item is marked ready
        if (status === 'ready') {
            const { data: order } = await supabase
                .from('orders')
                .select('table_id, restaurant_id')
                .eq('id', item.order_id)
                .single();

            if (order && order.restaurant_id) {
                // Always create a FRESH alert to notify the waiter again.
                // Delete old order_ready requests (both completed and pending) in a single atomic query
                const { error: deleteError } = await supabase
                    .from('service_requests')
                    .delete()
                    .eq('table_id', order.table_id)
                    .eq('request_type', 'order_ready')
                    .in('request_status', ['completed', 'pending']);

                if (deleteError) {
                    console.error('Failed to cleanup old order_ready alerts:', deleteError);
                }

                // 2. Create NEW 'order_ready' request
                await this.submitServiceRequest(order.table_id, 'order_ready', order.restaurant_id);
            }
        }

        // 2. Check siblings to sync Parent Order Status with strict priority:
        // Priority 1: If ANY item is 'placed' (or 'queued'), Order -> 'placed' (Incoming)
        // Priority 2: Else if ANY item is 'preparing' (or 'cooking'), Order -> 'preparing' (Preparing)
        // Priority 3: Else if ANY item is 'ready', Order -> 'ready' (Ready)
        // Priority 4: Else if ALL items are 'served' (or 'paid'), Order -> 'served' (Served/Dining)

        const { data: siblings } = await supabase
            .from('order_items')
            .select('status')
            .eq('order_id', item.order_id);

        if (!siblings) return;

        const activeSiblings = siblings.filter(s => s.status !== 'cancelled');
        if (activeSiblings.length === 0) return;

        const siblingStatuses = activeSiblings.map(s => s.status?.toLowerCase());

        let newOrderStatus: OrderStatus = 'placed';

        if (siblingStatuses.some(s => s === 'placed' || s === 'queued' || s === 'incoming')) {
            newOrderStatus = 'placed';
        } else if (siblingStatuses.some(s => s === 'preparing' || s === 'cooking')) {
            newOrderStatus = 'preparing';
        } else if (siblingStatuses.some(s => s === 'ready')) {
            newOrderStatus = 'ready';
        } else if (siblingStatuses.every(s => s === 'served' || s === 'paid')) {
            newOrderStatus = 'served';
        }

        await supabase
            .from('orders')
            .update({ status: newOrderStatus })
            .eq('id', item.order_id);
    },

    /**
     * Extend the preparation timer for an order item.
     */
    async extendOrderItemTimer(itemId: string, additionalMinutes: number) {
        const { data: currentItem, error: fetchError } = await supabase
            .from('order_items')
            .select('estimated_end_at, extended_minutes')
            .eq('id', itemId)
            .single();

        if (fetchError || !currentItem) throw fetchError || new Error('Item not found');

        const currentEstimatedEnd = new Date(currentItem.estimated_end_at);
        const newEstimatedEnd = new Date(currentEstimatedEnd.getTime() + additionalMinutes * 60000);
        const totalExtended = (currentItem.extended_minutes || 0) + additionalMinutes;

        const { error: updateError } = await supabase
            .from('order_items')
            .update({
                estimated_end_at: newEstimatedEnd.toISOString(),
                extended_minutes: totalExtended
            })
            .eq('id', itemId);

        if (updateError) throw updateError;
        return { newEstimatedEnd, totalExtended };
    },

    /**
     * Free a table manually.
     * Sets table status to 'free' AND archives the current order.
     */
    async clearTable(tableId: number | string, restaurantId: string, requestingStaffId?: string) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        const physicalTable = await this.findTableAnywhere(tableId, actualRestaurantId);
        
        if (!physicalTable) {
            console.warn(`[clearTable] Could not resolve table: ${tableId}`);
            // Fallback for direct UUID strings if findTableAnywhere fails
            if (typeof tableId === 'string' && tableId.includes('-')) {
                await this.unmergeTables(tableId, actualRestaurantId);
            }
            return;
        }

        // Authorization check if requestingStaffId is passed
        if (requestingStaffId && physicalTable.assigned_waiter_id) {
            const assignedStr = String(physicalTable.assigned_waiter_id).toLowerCase();
            const reqStr = String(requestingStaffId).toLowerCase();
            const coWaiters = Array.isArray(physicalTable.co_waiter_ids)
                ? physicalTable.co_waiter_ids.map((id: any) => String(id).toLowerCase())
                : [];
            if (reqStr !== assignedStr && !coWaiters.includes(reqStr)) {
                let isPrivileged = false;
                try {
                    const { data: emp } = await supabase.from('employees').select('role').eq('id', requestingStaffId).maybeSingle();
                    if (emp?.role && ['admin', 'supervisor', 'restaurant_admin', 'manager'].includes(emp.role.toLowerCase())) {
                        isPrivileged = true;
                    }
                } catch (_) {}
                if (!isPrivileged) {
                    throw new Error(`Unauthorized: You are not assigned to Table ${physicalTable.table_number || physicalTable.id} and cannot clear it.`);
                }
            }
        }

        // Remove all pending services for waiter after table is cleared
        await this.dismissTableAlert(tableId, actualRestaurantId);

        const isGroup = 'display_name' in physicalTable;
        const groupId = isGroup ? physicalTable.id : physicalTable.merged_group_id;
        const assignedWaiterId = (physicalTable as any).assigned_waiter_id;

        if (groupId) {
            // Archive orders for the group
            const { error: orderError } = await supabase
                .from('orders')
                .update({ 
                    is_completed: true,
                    status: 'paid',
                    completed_at: new Date().toISOString()
                })
                .eq('merge_group_id', groupId)
                .eq('restaurant_id', actualRestaurantId)
                .neq('status', 'paid');

            if (orderError) console.error('Failed to archive merged order:', orderError);
            
            // Unmerge the tables
            await this.unmergeTables(groupId, actualRestaurantId);
        } else {
            // Normal table
            const actualTableId = physicalTable.id;

            const { error: tableError } = await supabase
                .from('tables')
                .update({
                    status: 'available',
                    assigned_waiter_id: null,
                    co_waiter_ids: [],
                    customer_present_at: null,
                    last_activity_at: null,
                    alert_status: null,
                    transferred_from_waiter_id: null,
                    transferred_to_waiter_id: null
                })
                .eq('id', actualTableId)
                .eq('restaurant_id', actualRestaurantId);

            if (tableError) console.error('Failed to clear table:', tableError);

            const { error: orderError } = await supabase
                .from('orders')
                .update({ 
                    is_completed: true,
                    status: 'paid',
                    completed_at: new Date().toISOString()
                })
                .eq('table_id', actualTableId)
                .eq('restaurant_id', actualRestaurantId)
                .neq('status', 'paid');

            if (orderError) console.error('Failed to archive order:', orderError);
        }

        // Recalculate waiter workload
        if (assignedWaiterId) {
            try {
                await supabase.rpc('calculate_waiter_workload', { waiter_uuid: assignedWaiterId });
            } catch (_) {}
        }

        // Invalidate customer cache for this table
        try {
            CustomerCache.clear(actualRestaurantId, 'orders', String(physicalTable.table_number || tableId));
        } catch (_) {}
    },

    /**
     * Set table alert status (Call Waiter, Bill Requested).
     * Now delegates to submitServiceRequest or dismissTableAlert for persistence.
     */
    async setTableAlert(tableId: number | string, status: 'call_waiter' | 'bill_requested' | null, restaurantId: string) {
        if (status) {
            await this.submitServiceRequest(tableId, status, restaurantId);
        } else {
            await this.dismissTableAlert(tableId, restaurantId);
        }
    },

    /**
     * Complete/Resolve a specific service request.
     */
    async completeServiceRequest(requestId: number, restaurantId: string, staffId?: string) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        // Fetch the request info first to know table_id and type
        const { data: request, error: fetchError } = await supabase
            .from('service_requests')
            .select('id, table_id, request_type, request_status, restaurant_id')
            .eq('id', requestId)
            .maybeSingle();

        if (fetchError) {
            console.error('[completeServiceRequest] Failed to fetch request:', requestId, JSON.stringify(fetchError));
            throw fetchError;
        }

        if (!request) {
            console.warn('[completeServiceRequest] Request not found, already deleted?', { requestId, actualRestaurantId });
            return; // Not an error — request was already cleaned up
        }

        // Authorization check: Verify waiter table assignment if staffId is provided
        if (staffId && request.table_id) {
            const hasAccess = await this.verifyWaiterTableAccess(request.table_id, staffId, actualRestaurantId);
            if (!hasAccess.authorized) {
                throw new Error(`Unauthorized: Waiter does not have access to complete service requests for Table ${request.table_id}.`);
            }
        }

        if (request.request_status === 'completed') {
            console.log('[completeServiceRequest] Request already completed, skipping:', requestId);
            return; // Already done, no-op
        }

        // Delete any old completed rows with the same table_id + request_type
        // to avoid unique constraint violation (service_requests_table_type_status_uq)
        await supabase
            .from('service_requests')
            .delete()
            .eq('table_id', request.table_id)
            .eq('request_type', request.request_type)
            .eq('request_status', 'completed');

        const { error } = await supabase
            .from('service_requests')
            .update({
                request_status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .eq('restaurant_id', request.restaurant_id);

        if (error) {
            console.error('[completeServiceRequest] Update failed:', error?.message, error?.code, { requestId, actualRestaurantId });
            throw error;
        }

        // Update the table's alert status
        if (request?.table_id) {
            const { data: nextRequest } = await supabase
                .from('service_requests')
                .select('request_type')
                .eq('table_id', request.table_id)
                .eq('request_status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const nextStatus = nextRequest ? nextRequest.request_type : null;

            await supabase
                .from('tables')
                .update({ alert_status: nextStatus })
                .eq('id', request.table_id);
        }
    },

    /**
     * Accept a service request (Mark as in-progress/accepted).
     * Supports both primary assigned waiters and co-waiters with shared table access.
     */
    async acceptServiceRequest(requestId: number, restaurantId: string, waiterId: string) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        // 1. Fetch request details first to verify authorization
        const { data: currentReq, error: fetchError } = await supabase
            .from('service_requests')
            .select('id, table_id, request_type, request_status, assigned_waiter_id, restaurant_id')
            .eq('id', requestId)
            .maybeSingle();

        if (fetchError) {
            console.error('Error fetching service request:', fetchError);
            throw fetchError;
        }

        if (!currentReq) {
            throw new Error('Service request not found.');
        }

        if (currentReq.request_status !== 'pending') {
            throw new Error(`This request has already been ${currentReq.request_status}.`);
        }

        // 2. Verify waiter has access to this table (assigned, co-waiter, or admin)
        if (currentReq.table_id) {
            const hasAccess = await this.verifyWaiterTableAccess(currentReq.table_id, waiterId, actualRestaurantId);
            if (!hasAccess.authorized) {
                throw new Error('Unauthorized: You do not have access to accept service requests for this table.');
            }
        }

        // 3. Update the request — no restrictive assigned_waiter_id filter
        const { data, error } = await supabase
            .from('service_requests')
            .update({
                request_status: 'accepted',
                accepted_by: waiterId,
                accepted_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .eq('restaurant_id', currentReq.restaurant_id || actualRestaurantId)
            .eq('request_status', 'pending')
            .select();

        if (error) {
            console.error('Error accepting service request:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error('Could not accept service request. It may have been accepted by another waiter.');
        }

        return data[0];
    },

    /**
     * Mark a service request as delivered.
     */
    async markRequestDelivered(requestId: number, restaurantId: string, staffId?: string) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        // Fetch the request info first to know table_id and type
        const { data: request } = await supabase
            .from('service_requests')
            .select('table_id, request_type, request_status')
            .eq('id', requestId)
            .maybeSingle();

        if (!request || request.request_status === 'completed') return;

        // Authorization check: Verify waiter table assignment if staffId is provided
        if (staffId && request.table_id) {
            const hasAccess = await this.verifyWaiterTableAccess(request.table_id, staffId, actualRestaurantId);
            if (!hasAccess.authorized) {
                throw new Error(`Unauthorized: Waiter does not have access to complete service requests for Table ${request.table_id}.`);
            }
        }

        // Delete old completed rows to avoid unique constraint violation
        await supabase
            .from('service_requests')
            .delete()
            .eq('table_id', request.table_id)
            .eq('request_type', request.request_type)
            .eq('request_status', 'completed');

        const { error } = await supabase
            .from('service_requests')
            .update({
                request_status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .eq('restaurant_id', actualRestaurantId);

        if (error) {
            console.error('Error marking request delivered:', error?.message, error?.code);
            return;
        }

        // Update the table's alert status
        if (request?.table_id) {
            const { data: nextRequest } = await supabase
                .from('service_requests')
                .select('request_type')
                .eq('table_id', request.table_id)
                .eq('request_status', 'pending')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const nextStatus = nextRequest ? nextRequest.request_type : null;

            await supabase
                .from('tables')
                .update({ alert_status: nextStatus })
                .eq('id', request.table_id);
        }
    },

    /**
     * Dismiss a table alert.
     * Clears the table alert status AND resolves all pending service requests for the table.
     */
    async dismissTableAlert(tableId: number | string, restaurantId?: string) {
        const actualRestaurantId = restaurantId ? ((await this.resolveRestaurantId(restaurantId)) || restaurantId) : undefined;

        // Resolve the table
        const physicalTable = await this.findTableAnywhere(tableId, actualRestaurantId);
        
        if (!physicalTable) {
            console.warn(`[dismissTableAlert] Could not resolve table: ${tableId}`);
            return;
        }

        const isGroup = 'display_name' in physicalTable;
        const groupId = isGroup ? physicalTable.id : physicalTable.merged_group_id;

        if (groupId) {
            const { data: tables } = await supabase
                .from('tables')
                .select('id')
                .eq('merged_group_id', groupId);
            
            if (!tables || tables.length === 0) return;
            const tableIds = tables.map(t => t.id);

            // Delete old completed rows first to avoid unique constraint violation
            await supabase.from('service_requests')
                .delete()
                .in('table_id', tableIds)
                .eq('request_status', 'completed');

            await supabase.from('service_requests')
                .update({
                    request_status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .in('table_id', tableIds);

            await supabase.from('tables')
                .update({ alert_status: null })
                .in('id', tableIds);
            return;
        }

        // Plain physical table — use its actual DB id
        const actualTableId = physicalTable.id;
        
        await supabase.from('tables')
            .update({ alert_status: null })
            .eq('id', actualTableId);

        // Delete old completed rows first to avoid unique constraint violation
        await supabase.from('service_requests')
            .delete()
            .eq('table_id', actualTableId)
            .eq('request_status', 'completed');

        await supabase.from('service_requests')
            .update({
                request_status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('table_id', actualTableId);
    },



    /**
     * Submit a new service request (Water, Bill, etc.)
     * Supports multiple active requests per table.
     * persisted in service_requests AND updates table alert_status.
     */
    async submitServiceRequest(tableId: number | string, type: string, restaurantId: string, quantity: number = 1) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        const physicalTable = await this.findTableAnywhere(tableId, actualRestaurantId);
        let actualTableId: number;

        if (!physicalTable) {
            console.error('Table not found for service request:', tableId);
            return;
        }

        const isGroup = 'display_name' in physicalTable;
        if (isGroup) {
            // Pick first table in group for the database record
            const { data: tables } = await supabase
                .from('tables')
                .select('id')
                .eq('merged_group_id', physicalTable.id)
                .order('id', { ascending: true })
                .limit(1);

            if (tables && tables.length > 0) {
                actualTableId = tables[0].id;
            } else {
                console.error('No physical tables found in merge group.');
                return;
            }
        } else {
            actualTableId = physicalTable.id;
        }

        // Determine/Assign waiter
        let assignedWaiterId = physicalTable?.assigned_waiter_id || null;
        if (!assignedWaiterId) {
            const leastBusyWaiter = await this.getLeastBusyWaiter(actualRestaurantId);
            if (leastBusyWaiter) {
                assignedWaiterId = leastBusyWaiter.id;
                // Save it immediately to the table/group in database
                if (isGroup) {
                    await supabase
                        .from('table_merge_groups')
                        .update({ 
                            assigned_waiter_id: assignedWaiterId,
                            last_activity_at: new Date().toISOString()
                        })
                        .eq('id', physicalTable.id);

                    // Also update constituent tables
                    const { data: memberTables } = await supabase
                        .from('tables')
                        .select('id')
                        .eq('merged_group_id', physicalTable.id);
                    if (memberTables && memberTables.length > 0) {
                        const memberIds = memberTables.map(t => t.id);
                        await supabase
                            .from('tables')
                            .update({ 
                                assigned_waiter_id: assignedWaiterId,
                                last_activity_at: new Date().toISOString()
                            })
                            .in('id', memberIds);
                    }
                } else {
                    await supabase
                        .from('tables')
                        .update({ 
                            assigned_waiter_id: assignedWaiterId,
                            last_activity_at: new Date().toISOString()
                        })
                        .eq('id', actualTableId);
                }
                // Update the waiter's last assigned timestamp
                await supabase
                    .from('staff')
                    .update({ last_assigned_at: new Date().toISOString() })
                    .eq('id', assignedWaiterId);
            }
        }

        if (!assignedWaiterId) {
            console.error('No waiter available to assign to this table.');
            return;
        }

        // Track customer presence (which will now preserve or enforce the assignedWaiterId)
        const customStatus = type === 'bill_requested' ? 'billing' : undefined;
        await this.trackCustomerPresence(tableId, actualRestaurantId, customStatus, assignedWaiterId);

        // Check if a pending request of this type already exists for this table to prevent constraint violations
        const { data: existingRequest } = await supabase
            .from('service_requests')
            .select('id, quantity')
            .eq('table_id', actualTableId)
            .eq('request_type', type)
            .eq('request_status', 'pending')
            .maybeSingle();

        if (existingRequest) {
            const { error } = await supabase
                .from('service_requests')
                .update({ quantity: (existingRequest.quantity || 0) + quantity })
                .eq('id', existingRequest.id);

            if (error) {
                console.error('Failed to update service request quantity:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw error;
            }
        } else {
            const { error } = await supabase
                .from('service_requests')
                .insert({
                    table_id: actualTableId,
                    request_type: type,
                    request_status: 'pending',
                    quantity: quantity,
                    restaurant_id: actualRestaurantId,
                    assigned_waiter_id: assignedWaiterId
                });

            if (error) {
                // In case of a race condition where it was created in the interim, update the quantity
                if (error.code === '23505') {
                    const { data: retryReq } = await supabase
                        .from('service_requests')
                        .select('id, quantity')
                        .eq('table_id', actualTableId)
                        .eq('request_type', type)
                        .eq('request_status', 'pending')
                        .maybeSingle();
                    if (retryReq) {
                        await supabase
                            .from('service_requests')
                            .update({ quantity: (retryReq.quantity || 0) + quantity })
                            .eq('id', retryReq.id);
                        
                        await supabase
                            .from('tables')
                            .update({ alert_status: type })
                            .eq('id', actualTableId);
                        return;
                    }
                }

                console.error('Failed to submit service request:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw error;
            }
        }

        await supabase
            .from('tables')
            .update({ alert_status: type })
            .eq('id', actualTableId);
    },

    /**
     * Bulk transfer all workload from one waiter to another.
     * Includes tables, merge groups, active orders, and pending service requests.
     */
    async transferEntireWorkload(fromWaiterId: string, toWaiterId: string, restaurantId: string) {
        const actualId = await this.resolveRestaurantId(restaurantId);

        // 1. Update Tables
        const { error: tableError } = await supabase
            .from('tables')
            .update({ assigned_waiter_id: toWaiterId })
            .eq('restaurant_id', actualId)
            .eq('assigned_waiter_id', fromWaiterId);

        if (tableError) console.error('Bulk Transfer Error (Tables):', tableError);

        // 2. Update Merge Groups
        const { error: groupError } = await supabase
            .from('table_merge_groups')
            .update({ assigned_waiter_id: toWaiterId })
            .eq('restaurant_id', actualId)
            .eq('assigned_waiter_id', fromWaiterId);

        if (groupError) console.error('Bulk Transfer Error (Groups):', groupError);

        // 3. Update Active Orders
        const { error: orderError } = await supabase
            .from('orders')
            .update({ waiter_id: toWaiterId })
            .eq('restaurant_id', actualId)
            .eq('waiter_id', fromWaiterId)
            .neq('status', 'paid')
            .neq('status', 'cancelled');

        if (orderError) console.error('Bulk Transfer Error (Orders):', orderError);

        // 4. Update Pending and Accepted Service Requests
        const { error: serviceError } = await supabase
            .from('service_requests')
            .update({ 
                assigned_waiter_id: toWaiterId,
                request_status: 'pending',
                accepted_by: null,
                accepted_at: null
            })
            .eq('restaurant_id', actualId)
            .eq('assigned_waiter_id', fromWaiterId)
            .in('request_status', ['pending', 'accepted']);

        if (serviceError) console.error('Bulk Transfer Error (Services):', serviceError);

        // 5. Update Staff Table Metrics (Optional if triggered by DB triggers)
        // We'll let the workload sync job or triggers handle the workload score updates.
        
        return { success: !tableError && !groupError && !orderError && !serviceError };
    },

    /**
     * Fetch active service requests (Pending + Recently Resolved).
     * Includes resolved requests from the last 1 hour to keep them visible.
     */
    async fetchActiveServiceRequests(restaurantId: string, waiterId?: string) {
        const actualId = await this.resolveRestaurantId(restaurantId);
        if (!actualId) return [];

        let query = supabase
            .from('service_requests')
            .select(`
                *,
                tables (
                    table_number,
                    assigned_waiter_id,
                    co_waiter_ids
                )
            `)
            .eq('restaurant_id', actualId)
            .in('request_status', ['pending', 'accepted'])
            .order('created_at', { ascending: true });

        let data: any = null;
        let error: any = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            const res = await query;
            data = res.data;
            error = res.error;
            if (!error) break;
            if (isTransientNetworkError(error) && attempt < 2) {
                await new Promise(r => setTimeout(r, 600));
                continue;
            }
            break;
        }

        if (error) {
            if (isTransientNetworkError(error)) {
                console.warn('[fetchActiveServiceRequests] Transient network error encountered:', formatError(error));
                return [];
            }
            console.error('Failed to fetch service requests:', formatError(error));
            throw new Error(`Failed to fetch service requests: ${formatError(error)}`);
        }

        if (!data) return [];

        if (!waiterId) {
            // Unassigned waiter context receives zero active requests
            return [];
        }

        const waiterIdLower = String(waiterId).toLowerCase();
        let staffMember: any = null;
        try {
            const res = await supabase
                .from('staff')
                .select('role')
                .eq('id', waiterId)
                .maybeSingle();
            staffMember = res?.data;
        } catch (_) {}

        const isAdmin = staffMember?.role && ['admin', 'supervisor', 'restaurant_admin'].includes(staffMember.role);
        if (isAdmin) return data;

        return data.filter((req: any) => {
            const assigned = req.assigned_waiter_id ? String(req.assigned_waiter_id).toLowerCase() : null;
            const tableAssigned = req.tables?.assigned_waiter_id ? String(req.tables.assigned_waiter_id).toLowerCase() : null;
            const coWaiters: string[] = Array.isArray(req.tables?.co_waiter_ids)
                ? req.tables.co_waiter_ids.map((c: any) => String(c).toLowerCase())
                : [];

            // 1. Table access requests are strictly for the primary assigned owner
            if (req.request_type === 'table_access_request') {
                return (tableAssigned === waiterIdLower) || (assigned === waiterIdLower);
            }

            // 2. If table is assigned to someone else, this waiter must not receive it (unless an approved co-waiter)
            if (tableAssigned && tableAssigned !== waiterIdLower && !coWaiters.includes(waiterIdLower)) {
                return false;
            }

            // 3. Customer service requests: must be assigned to this waiter or approved co-waiter
            if (assigned === waiterIdLower || tableAssigned === waiterIdLower) return true;
            if (coWaiters.includes(waiterIdLower)) return true;

            // 4. Unassigned tables/requests receive ZERO notifications/popups
            return false;
        });
    },

    /**
     * Fetch active service requests for a specific table.
     */
    async fetchServiceRequestsForTable(tableId: number | string, restaurantId: string, waiterId?: string) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        // Resolve the table identifier to the actual DB id
        const physicalTable = await this.findTableAnywhere(tableId, actualRestaurantId);

        if (!physicalTable) {
            console.warn(`[fetchServiceRequestsForTable] Could not resolve table: ${tableId}`);
            return [];
        }

        // If it's a merged table group, fetch for all physical tables in the group
        if (physicalTable.merged_group_id || (physicalTable.id && typeof physicalTable.display_name === 'string')) {
            // It's a merge group row itself
            const groupId = physicalTable.merged_group_id || physicalTable.id;
            const { data: tables } = await supabase
                .from('tables')
                .select('id')
                .eq('merged_group_id', groupId)
                .eq('restaurant_id', actualRestaurantId);

            if (!tables || tables.length === 0) return [];

            const tableIds = tables.map(t => t.id);
            let query = supabase
                .from('service_requests')
                .select('*, tables(table_number)')
                .in('table_id', tableIds)
                .eq('restaurant_id', actualRestaurantId)
                .in('request_status', ['pending', 'accepted'])
                .order('created_at', { ascending: false });

            if (waiterId) {
                query = query.eq('assigned_waiter_id', waiterId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        }

        // Plain physical table — use its actual DB id
        let query = supabase
            .from('service_requests')
            .select('*, tables(table_number)')
            .eq('table_id', physicalTable.id)
            .eq('restaurant_id', actualRestaurantId)
            .in('request_status', ['pending', 'accepted'])
            .order('created_at', { ascending: false });

        if (waiterId) {
            query = query.eq('assigned_waiter_id', waiterId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Failed to fetch table service requests:', error);
            throw error;
        }
        return data;
    },

    /**
     * Resolve a service request (Mark as Served).
     * Updates status to 'resolved'.
     */
    async resolveServiceRequest(requestId: number) {
        // 1. Get request details first to know table_id and type (needed for smart alert update)
        const { data: request } = await supabase
            .from('service_requests')
            .select('table_id, request_type')
            .eq('id', requestId)
            .single();

        if (!request) return;

        // 2. Update Request Status to 'completed'
        const { error } = await supabase
            .from('service_requests')
            .update({
                request_status: 'completed',
                completed_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (error) {
            console.error('Failed to resolve service request:', error);
            throw error;
        }

        // 3. Check for specific interactions (Bill/Water)
        if (request.request_type === 'bill_requested' || request.request_type === 'water_requested') {
            // We might want to keep the table alert status OR clear it if no other similar requests exist.
            // For now, let's keep the logic simple: specific requests are treated as resolved.
            // The "Call Waiter" logic below handles the generic alert status.
        }

        // 3. Smart Update Table Alert Status
        // If the resolved request was the one showing on the table, we should check if there are others.
        // Fetch current table alert status
        const { data: table } = await supabase
            .from('tables')
            .select('alert_status')
            .eq('id', request.table_id)
            .single();

        if (table && table.alert_status === request.request_type) {
            // The resolved request matches the current visual alert.
            // Check for other pending requests for this table
            const { data: nextRequest } = await supabase
                .from('service_requests')
                .select('request_type')
                .eq('table_id', request.table_id)
                .eq('request_status', 'pending')
                .order('created_at', { ascending: false }) // Get latest
                .limit(1)
                .maybeSingle();

            const nextStatus = nextRequest ? nextRequest.request_type : null;

            // Update table status
            await supabase
                .from('tables')
                .update({ alert_status: nextStatus })
                .eq('id', request.table_id);
        }
    },

    async resolveMultipleServiceRequests(requestIds: number[], staffId?: string) {
        if (!requestIds.length) return;

        // 1. Fetch tables associated with these requests BEFORE deleting to know what to update
        const { data: requests } = await supabase
            .from('service_requests')
            .select('table_id')
            .in('id', requestIds);

        // Authorization check: Verify waiter table assignment if staffId is provided
        if (staffId && requests && requests.length > 0) {
            for (const r of requests) {
                if (r.table_id) {
                    const hasAccess = await this.verifyWaiterTableAccess(r.table_id, staffId);
                    if (!hasAccess.authorized) {
                        throw new Error(`Unauthorized: Waiter does not have access to Table ${r.table_id}.`);
                    }
                }
            }
        }

        // 2. Update status to completed
        const { error } = await supabase
            .from('service_requests')
            .update({
                request_status: 'completed',
                completed_at: new Date().toISOString()
            })
            .in('id', requestIds);

        if (error) {
            console.error('Failed to resolve multiple requests:', error);
            throw error;
        }

        // 3. Update Alert Status for each affected table
        if (requests && requests.length > 0) {
            const tableIds = [...new Set(requests.map(r => r.table_id))];

            for (const tableId of tableIds) {
                // Find the *next* active request for this table (latest one priority)
                const { data: nextRequest } = await supabase
                    .from('service_requests')
                    .select('request_type')
                    .eq('table_id', tableId)
                    .eq('request_status', 'pending')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();

                const nextStatus = nextRequest ? nextRequest.request_type : null;

                // Update the table's alert status
                // We always update to ensure consistency between service_requests and tables
                await supabase
                    .from('tables')
                    .update({ alert_status: nextStatus })
                    .eq('id', tableId);
            }
        }
    },

    /**
     * Subscribe to real-time changes on service_requests.
     */
    subscribeToServiceRequests(
        restaurantId: string, 
        onChange: (payload: RealtimePostgresChangesPayload<any>) => void, 
        waiterId?: string,
        tableId?: number | string
    ) {
        let isCancelled = false;
        let subHandle: { unsubscribe: () => void } | null = null;

        const init = (resolvedId: string) => {
            if (isCancelled) return;
            const channelKey = `service-requests:${resolvedId}:${waiterId || 'all'}:${tableId || 'all'}`;
            let filter: string | undefined;

            if (tableId) {
                filter = `table_id=eq.${tableId}`;
            } else if (waiterId) {
                filter = `assigned_waiter_id=eq.${waiterId}`;
            } else if (resolvedId) {
                filter = `restaurant_id=eq.${resolvedId}`;
            }

            subHandle = realtimeManager.subscribe(
                channelKey,
                () => {
                    const channel = supabase
                        .channel(`service-requests-chan-${resolvedId}-${waiterId || 'all'}-${tableId || 'all'}`)
                        .on(
                            'postgres_changes',
                            { 
                                event: '*', 
                                schema: 'public', 
                                table: 'service_requests',
                                ...(filter ? { filter } : {})
                            },
                            (payload) => {
                                realtimeManager.dispatch(channelKey, payload);
                            }
                        );
                    channel.subscribe();
                    return channel;
                },
                (payload) => {
                    const rec = (payload.new || payload.old) as any;
                    if (!rec) return;

                    // Strict multi-criteria tenant isolation
                    if (rec.restaurant_id != null) {
                        if (String(rec.restaurant_id) !== String(resolvedId)) return;
                    } else if (payload.eventType === 'DELETE') {
                        const isKnown = OrderService.isServiceRequestKnownForTenant(rec.id, resolvedId);
                        if (!isKnown) return;
                    } else {
                        return;
                    }

                    if (tableId != null && rec.table_id != null && String(rec.table_id) !== String(tableId)) {
                        return;
                    }
                    if (waiterId) {
                        const waiterIdLower = String(waiterId).toLowerCase();
                        const assignedLower = rec.assigned_waiter_id ? String(rec.assigned_waiter_id).toLowerCase() : null;
                        // Strict waiter routing: if unassigned or assigned to someone else, do not deliver
                        if (!assignedLower || assignedLower !== waiterIdLower) {
                            return;
                        }
                    }
                    onChange(payload);
                }
            );
        };

        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId);
        const isNumeric = /^\d+$/.test(restaurantId);
        const isStandardTenant = /^REST-|^PEND-/i.test(restaurantId);

        if (isUUID || isNumeric || isStandardTenant) {
            init(restaurantId);
        } else {
            this.resolveRestaurantId(restaurantId).then(resolvedId => {
                if (!isCancelled) {
                    init(resolvedId || restaurantId);
                }
            });
        }

        return {
            unsubscribe: () => {
                isCancelled = true;
                if (subHandle) subHandle.unsubscribe();
            }
        };
    },

    /**
     * Fetch the staff record for a specific user ID.
     */
    async getWaiterRecord(restaurantId: string, userId: string) {
        const actualRestaurantId = await this.resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('staff')
            .select('*')
            .eq('restaurant_id', actualRestaurantId)
            .eq('user_id', userId)
            .maybeSingle();
        
        if (error) throw error;
        return data;
    },

    /**
     * Update a waiter's availability status.
     */
    async updateWaiterStatus(staffId: string, status: 'available' | 'busy' | 'break') {
        const { error } = await supabase
            .from('staff')
            .update({ availability_status: status })
            .eq('id', staffId);
        
        if (error) throw error;
    },

    /**
     * Manually reassign an order to a different waiter.
     */
    async reassignWaiter(orderId: string, restaurantId: string, newWaiterId: string) {
        const actualRestaurantId = await this.resolveRestaurantId(restaurantId);

        // Enforce active status: only active waiters can receive order assignments
        const { data: waiterCheck, error: checkError } = await supabase
            .from('employees')
            .select('id, name, status, is_online, availability_status')
            .eq('id', newWaiterId)
            .eq('restaurant_id', actualRestaurantId)
            .maybeSingle();

        if (checkError) throw checkError;
        if (!waiterCheck) throw new Error('Selected waiter not found');

        const isActive = waiterCheck.status?.toLowerCase() === 'active' &&
            waiterCheck.is_online === true &&
            !['offline', 'break'].includes((waiterCheck.availability_status || '').toLowerCase());

        if (!isActive) {
            throw new Error(`Cannot reassign order to ${waiterCheck.name}: Waiter is currently inactive or offline. Only active waiters can receive assignments.`);
        }

        const { error } = await supabase
            .from('orders')
            .update({ waiter_id: newWaiterId })
            .eq('id', orderId)
            .eq('restaurant_id', actualRestaurantId);
        
        if (error) throw error;
    },

    /**
     * Assign or reassign a delivery boy to a delivery order.
     */
    async assignDeliveryBoy(orderId: string, restaurantId: string, deliveryBoyId: string) {
        const query = new URLSearchParams({ restaurantId }).toString();
        const res = await fetch(`/api/delivery/assign?${query}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-restaurant-id': restaurantId,
            },
            body: JSON.stringify({
                orderId,
                deliveryBoyId,
                restaurantId,
            }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to assign delivery boy');
        }
        return data;
    },

    /**
     * Fetch all staff for a restaurant.
     */
    async fetchStaff(restaurantId: string) {
        return coalesceRequest(`staff:${restaurantId}`, async () => {
            const actualRestaurantId = await this.resolveRestaurantId(restaurantId);
            const { data, error } = await supabase
                .from('staff')
                .select('*')
                .eq('restaurant_id', actualRestaurantId);
            
            if (error) throw error;
            return data || [];
        });
    },

    /**
     * Fetch staff members with their current workload status.
     */
    async fetchStaffWithWorkload(restaurantId: string) {
        const actualId = await this.resolveRestaurantId(restaurantId);
        const { data, error } = await supabase
            .from('staff')
            .select(`
                id,
                name,
                role,
                availability_status,
                active_workload,
                mobile
            `)
            .eq('restaurant_id', actualId)
            .eq('role', 'waiter')
            .order('active_workload', { ascending: true });

        if (error) throw error;
        return data;
    },

    /**
     * Assign a waiter to a table.
     */
    async assignWaiterToTable(tableId: number, waiterId: string | null, restaurantId: string) {
        const { error } = await supabase
            .from('tables')
            .update({ assigned_waiter_id: waiterId })
            .eq('id', tableId)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;

        // Also update any active orders for this table if they are unassigned
        if (waiterId) {
            await supabase
                .from('orders')
                .update({ waiter_id: waiterId })
                .eq('table_id', tableId)
                .eq('restaurant_id', restaurantId)
                .eq('is_completed', false)
                .is('waiter_id', null);

            // Log the assignment
            await supabase
                .from('waiter_assignments')
                .insert({
                    table_id: tableId,
                    waiter_id: waiterId,
                    assigned_by: null,
                    restaurant_id: restaurantId
                });
        }
    },

    /**
     * Assign a waiter to a merge group.
     */
    async assignWaiterToMergeGroup(mergeGroupId: string, waiterId: string | null, restaurantId: string) {
        const { error } = await supabase
            .from('table_merge_groups')
            .update({ assigned_waiter_id: waiterId })
            .eq('id', mergeGroupId)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;

        // Also update all tables in this group
        await supabase
            .from('tables')
            .update({ assigned_waiter_id: waiterId })
            .eq('merged_group_id', mergeGroupId)
            .eq('restaurant_id', restaurantId);

        // Also update any active orders for this group if they are unassigned
        if (waiterId) {
            await supabase
                .from('orders')
                .update({ waiter_id: waiterId })
                .eq('merge_group_id', mergeGroupId)
                .eq('restaurant_id', restaurantId)
                .eq('is_completed', false)
                .is('waiter_id', null);

            // Log the assignment
            await supabase
                .from('waiter_assignments')
                .insert({
                    merge_group_id: mergeGroupId,
                    waiter_id: waiterId,
                    assigned_by: null,
                    restaurant_id: restaurantId
                });
        }
    },

    /**
     * Transfer a specific service request to another waiter.
     */
    async transferServiceRequest(requestId: string | number, newWaiterId: string, restaurantId: string) {
        // Fetch current waiter to log who it was transferred from
        const { data: currentReq } = await supabase
            .from('service_requests')
            .select('assigned_waiter_id')
            .eq('id', requestId)
            .single();

        const { error } = await supabase
            .from('service_requests')
            .update({ 
                assigned_waiter_id: newWaiterId,
                request_status: 'pending',
                accepted_by: null,
                accepted_at: null
            })
            .eq('id', requestId)
            .eq('restaurant_id', restaurantId);

        if (error) throw error;

        // Insert into history
        await supabase
            .from('service_assignments')
            .insert({
                service_request_id: requestId,
                from_waiter_id: currentReq?.assigned_waiter_id,
                to_waiter_id: newWaiterId,
                restaurant_id: restaurantId,
                status: 'transferred'
            });
    },

    /**
     * Cancel a service request by customer.
     */
    async cancelServiceRequest(requestId: number, restaurantId: string) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;
        const { data, error } = await supabase
            .from('service_requests')
            .update({
                request_status: 'cancelled',
                completed_at: new Date().toISOString()
            })
            .eq('id', requestId)
            .eq('restaurant_id', actualRestaurantId)
            .eq('request_status', 'pending')
            .select();

        if (error) {
            console.error('Error cancelling service request:', error);
            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error('Request already accepted or served');
        }
    },

    /**
     * Delete/Remove a service request completely.
     */
    async deleteServiceRequest(requestId: number, restaurantId: string) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;
        const { error } = await supabase
            .from('service_requests')
            .delete()
            .eq('id', requestId)
            .eq('restaurant_id', actualRestaurantId);

        if (error) {
            console.error('Error deleting service request:', error);
            throw error;
        }
    },

    /**
     * Transfer all active work (tables, orders, services) from one waiter to another.
     */
    async transferFullWorkload(fromWaiterId: string, toWaiterId: string, restaurantId: string) {
        // 1. Update tables
        await supabase
            .from('tables')
            .update({ assigned_waiter_id: toWaiterId })
            .eq('assigned_waiter_id', fromWaiterId)
            .eq('restaurant_id', restaurantId);

        // 2. Update merge groups
        await supabase
            .from('table_merge_groups')
            .update({ assigned_waiter_id: toWaiterId })
            .eq('assigned_waiter_id', fromWaiterId)
            .eq('restaurant_id', restaurantId);

        // 3. Update active orders
        await supabase
            .from('orders')
            .update({ waiter_id: toWaiterId })
            .eq('waiter_id', fromWaiterId)
            .eq('restaurant_id', restaurantId)
            .eq('is_completed', false);

        // 4. Update pending service requests
        await supabase
            .from('service_requests')
            .update({ assigned_waiter_id: toWaiterId })
            .eq('assigned_waiter_id', fromWaiterId)
            .eq('restaurant_id', restaurantId)
            .eq('request_status', 'pending');
    },

    /**
     * Request access to manage a table (by a waiter requesting handover/share from assigned waiter)
     */
    async requestTableAccess(tableId: number | string, requesterId: string, requesterName: string, restaurantId: string) {
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;

        // Enforce active status: only active waiters can request table access
        const { data: requesterCheck } = await supabase
            .from('employees')
            .select('id, name, status, is_online, availability_status')
            .eq('id', requesterId)
            .maybeSingle();

        const isActive = requesterCheck &&
            requesterCheck.status?.toLowerCase() === 'active' &&
            requesterCheck.is_online === true &&
            !['offline', 'break'].includes((requesterCheck.availability_status || '').toLowerCase());

        if (!isActive) {
            throw new Error('You must have an Active account status to request table access. Please activate your account first.');
        }

        const physicalTable = await this.findTableAnywhere(tableId, actualRestaurantId);
        const actualTableId = physicalTable ? physicalTable.id : (typeof tableId === 'number' ? tableId : parseInt(String(tableId), 10));

        const { data, error } = await supabase.rpc('request_table_access', {
            p_table_id: actualTableId,
            p_requester_id: requesterId,
            p_requester_name: requesterName,
            p_restaurant_id: actualRestaurantId
        });
        if (error) throw error;
        return data;
    },

    /**
     * Grant table access or transfer table ownership (by assigned waiter or admin)
     */
    async grantTableAccess(
        tableId: number | string,
        targetWaiterId: string,
        grantType: 'share' | 'transfer' = 'share',
        ownerId: string,
        restaurantId?: string
    ) {
        let numericId: number;
        if (typeof tableId === 'number') {
            numericId = tableId;
        } else {
            const actualRestaurantId = restaurantId ? ((await this.resolveRestaurantId(restaurantId)) || restaurantId) : undefined;
            const physicalTable = actualRestaurantId ? await this.findTableAnywhere(tableId, actualRestaurantId) : null;
            numericId = physicalTable ? Number(physicalTable.id) : parseInt(String(tableId), 10);
        }

        const { data, error } = await supabase.rpc('grant_table_access', {
            p_table_id: numericId,
            p_owner_id: ownerId,
            p_target_waiter_id: targetWaiterId,
            p_grant_type: grantType,
        });

        if (error) {
            console.error('[grantTableAccess] RPC error:', error);
            throw error;
        }

        return data || { success: true };
    },

    /**
     * Approve a table access handover request (by assigned waiter or admin)
     */
    async approveTableAccess(requestId: number, approverId: string, transferType: string = 'share') {
        const { data, error } = await supabase.rpc('approve_table_access', {
            p_request_id: requestId,
            p_approver_id: approverId,
            p_transfer_type: transferType
        });
        if (error) throw error;
        return data;
    },

    /**
     * Decline a table access handover request
     */
    async declineTableAccess(requestId: number, declinerId: string) {
        const { data, error } = await supabase.rpc('decline_table_access', {
            p_request_id: requestId,
            p_decliner_id: declinerId
        });
        if (error) throw error;
        return data;
    },

    /**
     * Check if all online active waiters are overloaded for a restaurant.
     */
    async checkWaitersOverloadStatus(restaurantId: string): Promise<{
        is_overloaded: boolean;
        active_count?: number;
        inactive_count?: number;
        online_waiters_count?: number;
        offline_waiters_count?: number;
        min_active_tables?: number;
    }> {
        if (!restaurantId || !String(restaurantId).trim()) {
            return { is_overloaded: false, online_waiters_count: 0, offline_waiters_count: 0 };
        }
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;
        if (!actualRestaurantId || !String(actualRestaurantId).trim()) {
            return { is_overloaded: false, online_waiters_count: 0, offline_waiters_count: 0 };
        }
        try {
            const { data, error } = await supabase.rpc('check_waiters_overload_status', {
                p_restaurant_id: actualRestaurantId
            });
            if (!error && data) {
                const res = Array.isArray(data) ? data[0] : data;
                if (res && typeof res === 'object') {
                    return {
                        is_overloaded: Boolean(res.is_overloaded),
                        active_count: res.active_waiters_count ?? res.active_count ?? 0,
                        inactive_count: res.inactive_waiters_count ?? res.inactive_count ?? 0,
                        online_waiters_count: res.online_waiters_count ?? res.active_waiters_count ?? 0,
                        offline_waiters_count: res.offline_waiters_count ?? res.inactive_waiters_count ?? 0,
                        min_active_tables: res.min_active_tables ?? 0
                    };
                }
            }
            if (error) {
                const errDetail = error.message || error.details || error.code || '';
                if (errDetail) {
                    console.warn('[checkWaitersOverloadStatus] RPC unavailable, falling back:', errDetail);
                }
            }
        } catch (err: any) {
            console.warn('[checkWaitersOverloadStatus] RPC call threw, falling back:', err?.message || err);
        }

        // Direct database fallback if RPC is unavailable
        try {
            const { data: staffData, error: staffError } = await supabase
                .from('employees')
                .select('id, status, is_deleted, is_online, availability_status, role')
                .eq('restaurant_id', actualRestaurantId)
                .ilike('role', 'waiter')
                .eq('status', 'active')
                .eq('is_deleted', false);

            if (staffError || !staffData) {
                return { is_overloaded: false, online_waiters_count: 0, offline_waiters_count: 0 };
            }

            const onlineWaiters = staffData.filter(s => {
                const status = (s.availability_status || '').toLowerCase();
                return (s.is_online === true || ['available', 'busy', 'online'].includes(status)) &&
                       !['offline', 'break'].includes(status);
            });
            const offlineWaiters = staffData.filter(s => {
                const status = (s.availability_status || '').toLowerCase();
                return s.is_online === false || ['offline', 'break'].includes(status);
            });

            const isOverloaded = onlineWaiters.length === 0 && offlineWaiters.length > 0;
            return {
                is_overloaded: isOverloaded,
                active_count: onlineWaiters.length,
                inactive_count: offlineWaiters.length,
                online_waiters_count: onlineWaiters.length,
                offline_waiters_count: offlineWaiters.length,
                min_active_tables: 0
            };
        } catch (fallbackErr) {
            return { is_overloaded: false, online_waiters_count: 0, offline_waiters_count: 0 };
        }
    },

    /**
     * Broadcast an overload notification across the restaurant channel to offline waiters.
     */
    async broadcastWaitersOverloaded(restaurantId: string) {
        if (!restaurantId || !String(restaurantId).trim()) return;
        const actualRestaurantId = (await this.resolveRestaurantId(restaurantId)) || restaurantId;
        if (!actualRestaurantId) return;
        const channel = supabase.channel(`waiters-overload-${actualRestaurantId}`);
        await channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.send({
                    type: 'broadcast',
                    event: 'waiters_overloaded',
                    payload: {
                        restaurant_id: actualRestaurantId,
                        timestamp: Date.now(),
                        message: 'All active online waiters are currently overloaded. Please go online if you are available to assist.'
                    }
                });
                setTimeout(() => {
                    supabase.removeChannel(channel);
                }, 1500);
            }
        });
    },

    /**
     * Subscribe to waiter overload broadcasts for inactive waiters.
     */
    subscribeToWaitersOverloaded(restaurantId: string, onOverload: (payload: any) => void) {
        if (!restaurantId || !String(restaurantId).trim()) {
            return { unsubscribe: () => {} };
        }
        let isCancelled = false;
        let channel: any = null;

        this.resolveRestaurantId(restaurantId).then(resolvedId => {
            if (isCancelled) return;
            const targetId = resolvedId || restaurantId;
            const channelName = `waiters-overload-${targetId}`;
            channel = supabase.channel(channelName);
            channel
                .on('broadcast', { event: 'waiters_overloaded' }, (event: any) => {
                    if (event?.payload) {
                        const pRid = event.payload.restaurant_id;
                        if (pRid != null && String(pRid) !== String(targetId)) return;
                        onOverload(event.payload);
                    }
                })
                .subscribe();
        });

        return {
            unsubscribe: () => {
                isCancelled = true;
                if (channel) {
                    supabase.removeChannel(channel);
                }
            }
        };
    }
};
