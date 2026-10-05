'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Phone, ArrowRight, Loader2, Utensils, ShoppingBag, Bike,
    AlertCircle, CheckCircle2, RefreshCw, ChevronRight, Clock, MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { CustomerCache } from '@/services/homepage-cache.service';
import { formatAddress } from '@/lib/utils';

interface CustomerMobileEntryProps {
    restaurantCode: string;
    initialTable?: string | null;
}

interface ActiveOrderInfo {
    id: string;
    orderNumber: number | string;
    orderType: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
    status: string;
    tableNumber: string | null;
    totalAmount: number;
    createdAt: string;
    redirectUrl: string;
}

interface RestaurantProfile {
    name?: string;
    logo_url?: string;
    logo?: string;
    address?: string;
    tagline?: string;
}

export default function CustomerMobileEntry({ restaurantCode, initialTable }: CustomerMobileEntryProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const tableFromUrl = initialTable || searchParams?.get('table') || searchParams?.get('tableNumber') || searchParams?.get('table_number') || searchParams?.get('t') || '';

    const [mobile, setMobile] = useState('');
    const [profile, setProfile] = useState<RestaurantProfile | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);

    const [checking, setChecking] = useState(false);
    const [validationError, setValidationError] = useState('');
    const [serverError, setServerError] = useState('');

    // State for multiple active orders
    const [multipleActiveOrders, setMultipleActiveOrders] = useState<ActiveOrderInfo[]>([]);
    const [showMultipleOrdersModal, setShowMultipleOrdersModal] = useState(false);
    const [redirectingMessage, setRedirectingMessage] = useState('');

    // Load saved phone number and restaurant profile on mount
    useEffect(() => {
        if (!restaurantCode) return;

        // Try pre-filling previously saved mobile for convenience
        try {
            const savedMobile = localStorage.getItem(`ros_customer_mobile_${restaurantCode}`) || '';
            if (savedMobile) {
                // Strip +91 if present for clean 10-digit display
                const digits = savedMobile.replace(/\D/g, '');
                setMobile(digits.length > 10 ? digits.slice(-10) : digits);
            }
        } catch {}

        // Fetch Restaurant Profile
        HomepageBuilderService.getProfile(restaurantCode)
            .then(profileData => {
                if (profileData) {
                    setProfile({
                        name: profileData.name || profileData.restaurant_name,
                        logo_url: profileData.logo_url || profileData.logo,
                        address: formatAddress(profileData.address),
                        tagline: profileData.tagline,
                    });
                }
            })
            .catch(err => {
                console.warn('Could not load restaurant profile:', err);
            })
            .finally(() => setLoadingProfile(false));
    }, [restaurantCode]);

    // Format input as user types: allow only numbers, strip country code prefixes if pasted, max 10 digits
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value.replace(/\D/g, '');
        if (raw.startsWith('91') && raw.length > 10) {
            raw = raw.slice(2);
        } else if (raw.startsWith('0') && raw.length > 10) {
            raw = raw.slice(1);
        }
        const val = raw.slice(0, 10);
        setMobile(val);
        setValidationError('');
        setServerError('');
    };

    // Validate mobile number format: standard 10-digit Indian mobile [6-9]\d{9}
    const validateMobileFormat = (val: string): boolean => {
        const digits = val.trim().replace(/\D/g, '');
        if (!digits) {
            setValidationError('Please enter your mobile number');
            return false;
        }
        if (digits.length < 10) {
            setValidationError('Please enter a complete 10-digit mobile number');
            return false;
        }
        if (!/^[6-9]\d{9}$/.test(digits)) {
            setValidationError('Mobile number should start with 6, 7, 8, or 9');
            return false;
        }
        return true;
    };

    // Submit handler
    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setServerError('');
        setValidationError('');

        const isValid = validateMobileFormat(mobile);
        if (!isValid) return;

        const cleanMobile = mobile.trim().replace(/\D/g, '');

        try {
            setChecking(true);

            const res = await fetch('/api/customer/active-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantCode,
                    mobile: cleanMobile,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setServerError(data.error || 'Failed to check active orders. Please try again.');
                setChecking(false);
                return;
            }

            // If the entered mobile is different from previously stored mobile on this device,
            // wipe old customer session, last order, and cart so old session doesn't leak into new user
            try {
                const prevMobile = localStorage.getItem(`ros_customer_mobile_${restaurantCode}`) || '';
                const cleanPrev = prevMobile.replace(/\D/g, '').slice(-10);
                if (cleanPrev && cleanPrev !== cleanMobile) {
                    localStorage.removeItem(`ros_customer_${restaurantCode}`);
                    localStorage.removeItem(`ros_customer_name_${restaurantCode}`);
                    localStorage.removeItem(`ros_customer_email_${restaurantCode}`);
                    localStorage.removeItem(`ros_customer_dob_${restaurantCode}`);
                    localStorage.removeItem(`ros_last_order_${restaurantCode}`);
                    if (tableFromUrl) {
                        localStorage.removeItem(`ros_last_order_${restaurantCode}_${tableFromUrl}`);
                    }
                    localStorage.removeItem('customer_cart');
                    localStorage.removeItem('customer_table_number');
                    CustomerCache.clear(restaurantCode);
                }
            } catch {}

            // Persist verified customer mobile and customer info
            try {
                localStorage.setItem(`ros_customer_mobile_${restaurantCode}`, cleanMobile);
                localStorage.setItem(`ros_customer_skipped_${restaurantCode}`, 'true');
                if (data.customer?.id) {
                    localStorage.setItem(`ros_customer_${restaurantCode}`, data.customer.id);
                }
                if (data.customer?.name) {
                    localStorage.setItem(`ros_customer_name_${restaurantCode}`, data.customer.name);
                }
            } catch {}

            const activeOrders: ActiveOrderInfo[] = data.activeOrders || [];

            // Case 1: Active Order(s) Found
            if (data.hasActiveOrder && activeOrders.length > 0) {
                // If a table QR code was scanned (tableFromUrl is set),
                // verify that the active order is actually for THIS table!
                const isDifferentTable = Boolean(
                    tableFromUrl && 
                    activeOrders.length === 1 && 
                    activeOrders[0].tableNumber && 
                    String(activeOrders[0].tableNumber).toLowerCase() !== String(tableFromUrl).toLowerCase()
                );

                if (!isDifferentTable && activeOrders.length === 1) {
                    // Exactly one active order for this table/order type -> directly redirect
                    const singleOrder = activeOrders[0];
                    const orderTypeLabel = singleOrder.orderType === 'DELIVERY' ? 'Home Delivery' : singleOrder.orderType === 'TAKEAWAY' ? 'Takeaway' : (singleOrder.tableNumber ? `Dine In (Table ${singleOrder.tableNumber})` : 'Dine In');
                    
                    setRedirectingMessage(`Active ${orderTypeLabel} order found! Opening order status...`);
                    toast.success(`Active ${orderTypeLabel} order found!`);

                    setTimeout(() => {
                        router.push(singleOrder.redirectUrl);
                    }, 600);
                    return;
                } else if (!isDifferentTable) {
                    // Multiple active orders found -> present them to the customer so they can pick without arbitrary selection
                    setMultipleActiveOrders(activeOrders);
                    setShowMultipleOrdersModal(true);
                    setChecking(false);
                    return;
                } else {
                    // Active order exists for a DIFFERENT table (e.g. Table 1, but user scanned Table 2)
                    // Do NOT hijack them back to the old table!
                    // Let them proceed with dining at this new table.
                    toast.info(`You have an active order on Table ${activeOrders[0].tableNumber}. Continuing to Table ${tableFromUrl}...`);
                }
            }

            // Case 2: No Active Order Found (or user is visiting a new table)
            // Redirect customer to the new Order Type Selection page
            setChecking(false);
            const queryParams = new URLSearchParams();
            if (tableFromUrl) queryParams.set('table', tableFromUrl);
            const target = `/${restaurantCode}/customer/order-type${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
            router.push(target);

        } catch (err: any) {
            console.error('[CustomerMobileEntry] Network or server error:', err);
            setServerError('Network error. Please check your internet connection and try again.');
            setChecking(false);
        }
    };

    const handleSelectExistingOrder = (order: ActiveOrderInfo) => {
        setShowMultipleOrdersModal(false);
        setRedirectingMessage(`Opening Order #${order.orderNumber}...`);
        router.push(order.redirectUrl);
    };

    const handleProceedToNewOrder = () => {
        setShowMultipleOrdersModal(false);
        const queryParams = new URLSearchParams();
        if (tableFromUrl) queryParams.set('table', tableFromUrl);
        router.push(`/${restaurantCode}/customer/order-type${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
    };

    const restaurantName = profile?.name || 'Restaurant';
    const logoUrl = profile?.logo_url || profile?.logo;
    const address = formatAddress(profile?.address);
    const tagline = profile?.tagline || 'Experience dining perfected';

    return (
        <div className="min-h-screen bg-[#EEF2F6] flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans text-slate-800 relative">
            {/* Header with Restaurant Branding */}
            <header className="w-full max-w-md mx-auto text-center pt-6 sm:pt-10 pb-4">
                <motion.div
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col items-center"
                >
                    <div
                        className="size-20 sm:size-24 rounded-3xl p-1 mb-4 flex items-center justify-center overflow-hidden"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '8px 8px 20px rgba(166, 180, 200, 0.45), -8px -8px 20px rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.9)',
                        }}
                    >
                        {logoUrl ? (
                            <img src={logoUrl} alt={restaurantName} className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-orange-500 to-rose-500 rounded-2xl flex items-center justify-center text-white font-black text-3xl">
                                {restaurantName.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-1">
                        {restaurantName}
                    </h1>

                    <p className="text-xs sm:text-sm text-slate-500 max-w-xs line-clamp-1">
                        {tagline}
                    </p>

                    {tableFromUrl && (
                        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Table {tableFromUrl}</span>
                        </div>
                    )}
                </motion.div>
            </header>

            {/* Main Form Content */}
            <main className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center py-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                    className="p-6 sm:p-7 rounded-[28px] relative overflow-hidden"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '8px 8px 22px rgba(166, 180, 200, 0.45), -8px -8px 22px rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.85)',
                    }}
                >
                    {/* Redirecting Banner */}
                    <AnimatePresence>
                        {redirectingMessage && (
                            <motion.div
                                key="banner-redirecting"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mb-5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5"
                            >
                                <CheckCircle2 size={18} className="text-emerald-600 shrink-0 animate-bounce" />
                                <span>{redirectingMessage}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Step Title & Subtitle */}
                    <div className="mb-6">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100/70 text-orange-700 text-[10px] font-black uppercase tracking-wider mb-2">
                            <span>Step 1 of 2</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Enter Mobile Number
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
                            We'll check for any active orders and get you started with ordering right away.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Mobile Number Input with +91 Prefix */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                                Mobile Number <span className="text-rose-500">*</span>
                            </label>

                            <div
                                className={`flex items-center rounded-2xl p-1.5 transition-all ${
                                    validationError || serverError
                                        ? 'ring-2 ring-rose-400 bg-rose-50/30'
                                        : mobile.length === 10
                                        ? 'ring-2 ring-emerald-400/50 bg-white'
                                        : 'focus-within:ring-2 focus-within:ring-orange-500/40 bg-white'
                                }`}
                                style={{
                                    boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                    border: '1px solid rgba(226, 232, 240, 0.8)',
                                }}
                            >
                                {/* Country Code Badge */}
                                <div
                                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 select-none shrink-0"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: '2px 2px 4px rgba(166, 180, 200, 0.3), -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                    }}
                                >
                                    <span className="text-sm">🇮🇳</span>
                                    <span>+91</span>
                                </div>

                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    autoFocus
                                    disabled={checking || Boolean(redirectingMessage)}
                                    placeholder="Enter 10-digit number"
                                    value={mobile}
                                    onChange={handlePhoneChange}
                                    className="w-full px-3 py-2 bg-transparent text-slate-900 font-bold text-base placeholder:text-slate-400 placeholder:font-normal focus:outline-none tracking-wider"
                                />

                                {mobile && !checking && !redirectingMessage && (
                                    <button
                                        type="button"
                                        onClick={() => setMobile('')}
                                        className="size-7 rounded-full text-slate-400 hover:text-slate-600 flex items-center justify-center text-xs font-bold hover:bg-slate-100 transition-colors mr-1 cursor-pointer"
                                        title="Clear"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Validation error message */}
                            {validationError && (
                                <p className="text-xs text-rose-500 font-semibold mt-1.5 ml-1 flex items-center gap-1">
                                    <AlertCircle size={13} className="shrink-0" />
                                    <span>{validationError}</span>
                                </p>
                            )}

                            {/* Server error message */}
                            {serverError && (
                                <div className="mt-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                                    <AlertCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <span>{serverError}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleSubmit()}
                                            className="block text-rose-800 underline font-bold mt-1 cursor-pointer"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                </div>
                            )}

                            <p className="text-[11px] text-slate-400 mt-2 ml-1">
                                Format: 10-digit Indian mobile number (e.g. 98765 43210)
                            </p>
                        </div>

                        {/* Continue Button */}
                        <button
                            type="submit"
                            disabled={checking || Boolean(redirectingMessage) || mobile.length < 10}
                            className={`w-full py-4 rounded-2xl font-black text-sm tracking-wide transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md ${
                                checking || Boolean(redirectingMessage)
                                    ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                                    : mobile.length === 10
                                    ? 'bg-gradient-to-r from-orange-500 via-orange-600 to-rose-500 text-white shadow-orange-500/30 hover:scale-[1.01] active:scale-[0.99]'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {checking ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    <span>Checking Active Orders...</span>
                                </>
                            ) : redirectingMessage ? (
                                <>
                                    <CheckCircle2 size={18} />
                                    <span>Redirecting...</span>
                                </>
                            ) : (
                                <>
                                    <span>Continue</span>
                                    <ArrowRight size={18} />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Trust footer info */}
                    <div className="mt-5 pt-4 border-t border-slate-200/60 text-center">
                        <p className="text-[11px] text-slate-400 font-medium">
                            🔒 Your number is used only to identify your orders & updates.
                        </p>
                    </div>
                </motion.div>
            </main>

            {/* Footer with Restaurant Address */}
            <footer className="w-full max-w-md mx-auto text-center py-3">
                {address && (
                    <p className="text-xs text-slate-400 flex items-center justify-center gap-1 line-clamp-1">
                        <MapPin size={12} className="text-orange-500 shrink-0" />
                        <span>{address}</span>
                    </p>
                )}
            </footer>

            {/* Multiple Active Orders Modal */}
            <AnimatePresence>
                {showMultipleOrdersModal && (
                    <div key="modal-multiple-orders" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="w-full max-w-md rounded-3xl p-5 sm:p-6 space-y-4 max-h-[85vh] flex flex-col"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
                                border: '1px solid rgba(255, 255, 255, 0.9)',
                            }}
                        >
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase mb-1">
                                        <span>{multipleActiveOrders.length} Active Orders Found</span>
                                    </div>
                                    <h3 className="text-lg font-black text-slate-900">
                                        Select Active Order
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                                        We found multiple ongoing orders for +91 {mobile}. Which one would you like to open?
                                    </p>
                                </div>
                            </div>

                            {/* Active Orders List */}
                            <div className="flex-1 overflow-y-auto space-y-3 py-1 pr-1">
                                {multipleActiveOrders.map((order, idx) => {
                                    const isDelivery = order.orderType === 'DELIVERY';
                                    const isTakeaway = order.orderType === 'TAKEAWAY';
                                    const isDineIn = !isDelivery && !isTakeaway;

                                    return (
                                        <button
                                            key={order.id || `order-${idx}`}
                                            onClick={() => handleSelectExistingOrder(order)}
                                            className="w-full text-left p-4 rounded-2xl transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between gap-3 group cursor-pointer"
                                            style={{
                                                backgroundColor: '#EEF2F6',
                                                boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.4), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                                                border: '1px solid rgba(255, 255, 255, 0.85)',
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${
                                                        isDelivery
                                                            ? 'text-blue-600'
                                                            : isTakeaway
                                                            ? 'text-emerald-600'
                                                            : 'text-orange-600'
                                                    }`}
                                                    style={{
                                                        backgroundColor: '#EEF2F6',
                                                        boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                                    }}
                                                >
                                                    {isDelivery ? (
                                                        <Bike size={22} />
                                                    ) : isTakeaway ? (
                                                        <ShoppingBag size={22} />
                                                    ) : (
                                                        <Utensils size={22} />
                                                    )}
                                                </div>

                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-black text-xs text-slate-900">
                                                            Order #{order.orderNumber || order.id.slice(0, 6)}
                                                        </span>
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                            isDelivery
                                                                ? 'bg-blue-100 text-blue-700'
                                                                : isTakeaway
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-orange-100 text-orange-700'
                                                        }`}>
                                                            {isDelivery ? 'Delivery' : isTakeaway ? 'Takeaway' : `Table ${order.tableNumber || 'Dine-In'}`}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                                                        <span className="capitalize font-bold text-slate-700">
                                                            ● {order.status}
                                                        </span>
                                                        {order.totalAmount > 0 && (
                                                            <>
                                                                <span>•</span>
                                                                <span>₹{order.totalAmount}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="size-8 rounded-full flex items-center justify-center text-slate-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all">
                                                <ChevronRight size={18} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Option to start a new order */}
                            <div className="pt-2 border-t border-slate-200/80 flex flex-col gap-2">
                                <button
                                    onClick={handleProceedToNewOrder}
                                    className="w-full py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                                >
                                    <span>Or Start a New Order</span>
                                    <ArrowRight size={14} />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
