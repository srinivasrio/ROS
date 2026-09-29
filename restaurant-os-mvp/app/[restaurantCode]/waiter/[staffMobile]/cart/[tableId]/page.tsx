'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { OrderService } from '@/services/orders.service';
import { MenuService, type MenuItem } from '@/services/menu.service';
import { SpecialsService, type TodaySpecial } from '@/services/specials.service';
import { RestaurantService } from '@/services/restaurant.service';
import {
    ShoppingBag, Plus, Minus, Send, ChevronLeft, Trash2,
    MessageSquare, UtensilsCrossed, Receipt, X, Lock,
    ChevronDown, Flame, CheckCheck, Clock
} from 'lucide-react';
import { EmptyState, haptic, springSoft } from '../../../components/ui';
import { getCategoryMenuItemImage } from '@/lib/utils';

const inr = (n: number) => {
    const val = Number(n) || 0;
    const cleaned = Math.round(val * 10000) / 10000;
    return `₹${cleaned.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    })}`;
};
const QUICK_NOTES = ['Less spicy', 'No onion', 'No garlic', 'Extra spicy', 'Crispy', 'Serve hot'];

function isComboItem(item: any): boolean {
    if (!item) return false;
    if (item.is_combo || item.special_type === 'combo' || item.item_type === 'combo') return true;
    if (item.combo_name || item.combo_id) return true;
    return false;
}

function parseComboSubItems(item: any): any[] {
    if (!item) return [];
    if (Array.isArray(item.combo_items) && item.combo_items.length > 0) {
        return item.combo_items;
    }
    if (Array.isArray(item.items) && item.items.length > 0) {
        return item.items;
    }
    if (typeof item.combo_items === 'string') {
        try {
            const parsed = JSON.parse(item.combo_items);
            if (Array.isArray(parsed)) return parsed;
        } catch (_) {}
    }
    return [];
}

interface CartItemRow {
    key: string;
    name: string;
    unitPrice: number;
    qty: number;
    note?: string;
    isSpecial?: boolean;
    combo_items?: any[];
    special_type?: string;
    imageUrl?: string;
    gstPercentage?: number;
    cgstPercentage?: number;
    sgstPercentage?: number;
}

