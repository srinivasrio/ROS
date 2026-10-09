'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    QrCode, Camera, ArrowRight, Utensils, Sparkles, AlertCircle,
    Store, ChevronRight, RefreshCw, X
} from 'lucide-react';
import { parseTableQrCode } from '@/lib/table-qr-utils';

function CustomerPortalContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const tableParam = searchParams?.get('table') || searchParams?.get('tableNumber') || '';
    const restaurantParam = searchParams?.get('restaurant') || searchParams?.get('restaurantId') || searchParams?.get('rest') || '';

    // If query parameters already exist, redirect immediately
    useEffect(() => {
        if (restaurantParam) {
            const query = tableParam ? `?table=${encodeURIComponent(tableParam)}` : '';
            router.replace(`/${restaurantParam}/customer${query}`);
        }
    }, [restaurantParam, tableParam, router]);

    const [recentRestaurant, setRecentRestaurant] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [scanError, setScanError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const scannerRef = useRef<any>(null);
    const scannerContainerId = 'customer-portal-qr-reader';

    // Check for recently visited restaurant on this device
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key?.startsWith('ros_customer_mobile_')) {
                        const code = key.replace('ros_customer_mobile_', '');
                        if (code && code !== 'customer') {
                            setRecentRestaurant(code);
                            break;
                        }
                    }
                }
            } catch {}
        }
    }, []);

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
                    setScanError('Unable to access camera. Please allow camera permissions to scan your table QR code.');
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
                if (parsed.table) {
                    router.push(`/${parsed.restaurantCode}/customer/home/${encodeURIComponent(parsed.table)}`);
                } else {
                    router.push(`/${parsed.restaurantCode}/customer`);
                }
            } else if (decodedText.startsWith('http') || decodedText.startsWith('/')) {
                // If direct URL (like /customer/t/... or full URL), navigate directly
                window.location.href = decodedText;
            } else {
                setScanError('QR code detected, but not recognized as a restaurant table QR. Please scan the QR code located on your table.');
            }
        } catch (err) {
            console.error('[CustomerPortal] Parse QR error:', err);
            setScanError('Could not process this QR code. Please try scanning again.');
        }
    };

    const handleResumeRecent = () => {
        if (!recentRestaurant) return;
        setLoading(true);
        router.push(`/${recentRestaurant}/customer`);
    };

    const handleDemoVisit = () => {
        setLoading(true);
        router.push('/202609089153/customer?table=1');
    };

    return (
        <div className="min-h-screen bg-[#EEF2F6] flex flex-col justify-between font-sans text-slate-800 antialiased p-4 md:p-8">
            <div className="max-w-md w-full mx-auto my-auto space-y-5">
                {/* Header Card */}
                <motion.div
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 text-center"
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
                    <p className="text-xs text-slate-500 font-medium max-w-xs mx-auto">
                        Scan the QR code on your table to view menu and order instantly
                    </p>
                </motion.div>

                {/* Primary Action Card: Scan Camera */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100 space-y-4"
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
                                        Align table QR code within frame
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

                    <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                            <QrCode size={18} />
                        </div>
                        <div className="text-[11px] text-slate-500 leading-tight">
                            <p className="font-semibold text-slate-700">Dining at a restaurant?</p>
                            <p>Every table has an official QR code stand with instant menu access.</p>
                        </div>
                    </div>

                    {/* Resume Recent Visit Card */}
                    {recentRestaurant && (
                        <div className="pt-2 border-t border-slate-100">
                            <button
                                onClick={handleResumeRecent}
                                disabled={loading}
                                className="w-full p-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold text-xs flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer shadow-md shadow-slate-900/10"
                            >
                                <div className="flex items-center gap-2.5 text-left">
                                    <Store size={16} className="text-orange-400 shrink-0" />
                                    <div>
                                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Recently Visited</div>
                                        <div className="font-bold text-sm text-white">Restaurant ({recentRestaurant})</div>
                                    </div>
                                </div>
                                <ArrowRight size={16} className="text-slate-400" />
                            </button>
                        </div>
                    )}
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
                        disabled={loading}
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
