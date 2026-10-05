'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCategoryMenuItemImage } from '@/lib/utils';

export interface CartItem {
    menu_item_id: number | string;
    name: string;
    price: number;
    original_price?: number;
    quantity: number;
    notes?: string;
    item_type?: string;
    image_url?: string;
    description?: string;
    portion?: string;
    badge?: string;
    isSpecial?: boolean;
    specialId?: string;
    specialItems?: string; // comma-separated item names for display
    specialItemsData?: { 
        menu_item_id: number | string; 
        quantity: number; 
        price: number; 
        name: string;
        image_url?: string;
        item_type?: string;
        portion?: string;
        description?: string;
    }[]; // raw item data for order creation
    combo_id?: string;
    combo_name?: string;
    combo_image?: string;
    combo_items?: any;
    is_combo?: boolean;
    special_type?: string;
    is_today_special?: boolean;
    special_price?: number | null;
    special_expiry_datetime?: string | null;
    tax_percent?: number;
    gst_percentage?: number;
    cgst_percentage?: number;
    sgst_percentage?: number;
}

export const isSpecialActive = (item: { is_today_special?: boolean; special_price?: number | null; special_expiry_datetime?: string | null }): boolean => {
    return !!(
        item.is_today_special &&
        item.special_price !== null &&
        item.special_price !== undefined &&
        (!item.special_expiry_datetime || new Date(item.special_expiry_datetime) > new Date())
    );
};

