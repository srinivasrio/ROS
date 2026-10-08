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
                    setSessionInfo({
                        table_token: data.table.table_token,
                        table_number: data.table.table_number,
                        table_id: data.table.table_id,
                        restaurant_id: data.restaurant.id,
                        restaurant_slug: data.restaurant.slug || data.restaurant.id,
                        restaurant_name: data.restaurant.name,
                    });
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

    const [isCustomerVerified, setIsCustomerVerified] = useState<boolean | null>(null);

    useEffect(() => {
        if (!sessionInfo) return;
        const targetRes = restaurant_slug || restaurant_id;
        try {
            const hasMobile = localStorage.getItem(`ros_customer_mobile_${targetRes}`);
            const verified = localStorage.getItem(`ros_customer_verified_${targetRes}`);
            setIsCustomerVerified(Boolean(hasMobile && verified));
        } catch {
            setIsCustomerVerified(true);
        }
    }, [sessionInfo, restaurant_slug, restaurant_id]);

    if (isCustomerVerified === false) {
        return (
            <CustomerMobileEntry
                restaurantCode={restaurant_slug || restaurant_id}
                initialTable={token}
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
            <Toaster position="top-center" />
        </CartProvider>
    );
}
