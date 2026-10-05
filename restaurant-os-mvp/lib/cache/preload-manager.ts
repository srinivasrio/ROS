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
 * P2-07 (FE-03) Optimized Admin Panel Preload Manager
 * 
 * Replaces indiscriminate 34+ eager background queries on initial layout mount with:
 * 1. Viewport-targeted preloading on layout mount (only loads data for the current active route).
 * 2. On-demand / hover-intent prefetching (preloadSection) when user interacts with sidebar navigation.
 * 3. Request deduplication, tenant isolation, and memory-safe caching via adminCacheManager.
 */
class AdminPreloadManager {
    private isPreloading = false;
    private lastPreloadedRestaurantId: string | null = null;
    private lastPreloadTimestamp = 0;
    private readonly PRELOAD_COOLDOWN_MS = 2.5 * 60 * 1000; // 2.5 min cooldown

    /**
     * Start targeted preloading for the given restaurant and current active route.
     * Only loads the dataset corresponding to the visible section, avoiding mass eager storms.
     */
    public async startPreload(restaurantId: string, restaurantCode?: string, currentPath?: string): Promise<void> {
        if (!restaurantId || typeof window === 'undefined') return;

        // Initialize tenant scope in cache manager
        adminCacheManager.setTenant(restaurantId);

        const path = currentPath || (typeof window !== 'undefined' ? window.location.pathname : '');

        // Viewport-aware routing: only preload what is currently needed
        if (path.includes('/admin/orders') || path.includes('/admin/live-kitchen') || path.includes('/admin/tables')) {
            await this.preloadSection('tables', restaurantId, restaurantCode);
        } else if (path.includes('/admin/menu')) {
            await this.preloadSection('menu', restaurantId, restaurantCode);
        } else if (path.includes('/admin/inventory')) {
            await this.preloadSection('inventory', restaurantId, restaurantCode);
        } else if (path.includes('/admin/staff')) {
            await this.preloadSection('staff', restaurantId, restaurantCode);
        } else if (path.includes('/admin/analytics')) {
            await this.preloadSection('analytics', restaurantId, restaurantCode);
        } else if (path.includes('/admin/customers')) {
            await this.preloadSection('customers', restaurantId, restaurantCode);
        } else if (path.includes('/admin/history')) {
            await this.preloadSection('history', restaurantId, restaurantCode);
        } else if (path.includes('/admin/services')) {
            await this.preloadSection('services', restaurantId, restaurantCode);
        } else if (path.includes('/admin/homepage-builder')) {
            await this.preloadSection('homepage-builder', restaurantId, restaurantCode);
        } else if (path.includes('/admin/settings')) {
            await this.preloadSection('settings', restaurantId, restaurantCode);
        } else if (path.includes('/admin/security')) {
            await this.preloadSection('security', restaurantId, restaurantCode);
        } else {
            // Default active view: Dashboard KPIs
            await this.preloadSection('dashboard', restaurantId, restaurantCode);
        }
    }

    /**
     * On-demand / hover-intent section prefetch.
     * Called when a user hovers over a sidebar navigation item or routes to it.
     */
    public async preloadSection(section: string, restaurantId: string, restaurantCode?: string): Promise<any> {
        if (!restaurantId || typeof window === 'undefined') return null;

        const activeCode = restaurantCode || restaurantId;

        switch (section) {
            case 'dashboard': {
                const key = `dashboard-v2-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
                    const [kpis, revenue, status] = await Promise.all([
                        AnalyticsService.fetchKPIMetrics(restaurantId, 'today').catch(() => null),
                        AnalyticsService.fetchRevenueTrends(restaurantId, 'today').catch(() => []),
                        AnalyticsService.fetchOrderStatusBreakdown(restaurantId, 'today').catch(() => [])
                    ]);
                    if (kpis) {
                        const payload = { metrics: kpis, revenueData: revenue, statusData: status, peakData: revenue };
                        adminCacheManager.set(key, payload, { tenantId: restaurantId, staleTimeMs: 45 * 1000, isRealtime: true });
                        if (activeCode && activeCode !== restaurantId) {
                            adminCacheManager.set(`dashboard-v2-${activeCode}`, payload, { tenantId: restaurantId, staleTimeMs: 45 * 1000, isRealtime: true });
                        }
                    }
                    return kpis;
                }, { priority: 1 });
            }

            case 'tables':
            case 'orders':
            case 'live-kitchen': {
                const key = `tables-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
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

                    adminCacheManager.set(key, tablesPayload, { tenantId: restaurantId, isRealtime: true });
                    if (activeCode && activeCode !== restaurantId) {
                        adminCacheManager.set(`tables-${activeCode}`, tablesPayload, { tenantId: restaurantId, isRealtime: true });
                    }

                    adminCacheManager.set(`areas-${restaurantId}`, {
                        areas: allAreas || [],
                        tables: allTables || []
                    }, { tenantId: restaurantId });

                    const kdsPayload = {
                        orders: activeOrders || [],
                        mergeGroups: allMergeGroups || []
                    };
                    adminCacheManager.set(`kds-${restaurantId}`, kdsPayload, { tenantId: restaurantId, isRealtime: true });
                    adminCacheManager.set(`orders-${restaurantId}`, (activeOrders || []).filter((o: any) => o.status !== 'served'), {
                        tenantId: restaurantId,
                        isRealtime: true
                    });

                    return tablesPayload;
                }, { priority: 1 });
            }

