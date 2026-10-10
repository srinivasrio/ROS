'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
    UtensilsCrossed, ArrowRight, 
    AlertCircle, Loader2, ShieldCheck, RefreshCw
} from 'lucide-react';

export interface CustomerConnectedOtherTableScreenProps {
    restaurantCode?: string;
    currentTableNumber?: string;
    activeTableNumber?: string;
    activeTableToken?: string;
    activeSessionId?: string;
    activeHomeUrl?: string;
    isHost?: boolean;
    customerMobile?: string;
    onSwitched?: () => void;
}

export function CustomerConnectedOtherTableScreen({
    restaurantCode,
    currentTableNumber,
    activeTableNumber,
    activeTableToken,
    activeSessionId,
    activeHomeUrl,
    isHost = false,
    customerMobile,
}: CustomerConnectedOtherTableScreenProps) {
    const [restoring, setRestoring] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Format clean display names for tables (e.g. '5' -> '5', 'Table 5' -> '5')
    const displayActiveTable = String(activeTableNumber || '').replace(/^table\s*/i, '').trim() || 'Your Table';
    const displayCurrentTable = String(currentTableNumber || '').replace(/^table\s*/i, '').trim() || 'Scanned Table';

    const handleGoBackToActiveTable = async () => {
        if (restoring) return;
        setRestoring(true);
        setErrorMsg('');

        try {
            // 1. Resolve mobile from prop or localStorage
            let mobile = customerMobile || '';
            if (!mobile && typeof window !== 'undefined') {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('ros_customer_mobile_')) {
                        const val = localStorage.getItem(k);
                        if (val) {
                            mobile = val;
                            break;
                        }
                    }
                }
            }

            const effectiveRestId = restaurantCode || (typeof window !== 'undefined' ? (
                sessionStorage.getItem('ros_current_restaurant_id') ||
                sessionStorage.getItem('ros_last_restaurant_id') || ''
            ) : '');

            // 2. Determine target URL
            let targetUrl = activeHomeUrl || '';

            // If not directly supplied in props, check table token or active table number
            if (!targetUrl || targetUrl.includes('/undefined') || targetUrl.startsWith('//')) {
                if (activeTableToken) {
                    targetUrl = `/customer/t/${activeTableToken}/home`;
                } else if (effectiveRestId && displayActiveTable && displayActiveTable !== 'Your Table') {
                    targetUrl = `/${effectiveRestId}/customer/home/${encodeURIComponent(displayActiveTable)}`;
                }
            }

            // 3. Verify session & canonical URL with backend if available
            if (effectiveRestId && mobile) {
                try {
                    const res = await fetch(
                        `/api/customer/table-session/active?restaurantId=${encodeURIComponent(effectiveRestId)}&tableNumber=${encodeURIComponent(displayActiveTable)}&customerMobile=${encodeURIComponent(mobile)}`
                    );
                    if (res.ok) {
                        const data = await res.json();
                        if (data.otherSession?.homeUrl) {
                            targetUrl = data.otherSession.homeUrl;
                        } else if (data.otherSession?.tableToken) {
                            targetUrl = `/customer/t/${data.otherSession.tableToken}/home`;
                        } else if (data.otherSession?.tableNumber) {
                            const restCode = data.otherSession.restaurantSlug || data.otherSession.restaurantCode || effectiveRestId;
                            targetUrl = `/${restCode}/customer/home/${encodeURIComponent(data.otherSession.tableNumber)}`;
                        }
                    }
                } catch (verifyErr) {
                    console.warn('[Session Verification Notice]:', verifyErr);
                }
            }

            // 4. Validate resolved targetUrl to prevent client-side routing exceptions
            if (!targetUrl || targetUrl.includes('undefined') || targetUrl.startsWith('//')) {
                if (displayActiveTable && effectiveRestId) {
                    targetUrl = `/${effectiveRestId}/customer/home/${encodeURIComponent(displayActiveTable)}`;
                } else {
                    throw new Error(`Unable to determine valid return route for Table ${displayActiveTable}. Please try again.`);
                }
            }

            // 5. Ensure customer table in localStorage reflects activeTableNumber and keep cart safe
            if (typeof window !== 'undefined' && displayActiveTable && displayActiveTable !== 'Your Table') {
                try {
                    localStorage.setItem('customer_table_number', displayActiveTable);
                } catch {}
            }

            // 6. Navigate safely to active table home
            window.location.replace(targetUrl);
        } catch (err: any) {
            console.error('[ReturnToActiveTable Error]:', err);
            setErrorMsg(err.message || 'Failed to return to your table session. Please tap retry.');
            setRestoring(false);
        }
    };

    return (
        <div className="fixed inset-0 h-[100dvh] bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800 z-[200]">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 text-center flex flex-col items-center"
            >
                {/* Visual Icon Badge */}
                <div className="w-20 h-20 bg-amber-50 border border-amber-100 rounded-3xl flex items-center justify-center mb-5 shadow-lg shadow-amber-500/10">
                    <UtensilsCrossed className="text-amber-600" size={36} />
                </div>

                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-xs font-black uppercase tracking-wider mb-3">
                    <ShieldCheck size={14} />
                    <span>Table Session Active</span>
                </div>

                <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
                    Already Seated at Table {displayActiveTable}
                </h2>

                <p className="text-slate-500 text-xs sm:text-sm mb-6 leading-relaxed max-w-xs">
                    You scanned <strong className="text-slate-800 font-bold">Table {displayCurrentTable}</strong>, but your account is already connected to <strong className="text-slate-800 font-bold">Table {displayActiveTable}</strong>. Your cart, orders, and dining session are active and preserved.
                </p>

                {errorMsg && (
                    <div className="w-full mb-5 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-left flex items-start gap-2">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span className="flex-1 font-medium">{errorMsg}</span>
                    </div>
                )}

                <div className="flex flex-col gap-3 w-full">
                    {/* Only Action Button: Go Back to Active Table */}
                    <button
                        type="button"
                        disabled={restoring}
                        onClick={handleGoBackToActiveTable}
                        className="w-full py-4 px-6 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20 text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                    >
                        {restoring ? (
                            <>
                                <Loader2 size={18} className="animate-spin text-white" />
                                <span>Returning to Table {displayActiveTable}...</span>
                            </>
                        ) : (
                            <>
                                <span>Go Back to Table {displayActiveTable}</span>
                                <ArrowRight size={18} />
                            </>
                        )}
                    </button>

                    {errorMsg && (
                        <button
                            type="button"
                            onClick={handleGoBackToActiveTable}
                            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <RefreshCw size={14} />
                            <span>Retry Returning to Table {displayActiveTable}</span>
                        </button>
                    )}
                </div>

                <p className="text-[11px] text-slate-400 mt-6 leading-tight">
                    Each diner can only belong to one active table at a time to prevent accidental duplicate orders.
                </p>
            </motion.div>
        </div>
    );
}
