'use client';

import { useSyncExternalStore, type ReactNode, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── Motion presets ───────────────────────────────────────────── */
export const springSnap = { type: 'spring', stiffness: 420, damping: 32, mass: 0.9 } as const;
export const springSoft = { type: 'spring', stiffness: 300, damping: 30 } as const;

/* ── Haptics (Flutter FeedbackUtils parity) ───────────────────── */
export const haptic = {
    light: () => { try { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(10); } catch (_) {} },
    selection: () => { try { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(8); } catch (_) {} },
    heavy: () => { try { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(30); } catch (_) {} },
    success: () => { try { if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([15, 40, 15]); } catch (_) {} },
};

/* ── Live alert-count store (written by WaiterAlertSystem,
      read by BottomNav — no duplicate subscriptions) ─────────── */
let wAlertCount = 0;
const wAlertListeners = new Set<() => void>();
export const alertCountStore = {
    set(n: number) {
        if (n === wAlertCount) return;
        wAlertCount = n;
        wAlertListeners.forEach((l) => l());
    },
};
export function useAlertCount() {
    return useSyncExternalStore(
        (l) => {
            wAlertListeners.add(l);
            return () => wAlertListeners.delete(l);
        },
        () => wAlertCount,
        () => 0,
    );
}

/* ── Table open state store (read by BottomNav to hide navigation when table is open) ── */
let wIsTableOpen = false;
const wTableOpenListeners = new Set<() => void>();
export const tableOpenStore = {
    set(open: boolean) {
        if (open === wIsTableOpen) return;
        wIsTableOpen = open;
        wTableOpenListeners.forEach((l) => l());
    },
    get() {
        return wIsTableOpen;
    },
};
export function useIsTableOpen() {
    return useSyncExternalStore(
        (l) => {
            wTableOpenListeners.add(l);
            return () => wTableOpenListeners.delete(l);
        },
        () => wIsTableOpen,
        () => false,
    );
}

const emptySubscribe = () => () => {};

/* ── Hydration tracker: Prevents SSR/Client hydration mismatch while keeping tab switches instant ── */
export function useIsHydrated() {
    return useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false
    );
}
export function isAppHydrated() {
    return false;
}
export function setAppHydrated() {
    // No-op: synchronized through useSyncExternalStore
}

/* ── Table status vocabulary (Flutter AppColors parity) ───────── */
export type TableStatusKey = 'available' | 'occupied' | 'need_bill' | 'dirty' | 'on_hold' | 'reserved';

interface StatusMeta {
    label: string;
    short: string;
    color: string;
}

export const TABLE_STATUS: Record<TableStatusKey, StatusMeta> = {
    available: { label: 'Available',       short: 'Available', color: '#10B981' },
    occupied:  { label: 'Occupied',        short: 'Occupied',  color: '#F59E0B' },
    need_bill: { label: 'Need Bill',       short: 'Need Bill', color: '#8B5CF6' },
    dirty:     { label: 'Needs Cleaning',  short: 'Dirty',     color: '#64748B' },
    on_hold:   { label: 'On Hold',         short: 'On Hold',   color: '#0284C7' },
    reserved:  { label: 'Reserved',        short: 'Reserved',  color: '#6366F1' },
};

/** Raw DB status → normalized Flutter enum (case-insensitive) */
export function normalizeTableStatus(raw?: string | null): TableStatusKey {
    const s = (raw || '').toLowerCase();
    if (['need_bill', 'billing', 'bill_requested'].includes(s)) return 'need_bill';
    if (['dirty', 'cleaning', 'to_clean'].includes(s)) return 'dirty';
    if (['on_hold', 'hold'].includes(s)) return 'on_hold';
    if (s === 'reserved') return 'reserved';
    if (['occupied', 'eating', 'cooking', 'seated'].includes(s)) return 'occupied';
    return 'available';
}

/* Order-status badge map (shared StatusBadge in Flutter) */
const ORDER_BADGE: Record<string, { label: string; color: string }> = {
    ready: { label: 'Ready', color: '#10B981' },
    cooking: { label: 'Preparing', color: '#F59E0B' },
    preparing: { label: 'Preparing', color: '#F59E0B' },
    placed: { label: 'Preparing', color: '#F59E0B' },
    eating: { label: 'Occupied', color: '#F59E0B' },
    occupied: { label: 'Occupied', color: '#F59E0B' },
    on_hold: { label: 'On Hold', color: '#0284C7' },
    customer_present: { label: 'On Hold', color: '#0284C7' },
    need_bill: { label: 'Need Bill', color: '#8B5CF6' },
    billing: { label: 'Need Bill', color: '#8B5CF6' },
    bill_requested: { label: 'Need Bill', color: '#8B5CF6' },
    dirty: { label: 'Dirty', color: '#64748B' },
    cleaning: { label: 'Dirty', color: '#64748B' },
    served: { label: 'Served', color: '#10B981' },
    finished: { label: 'Served', color: '#10B981' },
    cancelled: { label: 'Cancelled', color: '#EF4444' },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
    const meta = ORDER_BADGE[status?.toLowerCase()] || { label: 'Available', color: '#10B981' };
    return (
        <span
            className={cn('inline-flex items-center gap-1.5 px-2 py-[3px] rounded-full text-[11px] font-extrabold', className)}
            style={{ backgroundColor: `${meta.color}26`, border: `1px solid ${meta.color}66`, color: meta.color }}
        >
            <span className="size-[7px] rounded-full" style={{ backgroundColor: meta.color }} />
            {meta.label}
        </span>
    );
}

