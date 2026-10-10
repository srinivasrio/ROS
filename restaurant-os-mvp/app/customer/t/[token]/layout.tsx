'use client';

import React, { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { CartProvider } from '@/context/CartContext';
import { Toaster } from 'sonner';
import { Utensils, AlertCircle } from 'lucide-react';
import { CustomerBottomNav } from '@/components/customer/CustomerBottomNav';
import { SharedFloatingCart } from '@/components/shared/cart/SharedFloatingCart';
import { PersistentHome } from '@/components/customer/PersistentHome';
import { PersistentMenu } from '@/components/customer/PersistentMenu';
import { PersistentService } from '@/components/customer/PersistentService';
import { PersistentOrders } from '@/components/customer/PersistentOrders';
import { PersistentProfile } from '@/components/customer/PersistentProfile';
import CustomerMobileEntry from '@/components/customer/CustomerMobileEntry';
import { CustomerJoinTableScreen } from '@/components/customer/CustomerJoinTableScreen';
import { HostJoinApprovalModal } from '@/components/customer/HostJoinApprovalModal';
import { CustomerConnectedOtherTableScreen } from '@/components/customer/CustomerConnectedOtherTableScreen';
import { CustomerDiningEndedScreen } from '@/components/customer/CustomerDiningEndedScreen';
import { supabase } from '@/lib/supabase';
import { normalizeTableNumber } from '@/lib/utils';

interface TableSessionInfo {
    table_token: string;
    table_number: string;
    table_id: number | string;
    restaurant_id: string;
    restaurant_slug: string;
    restaurant_name: string;
}

export default function CustomerTokenLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const routeParams = useParams();
    const token = (routeParams?.token as string) || '';
    const pathname = usePathname();
    const router = useRouter();

    const [status, setStatus] = useState<'validating' | 'valid' | 'invalid'>('validating');
    const [sessionInfo, setSessionInfo] = useState<TableSessionInfo | null>(null);
    const [isCustomerVerified, setIsCustomerVerified] = useState<boolean | null>(null);
    const [customerMobile, setCustomerMobile] = useState('');
    const [approvalStatus, setApprovalStatus] = useState<'host' | 'approved' | 'pending' | 'rejected' | 'none' | null>(null);
    const [hostInfo, setHostInfo] = useState<{
        sessionId: string;
        hostName: string;
        requestId?: string | null;
    } | null>(null);
    const [otherActiveSession, setOtherActiveSession] = useState<{
        tableNumber: string;
        tableToken?: string | null;
        sessionId?: string;
        homeUrl?: string | null;
        restaurantCode?: string | null;
        isHost?: boolean;
        reasons?: string[];
    } | null>(null);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [isTableCleared, setIsTableCleared] = useState(false);

    // Auto-redirect root token URL to /home
    useEffect(() => {
        if (token && (pathname === `/customer/t/${token}` || pathname === `/customer/t/${token}/`)) {
            router.replace(`/customer/t/${token}/home`);
        }
    }, [pathname, token, router]);

    useEffect(() => {
        if (!token) {
            setStatus('invalid');
            return;
        }

        let isMounted = true;

        async function validate() {
            try {
                const res = await fetch('/api/customer/table-session/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });

                if (!res.ok) {
                    if (isMounted) setStatus('invalid');
                    return;
                }

                const data = await res.json();
                if (data.valid && data.table && isMounted) {
                    const targetRes = data.restaurant.slug || data.restaurant.id;
                    setSessionInfo({
                        table_token: data.table.table_token,
                        table_number: data.table.table_number,
                        table_id: data.table.table_id,
                        restaurant_id: data.restaurant.id,
                        restaurant_slug: targetRes,
                        restaurant_name: data.restaurant.name,
                    });
                    try {
                        sessionStorage.setItem(`ros_session_${token}`, JSON.stringify({
                            restaurant_id: data.restaurant.id,
                            restaurant_slug: targetRes,
                            table_number: data.table.table_number,
                        }));
                    } catch {}
                    
                    let mobile = '';
                    try {
                        const isExplicitlyLoggedOut = typeof window !== 'undefined' && (
                            sessionStorage.getItem('ros_logged_out') === 'true' ||
                            sessionStorage.getItem('ros_logging_out') === 'true'
                        );

                        if (isExplicitlyLoggedOut) {
                            setIsCustomerVerified(false);
                        } else {
                            mobile = localStorage.getItem(`ros_customer_mobile_${targetRes}`) ||
                                     localStorage.getItem(`ros_customer_mobile_${data.restaurant.id}`) ||
                                     localStorage.getItem(`ros_customer_mobile_${data.restaurant.slug}`) || '';
                            const verified = localStorage.getItem(`ros_customer_verified_${targetRes}`) ||
                                             localStorage.getItem(`ros_customer_verified_${data.restaurant.id}`) ||
                                             localStorage.getItem(`ros_customer_verified_${data.restaurant.slug}`);

                            if (mobile && verified) {
                                setCustomerMobile(mobile);
                                setIsCustomerVerified(true);
                            } else {
                                // Check backend session cookie
                                const sessionRes = await fetch(`/api/customer/auth/session?restaurantId=${encodeURIComponent(data.restaurant.id)}`);
                                if (sessionRes.ok) {
                                    const sessionData = await sessionRes.json();
                                    if (sessionData.authenticated && sessionData.customer) {
                                        mobile = sessionData.customer.mobile;
                                        setCustomerMobile(mobile);
                                        localStorage.setItem(`ros_customer_${targetRes}`, sessionData.customer.id);
                                        localStorage.setItem(`ros_customer_mobile_${targetRes}`, sessionData.customer.mobile);
                                        if (sessionData.customer.name) localStorage.setItem(`ros_customer_name_${targetRes}`, sessionData.customer.name);
                                        localStorage.setItem(`ros_customer_verified_${targetRes}`, 'true');
                                        setIsCustomerVerified(true);
                                    } else {
                                        setIsCustomerVerified(false);
                                    }
                                } else {
                                    setIsCustomerVerified(false);
                                }
                            }
                        }
                    } catch {
                        setIsCustomerVerified(false);
                    }

                    // Check or claim active table session
                    if (mobile) {
                        try {
                            const sessRes = await fetch(
                                `/api/customer/table-session/active?restaurantId=${encodeURIComponent(data.restaurant.id)}&tableNumber=${encodeURIComponent(data.table.table_number)}&customerMobile=${encodeURIComponent(mobile)}`
                            );
                            if (sessRes.ok && isMounted) {
                                const sessData = await sessRes.json();
                                if (sessData.customerHasOtherActiveSession && sessData.otherSession) {
                                    setOtherActiveSession({ ...sessData.otherSession, reasons: sessData.reasons || [] });
                                    setApprovalStatus('none');
                                } else if (!sessData.hasActiveSession) {
                                    // Claim session as host
                                    const custName = localStorage.getItem(`ros_customer_name_${targetRes}`) || 'Table Host';
                                    const custId = localStorage.getItem(`ros_customer_${targetRes}`);
                                    const claimRes = await fetch('/api/customer/table-session/active', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            restaurantId: data.restaurant.id,
                                            tableId: data.table.table_id,
                                            tableNumber: data.table.table_number,
                                            tableToken: token,
                                            customerId: custId,
                                            customerName: custName,
                                            customerMobile: mobile,
                                        }),
                                    });
                                    if (claimRes.status === 409) {
                                        const claimData = await claimRes.json();
                                        if (claimData.customerHasOtherActiveSession && claimData.otherSession) {
                                            setOtherActiveSession({ ...claimData.otherSession, reasons: claimData.reasons || [] });
                                            setApprovalStatus('none');
                                        } else {
                                            setApprovalStatus('host');
                                        }
                                    } else if (claimRes.ok) {
                                        const claimData = await claimRes.json();
                                        if (claimData.sessionId && isMounted) {
                                            setCurrentSessionId(claimData.sessionId);
                                        }
                                        setApprovalStatus('host');
                                    } else {
                                        setApprovalStatus('host');
                                    }
                                } else if (sessData.isHost || sessData.approvalStatus === 'approved') {
                                    if (sessData.sessionId && isMounted) {
                                        setCurrentSessionId(sessData.sessionId);
                                    }
                                    setApprovalStatus(sessData.isHost ? 'host' : 'approved');
                                } else {
                                    if (sessData.sessionId && isMounted) {
                                        setCurrentSessionId(sessData.sessionId);
                                    }
                                    setApprovalStatus(sessData.approvalStatus || 'none');
                                    setHostInfo({
                                        sessionId: sessData.sessionId,
                                        hostName: sessData.hostName,
                                        requestId: sessData.requestId,
                                    });
                                }
                            } else if (isMounted) {
                                setApprovalStatus('approved');
                            }
                        } catch (e) {
                            console.warn('[Table Session Check Warning]', e);
                            if (isMounted) setApprovalStatus('approved');
                        }
                    } else if (isMounted) {
                        setApprovalStatus('approved');
                    }

                    setStatus('valid');
                } else if (isMounted) {
                    setStatus('invalid');
                }
            } catch (err) {
                console.error('[CustomerTokenLayout] Validation error:', err);
                if (isMounted) setStatus('invalid');
            }
        }

        validate();

        return () => {
            isMounted = false;
        };
    }, [token]);

    // Real-time listener: Auto-logout and session termination when waiter or admin clears the table
    useEffect(() => {
        if (!sessionInfo?.table_number || !sessionInfo?.restaurant_id) return;

        const tableNum = sessionInfo.table_number;
        const restId = sessionInfo.restaurant_id;

        let isSubscribed = true;

        const handleTableCleared = () => {
            setIsTableCleared(true);
        };

        const verifyAndHandleTableCleared = async () => {
            try {
                let mobile = '';
                try {
                    mobile = customerMobile || (typeof window !== 'undefined' ? (
                        localStorage.getItem(`ros_customer_mobile_${sessionInfo.restaurant_slug}`) ||
                        localStorage.getItem(`ros_customer_mobile_${restId}`) || ''
                    ) : '');
                } catch {}

                const res = await fetch(
                    `/api/customer/table-session/active?restaurantId=${encodeURIComponent(restId)}&tableNumber=${encodeURIComponent(tableNum)}&customerMobile=${encodeURIComponent(mobile)}`
                );
                if (res.ok) {
                    const data = await res.json();
                    if (!isSubscribed) return;
                    // If backend authoritatively confirms active session for this customer, do NOT clear table!
                    if (data.hasActiveSession && (data.isHost || data.isAuthorized || data.approvalStatus === 'approved')) {
                        console.log('[TokenTableCleared Realtime] Server confirms session still active. Ignoring false table cleared event.');
                        return;
                    }
                }
            } catch (err) {
                console.warn('[TokenTableCleared Realtime] Server verification warning:', err);
                return; // Do not clear session on network glitch
            }

            if (!isSubscribed) return;
            handleTableCleared();
        };

        const channelName = `token-table-cleared-${tableNum}-${Date.now()}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'table_active_sessions',
                },
                (payload: any) => {
                    const row = payload.new;
                    if (!row) return;

                    // Multi-tenant isolation: strictly ignore events from other restaurants
                    const rowRest = row.restaurant_id || row.restaurantId;
                    if (rowRest && rowRest !== restId && rowRest !== sessionInfo.restaurant_slug) {
                        return;
                    }

                    // Only react if event is for the CURRENT active session or table
                    const matchesSession = currentSessionId && row.id === currentSessionId;
                    const matchesTable = normalizeTableNumber(row.table_number) === normalizeTableNumber(tableNum);
                    const isTarget = currentSessionId ? matchesSession : matchesTable;

                    if (isTarget && row.is_active === false) {
                        verifyAndHandleTableCleared();
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tables',
                },
                (payload: any) => {
                    const row = payload.new;
                    if (!row) return;

                    // Multi-tenant isolation: strictly ignore events from other restaurants
                    const rowRest = row.restaurant_id || row.restaurantId;
                    if (rowRest && rowRest !== restId && rowRest !== sessionInfo.restaurant_slug) {
                        return;
                    }

                    const matchesTable = normalizeTableNumber(row.table_number) === normalizeTableNumber(tableNum) || String(row.id) === String(tableNum);
                    if (matchesTable && row.status === 'available') {
                        verifyAndHandleTableCleared();
                    }
                }
            )
            .subscribe();

        return () => {
            isSubscribed = false;
            supabase.removeChannel(channel);
        };
    }, [sessionInfo, token, currentSessionId, customerMobile]);

    // Safety fallback: Never keep customer stuck on checking table session indefinitely
    useEffect(() => {
        if (isCustomerVerified === true && approvalStatus === null && !otherActiveSession) {
            const timer = setTimeout(() => {
                setApprovalStatus('approved');
            }, 3500);
            return () => clearTimeout(timer);
        }
    }, [isCustomerVerified, approvalStatus, otherActiveSession]);

    if (status === 'validating') {
        return (
            <div className="fixed inset-0 h-[100dvh] bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-4" />
                    <p className="text-sm font-semibold text-slate-600">Connecting to secure table session...</p>
                </div>
            </div>
        );
    }

    if (status === 'invalid' || !sessionInfo) {
        return (
            <div className="fixed inset-0 h-[100dvh] bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
                <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 text-center flex flex-col items-center animate-in zoom-in-95 duration-200">
                    <div className="w-20 h-20 bg-rose-50 border border-rose-100 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-rose-500/10">
                        <Utensils className="text-rose-500" size={36} />
                    </div>
                    
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-bold uppercase tracking-wider mb-4">
                        <AlertCircle size={14} />
                        <span>Invalid Table QR</span>
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                        Table Token Not Found
                    </h2>
                    
                    <p className="text-slate-500 text-sm mb-8 leading-relaxed max-w-xs">
                        This table link is invalid or has expired. Please rescan the physical QR code placed on your dining table.
                    </p>
                    
                    <button 
                        onClick={() => router.push('/customer')}
                        className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20 text-sm cursor-pointer"
                    >
                        Scan New QR Code
                    </button>
                </div>
            </div>
        );
    }

    const { restaurant_slug, restaurant_id, table_number } = sessionInfo;
    const isPersistentTab = pathname.includes('/home') || 
                          pathname.includes('/menu') || 
                          pathname.includes('/service') || 
                          pathname.includes('/myorders') || 
                          pathname.includes('/profile');

    if (isCustomerVerified === false) {
        return (
            <CustomerMobileEntry
                restaurantCode={restaurant_slug || restaurant_id}
                initialTable={table_number || token}
                initialTableToken={token}
                canonicalRestaurantId={restaurant_id}
            />
        );
    }

    // Customer is already connected to another table in this restaurant
    if (otherActiveSession) {
        return (
            <CustomerConnectedOtherTableScreen
                restaurantCode={otherActiveSession.restaurantCode || restaurant_slug || restaurant_id}
                currentTableNumber={table_number}
                activeTableNumber={otherActiveSession.tableNumber}
                activeTableToken={otherActiveSession.tableToken || undefined}
                activeSessionId={otherActiveSession.sessionId}
                activeHomeUrl={otherActiveSession.homeUrl || undefined}
                isHost={otherActiveSession.isHost}
                customerMobile={customerMobile}
                reasons={otherActiveSession.reasons}
            />
        );
    }
 
    if (isCustomerVerified === true && approvalStatus === null) {
        return (
            <div className="fixed inset-0 h-[100dvh] bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
                <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mb-4" />
                    <p className="text-sm font-semibold text-slate-600">Connecting to table dining session...</p>
                </div>
            </div>
        );
    }

    // Secondary guest waiting for host approval
    if (approvalStatus && approvalStatus !== 'host' && approvalStatus !== 'approved' && hostInfo) {
        const guestName = (typeof window !== 'undefined' ? (localStorage.getItem(`ros_customer_name_${restaurant_slug}`) || localStorage.getItem(`ros_customer_name_${restaurant_id}`)) : '') || 'Guest';
        return (
            <CustomerJoinTableScreen
                restaurantId={restaurant_id}
                tableNumber={table_number}
                customerName={guestName}
                customerMobile={customerMobile}
                sessionId={hostInfo.sessionId}
                hostName={hostInfo.hostName}
                participantCount={(hostInfo as any).participantCount || 1}
                initialRequestId={hostInfo.requestId}
                initialStatus={approvalStatus}
                onApproved={() => setApprovalStatus('approved')}
            />
        );
    }

    // Realtime: Table has been cleared by waiter or admin
    if (isTableCleared) {
        return (
            <CustomerDiningEndedScreen
                restaurantCode={restaurant_slug || restaurant_id}
                tableNumber={table_number}
                onAcknowledge={() => {
                    try {
                        if (typeof window !== 'undefined') {
                            sessionStorage.setItem('ros_logged_out', 'true');
                            sessionStorage.removeItem(`ros_session_${token}`);
                            localStorage.removeItem('customer_cart');
                            localStorage.removeItem('customer_table_number');
                        }
                    } catch {}
                    setIsTableCleared(false);
                    router.push(`/${restaurant_slug || restaurant_id}/customer`);
                }}
            />
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
                    <div id="customer-scroll-container" className="flex-1 min-h-0 pb-24 overflow-y-auto no-scrollbar overscroll-contain">
                        {/* Persistent Tabs mounted with bound restaurant and table */}
                        <PersistentHome restaurantId={restaurant_slug || restaurant_id} tableNumber={table_number} />
                        <PersistentMenu restaurantId={restaurant_slug || restaurant_id} tableNumber={table_number} />
                        <PersistentService restaurantId={restaurant_slug || restaurant_id} tableNumber={table_number} />
                        <PersistentOrders restaurantId={restaurant_slug || restaurant_id} tableNumber={table_number} />
                        <PersistentProfile restaurantId={restaurant_slug || restaurant_id} tableNumber={table_number} />
                        
                        {!isPersistentTab && children}
                    </div>

                    <SharedFloatingCart restaurantCode={restaurant_slug || restaurant_id} tableNumber={table_number} />
                    <CustomerBottomNav restaurantCode={restaurant_slug || restaurant_id} tableNumber={table_number} />
                </div>
            </div>

            {/* Realtime join request approval for table host */}
            <HostJoinApprovalModal restaurantId={restaurant_id} restaurantSlug={restaurant_slug} tableNumber={table_number} />

            <Toaster position="top-center" />
        </CartProvider>
    );
}
