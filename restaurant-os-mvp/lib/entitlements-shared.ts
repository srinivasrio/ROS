export type FeatureKey =
    | 'qr_ordering'
    | 'digital_menu'
    | 'customer_ordering'
    | 'waiter_panel'
    | 'kds'
    | 'pos'
    | 'table_management'
    | 'menu_management'
    | 'staff_management'
    | 'basic_reports'
    | 'offers_discounts'
    | 'customer_order_history'
    | 'delivery'
    | 'inventory'
    | 'recipe_inventory'
    | 'low_stock_alerts'
    | 'advanced_reports'
    | 'advanced_staff'
    | 'advanced_analytics'
    | 'owner_panel'
    | 'multi_restaurant'
    | 'cross_restaurant_performance'
    | 'central_menu'
    | 'consolidated_reports'
    | 'multi_restaurant_staff'
    | 'whatsapp_bills';

export type PlanSlug = 'trial-14' | 'standard' | 'growth' | 'pro' | 'enterprise';

export type SubscriptionStatus = 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED' | 'SUSPENDED';

export interface FeatureDefinition {
    key: FeatureKey;
    label: string;
    description: string;
    category: 'ordering' | 'operations' | 'management' | 'intelligence' | 'multi_unit' | 'addon';
    minimumPlan: PlanSlug | 'addon';
    minimumPlanLabel: string;
    upgradeMessage: string;
}

export interface PlanDefinition {
    slug: PlanSlug;
    name: string;
    tagline: string;
    priceMonthly: number;
    priceAnnual: number;
    trialDays: number;
    maxRestaurants: number;
    maxEmployees: number;
    isPopular?: boolean;
    features: string[];
}

export interface FeatureOverride {
    featureKey: FeatureKey;
    enabled: boolean;
    reason?: string;
    createdBy?: string;
    startsAt?: string;
    expiresAt?: string | null;
}

export interface RestaurantEntitlementResult {
    restaurantId: string;
    restaurantName: string;
    planSlug: PlanSlug;
    planName: string;
    status: SubscriptionStatus;
    isTrial: boolean;
    isSuspended: boolean;
    isExpired: boolean;
    daysRemaining: number | null;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    maxRestaurants: number;
    maxEmployees: number;
    features: Record<FeatureKey, boolean>;
    overrides: FeatureOverride[];
    lockedFeatures: FeatureKey[];
    availableFeatures: FeatureKey[];
    canAccess: (feature: FeatureKey) => boolean;
}

