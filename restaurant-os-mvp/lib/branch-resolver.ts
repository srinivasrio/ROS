import { supabaseAdmin } from '@/lib/supabase-admin';

export interface BranchRecord {
    id: string;
    internal_id: string;
    restaurant_id: string;
    name: string;
    code?: string | null;
    status?: string | null;
}

export interface ResolvedBranchResult {
    success: boolean;
    branch?: BranchRecord | null;
    validFkBranchId?: string | null;
    branchInternalId?: string | null;
    error?: string;
    status?: number;
}

export interface ResolvedBranchesResult {
    success: boolean;
    validFkBranchIds: string[];
    branchInternalIds: string[];
    branches: BranchRecord[];
    error?: string;
    status?: number;
}

/**
 * Authoritatively resolves and validates a branch identifier (internal_id 'brn_...', legacy id 'BR-...', code, or restaurant_id fallback).
 * 
 * Enforces:
 * 1. Branch exists in the branches table.
 * 2. Branch belongs to one of the authorized restaurant IDs.
 * 3. Returns the valid foreign key target (branches.id) to prevent staff_branch_id_fkey violations.
 * 4. Rejects cross-restaurant assignment with 403 Forbidden.
 * 5. Rejects invalid/non-existent branches with 400 Bad Request.
 */
export async function resolveAuthorizedBranch(
    branchIdentifier: string | null | undefined,
    authorizedRestaurantIds: string[] | string
): Promise<ResolvedBranchResult> {
    const rawId = branchIdentifier?.trim();
    if (!rawId) {
        return { success: true, branch: null, validFkBranchId: null, branchInternalId: null };
    }

    const restIds = Array.isArray(authorizedRestaurantIds)
        ? authorizedRestaurantIds.filter(Boolean)
        : (authorizedRestaurantIds ? [authorizedRestaurantIds] : []);

    if (restIds.length === 0) {
        return { 
            success: false, 
            error: 'Access denied: No authorized restaurants provided for branch validation', 
            status: 403 
        };
    }

    // Query branches by internal_id, id, code, or restaurant_id (if client submitted restaurant ID as branch)
    const { data: matchedBranches, error } = await supabaseAdmin
        .from('branches')
        .select('id, internal_id, restaurant_id, name, code, status')
        .or(`internal_id.eq.${rawId},id.eq.${rawId},code.eq.${rawId},restaurant_id.eq.${rawId}`)
        .is('deleted_at', null);

    if (error) {
        console.error('[resolveAuthorizedBranch] Database query error:', error);
        return { 
            success: false, 
            error: 'Failed to validate branch: ' + error.message, 
            status: 500 
        };
    }

    if (!matchedBranches || matchedBranches.length === 0) {
        return { 
            success: false, 
            error: `Branch '${rawId}' does not exist or has been deleted`, 
            status: 400 
        };
    }

    // Check if any matched branch belongs to the caller's authorized restaurants
    const authorizedBranch = matchedBranches.find(b => restIds.includes(b.restaurant_id));

    if (!authorizedBranch) {
        // The branch exists, but belongs to another restaurant!
        return { 
            success: false, 
            error: 'Access denied: Branch does not belong to your authorized restaurant', 
            status: 403 
        };
    }

    return {
        success: true,
        branch: authorizedBranch as BranchRecord,
        validFkBranchId: authorizedBranch.id,
        branchInternalId: authorizedBranch.internal_id
    };
}

/**
 * Resolves an array of branch identifiers (for multi-branch assignments).
 * Ensures every single branch belongs to the authorized restaurants.
 */
export async function resolveAuthorizedBranches(
    branchIdentifiers: (string | null | undefined)[],
    authorizedRestaurantIds: string[] | string
): Promise<ResolvedBranchesResult> {
    const cleanIds = (branchIdentifiers || []).map(id => id?.trim()).filter(Boolean) as string[];
    if (cleanIds.length === 0) {
        return {
            success: true,
            validFkBranchIds: [],
            branchInternalIds: [],
            branches: []
        };
    }

    const validFkBranchIds: string[] = [];
    const branchInternalIds: string[] = [];
    const branches: BranchRecord[] = [];

    for (const rawId of cleanIds) {
        const res = await resolveAuthorizedBranch(rawId, authorizedRestaurantIds);
        if (!res.success) {
            return {
                success: false,
                validFkBranchIds: [],
                branchInternalIds: [],
                branches: [],
                error: res.error,
                status: res.status
            };
        }
        if (res.branch) {
            if (!validFkBranchIds.includes(res.validFkBranchId!)) {
                validFkBranchIds.push(res.validFkBranchId!);
            }
            if (res.branchInternalId && !branchInternalIds.includes(res.branchInternalId)) {
                branchInternalIds.push(res.branchInternalId);
            }
            branches.push(res.branch);
        }
    }

    return {
        success: true,
        validFkBranchIds,
        branchInternalIds,
        branches
    };
}
