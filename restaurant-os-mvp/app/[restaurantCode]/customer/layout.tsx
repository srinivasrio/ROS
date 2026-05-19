'use client';

import { CartProvider } from '@/app/context/CartContext';
import { Toaster } from 'sonner';

import { CustomerBottomNav } from '@/app/components/customer/CustomerBottomNav';
import { SharedFloatingCart } from '@/app/components/shared/cart/SharedFloatingCart';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { PersistentHome } from '@/app/components/customer/PersistentHome';
import { PersistentMenu } from '@/app/components/customer/PersistentMenu';
import { PersistentService } from '@/app/components/customer/PersistentService';
import { PersistentOrders } from '@/app/components/customer/PersistentOrders';
import { PersistentProfile } from '@/app/components/customer/PersistentProfile';

import { useParams, useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { OrderService } from '@/app/services/orders';

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
    const tableNumber = (params?.tableNumber as string) || '';

    // Define persistent tabs
    const isPersistentTab = pathname.includes('/customer/home/') || 
                          pathname.includes('/customer/menu/') || 
                          pathname.includes('/customer/service/') || 
                          pathname.includes('/customer/myorders/') || 
                          pathname.includes('/customer/profile/');

    return (
        <CartProvider>
            <div className="min-h-screen bg-gray-50 flex justify-center">
                <div className="w-full max-w-md bg-white shadow-xl min-h-screen relative flex flex-col">
                    <div className="flex-1 pb-24">
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
                    <SharedFloatingCart />
                    <CustomerBottomNav />
                </div>
            </div>
            <Toaster position="top-center" />
        </CartProvider>
    );
}
