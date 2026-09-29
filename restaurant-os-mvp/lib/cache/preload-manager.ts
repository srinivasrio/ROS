'use client';

import { adminCacheManager } from './admin-cache-manager';
import { requestManager } from './request-manager';

// Service Imports
import { OrderService } from '@/services/orders.service';
import { MenuService } from '@/services/menu.service';
import { AnalyticsService } from '@/services/analytics.service';
import { PayrollService } from '@/services/payroll.service';
import { StaffService } from '@/services/staff.service';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { RestaurantService } from '@/services/restaurant.service';
import { InventoryService } from '@/services/inventory.service';
import { OfferService } from '@/services/offers.service';
import { SpecialsService } from '@/services/specials.service';
import { SupplierService } from '@/services/supplier.service';
import { RegistrationService } from '@/services/registration.service';

/**
 * Centralized Admin Panel Preload Manager
 * 
 * Orchestrates background data prefetching across all admin sections
 * with controlled concurrency, priority queues, and pagination.
 * 
 * Priorities:
 * - Priority 1 (Immediate): Dashboard, Current Orders, Tables, Live Kitchen
 * - Priority 2 (Core Business): Menu, Customers (p.1), Order History (p.1), Specials, Services, Inventory
 * - Priority 3 (Secondary): Homepage Builder, Analytics (7d), Profile, Staff & Payroll, Offers, Settings, Security
 */

class AdminPreloadManager {
    private isPreloading = false;
    private lastPreloadedRestaurantId: string | null = null;
    private lastPreloadTimestamp = 0;
    private readonly PRELOAD_COOLDOWN_MS = 2.5 * 60 * 1000; // 2.5 min cooldown

