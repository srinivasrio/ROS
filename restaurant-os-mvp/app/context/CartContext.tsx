'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface CartItem {
    menu_item_id: number | string;
    name: string;
    price: number;
    quantity: number;
    notes?: string;
    item_type?: string;
    image_url?: string;
    isSpecial?: boolean;
    specialId?: string;
    specialItems?: string; // comma-separated item names for display
    specialItemsData?: { menu_item_id: number; quantity: number; price: number; name: string }[]; // raw item data for order creation
    combo_id?: string;
    combo_name?: string;
    combo_image?: string;
    combo_items?: any;
}

interface CartContextType {
    cart: Record<string, CartItem>;
    addToCart: (item: any, qty: number, notes?: string) => void;
    addSpecialToCart: (special: any) => void;
    updateQuantity: (itemId: number | string, delta: number) => void;
    updateItemNotes: (itemId: number | string, notes: string) => void;
    removeFromCart: (itemId: number | string) => void;
    clearCart: () => void;
    totalItems: number;
    subtotal: number;
    tax: number;
    total: number;
    tableNumber: string | null;
    setTableNumber: (id: string) => void;
    getItemQtyInCart: (itemId: number | string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [cart, setCart] = useState<Record<string, CartItem>>({});
    const [tableNumber, setTableNumber] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const storedCart = localStorage.getItem('customer_cart');
        const storedTableNumber = localStorage.getItem('customer_table_number');
        if (storedCart) {
            try {
                setCart(JSON.parse(storedCart));
            } catch (e) {
                console.error('Failed to parse cart', e);
            }
        }
        if (storedTableNumber) {
            setTableNumber(storedTableNumber);
        }
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('customer_cart', JSON.stringify(cart));
        if (tableNumber) localStorage.setItem('customer_table_number', tableNumber);
    }, [cart, tableNumber, isLoaded]);

    const addToCart = (item: any, qty: number, notes?: string) => {
        const key = String(item.id);
        setCart(prev => {
            const currentQty = prev[key]?.quantity || 0;
            const newQty = currentQty + qty;

            if (newQty <= 0) {
                const { [key]: _, ...rest } = prev;
                return rest;
            }

            return {
                ...prev,
                [key]: {
                    menu_item_id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: newQty,
                    notes: notes || prev[key]?.notes || '',
                    item_type: item.item_type,
                    image_url: item.image_url
                }
            };
        });
    };

    /**
     * Add a Today Special / Combo as a single cart entry.
     * Uses the admin-set special_price (or total of items if no override).
     */
    const addSpecialToCart = (special: any) => {
        const key = `special-${special.id}`;

        // Handle legacy string payloads from old chat sessions by falling back to raw_items
        const safeItemsArray = Array.isArray(special.items)
            ? special.items
            : (Array.isArray(special.raw_items) ? special.raw_items : []);

        const totalPrice = safeItemsArray.reduce(
            (s: number, si: any) => s + (si.menu_item?.price || 0) * si.quantity, 0
        );
        const price = special.special_price || totalPrice;
        const itemNames = safeItemsArray
            .map((si: any) => {
                const name = si.menu_item?.name || 'Item';
                return si.quantity > 1 ? `${name} ×${si.quantity}` : name;
            })
            .join(', ');

        // Store raw item data for order creation
        const itemsData = safeItemsArray
            .filter((si: any) => si.menu_item)
            .map((si: any) => ({
                menu_item_id: si.menu_item.id,
                quantity: si.quantity,
                price: si.menu_item.price,
                name: si.menu_item.name
            }));

        setCart(prev => {
            const currentQty = prev[key]?.quantity || 0;
            return {
                ...prev,
                [key]: {
                    menu_item_id: key,
                    name: special.title,
                    price: price,
                    quantity: currentQty + 1,
                    item_type: special.is_combo ? 'combo' : 'special',
                    isSpecial: true,
                    specialId: special.id,
                    specialItems: itemNames,
                    specialItemsData: itemsData,
                    image_url: special.image_url,
                    combo_id: special.is_combo ? special.id : undefined,
                    combo_name: special.is_combo ? special.title : undefined,
                    combo_image: special.is_combo ? special.image_url : undefined,
                    combo_items: special.is_combo ? itemsData : undefined
                }
            };
        });
    };

    const updateQuantity = (itemId: number | string, delta: number) => {
        const key = String(itemId);
        setCart(prev => {
            if (!prev[key]) return prev;
            const newQty = prev[key].quantity + delta;

            if (newQty <= 0) {
                const { [key]: _, ...rest } = prev;
                return rest;
            }

            return {
                ...prev,
                [key]: { ...prev[key], quantity: newQty }
            };
        });
    };

    const updateItemNotes = (itemId: number | string, notes: string) => {
        const key = String(itemId);
        setCart(prev => {
            if (!prev[key]) return prev;

            return {
                ...prev,
                [key]: { ...prev[key], notes }
            };
        });
    };

    const removeFromCart = (itemId: number | string) => {
        const key = String(itemId);
        setCart(prev => {
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    };

    const clearCart = () => setCart({});

    const getItemQtyInCart = (itemId: number | string) => cart[String(itemId)]?.quantity || 0;

    const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = Math.round(subtotal * 0.05); // 5% Tax
    const total = subtotal + tax;

    return (
        <CartContext.Provider value={{ cart, addToCart, addSpecialToCart, updateQuantity, updateItemNotes, removeFromCart, clearCart, totalItems, subtotal, tax, total, tableNumber, setTableNumber, getItemQtyInCart }}>
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};

export const useCartSafe = () => {
    return useContext(CartContext);
};