// ==========================================
// FEATURE DEFINITIONS & METADATA
// ==========================================
export const FEATURE_DEFINITIONS: Record<FeatureKey, FeatureDefinition> = {
    qr_ordering: {
        key: 'qr_ordering',
        label: 'QR Ordering',
        description: 'Scan & dine contactless table ordering with dynamic QR codes.',
        category: 'ordering',
        minimumPlan: 'standard',
        minimumPlanLabel: 'Standard',
        upgradeMessage: 'QR Ordering is available on all active subscription plans.',
    },
    digital_menu: {
        key: 'digital_menu',
        label: 'Digital Menu',
        description: 'High-speed, visual mobile web menu with categorization and dietary filters.',
        category: 'ordering',
        minimumPlan: 'standard',
        minimumPlanLabel: 'Standard',
        upgradeMessage: 'Digital Menu is available on all active subscription plans.',
    },
    customer_ordering: {
        key: 'customer_ordering',
        label: 'Customer Ordering',
        description: 'Direct cart-to-kitchen ordering without waiting for staff.',
        category: 'ordering',
        minimumPlan: 'standard',
        minimumPlanLabel: 'Standard',
        upgradeMessage: 'Customer Ordering is available on all active subscription plans.',
    },
    waiter_panel: {
        key: 'waiter_panel',
        label: 'Waiter Panel',
        description: 'Dedicated handheld waiter app for taking orders, punching KOTs, and table calls.',
        category: 'operations',
        minimumPlan: 'standard',
        minimumPlanLabel: 'Standard',
        upgradeMessage: 'Waiter Panel is available on all active subscription plans.',
    },
    kds: {
        key: 'kds',
        label: 'Kitchen Display System (KDS)',
        description: 'Live order display station for chefs with prep timers and audio alerts.',
        category: 'operations',
        minimumPlan: 'standard',
        minimumPlanLabel: 'Standard',
        upgradeMessage: 'Kitchen Display System (KDS) is available on all active subscription plans.',
    },
    pos: {
        key: 'pos',
        label: 'Point of Sale (POS)',
        description: 'Complete cashier checkout, split bills, cash/card payment collection and GST receipt generation.',
        category: 'operations',
        minimumPlan: 'standard',
        minimumPlanLabel: 'Standard',
        upgradeMessage: 'POS & Billing is available on all active subscription plans.',
    },
    table_management: {
        key: 'table_management',
        label: 'Table Management',
        description: 'Interactive table grid, occupancy tracking, and dynamic QR code generation.',
        category: 'operations',
        minimumPlan: 'standard',
        minimumPlanLabel: 'Standard',
        upgradeMessage: 'Table Management is available on all active subscription plans.',
    },
    menu_management: {
        key: 'menu_management',
        label: 'Menu Management',
        description: 'Item pricing, variants, add-ons, in-stock/86 toggling, and categories.',
        category: 'management',
        minimumPlan: 'standard',
        minimumPlanLabel: 'Standard',
        upgradeMessage: 'Menu Management is available on all active subscription plans.',
    },
    staff_management: {
        key: 'staff_management',
        label: 'Staff Management',
        description: 'Employee profiles, PIN logins, role assignments, and basic attendance.',
        category: 'management',
        minimumPlan: 'standard',
        minimumPlanLabel: 'Standard',
        upgradeMessage: 'Staff Management is available on all active subscription plans.',
    },
    basic_reports: {
        key: 'basic_reports',
        label: 'Basic Reports',
        description: 'Daily revenue, order totals, payment method summaries, and end-of-day reports.',
        category: 'intelligence',
        minimumPlan: 'standard',
        minimumPlanLabel: 'Standard',
        upgradeMessage: 'Basic Reports are available on all active subscription plans.',
    },
    offers_discounts: {
        key: 'offers_discounts',
        label: 'Offers & Discounts',
        description: 'Flat discount codes, percentage vouchers, and bill-level promotional adjustments.',
        category: 'management',
        minimumPlan: 'standard',
        minimumPlanLabel: 'Standard',
        upgradeMessage: 'Offers & Discounts are available on all active subscription plans.',
    },
    customer_order_history: {
        key: 'customer_order_history',
        label: 'Customer Order History',
        description: 'Customer past order lookup, digital invoices, and re-order assistance.',
        category: 'ordering',
        minimumPlan: 'standard',
        minimumPlanLabel: 'Standard',
        upgradeMessage: 'Customer Order History is available on all active subscription plans.',
    },
    delivery: {
        key: 'delivery',
        label: 'Delivery Management',
        description: 'Direct doorstep delivery dispatch, delivery boy roster, live GPS order tracking, and zones.',
        category: 'operations',
        minimumPlan: 'growth',
        minimumPlanLabel: 'Growth',
        upgradeMessage: 'Delivery Management is available on the Growth plan and above.',
    },
    inventory: {
        key: 'inventory',
        label: 'Inventory & Stock Management',
        description: 'Real-time raw material tracking, stock-in/out registers, supplier records, and wastage control.',
        category: 'operations',
        minimumPlan: 'growth',
        minimumPlanLabel: 'Growth',
        upgradeMessage: 'Inventory & Stock Management is available on the Growth plan and above.',
    },
    recipe_inventory: {
        key: 'recipe_inventory',
        label: 'Recipe-Level Inventory',
        description: 'Bill of Materials (BOM) linking menu dishes to ingredient deductions automatically upon KOT order punch.',
        category: 'operations',
        minimumPlan: 'growth',
        minimumPlanLabel: 'Growth',
        upgradeMessage: 'Recipe-level inventory mapping is available on the Growth plan and above.',
    },
    low_stock_alerts: {
        key: 'low_stock_alerts',
        label: 'Low-Stock Alerts & Auto-Suggestions',
        description: 'Proactive replenishment notifications, festival demand forecasts, and buffer warnings.',
        category: 'intelligence',
        minimumPlan: 'growth',
        minimumPlanLabel: 'Growth',
        upgradeMessage: 'Low-stock alerts and smart suggestions are available on the Growth plan and above.',
    },
    advanced_reports: {
        key: 'advanced_reports',
        label: 'Advanced Reports & Exports',
        description: 'Hourly sales velocity, category heatmaps, tax reconciliation, and Excel/CSV automated downloads.',
        category: 'intelligence',
        minimumPlan: 'growth',
        minimumPlanLabel: 'Growth',
        upgradeMessage: 'Advanced Reports are available on the Growth plan and above.',
    },
    advanced_staff: {
        key: 'advanced_staff',
        label: 'Advanced Staff Management',
        description: 'Detailed shift scheduling, waiter sales commissions, and integrated payroll calculations.',
        category: 'management',
        minimumPlan: 'growth',
        minimumPlanLabel: 'Growth',
        upgradeMessage: 'Advanced Staff Management is available on the Growth plan and above.',
    },
    advanced_analytics: {
        key: 'advanced_analytics',
        label: 'Advanced Customer Analytics',
        description: 'Customer cohort retention, repeat visitor frequency, high-value diner tagging, and average spend trends.',
        category: 'intelligence',
        minimumPlan: 'growth',
        minimumPlanLabel: 'Growth',
        upgradeMessage: 'Advanced Customer Analytics are available on the Growth plan and above.',
    },
    owner_panel: {
        key: 'owner_panel',
        label: 'Owner Panel',
        description: 'Unified management portal for restaurant founders to oversee high-level metrics and accounts.',
        category: 'multi_unit',
        minimumPlan: 'pro',
        minimumPlanLabel: 'Pro',
        upgradeMessage: 'The Owner Panel is available on the Pro plan and above.',
    },
    multi_restaurant: {
        key: 'multi_restaurant',
        label: 'Multi-Restaurant Dashboard',
        description: 'Manage 2+ independent restaurant locations from a single master overview.',
        category: 'multi_unit',
        minimumPlan: 'pro',
        minimumPlanLabel: 'Pro',
        upgradeMessage: 'Multi-restaurant management is available on the Pro plan and above.',
    },
    cross_restaurant_performance: {
        key: 'cross_restaurant_performance',
        label: 'Cross-Restaurant Performance',
        description: 'Side-by-side branch sales comparisons, peak-hour benchmarking, and leaderboard matrix.',
        category: 'multi_unit',
        minimumPlan: 'pro',
        minimumPlanLabel: 'Pro',
        upgradeMessage: 'Cross-restaurant performance metrics are available on the Pro plan and above.',
    },
    central_menu: {
        key: 'central_menu',
        label: 'Central Menu Management',
        description: 'Create catalog templates centrally and propagate items/prices across branches in 1 click.',
        category: 'multi_unit',
        minimumPlan: 'pro',
        minimumPlanLabel: 'Pro',
        upgradeMessage: 'Central Menu Management is available on the Pro plan and above.',
    },
    consolidated_reports: {
        key: 'consolidated_reports',
        label: 'Consolidated Reports',
        description: 'Aggregated GST, revenue, and payout reports across all authorized branch locations.',
        category: 'multi_unit',
        minimumPlan: 'pro',
        minimumPlanLabel: 'Pro',
        upgradeMessage: 'Consolidated cross-branch reports are available on the Pro plan and above.',
    },
    multi_restaurant_staff: {
        key: 'multi_restaurant_staff',
        label: 'Multi-Restaurant Staff Management',
        description: 'Floating staff accounts with permissions to operate across multiple authorized branches.',
        category: 'multi_unit',
        minimumPlan: 'pro',
        minimumPlanLabel: 'Pro',
        upgradeMessage: 'Multi-restaurant staff management is available on the Pro plan and above.',
    },
    whatsapp_bills: {
        key: 'whatsapp_bills',
        label: 'WhatsApp Digital Bills (Add-on)',
        description: 'Automatic instant delivery of PDF receipts, order updates, and marketing messages to customer WhatsApp.',
        category: 'addon',
        minimumPlan: 'addon',
        minimumPlanLabel: 'Paid Add-on',
        upgradeMessage: 'WhatsApp Bills is a separate paid add-on. Contact Super Admin or activate it in your billing portal.',
    },
};