/* ── AppButton (Flutter parity: h52 · radius14 · label 14 w800) ── */
type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'success';

const VARIANTS: Record<ButtonVariant, string> = {
    primary: 'bg-w-brand text-white shadow-[0_4px_12px_rgba(255,107,53,0.35)] hover:bg-w-brand-strong',
    secondary: 'bg-w-border text-w-ink border border-w-border-strong hover:bg-slate-100',
    outline: 'bg-transparent text-w-brand border-[1.5px] border-w-brand hover:bg-w-brand-softer',
    danger: 'bg-w-alert text-white shadow-[0_4px_12px_rgba(239,68,68,0.3)] hover:bg-red-600',
    success: 'bg-[#10B981] text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:bg-emerald-600',
};

export function AppButton({
    children, onClick, variant = 'primary', disabled, loading, icon, className, type = 'button', grow,
}: {
    children: ReactNode;
    onClick?: () => void;
    variant?: ButtonVariant;
    disabled?: boolean;
    loading?: boolean;
    icon?: ReactNode;
    className?: string;
    type?: 'button' | 'submit';
    grow?: boolean | number;
}) {
    const flex = typeof grow === 'number' ? { flexGrow: grow, flexBasis: 0 } : grow ? { flexGrow: 1 } : undefined;
    return (
        <button
            type={type}
            onClick={() => {
                if (disabled || loading) return;
                haptic.light();
                onClick?.();
            }}
            disabled={disabled || loading}
            style={flex}
            className={cn(
                'relative inline-flex items-center justify-center gap-1.5 h-[52px] px-5 rounded-[14px] text-sm font-extrabold tracking-tight select-none min-w-0 active:scale-[0.97] transition-all duration-100 cursor-pointer',
                'disabled:bg-w-border/50 disabled:text-w-muted disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100',
                VARIANTS[variant],
                className,
            )}
        >
            {loading ? <Spinner className="size-[22px]" /> : (
                <>
                    {icon}
                    {children}
                </>
            )}
        </button>
    );
}

export function Spinner({ className }: { className?: string }) {
    return (
        <span
            aria-label="Loading"
            className={cn('inline-block size-6 rounded-full border-[2.5px] border-white/30 border-t-white animate-spin', className)}
        />
    );
}

/* ── Section overline (Flutter labelSmall: 10 w700 ls1.2) ─────── */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <p className={cn('text-[10px] font-bold uppercase tracking-[0.12em] text-w-ink-soft', className)}>
            {children}
        </p>
    );
}

/* ── Card (Flutter: white, r16, 1px #E2E8F0, elev1) ───────────── */
export function Card({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
    return (
        <div
            className={cn('bg-white rounded-2xl border border-w-border shadow-[0_1px_3px_rgba(15,23,42,0.06)]', className)}
            style={style}
        >
            {children}
        </div>
    );
}

/* ── EmptyStateView (Flutter parity) ──────────────────────────── */
export function EmptyState({
    icon, title, body, action, className,
}: {
    icon: ReactNode;
    title: string;
    body?: string;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springSoft}
            className={cn('flex flex-col items-center justify-center text-center py-14 px-8', className)}
        >
            <div className="size-[72px] rounded-full bg-[#F1F5F9] border-[1.5px] border-w-border-strong flex items-center justify-center text-w-muted mb-5 [&>svg]:size-8">
                {icon}
            </div>
            <h3 className="text-lg font-extrabold text-w-ink tracking-tight">{title}</h3>
            {body && <p className="text-sm text-w-ink-soft mt-1.5 leading-relaxed max-w-[30ch]">{body}</p>}
            {action && <div className="mt-6 w-[180px]">{action}</div>}
        </motion.div>
    );
}

/* ── Skeletons (Flutter shimmer parity) ───────────────────────── */
export function SkeletonGrid({ count = 6, className }: { count?: number; className?: string }) {
    return (
        <div className={cn('grid grid-cols-2 gap-3.5', className)} aria-hidden>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="w-skeleton rounded-2xl" style={{ aspectRatio: '1.05' }} />
            ))}
        </div>
    );
}

export function SkeletonList({ count = 3, height = 110, className }: { count?: number; height?: number; className?: string }) {
    return (
        <div className={cn('space-y-3', className)} aria-hidden>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="w-skeleton rounded-2xl" style={{ height }} />
            ))}
        </div>
    );
}