            case 'menu': {
                const key = `menu-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
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

                    adminCacheManager.set(key, menuPayload, { tenantId: restaurantId });
                    if (activeCode && activeCode !== restaurantId) {
                        adminCacheManager.set(`menu-${activeCode}`, menuPayload, { tenantId: restaurantId });
                    }

                    return menuPayload;
                }, { priority: 2 });
            }

            case 'specials': {
                const key = `specials-list-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
                    const specials = await SpecialsService.fetchAllSpecials(restaurantId).catch(() => []);
                    const current = adminCacheManager.get<any>(`specials-${restaurantId}`)?.data;
                    adminCacheManager.set(`specials-${restaurantId}`, {
                        specials: specials || [],
                        menuItems: current?.menuItems || [],
                        categories: current?.categories || []
                    }, { tenantId: restaurantId });
                    return specials;
                }, { priority: 2 });
            }

            case 'customers': {
                const key = `customers-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
                    const queryParams = new URLSearchParams({
                        page: '1',
                        limit: '15',
                        sortBy: 'last_visit',
                        sortOrder: 'desc'
                    });
                    const res = await fetch(`/api/restaurant/${activeCode}/customers?${queryParams}`);
                    if (res.ok) {
                        const data = await res.json();
                        adminCacheManager.set(key, data, { tenantId: restaurantId });
                        if (activeCode !== restaurantId) {
                            adminCacheManager.set(`customers-${activeCode}`, data, { tenantId: restaurantId });
                        }
                        return data;
                    }
                    return null;
                }, { priority: 2 });
            }

            case 'history': {
                const key = `history-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
                    const pastOrders = await OrderService.fetchHistoryOrders(restaurantId).catch(() => []);
                    const bounded = Array.isArray(pastOrders) ? pastOrders.slice(0, 50) : [];
                    adminCacheManager.set(key, bounded, { tenantId: restaurantId });
                    if (activeCode !== restaurantId) {
                        adminCacheManager.set(`history-${activeCode}`, bounded, { tenantId: restaurantId });
                    }
                    return bounded;
                }, { priority: 2 });
            }

            case 'services': {
                const key = `services-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
                    const services = await HomepageBuilderService.getServices(restaurantId).catch(() => []);
                    adminCacheManager.set(key, services, { tenantId: restaurantId });
                    return services;
                }, { priority: 2 });
            }

            case 'inventory': {
                const key = `inventory-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
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
                    adminCacheManager.set(key, invPayload, { tenantId: restaurantId });
                    return invPayload;
                }, { priority: 2 });
            }

            case 'homepage-builder': {
                const key = `homepage-builder-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
                    const hpData = await HomepageBuilderService.getHomepageData(restaurantId, '', 'admin').catch(() => null);
                    if (hpData) {
                        adminCacheManager.set(key, hpData, { tenantId: restaurantId });
                        if (activeCode !== restaurantId) {
                            adminCacheManager.set(`homepage-builder-${activeCode}`, hpData, { tenantId: restaurantId });
                        }
                    }
                    return hpData;
                }, { priority: 2 });
            }

            case 'analytics': {
                const key = `analytics-${restaurantId}-7d`;
                return requestManager.enqueue(key, async () => {
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
                    adminCacheManager.set(key, analyticsPayload, { tenantId: restaurantId });
                    if (activeCode !== restaurantId) {
                        adminCacheManager.set(`analytics-${activeCode}-7d`, analyticsPayload, { tenantId: restaurantId });
                    }
                    return analyticsPayload;
                }, { priority: 2 });
            }

            case 'about': {
                const key = `about-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
                    const [metaData, infoData] = await Promise.all([
                        RestaurantService.getMetaInfo(restaurantId).catch(() => null),
                        RestaurantService.getRestaurantInfo(restaurantId).catch(() => null)
                    ]);
                    const aboutPayload = { metaInfo: metaData, restaurantInfo: infoData };
                    adminCacheManager.set(key, aboutPayload, { tenantId: restaurantId });
                    return aboutPayload;
                }, { priority: 3 });
            }

            case 'staff': {
                const key = `staff-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
                    const [branches, employees, staff] = await Promise.all([
                        PayrollService.fetchBranches(restaurantId).catch(() => []),
                        PayrollService.fetchEmployees(restaurantId).catch(() => []),
                        StaffService.fetchStaff(restaurantId).catch(() => [])
                    ]);
                    adminCacheManager.set(`employees-${restaurantId}`, { branches, employees }, { tenantId: restaurantId });
                    adminCacheManager.set(key, staff || [], { tenantId: restaurantId });
                    return { branches, employees, staff };
                }, { priority: 3 });
            }

            case 'offers': {
                const key = `offers-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
                    const offers = await OfferService.fetchOffers(restaurantId).catch(() => []);
                    adminCacheManager.set(key, offers || [], { tenantId: restaurantId });
                    return offers;
                }, { priority: 3 });
            }

            case 'settings': {
                const key = `settings-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
                    const details = await RegistrationService.getRegistrationDetails(restaurantId).catch(() => null);
                    if (details) {
                        adminCacheManager.set(key, details, { tenantId: restaurantId });
                    }
                    return details;
                }, { priority: 3 });
            }

            case 'security': {
                const key = `security-${restaurantId}`;
                return requestManager.enqueue(key, async () => {
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
                        adminCacheManager.set(key, secPayload, { tenantId: restaurantId });
                        return secPayload;
                    }
                    return null;
                }, { priority: 3 });
            }

            default:
                return null;
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
