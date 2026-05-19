'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCart } from '@/app/context/CartContext';
import { OrderService } from '@/app/services/orders';
import { SpecialsService, TodaySpecial } from '@/app/services/specials.service';
import { ChevronLeft as LucideChevronLeft, Trash2 as LucideTrash2, ChefHat as LucideChefHat, Utensils as LucideUtensils, Flame as LucideFlame, Ticket as LucideTicket, X as LucideX, Check as LucideCheck } from 'lucide-react';
import { OfferService } from '@/app/services/offers';
import { toast } from 'sonner';
import SharedComboCard from '@/app/components/shared/SharedComboCard';
import { MainHeader } from '@/app/components/shared/MainHeader';
import { HomepageBuilderService } from '@/app/services/homepage-builder.service';
import SharedQuantityControl from '@/app/components/shared/SharedQuantityControl';

export default function CustomerCart() {
    const params = useParams();
    const router = useRouter();
    const urlRestaurantId = (params.restaurantCode || params.restaurantId) as string;
    const tableNumber = params.tableNumber as string;
    const { cart, updateQuantity, updateItemNotes, removeFromCart, totalItems, subtotal, tax, total, clearCart, setTableNumber } = useCart();
    const [submitting, setSubmitting] = useState(false);
    const [specials, setSpecials] = useState<TodaySpecial[]>([]);
    const [profile, setProfile] = useState<any>(null);
    const [sectionStyles, setSectionStyles] = useState<any>(null);

    const cartItems = Object.values(cart);

    useEffect(() => {
        const rid = urlRestaurantId || process.env.NEXT_PUBLIC_RESTAURANT_ID || 'd0637b58-8b77-4404-9469-805152865715';
        SpecialsService.fetchActiveSpecials(rid).then(data => setSpecials(data.slice(0, 2)));
        HomepageBuilderService.getProfile(rid).then(data => setProfile(data));
        HomepageBuilderService.getSectionStyles(rid).then(data => setSectionStyles(data));
    }, [urlRestaurantId]);

    const [resolvedTableNumber, setResolvedTableNumber] = useState<string>(tableNumber);

    useEffect(() => {
        if (tableNumber) {
            setTableNumber(tableNumber);
            OrderService.findTableAnywhere(tableNumber, urlRestaurantId).then((data: any) => {
                if (data) {
                    const name = data.display_name || data.table_number;
                    setResolvedTableNumber(name.toLowerCase().includes('table') ? name : `Table ${name}`);
                }
            });
        }
    }, [tableNumber, setTableNumber, urlRestaurantId]);

    const handlePlaceOrder = async () => {
        if (!tableNumber) {
            toast.error('Table session invalid. Please scan QR code again.');
            return;
        }
        if (totalItems === 0) return;

        setSubmitting(true);
        try {
            const orderItems = cartItems.flatMap((item): any[] => {
                // Keep combo grouped instead of expanding
                if (item.isSpecial && item.item_type?.toLowerCase() === 'combo') {
                    return [{
                        menu_item_id: null,
                        quantity: item.quantity,
                        price: item.price,
                        notes: item.notes || '',
                        item_type: 'combo',
                        combo_id: item.combo_id,
                        combo_name: item.combo_name,
                        combo_image: item.combo_image,
                        combo_items: item.combo_items
                    }];
                }

                // For non-combo special items, expand into constituent menu items
                if (item.isSpecial && item.specialItemsData && item.specialItemsData.length > 0) {
                    // Calculate price ratio to distribute the special price proportionally
                    const originalTotal = item.specialItemsData.reduce((s, si) => s + si.price * si.quantity, 0);
                    const priceRatio = originalTotal > 0 ? item.price / originalTotal : 1;

                    return item.specialItemsData.map(si => ({
                        menu_item_id: si.menu_item_id,
                        quantity: si.quantity * item.quantity,
                        price: Math.round(si.price * priceRatio * 100) / 100,
                        notes: `[SPECIAL: ${item.name}]`
                    }));
                }
                // Skip specials without valid item data (stale cart entry)
                if (item.isSpecial) {
                    toast.error(`Please re-add "${item.name}" to cart — it has stale data.`);
                    return [];
                }
                return [{
                    menu_item_id: typeof item.menu_item_id === 'number' ? item.menu_item_id : Number(item.menu_item_id),
                    quantity: item.quantity,
                    price: item.price,
                    notes: item.notes || ''
                }];
            });

            if (orderItems.length === 0) {
                toast.error('No valid items to order. Please re-add specials to cart.');
                setSubmitting(false);
                return;
            }

            // Create Order with 'queued' status (delayed send)
            const order = await OrderService.createOrder(
                tableNumber, orderItems, urlRestaurantId, 'queued'
            );

            if (order) {
                toast.success('Order placed successfully!');
                clearCart();
                router.push(`/${urlRestaurantId}/customer/status/${tableNumber}/${order.id}`);
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
                <div className="size-20 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-black">
                    <LucideUtensils size={32} />
                </div>
                <h2 className="text-xl font-black text-black mb-2">Your Cart is Empty</h2>
                <p className="text-black mb-8">Add some delicious items from the menu!</p>
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
            {/* Main Header */}
            <MainHeader
                profile={profile}
                sectionStyle={sectionStyles?.['header']}
                showSearch={false}
                className="pt-safe-top"
            >
                <div className="flex items-center gap-4 flex-1">
                    <button 
                        onClick={() => router.back()} 
                        className="p-2 -ml-2 hover:bg-black/5 rounded-full transition-colors"
                        style={{ color: 'var(--header-title-color)' }}
                    >
                        <LucideChevronLeft size={24} />
                    </button>
                    <div className="flex flex-col">
                        <h1 
                            className="text-sm font-black leading-tight"
                            style={{ color: 'var(--header-title-color)' }}
                        >
                            Your Order
                        </h1>
                        <span 
                            className="text-[10px] font-black uppercase tracking-wider text-black"
                            style={{ color: 'var(--header-title-color)' }}
                        >
                            {resolvedTableNumber}
                        </span>
                    </div>
                </div>
            </MainHeader>

            {/* Cart Items */}
            <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
                <div className="space-y-3">
                    {cartItems.map((item) => {
                        if (item.isSpecial && item.item_type?.toLowerCase() === 'combo') {
                            return (
                                <SharedComboCard
                                    key={String(item.menu_item_id)}
                                    name={item.name}
                                    image_url={item.combo_image}
                                    price={item.price}
                                    quantity={item.quantity}
                                    items={item.combo_items || item.specialItemsData || []}
                                    notes={item.notes}
                                    onUpdateQuantity={(delta) => updateQuantity(item.menu_item_id, delta)}
                                    onRemove={() => removeFromCart(item.menu_item_id)}
                                    onUpdateNotes={(notes) => updateItemNotes(item.menu_item_id, notes)}
                                />
                            );
                        }

                        return (
                        <div key={String(item.menu_item_id)} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex gap-4">
                            {/* Left Column: Image + Quantity */}
                            <div className="flex flex-col items-center gap-2">
                                <div className="size-16 bg-gray-100 rounded-xl flex-shrink-0 flex items-center justify-center text-xl overflow-hidden relative">
                                    {item.isSpecial ? (
                                        <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                                            <LucideFlame className="text-orange-500" size={24} />
                                        </div>
                                    ) : item.image_url ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span>🍽️</span>
                                    )}
                                </div>
                                <SharedQuantityControl
                                    qty={item.quantity}
                                    onAdd={() => {}} // No add logic needed in cart
                                    onUpdateQuantity={(delta) => updateQuantity(item.menu_item_id, delta)}
                                    colorHex="#ea580c"
                                    buttonStyle="icon"
                                />
                            </div>

                            {/* Right Column: Details + Notes */}
                            <div className="flex-1 flex flex-col justify-between py-0.5">
                                <div>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-black text-sm leading-tight">{item.name}</h3>
                                            {item.isSpecial && item.specialItems && (
                                                <p className="text-[10px] text-black mt-0.5 leading-snug">{item.specialItems}</p>
                                            )}
                                        </div>
                                        <p className="font-bold text-black text-sm">₹{item.price * item.quantity}</p>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <p className="text-xs text-black">{item.isSpecial ? (item.item_type?.toLowerCase() === 'combo' ? '🎁 Combo' : '🔥 Special') : (item.item_type || 'Veg')}</p>
                                        <button
                                            onClick={() => removeFromCart(item.menu_item_id)}
                                            className="text-[10px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1 uppercase tracking-wide"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>

                                {!item.isSpecial && (
                                    <div className="mt-2 relative">
                                        <input
                                            type="text"
                                            value={item.notes || ''}
                                            onChange={(e) => updateItemNotes(item.menu_item_id, e.target.value)}
                                            placeholder="Add cooking instructions..."
                                            className="w-full bg-gray-50 border border-gray-200 rounded-lg py-1.5 pl-7 pr-3 text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all placeholder:text-black"
                                        />
                                        <LucideChefHat size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-black" />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                    })}
                </div>

                {/* Today's Special Upsell */}
                {specials.length > 0 && (
                    <div
                        onClick={() => router.push(`/${urlRestaurantId}/customer/menu/${tableNumber}`)}
                        className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200/50 cursor-pointer hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <LucideFlame className="text-orange-500" size={16} />
                            <span className="text-xs font-bold text-orange-600 uppercase tracking-wider">Today's Special</span>
                        </div>
                        <p className="text-sm font-bold text-black">
                            Add <span className="text-orange-600">{specials[0].title}</span> for just ₹{specials[0].special_price || ((specials[0].items || []).reduce((s, si) => s + (si.menu_item?.price || 0) * si.quantity, 0))}?
                        </p>
                    </div>
                )}

                {/* Bill Details */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
                    <h3 className="font-bold text-sm text-black mb-2">Bill Summary</h3>
                    <div className="flex justify-between text-xs text-black font-medium">
                        <span>Item Total</span>
                        <span>₹{subtotal}</span>
                    </div>
                    <div className="flex justify-between text-xs text-black font-medium">
                        <span>Taxes & Charges (5%)</span>
                        <span>₹{tax}</span>
                    </div>
                    <div className="border-t border-dashed border-gray-200 my-2 pt-2 flex justify-between font-bold text-black">
                        <span>To Pay</span>
                        <span>₹{total}</span>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <div className="fixed bottom-[80px] inset-x-0 mx-auto w-full max-w-md p-4 bg-white border-t border-gray-100 z-30 flex flex-col gap-3">
                <div className="flex justify-center w-full">
                    <button
                        onClick={handlePlaceOrder}
                        disabled={submitting}
                        className={`w-[80%] py-4 ${submitting ? 'bg-gray-400' : 'bg-emerald-600'} text-white font-black rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2 uppercase tracking-wide text-sm`}
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
