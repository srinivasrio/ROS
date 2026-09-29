import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { Order, OrderStatus } from '@/services/orders.service';
import { ChefHat as LucideChefHat, CheckCircle as LucideCheckCircle, Utensils as LucideUtensils, Clock as LucideClock, AlertCircle as LucideAlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTimeElapsed } from '@/lib/utils';
import CountdownTimer from '@/components/CountdownTimer';
import SharedComboCard from '@/components/shared/SharedComboCard';
import { isComboItem, parseComboSubItems } from '@/lib/combo-utils';

interface KitchenTicketProps {
    order: Order;
    onStatusChange: (id: string, status: OrderStatus) => void;
    onItemStatusChange?: (itemId: string, status: OrderStatus) => void;
    onExtendTimer?: (itemId: string, minutes: number) => void;
    isReadOnly?: boolean;
    density?: 'compact' | 'comfortable';
}

export default function KitchenTicket({ order, onStatusChange, onItemStatusChange, onExtendTimer, isReadOnly = false, density = 'comfortable' }: KitchenTicketProps) {
    const [elapsedStr, setElapsedStr] = useState('');
    const [createdTimeStr, setCreatedTimeStr] = useState('');
    const [isLate, setIsLate] = useState(false);

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
            if (diff >= 900000 && order.status !== 'served' && order.status !== 'paid') {
                setIsLate(true);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [order.created_at, order.status]);

    const isCompact = density === 'compact';

    // Status Colors
    const statusStyles: Record<OrderStatus, string> = {
        queued: 'bg-neutral-50/50 border-neutral-200/80',
        placed: 'bg-white border-blue-200/80 shadow-sm',
        preparing: 'bg-white border-orange-200/80 shadow-sm',
        ready: 'bg-green-50/20 border-green-300/80 shadow-sm',
        served: 'bg-neutral-50/40 border-neutral-200/80 opacity-80',
        paid: 'bg-neutral-50/40 border-neutral-200/80 opacity-80',
        cancelled: 'bg-red-50/40 border-red-200/80 opacity-80',
    };

    const priorityClass = isLate ? 'border-red-300 ring-2 ring-red-500/20 shadow-md' : '';

    return (
        <div className={`transition-all rounded-xl overflow-hidden border ${statusStyles[order.status] || 'bg-white'} ${priorityClass} flex flex-col relative`}>
            {/* Ticket Header */}
            <div className="p-3 flex justify-between items-center border-b border-neutral-200/80 bg-neutral-100/60 backdrop-blur-sm">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        {order.order_type === 'TAKEAWAY' ? (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-black tracking-wider flex items-center gap-1 shadow-sm">
                                🛍️ TAKEAWAY #{order.order_number || order.id.slice(0, 6)}
                            </span>
                        ) : order.order_type === 'DELIVERY' ? (
                            <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[10px] font-black tracking-wider flex items-center gap-1 shadow-sm">
                                🛵 DELIVERY #{order.order_number || order.id.slice(0, 6)}
                            </span>
                        ) : (
                            <h3 className="text-xs font-black text-neutral-900 tracking-tight uppercase leading-none">
                                Table {order.table_number || order.table_id}
                            </h3>
                        )}
                        {isLate && (
                            <span className="bg-red-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm animate-pulse">
                                LATE
                            </span>
                        )}
                    </div>
                    {order.order_type === 'TAKEAWAY' ? (
                        <p className="text-[10px] text-emerald-800 font-bold mt-0.5 truncate max-w-[180px]">
                            {order.customer_phone || order.delivery_phone ? `📞 ${order.customer_phone || order.delivery_phone}` : 'Self Pickup'}
                            {order.delivery_notes ? ` • ${order.delivery_notes}` : ''}
                        </p>
                    ) : order.order_type === 'DELIVERY' ? (
                        <p className="text-[10px] text-blue-800 font-bold mt-0.5 truncate max-w-[180px]">
                            {order.delivery_phone ? `📞 ${order.delivery_phone}` : 'Delivery'}
                        </p>
                    ) : order.waiter_name ? (
                        <p className="text-[10px] text-neutral-500 font-bold mt-0.5">
                            Waiter: {order.waiter_name}
                        </p>
                    ) : null}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-neutral-500">
                        {createdTimeStr}
                    </span>
                    <div className="px-2 py-0.5 rounded-md bg-neutral-900/10 ring-1 ring-black/5 flex items-center gap-1">
                        <LucideClock size={10} className={isLate ? 'text-red-600' : 'text-neutral-500'} />
                        <span className={`text-[10px] font-mono font-black ${isLate ? 'text-red-600' : 'text-neutral-800'}`}>
                            {elapsedStr}
                        </span>
                    </div>
                </div>
            </div>

            {/* Items List */}
            <div className="flex flex-col divide-y divide-neutral-100 bg-white">
                {(order.items?.filter(item => item.status !== 'cancelled') || []).map((item, idx) => {
                    const itemAny = item as any;
                    const menuItemObj = Array.isArray(itemAny.menu_items) ? itemAny.menu_items[0] : itemAny.menu_items;
                    const isGenericName = !item.name || item.name.startsWith('Item #') || item.name === 'Unknown Item';
                    const itemName = !isGenericName ? item.name : (item.combo_name || menuItemObj?.name || itemAny.item_name || item.name || `Item #${itemAny.menu_item_id || item.id}`);

                    const isCombo = isComboItem(item);
                    const subItems = isCombo ? parseComboSubItems(item) : [];

                    if (isCombo && subItems.length > 0) {
                        return (
                            <div key={item.id || `kt-combo-${idx}`} className="p-3 transition-colors bg-orange-50/20">
                                <SharedComboCard
                                    name={itemName}
                                    image_url={item.combo_image || item.image_url}
                                    price={item.price}
                                    quantity={item.quantity}
                                    items={subItems}
                                    notes={item.notes}
                                    readOnly={true}
                                />
                                <div className="flex justify-between items-center px-1 mt-2">
                                    <CountdownTimer 
                                        status={item.status} 
                                        estimatedEnd={item.estimated_end_at} 
                                        onExtend={onExtendTimer ? (mins) => onExtendTimer(item.id, mins) : undefined}
                                        showControls={!isReadOnly}
                                    />
                                    <div className="shrink-0 flex items-center gap-1.5">
                                        {(item.status === 'placed' || (!item.status && order.status === 'placed')) && !isReadOnly && onItemStatusChange && (
                                            <button
                                                onClick={() => onItemStatusChange(item.id, 'preparing')}
                                                className="text-[10px] font-black text-white bg-orange-500 hover:bg-orange-600 px-2.5 py-1 rounded-lg shadow-sm uppercase tracking-wider active:scale-95 transition-all"
                                            >
                                                Cook
                                            </button>
                                        )}
                                        {item.status === 'preparing' && !isReadOnly && onItemStatusChange && (
                                            <button
                                                onClick={() => onItemStatusChange(item.id, 'ready')}
                                                className="text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg shadow-sm uppercase tracking-wider active:scale-95 transition-all"
                                            >
                                                Ready
                                            </button>
                                        )}
                                        {item.status === 'ready' && (
                                            <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300 uppercase tracking-wider">
                                                Ready
                                            </span>
                                        )}
                                        {item.status === 'served' && (
                                            <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200 uppercase">
                                                Served
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    
                    return (
                        <div key={item.id || `kt-item-${idx}`} className="flex flex-col p-3 gap-2 hover:bg-neutral-50/80 transition-colors">
                            {/* Main Item Row */}
                            <div className="flex items-center gap-2.5">
                                {/* Quantity Badge */}
                                <div className="shrink-0 flex items-center justify-center h-7 min-w-[28px] px-1.5 rounded-lg bg-orange-500 text-white font-extrabold text-xs shadow-sm">
                                    {item.quantity}x
                                </div>

                                {/* Thumbnail */}
                                {item.image_url && (
                                    <div className="relative shrink-0 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200 size-8 shadow-inner">
                                        <Image
                                            src={item.image_url}
                                            alt={itemName}
                                            fill
                                            className="object-cover"
                                            sizes="32px"
                                        />
                                    </div>
                                )}

                                {/* Item Name */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black text-neutral-900 tracking-tight leading-snug break-words">
                                        {itemName}
                                    </p>
                                </div>

                                {/* Item Action Button */}
                                <div className="shrink-0 flex items-center gap-1.5">
                                    {(item.status === 'placed' || (!item.status && order.status === 'placed')) && !isReadOnly && onItemStatusChange && (
                                        <button
                                            onClick={() => onItemStatusChange(item.id, 'preparing')}
                                            className="text-[10px] font-black text-white bg-orange-500 hover:bg-orange-600 px-2.5 py-1 rounded-lg shadow-sm uppercase tracking-wider active:scale-95 transition-all"
                                        >
                                            Cook
                                        </button>
                                    )}
                                    {item.status === 'preparing' && !isReadOnly && onItemStatusChange && (
                                        <button
                                            onClick={() => onItemStatusChange(item.id, 'ready')}
                                            className="text-[10px] font-black text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg shadow-sm uppercase tracking-wider active:scale-95 transition-all"
                                        >
                                            Ready
                                        </button>
                                    )}
                                    {item.status === 'ready' && (
                                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-300 uppercase tracking-wider">
                                            Ready
                                        </span>
                                    )}
                                    {item.status === 'served' && (
                                        <span className="text-[10px] font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200 uppercase">
                                            Served
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Sub Row: Notes Box & Countdown Timer */}
                            {(item.notes || (item.status === 'preparing' && item.estimated_end_at)) && (
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-100/80">
                                    {item.notes ? (
                                        <div className="flex-1 min-w-[140px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-950 text-[11px] font-bold shadow-2xs">
                                            <LucideAlertCircle size={13} className="shrink-0 text-amber-600" />
                                            <span className="leading-tight">{item.notes}</span>
                                        </div>
                                    ) : <div />}

                                    <CountdownTimer 
                                        status={item.status} 
                                        estimatedEnd={item.estimated_end_at} 
                                        onExtend={onExtendTimer ? (mins) => onExtendTimer(item.id, mins) : undefined}
                                        showControls={!isReadOnly}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Ticket Action Footer for ALL Sections */}
            {!isReadOnly && (
                <div className="p-3 bg-neutral-50 border-t border-neutral-200">
                    {order.status === 'placed' && (
                        <button
                            onClick={() => onStatusChange(order.id, 'preparing')}
                            className="w-full h-9 rounded-xl bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-black text-xs transition-all tracking-wider uppercase shadow-md flex items-center justify-center gap-1.5"
                        >
                            <LucideChefHat size={15} />
                            <span>COOK ALL</span>
                        </button>
                    )}
                    {order.status === 'preparing' && (
                        <button
                            onClick={() => onStatusChange(order.id, 'ready')}
                            className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-black text-xs transition-all tracking-wider uppercase shadow-md flex items-center justify-center gap-1.5"
                        >
                            <LucideCheckCircle size={15} />
                            <span>MARK ALL READY</span>
                        </button>
                    )}
                    {order.status === 'ready' && (
                        <div className="w-full py-2 rounded-xl bg-emerald-100/80 text-emerald-800 font-extrabold text-xs text-center border border-emerald-300 uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-2xs">
                            <LucideCheckCircle size={15} className="text-emerald-700" />
                            <span>READY FOR WAITER</span>
                        </div>
                    )}
                    {(order.status === 'served' || order.status === 'paid') && (
                        <div className="w-full py-1.5 rounded-lg bg-neutral-100 text-neutral-600 font-bold text-xs text-center border border-neutral-200 uppercase tracking-wider flex items-center justify-center gap-1">
                            <LucideUtensils size={13} className="text-neutral-500" />
                            <span>SERVED & DINING</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

