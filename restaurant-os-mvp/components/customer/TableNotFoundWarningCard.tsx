'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
    Camera,
    Hash,
    X,
    MapPin,
    Building2,
    ShieldAlert,
    QrCode,
    ArrowRight,
    AlertTriangle,
} from 'lucide-react';

export interface TableNotFoundWarningCardProps {
    isOpen: boolean;
    visitedRestaurantName: string;
    visitedRestaurantCode?: string;
    scannedTable?: string | null;
    scannedRestaurantName?: string | null;
    scannedRestaurantCode?: string | null;
    isDifferentRestaurant?: boolean;
    customMessage?: string | null;
    onScanAgain: () => void;
    onManualEntry: () => void;
    onClose: () => void;
}

export function TableNotFoundWarningCard({
    isOpen,
    visitedRestaurantName,
    visitedRestaurantCode,
    scannedTable,
    scannedRestaurantName,
    scannedRestaurantCode,
    isDifferentRestaurant = false,
    customMessage,
    onScanAgain,
    onManualEntry,
    onClose,
}: TableNotFoundWarningCardProps) {
    if (!isOpen) return null;

    const displayVisited = visitedRestaurantName || visitedRestaurantCode || 'This Restaurant';
    const displayScannedRest = scannedRestaurantName || scannedRestaurantCode || 'Another Restaurant';
    const displayTable = scannedTable || 'Unknown';

    return (
        <AnimatePresence>
            <div key="table-not-found-card-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
                <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 24 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 24 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                    className="relative w-full max-w-md rounded-3xl p-6 sm:p-7 overflow-hidden text-center my-auto"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35), inset 0 1px 2px rgba(255, 255, 255, 0.9)',
                        border: '1px solid rgba(255, 255, 255, 0.9)',
                    }}
                >
                    {/* Background Decorative Radial Gradient */}
                    <div
                        className="absolute -top-24 -left-24 size-48 rounded-full pointer-events-none opacity-40 blur-3xl"
                        style={{ background: 'radial-gradient(circle, #f97316 0%, transparent 70%)' }}
                    />
                    <div
                        className="absolute -bottom-24 -right-24 size-48 rounded-full pointer-events-none opacity-30 blur-3xl"
                        style={{ background: 'radial-gradient(circle, #ef4444 0%, transparent 70%)' }}
                    />

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        aria-label="Close warning"
                        className="absolute top-4 right-4 size-9 rounded-full bg-white/70 hover:bg-white text-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center shadow-xs cursor-pointer"
                    >
                        <X size={18} />
                    </button>

                    {/* Prominent Warning Icon with Animated Pulse Rings */}
                    <div className="relative mx-auto mt-2 mb-5 flex items-center justify-center size-20 sm:size-22">
                        {/* Outer Glow Ring */}
                        <div className="absolute inset-0 rounded-3xl bg-rose-500/15 animate-ping" style={{ animationDuration: '3s' }} />

                        {/* Middle Container */}
                        <div
                            className="relative size-20 sm:size-22 rounded-3xl flex items-center justify-center text-white"
                            style={{
                                background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
                                boxShadow: '0 10px 25px -5px rgba(239, 68, 68, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.4)',
                            }}
                        >
                            <div className="relative flex items-center justify-center">
                                <QrCode size={34} className="opacity-90" />
                                <div className="absolute -bottom-1 -right-2 size-6 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center shadow-md">
                                    <X size={13} className="text-rose-400 stroke-[3]" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Status Pill Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100/80 border border-rose-200/90 text-rose-700 text-xs font-bold uppercase tracking-wider mb-2.5">
                        <AlertTriangle size={13} className="shrink-0 text-rose-600" />
                        <span>
                            {isDifferentRestaurant ? 'Different Restaurant QR' : 'Table Not Found'}
                        </span>
                    </div>

                    {/* Headline */}
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                        Table Not Found in This Restaurant
                    </h2>

                    {/* Context Explanation */}
                    <p className="text-xs sm:text-sm text-slate-600 font-medium mt-2 leading-relaxed max-w-sm mx-auto">
                        {customMessage || (
                            isDifferentRestaurant ? (
                                <>
                                    The scanned QR code belongs to <span className="font-bold text-slate-900">{displayScannedRest}</span>, not <span className="font-bold text-slate-900">{displayVisited}</span>. Customers can only order from tables registered at this restaurant.
                                </>
                            ) : (
                                <>
                                    Table <span className="font-bold text-slate-900">&ldquo;{displayTable}&rdquo;</span> is not registered at <span className="font-bold text-slate-900">{displayVisited}</span>. Please scan the QR code located physically on your table stand.
                                </>
                            )
                        )}
                    </p>

                    {/* Inset Comparison Box */}
                    <div className="mt-4 mb-5 p-3.5 rounded-2xl bg-white/80 border border-slate-200/80 text-left space-y-2.5 shadow-xs">
                        {/* Visited Restaurant */}
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-slate-600 min-w-0">
                                <span className="size-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                                    <MapPin size={13} />
                                </span>
                                <div className="truncate">
                                    <div className="text-[10px] uppercase font-bold text-slate-400">Visiting Restaurant</div>
                                    <div className="font-bold text-slate-900 truncate">{displayVisited}</div>
                                </div>
                            </div>
                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                Current
                            </span>
                        </div>

                        <div className="border-t border-slate-100" />

                        {/* Scanned QR Info */}
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-slate-600 min-w-0">
                                <span className="size-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                    <Building2 size={13} />
                                </span>
                                <div className="truncate">
                                    <div className="text-[10px] uppercase font-bold text-slate-400">Scanned QR Code</div>
                                    <div className="font-bold text-slate-900 truncate">
                                        Table {displayTable} {isDifferentRestaurant ? `(${displayScannedRest})` : ''}
                                    </div>
                                </div>
                            </div>
                            <span className="shrink-0 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                                Mismatch
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2.5 w-full">
                        {/* Primary CTA: Scan Again */}
                        <button
                            type="button"
                            onClick={onScanAgain}
                            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Camera size={16} />
                            <span>Scan Table QR Again</span>
                            <ArrowRight size={15} />
                        </button>

                        {/* Secondary CTA: Manual Table Entry */}
                        <button
                            type="button"
                            onClick={onManualEntry}
                            className="w-full py-3 px-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs active:scale-[0.98]"
                        >
                            <Hash size={14} className="text-orange-600" />
                            <span>Enter Table Number Manually</span>
                        </button>

                        {/* Tertiary CTA: Dismiss */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition-colors pt-1 cursor-pointer"
                        >
                            Back to Dining Options
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
