import { supabaseAdmin } from '@/lib/supabase-admin';

export type UserRole =
    | 'super_admin'
    | 'superadmin'
    | 'owner'
    | 'restaurant_owner'
    | 'restaurant_admin'
    | 'admin'
    | 'branch_admin'
    | 'manager'
    | 'supervisor'
    | 'waiter'
    | 'kitchen'
    | 'chef'
    | 'delivery_boy'
    | 'delivery'
    | 'cashier'
    | 'cleaner'
    | 'customer'
    | string;

export interface AuthenticatedUser {
    userId: string;
    internalId?: string;
    role: UserRole;
    restaurantId?: string | null;
    restaurant_id?: string | null;
    branchId?: string | null;
    branch_id?: string | null;
    email?: string | null;
    mobile?: string | null;
}

export interface AccessScope {
    isSuperAdmin: boolean;
    isOwner: boolean;
    isAdmin: boolean;
    isManager: boolean;
    canSearchEmployees: boolean;
    authorizedRestaurantIds: string[];
    authorizedBranchIds: string[];
}

/**
 * Resolves the authenticated user's authorization scope,
 * including multi-branch access for owners and branch-scoped isolation for admins/managers.
 */
export async function resolveUserScope(user: AuthenticatedUser): Promise<AccessScope> {
    const rawRole = String(user.role || '').toLowerCase().trim();
    const isSuperAdmin = rawRole === 'super_admin' || rawRole === 'superadmin';
    const isOwner = rawRole === 'owner' || rawRole === 'restaurant_owner';
    const isAdmin = isOwner || rawRole === 'restaurant_admin' || rawRole === 'admin' || rawRole === 'branch_admin';
    const isManager = rawRole === 'manager' || rawRole === 'supervisor';
    const canSearchEmployees = isSuperAdmin || isOwner || isAdmin || isManager;

    const userRestId = user.restaurantId || user.restaurant_id || null;
    const userBranchId = user.branchId || user.branch_id || null;

    let authorizedRestaurantIds: string[] = userRestId ? [userRestId] : [];
    let authorizedBranchIds: string[] = userBranchId ? [userBranchId] : [];

    if (isSuperAdmin) {
        return {
            isSuperAdmin: true,
            isOwner: true,
            isAdmin: true,
            isManager: true,
            canSearchEmployees: true,
            authorizedRestaurantIds: ['*'],
            authorizedBranchIds: ['*'],
        };
    }

    if (isOwner && user.userId) {
        // Fetch all restaurants owned by this owner
        const { data: ownedRestaurants } = await supabaseAdmin
            .from('restaurants')
            .select('id')
            .eq('owner_id', user.userId);

        if (ownedRestaurants && ownedRestaurants.length > 0) {
            authorizedRestaurantIds = Array.from(new Set([
                ...authorizedRestaurantIds,
                ...ownedRestaurants.map(r => r.id)
            ]));
        }

        // Fetch all branches under these restaurants
        if (authorizedRestaurantIds.length > 0) {
            const { data: restBranches } = await supabaseAdmin
                .from('branches')
                .select('id')
                .in('restaurant_id', authorizedRestaurantIds);

            if (restBranches) {
                authorizedBranchIds = restBranches.map(b => b.id);
            }
        }
    } else if (isAdmin || isManager) {
        // Check employee_branch_access table for additional authorized branches
        if (user.userId) {
            const { data: branchAccess } = await supabaseAdmin
                .from('employee_branch_access')
                .select('branch_id')
                .eq('employee_id', user.userId);

            if (branchAccess && branchAccess.length > 0) {
                authorizedBranchIds = Array.from(new Set([
                    ...authorizedBranchIds,
                    ...branchAccess.map(ba => ba.branch_id)
                ]));
            }
        }
    }

    return {
        isSuperAdmin: false,
        isOwner,
        isAdmin,
        isManager,
        canSearchEmployees,
        authorizedRestaurantIds,
        authorizedBranchIds,
    };
}

/**
 * Validates whether the requesting user is authorized to perform an employee search
 * within the requested restaurant and branch scope.
 */
export async function verifyEmployeeSearchAuthorization(
    user: AuthenticatedUser | null | undefined,
    targetRestaurantId?: string | null,
    targetBranchId?: string | null
): Promise<{ authorized: boolean; reason?: string; scope?: AccessScope }> {
    if (!user) {
        return { authorized: false, reason: 'Authentication required' };
    }

    const scope = await resolveUserScope(user);

    if (!scope.canSearchEmployees) {
        return {
            authorized: false,
            reason: `Role '${user.role}' is not authorized to search employee records`,
            scope
        };
    }

    if (scope.isSuperAdmin) {
        return { authorized: true, scope };
    }

    // Verify restaurant scope: must match user's authorized restaurants
    if (targetRestaurantId) {
        const matchesRest = scope.authorizedRestaurantIds.includes(targetRestaurantId) ||
            scope.authorizedRestaurantIds.includes('*');

        if (!matchesRest) {
            return {
                authorized: false,
                reason: 'Cross-restaurant employee search is forbidden',
                scope
            };
        }
    } else if (!scope.isOwner && !scope.isSuperAdmin) {
        // Non-owner, non-superadmin must be explicitly scoped
        if (scope.authorizedRestaurantIds.length === 0) {
            return {
                authorized: false,
                reason: 'No authorized restaurant associated with user account',
                scope
            };
        }
    }

    // Verify branch scope for branch admins/managers
    if (targetBranchId && !scope.isOwner && !scope.isSuperAdmin) {
        const matchesBranch = scope.authorizedBranchIds.includes(targetBranchId) ||
            scope.authorizedBranchIds.includes('*');

        if (!matchesBranch) {
            return {
                authorized: false,
                reason: 'Branch-level isolation prohibits searching outside authorized branch',
                scope
            };
        }
    }

    return { authorized: true, scope };
}
