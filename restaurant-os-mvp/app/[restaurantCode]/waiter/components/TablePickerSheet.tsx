'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Users, Check, ShoppingBag, ArrowRight } from 'lucide-react';
import { haptic, normalizeTableStatus, TABLE_STATUS } from './ui';

interface TablePickerSheetProps {
    open: boolean;
    tables: any[];
    loading?: boolean;
    selectedTableId?: string | number | null;
    totalItems: number;
    subtotal: number;
    onSelectTable: (table: any, andProceedToCart?: boolean) => void;
    onClose: () => void;
}

export default function TablePickerSheet({
    open,
    tables,
    loading = false,
    selectedTableId,
    totalItems,
    subtotal,
    onSelectTable,
    onClose,
}: TablePickerSheetProps) {
    const [search, setSearch] = useState('');
    const [activeArea, setActiveArea] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'available' | 'occupied'>('ALL');
    const [highlightedTable, setHighlightedTable] = useState<any | null>(null);

    // Get unique area names
    const areas = useMemo(() => {
        const set = new Set<string>();
        tables.forEach((t) => {
            const area = t.area_name || t.restaurant_areas?.name;
            if (area) set.add(area);
        });
        return Array.from(set);
    }, [tables]);

    // Filter tables
    const filteredTables = useMemo(() => {
        return tables.filter((t) => {
            // Search filter
            if (search.trim()) {
                const q = search.toLowerCase().trim();
                const num = String(t.table_number || '').toLowerCase();
                const name = String(t.display_name || '').toLowerCase();
                if (!num.includes(q) && !name.includes(q)) return false;
            }
            // Area filter
            if (activeArea !== 'ALL') {
                const area = t.area_name || t.restaurant_areas?.name;
                if (area !== activeArea) return false;
            }
            // Status filter
            if (statusFilter !== 'ALL') {
                const s = normalizeTableStatus(t.status);
                if (statusFilter === 'available' && s !== 'available') return false;
                if (statusFilter === 'occupied' && s === 'available') return false;
            }
            return true;
        }).sort((a, b) => {
            const numA = Number(a.table_number) || 0;
            const numB = Number(b.table_number) || 0;
            return numA - numB;
        });
    }, [tables, search, activeArea, statusFilter]);

    if (!open) return null;

    const currentPicked = highlightedTable || tables.find((t) => String(t.id) === String(selectedTableId)) || null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[90] flex items-end justify-center" role="dialog" aria-modal="true">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                />

                {/* Sheet modal */}
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                    className="relative w-full max-w-md max-h-[85vh] rounded-t-[32px] flex flex-col overflow-hidden z-10"
                    style={{
                        backgroundColor: '#EEF2F6',
                        borderTop: '1.5px solid rgba(255, 255, 255, 0.95)',
                        boxShadow: '0 -10px 32px rgba(166, 180, 200, 0.45)',
                    }}
                >
                    {/* Header */}
                    <div className="relative pt-3 pb-3 px-5 flex items-center justify-between shrink-0 border-b border-slate-200/60">
                        {/* Drag handle */}
                        <span
                            className="absolute top-2.5 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full"
                            style={{
                                backgroundColor: '#D1D9E4',
                                boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.6)',
                            }}
                        />

                        <div className="pt-2">
                            <h2 className="text-base font-black text-slate-800 tracking-tight">Select Table to Order</h2>
                            <p className="text-xs text-slate-500 font-semibold mt-0.5">
                                {totalItems > 0 ? `${totalItems} items in cart • ₹${subtotal.toLocaleString('en-IN')}` : 'Pick a table for your order'}
                            </p>
                        </div>

                        {/* Red minimize button */}
                        <button
                            type="button"
                            onClick={() => {
                                haptic.light();
                                onClose();
                            }}
                            aria-label="Close"
                            title="Close"
                            className="size-8 rounded-full text-white bg-red-500 hover:bg-red-600 active:bg-red-700 flex items-center justify-center transition-all cursor-pointer active:scale-90 shadow-sm"
                            style={{
                                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.4), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
                                border: '1px solid rgba(255, 255, 255, 0.3)',
                            }}
                        >
                            <X size={17} className="stroke-[2.5]" />
                        </button>
                    </div>

                    {/* Search & Area Filter Bar */}
                    <div className="p-3.5 pb-2 shrink-0 space-y-2">
                        {/* Search Input */}
                        <div
                            className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.4), inset -2px -2px 4px rgba(255, 255, 255, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.8)',
                            }}
                        >
                            <Search size={16} className="text-slate-400 shrink-0" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search table number..."
                                className="w-full bg-transparent text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Status Pills */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                            {(['ALL', 'available', 'occupied'] as const).map((st) => (
                                <button
                                    key={st}
                                    onClick={() => {
                                        haptic.selection();
                                        setStatusFilter(st);
                                    }}
                                    className={`px-3 py-1 rounded-lg text-xs font-black capitalize whitespace-nowrap transition-all ${
                                        statusFilter === st
                                            ? 'bg-slate-800 text-white shadow-sm'
                                            : 'bg-white/70 text-slate-600 hover:bg-white'
                                    }`}
                                >
                                    {st === 'ALL' ? 'All Status' : st}
                                </button>
                            ))}
                            {areas.map((ar) => (
                                <button
                                    key={ar}
                                    onClick={() => {
                                        haptic.selection();
                                        setActiveArea((prev) => (prev === ar ? 'ALL' : ar));
                                    }}
                                    className={`px-3 py-1 rounded-lg text-xs font-black whitespace-nowrap transition-all ${
                                        activeArea === ar
                                            ? 'bg-orange-500 text-white shadow-sm'
                                            : 'bg-white/70 text-slate-600 hover:bg-white'
                                    }`}
                                >
                                    {ar}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tables Grid */}
                    <div className="flex-1 overflow-y-auto p-3.5 pt-1 pb-24">
                        {loading ? (
                            <div className="py-12 flex flex-col items-center justify-center gap-2">
                                <div className="size-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                                <p className="text-xs font-bold text-slate-500">Loading tables...</p>
                            </div>
                        ) : filteredTables.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-sm font-bold text-slate-600">No tables found</p>
                                <p className="text-xs text-slate-400 mt-1">Try changing filters or search terms</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2.5">
                                {filteredTables.map((tbl) => {
                                    const s = normalizeTableStatus(tbl.status);
                                    const meta = TABLE_STATUS[s];
                                    const isSelected = String(tbl.id) === String(currentPicked?.id);
                                    const area = tbl.area_name || tbl.restaurant_areas?.name;
                                    const isAvail = s === 'available';
                                    const tableColor = isAvail ? '#ABE7B2' : '#8CA9FF';

                                    return (
                                        <button
                                            key={tbl.id}
                                            type="button"
                                            onClick={() => {
                                                haptic.selection();
                                                setHighlightedTable(tbl);
                                            }}
                                            className={`relative p-3.5 rounded-2xl flex flex-col justify-between text-left transition-all active:scale-[0.97] cursor-pointer ${
                                                isSelected
                                                    ? 'ring-2 ring-orange-500 shadow-md'
                                                    : 'hover:border-slate-300'
                                            }`}
                                            style={{
                                                backgroundColor: isSelected ? '#FFF7ED' : tableColor,
                                                boxShadow: isSelected
                                                    ? '0 4px 12px rgba(249, 115, 22, 0.25)'
                                                    : '3px 3px 7px rgba(166, 180, 200, 0.35), -3px -3px 7px rgba(255, 255, 255, 0.95)',
                                                border: isSelected
                                                    ? '2px solid #F97316'
                                                    : '1.5px solid rgba(0, 0, 0, 0.15)',
                                            }}
                                        >
                                            {/* Top info */}
                                            <div className="flex items-start justify-between gap-1 mb-2">
                                                <div>
                                                    <span className="text-lg font-black text-slate-900 tracking-tight block">
                                                        Table {tbl.table_number}
                                                    </span>
                                                    {area && (
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                                            {area}
                                                        </span>
                                                    )}
                                                </div>
                                                <span
                                                    className="size-6 rounded-full flex items-center justify-center shrink-0"
                                                    style={{
                                                        backgroundColor: isSelected ? '#F97316' : '#EEF2F6',
                                                        boxShadow: isSelected
                                                            ? '0 2px 6px rgba(249, 115, 22, 0.3)'
                                                            : 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.4), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                                    }}
                                                >
                                                    {isSelected ? (
                                                        <Check size={14} className="text-white stroke-[3]" />
                                                    ) : (
                                                        <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
                                                    )}
                                                </span>
                                            </div>

                                            {/* Bottom details */}
                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                                                <span className="inline-flex items-center gap-1 font-semibold text-slate-600 text-[11px]">
                                                    <Users size={12} className="text-slate-400" />
                                                    {tbl.capacity || 4} Seats
                                                </span>
                                                <span
                                                    className="px-2 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wide"
                                                    style={{
                                                        backgroundColor: `${meta.color}15`,
                                                        color: meta.color,
                                                        border: `1px solid ${meta.color}33`,
                                                    }}
                                                >
                                                    {meta.label}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Bottom Action Drawer */}
                    {currentPicked && (
                        <div
                            className="absolute bottom-0 left-0 right-0 p-3.5 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-6px_20px_rgba(0,0,0,0.08)] flex items-center gap-2.5 z-20"
                        >
                            <button
                                type="button"
                                onClick={() => onSelectTable(currentPicked, false)}
                                className="px-3.5 py-3 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-black transition-all active:scale-95"
                            >
                                Set Table
                            </button>
                            <button
                                type="button"
                                onClick={() => onSelectTable(currentPicked, true)}
                                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-black shadow-md shadow-orange-500/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                            >
                                <ShoppingBag size={15} />
                                <span>Proceed to Cart & Order for Table {currentPicked.table_number}</span>
                                <ArrowRight size={15} />
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
