'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Utensils, ShoppingBag, Bike, MapPin, QrCode, Camera,
    ChevronRight, ArrowRight, X, Phone, User, Loader2, Navigation,
    Edit3, CheckCircle2, Clock, Hash, Sparkles, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { formatAddress } from '@/lib/utils';
import { TableNotFoundWarningCard } from '@/components/customer/TableNotFoundWarningCard';
import { parseTableQrCode, TableVerifyResponse } from '@/lib/table-qr-utils';

interface OrderTypeSelectorProps {
    restaurantCode: string;
}

interface RestaurantProfile {
    name?: string;
    logo_url?: string;
    logo?: string;
    address?: string;
    tagline?: string;
}

interface DeliverySettings {
    enabled?: boolean;
    delivery_enabled?: boolean;
    dine_in_enabled?: boolean;
    takeaway_enabled?: boolean;
    delivery_fee?: number;
    minimum_order_amount?: number;
    max_delivery_radius_km?: number;
    latitude?: number;
    longitude?: number;
    address?: string;
}

type ModalType = 'none' | 'qr_scanner' | 'delivery_address' | 'table_warning';

export default function OrderTypeSelector({ restaurantCode }: OrderTypeSelectorProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const tableFromUrl = searchParams?.get('table') || searchParams?.get('tableNumber') || searchParams?.get('table_number') || searchParams?.get('t') || '';

    const [profile, setProfile] = useState<RestaurantProfile | null>(null);
    const [settings, setSettings] = useState<DeliverySettings | null>(null);
    const [loading, setLoading] = useState(true);

    const [customerMobile, setCustomerMobile] = useState('');
    const [customerName, setCustomerName] = useState('');

    const [activeModal, setActiveModal] = useState<ModalType>('none');
    const [verifyingTable, setVerifyingTable] = useState(false);
    const [warningDetails, setWarningDetails] = useState<{
        scannedTable: string | null;
        scannedRestaurantName: string | null;
        scannedRestaurantCode: string | null;
        isDifferentRestaurant: boolean;
        message: string | null;
    }>({
        scannedTable: null,
        scannedRestaurantName: null,
        scannedRestaurantCode: null,
        isDifferentRestaurant: false,
        message: null,
    });
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryLandmark, setDeliveryLandmark] = useState('');
    const [deliveryCity, setDeliveryCity] = useState('');
    const [deliveryPincode, setDeliveryPincode] = useState('');
    const [deliveryNotes, setDeliveryNotes] = useState('');

    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [reverseGeocoding, setReverseGeocoding] = useState(false);
    const [savedAddresses, setSavedAddresses] = useState<any[]>([]);

    // QR Scanner
    const scannerRef = useRef<any>(null);
    const scannerContainerId = 'qr-reader-container-entry';

    // Verify mobile number exists on mount
    useEffect(() => {
        if (!restaurantCode) return;

        try {
            const savedMobile = localStorage.getItem(`ros_customer_mobile_${restaurantCode}`) || '';
            const savedName = localStorage.getItem(`ros_customer_name_${restaurantCode}`) || '';
            const savedAddress = localStorage.getItem(`ros_delivery_address_${restaurantCode}`) || '';

            if (!savedMobile) {
                // If mobile not found, redirect to enter mobile number first
                const queryParams = new URLSearchParams();
                if (tableFromUrl) queryParams.set('table', tableFromUrl);
                router.replace(`/${restaurantCode}/customer${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
                return;
            }

            setCustomerMobile(savedMobile);
            if (savedName) setCustomerName(savedName);
            if (savedAddress) setDeliveryAddress(savedAddress);

            const savedLat = localStorage.getItem('ros_user_lat');
            const savedLng = localStorage.getItem('ros_user_lng');
            if (savedLat && savedLng) {
                const lat = Number(savedLat);
                const lng = Number(savedLng);
                if (!isNaN(lat) && !isNaN(lng)) setUserCoords({ lat, lng });
            }
        } catch {}

        // Fetch Restaurant Profile & Settings
        Promise.all([
            HomepageBuilderService.getProfile(restaurantCode).catch(() => null),
            fetch(`/api/delivery/settings?restaurantId=${restaurantCode}`).then(r => r.json()).catch(() => ({})),
        ]).then(([profData, settsData]) => {
            if (profData) {
                setProfile({
                    name: profData.name || profData.restaurant_name,
                    logo_url: profData.logo_url || profData.logo,
                    address: formatAddress(profData.address),
                    tagline: profData.tagline,
                });
            }
            if (settsData?.settings) setSettings(settsData.settings);
        }).finally(() => setLoading(false));
    }, [restaurantCode, tableFromUrl, router]);

    // Fetch saved addresses if mobile is available
    useEffect(() => {
        if (!restaurantCode || !customerMobile) return;
        fetch(`/api/customer/addresses?restaurantId=${restaurantCode}&mobile=${customerMobile}`)
            .then(res => res.json())
            .then(data => {
                if (data.addresses && Array.isArray(data.addresses)) {
                    setSavedAddresses(data.addresses);
                }
            })
            .catch(() => {});
    }, [restaurantCode, customerMobile]);

    // Reverse Geocoding via Nominatim
    const handleReverseGeocode = async (lat: number, lng: number) => {
        setReverseGeocoding(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
            if (res.ok) {
                const data = await res.json();
                if (data.display_name) {
                    setDeliveryAddress(data.display_name);
                }
                if (data.address?.city || data.address?.town || data.address?.village) {
                    setDeliveryCity(data.address?.city || data.address?.town || data.address?.village || '');
                }
                if (data.address?.postcode) {
                    setDeliveryPincode(data.address?.postcode || '');
                }
            }
        } catch {} finally {
            setReverseGeocoding(false);
        }
    };

    const handleChangeMobile = () => {
        const queryParams = new URLSearchParams();
        if (tableFromUrl) queryParams.set('table', tableFromUrl);
        router.push(`/${restaurantCode}/customer${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
    };

    // Handler 1: Dine In
    const handleSelectDineIn = async () => {
        // If customer already has table from QR code scan or URL param, verify it first
        if (tableFromUrl) {
            setVerifyingTable(true);
            try {
                const res = await fetch(`/api/customer/table/verify?restaurantId=${encodeURIComponent(restaurantCode)}&table=${encodeURIComponent(tableFromUrl)}`);
                const data: TableVerifyResponse = await res.json();
                if (data.valid) {
                    router.push(`/${restaurantCode}/customer/home/${data.tableNumber || tableFromUrl}`);
                    return;
                } else {
                    setWarningDetails({
                        scannedTable: tableFromUrl,
                        scannedRestaurantName: data.scannedRestaurant?.name || null,
                        scannedRestaurantCode: data.scannedRestaurant?.code || null,
                        isDifferentRestaurant: data.reason === 'different_restaurant',
                        message: data.message || `Table "${tableFromUrl}" does not exist in this restaurant.`,
                    });
                    setActiveModal('table_warning');
                    return;
                }
            } catch {
                // If network/verify fails, show options modal
            } finally {
                setVerifyingTable(false);
            }
        }
        // Directly open camera to scan table QR
        setActiveModal('qr_scanner');
    };

    // Handler 2: Takeaway
    const handleSelectTakeaway = () => {
        router.push(`/${restaurantCode}/customer/home/takeaway`);
    };

    // Handler 3: Delivery
    const handleSelectDelivery = () => {
        // If delivery address is already present, can go straight to delivery home
        if (deliveryAddress && deliveryAddress.trim().length > 5) {
            router.push(`/${restaurantCode}/customer/home/delivery`);
            return;
        }
        // Otherwise prompt for delivery address
        setActiveModal('delivery_address');
        if (userCoords && !deliveryAddress) {
            handleReverseGeocode(userCoords.lat, userCoords.lng);
        }
    };

    // QR Scanner Lifecycle
    useEffect(() => {
        if (activeModal !== 'qr_scanner') {
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {}).finally(() => {
                    scannerRef.current = null;
                });
            }
            return;
        }

        let isMounted = true;
        const timer = setTimeout(async () => {
            try {
                const { Html5Qrcode } = await import('html5-qrcode');
                if (!isMounted) return;

                const qrScanner = new Html5Qrcode(scannerContainerId);
                scannerRef.current = qrScanner;

                const config = { fps: 10, qrbox: { width: 250, height: 250 } };
                await qrScanner.start(
                    { facingMode: 'environment' },
                    config,
                    (decodedText) => {
                        handleQrSuccess(decodedText);
                    },
                    () => {}
                );
            } catch (err: any) {
                console.error('Failed to start camera QR scanner:', err);
                toast.error('Unable to open camera. Please grant camera permission to scan your table QR code.');
                setActiveModal('none');
            }
        }, 300);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            if (scannerRef.current) {
                scannerRef.current.stop().catch(() => {}).finally(() => {
                    scannerRef.current = null;
                });
            }
        };
    }, [activeModal]);

    const handleQrSuccess = async (qrString: string) => {
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => {});
            scannerRef.current = null;
        }

        try {
            setVerifyingTable(true);
            const parsed = parseTableQrCode(qrString);
            const scannedTable = parsed.table;
            const scannedRestCode = parsed.restaurantCode;

            if (!scannedTable) {
                toast.error('Invalid QR code format. Please scan a table QR code.');
                setActiveModal('qr_scanner');
                return;
            }

            const res = await fetch('/api/customer/table/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: restaurantCode,
                    table: scannedTable,
                    qrData: qrString,
                    scannedRestaurantId: scannedRestCode,
                }),
            });

            const data: TableVerifyResponse = await res.json();

            if (data.valid) {
                toast.success(`Connected to Table ${data.tableNumber || scannedTable}`);
                setActiveModal('none');
                router.push(`/${restaurantCode}/customer/home/${data.tableNumber || scannedTable}`);
                return;
            }

            // Cross-restaurant QR or table not found in this restaurant:
            setWarningDetails({
                scannedTable: data.scannedTable || scannedTable,
                scannedRestaurantName: data.scannedRestaurant?.name || null,
                scannedRestaurantCode: data.scannedRestaurant?.code || scannedRestCode || null,
                isDifferentRestaurant: data.reason === 'different_restaurant',
                message: data.message || null,
            });
            setActiveModal('table_warning');
        } catch (err) {
            console.error('[handleQrSuccess] Verification error:', err);
            toast.error('Failed to verify scanned QR code. Please scan the QR code located on your table.');
            setActiveModal('qr_scanner');
        } finally {
            setVerifyingTable(false);
        }
    };

    // Save Delivery Address
    const handleSaveDeliveryDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deliveryAddress.trim()) {
            toast.error('Delivery address is required');
            return;
        }

        try {
            localStorage.setItem(`ros_delivery_address_${restaurantCode}`, deliveryAddress.trim());
            if (deliveryLandmark) localStorage.setItem(`ros_delivery_landmark_${restaurantCode}`, deliveryLandmark.trim());
            if (deliveryNotes) localStorage.setItem(`ros_delivery_notes_${restaurantCode}`, deliveryNotes.trim());
            if (customerName) localStorage.setItem(`ros_customer_name_${restaurantCode}`, customerName.trim());

            // Save to backend addresses
            fetch('/api/customer/addresses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: restaurantCode,
                    mobile: customerMobile,
                    name: customerName || 'Customer',
                    addressLine: deliveryAddress.trim(),
                    landmark: deliveryLandmark.trim() || null,
                    city: deliveryCity.trim() || null,
                    pincode: deliveryPincode.trim() || null,
                    latitude: userCoords?.lat || null,
                    longitude: userCoords?.lng || null,
                }),
            }).catch(() => {});
        } catch {}

        setActiveModal('none');
        router.push(`/${restaurantCode}/customer/home/delivery`);
    };

    const restaurantName = profile?.name || 'Restaurant';
    const logoUrl = profile?.logo_url || profile?.logo;
    const address = formatAddress(profile?.address || settings?.address);

    const dineInEnabled = settings?.dine_in_enabled !== false;
    const takeawayEnabled = settings?.takeaway_enabled !== false;
    const deliveryEnabled = settings?.delivery_enabled !== false && settings?.enabled !== false;

    return (
        <div className="min-h-screen bg-[#EEF2F6] flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans text-slate-800">
            {/* Header with Restaurant Branding & Active Mobile Badge */}
            <header className="w-full max-w-2xl mx-auto text-center pt-4 sm:pt-6 pb-4">
                <motion.div
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col items-center"
                >
                    <div
                        className="size-16 sm:size-20 rounded-3xl p-1 mb-3 flex items-center justify-center overflow-hidden"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '6px 6px 16px rgba(166, 180, 200, 0.45), -6px -6px 16px rgba(255, 255, 255, 0.95)',
                            border: '1px solid rgba(255, 255, 255, 0.9)',
                        }}
                    >
                        {logoUrl ? (
                            <img src={logoUrl} alt={restaurantName} className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-orange-400 to-rose-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl">
                                {restaurantName.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                        {restaurantName}
                    </h1>

                    {/* Active Mobile Number Badge with Change Button */}
                    {customerMobile && (
                        <div className="mt-2.5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-slate-200/90 shadow-xs text-xs">
                            <span className="text-slate-500 font-medium">Ordering as</span>
                            <span className="font-bold text-slate-900">+91 {customerMobile}</span>
                            <button
                                type="button"
                                onClick={handleChangeMobile}
                                className="text-[11px] font-bold text-orange-600 hover:text-orange-700 underline flex items-center gap-0.5 ml-1 cursor-pointer"
                            >
                                <Edit3 size={11} />
                                <span>Change</span>
                            </button>
                        </div>
                    )}

                    <div className="mt-3 px-3 py-1 rounded-full bg-slate-200/60 text-slate-600 text-xs font-semibold">
                        Choose how you would like to order
                    </div>
                </motion.div>
            </header>

            {/* Exactly Three Clear Options: 1. Dine In, 2. Takeaway, 3. Delivery */}
            <main className="w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center space-y-4 py-2">
                {/* 1. DINE IN */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                >
                    <button
                        onClick={handleSelectDineIn}
                        disabled={!dineInEnabled}
                        className={`w-full group text-left p-5 sm:p-6 rounded-3xl transition-all duration-200 cursor-pointer relative overflow-hidden flex items-center gap-4 sm:gap-5 ${
                            dineInEnabled
                                ? 'hover:scale-[1.01] active:scale-[0.99]'
                                : 'opacity-60 cursor-not-allowed'
                        }`}
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '6px 6px 16px rgba(166, 180, 200, 0.4), -6px -6px 16px rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        <div
                            className="size-14 sm:size-16 rounded-2xl flex items-center justify-center shrink-0 text-orange-600"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: 'inset 3px 3px 6px rgba(166, 180, 200, 0.35), inset -3px -3px 6px rgba(255, 255, 255, 0.9)',
                            }}
                        >
                            <Utensils size={28} className="group-hover:scale-110 transition-transform duration-200" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                    DINE IN
                                </h2>
                                {!dineInEnabled && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                        Unavailable
                                    </span>
                                )}
                            </div>
                            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                                Enjoy your meal at our restaurant table
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-[11px] font-bold text-orange-700">
                                <span className="inline-flex items-center gap-1">
                                    <MapPin size={12} /> Near Restaurant
                                </span>
                                <span>•</span>
                                <span className="inline-flex items-center gap-1">
                                    <QrCode size={12} /> {tableFromUrl ? `Table ${tableFromUrl}` : 'Scan Table QR'}
                                </span>
                            </div>
                        </div>

                        <div className="size-10 rounded-full flex items-center justify-center text-slate-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all">
                            <ChevronRight size={22} />
                        </div>
                    </button>
                </motion.div>

                {/* 2. TAKE AWAY */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.2 }}
                >
                    <button
                        onClick={handleSelectTakeaway}
                        disabled={!takeawayEnabled}
                        className={`w-full group text-left p-5 sm:p-6 rounded-3xl transition-all duration-200 cursor-pointer relative overflow-hidden flex items-center gap-4 sm:gap-5 ${
                            takeawayEnabled
                                ? 'hover:scale-[1.01] active:scale-[0.99]'
                                : 'opacity-60 cursor-not-allowed'
                        }`}
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '6px 6px 16px rgba(166, 180, 200, 0.4), -6px -6px 16px rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        <div
                            className="size-14 sm:size-16 rounded-2xl flex items-center justify-center shrink-0 text-emerald-600"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: 'inset 3px 3px 6px rgba(166, 180, 200, 0.35), inset -3px -3px 6px rgba(255, 255, 255, 0.9)',
                            }}
                        >
                            <ShoppingBag size={28} className="group-hover:scale-110 transition-transform duration-200" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                    TAKE AWAY
                                </h2>
                                {!takeawayEnabled && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                        Unavailable
                                    </span>
                                )}
                            </div>
                            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                                Skip the line, order ahead & pick up fresh food
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-[11px] font-bold text-emerald-700">
                                <span className="inline-flex items-center gap-1">
                                    <Clock size={12} /> Ready in ~20-30m
                                </span>
                                <span>•</span>
                                <span>Self-pickup</span>
                            </div>
                        </div>

                        <div className="size-10 rounded-full flex items-center justify-center text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all">
                            <ChevronRight size={22} />
                        </div>
                    </button>
                </motion.div>

                {/* 3. DELIVERY */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.3 }}
                >
                    <button
                        onClick={handleSelectDelivery}
                        disabled={!deliveryEnabled}
                        className={`w-full group text-left p-5 sm:p-6 rounded-3xl transition-all duration-200 cursor-pointer relative overflow-hidden flex items-center gap-4 sm:gap-5 ${
                            deliveryEnabled
                                ? 'hover:scale-[1.01] active:scale-[0.99]'
                                : 'opacity-60 cursor-not-allowed'
                        }`}
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: '6px 6px 16px rgba(166, 180, 200, 0.4), -6px -6px 16px rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                    >
                        <div
                            className="size-14 sm:size-16 rounded-2xl flex items-center justify-center shrink-0 text-blue-600"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: 'inset 3px 3px 6px rgba(166, 180, 200, 0.35), inset -3px -3px 6px rgba(255, 255, 255, 0.9)',
                            }}
                        >
                            <Bike size={28} className="group-hover:scale-110 transition-transform duration-200" />
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                    DELIVERY
                                </h2>
                                {!deliveryEnabled && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                        Unavailable
                                    </span>
                                )}
                            </div>
                            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-0.5">
                                Hot & fresh meals delivered right to your doorstep
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-[11px] font-bold text-blue-700">
                                <span>Doorstep delivery</span>
                                <span>•</span>
                                <span>Live Tracking</span>
                            </div>
                        </div>

                        <div className="size-10 rounded-full flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all">
                            <ChevronRight size={22} />
                        </div>
                    </button>
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="w-full max-w-2xl mx-auto text-center py-4">
                {address && (
                    <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                        <MapPin size={12} className="text-orange-500 shrink-0" />
                        <span>{address}</span>
                    </p>
                )}
            </footer>

            {/* MODALS */}
            <AnimatePresence>
                {/* Table Not Found Warning Card Modal */}
                {activeModal === 'table_warning' && (
                    <TableNotFoundWarningCard
                        key="modal-table-warning"
                        isOpen={true}
                        visitedRestaurantName={profile?.name || restaurantCode}
                        visitedRestaurantCode={restaurantCode}
                        scannedTable={warningDetails.scannedTable}
                        scannedRestaurantName={warningDetails.scannedRestaurantName}
                        scannedRestaurantCode={warningDetails.scannedRestaurantCode}
                        isDifferentRestaurant={warningDetails.isDifferentRestaurant}
                        customMessage={warningDetails.message}
                        onScanAgain={() => setActiveModal('qr_scanner')}
                        onClose={() => setActiveModal('none')}
                    />
                )}

                {/* QR Scanner Modal with Framing Guide */}
                {activeModal === 'qr_scanner' && (
                    <div key="modal-qr-scanner" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-sm rounded-3xl p-5 space-y-4 text-center relative overflow-hidden"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
                                border: '1px solid rgba(255, 255, 255, 0.9)',
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <div className="text-left">
                                    <h3 className="text-sm font-black text-slate-900">
                                        Scan Table QR Code
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-medium">
                                        Point camera at the table QR stand
                                    </p>
                                </div>
                                <button
                                    onClick={() => setActiveModal('none')}
                                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Camera Viewport with Framing Guide */}
                            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center shadow-inner">
                                <div
                                    id={scannerContainerId}
                                    className="w-full h-full object-cover"
                                />

                                {/* Viewfinder Overlay Corners */}
                                <div className="absolute inset-6 pointer-events-none border-2 border-dashed border-white/30 rounded-2xl flex items-center justify-center">
                                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-orange-500 to-transparent animate-pulse" />
                                </div>

                                {verifyingTable && (
                                    <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 text-white">
                                        <Loader2 size={30} className="animate-spin text-orange-500" />
                                        <span className="text-xs font-bold">Verifying Table QR...</span>
                                    </div>
                                )}
                            </div>

                            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                Only table QR codes registered for <span className="font-bold text-slate-800">{profile?.name || 'this restaurant'}</span> are allowed.
                            </p>

                            <button
                                type="button"
                                onClick={() => setActiveModal('none')}
                                className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    </div>
                )}

                {/* Delivery Address Modal */}
                {activeModal === 'delivery_address' && (
                    <div key="modal-delivery-address" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="w-full max-w-md rounded-3xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)',
                                border: '1px solid rgba(255, 255, 255, 0.9)',
                            }}
                        >
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-base font-black text-slate-900">
                                        Delivery Details
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Enter your delivery address to start ordering
                                    </p>
                                </div>
                                <button
                                    onClick={() => setActiveModal('none')}
                                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Saved addresses pills if any */}
                            {savedAddresses.length > 0 && (
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5 block">
                                        Saved Addresses
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {savedAddresses.map((addr, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    setDeliveryAddress(addr.address_line || '');
                                                    if (addr.landmark) setDeliveryLandmark(addr.landmark);
                                                    if (addr.city) setDeliveryCity(addr.city);
                                                    if (addr.pincode) setDeliveryPincode(addr.pincode);
                                                    if (addr.name) setCustomerName(addr.name);
                                                    toast.success('Address selected');
                                                }}
                                                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition-colors"
                                            >
                                                {addr.label || 'Saved Address'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSaveDeliveryDetails} className="space-y-3.5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">
                                            Name
                                        </label>
                                        <input
                                            type="text"
                                            value={customerName}
                                            onChange={e => setCustomerName(e.target.value)}
                                            placeholder="Your name"
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">
                                            Mobile
                                        </label>
                                        <input
                                            type="tel"
                                            value={customerMobile}
                                            readOnly
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                                            Delivery Address *
                                        </label>
                                        {userCoords && (
                                            <button
                                                type="button"
                                                onClick={() => handleReverseGeocode(userCoords.lat, userCoords.lng)}
                                                disabled={reverseGeocoding}
                                                className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                                            >
                                                {reverseGeocoding ? (
                                                    <Loader2 size={10} className="animate-spin" />
                                                ) : (
                                                    <Navigation size={10} />
                                                )}
                                                Use GPS Address
                                            </button>
                                        )}
                                    </div>
                                    <textarea
                                        value={deliveryAddress}
                                        onChange={e => setDeliveryAddress(e.target.value)}
                                        placeholder="Flat/House no., building, street, area"
                                        required
                                        rows={2}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">
                                            Landmark (optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={deliveryLandmark}
                                            onChange={e => setDeliveryLandmark(e.target.value)}
                                            placeholder="Near park, temple, etc."
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">
                                            City / Pincode
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={deliveryCity}
                                                onChange={e => setDeliveryCity(e.target.value)}
                                                placeholder="City"
                                                className="w-1/2 px-2.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none"
                                            />
                                            <input
                                                type="text"
                                                value={deliveryPincode}
                                                onChange={e => setDeliveryPincode(e.target.value)}
                                                placeholder="Pincode"
                                                className="w-1/2 px-2.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">
                                        Delivery Instructions (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={deliveryNotes}
                                        onChange={e => setDeliveryNotes(e.target.value)}
                                        placeholder="e.g. Ring bell, leave at door"
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                    />
                                </div>

                                <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-between text-xs text-blue-900 font-bold">
                                    <span>Estimated Delivery Fee</span>
                                    <span>₹{settings?.delivery_fee ?? 0}</span>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <span>Confirm & Browse Menu</span>
                                    <ArrowRight size={16} />
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
