'use client';

import { CartProvider } from '@/context/CartContext';
import { Toaster } from 'sonner';

import { CustomerBottomNav } from '@/components/customer/CustomerBottomNav';
import { SharedFloatingCart } from '@/components/shared/cart/SharedFloatingCart';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { PersistentHome } from '@/components/customer/PersistentHome';
import { PersistentMenu } from '@/components/customer/PersistentMenu';
import { PersistentService } from '@/components/customer/PersistentService';
import { PersistentOrders } from '@/components/customer/PersistentOrders';
import { PersistentProfile } from '@/components/customer/PersistentProfile';
import { HostJoinApprovalModal } from '@/components/customer/HostJoinApprovalModal';

import { useParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { OrderService } from '@/services/orders.service';
import { Utensils as LucideUtensils, AlertCircle as LucideAlertCircle } from 'lucide-react';

// In-memory cache for validated tables: key = `${restaurantCode}:${tableNumber}` => boolean
const tableValidityCache = new Map<string, boolean>();

export default function CustomerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { restaurantId } = useRestaurantId();
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();

    const restaurantCode = (params?.restaurantCode as string) || '';
    
    // Safely extract and validate tableNumber from params or pathname fallback
    let rawTable = (params?.tableNumber as string) || '';
    if (!rawTable || rawTable === '{}' || rawTable === 'undefined' || rawTable === '[object Object]') {
        const match = pathname.match(/\/customer\/(?:home|menu|service|services|myorders|profile|combos|offers|popular|specials|welcome|cart|status|table)\/([^/?#]+)/i);
        if (match && match[1]) {
            rawTable = decodeURIComponent(match[1]);
        }
    }

    const isCleanTable = Boolean(
        rawTable &&
        rawTable !== '{}' &&
        rawTable !== 'undefined' &&
        rawTable !== 'null' &&
        rawTable !== '[object Object]' &&
        rawTable !== 'NaN'
    );
    const tableNumber = isCleanTable ? rawTable : '';
    const isVirtualMode = tableNumber === 'takeaway' || tableNumber === 'delivery';

    const [tableStatus, setTableStatus] = useState<'checking' | 'valid' | 'invalid'>(() => {
        if (!isCleanTable || !tableNumber || isVirtualMode) return 'valid';
        const cacheKey1 = `${restaurantCode}:${tableNumber}`;
        const cacheKey2 = restaurantId ? `${restaurantId}:${tableNumber}` : '';
        const cached = tableValidityCache.get(cacheKey1) ?? (cacheKey2 ? tableValidityCache.get(cacheKey2) : undefined);
        if (cached !== undefined) return cached ? 'valid' : 'invalid';
        return 'checking';
    });

    useEffect(() => {
        if (!isCleanTable || !tableNumber || isVirtualMode) {
            setTableStatus('valid');
            return;
        }

        const effectiveRestId = restaurantCode || restaurantId;
        if (!effectiveRestId) return;

        const cacheKey1 = `${restaurantCode}:${tableNumber}`;
        const cacheKey2 = restaurantId ? `${restaurantId}:${tableNumber}` : '';
        const cached = tableValidityCache.get(cacheKey1) ?? (cacheKey2 ? tableValidityCache.get(cacheKey2) : undefined);
        if (cached !== undefined) {
            setTableStatus(cached ? 'valid' : 'invalid');
            return;
        }

        let isMounted = true;
        const verifyTable = async () => {
            try {
                const tableData = await OrderService.verifyTableExists(effectiveRestId, tableNumber);
                const isValid = Boolean(tableData);
                tableValidityCache.set(cacheKey1, isValid);
                if (restaurantId) tableValidityCache.set(`${restaurantId}:${tableNumber}`, isValid);
                if (tableData?.restaurant_id) tableValidityCache.set(`${tableData.restaurant_id}:${tableNumber}`, isValid);
                if (isMounted) {
                    setTableStatus(isValid ? 'valid' : 'invalid');
                }
            } catch (err) {
                console.error('Failed to verify table:', err);
                if (isMounted) {
                    setTableStatus('invalid');
                }
            }
        };

        verifyTable();

        return () => {
            isMounted = false;
        };
    }, [restaurantCode, restaurantId, tableNumber, isCleanTable, isVirtualMode]);

    useEffect(() => {
        if (tableStatus !== 'valid' || isVirtualMode) return;
        const trackPresence = async () => {
            if (restaurantId && isCleanTable && !isVirtualMode) {
                try {
                    await OrderService.holdTable(tableNumber, restaurantId);
                } catch (err) {
                    console.error('Failed to hold table:', err);
                }
            }
        };
        trackPresence();

        // Tab closing should NEVER release table holds or terminate dining sessions
    }, [restaurantId, tableNumber, isCleanTable, tableStatus, isVirtualMode]);

    // Route classifications
    const isCustomerEntryPage = pathname === `/${restaurantCode}/customer` || 
                               pathname === `/${restaurantCode}/customer/` ||
                               pathname.endsWith('/customer') || 
                               pathname.endsWith('/customer/');

    const isOrderTypePage = pathname.includes('/customer/order-type');
    const isWelcomePage = pathname.includes('/customer/welcome/');
    const isTableRedirectPage = pathname.includes('/customer/table/');
    const isOrderStatusPage = pathname.includes('/customer/status/');

    // Define persistent tabs
    const isPersistentTab = pathname.includes('/customer/home/') || 
                          pathname.includes('/customer/menu/') || 
                          pathname.includes('/customer/service/') || 
                          pathname.includes('/customer/myorders/') || 
                          pathname.includes('/customer/profile/');

    const isMenuTab = pathname.includes('/customer/menu/');

    // Check whether the customer needs to be prompted for their details
    const [needsCustomerInfo, setNeedsCustomerInfo] = useState<boolean | null>(null);

    useEffect(() => {
        // Exempt pages that should never trigger mobile entry redirect
        if (isCustomerEntryPage || isWelcomePage || isTableRedirectPage || isOrderStatusPage || isOrderTypePage) {
            setNeedsCustomerInfo(false);
            return;
        }

        // If a physical table was specified and is invalid, don't redirect — let the invalid table UI render
        if (isCleanTable && !isVirtualMode && tableStatus === 'invalid') {
            setNeedsCustomerInfo(false);
            return;
        }

        try {
            const hasMobile = localStorage.getItem(`ros_customer_mobile_${restaurantCode}`);
            const isVerified = localStorage.getItem(`ros_customer_verified_${restaurantCode}`);

            if (!hasMobile || !isVerified) {
                setNeedsCustomerInfo(true);
                const tableQuery = isCleanTable && !isVirtualMode ? `?table=${encodeURIComponent(tableNumber)}` : '';
                router.replace(`/${restaurantCode}/customer${tableQuery}`);
            } else {
                setNeedsCustomerInfo(false);
            }
        } catch {
            setNeedsCustomerInfo(false);
        }
    }, [isCleanTable, tableNumber, tableStatus, isWelcomePage, isTableRedirectPage, isOrderStatusPage, isOrderTypePage, isCustomerEntryPage, restaurantCode, pathname, router, isVirtualMode]);

    // For the mobile entry screen and order-type selection, render directly without constraining tablet shell
    if (isCustomerEntryPage || isOrderTypePage) {
        return (
            <CartProvider>
                {children}
                <Toaster position="top-center" />
            </CartProvider>
        );
    }

    if (needsCustomerInfo) {
        return (
            <div className="fixed inset-0 h-[100dvh] bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-4" />
                    <p className="text-sm font-semibold text-slate-600">Connecting to your dining experience...</p>
                </div>
            </div>
        );
    }

    if (isCleanTable && !isVirtualMode && tableStatus === 'checking') {
        const isLoggingOut = typeof window !== 'undefined' && (sessionStorage.getItem('ros_logging_out') === 'true' || window.location.search.includes('logout=true'));
        return (
            <div className="fixed inset-0 h-[100dvh] bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-4" />
                    <p className="text-sm font-semibold text-slate-600">{isLoggingOut ? 'Logging out...' : 'Connecting to your table...'}</p>
                </div>
            </div>
        );
    }

    if (isCleanTable && !isVirtualMode && tableStatus === 'invalid') {
        return (
            <div className="fixed inset-0 h-[100dvh] bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
                <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 text-center flex flex-col items-center">
                    <div className="w-20 h-20 bg-rose-50 border border-rose-100 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-rose-500/10">
                        <LucideUtensils className="text-rose-500" size={36} />
                    </div>
                    
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-bold uppercase tracking-wider mb-4">
                        <LucideAlertCircle size={14} />
                        <span>Table Not Found</span>
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                        No table named &ldquo;{tableNumber}&rdquo; in this restaurant
                    </h2>
                    
                    <p className="text-slate-500 text-sm mb-8 leading-relaxed max-w-xs">
                        Table <span className="font-bold text-slate-800">{tableNumber}</span> does not exist or has not been created by the restaurant admin. Customers can only view the menu and place orders from valid, admin-created tables.
                    </p>
                    
                    <div className="flex flex-col gap-2.5 w-full">
                        <button 
                            onClick={() => {
                                tableValidityCache.clear();
                                setTableStatus('checking');
                            }}
                            className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20 text-sm cursor-pointer"
                        >
                            Try Again
                        </button>
                        <button 
                            onClick={() => {
                                if (typeof window !== 'undefined' && window.history.length > 1) {
                                    window.history.back();
                                } else {
                                    window.location.href = `/${restaurantCode}/customer`;
                                }
                            }}
                            className="w-full py-3.5 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all active:scale-[0.98] text-sm cursor-pointer"
                        >
                            Go Back
                        </button>
                    </div>
                    
                    <p className="text-[11px] text-slate-400 mt-6">
                        Please scan the QR code placed physically on your table.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <CartProvider>
            <div className="fixed inset-0 h-[100dvh] md:h-screen flex items-start justify-center p-0 md:py-6 overflow-hidden font-sans text-slate-800 overscroll-none" style={{ backgroundColor: '#EEF2F6' }}>
                <div
                    className="w-full max-w-6xl md:rounded-3xl h-full md:h-[92vh] relative flex flex-col overflow-hidden"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '8px 8px 24px rgba(166, 180, 200, 0.45), -8px -8px 24px rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.85)',
                    }}
                >
                    <div id="customer-scroll-container" className={`flex-1 min-h-0 ${isWelcomePage ? 'overflow-y-auto no-scrollbar' : isMenuTab ? 'overflow-hidden flex flex-col h-full' : 'pb-24 overflow-y-auto no-scrollbar overscroll-contain'}`}>
                        {/* Persistent Tabs - Always mounted, visibility controlled by pathname inside each */}
                        {restaurantCode && tableNumber && (
                            <>
                                <PersistentHome restaurantId={restaurantCode} tableNumber={tableNumber} />
                                <PersistentMenu restaurantId={restaurantCode} tableNumber={tableNumber} />
                                <PersistentService restaurantId={restaurantCode} tableNumber={tableNumber} />
                                <PersistentOrders restaurantId={restaurantCode} tableNumber={tableNumber} />
                                <PersistentProfile restaurantId={restaurantCode} tableNumber={tableNumber} />
                            </>
                        )}
                        
                        {/* Only show standard children if NOT on a persistent tab */}
                        {!isPersistentTab && children}
                    </div>
                    {!isWelcomePage && <SharedFloatingCart restaurantCode={restaurantCode} tableNumber={tableNumber || ''} />}
                    {!isWelcomePage && Boolean(tableNumber) && <CustomerBottomNav restaurantCode={restaurantCode} tableNumber={tableNumber} />}
                </div>
            </div>
            {tableNumber && (
                <HostJoinApprovalModal
                    restaurantId={restaurantId || restaurantCode}
                    restaurantSlug={restaurantCode}
                    tableNumber={tableNumber}
                />
            )}
            <Toaster position="top-center" />
        </CartProvider>
    );
}