// ==========================================
// BASE PLAN ENTITLEMENTS MATRIX
// ==========================================
export const PLAN_FEATURE_MATRIX: Record<PlanSlug, Record<FeatureKey, boolean>> = {
    // 14-Day Trial: Full Growth feature access, 1 restaurant
    'trial-14': {
        qr_ordering: true,
        digital_menu: true,
        customer_ordering: true,
        waiter_panel: true,
        kds: true,
        pos: true,
        table_management: true,
        menu_management: true,
        staff_management: true,
        basic_reports: true,
        offers_discounts: true,
        customer_order_history: true,
        delivery: true,
        inventory: true,
        recipe_inventory: true,
        low_stock_alerts: true,
        advanced_reports: true,
        advanced_staff: true,
        advanced_analytics: true,
        owner_panel: false,
        multi_restaurant: false,
        cross_restaurant_performance: false,
        central_menu: false,
        consolidated_reports: false,
        multi_restaurant_staff: false,
        whatsapp_bills: false,
    },

    // Standard — ₹999/month: Base features, No Delivery, No Inventory, No Multi-unit
    'standard': {
        qr_ordering: true,
        digital_menu: true,
        customer_ordering: true,
        waiter_panel: true,
        kds: true,
        pos: true,
        table_management: true,
        menu_management: true,
        staff_management: true,
        basic_reports: true,
        offers_discounts: true,
        customer_order_history: true,
        delivery: false,
        inventory: false,
        recipe_inventory: false,
        low_stock_alerts: false,
        advanced_reports: false,
        advanced_staff: false,
        advanced_analytics: false,
        owner_panel: false,
        multi_restaurant: false,
        cross_restaurant_performance: false,
        central_menu: false,
        consolidated_reports: false,
        multi_restaurant_staff: false,
        whatsapp_bills: false,
    },

    // Growth — ₹1,499/month: Everything in Standard + Delivery, Inventory, Recipe, Low-stock, Advanced Reports, Advanced Staff & Analytics
    'growth': {
        qr_ordering: true,
        digital_menu: true,
        customer_ordering: true,
        waiter_panel: true,
        kds: true,
        pos: true,
        table_management: true,
        menu_management: true,
        staff_management: true,
        basic_reports: true,
        offers_discounts: true,
        customer_order_history: true,
        delivery: true,
        inventory: true,
        recipe_inventory: true,
        low_stock_alerts: true,
        advanced_reports: true,
        advanced_staff: true,
        advanced_analytics: true,
        owner_panel: false,
        multi_restaurant: false,
        cross_restaurant_performance: false,
        central_menu: false,
        consolidated_reports: false,
        multi_restaurant_staff: false,
        whatsapp_bills: false,
    },

    // Pro — ₹2,999/month: Everything in Growth + Max 2 restaurants, Owner Panel, Multi-restaurant dashboard, Cross-restaurant performance, Central menu, Consolidated reports, Multi-restaurant staff
    'pro': {
        qr_ordering: true,
        digital_menu: true,
        customer_ordering: true,
        waiter_panel: true,
        kds: true,
        pos: true,
        table_management: true,
        menu_management: true,
        staff_management: true,
        basic_reports: true,
        offers_discounts: true,
        customer_order_history: true,
        delivery: true,
        inventory: true,
        recipe_inventory: true,
        low_stock_alerts: true,
        advanced_reports: true,
        advanced_staff: true,
        advanced_analytics: true,
        owner_panel: true,
        multi_restaurant: true,
        cross_restaurant_performance: true,
        central_menu: true,
        consolidated_reports: true,
        multi_restaurant_staff: true,
        whatsapp_bills: false,
    },

    // Enterprise: Everything in Pro + custom scaling
    'enterprise': {
        qr_ordering: true,
        digital_menu: true,
        customer_ordering: true,
        waiter_panel: true,
        kds: true,
        pos: true,
        table_management: true,
        menu_management: true,
        staff_management: true,
        basic_reports: true,
        offers_discounts: true,
        customer_order_history: true,
        delivery: true,
        inventory: true,
        recipe_inventory: true,
        low_stock_alerts: true,
        advanced_reports: true,
        advanced_staff: true,
        advanced_analytics: true,
        owner_panel: true,
        multi_restaurant: true,
        cross_restaurant_performance: true,
        central_menu: true,
        consolidated_reports: true,
        multi_restaurant_staff: true,
        whatsapp_bills: false, // Paid add-on unless explicitly enabled via override
    },
};

