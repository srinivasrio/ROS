import { useState, useEffect } from 'react';
import type { Order, OrderStatus } from '@/services/orders.service';
import { 
    ChefHat as LucideChefHat, 
    CheckCircle as LucideCheckCircle, 
    Utensils as LucideUtensils, 
    Clock as LucideClock, 
    AlertCircle as LucideAlertCircle,
    Flame,
    Check,
    User,
} from 'lucide-react';
import { formatTimeElapsed, getCategoryMenuItemImage } from '@/lib/utils';
import CountdownTimer from '@/components/CountdownTimer';
import { isComboItem, parseComboSubItems } from '@/lib/combo-utils';

interface KitchenTicketProps {
    order: Order;
    onStatusChange: (id: string, status: OrderStatus) => void;
    onItemStatusChange?: (itemId: string, status: OrderStatus) => void;
    onExtendTimer?: (itemId: string, minutes: number) => void;
    isReadOnly?: boolean;
    density?: 'compact' | 'comfortable';
}

// Normalizes status strings from various sources (database, realtime, casing, aliases)
function normalizeStatus(status?: string | null): string {
    const s = (status || '').toLowerCase().trim();
    if (!s || s === 'queued' || s === 'incoming' || s === 'pending' || s === 'placed') return 'placed';
    if (s === 'preparing' || s === 'cooking') return 'preparing';
    if (s === 'ready') return 'ready';
    if (s === 'served' || s === 'paid' || s === 'completed') return 'served';
    if (s === 'cancelled') return 'cancelled';
    return s;
}

