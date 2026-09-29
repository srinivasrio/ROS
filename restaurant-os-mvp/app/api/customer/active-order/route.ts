import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveRestaurantId } from '@/services/utils.service';
import { CustomerService } from '@/services/customers.service';
import { signJwt, getCustomerTokenName } from '@/lib/jwt-utils';

/**
 * POST /api/customer/active-order
 * 
 * Securely checks for active orders associated with a customer's mobile number
 * strictly scoped to the specified restaurant (multi-tenant boundary).
 * 
 * Order types:
 *   - DINE_IN: table-based order
 *   - TAKEAWAY: counter pickup order
 *   - DELIVERY: home delivery order
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const { restaurantCode, mobile } = body;

        if (!restaurantCode || typeof restaurantCode !== 'string') {
            return NextResponse.json({ error: 'Restaurant code is required' }, { status: 400 });
        }

        if (!mobile || typeof mobile !== 'string') {
            return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
        }

        // 1. Resolve restaurant ID strictly for multi-tenant isolation
        const actualRestaurantId = await resolveRestaurantId(restaurantCode);
        if (!actualRestaurantId) {
            return NextResponse.json({ error: 'Invalid or unknown restaurant' }, { status: 404 });
        }

        // Verify restaurant actually exists
        const { data: restExists } = await supabaseAdmin
            .from('restaurants')
            .select('id')
            .eq('id', actualRestaurantId)
            .maybeSingle();

        if (!restExists) {
            return NextResponse.json({ error: 'Invalid or unknown restaurant' }, { status: 404 });
        }

        // 2. Normalize and validate mobile number (must be 10 digits)
        const rawPhone = mobile.trim();
        const digitsOnly = rawPhone.replace(/\D/g, '');

        if (digitsOnly.length < 10) {
            return NextResponse.json({ error: 'Please enter a valid 10-digit mobile number' }, { status: 400 });
        }

        const clean10 = digitsOnly.slice(-10);

        // Build list of potential phone format candidates
        const candidatePhones = [
            clean10,
            `+91${clean10}`,
            `91${clean10}`,
            `0${clean10}`,
        ];

        // 3. Find existing customer record(s) in customers table for this restaurant
        const orCustomerPhoneConditions = candidatePhones.map(p => `mobile.eq.${p}`).join(',');
        const { data: existingCustomers } = await supabaseAdmin
            .from('customers')
            .select('id, name, mobile, email')
            .eq('restaurant_id', actualRestaurantId)
            .or(`${orCustomerPhoneConditions},mobile.ilike.%${clean10}%`)
            .order('created_at', { ascending: false })
            .limit(5);

        let customerRecord: any = existingCustomers?.[0] || null;

        // If no customer record exists yet, upsert one so customer identity is established
        if (!customerRecord) {
            try {
                const upsertRes = await CustomerService.upsertCustomer(actualRestaurantId, {
                    mobile: clean10,
                });
                if (upsertRes?.customer) {
                    customerRecord = upsertRes.customer;
                }
            } catch (upsertErr) {
                console.warn('[ActiveOrder] Customer auto-register notice:', upsertErr);
            }
        }

        const customerIds = (existingCustomers || []).map(c => c.id).filter(Boolean);
        if (customerRecord?.id && !customerIds.includes(customerRecord.id)) {
            customerIds.push(customerRecord.id);
        }

        // 4. Query orders table for active orders strictly scoped to this restaurant
        const orderMatchConditions: string[] = [
            `customer_phone.ilike.%${clean10}%`,
            `delivery_phone.ilike.%${clean10}%`,
        ];
        candidatePhones.forEach(p => {
            orderMatchConditions.push(`customer_phone.eq.${p}`);
            orderMatchConditions.push(`delivery_phone.eq.${p}`);
        });

        customerIds.forEach(cid => {
            orderMatchConditions.push(`customer_id.eq.${cid}`);
        });

        // Consider active orders from within the last 24 hours to prevent stale ghost sessions
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: rawOrders, error: ordersError } = await supabaseAdmin
            .from('orders')
            .select(`
                id,
                order_number,
                table_id,
                status,
                is_completed,
                order_type,
                total_amount,
                customer_phone,
                delivery_phone,
                delivery_address,
                created_at,
                tables:table_id (
                    id,
                    table_number
                )
            `)
            .eq('restaurant_id', actualRestaurantId)
            .eq('is_completed', false)
            .gte('created_at', twentyFourHoursAgo)
            .or(orderMatchConditions.join(','))
            .order('created_at', { ascending: false });

        if (ordersError) {
            console.error('[ActiveOrder API Error]', ordersError);
            return NextResponse.json({ error: 'Failed to check active orders' }, { status: 500 });
        }

        const ordersList = rawOrders || [];

        // 5. If delivery orders exist, inspect delivery assignments to verify active status
        const deliveryOrderIds = ordersList
            .filter(o => o.order_type === 'DELIVERY')
            .map(o => o.id);

        let deliveryAssignmentsMap: Record<string, any> = {};
        if (deliveryOrderIds.length > 0) {
            const { data: assignments } = await supabaseAdmin
                .from('delivery_assignments')
                .select('id, order_id, status')
                .in('order_id', deliveryOrderIds)
                .order('created_at', { ascending: false });

            (assignments || []).forEach(a => {
                // Keep the latest assignment for each order
                if (!deliveryAssignmentsMap[a.order_id]) {
                    deliveryAssignmentsMap[a.order_id] = a;
                }
            });
        }

        // 6. Filter and enrich active orders
        const activeOrders = ordersList.filter(order => {
            const statusLower = (order.status || '').toLowerCase().trim();

            // Completed or paid orders are non-active
            if (order.is_completed) return false;
            if (['cancelled', 'completed', 'paid'].includes(statusLower)) return false;

            // For delivery orders: if status is delivered or assignment is DELIVERED, it is completed
            if (order.order_type === 'DELIVERY') {
                if (['delivered', 'picked_up'].includes(statusLower)) return false;
                const da = deliveryAssignmentsMap[order.id];
                if (da?.status === 'DELIVERED') return false;
            }

            // For takeaway orders: if served/picked_up, it is picked up
            if (order.order_type === 'TAKEAWAY') {
                if (['served', 'picked_up'].includes(statusLower)) return false;
            }

            // For dine-in: statuses placed, preparing, ready, served, bill_requested are active
            return true;
        }).map(order => {
            const tableObj = Array.isArray(order.tables) ? order.tables[0] : order.tables;
            const rawTable = (tableObj as any)?.table_number || (order.table_id ? String(order.table_id) : null);
            const tableNumber = rawTable ? rawTable.replace(/^table\s*[-_]?\s*/i, '').trim() : null;
            const normalizedOrderType = (order.order_type || 'DINE_IN').toUpperCase() as 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

            // Construct exact redirect URL based on order type
            let redirectUrl = '';
            if (normalizedOrderType === 'DELIVERY') {
                redirectUrl = `/${restaurantCode}/customer/status/delivery/${order.id}`;
            } else if (normalizedOrderType === 'TAKEAWAY') {
                redirectUrl = `/${restaurantCode}/customer/status/takeaway/${order.id}`;
            } else {
                redirectUrl = `/${restaurantCode}/customer/status/${tableNumber || 'table'}/${order.id}`;
            }

            return {
                id: order.id,
                orderNumber: order.order_number || order.id.slice(0, 6),
                orderType: normalizedOrderType,
                status: order.status,
                tableNumber,
                totalAmount: Number(order.total_amount) || 0,
                createdAt: order.created_at,
                redirectUrl,
            };
        });

        // 7. Sign persistent Customer JWT (30 days) and set cookies
        let token = '';
        if (customerRecord?.id) {
            try {
                token = await signJwt({
                    customerId: customerRecord.id,
                    restaurantId: actualRestaurantId,
                    restaurantCode,
                    mobile: clean10,
                    name: customerRecord.name,
                    role: 'customer'
                }, 3600 * 24 * 30);
            } catch (jwtErr) {
                console.warn('[ActiveOrder] Customer JWT signing warning:', jwtErr);
            }
        }

        const response = NextResponse.json({
            success: true,
            hasActiveOrder: activeOrders.length > 0,
            activeOrders,
            customer: customerRecord ? {
                id: customerRecord.id,
                name: customerRecord.name,
                email: customerRecord.email,
                mobile: customerRecord.mobile || clean10,
            } : null,
            token: token || undefined,
        });

        if (token) {
            const cookieName = getCustomerTokenName(actualRestaurantId);
            const isProduction = process.env.NODE_ENV === 'production';
            response.cookies.set(cookieName, token, {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'lax',
                path: '/',
                maxAge: 3600 * 24 * 30, // 30 days
            });
            response.cookies.set('dine_customer_token', token, {
                httpOnly: true,
                secure: isProduction,
                sameSite: 'lax',
                path: '/',
                maxAge: 3600 * 24 * 30,
            });
        }

        return response;

    } catch (err: any) {
        console.error('[ActiveOrder Route Uncaught Error]', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