// ==========================================
// CANONICAL PLAN CATALOGUE
// ==========================================
export const CANONICAL_PLANS: Record<PlanSlug, PlanDefinition> = {
    'trial-14': {
        slug: 'trial-14',
        name: '14-Day Trial',
        tagline: 'Full Growth feature access for 14 days to experience Dine in One',
        priceMonthly: 0,
        priceAnnual: 0,
        trialDays: 14,
        maxRestaurants: 1,
        maxEmployees: 25,
        features: [
            'Full Growth Feature Access',
            '1 Restaurant Location',
            'QR Ordering & Digital Menu',
            'Waiter Panel & Kitchen Display (KDS)',
            'Point of Sale (POS) & Billing',
            'Table Management & Dynamic QR',
            'Delivery Management & Live Tracking',
            'Inventory & Stock Management',
            'Recipe-level Inventory Mapping',
            'Low-Stock Alerts & Auto-Suggestions',
            'Advanced Reports & Customer Analytics',
        ],
    },
    'standard': {
        slug: 'standard',
        name: 'Standard',
        tagline: 'Essential digital dining, ordering, billing, and staff management',
        priceMonthly: 999,
        priceAnnual: 9990,
        trialDays: 0,
        maxRestaurants: 1,
        maxEmployees: 15,
        features: [
            'QR Ordering',
            'Digital Menu',
            'Customer Ordering',
            'Waiter Panel',
            'Kitchen Display System (KDS)',
            'Point of Sale (POS)',
            'Table Management',
            'Menu Management',
            'Staff Management',
            'Basic Reports',
            'Offers & Discounts',
            'Customer Order History',
            '✕ No Delivery Management',
            '✕ No Inventory Management',
        ],
    },
    'growth': {
        slug: 'growth',
        name: 'Growth',
        tagline: 'Full operational suite for growing restaurants with delivery & inventory control',
        priceMonthly: 1499,
        priceAnnual: 14990,
        trialDays: 0,
        maxRestaurants: 1,
        maxEmployees: 35,
        isPopular: true,
        features: [
            'Everything in Standard',
            'Delivery Management & Live Rider Tracking',
            'Inventory & Stock Management',
            'Recipe-level Inventory Mapping',
            'Low-Stock Alerts & Auto-Suggestions',
            'Advanced Reports & Tax Downloads',
            'Advanced Staff Management & Payroll',
            'Advanced Customer Analytics & Repeat Insights',
        ],
    },
    'pro': {
        slug: 'pro',
        name: 'Pro',
        tagline: 'Multi-branch control with central operations for high-volume restaurateurs',
        priceMonthly: 2999,
        priceAnnual: 29990,
        trialDays: 0,
        maxRestaurants: 2,
        maxEmployees: 75,
        features: [
            'Everything in Growth',
            'Maximum 2 Restaurants Included',
            'Owner Panel & Central Hub',
            'Multi-Restaurant Dashboard',
            'Cross-Restaurant Performance Comparison',
            'Central Menu Management & Sync',
            'Consolidated Multi-Location Reports',
            'Advanced Analytics Matrix',
            'Multi-Restaurant Staff Management',
        ],
    },
    'enterprise': {
        slug: 'enterprise',
        name: 'Enterprise',
        tagline: 'Bespoke multi-unit chains with custom integrations and dedicated support',
        priceMonthly: 9999,
        priceAnnual: 99990,
        trialDays: 0,
        maxRestaurants: 10,
        maxEmployees: 500,
        features: [
            'Everything in Pro',
            'Custom Number of Restaurants',
            'Custom Features & Higher Limits',
            'Custom Integrations & Webhooks',
            'Dedicated & Advanced Priority Support',
            'Additional Restaurant: ₹1,499/month',
        ],
    },
};