export const getActivePrice = (item: { price: number; is_today_special?: boolean; special_price?: number | null; special_expiry_datetime?: string | null }): number => {
    return isSpecialActive(item) ? item.special_price! : item.price;
};

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
    cgst: number;
    sgst: number;
    total: number;
    tableNumber: string | null;
    setTableNumber: (id: string) => void;
    getItemQtyInCart: (itemId: number | string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [cart, setCart] = useState<Record<string, CartItem>>({});
    const [isLoaded, setIsLoaded] = useState(false);
    const [tableNumber, setTableNumberState] = useState<string | null>(null);

    const setTableNumber = useCallback((newTable: string | null) => {
        setTableNumberState(prev => {
            if (prev && newTable && prev !== newTable) {
                // Table switched! Wipe previous table's cart to prevent cross-table order leakage.
                setCart({});
                try {
                    localStorage.removeItem('customer_cart');
                } catch {}
            }
            return newTable;
        });
    }, []);

    // Load cart from localStorage on mount
    useEffect(() => {
        try {
            const savedTable = localStorage.getItem('customer_table_number');
            if (savedTable) {
                setTableNumberState(savedTable);
            }
            const savedCart = localStorage.getItem('customer_cart');
            if (savedCart) {
                setCart(JSON.parse(savedCart));
            }
        } catch (e) {
            console.error('Failed to parse cart from localStorage:', e);
        } finally {
            setIsLoaded(true);
        }
    }, []);

    // Sync to localStorage
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

            const resolvedImage = item.image_url || item.imageUrl || item.image || item.combo_image || (item.menu_item?.image_url) || (item.name ? getCategoryMenuItemImage(item.name) : undefined);

            return {
                ...prev,
                [key]: {
                    menu_item_id: item.id,
                    name: item.name,
                    price: item.price,
                    original_price: Number(item.original_price || item.originalPrice) || undefined,
                    quantity: newQty,
                    notes: notes || prev[key]?.notes || '',
                    item_type: item.item_type,
                    description: item.description || prev[key]?.description,
                    portion: item.portion || prev[key]?.portion,
                    image_url: resolvedImage,
                    is_today_special: item.is_today_special,
                    special_price: item.special_price,
                    special_expiry_datetime: item.special_expiry_datetime,
                    tax_percent: item.tax_percent ?? item.gst_percentage ?? 5,
                    gst_percentage: item.gst_percentage ?? item.tax_percent ?? 5,
                    cgst_percentage: item.cgst_percentage ?? ((item.gst_percentage ?? item.tax_percent ?? 5) / 2),
                    sgst_percentage: item.sgst_percentage ?? ((item.gst_percentage ?? item.tax_percent ?? 5) / 2)
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

        // Handle legacy string payloads from old chat sessions by falling back to raw_items, combo_items, or specialItemsData
        const safeItemsArray = Array.isArray(special.items)
            ? special.items
            : (Array.isArray(special.raw_items)
                ? special.raw_items
                : (Array.isArray(special.combo_items)
                    ? special.combo_items
                    : (Array.isArray(special.specialItemsData) ? special.specialItemsData : [])));

        const totalPrice = safeItemsArray.reduce(
            (s: number, si: any) => s + (si.menu_item?.price || si.price || 0) * (si.quantity || 1), 0
        );
        // Combo objects from HomepageBuilderService have discounted price in `price` field,
        // while raw specials use `special_price`. Check both, preferring the explicit special_price.
        const price = special.special_price ?? special.price ?? totalPrice;
        const itemNames = safeItemsArray
            .map((si: any) => {
                const name = si.menu_item?.name || si.name || si.title || 'Item';
                const qty = si.quantity || 1;
                return qty > 1 ? `${name} ×${qty}` : name;
            })
            .join(', ');

        // Store raw item data for order creation
        const itemsData = safeItemsArray
            .filter((si: any) => si.menu_item || si.name || si.title)
            .map((si: any) => {
                const subName = si.menu_item?.name || si.name || si.title || 'Item';
                return {
                    menu_item_id: si.menu_item?.id || si.id || 0,
                    quantity: si.quantity || 1,
                    price: si.menu_item?.price || si.price || 0,
                    name: subName,
                    image_url: si.menu_item?.image_url || si.image_url || getCategoryMenuItemImage(subName),
                    item_type: si.menu_item?.item_type || si.item_type || 'Veg',
                    portion: si.menu_item?.portion || si.portion,
                    description: si.menu_item?.description || si.description
                };
            });

        const title = special.title || special.name || 'Special Item';
        const resolvedImage = special.image_url || special.imageUrl || special.image || special.combo_image || (safeItemsArray[0]?.menu_item?.image_url) || getCategoryMenuItemImage(title);

        const isCombo = Boolean(
            special.is_combo || 
            special.special_type === 'combo' || 
            special.item_type === 'combo' || 
            special.itemType === 'combo' ||
            special.type === 'combo'
        );

        setCart(prev => {
            const currentQty = prev[key]?.quantity || 0;
            return {
                ...prev,
                [key]: {
                    menu_item_id: key,
                    name: title,
                    price: price,
                    original_price: Number(special.original_price || special.originalPrice || totalPrice) || undefined,
                    quantity: currentQty + 1,
                    item_type: isCombo ? 'combo' : 'special',
                    isSpecial: true,
                    is_combo: isCombo,
                    special_type: isCombo ? 'combo' : 'special',
                    specialId: special.id,
                    specialItems: itemNames,
                    specialItemsData: itemsData,
                    image_url: resolvedImage,
                    description: special.description || special.subtitle || prev[key]?.description,
                    badge: isCombo ? 'combo' : (special.badge || 'Today special'),
                    combo_id: special.id,
                    combo_name: title,
                    combo_image: resolvedImage,
                    combo_items: itemsData
                }
            };
        });
    };

    const resolveItemKey = (prev: Record<string, any>, rawId: number | string): string => {
        const rawKey = String(rawId);
        if (prev[rawKey]) return rawKey;
        const clean = rawKey.replace(/^(special|combo)-/, '');
        if (prev[`special-${clean}`]) return `special-${clean}`;
        if (prev[`combo-${clean}`]) return `combo-${clean}`;
        if (prev[clean]) return clean;
        const found = Object.values(prev).find(
            (it: any) => String(it.specialId) === clean || String(it.combo_id) === clean || String(it.menu_item_id) === clean || String(it.menu_item_id) === `special-${clean}` || String(it.menu_item_id) === `combo-${clean}`
        );
        if (found) return String(found.menu_item_id);
        return rawKey;
    };

    const updateQuantity = (itemId: number | string, delta: number) => {
        setCart(prev => {
            const key = resolveItemKey(prev, itemId);
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
        setCart(prev => {
            const key = resolveItemKey(prev, itemId);
            if (!prev[key]) return prev;

            return {
                ...prev,
                [key]: { ...prev[key], notes }
            };
        });
    };

    const removeFromCart = (itemId: number | string) => {
        setCart(prev => {
            const key = resolveItemKey(prev, itemId);
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    };

    const clearCart = () => setCart({});

    const getItemQtyInCart = (itemId: number | string) => {
        if (!itemId && itemId !== 0) return 0;
        const key = resolveItemKey(cart, itemId);
        return cart[key]?.quantity || 0;
    };

    const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = Object.values(cart).reduce((sum, item) => sum + (getActivePrice(item) * item.quantity), 0);

    const { totalGst, totalCgst, totalSgst } = Object.values(cart).reduce(
        (acc, item) => {
            const itemTotal = getActivePrice(item) * item.quantity;
            const gstRate = item.gst_percentage ?? item.tax_percent ?? 5;
            const cgstRate = item.cgst_percentage ?? (gstRate / 2);
            const sgstRate = item.sgst_percentage ?? (gstRate / 2);

            return {
                totalGst: acc.totalGst + (itemTotal * gstRate) / 100,
                totalCgst: acc.totalCgst + (itemTotal * cgstRate) / 100,
                totalSgst: acc.totalSgst + (itemTotal * sgstRate) / 100,
            };
        },
        { totalGst: 0, totalCgst: 0, totalSgst: 0 }
    );

    const ceil2 = (num: number) => {
        const n = Number(num || 0);
        const clean = Math.round(n * 1e8) / 1e8;
        return Math.ceil(clean * 100) / 100;
    };
    const round2 = ceil2;
    const cgst = round2(totalCgst);
    const sgst = round2(totalSgst);
    const tax = round2(cgst + sgst);
    const cleanSubtotal = round2(subtotal);
    const total = round2(cleanSubtotal + tax);

    return (
        <CartContext.Provider value={{ cart, addToCart, addSpecialToCart, updateQuantity, updateItemNotes, removeFromCart, clearCart, totalItems, subtotal: cleanSubtotal, tax, cgst, sgst, total, tableNumber, setTableNumber, getItemQtyInCart }}>
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
