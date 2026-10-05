/**
 * Audit Trail Text Formatter and Normalizer
 * Converts raw JSON database audit logs into neat, human-readable, and accurate text.
 */

export interface FormattedAuditBadges {
    label: string;
    value: string;
    variant?: 'neutral' | 'indigo' | 'emerald' | 'amber' | 'rose';
}

/**
 * Format raw action slugs into human-friendly event titles
 */
export function formatAuditAction(action: string | null | undefined): string {
    if (!action) return 'Operational Activity';

    const normalized = action.toLowerCase().trim();

    const ACTION_MAP: Record<string, string> = {
        // Location Operations
        super_admin_create_location: 'Created Restaurant Location',
        super_admin_edit_location: 'Updated Location Details',
        super_admin_activate_location: 'Activated Location',
        super_admin_deactivate_location: 'Deactivated Location',
        super_admin_suspend_location: 'Suspended Location',
        super_admin_restore_location: 'Restored Location',
        super_admin_delete_location: 'Soft-Deleted Location',
        super_admin_set_main_location: 'Set Flagship Main Branch',
        super_admin_manage_admin: 'Updated Location Admin',

        // Owner Controls
        super_admin_update_owner_quota: 'Updated Location Quota',
        super_admin_force_logout: 'Forced Revoke Sessions',
        super_admin_suspend_owner: 'Suspended Owner Account',
        super_admin_restore_owner: 'Restored Owner Account',
        super_admin_delete_owner: 'Deleted Owner Account',
        super_admin_override_subscription: 'Overrode Subscription Plan',
        super_admin_provision_owner: 'Provisioned New Owner',

        // Staff / User Operations
        super_admin_add_employee: 'Added Staff Member',
        super_admin_edit_employee: 'Updated Staff Member',
        super_admin_delete_employee: 'Removed Staff Member',
        employee_creation: 'Provisioned Staff Account',
        employee_login: 'Staff Login',
        staff_login: 'Staff Login',
        waiter_login: 'Waiter Login',
        chef_login: 'Kitchen Staff Login',

        // Authentication & Session Events
        login: 'User Sign-In',
        owner_quick_access_login: 'Owner Quick-Access Sign-In',
        session_forced_logout: 'Forced Session Invalidation',
        session_version_incremented: 'Security Version Bump',
        password_changes: 'Password Modified',
        password_verified: 'Password Verified',
        activation_success: 'Account Onboarding Completed',
        failed_login_attempt: 'Failed Authentication Attempt',
        rate_limit_triggered: 'Security Rate Limit Triggered',
        recovery_code_generated: 'Recovery Codes Generated',

        // Restaurant Lifecycle
        restaurant_suspended: 'Restaurant Suspended',
        restaurant_reactivated: 'Restaurant Reactivated',
        restaurant_created: 'Restaurant Created',
        restaurant_updated: 'Restaurant Updated',
        branch_created: 'Branch Created',
        branch_updated: 'Branch Updated',

        // POS & Orders
        order_created: 'Order Placed',
        order_status_updated: 'Order Status Changed',
        order_settled: 'Bill Settled',
        table_transferred: 'Table Transferred'
    };

    if (ACTION_MAP[normalized]) {
        return ACTION_MAP[normalized];
    }

    // Fallback: capitalize snake_case
    return action
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Returns color badge styling for action types
 */
export function getActionBadgeStyle(action: string | null | undefined): { bg: string; text: string; border: string } {
    const act = (action || '').toLowerCase();

    if (act.includes('delete') || act.includes('suspend') || act.includes('fail') || act.includes('limit')) {
        return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
    }
    if (act.includes('create') || act.includes('restore') || act.includes('activate') || act.includes('success')) {
        return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    }
    if (act.includes('login') || act.includes('quota') || act.includes('plan') || act.includes('admin')) {
        return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
    }
    if (act.includes('edit') || act.includes('update') || act.includes('session')) {
        return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    }

    return { bg: 'bg-neutral-100', text: 'text-neutral-700', border: 'border-neutral-200' };
}

/**
 * Translates raw JSON details into accurate, neat human text
 */
export function formatAuditDetails(action: string | null | undefined, rawDetails: any, logContext?: any): string {
    if (!rawDetails && !logContext) {
        return 'Standard system audit verification recorded.';
    }

    let details = rawDetails;
    if (typeof details === 'string') {
        try {
            details = JSON.parse(details);
        } catch {
            return details;
        }
    }

    if (!details || (typeof details === 'object' && Object.keys(details).length === 0)) {
        return 'Event verified and recorded successfully.';
    }

    const act = (action || '').toLowerCase().trim();

    // 1. Sign In & Session Events
    if (act.includes('login')) {
        if (act === 'owner_quick_access_login') {
            return 'Authenticated into Owner Workspace using Founder One-Click Quick Access.';
        }
        const method = details.method ? details.method.replace(/_/g, ' ') : 'credentials';
        const panel = details.panel ? `${details.panel.replace(/_/g, ' ')} panel` : 'system';
        const branch = details.branch_id ? ` for Branch ${details.branch_id}` : '';
        const role = details.role ? ` (${details.role.replace(/_/g, ' ')})` : '';
        return `Signed in to ${panel} via ${method}${role}${branch}.`;
    }

    if (act === 'session_forced_logout') {
        const reason = details.reason ? ` Reason: ${details.reason.replace(/_/g, ' ')}.` : '';
        return `Revoked all active user sessions and cleared authentication tokens.${reason}`;
    }

    if (act === 'session_version_incremented') {
        const ver = details.new_version ? `v${details.new_version}` : 'next';
        const reason = details.reason ? ` (${details.reason.replace(/_/g, ' ')})` : '';
        return `Security session version incremented to ${ver}${reason} to invalidate previous tokens.`;
    }

    if (act === 'failed_login_attempt') {
        const attempts = details.failed_attempts || 1;
        return `Failed authentication attempt #${attempts}. Invalid credentials provided.`;
    }

    if (act === 'rate_limit_triggered') {
        const ep = details.endpoint || details.key || 'API endpoint';
        return `Security rate limit barrier reached on ${ep}. Request temporarily throttled.`;
    }

    if (act === 'password_changes') {
        const method = details.method ? details.method.replace(/_/g, ' ') : 'profile settings';
        return `Account security credentials updated via ${method}.`;
    }

    if (act === 'password_verified') {
        return 'Account security credential verified successfully.';
    }

    if (act === 'activation_success') {
        const role = details.role ? details.role.replace(/_/g, ' ') : 'staff';
        return `Successfully completed initial onboarding and activated ${role} account.`;
    }

    if (act === 'recovery_code_generated') {
        const count = details.count || 10;
        return `Generated ${count} one-time backup emergency security recovery codes.`;
    }

    // 2. Location Management Events
    if (act === 'super_admin_create_location') {
        const locName = details.name || details.restaurant_id || 'Location';
        const quotaInfo = details.quota_used && details.quota_max
            ? ` (${details.quota_used} of ${details.quota_max} allocated slots used)`
            : '';
        return `Created new independent restaurant "${locName}"${quotaInfo}. Primary branch and defaults provisioned.`;
    }

    if (act === 'super_admin_edit_location') {
        const updates = details.updates ? Object.keys(details.updates).join(', ') : 'attributes';
        return `Modified location configuration: ${updates}.`;
    }

    if (act === 'super_admin_suspend_location' || act === 'restaurant_suspended') {
        const reason = details.reason ? details.reason : 'Administrative policy enforcement';
        return `Restaurant location suspended from operations. Reason: ${reason}.`;
    }

    if (act === 'super_admin_restore_location' || act === 'restaurant_reactivated') {
        return 'Restaurant location restored to active operational status. System access enabled.';
    }

    if (act === 'super_admin_deactivate_location') {
        return 'Restaurant location set to inactive status.';
    }

    if (act === 'super_admin_activate_location') {
        return 'Restaurant location set to active status.';
    }

    if (act === 'super_admin_delete_location') {
        const reason = details.reason ? ` (${details.reason})` : '';
        return `Location soft-deleted and archived${reason}. Preserved for statutory retention audit.`;
    }

    if (act === 'super_admin_set_main_location') {
        return 'Designated as the Owner’s primary flagship main branch.';
    }

    if (act === 'super_admin_manage_admin') {
        const name = details.admin_name || details.admin_email || 'Restaurant Admin';
        return `Provisioned or updated restaurant manager credentials for ${name}.`;
    }

    // 3. Owner Controls Events
    if (act === 'super_admin_update_owner_quota') {
        const quota = details.new_quota || 'updated';
        const by = details.updated_by ? ` by ${details.updated_by}` : '';
        return `Owner restaurant/location quota limit updated to ${quota} locations${by}.`;
    }

    if (act === 'super_admin_suspend_owner') {
        const reason = details.reason ? ` Reason: ${details.reason}` : '';
        return `Owner account suspended.${reason}`;
    }

    if (act === 'super_admin_restore_owner') {
        return 'Owner account restored to active standing.';
    }

    if (act === 'super_admin_override_subscription') {
        const plan = details.plan || 'custom';
        return `Owner subscription overridden to ${plan} tier.`;
    }

    // 4. Staff Management Events
    if (act === 'super_admin_add_employee' || act === 'employee_creation') {
        const name = details.employee_name || details.name || 'Staff Member';
        const role = details.role ? ` (${details.role.replace(/_/g, ' ')})` : '';
        const loc = details.restaurant_id ? ` at Location ${details.restaurant_id}` : '';
        return `Added staff member "${name}"${role}${loc}.`;
    }

    if (act === 'super_admin_edit_employee') {
        const name = details.employee_name || details.name || 'Staff Member';
        const role = details.role ? ` to role ${details.role.replace(/_/g, ' ')}` : '';
        return `Updated staff profile for "${name}"${role}.`;
    }

    if (act === 'super_admin_delete_employee') {
        const name = details.employee_name || details.name || 'Staff Member';
        return `Deactivated staff member "${name}".`;
    }

    // 5. Generic Object Fallback: Parse into clean sentence fragments
    const fragments: string[] = [];
    for (const [key, val] of Object.entries(details)) {
        if (['user_agent', 'timestamp', 'ip', 'created_at'].includes(key)) continue;

        const cleanKey = key.replace(/_/g, ' ');
        if (typeof val === 'object' && val !== null) {
            fragments.push(`${cleanKey}: ${Object.keys(val).join(', ')}`);
        } else if (val !== null && val !== undefined && String(val).trim() !== '') {
            fragments.push(`${cleanKey}: ${String(val)}`);
        }
    }

    if (fragments.length > 0) {
        return fragments.join(' • ');
    }

    return 'Action verified and permanently logged to audit ledger.';
}

/**
 * Extracts compact key badges for metadata like IP, Role, Browser, Branch
 */
export function extractAuditBadges(log: any): FormattedAuditBadges[] {
    const badges: FormattedAuditBadges[] = [];
    if (!log) return badges;

    let details = log.details;
    if (typeof details === 'string') {
        try {
            details = JSON.parse(details);
        } catch {
            details = {};
        }
    }
    details = details || {};

    // IP Address
    const ip = log.ip_address || details.ip;
    if (ip) {
        badges.push({ label: 'IP', value: String(ip), variant: 'neutral' });
    }

    // Role
    const role = log.actor_role || details.role;
    if (role) {
        badges.push({
            label: 'Role',
            value: String(role).toUpperCase().replace(/_/g, ' '),
            variant: 'indigo'
        });
    }

    // Branch / Location
    const branch = log.branch_id || details.branch_id;
    if (branch) {
        badges.push({ label: 'Branch', value: String(branch), variant: 'amber' });
    }

    // Method (e.g. Password, Quick Access, OTP)
    if (details.method) {
        badges.push({
            label: 'Method',
            value: String(details.method).replace(/_/g, ' '),
            variant: 'emerald'
        });
    }

    // Device / Browser
    const browser = log.browser || details.browser;
    const device = log.device || details.device;
    if (browser || device) {
        badges.push({
            label: 'Client',
            value: [device, browser].filter(Boolean).join(' / '),
            variant: 'neutral'
        });
    }

    return badges;
}
