'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    AlertTriangle as LucideAlertTriangle,
    X as LucideX,
    ShieldAlert as LucideShieldAlert,
    Ticket as LucideTicket,
    Info as LucideInfo,
    CheckCircle2 as LucideCheckCircle2
} from 'lucide-react';

export interface WarningPopupOptions {
    id?: string;
    title?: string;
    message: string;
    details?: string;
    type?: 'warning' | 'coupon' | 'restriction' | 'error' | 'info';
    dismissText?: string;
    actionText?: string;
    onAction?: () => void;
    onDismiss?: () => void;
}

/**
 * Global trigger to open the dedicated Warning Popup Card from anywhere in the application.
 */
export function showWarningPopup(options: WarningPopupOptions | string) {
    if (typeof window === 'undefined') return;
    const payload: WarningPopupOptions = typeof options === 'string'
        ? { message: options }
        : options;
    window.dispatchEvent(new CustomEvent('ros-warning-popup', { detail: payload }));
}

/**
 * Hook for consuming warning popup in React components.
 */
export function useWarningPopup() {
    return {
        showWarning: showWarningPopup,
    };
}

/**
 * Standalone or embedded Warning Popup Card UI
 */
export function WarningPopupCard({
    isOpen,
    options,
    onClose,
}: {
    isOpen: boolean;
    options: WarningPopupOptions | null;
    onClose: () => void;
}) {
    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !options) return null;

    const {
        title = options.type === 'coupon' ? 'Coupon Notice' : 'Attention Required',
        message,
        details,
        type = 'warning',
        dismissText = 'Dismiss',
        actionText,
        onAction,
        onDismiss,
    } = options;

    const handleDismiss = () => {
        if (onDismiss) onDismiss();
        onClose();
    };

    const handleAction = () => {
        if (onAction) onAction();
        onClose();
    };

    // Thematic styles based on warning type
    const getTheme = () => {
        switch (type) {
            case 'coupon':
                return {
                    badge: 'COUPON NOTICE',
                    icon: LucideTicket,
                    gradient: 'from-amber-500 via-orange-500 to-rose-500',
                    badgeBg: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
                    iconRing: 'from-amber-400 to-orange-500',
                    buttonGradient: 'from-amber-500 via-orange-500 to-rose-500',
                    shadow: 'shadow-orange-500/30',
                };
            case 'restriction':
                return {
                    badge: 'RESTRICTION',
                    icon: LucideShieldAlert,
                    gradient: 'from-rose-500 via-orange-500 to-amber-500',
                    badgeBg: 'bg-rose-500/10 text-rose-700 border-rose-500/20',
                    iconRing: 'from-rose-500 to-orange-500',
                    buttonGradient: 'from-rose-500 via-orange-500 to-amber-500',
                    shadow: 'shadow-rose-500/30',
                };
            case 'error':
                return {
                    badge: 'ERROR NOTICE',
                    icon: LucideAlertTriangle,
                    gradient: 'from-red-500 via-rose-500 to-orange-500',
                    badgeBg: 'bg-red-500/10 text-red-700 border-red-500/20',
                    iconRing: 'from-red-500 to-rose-500',
                    buttonGradient: 'from-red-500 via-rose-500 to-orange-500',
                    shadow: 'shadow-red-500/30',
                };
            default:
                return {
                    badge: 'WARNING',
                    icon: LucideAlertTriangle,
                    gradient: 'from-amber-500 via-orange-500 to-yellow-500',
                    badgeBg: 'bg-amber-500/10 text-amber-800 border-amber-500/20',
                    iconRing: 'from-amber-400 to-orange-500',
                    buttonGradient: 'from-amber-500 via-orange-500 to-rose-500',
                    shadow: 'shadow-orange-500/30',
                };
        }
    };

    const theme = getTheme();
    const IconComponent = theme.icon;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
                {/* Backdrop Blur Overlay */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={handleDismiss}
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-md cursor-pointer"
                />

                {/* Warning Popup Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 8 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    className="relative w-full max-w-sm sm:max-w-md bg-[#EEF2F6] rounded-[28px] overflow-hidden z-10 flex flex-col pointer-events-auto"
                    style={{
                        boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.45), 0 0 1px 1px rgba(255, 255, 255, 0.8) inset',
                        border: '1px solid rgba(255, 255, 255, 0.9)',
                    }}
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="warning-popup-title"
                    aria-describedby="warning-popup-desc"
                >
                    {/* Top Decorative Ambient Glow Bar */}
                    <div className={`h-2.5 w-full bg-gradient-to-r ${theme.gradient}`} />

                    {/* Close "X" Button (Top Right) */}
                    <button
                        type="button"
                        onClick={handleDismiss}
                        aria-label="Close dialog"
                        className="absolute top-4 right-4 size-9 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-all active:scale-95 border border-white/60 shadow-xs cursor-pointer z-20"
                    >
                        <LucideX size={17} strokeWidth={2.4} />
                    </button>

                    {/* Card Content Area */}
                    <div className="p-6 sm:p-7 pt-5 text-center flex flex-col items-center">
                        {/* Glowing Warning Icon with Ambient Aura */}
                        <div className="relative mb-4 mt-1">
                            <div className={`absolute -inset-2 rounded-full bg-gradient-to-r ${theme.gradient} opacity-20 blur-md animate-pulse`} />
                            <div
                                className="relative size-16 rounded-2xl flex items-center justify-center"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.45), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                                    border: '1px solid rgba(255, 255, 255, 0.85)',
                                }}
                            >
                                <div className={`size-12 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-white shadow-md`}>
                                    <IconComponent size={24} strokeWidth={2.4} />
                                </div>
                            </div>
                        </div>

                        {/* Category Badge */}
                        <div className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider mb-2 border ${theme.badgeBg}`}>
                            <span>{theme.badge}</span>
                        </div>

                        {/* Title */}
                        <h2
                            id="warning-popup-title"
                            className="text-lg sm:text-xl font-black text-slate-800 tracking-tight mb-2 leading-snug"
                        >
                            {title}
                        </h2>

                        {/* Primary Message */}
                        <p
                            id="warning-popup-desc"
                            className="text-xs sm:text-sm font-semibold text-slate-600 leading-relaxed max-w-sm px-1 mb-4"
                        >
                            {message}
                        </p>

                        {/* Optional Details Box (if provided) */}
                        {details && (
                            <div
                                className="w-full text-left p-3.5 rounded-2xl mb-4 text-xs font-medium text-slate-600 space-y-1"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.95)',
                                    border: '1px solid rgba(255, 255, 255, 0.75)',
                                }}
                            >
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                                    Details
                                </span>
                                <p className="text-xs font-bold text-slate-700">{details}</p>
                            </div>
                        )}

                        {/* Button Actions */}
                        <div className="w-full flex flex-col sm:flex-row gap-2.5 mt-2">
                            {actionText && (
                                <button
                                    type="button"
                                    onClick={handleAction}
                                    className="flex-1 py-3 px-5 rounded-2xl font-black text-xs text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-all active:scale-[0.98] shadow-xs cursor-pointer"
                                >
                                    {actionText}
                                </button>
                            )}

                            {/* Prominent Dismiss Button */}
                            <button
                                type="button"
                                onClick={handleDismiss}
                                autoFocus
                                className={`flex-1 py-3.5 px-6 rounded-2xl font-black text-xs sm:text-sm text-white bg-gradient-to-r ${theme.buttonGradient} ${theme.shadow} shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer`}
                            >
                                {dismissText}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

/**
 * Global Warning Popup Provider mounted once at the root level (app/layout.tsx).
 * Handles global custom events, window error listeners, and unhandled promise rejections.
 */
export function WarningPopupProvider({ children }: { children: React.ReactNode }) {
    const [currentPopup, setCurrentPopup] = useState<WarningPopupOptions | null>(null);

    const handleOpen = useCallback((options: WarningPopupOptions) => {
        setCurrentPopup(options);
    }, []);

    const handleClose = useCallback(() => {
        setCurrentPopup(null);
    }, []);

    useEffect(() => {
        // 1. Listen for explicit 'ros-warning-popup' CustomEvents
        const handleCustomEvent = (event: Event) => {
            const customEv = event as CustomEvent<WarningPopupOptions>;
            if (customEv.detail && customEv.detail.message) {
                handleOpen(customEv.detail);
            }
        };
        window.addEventListener('ros-warning-popup', handleCustomEvent);

        // 2. Listen for Unhandled Promise Rejections containing operational exceptions
        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const message = reason?.message || String(reason || '');

            // Recognize business exceptions (such as coupon restrictions, out of bounds, validation errors)
            if (message && isUserFacingException(message)) {
                event.preventDefault(); // Suppress red exception in browser
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                handleOpen({
                    title: getExceptionTitle(message),
                    message: cleanExceptionMessage(message),
                    type: isCouponMessage(message) ? 'coupon' : 'warning',
                    dismissText: 'Dismiss',
                });
                return true;
            }
        };
        window.addEventListener('unhandledrejection', handleUnhandledRejection, true);

        // 3. Listen for window ErrorEvent and suppress console exception for business rules
        const handleWindowError = (event: ErrorEvent) => {
            const message = event?.message || event?.error?.message || '';
            if (message && isUserFacingException(message)) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                handleOpen({
                    title: getExceptionTitle(message),
                    message: cleanExceptionMessage(message),
                    type: isCouponMessage(message) ? 'coupon' : 'warning',
                    dismissText: 'Dismiss',
                });
                return true;
            }
        };
        window.addEventListener('error', handleWindowError, true);

        // 4. Patch console.error: Suppress error output when it matches a user-facing warning
        const originalConsoleError = console.error;
        console.error = (...args: any[]) => {
            let isHandledWarning = false;

            // Check if any argument is an error with a user-facing exception message
            for (const arg of args) {
                const msg = arg?.message || (typeof arg === 'string' ? arg : '');
                if (typeof msg === 'string' && isUserFacingException(msg)) {
                    isHandledWarning = true;
                    handleOpen({
                        title: getExceptionTitle(msg),
                        message: cleanExceptionMessage(msg),
                        type: isCouponMessage(msg) ? 'coupon' : 'warning',
                        dismissText: 'Dismiss',
                    });
                    break;
                }
            }

            // ONLY print to console if it was NOT handled by the warning popup card
            if (!isHandledWarning) {
                originalConsoleError.apply(console, args);
            }
        };

        return () => {
            window.removeEventListener('ros-warning-popup', handleCustomEvent);
            window.removeEventListener('unhandledrejection', handleUnhandledRejection, true);
            window.removeEventListener('error', handleWindowError, true);
            console.error = originalConsoleError;
        };
    }, [handleOpen]);

    return (
        <>
            {children}
            <WarningPopupCard
                isOpen={Boolean(currentPopup)}
                options={currentPopup}
                onClose={handleClose}
            />
        </>
    );
}

// Helper predicates to detect operational/business exceptions
function isCouponMessage(msg: string): boolean {
    const lower = msg.toLowerCase();
    return lower.includes('coupon') || lower.includes('discount code') || lower.includes('promo code');
}

function isUserFacingException(msg: string): boolean {
    if (!msg || typeof msg !== 'string') return false;
    const lower = msg.toLowerCase();

    // Authentication and login exceptions
    if (
        lower.includes('login') ||
        lower.includes('authentication') ||
        lower.includes('credentials') ||
        lower.includes('password') ||
        lower.includes('security pin') ||
        lower.includes('employee pin') ||
        lower.includes('session expired') ||
        lower.includes('unauthorized') ||
        lower.includes('access denied') ||
        lower.includes('tenant mismatch') ||
        lower.includes('suspended') ||
        lower.includes('privilege') ||
        lower.includes('account inactive') ||
        lower.includes('identity mismatch') ||
        lower.includes('only owners can') ||
        lower.includes('only restaurant owners') ||
        lower.includes('failed to fetch') ||
        lower.includes('network error')
    ) {
        return true;
    }

    // Coupon and promo code operational rules
    if (lower.includes('coupon') || lower.includes('discount code') || lower.includes('promo code')) {
        if (lower.includes('valid') || lower.includes('expired') || lower.includes('invalid') || 
            lower.includes('minimum') || lower.includes('limit') || lower.includes('applied') || 
            lower.includes('cannot') || lower.includes('failed') || lower.includes('order type') ||
            lower.includes('eligible') || lower.includes('restriction')) {
            return true;
        }
    }

    // Delivery rules and geo-restrictions
    if (lower.includes('delivery')) {
        if (lower.includes('radius') || lower.includes('zone') || lower.includes('eligible') || 
            lower.includes('outside') || lower.includes('address') || lower.includes('not within')) {
            return true;
        }
    }

    // Staff and role restrictions
    if (lower.includes('only waiters can mark') || lower.includes('only waiters can')) return true;
    if (lower.includes('waiter') && (lower.includes('assigned') || lower.includes('restricted') || lower.includes('permission'))) return true;
    if (lower.includes('selected menu item is no longer available')) return true;
    if (lower.includes('cannot clear table') || lower.includes('you are not assigned to table')) return true;
    if (lower.includes('table is assigned to') && lower.includes('request access')) return true;
    if (lower.includes('admin assignment is prohibited')) return true;

    return false;
}

function getExceptionTitle(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes('session') || lower.includes('expired')) return 'Session Expired';
    if (lower.includes('unauthorized') || lower.includes('access denied') || lower.includes('privilege') || lower.includes('forbidden')) return 'Access Denied';
    if (lower.includes('suspended')) return 'Account Suspended';
    if (lower.includes('tenant mismatch') || lower.includes('cannot access restaurants')) return 'Tenant Mismatch';
    if (lower.includes('password') || lower.includes('credential') || lower.includes('pin') || lower.includes('auth') || lower.includes('login')) return 'Authentication Failed';
    if (lower.includes('coupon')) return 'Coupon Notice';
    if (lower.includes('delivery')) return 'Delivery Restriction';
    if (lower.includes('waiter')) return 'Action Restricted';
    if (lower.includes('table')) return 'Table Notice';
    if (lower.includes('admin assignment')) return 'Admin Assignment Prohibited';
    if (lower.includes('menu item')) return 'Item Unavailable';
    return 'Attention Required';
}

function cleanExceptionMessage(msg: string): string {
    // Strip error prefixes if present
    return msg.replace(/^Error:\s*/i, '').trim();
}