// Map legacy or alternative slugs to canonical slugs
export function normalizePlanSlug(rawSlug: string | null | undefined): PlanSlug {
    if (!rawSlug) return 'standard';
    const s = String(rawSlug).toLowerCase().trim().replace(/[^a-z0-9_-]/g, '-');

    if (s.includes('trial') || s === 'trial-14' || s === 'starter-trial') return 'trial-14';
    if (s === 'starter' || s === 'standard' || s === 'basic') return 'standard';
    if (s === 'growth') return 'growth';
    if (s === 'pro' || s === 'professional') return 'pro';
    if (s === 'enterprise' || s === 'custom') return 'enterprise';

    return 'standard';
}

export function getAllFeatures(): FeatureDefinition[] {
    return Object.values(FEATURE_DEFINITIONS);
}

export function getAllPlans(): PlanDefinition[] {
    return Object.values(CANONICAL_PLANS);
}

export function getFeatureMetadata(featureKey: FeatureKey): FeatureDefinition | undefined {
    return FEATURE_DEFINITIONS[featureKey];
}

export function getPlanDefaultLimit(slug: string | null | undefined): number {
    const normalized = normalizePlanSlug(slug);
    switch (normalized) {
        case 'standard':
            return 1;
        case 'growth':
            return 1;
        case 'pro':
            return 2;
        case 'enterprise':
            return 10;
        case 'trial-14':
            return 1;
        default:
            return 1;
    }
}