/* ── SlidingSegmentedBar (Flutter parity: h46 · #F1F5F9 · r16) ── */
export function SlidingSegmentedBar<T extends string>({
    options, value, onChange, className,
}: {
    options: { key: T; label: string; color: string; icon?: ReactNode }[];
    value: T;
    onChange: (key: T) => void;
    className?: string;
}) {
    return (
        <div className={cn('flex h-[46px] bg-[#F1F5F9] rounded-2xl border border-w-border-strong p-1', className)} role="tablist">
            {options.map((opt) => {
                const isActive = value === opt.key;
                return (
                    <button
                        key={opt.key}
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => {
                            haptic.selection();
                            onChange(opt.key);
                        }}
                        className="relative flex-1 flex items-center justify-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-w-brand/40 rounded-xl"
                    >
                        {isActive && (
                            <motion.span
                                layoutId="wSegBar"
                                className="absolute inset-0 rounded-xl"
                                style={{
                                    backgroundColor: opt.color,
                                    boxShadow: `0 3px 10px ${opt.color}59`,
                                }}
                                transition={{ duration: 0.3, ease: [0.65, 0, 0.35, 1] }}
                            />
                        )}
                        <span
                            className={cn(
                                'relative z-10 inline-flex items-center gap-1.5 text-xs transition-colors',
                                isActive ? 'text-white font-extrabold' : 'text-w-ink-soft font-semibold',
                            )}
                        >
                            {opt.icon}
                            {opt.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/* ── Live elapsed timer (Flutter formatLiveTimer: MM:SS / Hh MMm) ── */
export function LiveTimer({ since, className }: { since: string; className?: string }) {
    const isHydrated = useIsHydrated();
    const [, force] = useState(0);
    const startMs = useRef(new Date(since).getTime()).current;

    useEffect(() => {
        const t = setInterval(() => force((n) => n + 1), 1000);
        return () => clearInterval(t);
    }, []);

    if (!isHydrated) {
        return <span className={cn('w-num', className)}>--:--</span>;
    }

    const secs = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    const label =
        secs < 3600
            ? `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
            : `${Math.floor(secs / 3600)}h ${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}m`;

    return <span className={cn('w-num', className)}>{label}</span>;
}

/* Escalating request timer badge (Flutter RequestTimerBadge) */
export function RequestTimerBadge({ since }: { since: string }) {
    const isHydrated = useIsHydrated();
    const [, force] = useState(0);
    const startMs = useRef(new Date(since).getTime()).current;

    useEffect(() => {
        const t = setInterval(() => force((n) => n + 1), 1000);
        return () => clearInterval(t);
    }, []);

    if (!isHydrated) {
        return (
            <span
                className="w-num inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold text-[#475569] bg-[#E2E8F0] border border-transparent"
            >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span>--:--</span>
            </span>
        );
    }

    const mins = Math.floor((Date.now() - startMs) / 60000);
    const secs = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    const label = mins < 60
        ? `${String(mins).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
        : `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;

    const tone =
        mins < 5
            ? { fg: '#475569', bg: '#E2E8F0', border: 'transparent' }
            : mins < 10
              ? { fg: '#D97706', bg: '#FFFBEB', border: '#FCD34D' }
              : { fg: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5' };

    return (
        <span
            className="w-num inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-extrabold"
            style={{ color: tone.fg, backgroundColor: tone.bg, border: `1px solid ${tone.border}` }}
        >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span>{label}</span>
        </span>
    );
}

/* ── Confirm dialog (Flutter AlertDialog style) ───────────────── */
export type ConfirmTone = 'brand' | 'danger';

export function ConfirmDialog({
    open, icon, title, body, confirmLabel = 'Confirm', tone = 'brand', busy, onConfirm, onClose,
}: {
    open: boolean;
    icon?: ReactNode;
    title: string;
    body?: ReactNode;
    confirmLabel?: string;
    tone?: ConfirmTone;
    busy?: boolean;
    onConfirm: () => void;
    onClose: () => void;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label={title}>
            <motion.button
                aria-label="Cancel"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/50 cursor-default"
            />
            <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.94, opacity: 0 }}
                transition={springSoft}
                className="relative w-full max-w-[320px] bg-white rounded-[28px] p-6 shadow-2xl"
            >
                {icon && (
                    <div className={cn(
                        'size-14 rounded-2xl flex items-center justify-center mb-4 [&>svg]:size-6',
                        tone === 'danger' ? 'bg-w-alert-soft text-w-alert' : 'bg-w-brand-soft text-w-brand',
                    )}>
                        {icon}
                    </div>
                )}
                <h3 className="text-lg font-extrabold text-w-ink tracking-tight">{title}</h3>
                {body && <div className="mt-1.5 text-[13px] text-w-ink-soft leading-relaxed">{body}</div>}
                <div className="flex gap-3 mt-6">
                    <AppButton variant="secondary" grow onClick={onClose} className="!h-12">Cancel</AppButton>
                    <AppButton
                        variant={tone === 'danger' ? 'danger' : 'primary'}
                        grow
                        loading={busy}
                        onClick={onConfirm}
                        className="!h-12"
                    >
                        {confirmLabel}
                    </AppButton>
                </div>
            </motion.div>
        </div>
    );
}
