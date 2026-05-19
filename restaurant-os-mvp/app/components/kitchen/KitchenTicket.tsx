import { useState, useEffect } from 'react';
import Image from 'next/image';
import type { Order, OrderStatus } from '@/app/services/orders';
import { ChefHat as LucideChefHat, CheckCircle as LucideCheckCircle, Utensils as LucideUtensils, Clock as LucideClock, AlertCircle as LucideAlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTimeElapsed } from '@/app/lib/utils';
import CountdownTimer from '@/app/components/CountdownTimer';
import SharedComboCard from '@/app/components/shared/SharedComboCard';

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
    const [isLate, setIsLate] = useState(false);

    // Timer Logic
    useEffect(() => {
        let timeStr = order.created_at;
        if (timeStr && !timeStr.endsWith('Z') && !timeStr.includes('+')) {
            timeStr += 'Z';
        }

        const startTime = new Date(timeStr).getTime();

        const updateTimer = () => {
            setElapsedStr(formatTimeElapsed(order.created_at));

            // Mark as 'late' if placed > 15 mins ago and not yet served
            const diff = Date.now() - new Date(order.created_at).getTime();
            if (diff >= 900000 && order.status !== 'served' && order.status !== 'paid') {
                setIsLate(true);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [order.created_at, order.status]);

    const isCompact = density === 'compact';

    // Status Colors - Refined High-Quality Palette (Low Contrast, Premium)
    const statusStyles: Record<OrderStatus, string> = {
        queued: 'bg-neutral-50/50 border-neutral-200/60',
        placed: 'bg-white border-neutral-200/60',
        preparing: 'bg-white border-blue-100/50',
        ready: 'bg-green-50/10 border-green-100/50',
        served: 'bg-neutral-50/30 border-neutral-100 opacity-60 grayscale-[0.3]',
        paid: 'bg-neutral-50/30 border-neutral-100 opacity-60 grayscale-[0.3]',
        cancelled: 'bg-red-50/30 border-red-100 opacity-70 grayscale',
    };

    const accentColors: Record<OrderStatus, string> = {
        queued: 'bg-neutral-400',
        placed: 'bg-blue-500',
        preparing: 'bg-orange-500',
        ready: 'bg-green-500',
        served: 'bg-neutral-300',
        paid: 'bg-neutral-300',
        cancelled: 'bg-red-500',
    };

    // Late/Priority Check
    const priorityClass = isLate ? 'border-red-200 shadow-sm' : 'border-neutral-200/60';

    return (
        <div
            className={`transition-all rounded-xl overflow-hidden border ${statusStyles[order.status] || 'bg-white'} ${priorityClass} flex flex-col relative`}
        >
            {/* Header - Refined Typography & Soft Accents */}
            <div className={`${isCompact ? 'p-2 pl-3' : 'p-3 pl-3'} flex justify-between items-center border-b border-black/5 bg-white/40 backdrop-blur-sm relative`}>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <h3 className={`${isCompact ? 'text-[10px]' : 'text-[11px]'} font-black text-black tracking-tight uppercase leading-none`}>Table {order.table_number || order.table_id}</h3>
                        {isLate && (
                            <span className="bg-red-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest shadow-sm">
                                LATE
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900/[0.03] ring-1 ring-black/5">
                    <span className={`${isCompact ? 'text-[9px]' : 'text-[10px]'} font-mono font-black ${isLate ? 'text-red-600' : 'text-black/40'} tracking-tighter`}>
                        {elapsedStr}
                    </span>
                </div>
            </div>

            {/* Items List - High Quality Structure */}
            <div className="flex flex-col bg-transparent">
                {(order.items?.filter(item => {
                    if (item.status === 'served') return ['served', 'paid'].includes(order.status);
                    return true;
                }) || []).map((item, idx) => {
                    if (item.item_type?.toLowerCase() === 'combo') {
                        return (
                            <div key={item.id || `kt-combo-${idx}`} className="px-2 py-2 border-b border-neutral-100/60 last:border-b-0 transition-colors">
                                <SharedComboCard
                                    name={item.name}
                                    image_url={item.image_url}
                                    price={item.price}
                                    quantity={item.quantity}
                                    items={item.combo_items || []}
                                    notes={item.notes}
                                    readOnly={true}
                                />
                                <div className="flex justify-between items-center px-1 mt-1">
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
                                                className="text-[8px] font-black text-orange-700 bg-orange-500/10 px-2 py-0.5 rounded-full ring-1 ring-orange-500/20 shadow-sm uppercase tracking-wider active:scale-95 transition-all hover:bg-orange-500/20"
                                            >
                                                Cook
                                            </button>
                                        )}
                                        {item.status === 'preparing' && !isReadOnly && onItemStatusChange && (
                                            <button
                                                onClick={() => onItemStatusChange(item.id, 'ready')}
                                                className="group relative text-[8px] font-black text-orange-700 bg-orange-500/10 px-2 py-0.5 rounded-full ring-1 ring-orange-500/20 shadow-sm uppercase tracking-wider active:scale-95 transition-all hover:bg-green-500/20 hover:text-green-700 hover:ring-green-500/20 min-w-[50px]"
                                            >
                                                <span className="group-hover:hidden">Cooking</span>
                                                <span className="hidden group-hover:inline">Ready</span>
                                            </button>
                                        )}
                                        {item.status === 'ready' && (
                                            <span className="text-[8px] font-black text-green-600/40 bg-green-50/50 px-2 py-0.5 rounded-full border border-green-100/50 uppercase tracking-wider grayscale-[0.5]">
                                                Ready
                                            </span>
                                        )}
                                        {item.status === 'served' && (
                                            <span className="text-[8px] font-black text-black bg-neutral-100/50 px-2 py-0.5 rounded-full border border-neutral-200 uppercase tracking-wider">
                                                Done
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    
                    return (
                    <div key={item.id || `kt-item-${idx}`} className="flex gap-2.5 items-center px-3 py-2 border-b border-neutral-100/60 last:border-b-0 hover:bg-neutral-50/50 transition-colors">
                        {/* Item Image - Refined Shadow & Border */}
                        <div className={`relative shrink-0 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200/50 ${isCompact ? 'size-7' : 'size-8'} shadow-inner`}>
                            {item.image_url ? (
                                <Image
                                    src={item.image_url}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                    sizes="32px"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-black">
                                    <LucideUtensils size={12} />
                                </div>
                            )}
                        </div>

                        {/* Item Details */}
                        <div className="flex-1 min-w-0 flex items-center gap-3">
                            <span className={`shrink-0 flex items-center justify-center ${isCompact ? 'h-4 min-w-[16px] text-[8px]' : 'h-5 min-w-[20px] text-[9px]'} rounded-md bg-neutral-900/5 text-black/80 font-black shadow-inner`}>
                                {item.quantity}
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className={`${isCompact ? 'text-[10px]' : 'text-[11px]'} font-bold text-black/90 tracking-tight truncate`}>{item.name}</p>
                                {item.notes && (
                                    <p className="text-[7.5px] text-red-500/80 font-black uppercase tracking-wide truncate">
                                        {item.notes}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Item Timer */}
                        <CountdownTimer 
                            status={item.status} 
                            estimatedEnd={item.estimated_end_at} 
                            onExtend={onExtendTimer ? (mins) => onExtendTimer(item.id, mins) : undefined}
                            showControls={!isReadOnly}
                        />

                        {/* Individual Item Actions - High Quality Buttons with Hover Interaction */}
                        <div className="shrink-0 flex items-center gap-1.5">
                            {(item.status === 'placed' || (!item.status && order.status === 'placed')) && !isReadOnly && onItemStatusChange && (
                                <button
                                    onClick={() => onItemStatusChange(item.id, 'preparing')}
                                    className="text-[8px] font-black text-orange-700 bg-orange-500/10 px-2 py-0.5 rounded-full ring-1 ring-orange-500/20 shadow-sm uppercase tracking-wider active:scale-95 transition-all hover:bg-orange-500/20"
                                >
                                    Cook
                                </button>
                            )}
                            {item.status === 'preparing' && !isReadOnly && onItemStatusChange && (
                                <button
                                    onClick={() => onItemStatusChange(item.id, 'ready')}
                                    className="group relative text-[8px] font-black text-orange-700 bg-orange-500/10 px-2 py-0.5 rounded-full ring-1 ring-orange-500/20 shadow-sm uppercase tracking-wider active:scale-95 transition-all hover:bg-green-500/20 hover:text-green-700 hover:ring-green-500/20 min-w-[50px]"
                                >
                                    <span className="group-hover:hidden">Cooking</span>
                                    <span className="hidden group-hover:inline">Ready</span>
                                </button>
                            )}
                            {item.status === 'ready' && (
                                <span className="text-[8px] font-black text-green-600/40 bg-green-50/50 px-2 py-0.5 rounded-full border border-green-100/50 uppercase tracking-wider grayscale-[0.5]">
                                    Ready
                                </span>
                            )}
                            {item.status === 'served' && (
                                <span className="text-[8px] font-black text-black bg-neutral-100/50 px-2 py-0.5 rounded-full border border-neutral-200 uppercase tracking-wider">
                                    Done
                                </span>
                            )}
                        </div>
                    </div>
                )})}
            </div>

            {/* Action Footer - Refined Transitions */}
            {!isReadOnly && order.status !== 'served' && order.status !== 'paid' && order.status !== 'ready' && (
                <div className={`${isCompact ? 'p-2' : 'p-3'} bg-neutral-50/40 border-t border-neutral-100/60 backdrop-blur-[2px]`}>
                    {order.status === 'placed' && (
                        <button
                            onClick={() => onStatusChange(order.id, 'preparing')}
                            className={`w-full ${isCompact ? 'h-7 text-[10px]' : 'h-8 text-[11px]'} rounded-lg bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-black transition-all tracking-[0.15em] uppercase shadow-sm ring-1 ring-orange-600/20`}
                        >
                            COOK
                        </button>
                    )}
                    {order.status === 'preparing' && (
                        <button
                            onClick={() => onStatusChange(order.id, 'ready')}
                            className={`group w-full ${isCompact ? 'h-7 text-[10px]' : 'h-8 text-[11px]'} rounded-lg bg-orange-500 hover:bg-green-500 active:scale-[0.98] text-white font-black transition-all tracking-[0.15em] uppercase shadow-sm ring-1 ring-orange-600/20 hover:ring-green-600/20`}
                        >
                            <span className="group-hover:hidden whitespace-nowrap">COOKING</span>
                            <span className="hidden group-hover:inline whitespace-nowrap">MARK READY</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

