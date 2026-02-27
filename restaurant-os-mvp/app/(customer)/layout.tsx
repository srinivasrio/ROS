'use client';

import { CartProvider } from './context/CartContext';
import { Toaster } from 'sonner';

import { CustomerBottomNav } from '../components/customer/CustomerBottomNav';
import { StickyCart } from '../components/customer/StickyCart';

export default function CustomerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <CartProvider>
            <div className="min-h-screen bg-gray-50 flex justify-center">
                <div className="w-full max-w-md bg-white shadow-xl min-h-screen relative flex flex-col">
                    {children}
                    <StickyCart />
                    <CustomerBottomNav />
                </div>
            </div>
            <Toaster position="top-center" />
        </CartProvider>
    );
}
