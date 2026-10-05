'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Utensils, ShoppingBag, Bike, MapPin, QrCode, Camera,
    AlertTriangle, CheckCircle2, Navigation, Clock, ArrowRight,
    X, ChevronRight, Phone, User, Loader2, RefreshCw, Edit3
} from 'lucide-react';
import { toast } from 'sonner';
import { formatAddress } from '@/lib/utils';
import { TableNotFoundWarningCard } from '@/components/customer/TableNotFoundWarningCard';
import { parseTableQrCode, TableVerifyResponse } from '@/lib/table-qr-utils';

interface CustomerModeSelectorProps {
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
    delivery_order_radius?: number;
    dine_in_takeaway_order_radius?: number;
    dine_in_order_radius?: number;
    takeaway_order_radius?: number;
    estimated_delivery_minutes?: number;
    latitude?: number;
    longitude?: number;
    address?: string;
}

type ModalType = 'none' | 'location_error' | 'location_permission' | 'qr_scanner' | 'manual_table' | 'takeaway_info' | 'delivery_address' | 'table_warning';

export default function CustomerModeSelector({ restaurantCode }: CustomerModeSelectorProps) {
    const router = useRouter();

    const [profile, setProfile] = useState<RestaurantProfile | null>(null);
    const [settings, setSettings] = useState<DeliverySettings | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(true);

    const [activeModal, setActiveModal] = useState<ModalType>('none');
    const [pendingMode, setPendingMode] = useState<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | null>(null);
    const [locationChecking, setLocationChecking] = useState(false);
    const [locationError, setLocationError] = useState<string>('');
    const [isInsecureOrigin, setIsInsecureOrigin] = useState(false);
    const [matchedDeliveryZone, setMatchedDeliveryZone] = useState<{ id?: string; name?: string; deliveryFee?: number; minOrderAmount?: number } | null>(null);
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

    // Customer Info State
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryLandmark, setDeliveryLandmark] = useState('');
    const [deliveryCity, setDeliveryCity] = useState('');
    const [deliveryPincode, setDeliveryPincode] = useState('');
    const [deliveryNotes, setDeliveryNotes] = useState('');
    const [manualTableNumber, setManualTableNumber] = useState('');
    const [savedAddresses, setSavedAddresses] = useState<any[]>([]);

    // Coordinates state
    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [reverseGeocoding, setReverseGeocoding] = useState(false);

    // QR Scanner
    const scannerRef = useRef<any>(null);
    const scannerContainerId = 'qr-reader-container';

    // Fetch Profile and Settings on Mount
    useEffect(() => {
        if (!restaurantCode) return;

        // Fetch settings
        fetch(`/api/delivery/settings?restaurantId=${restaurantCode}`)
            .then(res => res.json())
            .then(data => {
                if (data.settings) setSettings(data.settings);
            })
            .catch(err => console.error('Failed to load settings:', err))
            .finally(() => setLoadingSettings(false));

        // Fetch profile
        fetch(`/api/restaurant/${restaurantCode}/profile`)
            .then(res => res.json())
            .then(data => {
                if (data.profile) setProfile(data.profile);
            })
            .catch(() => {
                // Fallback to basic profile fetch
                fetch(`/api/delivery/profile?restaurantId=${restaurantCode}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.restaurant) {
                            setProfile({
                                name: data.restaurant.name,
                                logo_url: data.restaurant.logo_url,
                                address: data.restaurant.address,
                            });
                        }
                    })
                    .catch(() => {});
            });

        // Detect if accessing via insecure HTTP non-localhost IP (e.g. http://192.168.1.6)
        if (typeof window !== 'undefined') {
            const isNonLocalHttp = window.location.protocol === 'http:' && 
                window.location.hostname !== 'localhost' && 
                window.location.hostname !== '127.0.0.1';
            setIsInsecureOrigin(isNonLocalHttp || window.isSecureContext === false);
        }

        // Load saved customer info & cached coordinates
        try {
            const savedName = localStorage.getItem(`ros_customer_name_${restaurantCode}`) || '';
            const savedPhone = localStorage.getItem(`ros_customer_mobile_${restaurantCode}`) || '';
            const savedAddr = localStorage.getItem(`ros_delivery_address_${restaurantCode}`) || '';
            if (savedName) setCustomerName(savedName);
            if (savedPhone) setCustomerPhone(savedPhone);
            if (savedAddr) setDeliveryAddress(savedAddr);

            const savedLat = localStorage.getItem('ros_user_lat');
            const savedLng = localStorage.getItem('ros_user_lng');
            const savedTime = localStorage.getItem('ros_user_loc_time');
            if (savedLat && savedLng) {
                const age = savedTime ? Date.now() - Number(savedTime) : Infinity;
                if (age < 30 * 60 * 1000) {
                    const lat = Number(savedLat);
                    const lng = Number(savedLng);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        setUserCoords({ lat, lng });
                    }
                }
            }
        } catch {}
    }, [restaurantCode]);

    // Fetch saved addresses if mobile is available
    useEffect(() => {
        if (!restaurantCode || !customerPhone) return;
        fetch(`/api/customer/addresses?restaurantId=${restaurantCode}&mobile=${customerPhone}`)
            .then(res => res.json())
            .then(data => {
                if (data.addresses && Array.isArray(data.addresses)) {
                    setSavedAddresses(data.addresses);
                }
            })
            .catch(() => {});
    }, [restaurantCode, customerPhone]);

    // Helper: Acquire Coordinates with fast high-accuracy & low-accuracy fallback
    const acquireCoordinates = (): Promise<{ lat: number; lng: number }> => {
        return new Promise((resolve, reject) => {
            if (typeof navigator === 'undefined' || !navigator.geolocation) {
                return reject({ code: 0, message: 'Geolocation is not supported by your browser.' });
            }

            // Detect mobile browser blocking on insecure HTTP IP addresses (e.g. http://192.168.1.6)
            const isNonLocalHttp = typeof window !== 'undefined' && 
                window.location.protocol === 'http:' && 
                window.location.hostname !== 'localhost' && 
                window.location.hostname !== '127.0.0.1';
            
            if (isNonLocalHttp && typeof window !== 'undefined' && window.isSecureContext === false) {
                return reject({
                    code: 1, // PERMISSION_DENIED
                    isInsecureHttp: true,
                    message: `Mobile browsers (iOS Safari & Android Chrome) block location access over plain HTTP (${window.location.hostname}). HTTPS is required by browser security.`,
                });
            }

            // Attempt 1: High accuracy (GPS) with 6s timeout
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                (highErr) => {
                    // If user explicitly tapped "Don't Allow", don't retry, fail immediately
                    if (highErr.code === highErr.PERMISSION_DENIED) {
                        return reject(highErr);
                    }
                    // Attempt 2: Fallback to low accuracy (WiFi/Cell tower) with 8s timeout
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                        (lowErr) => reject(lowErr),
                        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
                    );
                },
                { enableHighAccuracy: true, timeout: 6000, maximumAge: 15000 }
            );
        });
    };

    // Server-Side Location Validation
    const validateLocationWithServer = async (lat: number, lng: number, mode: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY'): Promise<boolean> => {
        try {
            setLocationChecking(true);
            const res = await fetch('/api/customer/location/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: restaurantCode,
                    latitude: lat,
                    longitude: lng,
                    mode,
                }),
            });

            const data = await res.json();
            setLocationChecking(false);

            if (!data.allowed) {
                setLocationError(data.message || 'Delivery is not available at this location.');
                setActiveModal('location_error');
                return false;
            }

            if (mode === 'DELIVERY') {
                setMatchedDeliveryZone({
                    id: data.zoneId,
                    name: data.zoneName,
                    deliveryFee: data.deliveryFee,
                    minOrderAmount: data.minOrderAmount,
                });
                try {
                    if (data.zoneId) localStorage.setItem('ros_delivery_zone_id', data.zoneId);
                    if (data.zoneName) localStorage.setItem('ros_delivery_zone_name', data.zoneName);
                    if (data.deliveryFee !== undefined) localStorage.setItem('ros_delivery_fee', String(data.deliveryFee));
                    if (data.minOrderAmount !== undefined) localStorage.setItem('ros_delivery_min_order', String(data.minOrderAmount));
                } catch {}
            }

            return true;
        } catch (err: any) {
            setLocationChecking(false);
            setLocationError('Could not verify restaurant location. Please try again.');
            setActiveModal('location_error');
            return false;
        }
    };

    // Proceed to next step after location verified
    const proceedToModeNextStep = (mode: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY') => {
        setActiveModal('none');
        if (mode === 'DINE_IN') {
            setActiveModal('qr_scanner');
        } else if (mode === 'TAKEAWAY') {
            if (customerName && customerPhone) {
                router.push(`/${restaurantCode}/customer/home/takeaway`);
            } else {
                setActiveModal('takeaway_info');
            }
        } else if (mode === 'DELIVERY') {
            setActiveModal('delivery_address');
            if (userCoords && !deliveryAddress) {
                handleReverseGeocode(userCoords.lat, userCoords.lng);
            }
        }
    };

    // Initiate Mode Flow: Ask for Location Permission if not given yet
    const initiateModeLocationFlow = async (mode: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY') => {
        setPendingMode(mode);

        // 1. If we already have user coordinates in state, validate immediately
        if (userCoords) {
            const allowed = await validateLocationWithServer(userCoords.lat, userCoords.lng, mode);
            if (allowed) {
                proceedToModeNextStep(mode);
            }
            return;
        }

        // 2. Otherwise ask location permission via clean permission modal!
        setActiveModal('location_permission');
    };

    // When customer taps "Allow Location Access"
    const handleAllowLocationAccess = async () => {
        if (!pendingMode) return;
        setLocationChecking(true);
        setLocationError('');

        try {
            const coords = await acquireCoordinates();
            setUserCoords(coords);
            try {
                localStorage.setItem('ros_user_lat', String(coords.lat));
                localStorage.setItem('ros_user_lng', String(coords.lng));
                localStorage.setItem('ros_user_loc_time', String(Date.now()));
            } catch {}

            const allowed = await validateLocationWithServer(coords.lat, coords.lng, pendingMode);
            if (allowed) {
                proceedToModeNextStep(pendingMode);
            }
        } catch (err: any) {
            setLocationChecking(false);
            let errMsg = 'Location permission is required to order.';
            if (err.isInsecureHttp) {
                errMsg = err.message;
            } else if (err.code === 1 || err.code === err.PERMISSION_DENIED) {
                if (isInsecureOrigin) {
                    errMsg = `Location access was blocked. Mobile browsers (Safari & Chrome) require HTTPS to share GPS over local network (${typeof window !== 'undefined' ? window.location.hostname : 'IP'}).`;
                } else {
                    errMsg = 'Location permission was denied. Please allow location access in your browser settings to verify range.';
                }
            } else if (err.code === 2 || err.code === err.POSITION_UNAVAILABLE) {
                errMsg = 'Location information is currently unavailable on your device.';
            } else if (err.code === 3 || err.code === err.TIMEOUT) {
                errMsg = 'Location request timed out. Please try again.';
            }
            setLocationError(errMsg);
            setActiveModal('location_error');
        }
    };

    // Fallback: Use Restaurant Coordinates for testing
    const handleUseRestaurantLocationFallback = async () => {
        if (!pendingMode) return;
        const fallbackLat = settings?.latitude != null ? Number(settings.latitude) : 14.3635;
        const fallbackLng = settings?.longitude != null ? Number(settings.longitude) : 80.0407;
        const coords = { lat: fallbackLat, lng: fallbackLng };
        setUserCoords(coords);
        try {
            localStorage.setItem('ros_user_lat', String(coords.lat));
            localStorage.setItem('ros_user_lng', String(coords.lng));
            localStorage.setItem('ros_user_loc_time', String(Date.now()));
        } catch {}
        toast.info('📍 Using restaurant kitchen coordinates for testing.');
        setActiveModal('none');
        const allowed = await validateLocationWithServer(coords.lat, coords.lng, pendingMode);
        if (allowed) {
            proceedToModeNextStep(pendingMode);
        }
    };

    // Mode Click Handlers
    const handleSelectDineIn = () => {
        initiateModeLocationFlow('DINE_IN');
    };

    const handleSelectTakeaway = () => {
        initiateModeLocationFlow('TAKEAWAY');
    };

    const handleSelectDelivery = () => {
        initiateModeLocationFlow('DELIVERY');
    };

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
        } catch {
            // Non-critical, ignore
        } finally {
            setReverseGeocoding(false);
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
                toast.error('Camera could not be accessed. You can enter the table number manually.');
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

    // Parse Scanned QR String
    const handleQrSuccess = async (qrString: string) => {
        if (scannerRef.current) {
            scannerRef.current.stop().catch(() => {});
            scannerRef.current = null;
        }

        try {
            const parsed = parseTableQrCode(qrString);
            const scannedTable = parsed.table;
            const scannedRestCode = parsed.restaurantCode;

            if (!scannedTable) {
                toast.error('Invalid QR code format. Please scan a table QR code.');
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

            // Cross-restaurant or not found:
            setWarningDetails({
                scannedTable: data.scannedTable || scannedTable,
                scannedRestaurantName: data.scannedRestaurant?.name || null,
                scannedRestaurantCode: data.scannedRestaurant?.code || scannedRestCode || null,
                isDifferentRestaurant: data.reason === 'different_restaurant',
                message: data.message || null,
            });
            setActiveModal('table_warning');
        } catch (err: any) {
            toast.error('Failed to process QR code. Please try manual entry.');
            setActiveModal('manual_table');
        }
    };

    // Manual Table Submission
    const handleManualTableSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = manualTableNumber.trim();
        if (!trimmed) {
            toast.error('Please enter a table number');
            return;
        }

        try {
            // Verify table
            const res = await fetch(`/api/customer/table/verify?restaurantId=${encodeURIComponent(restaurantCode)}&table=${encodeURIComponent(trimmed)}`);
            if (res.ok) {
                const data: TableVerifyResponse = await res.json();
                if (!data.valid) {
                    setWarningDetails({
                        scannedTable: trimmed,
                        scannedRestaurantName: null,
                        scannedRestaurantCode: null,
                        isDifferentRestaurant: false,
                        message: data.message || `Table "${trimmed}" does not exist in this restaurant.`,
                    });
                    setActiveModal('table_warning');
                    return;
                }
                toast.success(`Connected to Table ${data.tableNumber || trimmed}`);
                setActiveModal('none');
                router.push(`/${restaurantCode}/customer/home/${data.tableNumber || trimmed}`);
                return;
            }
        } catch {}

        toast.success(`Connected to Table ${trimmed}`);
        setActiveModal('none');
        router.push(`/${restaurantCode}/customer/home/${trimmed}`);
    };

    // Save Takeaway Info
    const handleSaveTakeawayInfo = (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerName.trim() || !customerPhone.trim()) {
            toast.error('Name and phone number are required for takeaway');
            return;
        }
        if (!/^\+?[\d\s-]{7,15}$/.test(customerPhone.replace(/\s/g, ''))) {
            toast.error('Please enter a valid phone number');
            return;
        }

        try {
            localStorage.setItem(`ros_customer_name_${restaurantCode}`, customerName.trim());
            localStorage.setItem(`ros_customer_mobile_${restaurantCode}`, customerPhone.trim());
        } catch {}

        setActiveModal('none');
        router.push(`/${restaurantCode}/customer/home/takeaway`);
    };

    // Save Delivery Address & Details
    const handleSaveDeliveryDetails = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim()) {
            toast.error('Name, phone number, and delivery address are required');
            return;
        }
        if (!/^\+?[\d\s-]{7,15}$/.test(customerPhone.replace(/\s/g, ''))) {
            toast.error('Please enter a valid phone number');
            return;
        }

        // If user coordinates missing, attempt forward-geocoding of the entered address
        let activeCoords = userCoords;
        if (!activeCoords && deliveryAddress.trim()) {
            try {
                const searchQ = `${deliveryAddress.trim()}, ${deliveryCity || profile?.address || ''}`;
                const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQ)}&limit=1`, {
                    headers: { 'Accept-Language': 'en' }
                });
                if (geoRes.ok) {
                    const geoData = await geoRes.json();
                    if (geoData && geoData[0]) {
                        activeCoords = { lat: Number(geoData[0].lat), lng: Number(geoData[0].lon) };
                        setUserCoords(activeCoords);
                        try {
                            localStorage.setItem('ros_user_lat', String(activeCoords.lat));
                            localStorage.setItem('ros_user_lng', String(activeCoords.lng));
                            localStorage.setItem('ros_user_loc_time', String(Date.now()));
                        } catch {}
                        const vRes = await fetch('/api/customer/location/validate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                restaurantId: restaurantCode,
                                latitude: activeCoords.lat,
                                longitude: activeCoords.lng,
                                mode: 'DELIVERY',
                            }),
                        });
                        const vData = await vRes.json();
                        if (vData.allowed) {
                            setMatchedDeliveryZone({
                                id: vData.zoneId,
                                name: vData.zoneName,
                                deliveryFee: vData.deliveryFee,
                                minOrderAmount: vData.minOrderAmount,
                            });
                        }
                    }
                }
            } catch {}
        }

        // Verify that customer location satisfies both conditions (inside radius & inside active zone)
        if (activeCoords && !matchedDeliveryZone) {
            toast.error('Cannot proceed: delivery address is outside the delivery radius or not within an active delivery zone.');
            return;
        }

        try {
            localStorage.setItem(`ros_customer_name_${restaurantCode}`, customerName.trim());
            localStorage.setItem(`ros_customer_mobile_${restaurantCode}`, customerPhone.trim());
            localStorage.setItem(`ros_delivery_address_${restaurantCode}`, deliveryAddress.trim());
            if (deliveryLandmark) localStorage.setItem(`ros_delivery_landmark_${restaurantCode}`, deliveryLandmark.trim());
            if (deliveryNotes) localStorage.setItem(`ros_delivery_notes_${restaurantCode}`, deliveryNotes.trim());

            // Save to backend addresses
            fetch('/api/customer/addresses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restaurantId: restaurantCode,
                    mobile: customerPhone.trim(),
                    name: customerName.trim(),
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
    const deliveryEnabled = settings?.delivery_enabled === true || settings?.enabled === true;

    return (
        <div className="min-h-screen bg-[#EEF2F6] flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans text-slate-800">
            {/* Header with Restaurant Branding */}
            <header className="w-full max-w-2xl mx-auto text-center pt-4 sm:pt-8 pb-6">
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
                            <div className="w-full h-full bg-gradient-to-br from-orange-400 to-rose-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl">
                                {restaurantName.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-1">
                        {restaurantName}
                    </h1>

                    {address && (
                        <p className="text-xs sm:text-sm text-slate-500 flex items-center gap-1.5 max-w-md line-clamp-1">
                            <MapPin size={14} className="text-orange-500 shrink-0" />
                            <span>{address}</span>
                        </p>
                    )}

                    <div className="mt-4 px-4 py-1.5 rounded-full bg-white/80 border border-slate-200/80 shadow-xs text-xs font-semibold text-slate-600">
                        Choose how you would like to order
                    </div>
                </motion.div>
            </header>

            {/* Mode Selection Cards */}
            <main className="w-full max-w-2xl mx-auto flex-1 flex flex-col justify-center space-y-4 py-2">
                {/* 1. DINE IN */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                >
                    <button
                        onClick={handleSelectDineIn}
                        disabled={!dineInEnabled || locationChecking}
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
                                    <QrCode size={12} /> Scan Table QR
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
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.2 }}
                >
                    <button
                        onClick={handleSelectTakeaway}
                        disabled={!takeawayEnabled || locationChecking}
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
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.3 }}
                >
                    <button
                        onClick={handleSelectDelivery}
                        disabled={!deliveryEnabled || locationChecking}
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
                                Hot and fresh food delivered directly to your doorstep
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-[11px] font-bold text-blue-700">
                                <span className="inline-flex items-center gap-1">
                                    <Clock size={12} /> ~{settings?.estimated_delivery_minutes || 30} mins
                                </span>
                                <span>•</span>
                                <span>Fee: ₹{settings?.delivery_fee ?? 0}</span>
                            </div>
                        </div>

                        <div className="size-10 rounded-full flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all">
                            <ChevronRight size={22} />
                        </div>
                    </button>
                </motion.div>
            </main>

            {/* Footer */}
            <footer className="w-full max-w-2xl mx-auto text-center pt-6 pb-4">
                <p className="text-xs text-slate-400 font-medium">
                    Powered by Restaurant OS • Safe & Secure Ordering
                </p>
            </footer>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* LOCATION CHECKING OVERLAY */}
            {/* ════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {locationChecking && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl">
                            <div className="size-16 mx-auto mb-4 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
                                <Navigation size={28} className="animate-spin text-orange-500" />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 mb-2">
                                Checking Your Location
                            </h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Verifying proximity to restaurant for {pendingMode?.replace('_', ' ')} ordering...
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* LOCATION PERMISSION REQUEST MODAL */}
            {/* ════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {activeModal === 'location_permission' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setActiveModal('none')}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="size-16 mx-auto mb-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 relative">
                                <Navigation size={30} className="animate-pulse" />
                                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-600"></span>
                                </span>
                            </div>

                            <h3 className="text-lg font-black text-slate-900 mb-1.5">
                                {pendingMode === 'DINE_IN' && 'Verify Dine-In Location'}
                                {pendingMode === 'TAKEAWAY' && 'Verify Takeaway Range'}
                                {pendingMode === 'DELIVERY' && 'Verify Delivery Zone'}
                                {!pendingMode && 'Location Permission Required'}
                            </h3>

                            <p className="text-xs text-slate-600 leading-relaxed mb-4">
                                {pendingMode === 'DINE_IN' && 'We check your location to ensure you are at the restaurant to view table menus and place orders.'}
                                {pendingMode === 'TAKEAWAY' && 'We verify your location to confirm you are within our takeaway pickup service radius.'}
                                {pendingMode === 'DELIVERY' && 'We check your location to verify you are inside an active delivery zone and calculate delivery fees.'}
                                {!pendingMode && 'Please allow location access to continue.'}
                            </p>

                            {isInsecureOrigin && (
                                <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-left text-[11px] text-amber-900 space-y-1">
                                    <div className="flex items-center gap-1.5 font-bold text-amber-800">
                                        <AlertTriangle size={13} className="shrink-0 text-amber-600" />
                                        <span>Local Network (HTTP) Notice</span>
                                    </div>
                                    <p className="leading-tight opacity-90 text-[10.5px]">
                                        Mobile browsers (iOS Safari & Android Chrome) disable GPS on plain HTTP. If native prompt fails, tap <strong>&quot;Use Restaurant Location&quot;</strong> below to test immediately!
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <button
                                    onClick={handleAllowLocationAccess}
                                    disabled={locationChecking}
                                    className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-lg shadow-blue-500/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {locationChecking ? (
                                        <>
                                            <Loader2 size={15} className="animate-spin" />
                                            <span>Verifying Location...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Navigation size={15} />
                                            <span>Allow Location Access</span>
                                        </>
                                    )}
                                </button>

                                {/* Mode specific shortcuts */}
                                {pendingMode === 'DELIVERY' && (
                                    <button
                                        onClick={() => setActiveModal('delivery_address')}
                                        className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <MapPin size={13} className="text-orange-500" />
                                        <span>Enter Delivery Address Manually</span>
                                    </button>
                                )}

                                {pendingMode === 'DINE_IN' && (
                                    <button
                                        onClick={() => setActiveModal('qr_scanner')}
                                        className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <QrCode size={13} className="text-blue-500" />
                                        <span>Sitting at Table? Scan Table QR</span>
                                    </button>
                                )}

                                {pendingMode === 'TAKEAWAY' && (
                                    <button
                                        onClick={() => {
                                            if (customerName && customerPhone) {
                                                router.push(`/${restaurantCode}/customer/home/takeaway`);
                                            } else {
                                                setActiveModal('takeaway_info');
                                            }
                                        }}
                                        className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <ShoppingBag size={13} className="text-emerald-500" />
                                        <span>Continue to Takeaway Details</span>
                                    </button>
                                )}

                                {/* Local testing bypass */}
                                {(isInsecureOrigin || process.env.NODE_ENV !== 'production') && (
                                    <button
                                        onClick={handleUseRestaurantLocationFallback}
                                        className="w-full py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-bold text-[11px] border border-amber-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                        title="Testing bypass: uses restaurant coordinates to test full flow"
                                    >
                                        <span>🧪 Use Restaurant Location (Dev Mode)</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => setActiveModal('none')}
                                    className="w-full py-2 rounded-2xl text-slate-400 hover:text-slate-600 font-bold text-xs transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* LOCATION ERROR MODAL */}
            {/* ════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {activeModal === 'location_error' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setActiveModal('none')}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="size-16 mx-auto mb-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-500">
                                <AlertTriangle size={32} />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 mb-2">
                                {pendingMode === 'DELIVERY' ? 'Delivery Range Notice' : 'Location Check Notice'}
                            </h3>
                            <p className="text-xs text-slate-600 leading-relaxed mb-5">
                                {locationError || (pendingMode === 'DELIVERY' ? 'Delivery is not available at this location.' : 'You must be near the restaurant to place an order.')}
                            </p>

                            <div className="space-y-2">
                                {pendingMode && (
                                    <button
                                        onClick={handleAllowLocationAccess}
                                        disabled={locationChecking}
                                        className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                                    >
                                        {locationChecking ? (
                                            <>
                                                <Loader2 size={14} className="animate-spin" />
                                                <span>Retrying...</span>
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw size={14} />
                                                <span>Retry Location</span>
                                            </>
                                        )}
                                    </button>
                                )}

                                {/* Mode-specific alternate actions */}
                                {pendingMode === 'DELIVERY' && (
                                    <button
                                        onClick={() => setActiveModal('delivery_address')}
                                        className="w-full py-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <MapPin size={13} />
                                        <span>Enter Delivery Address Manually</span>
                                    </button>
                                )}

                                {pendingMode === 'DINE_IN' && (
                                    <button
                                        onClick={() => setActiveModal('qr_scanner')}
                                        className="w-full py-2.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <QrCode size={13} />
                                        <span>Scan Table QR Code</span>
                                    </button>
                                )}

                                {pendingMode === 'TAKEAWAY' && (
                                    <button
                                        onClick={() => {
                                            if (customerName && customerPhone) {
                                                router.push(`/${restaurantCode}/customer/home/takeaway`);
                                            } else {
                                                setActiveModal('takeaway_info');
                                            }
                                        }}
                                        className="w-full py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <ShoppingBag size={13} />
                                        <span>Continue to Takeaway Details</span>
                                    </button>
                                )}

                                {/* Development & Local IP fallback */}
                                {(isInsecureOrigin || process.env.NODE_ENV !== 'production') && (
                                    <button
                                        onClick={handleUseRestaurantLocationFallback}
                                        className="w-full py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-[11px] border border-amber-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <span>🧪 Use Restaurant Location (Dev Mode)</span>
                                    </button>
                                )}

                                <button
                                    onClick={() => setActiveModal('none')}
                                    className="w-full py-2.5 rounded-2xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* DINE IN: TABLE NOT FOUND WARNING MODAL */}
            {/* ════════════════════════════════════════════════════════════ */}
            <TableNotFoundWarningCard
                isOpen={activeModal === 'table_warning'}
                visitedRestaurantName={profile?.name || restaurantCode}
                visitedRestaurantCode={restaurantCode}
                scannedTable={warningDetails.scannedTable}
                scannedRestaurantName={warningDetails.scannedRestaurantName}
                scannedRestaurantCode={warningDetails.scannedRestaurantCode}
                isDifferentRestaurant={warningDetails.isDifferentRestaurant}
                customMessage={warningDetails.message}
                onScanAgain={() => setActiveModal('qr_scanner')}
                onManualEntry={() => setActiveModal('manual_table')}
                onClose={() => setActiveModal('none')}
            />

            {/* ════════════════════════════════════════════════════════════ */}
            {/* DINE IN: QR SCANNER MODAL */}
            {/* ════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {activeModal === 'qr_scanner' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
                        onClick={() => setActiveModal('none')}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl overflow-hidden text-center"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-sm font-black text-slate-900">
                                    <Camera size={18} className="text-orange-500" />
                                    <span>Scan Table QR</span>
                                </div>
                                <button
                                    onClick={() => setActiveModal('none')}
                                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <p className="text-xs text-slate-500 mb-4">
                                Point your camera at the QR code on your table to connect.
                            </p>

                            {/* Camera Viewport Container */}
                            <div className="relative w-full aspect-square bg-slate-900 rounded-2xl overflow-hidden mb-4 flex items-center justify-center border-2 border-slate-200">
                                <div id={scannerContainerId} className="w-full h-full" />
                            </div>

                            <div className="space-y-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveModal('manual_table')}
                                    className="w-full py-3 rounded-2xl bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold text-xs border border-orange-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                    <Edit3 size={14} /> Enter Table Number Manually
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveModal('none')}
                                    className="w-full py-2.5 rounded-2xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                                >
                                    Back
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* DINE IN: MANUAL TABLE NUMBER MODAL */}
            {/* ════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {activeModal === 'manual_table' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setActiveModal('none')}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl text-center"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="size-14 mx-auto mb-3 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
                                <Utensils size={24} />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 mb-1">
                                Enter Table Number
                            </h3>
                            <p className="text-xs text-slate-500 mb-5">
                                Look for the table number displayed on your table.
                            </p>

                            <form onSubmit={handleManualTableSubmit} className="space-y-4">
                                <input
                                    type="text"
                                    value={manualTableNumber}
                                    onChange={e => setManualTableNumber(e.target.value)}
                                    placeholder="e.g. 1, 2, 10"
                                    className="w-full text-center text-2xl font-black tracking-wider py-3.5 px-4 rounded-2xl bg-slate-50 border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition-colors"
                                    autoFocus
                                />

                                <div className="space-y-2">
                                    <button
                                        type="submit"
                                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
                                    >
                                        Connect to Table
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveModal('qr_scanner')}
                                        className="w-full py-2.5 rounded-2xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
                                    >
                                        Scan QR Instead
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* TAKEAWAY: CUSTOMER DETAILS MODAL */}
            {/* ════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {activeModal === 'takeaway_info' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setActiveModal('none')}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-base font-black text-slate-900">
                                    <ShoppingBag size={20} className="text-emerald-600" />
                                    <span>Takeaway Details</span>
                                </div>
                                <button
                                    onClick={() => setActiveModal('none')}
                                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                                Enter your details so we can notify you when your takeaway order is ready for collection.
                            </p>

                            <form onSubmit={handleSaveTakeawayInfo} className="space-y-4">
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5 block">
                                        Your Name *
                                    </label>
                                    <div className="relative">
                                        <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={customerName}
                                            onChange={e => setCustomerName(e.target.value)}
                                            placeholder="Full Name"
                                            required
                                            className="w-full pl-9 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5 block">
                                        Phone Number *
                                    </label>
                                    <div className="relative">
                                        <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="tel"
                                            value={customerPhone}
                                            onChange={e => setCustomerPhone(e.target.value)}
                                            placeholder="Mobile number"
                                            required
                                            className="w-full pl-9 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full mt-2 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <span>Browse Menu</span>
                                    <ArrowRight size={16} />
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* DELIVERY: ADDRESS & DETAILS MODAL */}
            {/* ════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {activeModal === 'delivery_address' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
                        onClick={() => setActiveModal('none')}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-base font-black text-slate-900">
                                    <Bike size={20} className="text-blue-600" />
                                    <span>Delivery Address</span>
                                </div>
                                <button
                                    onClick={() => setActiveModal('none')}
                                    className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Zone Availability & Pricing Banner */}
                            {matchedDeliveryZone && (
                                <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                                        <div>
                                            <p className="text-xs font-black text-emerald-950">
                                                Delivery Available • {matchedDeliveryZone.name || 'Your Zone'}
                                            </p>
                                            <p className="text-[11px] text-emerald-700 font-semibold">
                                                Delivery Fee: ₹{matchedDeliveryZone.deliveryFee ?? 0}
                                                {matchedDeliveryZone.minOrderAmount ? ` • Min Order: ₹${matchedDeliveryZone.minOrderAmount}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Saved Addresses Quick Picker */}
                            {savedAddresses.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">
                                        Saved Addresses
                                    </p>
                                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                                        {savedAddresses.map(addr => (
                                            <button
                                                key={addr.id}
                                                type="button"
                                                onClick={async () => {
                                                    setDeliveryAddress(addr.address_line);
                                                    if (addr.landmark) setDeliveryLandmark(addr.landmark);
                                                    if (addr.city) setDeliveryCity(addr.city);
                                                    if (addr.pincode) setDeliveryPincode(addr.pincode);
                                                    if (addr.latitude && addr.longitude) {
                                                        const lat = Number(addr.latitude);
                                                        const lng = Number(addr.longitude);
                                                        if (!isNaN(lat) && !isNaN(lng)) {
                                                            setUserCoords({ lat, lng });
                                                            try {
                                                                localStorage.setItem('ros_user_lat', String(lat));
                                                                localStorage.setItem('ros_user_lng', String(lng));
                                                                const res = await fetch('/api/customer/location/validate', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        restaurantId: restaurantCode,
                                                                        latitude: lat,
                                                                        longitude: lng,
                                                                        mode: 'DELIVERY',
                                                                    }),
                                                                });
                                                                const data = await res.json();
                                                                if (data.allowed) {
                                                                    setMatchedDeliveryZone({
                                                                        id: data.zoneId,
                                                                        name: data.zoneName,
                                                                        deliveryFee: data.deliveryFee,
                                                                        minOrderAmount: data.minOrderAmount,
                                                                    });
                                                                    if (data.zoneId) localStorage.setItem('ros_delivery_zone_id', data.zoneId);
                                                                    if (data.zoneName) localStorage.setItem('ros_delivery_zone_name', data.zoneName);
                                                                    if (data.deliveryFee !== undefined) localStorage.setItem('ros_delivery_fee', String(data.deliveryFee));
                                                                    if (data.minOrderAmount !== undefined) localStorage.setItem('ros_delivery_min_order', String(data.minOrderAmount));
                                                                    toast.success(`Address verified for ${data.zoneName || 'delivery'}`);
                                                                } else {
                                                                    setMatchedDeliveryZone(null);
                                                                    toast.error(data.message || 'Selected address is not eligible for delivery.');
                                                                }
                                                            } catch {}
                                                        }
                                                    }
                                                }}
                                                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 transition-colors shrink-0"
                                            >
                                                {addr.label || 'Home'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSaveDeliveryDetails} className="space-y-3.5">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">
                                            Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={customerName}
                                            onChange={e => setCustomerName(e.target.value)}
                                            placeholder="Your name"
                                            required
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">
                                            Phone *
                                        </label>
                                        <input
                                            type="tel"
                                            value={customerPhone}
                                            onChange={e => setCustomerPhone(e.target.value)}
                                            placeholder="Mobile number"
                                            required
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                                                Use Current GPS
                                            </button>
                                        )}
                                    </div>
                                    <textarea
                                        value={deliveryAddress}
                                        onChange={e => setDeliveryAddress(e.target.value)}
                                        placeholder="Flat/House no., building, street, area"
                                        required
                                        rows={2}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
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
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30"
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
                                                className="w-1/2 px-2.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none"
                                            />
                                            <input
                                                type="text"
                                                value={deliveryPincode}
                                                onChange={e => setDeliveryPincode(e.target.value)}
                                                placeholder="Pincode"
                                                className="w-1/2 px-2.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none"
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
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                    />
                                </div>

                                <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-between text-xs text-blue-900 font-bold">
                                    <span>Estimated Delivery Fee</span>
                                    <span>₹{settings?.delivery_fee ?? 0}</span>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full mt-2 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                                >
                                    <span>Confirm & Browse Menu</span>
                                    <ArrowRight size={16} />
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