export default function KitchenTicket({ 
    order, 
    onStatusChange, 
    onItemStatusChange, 
    onExtendTimer, 
    isReadOnly = false, 
    density = 'comfortable' 
}: KitchenTicketProps) {
    const [elapsedStr, setElapsedStr] = useState('');
    const [createdTimeStr, setCreatedTimeStr] = useState('');
    const [isLate, setIsLate] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [itemLoadingId, setItemLoadingId] = useState<string | null>(null);
    const [completedSubItems, setCompletedSubItems] = useState<Record<string, boolean>>({});

    // Timer Logic
    useEffect(() => {
        let timeStr = order.created_at;
        if (timeStr && !timeStr.endsWith('Z') && !timeStr.includes('+')) {
            timeStr += 'Z';
        }

        const dateObj = new Date(timeStr);
        setCreatedTimeStr(dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        const updateTimer = () => {
            setElapsedStr(formatTimeElapsed(order.created_at));

            // Mark as 'late' if placed > 15 mins ago and not yet served
            const diff = Date.now() - dateObj.getTime();
            const orderStatusNorm = normalizeStatus(order.status);
            if (diff >= 900000 && orderStatusNorm !== 'served' && orderStatusNorm !== 'cancelled') {
                setIsLate(true);
            } else {
                setIsLate(false);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [order.created_at, order.status]);

    const orderNormStatus = normalizeStatus(order.status);

    // Status visual top stripes & card accents (100% Light Theme)
    const statusTopBar: Record<string, string> = {
        placed: 'from-blue-500 via-indigo-500 to-sky-400',
        preparing: 'from-amber-400 via-orange-500 to-amber-500',
        ready: 'from-emerald-400 via-teal-500 to-emerald-600',
        served: 'from-slate-300 via-slate-400 to-slate-500',
        cancelled: 'from-rose-400 to-red-500',
    };

    const statusCardStyles: Record<string, string> = {
        placed: 'bg-white border-blue-200/90 shadow-2xs hover:border-blue-300',
        preparing: 'bg-white border-amber-200/90 shadow-2xs hover:border-amber-300',
        ready: 'bg-white border-emerald-300/90 shadow-2xs hover:border-emerald-400',
        served: 'bg-slate-50/50 border-slate-200/80 opacity-85',
        cancelled: 'bg-rose-50/40 border-rose-200/80 opacity-70',
    };

    const handleActionClick = async (status: OrderStatus) => {
        if (actionLoading) return;
        setActionLoading(true);
        try {
            await onStatusChange(order.id, status);
        } finally {
            setActionLoading(false);
        }
    };

    const handleItemClick = async (itemId: string, status: OrderStatus) => {
        if (!onItemStatusChange || itemLoadingId === itemId) return;
        setItemLoadingId(itemId);
        try {
            await onItemStatusChange(itemId, status);
        } finally {
            setItemLoadingId(null);
        }
    };

    const toggleSubItem = (subKey: string) => {
        setCompletedSubItems(prev => ({
            ...prev,
            [subKey]: !prev[subKey]
        }));
    };

    const activeItems = (order.items?.filter(item => item.status !== 'cancelled') || []);

    const hasAnyPlacedItem = activeItems.some(i => normalizeStatus(i.status || order.status) === 'placed');
    const hasAnyPreparingItem = activeItems.some(i => normalizeStatus(i.status || order.status) === 'preparing');
    const areAllItemsReady = activeItems.length > 0 && activeItems.every(i => normalizeStatus(i.status || order.status) === 'ready');
    const areAllItemsServed = activeItems.length > 0 && activeItems.every(i => normalizeStatus(i.status || order.status) === 'served');

    const showCookAll = orderNormStatus === 'placed' || hasAnyPlacedItem;
    const showMarkAllReady = !showCookAll && (orderNormStatus === 'preparing' || hasAnyPreparingItem);
    const showReadyBanner = !showCookAll && !showMarkAllReady && (orderNormStatus === 'ready' || areAllItemsReady);
    const showServedBanner = !showCookAll && !showMarkAllReady && !showReadyBanner && (orderNormStatus === 'served' || areAllItemsServed);

    return (
        <div 
            className={`transition-all duration-200 rounded-xl overflow-hidden border ${
                statusCardStyles[orderNormStatus] || 'bg-white border-slate-200'
            } ${isLate ? 'border-rose-400 ring-2 ring-rose-500/30' : ''} flex flex-col relative group`}
        >
            {/* Top 2.5px Status Stripe */}
            <div className={`h-[2.5px] w-full bg-gradient-to-r ${isLate ? 'from-rose-500 to-red-600 animate-pulse' : (statusTopBar[orderNormStatus] || 'from-slate-300 to-slate-400')}`} />

            {/* Structured Ticket Header: Order Info on Left, Clock on Right - Never Collides */}
            <div className="px-2.5 py-1.5 flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-900 text-white text-[10px] font-mono font-black tracking-tight shadow-2xs shrink-0">
                        #{order.order_number || order.id.slice(0, 5)}
                    </span>

                    {order.order_type === 'TAKEAWAY' ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-200 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                            🛍️ Takeaway
                        </span>
                    ) : order.order_type === 'DELIVERY' ? (
                        <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-200 text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0">
                            🛵 Delivery
                        </span>
                    ) : (
                        <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-950 border border-indigo-200/80 text-[10px] font-black tracking-tight uppercase shadow-2xs shrink-0">
                            Table {order.table_number || order.table_id || '—'}
                        </span>
                    )}

                    {order.waiter_name && (
                        <span className="text-[9px] font-bold text-violet-800 bg-violet-50 border border-violet-200/80 px-1.5 py-0.5 rounded-md flex items-center gap-1.5 shrink-0">
                            {order.waiter_avatar ? (
                                <img
                                    src={order.waiter_avatar}
                                    alt={order.waiter_name}
                                    className="size-3.5 rounded-full object-cover shrink-0 border border-violet-200"
                                />
                            ) : (
                                <User size={9} className="text-violet-500" />
                            )}
                            <span className="truncate max-w-[85px]">{order.waiter_name}</span>
                        </span>
                    )}

                    {isLate && (
                        <span className="bg-rose-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider shadow-2xs animate-pulse shrink-0">
                            LATE
                        </span>
                    )}
                </div>

                {/* Compact Elapsed Timer in Header - Standalone, Never Overlapped */}
                <div className="flex items-center gap-1 shrink-0">
                    <div 
                        className={`px-1.5 py-0.5 rounded-md flex items-center gap-1 border transition-colors shadow-2xs ${
                            isLate 
                                ? 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse' 
                                : 'bg-white border-slate-200 text-slate-800'
                        }`}
                        title={`Ordered at ${createdTimeStr}`}
                    >
                        <LucideClock size={10} className={isLate ? 'text-rose-600' : 'text-slate-400'} />
                        <span suppressHydrationWarning className="text-[10px] font-mono font-black tracking-tight">
                            {elapsedStr}
                        </span>
                    </div>
                </div>
            </div>

            {/* Items List - Perfectly Structured Rows without Covering Anything */}
            <div className="flex flex-col divide-y divide-slate-100 bg-white">
                {activeItems.map((item, idx) => {
                    const itemAny = item as any;
                    const menuItemObj = Array.isArray(itemAny.menu_items) ? itemAny.menu_items[0] : itemAny.menu_items;
                    const isGenericName = !item.name || item.name.startsWith('Item #') || item.name === 'Unknown Item';
                    const itemName = !isGenericName 
                        ? item.name 
                        : (item.combo_name || menuItemObj?.name || itemAny.item_name || item.name || `Item #${itemAny.menu_item_id || item.id}`);

                    const isCombo = isComboItem(item);
                    const subItems = isCombo ? parseComboSubItems(item) : [];
                    const isItemLoading = itemLoadingId === item.id;

                    // Robust item status determination
                    const itemStatusNorm = normalizeStatus(item.status || order.status);
                    const isPlaced = itemStatusNorm === 'placed';
                    const isPreparing = itemStatusNorm === 'preparing';
                    const isReady = itemStatusNorm === 'ready';
                    const isServed = itemStatusNorm === 'served';

                    // 100% Reliable Image URL resolution with local category fallback
                    const itemImgSrc = item.image_url || item.combo_image || menuItemObj?.image_url || getCategoryMenuItemImage(itemName);

                    if (isCombo && subItems.length > 0) {
                        return (
                            <div key={item.id || `kt-combo-${idx}`} className="px-2.5 py-1.5 transition-colors bg-gradient-to-r from-orange-50/30 to-amber-50/15">
                                {/* Primary Row: Qty + Thumbnail + Name + Action Button */}
                                <div className="flex items-center gap-2">
                                    {/* Qty Badge */}
                                    <div className="shrink-0 flex items-center justify-center size-5.5 rounded-md bg-amber-500 text-white font-black text-[11px] shadow-2xs">
                                        {item.quantity}×
                                    </div>

                                    {/* Combo Thumbnail */}
                                    <div className="relative shrink-0 rounded-md overflow-hidden bg-amber-100 border border-amber-200/90 size-7 shadow-2xs">
                                        <img
                                            src={itemImgSrc}
                                            alt={itemName}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            onError={(e) => {
                                                const target = e.currentTarget;
                                                const fallback = getCategoryMenuItemImage(itemName);
                                                if (target.src !== fallback) {
                                                    target.src = fallback;
                                                }
                                            }}
                                        />
                                    </div>

                                    {/* Combo Name */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                                                Combo
                                            </span>
                                            <p className="text-[11px] md:text-xs font-black text-slate-900 truncate">
                                                {itemName}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Action Button Only in Primary Row (Fixed width, never crowds or overlaps!) */}
                                    <div className="shrink-0 flex items-center">
                                        {!isReadOnly && onItemStatusChange && isPlaced && (
                                            <button
                                                type="button"
                                                disabled={isItemLoading}
                                                onClick={() => handleItemClick(item.id, 'preparing')}
                                                className="text-[10px] font-black text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 px-2 py-0.5 rounded shadow-2xs uppercase tracking-wider transition-all flex items-center gap-1 disabled:opacity-50"
                                            >
                                                <Flame size={10} />
                                                <span>Cook</span>
                                            </button>
                                        )}

                                        {!isReadOnly && onItemStatusChange && isPreparing && (
                                            <button
                                                type="button"
                                                disabled={isItemLoading}
                                                onClick={() => handleItemClick(item.id, 'ready')}
                                                className="text-[10px] font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 px-2 py-0.5 rounded shadow-2xs uppercase tracking-wider transition-all flex items-center gap-1 disabled:opacity-50"
                                            >
                                                <Check size={10} strokeWidth={2.5} />
                                                <span>Ready</span>
                                            </button>
                                        )}

                                        {isReady && (
                                            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-wider flex items-center gap-0.5">
                                                <Check size={9} strokeWidth={2.5} className="text-emerald-600" />
                                                Ready
                                            </span>
                                        )}

                                        {isServed && (
                                            <span className="text-[9px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                                                Served
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Sub-items horizontal compact pills */}
                                <div className="flex items-center gap-1 flex-wrap mt-1 pl-7.5">
                                    {subItems.map((sub, sIdx) => {
                                        const subKey = `${item.id}-sub-${sIdx}`;
                                        const isDone = completedSubItems[subKey] || isReady || isServed;
                                        return (
                                            <span
                                                key={subKey}
                                                onClick={() => !isReadOnly && toggleSubItem(subKey)}
                                                className={`text-[9px] px-1.5 py-0.2 rounded border transition-all cursor-pointer select-none flex items-center gap-1 ${
                                                    isDone 
                                                        ? 'bg-slate-100 text-slate-400 border-slate-200 line-through' 
                                                        : 'bg-white text-slate-700 border-amber-200/80 hover:bg-amber-50 shadow-2xs'
                                                }`}
                                            >
                                                <span className={`size-1.5 rounded-full ${sub.item_type === 'Non-Veg' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                                {sub.quantity}× {sub.name}
                                            </span>
                                        );
                                    })}
                                </div>

                                {/* Combo Sub Row: Dedicated placement for Notes and Countdown Timer */}
                                {(item.notes || (isPreparing && item.estimated_end_at)) && (
                                    <div className="flex items-center justify-between gap-1.5 mt-1 pt-1 border-t border-amber-200/50">
                                        <div className="min-w-0 flex-1">
                                            {item.notes && (
                                                <span className="text-[9px] text-amber-900 bg-amber-100/80 border border-amber-200/90 px-1.5 py-0.2 rounded font-semibold truncate flex items-center gap-1">
                                                    <LucideAlertCircle size={9} className="shrink-0 text-amber-700" />
                                                    <span>{item.notes}</span>
                                                </span>
                                            )}
                                        </div>
                                        {isPreparing && item.estimated_end_at && (
                                            <div className="shrink-0">
                                                <CountdownTimer 
                                                    status={item.status} 
                                                    estimatedEnd={item.estimated_end_at} 
                                                    onExtend={onExtendTimer ? (mins) => onExtendTimer(item.id, mins) : undefined}
                                                    showControls={!isReadOnly}
                                                />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    }

                    // Regular Item Row: Clean separation between Primary Row and Sub Row
                    return (
                        <div 
                            key={item.id || `kt-item-${idx}`} 
                            className="px-2.5 py-1.5 hover:bg-slate-50/50 transition-colors"
                        >
                            {/* Primary Row: Qty + Thumbnail + Name + Action Button */}
                            <div className="flex items-center gap-2">
                                {/* Quantity Badge */}
                                <div 
                                    className={`shrink-0 flex items-center justify-center size-5.5 rounded-md font-black text-[11px] shadow-2xs transition-colors ${
                                        isReady
                                            ? 'bg-emerald-600 text-white'
                                            : isPreparing
                                            ? 'bg-amber-500 text-white'
                                            : 'bg-slate-100 text-slate-800 border border-slate-300/80'
                                    }`}
                                >
                                    {item.quantity}×
                                </div>

                                {/* Food Image Thumbnail with Guaranteed Fallback */}
                                <div className="relative shrink-0 rounded-md overflow-hidden bg-slate-100 border border-slate-200/90 size-7 shadow-2xs">
                                    <img
                                        src={itemImgSrc}
                                        alt={itemName}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                        onError={(e) => {
                                            const target = e.currentTarget;
                                            const fallback = getCategoryMenuItemImage(itemName);
                                            if (target.src !== fallback) {
                                                target.src = fallback;
                                            }
                                        }}
                                    />
                                </div>

                                {/* Item Name & Variation (Has full middle width to breathe!) */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <p className={`text-[11px] md:text-xs font-bold tracking-tight truncate ${
                                            isServed ? 'text-slate-400 line-through' : 'text-slate-900'
                                        }`}>
                                            {itemName}
                                        </p>
                                        {(item as any).variation_name && (
                                            <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                                                {(item as any).variation_name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Action Button Only in Primary Row (Fixed width, never crowds or overlaps!) */}
                                <div className="shrink-0 flex items-center">
                                    {!isReadOnly && onItemStatusChange && isPlaced && (
                                        <button
                                            type="button"
                                            disabled={isItemLoading}
                                            onClick={() => handleItemClick(item.id, 'preparing')}
                                            className="text-[10px] font-black text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 px-2 py-0.5 rounded shadow-2xs uppercase tracking-wider transition-all flex items-center gap-1 disabled:opacity-50"
                                        >
                                            <Flame size={10} />
                                            <span>Cook</span>
                                        </button>
                                    )}

                                    {!isReadOnly && onItemStatusChange && isPreparing && (
                                        <button
                                            type="button"
                                            disabled={isItemLoading}
                                            onClick={() => handleItemClick(item.id, 'ready')}
                                            className="text-[10px] font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-95 px-2 py-0.5 rounded shadow-2xs uppercase tracking-wider transition-all flex items-center gap-1 disabled:opacity-50"
                                        >
                                            <Check size={10} strokeWidth={2.5} />
                                            <span>Ready</span>
                                        </button>
                                    )}

                                    {isReady && (
                                        <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-wider flex items-center gap-0.5">
                                            <Check size={9} strokeWidth={2.5} className="text-emerald-600" />
                                            Ready
                                        </span>
                                    )}

                                    {isServed && (
                                        <span className="text-[9px] font-medium text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 uppercase">
                                            Served
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Sub Row: Notes, Addons & Dedicated Countdown Timer */}
                            {(item.notes || (isPreparing && item.estimated_end_at) || ((item as any).selected_addons && (item as any).selected_addons.length > 0)) && (
                                <div className="flex items-center justify-between gap-1.5 mt-1 pt-1 border-t border-slate-100/80">
                                    <div className="flex items-center gap-1 flex-wrap min-w-0 flex-1">
                                        {item.notes && (
                                            <span className="text-[9px] text-amber-900 bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 rounded font-semibold truncate flex items-center gap-1">
                                                <LucideAlertCircle size={9} className="shrink-0 text-amber-600" />
                                                <span>{item.notes}</span>
                                            </span>
                                        )}
                                        {(item as any).selected_addons && Array.isArray((item as any).selected_addons) && (item as any).selected_addons.length > 0 && (
                                            <span className="text-[9px] font-semibold text-teal-800 bg-teal-50 border border-teal-200 px-1 py-0.2 rounded truncate">
                                                +{(item as any).selected_addons.map((a: any) => a.name || a).join(', ')}
                                            </span>
                                        )}
                                    </div>

                                    {/* Dedicated Timer Placement - NEVER overlaps item info! */}
                                    {isPreparing && item.estimated_end_at && (
                                        <div className="shrink-0">
                                            <CountdownTimer 
                                                status={item.status} 
                                                estimatedEnd={item.estimated_end_at} 
                                                onExtend={onExtendTimer ? (mins) => onExtendTimer(item.id, mins) : undefined}
                                                showControls={!isReadOnly}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Ticket Action Footer - Compact & Responsive */}
            {!isReadOnly && (
                <div className="px-2.5 py-1.5 bg-slate-50/80 border-t border-slate-100 flex items-center gap-1.5">
                    {showCookAll && (
                        <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleActionClick('preparing')}
                            className="w-full h-7.5 rounded-lg bg-gradient-to-r from-amber-500 via-orange-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:scale-[0.98] text-white font-black text-[11px] transition-all tracking-wide uppercase shadow-2xs shadow-orange-500/15 flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            <LucideChefHat size={13} />
                            <span>COOK ALL ITEMS</span>
                        </button>
                    )}

                    {showMarkAllReady && (
                        <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleActionClick('ready')}
                            className="w-full h-7.5 rounded-lg bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] text-white font-black text-[11px] transition-all tracking-wide uppercase shadow-2xs shadow-emerald-600/15 flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                            <LucideCheckCircle size={13} />
                            <span>MARK ALL READY</span>
                        </button>
                    )}

                    {showReadyBanner && (
                        <div className="w-full py-1 px-2 rounded-lg bg-emerald-50/90 border border-emerald-200/80 flex items-center justify-between text-emerald-950 shadow-2xs">
                            <div className="flex items-center gap-1.5 min-w-0">
                                <LucideCheckCircle size={12} className="text-emerald-600 shrink-0" />
                                <span className="text-[10px] font-bold truncate">
                                    Ready for Pickup {order.waiter_name ? `• ${order.waiter_name}` : ''}
                                </span>
                            </div>
                            <span className="shrink-0 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded bg-white border border-emerald-300/80 text-emerald-800">
                                Waiter Pickup
                            </span>
                        </div>
                    )}

                    {showServedBanner && (
                        <div className="w-full py-1 rounded-lg bg-slate-100 text-slate-600 font-bold text-[10px] text-center border border-slate-200 uppercase tracking-wider flex items-center justify-center gap-1">
                            <LucideUtensils size={11} className="text-slate-500" />
                            <span>Served by Waiter</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