function CustomizationSheet({
    itemName,
    initialNote,
    onSave,
    onClose,
}: {
    itemName: string;
    initialNote: string;
    onSave: (note: string) => void;
    onClose: () => void;
}) {
    const [note, setNote] = useState(initialNote);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 280 }}
                className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-w-border"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between pb-3 border-b border-w-border">
                    <div>
                        <p className="text-xs font-bold text-w-brand uppercase tracking-wider">Cooking Instructions</p>
                        <h3 className="text-base font-extrabold text-w-ink mt-0.5">{itemName}</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full text-w-muted hover:bg-slate-100">
                        <X size={20} />
                    </button>
                </div>

                <div className="py-4">
                    <p className="text-xs font-semibold text-w-ink-soft mb-2">Quick preferences:</p>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                        {QUICK_NOTES.map((qn) => {
                            const isSelected = note.includes(qn);
                            return (
                                <button
                                    key={qn}
                                    type="button"
                                    onClick={() => {
                                        haptic.light();
                                        if (isSelected) {
                                            setNote(note.replace(qn, '').replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim());
                                        } else {
                                            setNote(note ? `${note}, ${qn}` : qn);
                                        }
                                    }}
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                                        isSelected
                                            ? 'bg-w-brand text-white'
                                            : 'bg-slate-100 text-w-ink hover:bg-slate-200'
                                    }`}
                                >
                                    {qn}
                                </button>
                            );
                        })}
                    </div>

                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Add custom notes for chef (e.g. less oil, extra chutney)..."
                        rows={3}
                        className="w-full text-sm p-3 rounded-xl border border-w-border bg-slate-50 focus:bg-white focus:border-w-brand outline-none transition-all resize-none text-w-ink"
                    />
                </div>

                <div className="flex gap-2 pt-2">
                    <button
                        type="button"
                        onClick={() => {
                            setNote('');
                            onSave('');
                        }}
                        className="px-4 py-3 rounded-xl border border-w-border text-sm font-bold text-w-ink-soft hover:bg-slate-50"
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        onClick={() => onSave(note.trim())}
                        className="flex-1 py-3 rounded-xl bg-w-brand text-white text-sm font-extrabold shadow-md shadow-w-brand/20 active:scale-[0.98] transition-transform"
                    >
                        Save Note
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}

export default function CartReview() {
    const params = useParams();
    const router = useRouter();
    const tableId = typeof params.tableId === 'string' ? params.tableId : '';
    const staffMobile = params.staffMobile as string;
    const restaurantCode = params.restaurantCode as string;

    const [rows, setRows] = useState<CartItemRow[]>([]);
    const [tableName, setTableName] = useState(`Table ${tableId}`);
    const [submitting, setSubmitting] = useState(false);
    const [ready, setReady] = useState(false);
    const [customizing, setCustomizing] = useState<{ key: string; name: string; note: string } | null>(null);
    const [existingOrder, setExistingOrder] = useState<any | null>(null);
    const [expandedPreviousCombos, setExpandedPreviousCombos] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const boot = async () => {
            const draft = typeof window !== 'undefined' ? sessionStorage.getItem(`waiter_draft_order_${tableId}`) : null;
            const parsed = draft ? JSON.parse(draft) : null;
            const cart: Record<string, number> = parsed?.cart || {};
            const itemNotes: Record<string, string> = parsed?.itemNotes || {};
            const cartDetails: Record<string, any> = parsed?.cartDetails || {};

            // Instant render from cartDetails if available
            const initialRows: CartItemRow[] = [];
            Object.entries(cart).forEach(([idStr, qty]) => {
                if (qty <= 0) return;
                const detail = cartDetails[idStr];
                if (detail) {
                    const gst = (detail.gst_percentage != null && !isNaN(Number(detail.gst_percentage)))
                        ? Number(detail.gst_percentage)
                        : (detail.gstPercentage != null && !isNaN(Number(detail.gstPercentage)))
                            ? Number(detail.gstPercentage)
                            : 5;
                    const cgst = (detail.cgst_percentage != null && !isNaN(Number(detail.cgst_percentage)))
                        ? Number(detail.cgst_percentage)
                        : (detail.cgstPercentage != null && !isNaN(Number(detail.cgstPercentage)))
                            ? Number(detail.cgstPercentage)
                            : (gst / 2);
                    const sgst = (detail.sgst_percentage != null && !isNaN(Number(detail.sgst_percentage)))
                        ? Number(detail.sgst_percentage)
                        : (detail.sgstPercentage != null && !isNaN(Number(detail.sgstPercentage)))
                            ? Number(detail.sgstPercentage)
                            : (gst / 2);

                    initialRows.push({
                        key: idStr,
                        name: detail.name || `Item #${idStr}`,
                        unitPrice: Number(detail.price) || 0,
                        qty,
                        note: itemNotes[idStr] || '',
                        isSpecial: !!detail.isSpecial,
                        combo_items: detail.combo_items,
                        special_type: detail.special_type,
                        imageUrl: detail.imageUrl || getCategoryMenuItemImage(detail.name || ''),
                        gstPercentage: gst,
                        cgstPercentage: cgst,
                        sgstPercentage: sgst,
                    });
                }
            });
            if (initialRows.length > 0) {
                setRows(initialRows);
            }

            // Parallel fetch menu, specials, table info, GST settings, and active table order
            const [itemsRes, specialsRes, tableRes, gstRes, activeOrderRes] = await Promise.allSettled([
                MenuService.fetchMenuItems(restaurantCode),
                SpecialsService.fetchActiveSpecials(restaurantCode),
                OrderService.findTableAnywhere(tableId, restaurantCode),
                RestaurantService.getGstSettings(restaurantCode),
                tableId && tableId !== 'browse' ? OrderService.getActiveOrderForTable(tableId, restaurantCode) : Promise.resolve(null),
            ]);

            const items: MenuItem[] = itemsRes.status === 'fulfilled' && Array.isArray(itemsRes.value) ? itemsRes.value : [];
            const specials: TodaySpecial[] = specialsRes.status === 'fulfilled' && Array.isArray(specialsRes.value) ? specialsRes.value : [];
            const tableData = tableRes.status === 'fulfilled' ? tableRes.value : null;
            const resGst = gstRes.status === 'fulfilled' ? gstRes.value : { gst_percentage: 5, cgst_percentage: 2.5, sgst_percentage: 2.5 };
            const activeOrder = activeOrderRes.status === 'fulfilled' ? activeOrderRes.value : null;

            if (activeOrder && Array.isArray(activeOrder.items)) {
                const enriched = activeOrder.items.map((it: any) => {
                    if (isComboItem(it) && (!it.combo_items || it.combo_items.length === 0)) {
                        const match = specials.find((s: any) =>
                            (it.combo_id && String(s.id) === String(it.combo_id)) ||
                            (it.combo_name && s.title?.trim().toLowerCase() === it.combo_name.trim().toLowerCase()) ||
                            (it.name && s.title?.trim().toLowerCase() === it.name.trim().toLowerCase())
                        );
                        if (match && match.items && match.items.length > 0) {
                            it.combo_items = match.items.map((si: any) => ({
                                menu_item_id: si.menu_item_id || si.menu_item?.id || null,
                                name: si.menu_item?.name || 'Item',
                                quantity: Number(si.quantity) || 1,
                                price: Number(si.menu_item?.price || 0),
                                image_url: si.menu_item?.image_url || getCategoryMenuItemImage(si.menu_item?.name || 'Item'),
                                item_type: si.menu_item?.item_type || (si.menu_item?.is_veg ? 'Veg' : 'Non-Veg'),
                            }));
                        }
                    }
                    return it;
                });
                activeOrder.items = enriched;
                setExistingOrder({ ...activeOrder });
            } else {
                setExistingOrder(null);
            }

            if (tableData) {
                setTableName(tableData.display_name || (tableData.table_number ? `Table ${tableData.table_number}` : `Table ${tableId}`));
                const isAvail = ['available', 'empty', 'free'].includes((tableData.status || '').toLowerCase());
                if (!isAvail && tableData.assigned_waiter_id) {
                    // Informative only: allow any waiter to take orders for this table
                }
            }

            const out: CartItemRow[] = [];
            Object.entries(cart).forEach(([idStr, qty]) => {
                if (qty <= 0) return;
                const detail = cartDetails[idStr];

                if (idStr.startsWith('special-')) {
                    const specialId = idStr.replace('special-', '');
                    const special = specials.find((s) => String(s.id) === String(specialId));
                    const price = detail?.price != null ? Number(detail.price) : (special?.special_price || (special?.items || []).reduce((s, si) => s + (si.menu_item?.price || 0) * si.quantity, 0) || 0);
                    const name = detail?.name || special?.title || 'Special Item';
                    const firstSpecialMenuItem = (special?.items || [])[0]?.menu_item;
                    const specGst = (detail?.gst_percentage != null && !isNaN(Number(detail.gst_percentage)))
                        ? Number(detail.gst_percentage)
                        : (firstSpecialMenuItem?.gst_percentage != null && !isNaN(Number(firstSpecialMenuItem.gst_percentage)))
                            ? Number(firstSpecialMenuItem.gst_percentage)
                            : (resGst.gst_percentage ?? 5);
                    const specCgst = (detail?.cgst_percentage != null && !isNaN(Number(detail.cgst_percentage)))
                        ? Number(detail.cgst_percentage)
                        : (firstSpecialMenuItem?.cgst_percentage != null && !isNaN(Number(firstSpecialMenuItem.cgst_percentage)))
                            ? Number(firstSpecialMenuItem.cgst_percentage)
                            : (resGst.cgst_percentage ?? (specGst / 2));
                    const specSgst = (detail?.sgst_percentage != null && !isNaN(Number(detail.sgst_percentage)))
                        ? Number(detail.sgst_percentage)
                        : (firstSpecialMenuItem?.sgst_percentage != null && !isNaN(Number(firstSpecialMenuItem.sgst_percentage)))
                            ? Number(firstSpecialMenuItem.sgst_percentage)
                            : (resGst.sgst_percentage ?? (specGst / 2));

                    const subItems = detail?.combo_items || (special?.items || []).map((si: any) => ({
                        menu_item_id: si.menu_item_id || si.menu_item?.id || null,
                        name: si.name || si.title || si.menu_item?.name || 'Item',
                        quantity: Number(si.quantity) || 1,
                        price: Number(si.price || si.menu_item?.price || 0),
                        image_url: si.image_url || si.menu_item?.image_url || getCategoryMenuItemImage(si.name || si.menu_item?.name || 'Item'),
                        item_type: si.item_type || si.menu_item?.item_type || (si.menu_item?.is_veg ? 'Veg' : 'Non-Veg'),
                    }));

                    out.push({
                        key: idStr,
                        name,
                        unitPrice: price,
                        qty,
                        note: itemNotes[idStr] || '',
                        isSpecial: true,
                        combo_items: subItems,
                        special_type: detail?.special_type || special?.special_type || (special?.is_combo ? 'combo' : 'special'),
                        imageUrl: detail?.imageUrl || special?.image_url || getCategoryMenuItemImage(name),
                        gstPercentage: specGst,
                        cgstPercentage: specCgst,
                        sgstPercentage: specSgst,
                    });
                } else {
                    const item = items.find((i) => String(i.id) === String(idStr) || Number(i.id) === Number(idStr));
                    const price = detail?.price != null ? Number(detail.price) : (item ? item.price : 0);
                    const name = detail?.name || item?.name || `Item #${idStr}`;
                    
                    const iGst = (item?.gst_percentage != null && !isNaN(Number(item.gst_percentage)))
                        ? Number(item.gst_percentage)
                        : (detail?.gst_percentage != null && !isNaN(Number(detail.gst_percentage)))
                            ? Number(detail.gst_percentage)
                            : (item?.tax_percent != null && Number(item.tax_percent) > 0
                                ? Number(item.tax_percent)
                                : (resGst.gst_percentage ?? 5));

                    const iCgst = (item?.cgst_percentage != null && !isNaN(Number(item.cgst_percentage)))
                        ? Number(item.cgst_percentage)
                        : (detail?.cgst_percentage != null && !isNaN(Number(detail.cgst_percentage)))
                            ? Number(detail.cgst_percentage)
                            : (resGst.cgst_percentage ?? (iGst / 2));

                    const iSgst = (item?.sgst_percentage != null && !isNaN(Number(item.sgst_percentage)))
                        ? Number(item.sgst_percentage)
                        : (detail?.sgst_percentage != null && !isNaN(Number(detail.sgst_percentage)))
                            ? Number(detail.sgst_percentage)
                            : (resGst.sgst_percentage ?? (iGst / 2));

                    out.push({
                        key: idStr,
                        name,
                        unitPrice: price,
                        qty,
                        note: itemNotes[idStr] || '',
                        isSpecial: false,
                        imageUrl: detail?.imageUrl || item?.image_url || getCategoryMenuItemImage(name),
                        gstPercentage: iGst,
                        cgstPercentage: iCgst,
                        sgstPercentage: iSgst,
                    });
                }
            });

            setRows(out);
            setReady(true);
        };
        boot();
    }, [tableId, restaurantCode]);

    const totalQty = rows.reduce((s, r) => s + r.qty, 0);
    const rawSubtotal = rows.reduce((s, r) => s + r.unitPrice * r.qty, 0);
    const rawCgst = rows.reduce((s, r) => s + (r.unitPrice * r.qty * ((r.cgstPercentage ?? ((r.gstPercentage ?? 5) / 2)) / 100)), 0);
    const rawSgst = rows.reduce((s, r) => s + (r.unitPrice * r.qty * ((r.sgstPercentage ?? ((r.gstPercentage ?? 5) / 2)) / 100)), 0);

    // Maintain complete decimal precision without IEEE 754 float inaccuracies
    const subtotal = Math.round(rawSubtotal * 10000) / 10000;
    const cgst = Math.round(rawCgst * 10000) / 10000;
    const sgst = Math.round(rawSgst * 10000) / 10000;
    const gst = Math.round((cgst + sgst) * 10000) / 10000;
    const grandTotal = Math.round((subtotal + gst) * 10000) / 10000;

    const existingItems = Array.isArray(existingOrder?.items) ? existingOrder.items : [];
    const hasPreviousOrder = existingItems.length > 0;
    const previousSubtotal = existingItems.reduce(
        (sum: number, it: any) => sum + (Number(it.price || 0) * Number(it.quantity || 1)),
        0
    );
    const previousGst = Number(existingOrder?.gst_amount) || 0;
    const previousTotal = Number(existingOrder?.total_amount) || (previousSubtotal + previousGst);

    const togglePreviousCombo = (key: string) => {
        haptic.selection();
        setExpandedPreviousCombos((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const combinedTableTotal = Math.round(((hasPreviousOrder ? previousTotal : 0) + (rows.length > 0 ? grandTotal : 0)) * 10000) / 10000;

    const effectiveGstRate = subtotal > 0 ? (gst / subtotal) * 100 : 5;
    const formattedGstRate = Number.isInteger(effectiveGstRate) ? effectiveGstRate : Number(effectiveGstRate.toFixed(2));
    const effectiveCgstRate = Number.isInteger(effectiveGstRate / 2) ? (effectiveGstRate / 2) : Number((effectiveGstRate / 2).toFixed(2));
    const effectiveSgstRate = Number.isInteger(effectiveGstRate / 2) ? (effectiveGstRate / 2) : Number((effectiveGstRate / 2).toFixed(2));

    const persistDraft = (next: CartItemRow[]) => {
        const cart: Record<string, number> = {};
        const itemNotes: Record<string, string> = {};
        const cartDetails: Record<string, any> = {};
        next.forEach((r) => {
            cart[r.key] = r.qty;
            if (r.note) itemNotes[r.key] = r.note;
            cartDetails[r.key] = {
                id: r.key,
                name: r.name,
                price: r.unitPrice,
                imageUrl: r.imageUrl,
                isSpecial: r.isSpecial,
                gst_percentage: r.gstPercentage,
                cgst_percentage: r.cgstPercentage,
                sgst_percentage: r.sgstPercentage,
            };
        });
        sessionStorage.setItem(`waiter_draft_order_${tableId}`, JSON.stringify({ cart, itemNotes, cartDetails }));
    };

    const changeQty = (key: string, delta: number) => {
        haptic.light();
        setRows((prev) => {
            const next = prev
                .map((r) => (r.key === key ? { ...r, qty: r.qty + delta } : r))
                .filter((r) => r.qty > 0);
            persistDraft(next);
            return next;
        });
    };

    const removeItem = (key: string) => {
        haptic.light();
        setRows((prev) => {
            const next = prev.filter((r) => r.key !== key);
            persistDraft(next);
            return next;
        });
        toast.info('Item removed from cart');
    };

    const clearCart = () => {
        haptic.light();
        setRows([]);
        persistDraft([]);
        toast.info('Cart cleared');
    };

    const handleSaveNote = (key: string, note: string) => {
        setRows((prev) => {
            const next = prev.map((r) => (r.key === key ? { ...r, note } : r));
            persistDraft(next);
            return next;
        });
        setCustomizing(null);
        toast.success('Note updated');
    };

    const sendToKitchen = async () => {
        if (rows.length === 0) return;

        setSubmitting(true);
        try {
            const uuid = () =>
                typeof window !== 'undefined' && window.crypto?.randomUUID
                    ? window.crypto.randomUUID()
                    : Math.random().toString(36).substring(2) + Date.now().toString(36);

            const orderItems = rows.map((r) => {
                const itemGst = r.gstPercentage ?? 5;
                const itemCgst = r.cgstPercentage ?? (itemGst / 2);
                const itemSgst = r.sgstPercentage ?? (itemGst / 2);

                if (r.isSpecial) {
                    const specialId = r.key.replace('special-', '');
                    const subItems = r.combo_items && r.combo_items.length > 0 ? r.combo_items : null;
                    return {
                        id: uuid(),
                        menu_item_id: null,
                        quantity: r.qty,
                        price: r.unitPrice,
                        notes: r.note || '',
                        item_type: 'combo',
                        combo_name: r.name,
                        combo_id: specialId,
                        combo_image: r.imageUrl || null,
                        combo_items: subItems,
                        gst_percentage: itemGst,
                        tax_percent: itemGst,
                        cgst_percentage: itemCgst,
                        cgst_percent: itemCgst,
                        sgst_percentage: itemSgst,
                        sgst_percent: itemSgst,
                    };
                }
                const numKey = Number(r.key);
                const validKey = !isNaN(numKey) && numKey > 0 ? numKey : null;
                return {
                    id: uuid(),
                    menu_item_id: validKey,
                    combo_name: validKey === null ? r.name : undefined,
                    name: r.name,
                    quantity: r.qty,
                    price: r.unitPrice,
                    notes: r.note || '',
                    gst_percentage: itemGst,
                    tax_percent: itemGst,
                    cgst_percentage: itemCgst,
                    cgst_percent: itemCgst,
                    sgst_percentage: itemSgst,
                    sgst_percent: itemSgst,
                };
            });

            const sessionStr = typeof window !== 'undefined' ? localStorage.getItem('waiterSession') : null;
            let waiterId: string | undefined;
            if (sessionStr) {
                try {
                    waiterId = JSON.parse(sessionStr).id;
                } catch (e) {
                    console.error('Failed to parse waiter session', e);
                }
            }

            if (!waiterId && staffMobile) {
                try {
                    const staffRec = await OrderService.getStaffByMobile(staffMobile, restaurantCode);
                    if (staffRec?.id) waiterId = staffRec.id;
                } catch (e) {
                    console.error('Failed to resolve waiter ID from mobile', e);
                }
            }

            const idParam = isNaN(Number(tableId)) ? tableId : Number(tableId);
            await OrderService.createOrder(idParam, orderItems, restaurantCode, 'placed', waiterId, undefined, undefined, uuid());
            haptic.success();
            toast.success(hasPreviousOrder ? 'New items added to order and sent to Kitchen!' : 'Order sent to Kitchen successfully!');
            sessionStorage.removeItem(`waiter_draft_order_${tableId}`);
            sessionStorage.removeItem(`waiter_browse_cart_${restaurantCode}`);
            router.push(`/${restaurantCode}/waiter/${staffMobile}/dashboard`);
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || 'Failed to place order');
        } finally {
            setSubmitting(false);
        }
    };

    if (!ready) {
        return (
            <div className="min-h-full bg-w-canvas flex flex-col items-center justify-center p-8">
                <span className="size-9 rounded-full border-[3px] border-w-brand-soft border-t-w-brand animate-spin" />
                <p className="mt-3 text-xs font-bold text-w-muted">Loading cart items...</p>
            </div>
        );
    }

    return (
        <div className="min-h-full bg-w-canvas flex flex-col justify-between">
            <div>
                {/* App bar */}
                <header className="sticky top-0 z-30 bg-white px-4 h-14 flex items-center justify-between shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        aria-label="Back"
                        className="size-9 -ml-2 rounded-full flex items-center justify-center text-w-brand active:bg-w-brand-soft"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div className="flex-1 text-center px-2">
                        <h1 className="text-base font-black text-w-ink leading-tight">Review Order</h1>
                        <p className="text-xs font-bold text-w-brand truncate">{tableName}</p>
                    </div>
                    {rows.length > 0 ? (
                        <button
                            type="button"
                            onClick={clearCart}
                            className="text-xs font-extrabold text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 active:scale-95 transition-all inline-flex items-center gap-1"
                        >
                            <Trash2 size={13} /> Clear
                        </button>
                    ) : (
                        <div className="w-9" />
                    )}
                </header>

                <main className="p-4 pb-28">
                    {rows.length === 0 && !hasPreviousOrder ? (
                        <div className="py-12">
                            <EmptyState
                                icon={<ShoppingBag />}
                                title="No items in cart"
                                body="Add items from the menu to build an order for this table."
                                action={
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/${restaurantCode}/waiter/${staffMobile}/menu/${tableId}`)}
                                        className="w-full h-12 rounded-[14px] bg-w-brand text-white text-sm font-extrabold shadow-md shadow-w-brand/25 active:scale-[0.98] transition-transform inline-flex items-center justify-center gap-2"
                                    >
                                        <UtensilsCrossed size={17} /> Browse Menu
                                    </button>
                                }
                            />
                        </div>
                    ) : (
                        <>
                            {/* 1. Previous Items (Already Placed & in Kitchen) */}
                            {hasPreviousOrder && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={springSoft}
                                    className="mb-4 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                                >
                                    {/* Card Header */}
                                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                                                <UtensilsCrossed size={16} />
                                            </span>
                                            <div className="min-w-0">
                                                <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 truncate">
                                                    Previous Items (Already Placed)
                                                </h3>
                                                <p className="text-[10px] font-bold text-slate-500 truncate">
                                                    Order #{existingOrder.order_number || String(existingOrder.id).slice(0, 6)}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-[10px] font-black text-emerald-700 bg-emerald-100/80 border border-emerald-300/60 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                            <span className="size-1.5 rounded-full bg-emerald-600" />
                                            In Kitchen · {existingItems.length} {existingItems.length === 1 ? 'item' : 'items'}
                                        </span>
                                    </div>

                                    {/* Existing Items List */}
                                    <div className="divide-y divide-slate-100">
                                        {existingItems.map((item: any, idx: number) => {
                                            const isCombo = isComboItem(item);
                                            const subItems = isCombo ? parseComboSubItems(item) : [];
                                            const comboKey = `prev-combo-${item.id || idx}`;
                                            const isComboExpanded = !!expandedPreviousCombos[comboKey];
                                            const displayImg = item.combo_image || item.image_url || getCategoryMenuItemImage(item.name);
                                            const isReady = item.status === 'ready';
                                            const isServed = item.status === 'served' || item.status === 'paid';
                                            const isPreparing = ['preparing', 'cooking', 'placed'].includes(item.status);

                                            return (
                                                <div key={item.id || idx} className="p-3.5 flex items-start gap-3">
                                                    {/* Image */}
                                                    <div className="size-14 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-200 relative">
                                                        <img
                                                            src={displayImg}
                                                            alt={item.name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                const target = e.currentTarget;
                                                                const fallback = getCategoryMenuItemImage(item.name);
                                                                if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                                                    target.src = fallback;
                                                                }
                                                            }}
                                                        />
                                                        {isCombo && (
                                                            <span className="absolute top-1 left-1 px-1 py-0.5 rounded bg-orange-500 text-white text-[7.5px] font-black uppercase tracking-wider">
                                                                Combo
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Details */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="text-[13.5px] font-extrabold text-slate-800 leading-snug truncate">
                                                                {item.name}
                                                            </p>
                                                            <span className="shrink-0 text-[10.5px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                                                                {item.quantity}x
                                                            </span>
                                                        </div>

                                                        {/* Status and Unit Price */}
                                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                            {isReady && (
                                                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-1 border border-emerald-200/60">
                                                                    <CheckCheck size={11} /> Ready to Serve
                                                                </span>
                                                            )}
                                                            {isPreparing && (
                                                                <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-200/60">
                                                                    <Flame size={11} /> Preparing
                                                                </span>
                                                            )}
                                                            {isServed && (
                                                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                                                    ✓ Served
                                                                </span>
                                                            )}
                                                            <span className="w-num text-xs font-semibold text-slate-500">
                                                                {inr(item.price)} each
                                                            </span>
                                                            <span className="text-slate-300">•</span>
                                                            <span className="w-num text-xs font-black text-slate-800">
                                                                {inr(item.price * item.quantity)}
                                                            </span>
                                                        </div>

                                                        {item.notes && (
                                                            <p className="text-[11px] font-medium text-slate-500 italic mt-1">
                                                                Note: {item.notes}
                                                            </p>
                                                        )}

                                                        {/* Combo Sub-items Dropdown */}
                                                        {isCombo && subItems.length > 0 && (
                                                            <div className="mt-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => togglePreviousCombo(comboKey)}
                                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer"
                                                                >
                                                                    <span>{isComboExpanded ? 'Hide items inside combo' : 'See items inside combo'}</span>
                                                                    <span className="text-[9.5px] font-bold text-slate-400">({subItems.length})</span>
                                                                    <ChevronDown
                                                                        size={12}
                                                                        className={`transition-transform duration-200 ${isComboExpanded ? 'rotate-180' : ''}`}
                                                                    />
                                                                </button>
                                                                <AnimatePresence initial={false}>
                                                                    {isComboExpanded && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, height: 0 }}
                                                                            animate={{ opacity: 1, height: 'auto' }}
                                                                            exit={{ opacity: 0, height: 0 }}
                                                                            transition={{ duration: 0.2 }}
                                                                            className="overflow-hidden mt-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5"
                                                                        >
                                                                            <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-400 px-1">
                                                                                <span>Includes ({subItems.length} items):</span>
                                                                                <span>Individual Price</span>
                                                                            </div>
                                                                            {subItems.map((sub: any, sIdx: number) => (
                                                                                <div key={sIdx} className="flex items-center justify-between text-[11px] text-slate-700 px-1">
                                                                                    <span className="truncate font-medium">• {sub.name}</span>
                                                                                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                                                        {sub.price != null && Number(sub.price) > 0 ? (
                                                                                            <span className="font-bold text-slate-500">{inr(Number(sub.price))}</span>
                                                                                        ) : null}
                                                                                        <span className="font-bold text-slate-800">×{sub.quantity * item.quantity}</span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Existing Items Total Footer */}
                                    <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs">
                                        <span className="font-extrabold text-slate-600">Previous Items Subtotal</span>
                                        <span className="font-black text-slate-800">{inr(previousSubtotal)}</span>
                                    </div>
                                </motion.div>
                            )}

                            {/* 2. Newly Added Items (Cart) */}
                            {rows.length > 0 ? (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={springSoft}
                                    className="bg-white rounded-2xl border border-w-border divide-y divide-w-border overflow-hidden shadow-xs mb-3.5"
                                >
                                    {/* Card Header when previous items also exist */}
                                    {hasPreviousOrder && (
                                        <div className="px-4 py-3 bg-orange-50/70 border-b border-orange-200/70 flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="p-1.5 rounded-lg bg-orange-500/15 text-w-brand shrink-0">
                                                    <ShoppingBag size={16} />
                                                </span>
                                                <div className="min-w-0">
                                                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 truncate">
                                                        Newly Added Items
                                                    </h3>
                                                    <p className="text-[10px] font-bold text-w-brand truncate">
                                                        Will be sent to kitchen together
                                                    </p>
                                                </div>
                                            </div>
                                            <span className="shrink-0 text-[10px] font-black text-w-brand-deep bg-w-brand-soft border border-orange-300/60 px-2.5 py-0.5 rounded-full">
                                                {totalQty} {totalQty === 1 ? 'item' : 'items'}
                                            </span>
                                        </div>
                                    )}

                                    {rows.map((r) => (
                                        <div key={r.key} className="p-3.5 flex items-center gap-3">
                                            {/* Image */}
                                            <div className="size-14 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-w-border relative">
                                                <img
                                                    src={r.imageUrl || getCategoryMenuItemImage(r.name)}
                                                    alt={r.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        const target = e.currentTarget;
                                                        const fallback = getCategoryMenuItemImage(r.name);
                                                        if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                                            target.src = fallback;
                                                        }
                                                    }}
                                                />
                                                {r.isSpecial && (
                                                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-w-brand text-white text-[8px] font-black uppercase shadow-xs">
                                                        Special
                                                    </span>
                                                )}
                                            </div>

                                            {/* Item info & prices */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-1">
                                                    <p className="text-[14px] font-extrabold text-w-ink leading-snug truncate">{r.name}</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(r.key)}
                                                        className="text-slate-400 hover:text-red-500 p-1 -mr-1 rounded-lg active:scale-90 transition-transform shrink-0 cursor-pointer"
                                                        title="Remove item"
                                                    >
                                                        <Trash2 size={15} />
                                                    </button>
                                                </div>

                                                {/* Pricing display */}
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="w-num text-xs font-semibold text-w-muted">{inr(r.unitPrice)} each</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="w-num text-xs font-black text-w-brand">{inr(r.unitPrice * r.qty)}</span>
                                                </div>

                                                {/* Note / Cooking instructions */}
                                                <div className="mt-1.5 flex items-center gap-1.5">
                                                    {r.note ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setCustomizing({ key: r.key, name: r.name, note: r.note || '' })}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-w-brand-soft text-w-brand-deep text-[11px] font-bold hover:bg-w-brand-soft/80 transition-colors cursor-pointer"
                                                        >
                                                            <MessageSquare size={11} className="shrink-0" />
                                                            <span className="truncate max-w-[140px]">Note: {r.note}</span>
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => setCustomizing({ key: r.key, name: r.name, note: '' })}
                                                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-w-ink-soft/75 hover:text-w-brand transition-colors cursor-pointer"
                                                        >
                                                            <Plus size={11} />
                                                            <span>Add note</span>
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Included items inside combo */}
                                                {r.isSpecial && r.combo_items && r.combo_items.length > 0 && (
                                                    <div className="mt-2 p-2 rounded-xl bg-[#F8FAFC] border border-slate-200/80 space-y-1">
                                                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500">
                                                            <span>Includes ({r.combo_items.length} items):</span>
                                                            <span>Individual Price</span>
                                                        </div>
                                                        {r.combo_items.map((sub: any, sIdx: number) => (
                                                            <div key={sIdx} className="flex items-center justify-between text-[11px] text-slate-600">
                                                                <span className="truncate font-medium">• {sub.name}</span>
                                                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                                    {sub.price != null && Number(sub.price) > 0 && (
                                                                        <span className="font-bold text-slate-500">{inr(Number(sub.price))}</span>
                                                                    )}
                                                                    <span className="font-bold text-slate-800">x{sub.quantity * r.qty}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Stepper */}
                                            <div className="shrink-0 inline-flex items-center bg-[#F1F5F9] rounded-[10px] border border-w-border-strong">
                                                <button
                                                    type="button"
                                                    onClick={() => changeQty(r.key, -1)}
                                                    aria-label="Remove one"
                                                    className="size-[28px] flex items-center justify-center text-w-ink active:bg-slate-200 rounded-l-[9px] transition-colors cursor-pointer"
                                                >
                                                    {r.qty === 1 ? <Trash2 size={13} className="text-red-500" /> : <Minus size={13} strokeWidth={2.5} />}
                                                </button>
                                                <span className="w-num min-w-7 text-center text-[13px] font-black text-w-ink">{r.qty}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => changeQty(r.key, 1)}
                                                    aria-label="Add one"
                                                    className="size-[28px] flex items-center justify-center text-w-ink active:bg-slate-200 rounded-r-[9px] transition-colors cursor-pointer"
                                                >
                                                    <Plus size={13} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            ) : hasPreviousOrder ? (
                                <div className="p-4 mb-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs text-center py-6">
                                    <ShoppingBag size={24} className="text-slate-400 mx-auto mb-2" />
                                    <p className="text-xs font-black text-slate-700">No new items in cart yet</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        Tap "Add More Dishes" below to select additional items for this table.
                                    </p>
                                </div>
                            ) : null}

                            {/* 3. Add More Dishes button */}
                            <button
                                type="button"
                                onClick={() => router.push(`/${restaurantCode}/waiter/${staffMobile}/menu/${tableId}`)}
                                className="w-full my-3.5 h-[48px] rounded-[14px] bg-white border-[1.5px] border-w-brand text-w-brand text-sm font-extrabold hover:bg-w-brand-soft/30 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                            >
                                <Plus size={17} strokeWidth={2.5} /> Add More Dishes
                            </button>

                            {/* 4. Bill Summary & Price Breakdown */}
                            <div className="bg-white rounded-2xl border border-w-border p-4 shadow-sm space-y-2.5">
                                <div className="flex items-center justify-between pb-1 border-b border-w-border/60">
                                    <div className="flex items-center gap-1.5">
                                        <Receipt size={16} className="text-w-brand" />
                                        <h3 className="text-sm font-extrabold text-w-ink">Bill Summary</h3>
                                    </div>
                                    <span className="text-xs font-bold text-w-brand bg-w-brand-soft px-2 py-0.5 rounded-md">
                                        {hasPreviousOrder && rows.length > 0 ? (
                                            `${existingItems.length} prev + ${totalQty} new`
                                        ) : hasPreviousOrder ? (
                                            `${existingItems.length} placed`
                                        ) : (
                                            `${totalQty} ${totalQty === 1 ? 'item' : 'items'}`
                                        )}
                                    </span>
                                </div>

                                <div className="space-y-2 pt-1 text-xs">
                                    {hasPreviousOrder && (
                                        <div className="flex justify-between text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                            <div>
                                                <span className="font-bold block">Previous Order Total</span>
                                                <span className="text-[10px] text-slate-400 font-medium">Already in kitchen (incl. taxes)</span>
                                            </div>
                                            <span className="font-black text-slate-800">{inr(previousTotal)}</span>
                                        </div>
                                    )}

                                    {rows.length > 0 && (
                                        <>
                                            <div className="flex justify-between text-w-ink-soft">
                                                <span className="font-medium">New Items Subtotal</span>
                                                <span className="font-bold text-w-ink">{inr(subtotal)}</span>
                                            </div>
                                            <div className="flex justify-between text-w-ink-soft">
                                                <span className="font-medium">CGST ({effectiveCgstRate}%)</span>
                                                <span className="font-bold text-w-ink">+ {inr(cgst)}</span>
                                            </div>
                                            <div className="flex justify-between text-w-ink-soft">
                                                <span className="font-medium">SGST ({effectiveSgstRate}%)</span>
                                                <span className="font-bold text-w-ink">+ {inr(sgst)}</span>
                                            </div>
                                            <div className="flex justify-between text-w-ink-soft pt-1 border-t border-slate-100">
                                                <span className="font-semibold text-w-ink">Total New GST ({formattedGstRate}%)</span>
                                                <span className="font-bold text-w-ink">+ {inr(gst)}</span>
                                            </div>
                                            {hasPreviousOrder && (
                                                <div className="flex justify-between text-orange-800 bg-orange-50/80 p-2.5 rounded-xl border border-orange-100">
                                                    <div>
                                                        <span className="font-bold block">New Additions Total</span>
                                                        <span className="text-[10px] text-orange-600 font-medium">Sending to kitchen (incl. GST)</span>
                                                    </div>
                                                    <span className="font-black text-w-brand">{inr(grandTotal)}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div className="border-t border-dashed border-w-border my-2 pt-2.5 flex justify-between items-center">
                                    <div>
                                        <span className="text-sm font-black text-w-ink block">
                                            {hasPreviousOrder ? 'Total Combined Payable' : 'Grand Total'}
                                        </span>
                                        <span className="text-[11px] font-medium text-w-muted">Inclusive of all taxes</span>
                                    </div>
                                    <span className="text-xl font-black text-w-brand font-display">
                                        {inr(hasPreviousOrder ? combinedTableTotal : grandTotal)}
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </div>

            {/* 5. Sticky Bottom Order Now Action Bar */}
            {(rows.length > 0 || hasPreviousOrder) && (
                <footer className="sticky bottom-0 z-50 bg-white/95 backdrop-blur-md border-t border-w-border shadow-[0_-8px_24px_rgba(15,23,42,0.08)] p-4 safe-bottom mt-auto">
                    {rows.length > 0 ? (
                        <>
                            <div className="flex items-center justify-between mb-2.5 px-0.5">
                                <div>
                                    <span className="text-[11px] font-bold text-w-muted uppercase tracking-wider block">
                                        {hasPreviousOrder ? 'New Additions' : 'Total Amount'}
                                    </span>
                                    <span className="text-xl font-black text-w-brand font-display">{inr(grandTotal)}</span>
                                </div>
                                {hasPreviousOrder && (
                                    <div className="text-right">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                            Combined Total
                                        </span>
                                        <span className="text-base font-extrabold text-slate-800 font-display">
                                            {inr(combinedTableTotal)}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <button
                                id="order-now-btn"
                                type="button"
                                onClick={sendToKitchen}
                                disabled={submitting || rows.length === 0}
                                className="w-full h-[54px] rounded-[16px] bg-w-brand hover:bg-[#E0531F] text-white text-base font-extrabold shadow-[0_6px_20px_rgba(255,107,53,0.38)] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                {submitting ? (
                                    <>
                                        <span className="size-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                        <span>Sending Order to Kitchen...</span>
                                    </>
                                ) : (
                                    <>
                                        <Send size={19} className="stroke-[2.5]" />
                                        <span>
                                            {hasPreviousOrder
                                                ? `Add ${totalQty} New Items to Kitchen`
                                                : 'Order Now (Send to Kitchen)'}
                                        </span>
                                        <span className="bg-white/25 px-2.5 py-1 rounded-[10px] text-xs font-black shadow-xs ml-1">
                                            {inr(grandTotal)}
                                        </span>
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => router.push(`/${restaurantCode}/waiter/${staffMobile}/menu/${tableId}`)}
                            className="w-full h-[52px] rounded-[16px] bg-w-brand text-white text-sm font-extrabold shadow-[0_6px_20px_rgba(255,107,53,0.3)] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Plus size={18} />
                            <span>Add Items from Menu for {tableName}</span>
                        </button>
                    )}
                </footer>
            )}

            {/* Customization modal */}
            <AnimatePresence>
                {customizing && (
                    <CustomizationSheet
                        itemName={customizing.name}
                        initialNote={customizing.note}
                        onSave={(note) => handleSaveNote(customizing.key, note)}
                        onClose={() => setCustomizing(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
