'use client';

import { memo, useRef, useState } from 'react';
import { Users, ChefHat, Link2, Utensils, ArrowRightLeft, Check, Sparkles } from 'lucide-react';
import { TABLE_STATUS, normalizeTableStatus, type TableStatusKey, haptic, useIsHydrated } from './ui';

export interface FloorTable {
    id: number | string;
    table_number: string;
    status: string;
    capacity: number;
    display_name?: string | null;
    is_merged?: boolean;
    merged_group_id?: string | null;
    area_id?: string | null;
    area_name?: string | null;
    alert_status?: string | null;
    is_pinned?: boolean;
    assigned_waiter_id?: string | null;
    assigned_waiter_name?: string | null;
    assigned_waiter_avatar?: string | null;
    co_waiter_ids?: string[] | null;
    co_waiter_names?: string[] | null;
    transferred_from_waiter_name?: string | null;
    transferred_to_waiter_id?: string | null;
    transferred_to_waiter_name?: string | null;
    customer_present_at?: string | null;
    last_activity_at?: string | null;
    /* derived */
    is_group?: boolean;
    member_tables?: FloorTable[];
    readyCount?: number;
    preparingCount?: number;
    active_order_total?: number | null;
    active_item_count?: number | null;
}

export function formatCardDuration(iso?: string | null): string | null {
    if (!iso) return null;
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return null;
    if (mins < 60) return `${Math.min(mins, 59)}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface Props {
    table: FloorTable;
    selected?: boolean;
    selecting?: boolean;
    onTap: () => void;
    onLongPress: () => void;
}

export const TableCard = memo(function TableCard({ table, selected, selecting, onTap, onLongPress }: Props) {
    const status: TableStatusKey = normalizeTableStatus(table.status);
    const meta = TABLE_STATUS[status];
    const name = (table.display_name || `Table ${table.table_number}`).replace(/\s*\+\s*/g, '+');
    const isMergedName = name.includes('+');
    const isLongName = name.length > 8;

    const [avatarError, setAvatarError] = useState(false);

    const isHydrated = useIsHydrated();
    const duration = isHydrated ? formatCardDuration(table.customer_present_at || table.last_activity_at) : null;
    const showDuration = status !== 'available' && duration;
    const isAvailable = status === 'available';
    const isTransferred = !isAvailable && !!table.transferred_to_waiter_name;
    const coNames: string[] = !isAvailable && Array.isArray(table.co_waiter_names)
        ? table.co_waiter_names.filter(Boolean)
        : typeof table.co_waiter_names === 'string' && (table.co_waiter_names as string).trim() && !isAvailable
          ? (table.co_waiter_names as string).split(',').map((s: string) => s.trim()).filter(Boolean)
          : [];
    const assigned = !isAvailable ? (table.assigned_waiter_name || null) : null;
    const assignedAvatar = !isAvailable && table.assigned_waiter_avatar && table.assigned_waiter_avatar.trim() !== '' && table.assigned_waiter_avatar !== 'null'
        ? table.assigned_waiter_avatar
        : null;
    const hasAssignedWaiter = !isAvailable && (!!assigned || !!assignedAvatar || !!table.assigned_waiter_id);

    const rawStatus = (table.status || '').toLowerCase();
    const isReady = Boolean((table.readyCount && table.readyCount > 0) || rawStatus === 'ready');
    const isPreparing = Boolean(!isReady && ((table.preparingCount && table.preparingCount > 0) || ['preparing', 'cooking', 'placed'].includes(rawStatus)));

    // Card background color:
    // 1. Ready: #8F87F1
    // 2. Preparing: #FFDE63
    // 3. Available: #ABE7B2
    // 4. Assigned: #8CA9FF
    const cardBgColor = isReady
        ? '#8F87F1'
        : isPreparing
          ? '#FFDE63'
          : isAvailable
            ? '#ABE7B2'
            : '#8CA9FF';

    /* Long-press (500ms) via pointer events — Flutter parity */
    const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
    const startPress = () => {
        if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
        pressTimerRef.current = setTimeout(() => {
            pressTimerRef.current = null;
            haptic.heavy();
            onLongPress();
        }, 500);
    };
    const cancelPress = () => {
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
    };

    /* Dynamic secondary information pill / Waiter avatar */
    let centerInfo: React.ReactNode = null;
    if (hasAssignedWaiter) {
        centerInfo = (
            <div className="flex flex-col items-center justify-center min-w-0 w-full animate-in fade-in zoom-in-95 duration-200">
                {/* Kitchen alerts if any (Ready or Prep) compactly placed above the waiter image */}
                {isReady ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 mb-1 rounded-full bg-white text-purple-950 text-[9px] font-black shadow-xs border border-purple-300 animate-pulse">
                        <ChefHat size={9} strokeWidth={3} className="shrink-0 text-purple-700" />
                        <span className="truncate">{table.readyCount || 1} Ready</span>
                    </span>
                ) : isPreparing ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 mb-1 rounded-full bg-white text-amber-950 border border-amber-300 text-[9px] font-black shadow-2xs">
                        <Utensils size={8.5} className="text-amber-700 shrink-0" />
                        <span className="truncate">{table.preparingCount || 1} Prep</span>
                    </span>
                ) : isTransferred ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 mb-1 rounded-full bg-white text-pink-700 border border-pink-300/70 text-[9px] font-bold shadow-2xs">
                        <ArrowRightLeft size={8.5} className="text-pink-600 shrink-0" />
                        <span className="truncate">{table.transferred_from_waiter_name} ➔ {table.transferred_to_waiter_name}</span>
                    </span>
                ) : null}

                {/* Assigned Waiter Avatar Image */}
                <div className="relative shrink-0">
                    <div
                        className="size-11 sm:size-12 rounded-full p-[2px] transition-transform duration-200 group-hover:scale-105"
                        style={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.6))',
                            boxShadow: '0 3px 10px rgba(0,0,0,0.12), inset 1px 1px 2px rgba(255,255,255,0.8)',
                        }}
                    >
                        {assignedAvatar && !avatarError ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={assignedAvatar}
                                alt={assigned || 'Assigned Waiter'}
                                onError={() => setAvatarError(true)}
                                className="w-full h-full rounded-full object-cover border border-white/80"
                            />
                        ) : (
                            <div
                                className="w-full h-full rounded-full bg-gradient-to-br from-w-brand to-[#E0531A] text-white flex items-center justify-center font-display font-black text-sm sm:text-base border border-white/80 shadow-inner"
                            >
                                {(assigned || 'W').charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    {/* Co-waiters count indicator badge */}
                    {coNames.length > 0 && (
                        <span
                            title={`+${coNames.join(', ')}`}
                            className="absolute -bottom-0.5 -right-1 px-1 min-w-[17px] h-[17px] rounded-full bg-indigo-600 text-white font-black text-[9px] flex items-center justify-center border-2 border-white shadow-xs"
                        >
                            +{coNames.length}
                        </span>
                    )}
                </div>

                {/* Waiter Name */}
                <div className="mt-1 flex items-center justify-center gap-1 max-w-full px-1">
                    <span className="text-[11px] sm:text-xs font-black text-slate-900 truncate max-w-[125px] tracking-tight leading-tight">
                        {assigned || (coNames.length > 0 ? coNames.join(', ') : 'Assigned')}
                    </span>
                </div>
            </div>
        );
    } else if (isReady) {
        centerInfo = (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-purple-950 border border-purple-300 text-[11px] font-black shadow-xs">
                <ChefHat size={12} className="text-purple-700 shrink-0" />
                <span className="truncate">{table.readyCount ? `${table.readyCount} Ready to Serve` : 'Ready to Serve'}</span>
            </span>
        );
    } else if (isPreparing) {
        centerInfo = (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-amber-950 border border-amber-300 text-[11px] font-black shadow-xs">
                <Utensils size={11} className="text-amber-700 shrink-0" />
                <span className="truncate">{table.preparingCount ? `${table.preparingCount} Preparing` : 'Preparing'}</span>
            </span>
        );
    } else if (isTransferred) {
        centerInfo = (
            <span className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full bg-white text-pink-700 border border-pink-200/80 text-[10px] font-bold shadow-xs">
                <ArrowRightLeft size={10} className="text-pink-600 shrink-0" />
                <span className="truncate">{table.transferred_from_waiter_name} ➔ {table.transferred_to_waiter_name}</span>
            </span>
        );
    } else if (coNames.length > 0) {
        centerInfo = (
            <span className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-full bg-white text-indigo-700 border border-indigo-200/80 text-[10px] font-bold shadow-xs">
                <Users size={10} className="text-indigo-600 shrink-0" />
                <span className="truncate">{coNames.join(', ')}</span>
            </span>
        );
    } else if (status === 'dirty') {
        centerInfo = (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-slate-700 border border-slate-300/60 text-[10px] font-bold shadow-xs">
                <Sparkles size={10} className="text-slate-600 shrink-0" />
                <span className="truncate">Ready for cleaning</span>
            </span>
        );
    } else if (status === 'available') {
        centerInfo = (
            <div className="flex flex-col items-center justify-center opacity-70">
                <div className="size-8 rounded-full bg-white/50 flex items-center justify-center text-emerald-900 mb-0.5">
                    <Sparkles size={14} />
                </div>
                <span className="text-[10.5px] font-extrabold text-emerald-950">
                    Ready to Seat
                </span>
            </div>
        );
    } else {
        centerInfo = (
            <span className="text-[10.5px] font-bold text-slate-700">
                In service
            </span>
        );
    }

    /* Tactile Status styling */
    const getStatusStyle = () => {
        if (isReady) {
            return {
                dot: 'bg-[#6D28D9] shadow-[0_0_8px_rgba(109,40,217,0.7)]',
                label: table.readyCount ? `${table.readyCount} Ready to Serve` : 'Ready to Serve',
            };
        }
        if (isPreparing) {
            return {
                dot: 'bg-[#D97706] shadow-[0_0_8px_rgba(217,119,6,0.7)]',
                label: table.preparingCount ? `${table.preparingCount} Preparing` : 'Preparing',
            };
        }
        switch (status) {
            case 'available':
                return {
                    dot: 'bg-[#059669] shadow-[0_0_8px_rgba(5,150,105,0.7)]',
                    label: 'Available',
                };
            case 'occupied':
                return {
                    dot: 'bg-[#2563EB] shadow-[0_0_8px_rgba(37,99,235,0.7)]',
                    label: assigned ? `Assigned (${assigned})` : 'Occupied',
                };
            case 'need_bill':
                return {
                    dot: 'bg-[#7C3AED] shadow-[0_0_8px_rgba(124,58,237,0.7)]',
                    label: 'Need Bill',
                };
            case 'dirty':
                return {
                    dot: 'bg-slate-600',
                    label: 'Needs Cleaning',
                };
            case 'reserved':
                return {
                    dot: 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.7)]',
                    label: 'Reserved',
                };
            case 'on_hold':
                return {
                    dot: 'bg-sky-600 shadow-[0_0_8px_rgba(2,132,199,0.7)]',
                    label: 'On Hold',
                };
            default:
                return {
                    dot: 'bg-slate-600',
                    label: meta.label || 'Available',
                };
        }
    };

    const statusStyle = getStatusStyle();

    return (
        <div
            onPointerDown={startPress}
            onPointerUp={cancelPress}
            onPointerLeave={cancelPress}
            onContextMenu={(e) => {
                e.preventDefault();
                haptic.heavy();
                onLongPress();
            }}
            onClick={() => {
                if (selecting) haptic.selection();
                onTap();
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTap();
                }
            }}
            aria-label={`${name}, ${statusStyle.label}`}
            className="group relative select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-w-brand/60 rounded-[22px] sm:rounded-[24px] transition-all duration-150 active:scale-[0.975]"
            style={{
                backgroundColor: cardBgColor,
                aspectRatio: '1 / 1.05',
                width: '100%',
                boxShadow: selected
                    ? '0 0 0 3px #FF6B35, 5px 5px 15px rgba(255, 107, 53, 0.3), -3px -3px 10px rgba(255, 255, 255, 0.8)'
                    : '4px 4px 10px rgba(0, 0, 0, 0.08), -2px -2px 8px rgba(255, 255, 255, 0.6)',
                border: selected ? '2px solid #000000' : '1.5px solid #000000',
            }}
        >
            <div className="w-full h-full p-3 sm:p-3.5 flex flex-col justify-between">
                {/* ── Top Row: Capacity & Select / Utility (Left) + Table Name (Top Right) ── */}
                <div className="flex items-center justify-between gap-1.5 shrink-0">
                    {/* Left: Checkbox (if selecting) + Capacity + Pinned / Merged icons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        {selecting && (
                            selected ? (
                                <span className="size-[20px] rounded-full bg-w-brand text-white flex items-center justify-center shadow-[0_2px_6px_rgba(255,107,53,0.35)] shrink-0">
                                    <Check size={11} strokeWidth={3.5} />
                                </span>
                            ) : (
                                <span
                                    className="size-[20px] rounded-full shrink-0"
                                    style={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.65)',
                                        boxShadow: 'inset 1px 1px 2px rgba(0, 0, 0, 0.1), inset -1px -1px 2px rgba(255, 255, 255, 0.8)',
                                        border: '1px solid rgba(0, 0, 0, 0.2)',
                                    }}
                                />
                            )
                        )}

                        {/* Capacity badge with subtle recessed neumorphic depth */}
                        <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black text-slate-800 shrink-0"
                            style={{
                                backgroundColor: 'rgba(255, 255, 255, 0.65)',
                                boxShadow: 'inset 1px 1px 2px rgba(0, 0, 0, 0.06), inset -1px -1px 2px rgba(255, 255, 255, 0.8)',
                                border: '1px solid rgba(255, 255, 255, 0.7)',
                            }}
                        >
                            <Users size={10} className="text-slate-700 shrink-0" />
                            <span>{table.capacity ?? 4}</span>
                        </span>

                        {table.is_group && (
                            <span
                                title="Merged Table"
                                className="size-5 rounded-full flex items-center justify-center text-slate-900 shrink-0"
                                style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.65)',
                                    boxShadow: 'inset 1px 1px 2px rgba(0, 0, 0, 0.06), inset -1px -1px 2px rgba(255, 255, 255, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.7)',
                                }}
                            >
                                <Link2 size={10} strokeWidth={2.5} />
                            </span>
                        )}

                        {table.is_pinned && !selecting && (
                            <span
                                title="Pinned Table"
                                className="size-5 rounded-full flex items-center justify-center text-amber-700 shrink-0"
                                style={{
                                    backgroundColor: 'rgba(255, 255, 255, 0.65)',
                                    boxShadow: 'inset 1px 1px 2px rgba(0, 0, 0, 0.06), inset -1px -1px 2px rgba(255, 255, 255, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.7)',
                                }}
                            >
                                <span className="size-1.5 rounded-full bg-amber-600" />
                            </span>
                        )}
                    </div>

                    {/* Top Right: Prominent Table Name */}
                    <div className="flex items-center justify-end min-w-0 max-w-[58%]">
                        <h3
                            className={`font-display font-black text-slate-900 tracking-tight leading-none text-right truncate ${
                                isLongName || isMergedName ? 'text-[16px] sm:text-[18px]' : 'text-[19px] sm:text-[21px]'
                            } ${selected ? 'text-w-brand' : ''}`}
                        >
                            {name}
                        </h3>
                    </div>
                </div>

                {/* ── Center: Secondary Info Pill ── */}
                <div className="flex-1 flex flex-col items-center justify-center my-1 px-1 text-center min-w-0">
                    <div className="w-full flex items-center justify-center min-w-0">
                        {centerInfo}
                    </div>
                </div>

                {/* ── Bottom: Tactile Neumorphic Status Bar ── */}
                <div
                    suppressHydrationWarning
                    className="w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-1.5 shrink-0 bg-white/70 backdrop-blur-[2px]"
                    style={{
                        boxShadow: 'inset 1px 1px 2px rgba(0, 0, 0, 0.06), inset -1px -1px 2px rgba(255, 255, 255, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.65)',
                    }}
                >
                    <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                        <span className={`size-2 rounded-full shrink-0 ${statusStyle.dot}`} />
                        <span className="text-[11px] font-black truncate text-slate-800">
                            {statusStyle.label}
                        </span>
                    </span>

                    {showDuration && (
                        <span
                            suppressHydrationWarning
                            className="w-num text-[10.5px] font-black shrink-0 text-slate-700 bg-white/80 px-1.5 py-0.5 rounded-md shadow-2xs border border-white/60"
                        >
                            {duration}
                        </span>
                    )}

                    {status === 'need_bill' && table.active_order_total && (
                        <span
                            suppressHydrationWarning
                            className="w-num text-[10.5px] font-black shrink-0 text-purple-950 bg-purple-100/90 px-1.5 py-0.5 rounded-md border border-purple-200"
                        >
                            ₹{table.active_order_total}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
});
