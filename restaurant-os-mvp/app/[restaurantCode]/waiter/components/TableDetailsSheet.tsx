'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { toast } from 'sonner';
import {
    X, Link2, Unlink, Receipt, Trash2, UserPlus, CheckCheck, Flame, Lock,
    Sparkles, PlusCircle, Plus, UserX, Banknote, CreditCard, QrCode, ArrowRightLeft,
    UserCheck, ShoppingBag, ChevronDown,
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { OrderService, type Order } from '@/services/orders.service';
import { RestaurantService } from '@/services/restaurant.service';
import QRCode from 'react-qr-code';
import { TABLE_STATUS, normalizeTableStatus, AppButton, SectionLabel, Spinner, springSoft, haptic, tableOpenStore } from './ui';
import type { FloorTable } from './TableCard';
import { isComboItem, parseComboSubItems } from '@/lib/combo-utils';
import { getCategoryMenuItemImage } from '@/lib/utils';

type FloorTableLike = FloorTable;

const supabase = createClient();

const inr = (n: number) => {
    const val = Number(n) || 0;
    const cleaned = Math.round(val * 10000) / 10000;
    return `₹${cleaned.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    })}`;
};

interface WaiterRow {
    id: string;
    name: string;
    employee_id?: string;
    avatar_url?: string | null;
    active_tables?: number;
    mobile?: string;
    role?: string;
    is_online?: boolean;
    availability_status?: string;
}

export function TableDetailsSheet({
    table, restaurantId, currentWaiter, onClose, onChanged, onCleared,
}: {
    table: FloorTableLike;
    restaurantId: string;
    currentWaiter: { id: string; role?: string; name?: string; mobile?: string } | null;
    onClose: () => void;
    onChanged: () => void;
    onCleared?: (targetId: string | number) => void;
}) {
    const router = useRouter();
    const params = useParams();
    const pathname = usePathname();

    const segments = (pathname || '').split('/').filter(Boolean);
    const urlRestaurantCode = segments[0] || '';
    const urlStaffMobile = segments[1] === 'waiter' ? (segments[2] || '') : '';

    const effectiveRestaurantCode = (params?.restaurantCode as string) || urlRestaurantCode || restaurantId;
    let effectiveStaffMobile = (params?.staffMobile as string) || urlStaffMobile || currentWaiter?.mobile || '';
    if (!effectiveStaffMobile && typeof window !== 'undefined') {
        try {
            const saved = JSON.parse(
                (urlStaffMobile ? localStorage.getItem(`waiterSession_${urlStaffMobile}`) : null) ||
                localStorage.getItem('waiterSession') ||
                '{}'
            );
            if (saved?.mobile) effectiveStaffMobile = saved.mobile;
        } catch {}
    }

    const [order, setOrder] = useState<Order | null>(null);
    const [loadingOrder, setLoadingOrder] = useState(true);
    const [busy, setBusy] = useState(false);
    const [view, setView] = useState<'details' | 'bill' | 'billPaid'>('details');
    const [payMethod, setPayMethod] = useState<'Cash' | 'Card' | 'QR'>('Cash');
    const [giveAccessOpen, setGiveAccessOpen] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    const [accessRequested, setAccessRequested] = useState(false);
    const [expandedCombos, setExpandedCombos] = useState<Record<string, boolean>>({});
    const [paymentQrUrl, setPaymentQrUrl] = useState<string>('');
    const [upiId, setUpiId] = useState<string>('');

    useEffect(() => {
        tableOpenStore.set(true);
        return () => {
            tableOpenStore.set(false);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;
        async function fetchPaymentInfo() {
            const targetRes = restaurantId || effectiveRestaurantCode;
            if (!targetRes) return;
            try {
                const info = await RestaurantService.getRestaurantInfo(targetRes);
                if (isMounted && info) {
                    if (info.payment_qr_url) setPaymentQrUrl(info.payment_qr_url);
                    if (info.upi_id) setUpiId(info.upi_id);
                }
                if (!info?.payment_qr_url) {
                    const actualId = (await RestaurantService.resolveRestaurantId(targetRes)) || targetRes;
                    const { data: prof } = await supabase
                        .from('restaurant_profile')
                        .select('restaurant_info')
                        .eq('restaurant_id', actualId)
                        .maybeSingle();
                    const directQr = (prof?.restaurant_info as any)?.payment_qr_url || (prof as any)?.payment_qr_url;
                    const directUpi = (prof?.restaurant_info as any)?.upi_id || (prof as any)?.upi_id;
                    if (isMounted && directQr) setPaymentQrUrl(directQr);
                    if (isMounted && directUpi) setUpiId(directUpi);
                }
            } catch (err) {
                console.error('Failed to load restaurant payment info:', err);
            }
        }
        fetchPaymentInfo();
        return () => { isMounted = false; };
    }, [restaurantId, effectiveRestaurantCode]);

    const toggleCombo = (key: string) => {
        haptic.selection();
        setExpandedCombos((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const status = normalizeTableStatus(table.status);
    const meta = TABLE_STATUS[status];
    const name = table.display_name || `Table ${table.table_number}`;
    const isAvailableTable = status === 'available';
    const assigned = table.assigned_waiter_name || (table as any).assigned_waiter?.name || null;
    const hasAssignedWaiter = Boolean(table.assigned_waiter_id);

    const isAdmin = currentWaiter?.role && ['admin', 'supervisor', 'restaurant_admin', 'manager'].includes(currentWaiter.role.toLowerCase());
    const isMine = !!currentWaiter?.id && table.assigned_waiter_id === currentWaiter.id;
    const isCo = !!currentWaiter?.id && Array.isArray(table.co_waiter_ids) && table.co_waiter_ids.includes(currentWaiter.id);
    const isTransferred = !!table.transferred_to_waiter_name;
    const transferredToMe = isTransferred && table.transferred_to_waiter_id === currentWaiter?.id;
    const canManage = !hasAssignedWaiter || !!isAdmin || isMine || isCo || transferredToMe;

    const targetId = table.is_group ? table.merged_group_id || String(table.id) : String(table.id);

    const [pendingBrowseCart, setPendingBrowseCart] = useState<{ count: number; total: number; cart: any; itemNotes: any; cartDetails?: any } | null>(null);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(`waiter_browse_cart_${restaurantId}`) || 
                        sessionStorage.getItem(`waiter_browse_cart_${effectiveRestaurantCode}`);
            if (raw) {
                const parsed = JSON.parse(raw);
                const totalQty = Object.values(parsed.cart || {}).reduce((s: number, q: any) => s + Number(q || 0), 0);
                if (totalQty > 0) {
                    setPendingBrowseCart({
                        count: totalQty,
                        total: parsed.subtotal || 0,
                        cart: parsed.cart,
                        itemNotes: parsed.itemNotes || {},
                        cartDetails: parsed.cartDetails || {},
                    });
                }
            }
        } catch (_) {}
    }, [restaurantId, effectiveRestaurantCode]);

    const handleOrderPendingItems = () => {
        if (!pendingBrowseCart) return;
        if (!canManage) {
            toast.error(`Table is assigned to ${assigned || 'another waiter'}. Please request access first.`);
            return;
        }
        haptic.selection();
        sessionStorage.setItem(`waiter_draft_order_${targetId}`, JSON.stringify({
            cart: pendingBrowseCart.cart,
            itemNotes: pendingBrowseCart.itemNotes,
            cartDetails: pendingBrowseCart.cartDetails,
        }));
        sessionStorage.removeItem(`waiter_browse_cart_${restaurantId}`);
        sessionStorage.removeItem(`waiter_browse_cart_${effectiveRestaurantCode}`);
        onClose();
        const cleanRest = effectiveRestaurantCode;
        const cleanMobile = effectiveStaffMobile;
        router.push(`/${cleanRest}/waiter/${cleanMobile}/cart/${targetId}`);
    };

    const goToMenu = () => {
        if (!canManage) {
            toast.error(`Table is assigned to ${assigned || 'another waiter'}. Please request access first.`);
            return;
        }
        haptic.selection();
        onClose();
        const cleanRest = effectiveRestaurantCode;
        const cleanMobile = effectiveStaffMobile;
        if (!cleanRest || !cleanMobile) {
            toast.error('Unable to open menu: waiter session details missing.');
            return;
        }
        router.push(`/${cleanRest}/waiter/${cleanMobile}/menu/${targetId}`);
    };

    const loadOrder = useCallback(async () => {
        try {
            const data = await OrderService.getActiveOrderForTable(targetId, restaurantId);
            if (data && data.items) {
                const needsComboResolution = data.items.some(
                    (it: any) => isComboItem(it) && (parseComboSubItems(it).length === 0 || parseComboSubItems(it).some((s: any) => !s.price || Number(s.price) === 0))
                );
                if (needsComboResolution) {
                    try {
                        const { data: specials } = await supabase
                            .from('today_specials')
                            .select(`
                                id,
                                title,
                                special_price,
                                image_url,
                                is_combo,
                                special_type,
                                items:today_special_items(
                                    quantity,
                                    menu_item_id,
                                    menu_item:menu_items(
                                        id,
                                        name,
                                        price,
                                        image_url,
                                        item_type,
                                        is_veg
                                    )
                                )
                            `)
                            .eq('restaurant_id', restaurantId);

                        if (specials && specials.length > 0) {
                            data.items = data.items.map((it: any) => {
                                if (isComboItem(it)) {
                                    const match = specials.find((s: any) =>
                                        (it.combo_id && String(s.id) === String(it.combo_id)) ||
                                        (it.combo_name && s.title?.trim().toLowerCase() === it.combo_name.trim().toLowerCase()) ||
                                        (it.name && s.title?.trim().toLowerCase() === it.name.trim().toLowerCase())
                                    );
                                    if (match && match.items && match.items.length > 0) {
                                        const resolvedSubs = match.items.map((si: any) => ({
                                            menu_item_id: si.menu_item_id || si.menu_item?.id || null,
                                            name: si.menu_item?.name || 'Item',
                                            quantity: Number(si.quantity) || 1,
                                            price: Number(si.menu_item?.price || 0),
                                            image_url: si.menu_item?.image_url || getCategoryMenuItemImage(si.menu_item?.name || 'Item'),
                                            item_type: si.menu_item?.item_type || (si.menu_item?.is_veg ? 'Veg' : 'Non-Veg'),
                                        }));
                                        it.combo_items = resolvedSubs;
                                    }
                                }
                                return it;
                            });
                        }
                    } catch (fallbackErr) {
                        console.error('Error fetching specials fallback in TableDetailsSheet:', fallbackErr);
                    }
                }
            }
            setOrder(data ?? null);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingOrder(false);
        }
    }, [targetId, restaurantId]);

    useEffect(() => {
        loadOrder();
    }, [loadOrder]);

    const readyItems = (order?.items || []).filter((i: any) => i.status === 'ready');
    const itemsSubtotal = (order?.items || []).reduce((sum: number, i: any) => sum + (Number(i.price || 0) * Number(i.quantity || 1)), 0);

    const calculatedGst = (order?.items || []).reduce((sum: number, i: any) => {
        const rate = i.tax_percent ?? i.gst_percentage ?? 5;
        return sum + (Number(i.price || 0) * Number(i.quantity || 1) * (rate / 100));
    }, 0);

    const calculatedCgst = (order?.items || []).reduce((sum: number, i: any) => {
        const rate = i.cgst_percent ?? i.cgst_percentage ?? ((i.tax_percent ?? i.gst_percentage ?? 5) / 2);
        return sum + (Number(i.price || 0) * Number(i.quantity || 1) * (rate / 100));
    }, 0);

    const calculatedSgst = (order?.items || []).reduce((sum: number, i: any) => {
        const rate = i.sgst_percent ?? i.sgst_percentage ?? ((i.tax_percent ?? i.gst_percentage ?? 5) / 2);
        return sum + (Number(i.price || 0) * Number(i.quantity || 1) * (rate / 100));
    }, 0);

    const gstAmount = order?.gst_amount != null ? Number(order.gst_amount) : Math.round(calculatedGst * 10000) / 10000;
    const cgstAmount = order?.cgst_amount != null ? Number(order.cgst_amount) : Math.round(calculatedCgst * 10000) / 10000;
    const sgstAmount = order?.sgst_amount != null ? Number(order.sgst_amount) : Math.round(calculatedSgst * 10000) / 10000;

    const subtotal = itemsSubtotal > 0 ? itemsSubtotal : Math.max(0, (order?.total_amount || 0) - gstAmount);
    const orderTotal = order?.total_amount ?? (subtotal + gstAmount);

    const hasExistingItems = Boolean(
        (order && Array.isArray(order.items) && order.items.length > 0) ||
        (Number(table.active_item_count) > 0) ||
        (table.status && ['occupied', 'need_bill'].includes(normalizeTableStatus(table.status)))
    );
    const orderButtonText = hasExistingItems ? 'Add More Items' : 'Take New Order';

    /* ── Actions ─────────────────────────────────────────────── */
    const doRequestBill = async () => {
        if (!canManage) {
            toast.error('You are not authorized to request a bill for this table');
            return;
        }
        toast.success(`Bill requested for ${name}`);
        setView('bill');
        loadOrder();
        onChanged();

        try {
            await OrderService.requestBill(targetId, restaurantId, currentWaiter?.id);
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || 'Failed to request bill');
        }
    };

    const doSettle = async () => {
        if (!order) return;
        if (!canManage) {
            toast.error('You are not authorized to settle the bill for this table');
            return;
        }
        setBusy(true);
        haptic.success();
        toast.success(`Bill for Table ${table.table_number} marked as Paid via ${payMethod.toUpperCase()}!`);
        setView('billPaid');
        onChanged();

        try {
            await OrderService.settleBill(order.id, restaurantId, undefined, `${currentWaiter?.name || 'Waiter'} · ${payMethod}`, currentWaiter?.id);
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || 'Failed to settle bill');
        } finally {
            setBusy(false);
        }
    };

    const doSeatAndAssign = async () => {
        if (!currentWaiter?.id) {
            toast.error('Waiter session not found. Please log in.');
            return;
        }
        setBusy(true);
        haptic.success();
        try {
            await OrderService.trackCustomerPresence(targetId, restaurantId, 'occupied', currentWaiter.id);
            toast.success(`Table ${table.table_number} assigned to you!`);
            onChanged();
            onClose();
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || 'Failed to assign table');
        } finally {
            setBusy(false);
        }
    };

    const doClear = async () => {
        setBusy(true);
        haptic.success();
        setConfirmClear(false);
        onClose();
        if (onCleared) {
            onCleared(targetId);
        }
        onChanged();

        try {
            await OrderService.clearTable(targetId, restaurantId, currentWaiter?.id);
            toast.success(`Table ${table.table_number} is now marked Available`);
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || 'Failed to clear table');
            onChanged();
        } finally {
            setBusy(false);
        }
    };

    const doServeAll = async () => {
        if (!order) return;
        setOrder((prev: any) => prev ? {
            ...prev,
            status: 'served',
            items: (prev.items || []).map((i: any) => ({ ...i, status: 'served' }))
        } : null);
        haptic.success();
        toast.success('All items marked as Served!');
        onChanged();

        try {
            await OrderService.updateOrderStatus(order.id, restaurantId, 'served');
        } catch (e) {
            console.error(e);
            toast.error('Failed to mark served');
            loadOrder();
        }
    };

    const doServeItem = async (itemId: string) => {
        setOrder((prev: any) => prev ? {
            ...prev,
            items: (prev.items || []).map((i: any) => i.id === itemId ? { ...i, status: 'served' } : i)
        } : null);
        toast.success('Item marked Served');
        onChanged();

        try {
            await OrderService.updateOrderItemStatus(itemId, restaurantId, 'served', currentWaiter?.id);
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || 'Failed to serve item');
            loadOrder();
        }
    };

    const handleRequestAccess = async () => {
        if (!restaurantId || !currentWaiter?.id) {
            toast.error('Waiter session not found. Please log in.');
            return;
        }
        setBusy(true);
        try {
            await OrderService.requestTableAccess(
                targetId,
                currentWaiter.id,
                currentWaiter.name || 'Waiter',
                restaurantId
            );
            setAccessRequested(true);
            toast.success(`Access request sent to ${assigned || 'the assigned waiter'}`);
        } catch (err: any) {
            console.error('Failed to request table access:', err);
            toast.error(err?.message || 'Failed to request table access');
        } finally {
            setBusy(false);
        }
    };

    const doUnmerge = async () => {
        setBusy(true);
        try {
            await OrderService.unmergeTables(targetId, restaurantId);
            toast.success('Table group unmerged successfully');
            onChanged();
            onClose();
        } catch (e) {
            console.error(e);
            toast.error('Failed to unmerge');
        } finally {
            setBusy(false);
        }
    };

    /* ── Bill view ───────────────────────────────────────────── */
    if (view === 'bill' || view === 'billPaid') {
        return (
            <SheetChrome onClose={onClose} maxHeight="92%">
                {view === 'billPaid' ? (
                    <div className="p-6 flex flex-col items-center text-center">
                        <div
                            className="size-[72px] rounded-full flex items-center justify-center mb-4"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: 'inset 2.5px 2.5px 5px rgba(166, 180, 200, 0.45), inset -2.5px -2.5px 5px rgba(255, 255, 255, 0.95)',
                                border: '2px solid #10B981',
                            }}
                        >
                            <CheckCheck size={38} className="text-[#10B981]" />
                        </div>
                        <h3 className="font-display text-[22px] font-black text-[#065F46]">Payment Settled!</h3>
                        <p className="text-sm text-slate-500 mt-1 font-semibold">Received {inr(orderTotal)} via {payMethod.toUpperCase()}</p>
                        
                        <div
                            className="w-full mt-5 rounded-2xl divide-y divide-slate-200/80 overflow-hidden"
                            style={{
                                backgroundColor: '#E8EEF5',
                                boxShadow: 'inset 2px 2px 5px rgba(166, 180, 200, 0.4), inset -2px -2px 5px rgba(255, 255, 255, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.8)',
                            }}
                        >
                            {[
                                ['Table Number', name],
                                ['Payment Mode', payMethod.toUpperCase()],
                                ['Amount Settled', inr(orderTotal)],
                            ].map(([k, v]) => (
                                <div key={k} className="flex justify-between px-4 py-3 text-[13px]">
                                    <span className="text-slate-500 font-semibold">{k}</span>
                                    <span className="font-black text-slate-800">{v}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-[11.5px] text-slate-500 mt-4 leading-relaxed font-medium">
                            Tap "Clear Table" below to complete orders and mark this table Available for the next guests.
                        </p>
                    </div>
                ) : (
                    <div className="p-5 overflow-y-auto overscroll-contain table-details-scroll flex-1 min-h-0">
                        <div className="flex items-center justify-between gap-3 mb-5">
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight truncate">Bill • {name}</h3>
                                <p className="text-xs text-slate-500 font-medium">{order ? `Order #${order.order_number} • ${order.items?.length ?? 0} items` : 'Dine-In Summary'}</p>
                            </div>
                            <div className="shrink-0">
                                <span
                                    className="px-3 py-1 rounded-full text-[10px] font-black tracking-wide inline-flex items-center gap-1.5"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                        border: `1px solid ${meta.color}60`,
                                        color: meta.color,
                                    }}
                                >
                                    <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                                    NEED BILL
                                </span>
                            </div>
                        </div>

                        {loadingOrder ? (
                            <div className="py-12 flex justify-center"><Spinner className="!border-slate-300 !border-t-w-brand" /></div>
                        ) : order ? (
                            <>
                                <SectionLabel className="mb-2">Ordered items · {order.items?.length ?? 0} item(s)</SectionLabel>
                                <div
                                    className="rounded-2xl divide-y divide-slate-200/70 overflow-hidden mb-4"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.38), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                                        border: '1px solid rgba(255, 255, 255, 0.8)',
                                    }}
                                >
                                    {(order.items || []).map((item: any, idx: number) => {
                                        const isCombo = isComboItem(item);
                                        const subItems = isCombo ? parseComboSubItems(item) : [];
                                        return (
                                            <div key={item.id || idx} className="px-3.5 py-3">
                                                <div className="flex items-center gap-3">
                                                    <span
                                                        className="shrink-0 px-2 py-0.5 rounded-lg text-w-brand-deep text-[11.5px] font-black"
                                                        style={{
                                                            backgroundColor: '#EEF2F6',
                                                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.4), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                                            border: '1px solid rgba(255, 107, 53, 0.3)',
                                                        }}
                                                    >
                                                        {item.quantity}x
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {isCombo && (
                                                                <span className="px-1.5 py-0.5 rounded bg-orange-500 text-white text-[9px] font-black uppercase tracking-wider">
                                                                    COMBO
                                                                </span>
                                                            )}
                                                            <p className="text-[13.5px] font-extrabold text-slate-800 truncate">{item.name}</p>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 font-semibold">{inr(item.price)} each</p>
                                                    </div>
                                                    <span className="w-num text-[13px] font-extrabold text-slate-800">{inr(item.price * item.quantity)}</span>
                                                </div>
                                                {isCombo && subItems.length > 0 && (() => {
                                                    const billComboKey = `bill-${item.id || idx}`;
                                                    const isBillExpanded = !!expandedCombos[billComboKey];
                                                    return (
                                                        <div className="ml-8 mt-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleCombo(billComboKey)}
                                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-bold text-slate-600 active:scale-95 transition-all"
                                                                style={{
                                                                    backgroundColor: isBillExpanded ? '#E2E8F0' : '#EEF2F6',
                                                                    boxShadow: '1px 1px 2px rgba(166, 180, 200, 0.25)',
                                                                }}
                                                            >
                                                                <span>{isBillExpanded ? 'Hide items inside combo' : 'See items inside combo'}</span>
                                                                <span className="text-[9.5px] font-bold text-slate-400">({subItems.length})</span>
                                                                <ChevronDown
                                                                    size={13}
                                                                    className={`text-slate-500 transition-transform duration-200 ${
                                                                        isBillExpanded ? 'rotate-180' : ''
                                                                    }`}
                                                                />
                                                            </button>
                                                            <AnimatePresence initial={false}>
                                                                {isBillExpanded && (
                                                                    <motion.div
                                                                        initial={{ opacity: 0, height: 0 }}
                                                                        animate={{ opacity: 1, height: 'auto' }}
                                                                        exit={{ opacity: 0, height: 0 }}
                                                                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                                                                        className="overflow-hidden"
                                                                    >
                                                                        <div
                                                                            className="mt-1.5 p-2.5 rounded-xl space-y-1.5"
                                                                            style={{
                                                                                backgroundColor: '#E8EDF4',
                                                                                boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35)',
                                                                                borderLeft: '3px solid #F97316',
                                                                            }}
                                                                        >
                                                                            <div className="flex items-center justify-between text-[9.5px] font-black uppercase tracking-wider text-slate-500">
                                                                                <span>Includes ({subItems.length} items):</span>
                                                                                <span>Individual Price</span>
                                                                            </div>
                                                                            {subItems.map((sub, sIdx) => (
                                                                                <div key={sIdx} className="flex items-center justify-between text-[11.5px] text-slate-700 font-medium">
                                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                                        <span className="truncate">• {sub.name}</span>
                                                                                        <span className="text-[10px] font-bold text-slate-400">×{sub.quantity * item.quantity}</span>
                                                                                    </div>
                                                                                    {sub.price != null && Number(sub.price) > 0 ? (
                                                                                        <span className="w-num text-[11px] font-bold text-slate-600 shrink-0 ml-2">
                                                                                            {inr(Number(sub.price))} <span className="text-[9.5px] text-slate-400 font-normal">each</span>
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="shrink-0 font-bold ml-2 text-slate-700">x{sub.quantity * item.quantity}</span>
                                                                                    )}
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </motion.div>
                                                                )}
                                                            </AnimatePresence>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Bill Summary Card */}
                                <div
                                    className="rounded-[20px] p-4 mb-4"
                                    style={{
                                        backgroundColor: '#E8EEF5',
                                        boxShadow: 'inset 2px 2px 5px rgba(166, 180, 200, 0.4), inset -2px -2px 5px rgba(255, 255, 255, 0.95)',
                                        border: '1px solid rgba(255, 255, 255, 0.7)',
                                    }}
                                >
                                    <BillRow label="Item Subtotal" value={inr(subtotal)} />
                                    <BillRow label="GST (Taxes)" value={`+ ${inr(gstAmount)}`} />
                                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5">CGST ({inr(cgstAmount)}) + SGST ({inr(sgstAmount)})</p>
                                    <div className="border-t border-slate-300/80 my-3" />
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[13px] font-black text-slate-800">TOTAL PAYABLE</p>
                                            <p className="text-[10px] text-slate-500 font-medium">Inclusive of all taxes</p>
                                        </div>
                                        <span className="w-num font-display text-[22px] font-black text-w-brand">{inr(orderTotal)}</span>
                                    </div>
                                </div>

                                {payMethod === 'QR' && (
                                    <div
                                        className="rounded-2xl p-4 mb-4 text-center animate-in fade-in duration-200"
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                                            border: '1px solid rgba(255, 255, 255, 0.8)',
                                        }}
                                    >
                                        <div className="flex items-center justify-between mb-3 px-1">
                                            <span className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-700 inline-flex items-center gap-1.5">
                                                <QrCode size={15} className="text-orange-500" /> UPI / Payment QR
                                            </span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 border border-orange-500/25">
                                                Scan to Pay
                                            </span>
                                        </div>
                                        {paymentQrUrl ? (
                                            <div className="flex flex-col items-center">
                                                <div
                                                    className="size-[200px] mx-auto p-2 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden"
                                                >
                                                    <img
                                                        src={paymentQrUrl}
                                                        alt="Official Payment QR"
                                                        className="size-full object-contain"
                                                    />
                                                </div>
                                                <p className="text-xs font-black text-slate-800 mt-2.5">
                                                    Scan with Google Pay, PhonePe, Paytm or BHIM
                                                </p>
                                                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                                                    Amount: <span className="font-extrabold text-slate-800">{inr(orderTotal)}</span>
                                                </p>
                                            </div>
                                        ) : upiId ? (
                                            <div className="flex flex-col items-center">
                                                <div className="size-[200px] mx-auto p-3 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center">
                                                    <QRCode
                                                        value={`upi://pay?pa=${upiId}&pn=${encodeURIComponent(name || 'Restaurant')}&am=${orderTotal}&cu=INR`}
                                                        size={180}
                                                    />
                                                </div>
                                                <p className="text-xs font-black text-slate-800 mt-2">UPI ID: {upiId}</p>
                                                <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                                                    Amount: <span className="font-extrabold text-slate-800">{inr(orderTotal)}</span>
                                                </p>
                                            </div>
                                        ) : (
                                            <div
                                                className="size-[160px] mx-auto rounded-2xl flex flex-col items-center justify-center text-slate-400 text-xs font-semibold p-3 gap-1.5"
                                                style={{
                                                    backgroundColor: '#EEF2F6',
                                                    boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.4), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                                }}
                                            >
                                                <QrCode size={26} className="text-slate-400 mb-1" />
                                                <p className="font-black text-slate-600">No Payment QR uploaded</p>
                                                <p className="text-[10px] text-slate-400 text-center leading-tight">
                                                    Upload in Admin Panel &gt; Restaurant Profile
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Payment method selector */}
                                <div
                                    className="flex rounded-2xl p-1.5 mb-3 gap-1.5"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: 'inset 2px 2px 5px rgba(166, 180, 200, 0.4), inset -2px -2px 5px rgba(255, 255, 255, 0.95)',
                                        border: '1px solid rgba(200, 212, 226, 0.5)',
                                    }}
                                >
                                    {([
                                        { key: 'Cash', icon: Banknote },
                                        { key: 'Card', icon: CreditCard },
                                        { key: 'QR', icon: QrCode },
                                    ] as const).map(({ key, icon: Icon }) => (
                                        <button
                                            key={key}
                                            onClick={() => { haptic.selection(); setPayMethod(key); }}
                                            className={`relative flex-1 h-10 rounded-xl text-xs font-black inline-flex items-center justify-center gap-1.5 transition-all ${
                                                payMethod === key
                                                    ? 'bg-w-brand text-white shadow-[0_3px_10px_rgba(255,107,53,0.4)]'
                                                    : 'text-slate-600 active:scale-95'
                                            }`}
                                            style={
                                                payMethod !== key
                                                    ? {
                                                          backgroundColor: '#EEF2F6',
                                                          boxShadow: '2px 2px 5px rgba(166, 180, 200, 0.35), -2px -2px 5px rgba(255, 255, 255, 0.95)',
                                                          border: '1px solid rgba(255, 255, 255, 0.8)',
                                                      }
                                                    : undefined
                                            }
                                        >
                                            <Icon size={14} />
                                            {key === 'QR' ? 'QR Code' : key}
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-8">
                                <Receipt size={32} className="text-slate-400 mx-auto mb-2" />
                                <p className="text-sm text-slate-500 font-semibold">No active orders on this table</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Sticky actions */}
                <div
                    className="shrink-0 p-4 flex gap-3 safe-bottom z-10"
                    style={{
                        backgroundColor: '#EEF2F6',
                        borderTop: '1px solid rgba(255, 255, 255, 0.9)',
                        boxShadow: '0 -4px 14px rgba(166, 180, 200, 0.25)',
                    }}
                >
                    {view === 'bill' && (
                        loadingOrder ? (
                            <AppButton variant="secondary" grow onClick={onClose}>Close</AppButton>
                        ) : order ? (
                            <>
                                <AppButton variant="secondary" grow onClick={onClose}>Close</AppButton>
                                <AppButton grow={3} loading={busy} onClick={doSettle} icon={<CheckCheck size={16} />}>
                                    Pay {inr(orderTotal)} ({payMethod === 'Card' ? 'Card' : payMethod === 'QR' ? 'UPI' : 'Cash'})
                                </AppButton>
                            </>
                        ) : (
                            <AppButton variant="secondary" grow onClick={onClose}>Close Bill</AppButton>
                        )
                    )}
                    {view === 'billPaid' && (
                        <AppButton grow loading={busy} icon={<Sparkles size={17} />} onClick={doClear}>
                            Clear Table & Mark Available
                        </AppButton>
                    )}
                </div>
            </SheetChrome>
        );
    }

    /* ── Details view ────────────────────────────────────────── */
    return (
        <SheetChrome onClose={onClose} maxHeight="88%">
            {/* Header */}
            <div className="p-5 pb-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h3 className="text-lg font-black text-slate-800 tracking-tight truncate">{name}</h3>
                        {table.area_name && (
                            <span className="shrink-0 px-2.5 py-0.5 rounded-lg text-xs font-black text-white bg-w-brand shadow-[0_2px_8px_rgba(255,107,53,0.38)]">
                                {table.area_name}
                            </span>
                        )}
                    </div>
                </div>
                <div className="shrink-0">
                    <span
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-black tracking-wide"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '2px 2px 5px rgba(166, 180, 200, 0.35), -2px -2px 5px rgba(255, 255, 255, 0.95)',
                            border: `1px solid ${meta.color}66`,
                            color: meta.color,
                        }}
                    >
                        <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
                        {meta.label}
                    </span>
                </div>
            </div>

            <div className="px-5 pb-5 overflow-y-auto overscroll-contain table-details-scroll flex-1 min-h-0">
                {/* Assignment banner */}
                {isTransferred && (
                    <div
                        className="rounded-2xl p-3.5 mb-3"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                            border: '1.5px solid rgba(244, 114, 182, 0.6)',
                        }}
                    >
                        <div className="flex gap-1.5 mb-2.5">
                            <span className="px-2 py-0.5 rounded-md bg-[#DB2777] text-white text-[9.5px] font-black tracking-[0.08em]">TABLE TRANSFERRED</span>
                            {transferredToMe && (
                                <span className="px-2 py-0.5 rounded-md bg-[#BE185D]/15 border border-[#DB2777] text-[#831843] text-[9.5px] font-black tracking-[0.08em]">YOU (NEW OWNER)</span>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div
                                className="rounded-xl p-2.5"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                    border: '1px solid rgba(251, 207, 232, 0.8)',
                                }}
                            >
                                <p className="text-[8.5px] font-black text-slate-500 tracking-wider mb-0.5">ORIGINAL ASSIGNED</p>
                                <p className="text-[13px] font-black text-[#831843] truncate">{table.transferred_from_waiter_name}</p>
                            </div>
                            <div
                                className="rounded-xl p-2.5"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                    border: '1px solid rgba(251, 207, 232, 0.8)',
                                }}
                            >
                                <p className="text-[8.5px] font-black text-slate-500 tracking-wider mb-0.5">TRANSFERRED TO</p>
                                <p className="text-[13px] font-black text-[#500724] truncate">{table.transferred_to_waiter_name}</p>
                            </div>
                        </div>
                    </div>
                )}

                {!isTransferred && (isMine || isCo) && (table.co_waiter_names || []).length > 0 && (
                    <div
                        className="rounded-2xl p-3.5 mb-3"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                            border: '1.5px solid rgba(129, 140, 248, 0.6)',
                        }}
                    >
                        <div className="flex items-center gap-3">
                            {table.assigned_waiter_avatar ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={table.assigned_waiter_avatar}
                                    alt={assigned || ''}
                                    className="size-10 rounded-xl object-cover border-2 border-white shadow-xs shrink-0"
                                />
                            ) : null}
                            <div>
                                <span className="px-2 py-0.5 rounded-md bg-[#4F46E5] text-white text-[9.5px] font-black tracking-[0.08em]">CO-MANAGED TABLE</span>
                                <p className="text-xs text-[#4338CA] mt-1 font-bold">
                                    {assigned ? `Assigned: ${assigned} & Co-waiters: ${(Array.isArray(table.co_waiter_names) ? table.co_waiter_names : [table.co_waiter_names]).join(', ')}` : 'Both waiters can add items, place orders, and manage this table.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {!isTransferred && assigned && !isCo && (
                    <div
                        className="rounded-2xl p-3.5 mb-3 flex items-center gap-3"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                            border: `1.5px solid ${isMine ? 'rgba(16, 185, 129, 0.6)' : 'rgba(59, 130, 246, 0.6)'}`,
                        }}
                    >
                        {table.assigned_waiter_avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={table.assigned_waiter_avatar}
                                alt={assigned}
                                className="size-11 rounded-xl object-cover border-2 border-white shadow-xs shrink-0"
                            />
                        ) : (
                            <div
                                className={`size-11 rounded-xl flex items-center justify-center font-display font-black text-white ${isMine ? 'bg-[#10B981]' : 'bg-[#3B82F6]'}`}
                                style={{
                                    boxShadow: isMine ? '0 2px 8px rgba(16, 185, 129, 0.4)' : '0 2px 8px rgba(59, 130, 246, 0.4)',
                                }}
                            >
                                {assigned.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <p className={`text-[10px] font-black tracking-wider ${isMine ? 'text-[#047857]' : 'text-[#1D4ED8]'}`}>ASSIGNED WAITER</p>
                            <p className={`text-base font-black ${isMine ? 'text-[#065F46]' : 'text-[#1E40AF]'}`}>{assigned}</p>
                        </div>
                    </div>
                )}

                {!canManage && (
                    <div
                        className="rounded-2xl p-4 mb-3"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                            border: '1.5px solid rgba(239, 68, 68, 0.4)',
                        }}
                    >
                        <p className="inline-flex items-center gap-1.5 text-[10px] font-black tracking-[0.08em] text-red-600 mb-1">
                            <Lock size={12} /> TABLE ASSIGNED TO {assigned ? assigned.toUpperCase() : 'ANOTHER WAITER'}
                        </p>
                        <p className="text-[11.5px] text-slate-600 leading-relaxed mb-3 font-medium">
                            This table is assigned to {assigned || 'another waiter'}. You cannot take orders or add items unless {assigned || 'the assigned waiter'} grants access.
                        </p>
                        <div className="flex gap-2">
                            <AppButton
                                variant="secondary"
                                grow={1}
                                disabled={accessRequested || busy}
                                loading={busy}
                                icon={<ArrowRightLeft size={14} />}
                                onClick={handleRequestAccess}
                            >
                                {accessRequested ? 'Request Pending Approval...' : 'Request Access'}
                            </AppButton>
                        </div>
                    </div>
                )}

                {canManage && !assigned && !table.is_group && status !== 'available' && (
                    <div
                        className="rounded-xl px-3 py-2.5 mb-3 inline-flex items-center gap-2"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(200, 212, 226, 0.5)',
                        }}
                    >
                        <UserX size={14} className="text-slate-500" />
                        <span className="text-xs font-bold text-slate-600">No Waiter Assigned Yet</span>
                    </div>
                )}

                {/* Merged banner */}
                {table.is_group && (
                    <div
                        className="rounded-2xl p-3.5 mb-3 flex items-center gap-3"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                            border: '1.5px solid rgba(255, 107, 53, 0.5)',
                        }}
                    >
                        <Link2 size={22} className="text-w-brand shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-w-brand">Merged Table Group</p>
                            <p className="text-[11px] text-slate-500 font-medium">This table is merged with other tables for a group.</p>
                        </div>
                        {canManage && (
                            <button onClick={doUnmerge} disabled={busy} className="shrink-0 inline-flex items-center gap-1 text-xs font-black text-w-alert">
                                <Unlink size={13} /> Unmerge
                            </button>
                        )}
                    </div>
                )}

                {/* Quick actions */}
                <SectionLabel className="mb-2">Quick actions</SectionLabel>
                <div className="grid grid-cols-4 gap-2 mb-5">
                    <QuickAction
                        icon={<PlusCircle size={20} className={canManage ? "text-w-brand" : "text-slate-400"} />}
                        label={hasExistingItems ? "Add Items" : "Take Order"}
                        onClick={goToMenu}
                        disabled={busy || !canManage}
                    />
                    <QuickAction
                        icon={<UserPlus size={20} className={canManage ? "text-[#4F46E5]" : "text-slate-400"} />}
                        label={isAvailableTable ? "Assign" : "Give Access"}
                        onClick={() => isAvailableTable ? doSeatAndAssign() : setGiveAccessOpen(true)}
                        disabled={busy || !canManage}
                    />
                    <QuickAction
                        icon={<Receipt size={20} className={!canManage ? "text-slate-400" : (status === 'need_bill' ? 'text-[#8B5CF6]' : 'text-[#10B981]')} />}
                        label={status === 'need_bill' ? 'View Bill' : 'Request Bill'}
                        onClick={() => (status === 'need_bill' ? setView('bill') : doRequestBill())}
                        disabled={busy || isAvailableTable || !canManage}
                    />
                    <QuickAction
                        icon={<Trash2 size={20} className={canManage ? "text-w-alert" : "text-slate-400"} />}
                        label="Clear Table"
                        onClick={() => setConfirmClear(true)}
                        disabled={busy || isAvailableTable || !canManage}
                    />
                </div>

                {/* Active order */}
                {loadingOrder ? (
                    <div className="py-8 flex justify-center"><Spinner className="!border-slate-300 !border-t-w-brand" /></div>
                ) : order && (order.items?.length ?? 0) > 0 ? (
                    <>
                        <div className="flex items-center justify-between mb-2">
                            <SectionLabel>Active order items · {order.items?.length ?? 0}</SectionLabel>
                        </div>
                        {readyItems.length > 0 && canManage && (
                            <button
                                onClick={doServeAll}
                                disabled={busy}
                                className="w-full h-12 mb-3 rounded-[16px] bg-[#10B981] text-white text-xs font-black tracking-[0.08em] shadow-[0_4px_14px_rgba(16,185,129,0.35)] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2"
                            >
                                <CheckCheck size={17} /> SERVE ALL READY ITEMS
                            </button>
                        )}
                        <div className="space-y-2.5">
                            {(order.items || []).map((item: any, idx: number) => {
                                const isReady = item.status === 'ready';
                                const isServed = item.status === 'served' || item.status === 'paid';
                                const isPreparing = ['preparing', 'cooking', 'placed'].includes(item.status);
                                const isCombo = isComboItem(item);
                                const subItems = isCombo ? parseComboSubItems(item) : [];
                                const displayImg = item.combo_image || item.image_url || getCategoryMenuItemImage(item.name);

                                if (isCombo) {
                                    return (
                                        <div
                                            key={item.id || idx}
                                            className="rounded-2xl p-3.5"
                                            style={{
                                                backgroundColor: '#EEF2F6',
                                                boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                                                border: isReady ? '1.5px solid #10B981' : '1px solid rgba(255, 255, 255, 0.8)',
                                            }}
                                        >
                                            {/* Combo Header */}
                                            <div className="flex items-center gap-3">
                                                <div className="relative shrink-0">
                                                    <div
                                                        className="size-[48px] rounded-xl overflow-hidden flex items-center justify-center"
                                                        style={{
                                                            backgroundColor: '#EEF2F6',
                                                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.4), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                                            border: isReady ? '1.5px solid #10B981' : '1px solid rgba(255, 255, 255, 0.8)',
                                                        }}
                                                    >
                                                        <img
                                                            src={displayImg}
                                                            alt={item.name}
                                                            className="size-full object-cover"
                                                            onError={(e) => {
                                                                const target = e.currentTarget;
                                                                const fallback = getCategoryMenuItemImage(item.name);
                                                                if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                                                    target.src = fallback;
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                    <span className={`absolute -top-1.5 -left-1.5 px-1 py-px rounded-md text-[9.5px] font-black text-white border-[1.2px] border-white ${
                                                        isReady ? 'bg-[#10B981]' : isServed ? 'bg-[#64748B]' : 'bg-w-brand'
                                                    }`}>
                                                        {item.quantity}x
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="px-1.5 py-0.5 rounded-md bg-orange-500 text-white text-[9px] font-black tracking-wider uppercase">
                                                            COMBO
                                                        </span>
                                                        <p className={`text-sm truncate ${isServed ? 'font-semibold text-slate-400' : 'font-extrabold text-slate-800'}`}>{item.name}</p>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Combo Price: {inr(item.price)} each</p>
                                                    {isReady && <p className="text-[11px] font-black text-[#047857] mt-0.5">● Ready to Serve</p>}
                                                    {isPreparing && <p className="text-[11px] font-black text-[#D97706] inline-flex items-center gap-1 mt-0.5"><Flame size={10} /> Preparing in Kitchen</p>}
                                                    {isServed && <p className="text-[11px] font-semibold text-slate-400 mt-0.5">✓ Served</p>}
                                                </div>
                                                <div className="shrink-0 flex flex-col items-end gap-1.5">
                                                    <span className="w-num text-sm font-extrabold text-slate-800">{inr(item.price * item.quantity)}</span>
                                                    {isReady && (
                                                        canManage ? (
                                                            <button
                                                                onClick={() => doServeItem(item.id)}
                                                                className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg bg-[#10B981] text-white text-[11px] font-black active:scale-95 transition-transform"
                                                                style={{ boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)' }}
                                                            >
                                                                <CheckCheck size={12} /> Serve
                                                            </button>
                                                        ) : (
                                                            <span
                                                                className="inline-flex items-center gap-1 px-2 h-6 rounded-md text-slate-500 text-[10px] font-bold"
                                                                style={{
                                                                    backgroundColor: '#EEF2F6',
                                                                    boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.35)',
                                                                }}
                                                            >
                                                                <Lock size={10} /> Locked
                                                            </span>
                                                        )
                                                    )}
                                                </div>
                                            </div>

                                            {/* Drop down button to see items inside combo */}
                                            {(() => {
                                                const comboKey = item.id ? String(item.id) : `combo-${idx}`;
                                                const isExpanded = !!expandedCombos[comboKey];

                                                return (
                                                    <>
                                                        <div className="mt-2.5 pt-2 border-t border-slate-200/80">
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleCombo(comboKey)}
                                                                className="w-full py-2 px-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all active:scale-[0.99]"
                                                                style={{
                                                                    backgroundColor: isExpanded ? '#E2E8F0' : '#E8EDF4',
                                                                    boxShadow: isExpanded
                                                                        ? 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.4)'
                                                                        : '1.5px 1.5px 3px rgba(166, 180, 200, 0.3), -1px -1px 2px rgba(255, 255, 255, 0.8)',
                                                                    border: '1px solid rgba(255, 255, 255, 0.7)',
                                                                }}
                                                            >
                                                                <span className="inline-flex items-center gap-1.5 text-[11.5px] font-black text-slate-700">
                                                                    <span className="size-2 rounded-full bg-orange-500" />
                                                                    {isExpanded ? 'Hide items inside combo' : 'See items inside combo'}
                                                                    <span className="text-[10px] font-bold text-slate-500">
                                                                        ({subItems.length} {subItems.length === 1 ? 'item' : 'items'})
                                                                    </span>
                                                                </span>
                                                                <div className="inline-flex items-center gap-1.5 text-slate-600">
                                                                    <span className="text-[10.5px] font-black text-orange-600">
                                                                        {isExpanded ? 'Collapse' : 'Expand'}
                                                                    </span>
                                                                    <ChevronDown
                                                                        size={15}
                                                                        className={`text-slate-600 transition-transform duration-200 ${
                                                                            isExpanded ? 'rotate-180' : ''
                                                                        }`}
                                                                    />
                                                                </div>
                                                            </button>
                                                        </div>

                                                        {/* Included Items Breakdown with Images and Individual Pricing */}
                                                        <AnimatePresence initial={false}>
                                                            {isExpanded && (
                                                                <motion.div
                                                                    initial={{ opacity: 0, height: 0 }}
                                                                    animate={{ opacity: 1, height: 'auto' }}
                                                                    exit={{ opacity: 0, height: 0 }}
                                                                    transition={{ duration: 0.22, ease: 'easeInOut' }}
                                                                    className="overflow-hidden space-y-1.5 pt-2"
                                                                >
                                                                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between px-1">
                                                                        <span>Includes ({subItems.length} items):</span>
                                                                        {subItems.length > 0 && (
                                                                            <span className="text-[9.5px] font-bold text-slate-400">Total portions: {subItems.reduce((acc, s) => acc + (s.quantity * item.quantity), 0)}</span>
                                                                        )}
                                                                    </div>
                                                                    {subItems.length > 0 ? (
                                                                        <div className="space-y-1.5 mt-1">
                                                                            {subItems.map((sub, sIdx) => {
                                                                                const subImg = sub.image_url || getCategoryMenuItemImage(sub.name);
                                                                                const isVeg = sub.item_type?.toLowerCase() === 'veg';
                                                                                return (
                                                                                    <div
                                                                                        key={sIdx}
                                                                                        className="flex items-center justify-between gap-2.5 p-2 px-2.5 rounded-xl text-xs transition-all"
                                                                                        style={{
                                                                                            backgroundColor: '#E8EDF4',
                                                                                            boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.3)',
                                                                                            border: '1px solid rgba(255, 255, 255, 0.6)',
                                                                                        }}
                                                                                    >
                                                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                                                            <div className="size-9 rounded-lg overflow-hidden bg-white border border-slate-200/80 shrink-0">
                                                                                                <img
                                                                                                    src={subImg}
                                                                                                    alt={sub.name}
                                                                                                    className="size-full object-cover"
                                                                                                    onError={(e) => {
                                                                                                        const target = e.currentTarget;
                                                                                                        const fallback = getCategoryMenuItemImage(sub.name);
                                                                                                        if (target.src !== fallback && !target.src.endsWith(fallback)) {
                                                                                                            target.src = fallback;
                                                                                                        }
                                                                                                    }}
                                                                                                />
                                                             </div>
                                                                                            <div className="min-w-0 flex flex-col justify-center">
                                                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                                                    <span className={`size-1.5 rounded-full shrink-0 ${isVeg ? 'bg-[#16A34A]' : 'bg-[#DC2626]'}`} />
                                                                                                    <span className="font-bold text-slate-800 truncate text-[12.5px]">{sub.name}</span>
                                                                                                </div>
                                                                                                {sub.price != null && Number(sub.price) > 0 && (
                                                                                                    <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                                                                                                        Individual Price: <span className="font-bold text-slate-700">{inr(Number(sub.price))}</span>
                                                                                                    </p>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="shrink-0 flex items-center gap-2">
                                                                                            {sub.price != null && Number(sub.price) > 0 && (
                                                                                                <div className="text-right">
                                                                                                    <span className="w-num text-xs font-black text-slate-800">
                                                                                                        {inr(Number(sub.price))}
                                                                                                    </span>
                                                                                                    <span className="text-[9px] text-slate-400 font-bold block uppercase -mt-0.5">
                                                                                                        each
                                                                                                    </span>
                                                                                                </div>
                                                                                            )}
                                                                                            <span
                                                                                                className="shrink-0 text-[11px] font-black text-slate-700 px-2 py-0.5 rounded-md"
                                                                                                style={{
                                                                                                    backgroundColor: '#EEF2F6',
                                                                                                    boxShadow: '1px 1px 3px rgba(166, 180, 200, 0.35)',
                                                                                                }}
                                                                                            >
                                                                                                x{sub.quantity * item.quantity}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    ) : (
                                                                        <div
                                                                            className="p-3 rounded-xl text-center"
                                                                            style={{
                                                                                backgroundColor: '#E8EDF4',
                                                                                boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.3)',
                                                                            }}
                                                                        >
                                                                            <p className="text-xs text-slate-500 font-bold">Includes bundled dishes from this combo package</p>
                                                                        </div>
                                                                    )}
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={item.id || idx}
                                        className="rounded-2xl p-3 flex items-center gap-3"
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                                            border: isReady ? '1.5px solid #10B981' : '1px solid rgba(255, 255, 255, 0.8)',
                                        }}
                                    >
                                        <div className="relative shrink-0">
                                            <div
                                                className="size-[46px] rounded-[10px] overflow-hidden flex items-center justify-center"
                                                style={{
                                                    backgroundColor: '#EEF2F6',
                                                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.4), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                                    border: isReady ? '1.5px solid #10B981' : '1px solid rgba(255, 255, 255, 0.8)',
                                                }}
                                            >
                                                {item.image_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={item.image_url} alt="" className="size-full object-cover" />
                                                ) : (
                                                    <UtensilFallback />
                                                )}
                                            </div>
                                            <span className={`absolute -top-1.5 -left-1.5 px-1 py-px rounded-md text-[9.5px] font-black text-white border-[1.2px] border-white ${
                                                isReady ? 'bg-[#10B981]' : isServed ? 'bg-[#64748B]' : 'bg-w-brand'
                                            }`}>
                                                {item.quantity}x
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm truncate ${isServed ? 'font-semibold text-slate-400' : 'font-extrabold text-slate-800'}`}>{item.name}</p>
                                            {isReady && <p className="text-[11px] font-black text-[#047857]">● Ready to Serve</p>}
                                            {isPreparing && <p className="text-[11px] font-black text-[#D97706] inline-flex items-center gap-1"><Flame size={10} /> Preparing in Kitchen</p>}
                                            {isServed && <p className="text-[11px] font-semibold text-slate-400">✓ Served</p>}
                                        </div>
                                        <div className="shrink-0 flex flex-col items-end gap-1.5">
                                            <span className="w-num text-sm font-extrabold text-slate-800">{inr(item.price * item.quantity)}</span>
                                            {isReady && (
                                                canManage ? (
                                                    <button
                                                        onClick={() => doServeItem(item.id)}
                                                        className="inline-flex items-center gap-1 px-2.5 h-7 rounded-lg bg-[#10B981] text-white text-[11px] font-black active:scale-95 transition-transform"
                                                        style={{ boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)' }}
                                                    >
                                                        <CheckCheck size={12} /> Serve
                                                    </button>
                                                ) : (
                                                    <span
                                                        className="inline-flex items-center gap-1 px-2 h-6 rounded-md text-slate-500 text-[10px] font-bold"
                                                        style={{
                                                            backgroundColor: '#EEF2F6',
                                                            boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.35)',
                                                        }}
                                                    >
                                                        <Lock size={10} /> Locked
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Bill Breakdown: Item Amount, GST, Total Amount */}
                        <div
                            className="mt-4 rounded-2xl p-4"
                            style={{
                                backgroundColor: '#E8EEF5',
                                boxShadow: 'inset 2px 2px 5px rgba(166, 180, 200, 0.4), inset -2px -2px 5px rgba(255, 255, 255, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.7)',
                            }}
                        >
                            <div className="flex items-center justify-between pb-2.5 border-b border-slate-300/70">
                                <div className="flex items-center gap-1.5 text-slate-700 font-extrabold text-xs">
                                    <Receipt size={14} className="text-slate-500" />
                                    <span>Bill & Tax Breakdown</span>
                                </div>
                                <span className="text-[11px] font-bold text-slate-500">
                                    {order.items?.length ?? 0} {((order.items?.length ?? 0) === 1) ? 'item' : 'items'}
                                </span>
                            </div>

                            <div className="pt-3 space-y-2 text-[13px]">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-600 font-semibold">Item Amount (Subtotal)</span>
                                    <span className="font-extrabold text-slate-800 w-num">{inr(subtotal)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-slate-600 font-semibold">GST (Taxes)</span>
                                        <p className="text-[10px] text-slate-500 font-semibold">CGST ({inr(cgstAmount)}) + SGST ({inr(sgstAmount)})</p>
                                    </div>
                                    <span className="font-extrabold text-[#D97706] w-num">+{inr(gstAmount)}</span>
                                </div>
                                <div className="border-t border-dashed border-slate-300/80 my-1.5" />
                                <div className="flex justify-between items-end pt-0.5">
                                    <div>
                                        <p className="text-[12px] font-black text-slate-800 uppercase tracking-wider">Total Amount</p>
                                        <p className="text-[10px] text-slate-500 font-medium">Inclusive of all taxes</p>
                                    </div>
                                    <span className="w-num font-display text-xl font-black text-w-brand">{inr(orderTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </>
                ) : status === 'dirty' ? (
                    <div
                        className="rounded-2xl p-5 text-center mt-2"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '3px 3px 8px rgba(166, 180, 200, 0.35), -3px -3px 8px rgba(255, 255, 255, 0.95)',
                            border: '1.5px solid rgba(100, 116, 139, 0.3)',
                        }}
                    >
                        <div className="size-12 rounded-2xl mx-auto flex items-center justify-center mb-3 bg-slate-200 text-slate-600 shadow-inner">
                            <Sparkles size={22} className="text-slate-600" />
                        </div>
                        <h4 className="text-base font-black text-slate-800">Table Needs Cleaning</h4>
                        <p className="text-xs text-slate-500 font-semibold mt-1 mb-4 max-w-xs mx-auto">
                            Payment is settled. Clean and sanitize the table, then mark it available for new guests.
                        </p>
                        {canManage && (
                            <AppButton grow loading={busy} icon={<Sparkles size={17} />} onClick={doClear} className="w-full">
                                Clear Table & Mark Available
                            </AppButton>
                        )}
                    </div>
                ) : null}
            </div>

            {/* Give access sub-sheet */}
            <AnimatePresence>
                {giveAccessOpen && (
                    <GiveAccessSheet
                        table={table}
                        restaurantId={restaurantId}
                        currentWaiter={currentWaiter}
                        onClose={() => setGiveAccessOpen(false)}
                        onDone={(isTransfer) => {
                            setGiveAccessOpen(false);
                            onChanged();
                            if (isTransfer) {
                                onClose(); // Immediately close details sheet so transferred waiter has no lingering UI
                            }
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Clear confirm */}
            <AnimatePresence>
                {confirmClear && (
                    <div className="fixed inset-0 z-[95] flex items-center justify-center p-6">
                        <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmClear(false)} />
                        <motion.div
                            initial={{ scale: 0.92, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative w-full max-w-[320px] rounded-[28px] p-6"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25), 4px 4px 12px rgba(166, 180, 200, 0.4), -4px -4px 12px rgba(255, 255, 255, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.9)',
                            }}
                        >
                            <div
                                className="size-14 rounded-2xl flex items-center justify-center mb-4"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 2px 2px 4px rgba(239, 68, 68, 0.25), inset -2px -2px 4px rgba(255, 255, 255, 0.95)',
                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                }}
                            >
                                <Trash2 size={24} className="text-w-alert" />
                            </div>
                            <h3 className="text-lg font-black text-slate-800">Clear {name}?</h3>
                            <p className="text-[13px] text-slate-500 font-semibold mt-1">This marks the table Available for new guests.</p>
                            <div className="flex gap-3 mt-6">
                                <AppButton variant="secondary" grow className="!h-12" onClick={() => setConfirmClear(false)}>Cancel</AppButton>
                                <AppButton variant="danger" grow className="!h-12" loading={busy} onClick={doClear}>Clear Table</AppButton>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </SheetChrome>
    );
}

/* ── Chrome ──────────────────────────────────────────────────── */
function SheetChrome({ children, onClose, maxHeight }: { children: React.ReactNode; onClose: () => void; maxHeight: string }) {
    const dragControls = useDragControls();
    const modalRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    // Lock background scroll (body, html, and waiter shift scroll container)
    useEffect(() => {
        const prevBodyOverflow = document.body.style.overflow;
        const prevHtmlOverflow = document.documentElement.style.overflow;
        const scrollContainer = document.getElementById('waiter-page-scroll-container');
        const prevContainerOverflow = scrollContainer ? scrollContainer.style.overflow : '';

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        if (scrollContainer) {
            scrollContainer.style.overflow = 'hidden';
        }

        return () => {
            document.body.style.overflow = prevBodyOverflow;
            document.documentElement.style.overflow = prevHtmlOverflow;
            if (scrollContainer) {
                scrollContainer.style.overflow = prevContainerOverflow;
            }
        };
    }, []);

    // Isolate mouse wheel & touch gestures strictly to the table details sheet
    useEffect(() => {
        const modalEl = modalRef.current;
        if (!modalEl) return;

        const onWheel = (e: WheelEvent) => {
            const scrollable = (e.target as HTMLElement | null)?.closest?.('.table-details-scroll, .overflow-y-auto') as HTMLElement | null;
            if (!scrollable) {
                // Not over a scrollable inner element (e.g. over backdrop, header, or static action bar)
                e.preventDefault();
                return;
            }

            const { scrollTop, scrollHeight, clientHeight } = scrollable;
            const isScrollable = scrollHeight > clientHeight;

            if (!isScrollable) {
                e.preventDefault();
                return;
            }

            const isAtTop = scrollTop <= 0;
            const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

            // If user scrolls up while already at top, or down while already at bottom:
            // prevent default so it doesn't propagate / chain to the background floor
            if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
                e.preventDefault();
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            const scrollable = (e.target as HTMLElement | null)?.closest?.('.table-details-scroll, .overflow-y-auto') as HTMLElement | null;
            if (!scrollable) {
                // Dragging on backdrop or static header
                if (e.cancelable) e.preventDefault();
            }
        };

        modalEl.addEventListener('wheel', onWheel, { passive: false });
        modalEl.addEventListener('touchmove', onTouchMove, { passive: false });

        return () => {
            modalEl.removeEventListener('wheel', onWheel);
            modalEl.removeEventListener('touchmove', onTouchMove);
        };
    }, []);

    return (
        <div ref={modalRef} className="fixed inset-0 z-[85] flex items-end justify-center" role="dialog" aria-modal="true">
            <motion.button
                aria-label="Close"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/45 cursor-default backdrop-blur-[2px]"
            />
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={springSoft}
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.5 }}
                dragSnapToOrigin
                onDragEnd={(_, info) => {
                    if (info.offset.y > 60 || info.velocity.y > 250) {
                        haptic.light();
                        onClose();
                    }
                }}
                className="relative w-full max-w-md rounded-t-[32px] flex flex-col overflow-hidden"
                style={{
                    maxHeight,
                    backgroundColor: '#EEF2F6',
                    borderTop: '1.5px solid rgba(255, 255, 255, 0.95)',
                    boxShadow: '0 -10px 32px rgba(166, 180, 200, 0.45)',
                }}
            >
                {/* Drag handle and close button header */}
                <div
                    onPointerDown={(e) => {
                        if ((e.target as HTMLElement).closest('button')) return;
                        dragControls.start(e);
                    }}
                    className="relative pt-3 pb-2 px-4 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
                >
                    <span
                        className="w-12 h-1.5 rounded-full"
                        style={{
                            backgroundColor: '#D1D9E4',
                            boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.6)',
                        }}
                    />
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            haptic.light();
                            onClose();
                        }}
                        aria-label="Minimize"
                        title="Minimize"
                        className="absolute right-3.5 top-2 size-8 rounded-full text-white bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center transition-all cursor-pointer active:scale-90"
                        style={{
                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                        }}
                    >
                        <X size={17} className="stroke-[2.5]" />
                    </button>
                </div>
                {children}
            </motion.div>
        </div>
    );
}

function QuickAction({ icon, label, onClick, disabled, hint }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; hint?: string }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={hint}
            className="rounded-2xl p-2.5 flex flex-col items-center gap-1.5 active:scale-95 transition-all disabled:opacity-45"
            style={{
                backgroundColor: '#EEF2F6',
                boxShadow: '3px 3px 7px rgba(166, 180, 200, 0.38), -3px -3px 7px rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.85)',
            }}
        >
            <div
                className="size-8 rounded-xl flex items-center justify-center"
                style={{
                    backgroundColor: '#EEF2F6',
                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                }}
            >
                {icon}
            </div>
            <span className="text-[10.5px] font-black text-slate-800 text-center leading-tight">{label}</span>
        </button>
    );
}

function BillRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between py-1 text-[13px]">
            <span className="text-slate-600 font-semibold">{label}</span>
            <span className="w-num font-black text-slate-800">{value}</span>
        </div>
    );
}

function UtensilFallback() {
    return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="1.8">
            <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
        </svg>
    );
}

/* ── Give Access sub-sheet ───────────────────────────────────── */
function GiveAccessSheet({
    table, restaurantId, currentWaiter, onClose, onDone,
}: {
    table: FloorTableLike;
    restaurantId: string;
    currentWaiter: { id: string; role?: string; name?: string } | null;
    onClose: () => void;
    onDone: (isTransfer?: boolean) => void;
}) {
    const [waiters, setWaiters] = useState<WaiterRow[]>([]);
    const [selected, setSelected] = useState<WaiterRow | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const { data, error } = await supabase.rpc('get_available_waiters', {
                    p_restaurant_id: restaurantId,
                    p_exclude_employee_id: currentWaiter?.id || null,
                });
                if (!error && Array.isArray(data)) setWaiters(data);
            } catch (e) {
                console.error(e);
            }
        })();
    }, [restaurantId, currentWaiter?.id]);

    const grant = async (grantType: 'share' | 'transfer') => {
        if (!selected) return;
        setBusy(true);
        try {
            await OrderService.grantTableAccess(
                table.id,
                selected.id,
                grantType,
                table.assigned_waiter_id || currentWaiter?.id || '',
                restaurantId
            );
            haptic.success();
            if (grantType === 'transfer') {
                toast.success(`Table ${table.table_number} transferred completely to ${selected.name}`);
                onDone(true);
            } else {
                toast.success(`Shared access granted for Table ${table.table_number} (Both can manage)`);
                onDone(false);
            }
        } catch (e: any) {
            console.error(e);
            toast.error(e?.message || 'Failed to grant access');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[92] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                transition={springSoft}
                className="relative w-full max-w-md rounded-t-[32px] flex flex-col max-h-[85%]"
                style={{
                    backgroundColor: '#EEF2F6',
                    borderTop: '1.5px solid rgba(255, 255, 255, 0.95)',
                    boxShadow: '0 -10px 32px rgba(166, 180, 200, 0.45)',
                }}
            >
                <div className="pt-3 flex justify-center">
                    <span
                        className="w-10 h-1 rounded-full"
                        style={{ backgroundColor: '#D1D9E4', boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.6)' }}
                    />
                </div>
                <div className="p-5 pb-3 flex items-center gap-3">
                    <div
                        className="size-11 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.4), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(79, 70, 229, 0.3)',
                        }}
                    >
                        <UserPlus size={20} className="text-[#4F46E5]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-base font-black text-slate-800">Give Access • Table {table.table_number}</h3>
                        <p className="text-xs text-slate-500 font-semibold">Select a waiter to share or transfer table control</p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="size-8 rounded-full text-white bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center active:scale-90"
                        style={{
                            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                        }}
                    >
                        <X size={17} className="stroke-[2.5]" />
                    </button>
                </div>

                <div className="px-5 pb-4 overflow-y-auto overscroll-contain table-details-scroll flex-1 space-y-2.5">
                    {waiters.length === 0 && <p className="text-sm text-slate-500 font-semibold text-center py-6">No other waiters available.</p>}
                    {waiters.map((w) => {
                        const isSel = selected?.id === w.id;
                        const busyLoad = (w.active_tables ?? 0) > 3;
                        return (
                            <button
                                key={w.id}
                                onClick={() => { haptic.selection(); setSelected(w); }}
                                className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:scale-[0.99]"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: isSel
                                        ? 'inset 2.5px 2.5px 5px rgba(166, 180, 200, 0.45), inset -2.5px -2.5px 5px rgba(255, 255, 255, 0.95)'
                                        : '3px 3px 7px rgba(166, 180, 200, 0.35), -3px -3px 7px rgba(255, 255, 255, 0.95)',
                                    border: isSel ? '2px solid #4F46E5' : '1px solid rgba(255, 255, 255, 0.8)',
                                }}
                            >
                                <span className="relative size-11 rounded-xl bg-[#4F46E5] text-white flex items-center justify-center font-display font-black shrink-0 shadow-md">
                                    {w.name?.charAt(0) || '?'}
                                    <span className="absolute bottom-0 right-0 size-3 rounded-full bg-[#10B981] border-2 border-white" />
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="flex items-center gap-2">
                                        <span className="text-[15px] font-black text-slate-800 truncate">{w.name}</span>
                                        <span className="px-1.5 py-px rounded bg-[#10B981]/15 text-[#047857] text-[8.5px] font-black tracking-wide">ONLINE</span>
                                    </span>
                                    <span className={`block text-[11px] font-bold mt-0.5 ${busyLoad ? 'text-[#D97706]' : 'text-[#059669]'}`}>
                                        ID: {w.employee_id || '—'} • {w.active_tables ?? 0} active table(s)
                                    </span>
                                </span>
                                <span
                                    className="size-6 rounded-full flex items-center justify-center shrink-0"
                                    style={{
                                        backgroundColor: isSel ? '#4F46E5' : '#EEF2F6',
                                        boxShadow: isSel
                                            ? '0 2px 6px rgba(79, 70, 229, 0.4)'
                                            : 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.4)',
                                    }}
                                >
                                    {isSel && <CheckCheck size={14} className="text-white" />}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {selected && (
                    <div
                        className="p-4 space-y-2.5 safe-bottom"
                        style={{
                            backgroundColor: '#EEF2F6',
                            borderTop: '1px solid rgba(255, 255, 255, 0.9)',
                            boxShadow: '0 -4px 14px rgba(166, 180, 200, 0.25)',
                        }}
                    >
                        <button
                            onClick={() => grant('share')}
                            disabled={busy}
                            className="w-full rounded-2xl p-3 flex items-center gap-3 text-left text-white shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg,#4F46E5,#6366F1)', boxShadow: '0 4px 14px rgba(79, 70, 229, 0.35)' }}
                        >
                            <span className="size-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><ArrowRightLeft size={18} className="rotate-90" /></span>
                            <span>
                                <span className="block text-sm font-black">Give Access Only</span>
                                <span className="block text-[11px] text-white/80 font-medium">Both you & {selected.name} can take orders & manage table</span>
                            </span>
                        </button>
                        <button
                            onClick={() => grant('transfer')}
                            disabled={busy}
                            className="w-full rounded-2xl p-3 flex items-center gap-3 text-left text-white shadow-lg active:scale-[0.98] transition-transform disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg,#E11D48,#F43F5E)', boxShadow: '0 4px 14px rgba(225, 29, 72, 0.35)' }}
                        >
                            <span className="size-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><ArrowRightLeft size={18} /></span>
                            <span>
                                <span className="block text-sm font-black">Transfer Table</span>
                                <span className="block text-[11px] text-white/80 font-medium">{selected.name} becomes sole owner. You surrender access.</span>
                            </span>
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}