    /**
     * Start background preloading for the given restaurant.
     * Non-blocking: Priority 1 resolves first, while remaining sections queue gracefully.
     */
    public async startPreload(restaurantId: string, restaurantCode?: string): Promise<void> {
        if (!restaurantId || typeof window === 'undefined') return;

        const now = Date.now();
        if (
            this.isPreloading &&
            this.lastPreloadedRestaurantId === restaurantId
        ) {
            return;
        }

        if (
            this.lastPreloadedRestaurantId === restaurantId &&
            now - this.lastPreloadTimestamp < this.PRELOAD_COOLDOWN_MS
        ) {
            return;
        }

        this.isPreloading = true;
        this.lastPreloadedRestaurantId = restaurantId;
        this.lastPreloadTimestamp = now;

        // Initialize tenant scope in cache manager
        adminCacheManager.setTenant(restaurantId);

        try {
            // =========================================================================
            // PRIORITY 1: Core Operational Views (Immediate Execution, Non-blocking shell)
            // =========================================================================
            await Promise.allSettled([
                // 1. Dashboard KPIs, Revenue Trends, and Order Status Breakdown
                requestManager.enqueue(
                    `dashboard-v2-${restaurantId}`,
                    async () => {
                        const [kpis, revenue, status, top] = await Promise.all([
                            AnalyticsService.fetchKPIMetrics(restaurantId, 'today').catch(() => null),
                            AnalyticsService.fetchRevenueTrends(restaurantId, 'today').catch(() => []),
                            AnalyticsService.fetchOrderStatusBreakdown(restaurantId, 'today').catch(() => []),
                            AnalyticsService.fetchTopSellingItems(restaurantId, 'today', 24).catch(() => [])
                        ]);
                        if (kpis) {
                            adminCacheManager.set(
                                `dashboard-v2-${restaurantId}`,
                                { metrics: kpis, revenueData: revenue, statusData: status, peakData: revenue },
                                { tenantId: restaurantId, staleTimeMs: 45 * 1000, isRealtime: true }
                            );
                            if (restaurantCode && restaurantCode !== restaurantId) {
                                adminCacheManager.set(
                                    `dashboard-v2-${restaurantCode}`,
                                    { metrics: kpis, revenueData: revenue, statusData: status, peakData: revenue },
                                    { tenantId: restaurantId, staleTimeMs: 45 * 1000, isRealtime: true }
                                );
                            }
                        }
                        return kpis;
                    },
                    { priority: 1 }
                ),

                // 2. Tables, Table Areas, Merge Groups & Active Orders (Powers Tables, Areas & KDS)
                requestManager.enqueue(
                    `tables-${restaurantId}`,
                    async () => {
                        const [allTables, activeOrders, allMergeGroups, allAreas, allStaff] = await Promise.all([
                            OrderService.fetchTables(restaurantId).catch(() => []),
                            OrderService.fetchActiveOrders(restaurantId).catch(() => []),
                            OrderService.fetchMergeGroups(restaurantId).catch(() => []),
                            OrderService.fetchAreas(restaurantId).catch(() => []),
                            OrderService.fetchStaff(restaurantId).catch(() => [])
                        ]);

                        const tablesPayload = {
                            tables: allTables || [],
                            orders: activeOrders || [],
                            mergeGroups: allMergeGroups || [],
                            areas: allAreas || [],
                            waiters: (allStaff || []).filter((s: any) => s.role === 'waiter')
                        };

                        adminCacheManager.set(`tables-${restaurantId}`, tablesPayload, {
                            tenantId: restaurantId,
                            isRealtime: true
                        });
                        if (restaurantCode && restaurantCode !== restaurantId) {
                            adminCacheManager.set(`tables-${restaurantCode}`, tablesPayload, {
                                tenantId: restaurantId,
                                isRealtime: true
                            });
                        }

                        // Shared state for Table Areas section
                        adminCacheManager.set(`areas-${restaurantId}`, {
                            areas: allAreas || [],
                            tables: allTables || []
                        }, { tenantId: restaurantId });

                        // Shared state for Live Kitchen (KDS) & Live Orders
                        const kdsPayload = {
                            orders: activeOrders || [],
                            mergeGroups: allMergeGroups || []
                        };
                        adminCacheManager.set(`kds-${restaurantId}`, kdsPayload, {
                            tenantId: restaurantId,
                            isRealtime: true
                        });
                        adminCacheManager.set(`orders-${restaurantId}`, (activeOrders || []).filter((o: any) => o.status !== 'served'), {
                            tenantId: restaurantId,
                            isRealtime: true
                        });

                        return tablesPayload;
                    },
                    { priority: 1 }
                )
            ]);

            // Yield a short micro-slice to browser main thread
            await new Promise(r => setTimeout(r, 60));

            // =========================================================================
            // PRIORITY 2: Core Business Modules (Controlled Background Concurrency)
            // =========================================================================
            requestManager.enqueue(
                `menu-${restaurantId}`,
                async () => {
                    const [cats, items, invItems, invCats] = await Promise.all([
                        MenuService.fetchCategories(restaurantId).catch(() => []),
                        MenuService.fetchMenuItems(restaurantId).catch(() => []),
                        InventoryService.fetchItems(restaurantId).catch(() => []),
                        InventoryService.fetchCategories(restaurantId).catch(() => [])
                    ]);

                    const menuPayload = {
                        categories: cats || [],
                        items: items || [],
                        inventoryItems: invItems || [],
                        inventoryCategories: invCats || [],
                        selectedCategoryId: cats?.[0]?.id || null
                    };

                    adminCacheManager.set(`menu-${restaurantId}`, menuPayload, { tenantId: restaurantId });
                    if (restaurantCode && restaurantCode !== restaurantId) {
                        adminCacheManager.set(`menu-${restaurantCode}`, menuPayload, { tenantId: restaurantId });
                    }

                    // Shared menu data for Today's Specials
                    const existingSpecials = adminCacheManager.get<any>(`specials-${restaurantId}`)?.data;
                    adminCacheManager.set(`specials-${restaurantId}`, {
                        specials: existingSpecials?.specials || [],
                        menuItems: items || [],
                        categories: cats || []
                    }, { tenantId: restaurantId });

                    return menuPayload;
                },
                { priority: 2 }
            );

            // Today Specials List
            requestManager.enqueue(
                `specials-list-${restaurantId}`,
                async () => {
                    const specials = await SpecialsService.fetchAllSpecials(restaurantId).catch(() => []);
                    const current = adminCacheManager.get<any>(`specials-${restaurantId}`)?.data;
                    adminCacheManager.set(`specials-${restaurantId}`, {
                        specials: specials || [],
                        menuItems: current?.menuItems || [],
                        categories: current?.categories || []
                    }, { tenantId: restaurantId });
                    return specials;
                },
                { priority: 2 }
            );

            // Customers Initial Page (Paginated, limit: 15)
            const activeCode = restaurantCode || restaurantId;
            const targetCode = restaurantId || activeCode;
            requestManager.enqueue(
                `customers-${restaurantId}`,
                async () => {
                    const queryParams = new URLSearchParams({
                        page: '1',
                        limit: '15',
                        sortBy: 'last_visit',
                        sortOrder: 'desc'
                    });
                    const res = await fetch(`/api/restaurant/${targetCode}/customers?${queryParams}`);
                    if (res.ok) {
                        const data = await res.json();
                        adminCacheManager.set(`customers-${restaurantId}`, data, { tenantId: restaurantId });
                        if (activeCode && activeCode !== restaurantId) {
                            adminCacheManager.set(`customers-${activeCode}`, data, { tenantId: restaurantId });
                        }
                        return data;
                    }
                    return null;
                },
                { priority: 2 }
            );

            // Order History Initial Page (Paginated, limit: 50)
            requestManager.enqueue(
                `history-${restaurantId}`,
                async () => {
                    const pastOrders = await OrderService.fetchHistoryOrders(restaurantId).catch(() => []);
                    // Bounded to latest 50 orders on startup to keep payload lightweight
                    const bounded = Array.isArray(pastOrders) ? pastOrders.slice(0, 50) : [];
                    adminCacheManager.set(`history-${restaurantId}`, bounded, { tenantId: restaurantId });
                    if (restaurantCode && restaurantCode !== restaurantId) {
                        adminCacheManager.set(`history-${restaurantCode}`, bounded, { tenantId: restaurantId });
                    }
                    return bounded;
                },
                { priority: 2 }
            );

            // Services Section
            requestManager.enqueue(
                `services-${restaurantId}`,
                async () => {
                    const services = await HomepageBuilderService.getServices(restaurantId).catch(() => []);
                    adminCacheManager.set(`services-${restaurantId}`, services, { tenantId: restaurantId });
                    return services;
                },
                { priority: 2 }
            );

            // Inventory Dashboard Stats, Items & Categories
            requestManager.enqueue(
                `inventory-${restaurantId}`,
                async () => {
                    const [stats, items, categories, suppliers] = await Promise.all([
                        InventoryService.fetchDashboardStats(restaurantId).catch(() => null),
                        InventoryService.fetchItems(restaurantId).catch(() => []),
                        InventoryService.fetchCategories(restaurantId).catch(() => []),
                        SupplierService.fetchSuppliers(restaurantId).catch(() => [])
                    ]);
                    const invPayload = {
                        stats: stats || { totalValue: 0, lowStockCount: 0, predictedShortageCount: 0, wastagePercent: 0 },
                        items: items || [],
                        categories: categories || [],
                        suppliers: suppliers || []
                    };
                    adminCacheManager.set(`inventory-${restaurantId}`, invPayload, { tenantId: restaurantId });
                    return invPayload;
                },
                { priority: 2 }
            );

            // =========================================================================
            // PRIORITY 3: Secondary & Configuration Views (Idle Background Queue)
            // =========================================================================
            // Homepage Builder Data
            requestManager.enqueue(
                `homepage-builder-${restaurantId}`,
                async () => {
                    const hpData = await HomepageBuilderService.getHomepageData(restaurantId, '', 'admin').catch(() => null);
                    if (hpData) {
                        adminCacheManager.set(`homepage-builder-${restaurantId}`, hpData, { tenantId: restaurantId });
                        if (restaurantCode && restaurantCode !== restaurantId) {
                            adminCacheManager.set(`homepage-builder-${restaurantCode}`, hpData, { tenantId: restaurantId });
                        }
                    }
                    return hpData;
                },
                { priority: 3 }
            );

            // Analytics Default (7d range)
            requestManager.enqueue(
                `analytics-${restaurantId}-7d`,
                async () => {
                    const [kpis, trends, status, cats, payments, top, slow, log] = await Promise.all([
                        AnalyticsService.fetchKPIMetrics(restaurantId, '7d').catch(() => null),
                        AnalyticsService.fetchRevenueTrends(restaurantId, '7d').catch(() => []),
                        AnalyticsService.fetchOrderStatusBreakdown(restaurantId, '7d').catch(() => []),
                        AnalyticsService.fetchCategoryRevenue(restaurantId, '7d').catch(() => []),
                        AnalyticsService.fetchPaymentMethodSplit(restaurantId, '7d').catch(() => []),
                        AnalyticsService.fetchTopSellingItems(restaurantId, '7d', 10).catch(() => []),
                        AnalyticsService.fetchTopSellingItems(restaurantId, '7d', 10, true).catch(() => []),
                        AnalyticsService.fetchOrderLog(restaurantId, '7d').catch(() => [])
                    ]);
                    const analyticsPayload = {
                        metrics: kpis,
                        revenueTrend: trends,
                        statusBreakdown: status,
                        categoryRevenue: cats,
                        paymentSplit: payments,
                        topDishes: top,
                        slowDishes: slow,
                        orderLog: log
                    };
                    adminCacheManager.set(`analytics-${restaurantId}-7d`, analyticsPayload, { tenantId: restaurantId });
                    if (restaurantCode && restaurantCode !== restaurantId) {
                        adminCacheManager.set(`analytics-${restaurantCode}-7d`, analyticsPayload, { tenantId: restaurantId });
                    }
                    return analyticsPayload;
                },
                { priority: 3 }
            );

            // Restaurant Profile (About)
            requestManager.enqueue(
                `about-${restaurantId}`,
                async () => {
                    const [metaData, infoData] = await Promise.all([
                        RestaurantService.getMetaInfo(restaurantId).catch(() => null),
                        RestaurantService.getRestaurantInfo(restaurantId).catch(() => null)
                    ]);
                    const aboutPayload = { metaInfo: metaData, restaurantInfo: infoData };
                    adminCacheManager.set(`about-${restaurantId}`, aboutPayload, { tenantId: restaurantId });
                    return aboutPayload;
                },
                { priority: 3 }
            );

            // Staff, Branches & Logins
            requestManager.enqueue(
                `staff-${restaurantId}`,
                async () => {
                    const [branches, employees, staff] = await Promise.all([
                        PayrollService.fetchBranches(restaurantId).catch(() => []),
                        PayrollService.fetchEmployees(restaurantId).catch(() => []),
                        StaffService.fetchStaff(restaurantId).catch(() => [])
                    ]);
                    adminCacheManager.set(`employees-${restaurantId}`, { branches, employees }, { tenantId: restaurantId });
                    adminCacheManager.set(`staff-${restaurantId}`, staff || [], { tenantId: restaurantId });
                    return { branches, employees, staff };
                },
                { priority: 3 }
            );

            // Coupons and Offers
            requestManager.enqueue(
                `offers-${restaurantId}`,
                async () => {
                    const offers = await OfferService.fetchOffers(restaurantId).catch(() => []);
                    adminCacheManager.set(`offers-${restaurantId}`, offers || [], { tenantId: restaurantId });
                    return offers;
                },
                { priority: 3 }
            );

            // Restaurant Settings / Registration Details
            requestManager.enqueue(
                `settings-${restaurantId}`,
                async () => {
                    const details = await RegistrationService.getRegistrationDetails(restaurantId).catch(() => null);
                    if (details) {
                        adminCacheManager.set(`settings-${restaurantId}`, details, { tenantId: restaurantId });
                    }
                    return details;
                },
                { priority: 3 }
            );

            // Security Center
            requestManager.enqueue(
                `security-${activeCode}`,
                async () => {
                    const [dashRes, sessRes] = await Promise.allSettled([
                        fetch('/api/auth/security/dashboard'),
                        fetch('/api/auth/sessions')
                    ]);
                    let dashData: any = null;
                    let sessData: any = null;
                    if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
                        dashData = await dashRes.value.json().catch(() => null);
                    }
                    if (sessRes.status === 'fulfilled' && sessRes.value.ok) {
                        sessData = await sessRes.value.json().catch(() => null);
                    }
                    if (dashData || sessData) {
                        const secPayload = {
                            metrics: dashData?.metrics || null,
                            recentAudits: dashData?.recentAudits || [],
                            recentEmails: dashData?.recentEmails || [],
                            securityAlerts: dashData?.securityAlerts || [],
                            sessions: sessData?.sessions || []
                        };
                        adminCacheManager.set(`security-${activeCode}`, secPayload, { tenantId: restaurantId });
                        adminCacheManager.set(`security-${restaurantId}`, secPayload, { tenantId: restaurantId });
                        return secPayload;
                    }
                    return null;
                },
                { priority: 3 }
            );

        } catch (err) {
            console.warn('[AdminPreloadManager] Background prefetch warning:', err);
        } finally {
            this.isPreloading = false;
        }
    }

    /**
     * Invalidate and refetch specific affected sections on mutations.
     */
    public invalidateSection(section: string, restaurantId: string): void {
        switch (section) {
            case 'menu':
                adminCacheManager.invalidate(`menu-${restaurantId}`, restaurantId);
                adminCacheManager.invalidate(`specials-${restaurantId}`, restaurantId);
                adminCacheManager.invalidate(`homepage-builder-${restaurantId}`, restaurantId);
                break;
            case 'tables':
                adminCacheManager.invalidate(`tables-${restaurantId}`, restaurantId);
                adminCacheManager.invalidate(`areas-${restaurantId}`, restaurantId);
                adminCacheManager.invalidate(`kds-${restaurantId}`, restaurantId);
                break;
            case 'orders':
                adminCacheManager.invalidate(`orders-${restaurantId}`, restaurantId);
                adminCacheManager.invalidate(`kds-${restaurantId}`, restaurantId);
                adminCacheManager.invalidate(`history-${restaurantId}`, restaurantId);
                adminCacheManager.invalidate(`dashboard-v2-${restaurantId}`, restaurantId);
                break;
            case 'staff':
                adminCacheManager.invalidate(`staff-${restaurantId}`, restaurantId);
                adminCacheManager.invalidate(`employees-${restaurantId}`, restaurantId);
                break;
            case 'inventory':
                adminCacheManager.invalidate(`inventory-${restaurantId}`, restaurantId);
                adminCacheManager.invalidate(`menu-${restaurantId}`, restaurantId);
                break;
            default:
                adminCacheManager.invalidate(`${section}-${restaurantId}`, restaurantId);
        }
    }
}

export const adminPreloadManager = new AdminPreloadManager();
