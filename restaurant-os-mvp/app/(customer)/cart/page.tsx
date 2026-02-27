'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../context/CartContext';
import { OrderService } from '@/app/services/orders';
import { LucideChevronLeft, LucideTrash2, LucideChefHat, LucideUtensils } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerCart() {
    const router = useRouter();
    const { cart, updateQuantity, updateItemNotes, removeFromCart, totalItems, subtotal, tax, total, tableId, clearCart } = useCart();
    const [submitting, setSubmitting] = useState(false);

    const cartItems = Object.values(cart);

    const handlePlaceOrder = async () => {
        if (!tableId) {
            toast.error('Table session invalid. Please scan QR code again.');
            return;
        }
        if (totalItems === 0) return;

        setSubmitting(true);
        try {
            const orderItems = cartItems.map(item => ({
                menu_item_id: item.menu_item_id,
                quantity: item.quantity,
                price: item.price,
                notes: item.notes || ''
            }));

            // Create Order with 'queued' status (delayed send)
            const parsedTableId = typeof tableId === 'string' && isNaN(Number(tableId)) ? tableId : Number(tableId);
            const order = await OrderService.createOrder(parsedTableId, orderItems, 'queued');

            if (order) {
                toast.success('Order placed successfully!');
                clearCart();
                router.push(`/status/${order.id}`);
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to place order. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (totalItems === 0) {
        return (
            <div className="flex flex-col h-screen bg-gray-50 items-center justify-center p-6 text-center">
                <div className="size-20 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-gray-400">
                    <LucideUtensils size={32} />
                </div>
                <h2 className="text-xl font-black text-neutral-900 mb-2">Your Cart is Empty</h2>
                <p className="text-neutral-500 mb-8">Add some delicious items from the menu!</p>
                <button
                    onClick={() => router.back()}
                    className="px-8 py-3 bg-neutral-900 text-white font-bold rounded-xl hover:bg-black transition-colors"
                >
                    Browse Menu
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white p-4 items-center flex gap-4 border-b border-gray-100 sticky top-0 z-20">
                <button onClick={() => router.back()} className="p-2 -ml-2 text-neutral-600 hover:bg-neutral-100 rounded-full transition-colors">
                    <LucideChevronLeft size={24} />
                </button>
                <h1 className="text-lg font-black text-neutral-900">Your Order</h1>
            </header>

            {/* Cart Items */}
            <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 divide-y divide-gray-50">
                    {cartItems.map((item) => (
                        <div key={item.menu_item_id} className="py-3 first:pt-0 last:pb-0 flex gap-4">
                            {/* Left Column: Image + Quantity */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="size-16 bg-gray-100 rounded-xl flex-shrink-0 flex items-center justify-center text-xl overflow-hidden relative">
                                    {item.image_url ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span>🍽️</span>
                                    )}
                                </div>
                                <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm">
                                    <button
                                        onClick={() => updateQuantity(item.menu_item_id, -1)}
                                        className="w-6 h-6 flex items-center justify-center text-neutral-600 hover:bg-gray-50 rounded-l-lg transition-all"
                                    >
                                        -
                                    </button>
                                    <span className="w-6 text-center font-bold text-xs text-neutral-900">{item.quantity}</span>
                                    <button
                                        onClick={() => updateQuantity(item.menu_item_id, 1)}
                                        className="w-6 h-6 flex items-center justify-center text-neutral-600 hover:bg-gray-50 rounded-r-lg transition-all"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Right Column: Details + Notes */}
                            <div className="flex-1 flex flex-col justify-between py-0.5">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-neutral-900 text-sm leading-tight">{item.name}</h3>
                                        <p className="font-bold text-neutral-900 text-sm">₹{item.price * item.quantity}</p>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <p className="text-xs text-neutral-400">{item.item_type || 'Veg'}</p>
                                        <button
                                            onClick={() => removeFromCart(item.menu_item_id)}
                                            className="text-[10px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1 uppercase tracking-wide"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-2 relative">
                                    <input
                                        type="text"
                                        value={item.notes || ''}
                                        onChange={(e) => updateItemNotes(item.menu_item_id, e.target.value)}
                                        placeholder="Add cooking instructions..."
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 pl-7 pr-3 text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all placeholder:text-gray-400"
                                    />
                                    <LucideChefHat size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bill Details */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
                    <h3 className="font-bold text-sm text-neutral-900 mb-2">Bill Summary</h3>
                    <div className="flex justify-between text-xs text-neutral-500 font-medium">
                        <span>Item Total</span>
                        <span>₹{subtotal}</span>
                    </div>
                    <div className="flex justify-between text-xs text-neutral-500 font-medium">
                        <span>Taxes & Charges (5%)</span>
                        <span>₹{tax}</span>
                    </div>
                    <div className="border-t border-dashed border-gray-200 my-2 pt-2 flex justify-between font-bold text-neutral-900">
                        <span>To Pay</span>
                        <span>₹{total}</span>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-30 flex flex-col gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <div className="flex justify-center max-w-md mx-auto w-full">
                    <button
                        onClick={handlePlaceOrder}
                        disabled={submitting}
                        className={`w-full py-4 ${submitting ? 'bg-gray-400' : 'bg-orange-500'} text-white font-black rounded-xl shadow-xl shadow-orange-200 active:scale-95 transition-transform flex items-center justify-center gap-2 uppercase tracking-wide text-sm`}
                    >
                        {submitting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                Placing Order...
                            </>
                        ) : (
                            <>
                                Place Order
                                <span className="bg-white/20 px-2 py-0.5 rounded text-xs">₹{total}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
