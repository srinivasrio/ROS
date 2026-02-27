'use client';

import { createContext, useContext, useState, useEffect } from 'react';

interface CartItem {
    menu_item_id: number;
    name: string;
    price: number;
    quantity: number;
    notes?: string;
    item_type?: string;
    image_url?: string;
}

interface CartContextType {
    cart: Record<number, CartItem>;
    addToCart: (item: any, qty: number, notes?: string) => void;
    updateQuantity: (itemId: number, delta: number) => void;
    updateItemNotes: (itemId: number, notes: string) => void;
    removeFromCart: (itemId: number) => void;
    clearCart: () => void;
    totalItems: number;
    subtotal: number;
    tax: number;
    total: number;
    tableId: string | null;
    setTableId: (id: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [cart, setCart] = useState<Record<number, CartItem>>({});
    const [tableId, setTableId] = useState<string | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const storedCart = localStorage.getItem('customer_cart');
        const storedTableId = localStorage.getItem('customer_table_id');
        if (storedCart) {
            try {
                setCart(JSON.parse(storedCart));
            } catch (e) {
                console.error('Failed to parse cart', e);
            }
        }
        if (storedTableId) {
            setTableId(storedTableId);
        }
        setIsLoaded(true);
    }, []);

    useEffect(() => {
        if (!isLoaded) return;
        localStorage.setItem('customer_cart', JSON.stringify(cart));
        if (tableId) localStorage.setItem('customer_table_id', tableId);
    }, [cart, tableId, isLoaded]);

    const addToCart = (item: any, qty: number, notes?: string) => {
        setCart(prev => {
            const currentQty = prev[item.id]?.quantity || 0;
            const newQty = currentQty + qty;

            if (newQty <= 0) {
                const { [item.id]: _, ...rest } = prev;
                return rest;
            }

            return {
                ...prev,
                [item.id]: {
                    menu_item_id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: newQty,
                    notes: notes || prev[item.id]?.notes || '',
                    item_type: item.item_type,
                    image_url: item.image_url
                }
            };
        });
    };

    const updateQuantity = (itemId: number, delta: number) => {
        setCart(prev => {
            if (!prev[itemId]) return prev;
            const newQty = prev[itemId].quantity + delta;

            if (newQty <= 0) {
                const { [itemId]: _, ...rest } = prev;
                return rest;
            }

            return {
                ...prev,
                [itemId]: { ...prev[itemId], quantity: newQty }
            };
        });
    };

    const updateItemNotes = (itemId: number, notes: string) => {
        setCart(prev => {
            if (!prev[itemId]) return prev;

            return {
                ...prev,
                [itemId]: { ...prev[itemId], notes }
            };
        });
    };

    const removeFromCart = (itemId: number) => {
        setCart(prev => {
            const { [itemId]: _, ...rest } = prev;
            return rest;
        });
    };

    const clearCart = () => setCart({});

    const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = Object.values(cart).reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = Math.round(subtotal * 0.05); // 5% Tax
    const total = subtotal + tax;

    return (
        <CartContext.Provider value={{ cart, addToCart, updateQuantity, updateItemNotes, removeFromCart, clearCart, totalItems, subtotal, tax, total, tableId, setTableId }}>
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
