import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyJwt, extractTokenForRestaurant } from '@/lib/jwt-utils';
import { resolveRestaurantId } from '@/services/utils.service';
import { normalizeE164Phone, cleanPhoneDigits, sanitizeEmployeeProfile } from '@/lib/entity-id';
import { verifyEmployeeSearchAuthorization } from '@/lib/auth/rbac';

/**
 * GET /api/admin/employees/search
 * Search employee by phone number or code with tenant/branch isolation and strict profile sanitization.
 * 
 * Query params:
 *   - phone / mobile: Phone number to search (normalized to E.164)
 *   - code: Employee code (e.g. EMP-0001) or internal_id
 *   - restaurantId / restaurantCode: Target restaurant scope
 *   - branchId: Optional branch filter
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const rawPhone = searchParams.get('phone') || searchParams.get('mobile') || '';
        const rawCode = searchParams.get('code') || searchParams.get('id') || searchParams.get('query') || '';
        let targetRestaurantId = searchParams.get('restaurantId') || searchParams.get('restaurantCode') || '';
        const targetBranchId = searchParams.get('branchId') || searchParams.get('branch') || null;

        // 1. Authenticate requesting user
        const token = extractTokenForRestaurant(req.cookies, targetRestaurantId);
        if (!token) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }

        const user = await verifyJwt(token);
        if (!user) {
            return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
        }

        // Resolve restaurant ID if provided
        let resolvedRestId: string | null = null;
        if (targetRestaurantId) {
            resolvedRestId = await resolveRestaurantId(targetRestaurantId);
        } else if (user.restaurantId || user.restaurant_id) {
            resolvedRestId = await resolveRestaurantId(user.restaurantId || user.restaurant_id);
        }

        // 2. Authorize requester (Centralized RBAC + Tenant/Branch checks)
        const authCheck = await verifyEmployeeSearchAuthorization(
            {
                userId: user.userId || user.id,
                internalId: user.internalId,
                role: user.role,
                restaurantId: user.restaurantId || user.restaurant_id,
                branchId: user.branchId || user.branch_id,
            },
            resolvedRestId,
            targetBranchId
        );

        if (!authCheck.authorized) {
            return NextResponse.json({ error: authCheck.reason || 'Unauthorized' }, { status: 403 });
        }

        const scope = authCheck.scope!;

        // 3. Build search query
        let query = supabaseAdmin
            .from('employees')
            .select(`
                id,
                internal_id,
                employee_code,
                legacy_reference,
                name,
                role,
                mobile,
                phone_normalized,
                email,
                status,
                approval_status,
                restaurant_id,
                branch_id,
                joining_date,
                avatar_url,
                profile_image_url,
                is_online,
                availability_status,
                created_at,
                branch:branch_id (
                    id,
                    name,
                    code
                )
            `)
            .eq('is_deleted', false);

        // Apply tenant isolation
        if (!scope.isSuperAdmin) {
            if (scope.authorizedRestaurantIds.length > 0) {
                query = query.in('restaurant_id', scope.authorizedRestaurantIds);
            } else if (resolvedRestId) {
                query = query.eq('restaurant_id', resolvedRestId);
            }

            // Apply branch isolation for non-owners
            if (!scope.isOwner && scope.authorizedBranchIds.length > 0) {
                query = query.in('branch_id', scope.authorizedBranchIds);
            }
        } else if (resolvedRestId) {
            query = query.eq('restaurant_id', resolvedRestId);
        }

        // Apply explicit branch filter if provided and permitted
        if (targetBranchId && targetBranchId !== 'all') {
            query = query.eq('branch_id', targetBranchId);
        }

        // 4. Apply phone or code search filter
        if (rawPhone) {
            const e164 = normalizeE164Phone(rawPhone);
            const clean10 = cleanPhoneDigits(rawPhone);

            const phoneFilters: string[] = [];
            if (e164) phoneFilters.push(`phone_normalized.eq.${e164}`);
            if (clean10) {
                phoneFilters.push(`mobile.eq.${clean10}`);
                phoneFilters.push(`mobile.eq.+91${clean10}`);
                phoneFilters.push(`mobile.eq.91${clean10}`);
            }
            if (phoneFilters.length > 0) {
                query = query.or(phoneFilters.join(','));
            }
        } else if (rawCode) {
            const codeFilters = [
                `employee_code.ilike.%${rawCode}%`,
                `legacy_reference.ilike.%${rawCode}%`,
                `employee_id.ilike.%${rawCode}%`,
                `internal_id.eq.${rawCode}`,
            ];
            // If valid UUID
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawCode)) {
                codeFilters.push(`id.eq.${rawCode}`);
            }
            query = query.or(codeFilters.join(','));
        }

        const { data, error } = await query.limit(20);

        if (error) {
            console.error('[EmployeeSearch] DB error:', error);
            return NextResponse.json({ error: 'Failed to search employee records' }, { status: 500 });
        }

        // 5. Sanitize every profile to strictly prevent leaking passwords, hashes, tokens
        const sanitizedEmployees = (data || []).map(sanitizeEmployeeProfile);

        return NextResponse.json({
            success: true,
            count: sanitizedEmployees.length,
            employees: sanitizedEmployees,
        });

    } catch (err: any) {
        console.error('[EmployeeSearch] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
