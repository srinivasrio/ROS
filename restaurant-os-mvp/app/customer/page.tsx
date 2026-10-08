'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    QrCode, Camera, ArrowRight, Utensils, Sparkles, AlertCircle,
    Hash, Store, CheckCircle2, ChevronRight, RefreshCw, X
} from 'lucide-react';
import { parseTableQrCode } from '@/lib/table-qr-utils';

function CustomerPortalContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const tableParam = searchParams?.get('table') || searchParams?.get('tableNumber') || '';
    const restaurantParam = searchParams?.get('restaurant') || searchParams?.get('restaurantId') || searchParams?.get('rest') || '';

    const [restaurantCode, setRestaurantCode] = useState(restaurantParam);
    const [tableNumber, setTableNumber] = useState(tableParam);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const scannerRef = useRef<any>(null);
    const scannerContainerId = 'customer-portal-qr-reader';

    // Check for recent restaurant visited on this device
    useEffect(() => {
        if (!restaurantCode && typeof window !== 'undefined') {
            try {
                // Find any ros_customer_mobile_* keys in localStorage
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key?.startsWith('ros_customer_mobile_')) {
                        const code = key.replace('ros_customer_mobile_', '');
                        if (code && code !== 'customer') {
                            setRestaurantCode(code);
                            break;
                        }
                    }
                }
            } catch {}
        }
    }, [restaurantCode]);

    // Handle QR code scanning using html5-qrcode
    useEffect(() => {
        let isMounted = true;

        const startScanner = async () => {
            if (!isScanning) return;
            setScanError(null);

            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                if (!isMounted) return;

                // Stop previous instance if any
                if (scannerRef.current) {
                    try {
                        await scannerRef.current.stop();
                        scannerRef.current.clear();
                    } catch {}
                }

                const qrScanner = new Html5Qrcode(scannerContainerId);
                scannerRef.current = qrScanner;

                await qrScanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 15,
                        qrbox: { width: 260, height: 260 },
                        aspectRatio: 1.0,
                    },
                    (decodedText: string) => {
                        handleQrDecoded(decodedText);
                    },
                    () => {}
                );
            } catch (err: any) {
                console.error('[CustomerPortal] Camera access error:', err);
                if (isMounted) {
                    setScanError('Unable to open camera. Please grant camera permission or enter details manually.');
                }
            }
        };

        if (isScanning) {
            startScanner();
        }

        return () => {
            isMounted = false;
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {}).then(() => {
                    try {
                        scannerRef.current?.clear();
                    } catch {}
                });
            }
        };
    }, [isScanning]);

    const handleQrDecoded = (decodedText: string) => {
        try {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {});
            }
            setIsScanning(false);

            const parsed = parseTableQrCode(decodedText);
            if (parsed.restaurantCode) {
                const targetTable = parsed.table || tableNumber || '';
                const query = targetTable ? `?table=${encodeURIComponent(targetTable)}` : '';
                router.push(`/${parsed.restaurantCode}/customer${query}`);
            } else if (decodedText.startsWith('http')) {
                // If direct URL, navigate directly
                window.location.href = decodedText;
            } else {
                setScanError('QR code detected, but no restaurant code found. Please enter manually.');
            }
        } catch (err) {
            console.error('[CustomerPortal] Parse QR error:', err);
            setScanError('Could not process this QR code.');
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const cleanRest = restaurantCode.trim();
        if (!cleanRest) {
            setScanError('Please enter a restaurant code or ID.');
            return;
        }

        setLoading(true);
        const cleanTable = tableNumber.trim();
        const query = cleanTable ? `?table=${encodeURIComponent(cleanTable)}` : '';
        router.push(`/${cleanRest}/customer${query}`);
    };

    const handleDemoVisit = () => {
        setLoading(true);
        router.push('/202609089153/customer?table=1');
    };

    return (
        <div className="min-h-screen bg-[#EEF2F6] flex flex-col justify-between font-sans text-slate-800 antialiased p-4 md:p-8">
            <div className="max-w-md w-full mx-auto my-auto">
                {/* Header Card */}
                <motion.div
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 mb-6 text-center"
                >
                    <div className="w-16 h-16 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20 text-white">
                        <Utensils size={30} strokeWidth={2.5} />
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Dine in one</h1>
                        <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">
                            Guest Dining
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                        Scan the QR code on your table to browse menu & order instantly
                    </p>
                </motion.div>

                {/* Primary Action Card: Scan or Enter */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 mb-6 space-y-6"
                >
                    {/* Camera Scanner View */}
                    <AnimatePresence>
                        {isScanning ? (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="relative overflow-hidden rounded-2xl bg-black"
                            >
                                <div id={scannerContainerId} className="w-full min-h-[300px]" />
                                <button
                                    onClick={() => setIsScanning(false)}
                                    className="absolute top-3 right-3 z-20 size-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors"
                                >
                                    <X size={18} />
                                </button>
                                <div className="absolute bottom-3 inset-x-0 text-center z-10 pointer-events-none">
                                    <span className="text-[11px] font-bold text-white/90 bg-black/60 px-3 py-1 rounded-full backdrop-blur-xs">
                                        Align QR code within frame
                                    </span>
                                </div>
                            </motion.div>
                        ) : (
                            <button
                                onClick={() => setIsScanning(true)}
                                className="w-full py-4 px-5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-lg shadow-orange-500/25 transition-all active:scale-[0.98] cursor-pointer"
                            >
                                <Camera size={20} />
                                <span>Scan Table QR Code</span>
                            </button>
                        )}
                    </AnimatePresence>

                    {scanError && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs text-rose-700 font-medium">
                            <AlertCircle size={16} className="shrink-0 text-rose-500" />
                            <span>{scanError}</span>
                        </div>
                    )}

                    <div className="relative flex items-center justify-center">
                        <div className="border-t border-slate-200 w-full" />
                        <span className="bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 absolute">
                            Or enter manually
                        </span>
                    </div>

                    {/* Manual Form */}
                    <form onSubmit={handleManualSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <Store size={14} className="text-slate-400" />
                                Restaurant Code or ID
                            </label>
                            <input
                                type="text"
                                value={restaurantCode}
                                onChange={(e) => {
                                    setRestaurantCode(e.target.value);
                                    setScanError(null);
                                }}
                                placeholder="e.g. 202609089153 or restaurant-slug"
                                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-slate-400"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                                <Hash size={14} className="text-slate-400" />
                                Table Number (Optional)
                            </label>
                            <input
                                type="text"
                                value={tableNumber}
                                onChange={(e) => setTableNumber(e.target.value)}
                                placeholder="e.g. 1, 2, 5 (or leave empty)"
                                className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-slate-400"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !restaurantCode.trim()}
                            className="w-full py-3.5 px-5 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/15 transition-all active:scale-[0.98] cursor-pointer"
                        >
                            {loading ? (
                                <RefreshCw size={18} className="animate-spin" />
                            ) : (
                                <>
                                    <span>Open Restaurant Menu</span>
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>

                {/* Demo Diner Quick Action */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="text-center"
                >
                    <button
                        onClick={handleDemoVisit}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors py-2 px-3 rounded-xl hover:bg-white/60 cursor-pointer"
                    >
                        <Sparkles size={14} className="text-amber-500" />
                        <span>Experience Demo Restaurant (Table 1)</span>
                        <ChevronRight size={14} />
                    </button>
                </motion.div>
            </div>

            {/* Footer */}
            <div className="text-center text-[11px] font-medium text-slate-400 mt-6">
                © {new Date().getFullYear()} Dine in one · Touchless QR Restaurant Dining
            </div>
        </div>
    );
}

export default function CustomerPortalEntryPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen items-center justify-center bg-[#EEF2F6]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
        }>
            <CustomerPortalContent />
        </Suspense>
    );
}
