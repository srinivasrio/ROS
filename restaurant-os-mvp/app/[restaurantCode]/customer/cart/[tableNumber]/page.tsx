'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCart, getActivePrice, isSpecialActive } from '@/context/CartContext';
import { OrderService } from '@/services/orders.service';
import { SpecialsService, TodaySpecial } from '@/services/specials.service';
import { 
    ChevronLeft as LucideChevronLeft, Trash2 as LucideTrash2, ChefHat as LucideChefHat, 
    Utensils as LucideUtensils, Flame as LucideFlame, Ticket as LucideTicket, 
    X as LucideX, Check as LucideCheck, ShoppingBag as LucideShoppingBag, 
    Bike as LucideBike, MapPin as LucideMapPin, Phone as LucidePhone, 
    User as LucideUser, Edit3 as LucideEdit3, AlertTriangle as LucideAlertTriangle,
    CheckCircle2 as LucideCheckCircle2
} from 'lucide-react';
import { OfferService } from '@/services/offers.service';
import { toast } from 'sonner';
import SharedComboCard from '@/components/shared/SharedComboCard';
import { MainHeader } from '@/components/shared/MainHeader';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import SharedQuantityControl from '@/components/shared/SharedQuantityControl';
import { getCategoryMenuItemImage, ceil2 } from '@/lib/utils';
import CartItemCard from '@/components/customer/CartItemCard';
import ConfirmRemoveItemModal from '@/components/customer/ConfirmRemoveItemModal';
import { CartItem } from '@/context/CartContext';
import CartSuggestions from '@/components/customer/CartSuggestions';

export default function CustomerCart() {
    const params = useParams();
    const router = useRouter();
    const urlRestaurantId = (params.restaurantCode || params.restaurantId) as string;
    const tableNumber = params.tableNumber as string;
    const { 
        cart, 
        addToCart,
        addSpecialToCart,
        updateQuantity, 
        updateItemNotes, 
        removeFromCart, 
        totalItems, 
        subtotal, 
        tax, 
        cgst,
        sgst,
        total, 
        clearCart, 
        setTableNumber 
    } = useCart();
    const [submitting, setSubmitting] = useState(false);
    const [specials, setSpecials] = useState<TodaySpecial[]>([]);
    const [combos, setCombos] = useState<any[]>([]);
    const [todaySpecials, setTodaySpecials] = useState<any[]>([]);
    const [profile, setProfile] = useState<any>(null);
    const [sectionStyles, setSectionStyles] = useState<any>(null);
    const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
    const [itemPendingRemoval, setItemPendingRemoval] = useState<CartItem | null>(null);
    const [isClearAllPending, setIsClearAllPending] = useState(false);
    const [isValidTable, setIsValidTable] = useState<boolean | null>(null);

    const isTakeaway = tableNumber === 'takeaway';
    const isDelivery = tableNumber === 'delivery';
    const isDineIn = !isTakeaway && !isDelivery;

    const [deliverySettings, setDeliverySettings] = useState<any>(null);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryLandmark, setDeliveryLandmark] = useState('');
    const [deliveryNotes, setDeliveryNotes] = useState('');
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [deliveryLocationError, setDeliveryLocationError] = useState<string | null>(null);

    useEffect(() => {
        if (!tableNumber || !urlRestaurantId) return;

        if (isTakeaway || isDelivery) {
            setIsValidTable(true);
        } else {
            OrderService.verifyTableExists(urlRestaurantId, tableNumber)
                .then(data => setIsValidTable(Boolean(data)))
                .catch(() => setIsValidTable(false));
        }

        // Fetch delivery settings
        fetch(`/api/delivery/settings?restaurantId=${urlRestaurantId}`)
            .then(res => res.json())
            .then(d => {
                if (d.settings) setDeliverySettings(d.settings);
            })
            .catch(() => {});

        try {
            const savedName = localStorage.getItem(`ros_customer_name_${urlRestaurantId}`) || '';
            const savedPhone = localStorage.getItem(`ros_customer_mobile_${urlRestaurantId}`) || '';
            const savedAddr = localStorage.getItem(`ros_delivery_address_${urlRestaurantId}`) || '';
            const savedLandmark = localStorage.getItem(`ros_delivery_landmark_${urlRestaurantId}`) || '';
            const savedNotes = localStorage.getItem(`ros_delivery_notes_${urlRestaurantId}`) || '';
            const savedZoneFee = localStorage.getItem('ros_delivery_fee');
            const savedZoneMinOrder = localStorage.getItem('ros_delivery_min_order');
            const savedZoneName = localStorage.getItem('ros_delivery_zone_name');
            const savedZoneId = localStorage.getItem('ros_delivery_zone_id');

            if (savedName) setCustomerName(savedName);
            if (savedPhone) setCustomerPhone(savedPhone);
            if (savedAddr) setDeliveryAddress(savedAddr);
            if (savedLandmark) setDeliveryLandmark(savedLandmark);
            if (savedNotes) setDeliveryNotes(savedNotes);

            if (savedZoneFee != null && savedZoneFee !== '') {
                setDeliverySettings((prev: any) => ({
                    ...prev,
                    delivery_fee: Number(savedZoneFee),
                    minimum_order_amount: savedZoneMinOrder ? Number(savedZoneMinOrder) : (prev?.minimum_order_amount || 0),
                    zone_name: savedZoneName || 'Delivery Zone',
                    zone_id: savedZoneId || null,
                }));
            }
        } catch {}

        // Verify authenticated customer session
        if (urlRestaurantId) {
            fetch(`/api/customer/auth/session?restaurantId=${encodeURIComponent(urlRestaurantId)}`)
                .then(res => res.json())
                .then(data => {
                    if (data?.authenticated && data?.customer) {
                        const c = data.customer;
                        if (c.name && !customerName) setCustomerName(c.name);
                        if (c.mobile && !customerPhone) setCustomerPhone(c.mobile);
                        try {
                            localStorage.setItem(`ros_customer_${urlRestaurantId}`, c.id);
                            if (c.name) localStorage.setItem(`ros_customer_name_${urlRestaurantId}`, c.name);
                            if (c.mobile) localStorage.setItem(`ros_customer_mobile_${urlRestaurantId}`, c.mobile);
                        } catch {}
                    }
                })
                .catch(() => {});
        }

        // Proactively validate delivery location against Condition 1 (radius) and Condition 2 (active zone)
        if (isDelivery) {
            let lat: number | undefined;
            let lng: number | undefined;
            try {
                const sLat = localStorage.getItem('ros_user_lat');
                const sLng = localStorage.getItem('ros_user_lng');
                if (sLat && sLng) {
                    lat = Number(sLat);
                    lng = Number(sLng);
                }
            } catch {}

            if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
                fetch('/api/customer/location/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        restaurantId: urlRestaurantId,
                        latitude: lat,
                        longitude: lng,
                        mode: 'DELIVERY',
                    }),
                })
                .then(res => res.json())
                .then(data => {
                    if (!data.allowed) {
                        setDeliveryLocationError(data.message || 'Delivery is not available: outside radius or active delivery zone.');
                    } else {
                        setDeliveryLocationError(null);
                        setDeliverySettings((prev: any) => ({
                            ...prev,
                            delivery_fee: Number(data.deliveryFee ?? prev?.delivery_fee ?? 0),
                            minimum_order_amount: Number(data.minOrderAmount ?? prev?.minimum_order_amount ?? 0),
                            zone_name: data.zoneName || 'Active Zone',
                            zone_id: data.zoneId || null,
                        }));
                    }
                })
                .catch(() => {});
            }
        }
    }, [tableNumber, urlRestaurantId, isTakeaway, isDelivery]);

    const cartItems = Object.values(cart);

    const handleRequestRemoveItem = (item: CartItem) => {
        setItemPendingRemoval(item);
    };

    const handleConfirmRemove = () => {
        if (isClearAllPending) {
            clearCart();
            toast.success('All items removed from cart');
            setIsClearAllPending(false);
            setExpandedItemId(null);
            return;
        }

        if (itemPendingRemoval) {
            const itemName = itemPendingRemoval.name;
            removeFromCart(itemPendingRemoval.menu_item_id);
            toast.success(`Removed "${itemName}" from cart`);
            if (expandedItemId === String(itemPendingRemoval.menu_item_id)) {
                setExpandedItemId(null);
            }
            setItemPendingRemoval(null);
        }
    };

    const handleCancelRemove = () => {
        setItemPendingRemoval(null);
        setIsClearAllPending(false);
    };

    const handleAddCombo = (combo: any) => {
        addSpecialToCart({
            ...combo,
            is_combo: true,
            item_type: 'combo',
            special_type: 'combo'
        });
    };

    const handleAddSpecial = (special: any) => {
        const isCombo = Boolean(special.is_combo || special.special_type === 'combo');
        if (isCombo) {
            addSpecialToCart({
                ...special,
                is_combo: true,
                item_type: 'combo',
                special_type: 'combo'
            });
        } else if (special.items && special.items.length > 0) {
            addSpecialToCart({
                ...special,
                is_combo: false,
                item_type: 'special',
                special_type: 'special'
            });
        } else {
            addToCart({
                id: special.id,
                name: special.title || special.name,
                price: special.price,
                original_price: special.original_price,
                image_url: special.image_url || special.imageUrl,
                item_type: special.item_type || (special.is_veg ? 'Veg' : 'Non-Veg'),
                description: special.description,
                is_today_special: true,
                special_price: special.price,
            }, 1);
        }
    };

    const resolveCartKey = (key: string): string => {
        if (cart[key]) return key;
        const clean = key.replace(/^(special|combo)-/, '');
        if (cart[`special-${clean}`]) return `special-${clean}`;
        if (cart[`combo-${clean}`]) return `combo-${clean}`;
        if (cart[clean]) return clean;
        const found = Object.values(cart).find(
            (it: any) => String(it.specialId) === clean || String(it.combo_id) === clean || String(it.menu_item_id) === clean || String(it.menu_item_id) === `special-${clean}` || String(it.menu_item_id) === `combo-${clean}`
        );
        if (found) return String(found.menu_item_id);
        return key;
    };

    const handleIncrement = (key: string) => {
        const targetKey = resolveCartKey(key);
        updateQuantity(targetKey, 1);
    };

    const handleDecrement = (key: string) => {
        const targetKey = resolveCartKey(key);
        const item = cart[targetKey];
        if (item) {
            if (item.quantity === 1) {
                handleRequestRemoveItem(item);
            } else {
                updateQuantity(targetKey, -1);
            }
        }
    };

    useEffect(() => {
        const rid = urlRestaurantId;
        if (!rid) return;
        
        // Fetch active specials, combos, and menu specials in parallel
        Promise.all([
            SpecialsService.fetchActiveSpecials(rid).catch(() => []),
            HomepageBuilderService.getCombos(rid, true).catch(() => []),
            HomepageBuilderService.getSpecials(rid, true).catch(() => [])
        ]).then(([activeSpecialsData, combosData, menuSpecialsData]) => {
            // Combos: items from getCombos + any combo specials from fetchActiveSpecials
            const allCombos = [...(combosData || [])];
            (activeSpecialsData || []).forEach((s: any) => {
                if (s.is_combo || s.special_type === 'combo') {
                    if (!allCombos.some((c: any) => c.id === s.id)) {
                        allCombos.push(s);
                    }
                }
            });
            setCombos(allCombos);

            // Single Specials: menu items marked as today special + non-combo specials
            const allSpecials = [...(menuSpecialsData || [])];
            (activeSpecialsData || []).forEach((s: any) => {
                if (!s.is_combo && s.special_type !== 'combo') {
                    if (!allSpecials.some((item: any) => item.id === s.id)) {
                        allSpecials.push(s);
                    }
                }
            });
            setTodaySpecials(allSpecials);
            setSpecials(activeSpecialsData.slice(0, 2));
        });

        HomepageBuilderService.getProfile(rid).then(data => setProfile(data));
        HomepageBuilderService.getSectionStyles(rid).then(data => setSectionStyles(data));
    }, [urlRestaurantId]);

    const [resolvedTableNumber, setResolvedTableNumber] = useState<string>(tableNumber);

    useEffect(() => {
        if (tableNumber) {
            setTableNumber(tableNumber);
            if (isTakeaway) {
                setResolvedTableNumber('Takeaway');
            } else if (isDelivery) {
                setResolvedTableNumber('Delivery');
            } else {
                OrderService.findTableAnywhere(tableNumber, urlRestaurantId).then((data: any) => {
                    if (data) {
                        const name = data.display_name || data.table_number;
                        setResolvedTableNumber(name.toLowerCase().includes('table') ? name : `Table ${name}`);
                    }
                });
            }
        }
    }, [tableNumber, setTableNumber, urlRestaurantId, isTakeaway, isDelivery]);

    const handlePlaceOrder = async () => {
        if (!tableNumber) {
            toast.error('Session invalid. Please scan QR or select mode again.');
            return;
        }
        if (totalItems === 0) return;

        if (isTakeaway && (!customerName.trim() || !customerPhone.trim())) {
            toast.error('Please enter your name and phone number for takeaway');
            setShowCustomerModal(true);
            return;
        }

        if (isDelivery && (!customerName.trim() || !customerPhone.trim() || !deliveryAddress.trim())) {
            toast.error('Please enter your delivery address and contact details');
            setShowCustomerModal(true);
            return;
        }

        if (isDelivery && deliverySettings?.minimum_order_amount && subtotal < deliverySettings.minimum_order_amount) {
            toast.error(`Minimum order amount for delivery is ₹${deliverySettings.minimum_order_amount}`);
            return;
        }

        setSubmitting(true);
        try {
            const generateItemUUID = () => {
                if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
                    return window.crypto.randomUUID();
                }
                return Math.random().toString(36).substring(2) + Date.now().toString(36);
            };

            const orderItems = cartItems.flatMap((item): any[] => {
                const isCombo = Boolean(
                    item.is_combo ||
                    item.item_type?.toLowerCase() === 'combo' ||
                    item.special_type === 'combo' ||
                    String(item.menu_item_id).startsWith('combo-')
                );
                const constituentItems = item.combo_items || item.specialItemsData || (item as any).items || [];
                const hasSubItems = Array.isArray(constituentItems) && constituentItems.length > 0;
                const isSpecialBundle = Boolean(item.isSpecial && (isCombo || hasSubItems || item.special_type === 'combo'));

                if (isCombo || isSpecialBundle) {
                    const formattedSubItems = hasSubItems ? constituentItems.map((si: any) => ({
                        menu_item_id: si.menu_item_id || si.id || null,
                        name: si.name || si.title || si.menu_item?.name || 'Item',
                        quantity: si.quantity || 1,
                        price: si.price || si.menu_item?.price || 0,
                        image_url: si.image_url || si.menu_item?.image_url || null,
                        item_type: si.item_type || si.menu_item?.item_type || 'Veg',
                    })) : null;

                    return [{
                        menu_item_id: null,
                        quantity: item.quantity,
                        price: item.price,
                        notes: item.notes || '',
                        item_type: isCombo ? 'combo' : (item.item_type || 'special'),
                        combo_id: item.combo_id || item.specialId || null,
                        combo_name: item.combo_name || item.name || 'Combo',
                        combo_image: item.combo_image || item.image_url || null,
                        combo_items: formattedSubItems,
                        name: item.name || item.combo_name || 'Combo'
                    }];
                }

                const numMenuId = typeof item.menu_item_id === 'number' ? item.menu_item_id : Number(item.menu_item_id);
                const validMenuId = (!isNaN(numMenuId) && numMenuId > 0) ? numMenuId : null;

                return [{
                    menu_item_id: validMenuId,
                    combo_name: validMenuId === null ? item.name : undefined,
                    name: item.name,
                    quantity: item.quantity,
                    price: getActivePrice(item),
                    notes: item.notes || ''
                }];
            });

            if (orderItems.length === 0) {
                toast.error('No valid items to order. Please re-add specials to cart.');
                setSubmitting(false);
                return;
            }

            // Verify table existence before creating order (Dine In only)
            if (isDineIn) {
                const tableData = await OrderService.verifyTableExists(urlRestaurantId, tableNumber);
                if (!tableData) {
                    toast.error(`Table "${tableNumber}" does not exist in this restaurant. Customers can only order from admin-created tables.`);
                    setSubmitting(false);
                    return;
                }
            }

            let customerLat: number | undefined;
            let customerLng: number | undefined;
            try {
                const latStr = localStorage.getItem('ros_user_lat');
                const lngStr = localStorage.getItem('ros_user_lng');
                if (latStr) customerLat = Number(latStr);
                if (lngStr) customerLng = Number(lngStr);
            } catch {}

            // For delivery orders: verify customer coordinates exist
            if (isDelivery && (customerLat == null || customerLng == null || isNaN(customerLat) || isNaN(customerLng))) {
                if (typeof window !== 'undefined' && navigator.geolocation) {
                    try {
                        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                            navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
                        });
                        customerLat = pos.coords.latitude;
                        customerLng = pos.coords.longitude;
                        try {
                            localStorage.setItem('ros_user_lat', String(customerLat));
                            localStorage.setItem('ros_user_lng', String(customerLng));
                        } catch {}
                    } catch {
                        toast.error('Location coordinates are required to verify delivery eligibility. Please allow location access.');
                        setSubmitting(false);
                        return;
                    }
                } else {
                    toast.error('Geolocation is required to verify delivery radius and zone eligibility.');
                    setSubmitting(false);
                    return;
                }
            }

            let resolvedDeliveryFee = isDelivery ? Number(deliverySettings?.delivery_fee || 0) : 0;
            let resolvedDeliveryZoneId = deliverySettings?.zone_id || (typeof window !== 'undefined' ? localStorage.getItem('ros_delivery_zone_id') || undefined : undefined);

            // Pre-validate Condition 1 (Inside radius) & Condition 2 (Inside active zone)
            if (isDelivery && customerLat != null && customerLng != null) {
                const valRes = await fetch('/api/customer/location/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        restaurantId: urlRestaurantId,
                        latitude: customerLat,
                        longitude: customerLng,
                        mode: 'DELIVERY',
                    }),
                });
                const valData = await valRes.json();
                if (!valRes.ok || !valData.allowed) {
                    setDeliveryLocationError(valData.message || 'Delivery is not available: your location must be inside the delivery radius and inside an active delivery zone.');
                    toast.error(valData.message || 'Delivery is not available: your location must be inside the delivery radius and inside an active delivery zone.');
                    setSubmitting(false);
                    return;
                }
                setDeliveryLocationError(null);

                if (valData.minOrderAmount && subtotal < valData.minOrderAmount) {
                    toast.error(`Minimum order amount for ${valData.zoneName || 'this zone'} is ₹${valData.minOrderAmount}. Your subtotal is ₹${subtotal}.`);
                    setSubmitting(false);
                    return;
                }

                if (valData.zoneId) {
                    resolvedDeliveryZoneId = valData.zoneId;
                }
                if (valData.deliveryFee != null) {
                    resolvedDeliveryFee = Number(valData.deliveryFee);
                }
            }

            let customerId: string | undefined;
            try { customerId = localStorage.getItem(`ros_customer_${urlRestaurantId}`) || undefined; } catch {}
            let lastOrderId: string | undefined;
            try { lastOrderId = localStorage.getItem(`ros_last_order_${urlRestaurantId}`) || undefined; } catch {}

            const orderOptions = {
                orderType: (isDelivery ? 'DELIVERY' : (isTakeaway ? 'TAKEAWAY' : 'DINE_IN')) as any,
                activeOrderId: isTakeaway ? lastOrderId : undefined,
                customerName: customerName.trim() || undefined,
                customerPhone: customerPhone.trim() || undefined,
                deliveryAddress: isDelivery ? deliveryAddress.trim() : undefined,
                deliveryNotes: isDelivery ? (deliveryNotes.trim() || undefined) : undefined,
                deliveryFee: resolvedDeliveryFee,
                deliveryZoneId: resolvedDeliveryZoneId,
                deliveryLat: customerLat,
                deliveryLng: customerLng,
                customerLat,
                customerLng,
            };

            // Create Order with 'placed' status for takeaway/delivery, or 'queued' for dine-in delayed send
            const transactionId = generateItemUUID();
            const initialStatus = (isTakeaway || isDelivery) ? 'placed' : 'queued';
            const order = await OrderService.createOrder(
                tableNumber, orderItems, urlRestaurantId, initialStatus, undefined, undefined, undefined, transactionId, customerId, orderOptions
            );

            if (order) {
                try {
                    localStorage.setItem(`ros_last_order_${urlRestaurantId}`, order.id);
                    if (tableNumber) {
                        localStorage.setItem(`ros_last_order_${urlRestaurantId}_${tableNumber}`, order.id);
                    }
                } catch {}
                toast.success('Order placed successfully!');
                clearCart();
                router.push(`/${urlRestaurantId}/customer/status/${tableNumber}/${order.id}`);
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error?.message || 'Failed to place order. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (isValidTable === false) {
        return (
            <div className="flex flex-col h-screen bg-slate-50 items-center justify-center p-6 text-center">
                <div className="w-20 h-20 bg-rose-50 border border-rose-100 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-rose-500/10">
                    <LucideUtensils className="text-rose-500" size={36} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                    No table named &ldquo;{tableNumber}&rdquo; in this restaurant
                </h2>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed max-w-xs">
                    Table <span className="font-bold text-slate-800">{tableNumber}</span> does not exist or has not been created by the restaurant admin. Customers can only view the menu and place orders from valid, admin-created tables.
                </p>
                <button 
                    onClick={() => {
                        OrderService.verifyTableExists(urlRestaurantId, tableNumber)
                            .then(data => setIsValidTable(Boolean(data)))
                            .catch(() => setIsValidTable(false));
                    }}
                    className="py-3.5 px-8 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20 text-sm cursor-pointer"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (totalItems === 0) {
        return (
            <div className="flex flex-col h-screen bg-gray-50">
                {/* White Header */}
                <header className="sticky top-0 z-[100] bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-2xs pt-safe-top">
                    <button 
                        onClick={() => router.back()} 
                        className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors text-slate-800 cursor-pointer"
                        aria-label="Back to menu"
                    >
                        <LucideChevronLeft size={24} />
                    </button>
                    <h1 className="text-base font-black text-slate-900">Your Cart</h1>
                    <div className="w-8" />
                </header>
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="size-20 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-black">
                        <LucideUtensils size={32} />
                    </div>
                    <h2 className="text-xl font-black text-black mb-2">Your Cart is Empty</h2>
                    <p className="text-black mb-8">Add some delicious items from the menu!</p>
                    <button
                        onClick={() => router.back()}
                        className="px-8 py-3 bg-neutral-900 text-white font-bold rounded-xl hover:bg-black transition-colors cursor-pointer"
                    >
                        Browse Menu
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Main Header */}
            <MainHeader
                profile={profile}
                sectionStyle={{
                    ...(sectionStyles?.['header'] || {}),
                    section_bg_color: '#ffffff',
                    background: '#ffffff',
                    backgroundImage: '',
                    shadow: 'sm',
                }}
                theme={{ header_bg_color: '#ffffff' }}
                showSearch={false}
                className="pt-safe-top !bg-white border-b border-gray-100 shadow-2xs"
            >
                <div className="flex items-center justify-between flex-1">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => router.back()} 
                            className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors text-slate-800 cursor-pointer"
                            aria-label="Back to menu"
                        >
                            <LucideChevronLeft size={24} />
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        {resolvedTableNumber && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>{resolvedTableNumber}</span>
                            </div>
                        )}
                    </div>
                </div>
            </MainHeader>

            {/* Cart Items */}
            <main className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
                {/* Takeaway Mode Card */}
                {isTakeaway && (
                    <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="size-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                                <LucideShoppingBag size={20} />
                            </div>
                            <div className="min-w-0">
                                <h4 className="text-sm font-black text-emerald-950">Takeaway Order</h4>
                                <p className="text-xs text-emerald-700 font-medium truncate">
                                    {customerName ? `${customerName} • ${customerPhone}` : 'Pickup at restaurant counter'}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowCustomerModal(true)}
                            className="px-3 py-1.5 rounded-xl bg-white text-emerald-800 text-xs font-bold border border-emerald-200 hover:bg-emerald-100/50 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                        >
                            <LucideEdit3 size={12} />
                            <span>{customerName ? 'Edit' : 'Add Details'}</span>
                        </button>
                    </div>
                )}

                {/* Delivery Mode Card */}
                {isDelivery && (
                    <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-4 space-y-2.5 shadow-2xs">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="size-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                                    <LucideBike size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-sm font-black text-blue-950">Home Delivery</h4>
                                    <p className="text-xs text-blue-700 font-medium truncate">
                                        {customerName ? `${customerName} • ${customerPhone}` : 'Deliver to your address'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCustomerModal(true)}
                                className="px-3 py-1.5 rounded-xl bg-white text-blue-800 text-xs font-bold border border-blue-200 hover:bg-blue-100/50 transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                            >
                                <LucideEdit3 size={12} />
                                <span>{deliveryAddress ? 'Change' : 'Set Address'}</span>
                            </button>
                        </div>
                        {deliveryAddress ? (
                            <div className="flex items-start gap-1.5 text-xs text-blue-900 bg-white/70 p-2.5 rounded-xl border border-blue-100">
                                <LucideMapPin size={14} className="text-blue-600 shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{deliveryAddress}</span>
                            </div>
                        ) : (
                            <p className="text-xs text-amber-800 font-bold bg-amber-50 p-2 rounded-xl border border-amber-200">
                                ⚠️ Please set your delivery address before placing order.
                            </p>
                        )}
                        {deliveryLocationError && (
                            <div className="flex items-start gap-2 text-xs text-rose-800 font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                                <LucideAlertTriangle size={15} className="shrink-0 text-rose-600 mt-0.5" />
                                <div className="flex-1">
                                    <p className="font-bold text-rose-900">Delivery Unavailable</p>
                                    <p className="text-[11px] font-medium leading-relaxed">{deliveryLocationError}</p>
                                </div>
                            </div>
                        )}
                        {!deliveryLocationError && deliverySettings?.zone_name && (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-800 font-medium bg-emerald-50 p-2 rounded-xl border border-emerald-200">
                                <LucideCheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                                <span>Active Zone: <strong className="text-emerald-950">{deliverySettings.zone_name}</strong> • Delivery fee: ₹{deliverySettings.delivery_fee ?? 0}</span>
                            </div>
                        )}
                        {deliverySettings?.minimum_order_amount && subtotal < deliverySettings.minimum_order_amount && (
                            <div className="flex items-center gap-1.5 text-xs text-rose-700 font-bold bg-rose-50 p-2 rounded-xl border border-rose-200">
                                <LucideAlertTriangle size={13} className="shrink-0" />
                                <span>Minimum order amount for delivery is ₹{deliverySettings.minimum_order_amount}</span>
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-3">
                    {cartItems.map((item) => (
                        <CartItemCard
                            key={String(item.menu_item_id)}
                            item={item}
                            isExpanded={expandedItemId === String(item.menu_item_id)}
                            onToggleExpand={() => setExpandedItemId(prev => prev === String(item.menu_item_id) ? null : String(item.menu_item_id))}
                            onClose={() => setExpandedItemId(null)}
                            onUpdateQuantity={(delta) => {
                                if (delta === -1 && item.quantity === 1) {
                                    handleRequestRemoveItem(item);
                                } else {
                                    updateQuantity(item.menu_item_id, delta);
                                }
                            }}
                            onRemove={() => handleRequestRemoveItem(item)}
                            onUpdateNotes={(notes) => updateItemNotes(item.menu_item_id, notes)}
                        />
                    ))}
                </div>

                {/* Combos and Today's Specials Suggestions */}
                <CartSuggestions
                    combos={combos}
                    todaySpecials={todaySpecials}
                    cart={cart}
                    onAddCombo={handleAddCombo}
                    onAddSpecial={handleAddSpecial}
                    onIncrement={handleIncrement}
                    onDecrement={handleDecrement}
                    currencySymbol={profile?.currency_symbol || '₹'}
                />

                {/* Bill Details */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
                    <h3 className="font-bold text-sm text-black mb-2">Bill Summary</h3>
                    <div className="flex justify-between text-xs text-black font-medium">
                        <span>Item Total</span>
                        <span>₹{subtotal.toFixed(2)}</span>
                    </div>
                    {isDelivery && (
                        <div className="flex justify-between text-xs text-black font-medium">
                            <span>Delivery Fee</span>
                            <span>₹{Number(deliverySettings?.delivery_fee ?? 0).toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-xs text-black font-medium">
                        <span>GST / Taxes</span>
                        <span>₹{tax.toFixed(2)}</span>
                    </div>
                    {cgst > 0 && sgst > 0 && (
                        <div className="flex justify-between text-[11px] text-gray-500 pl-2">
                            <span>CGST + SGST</span>
                            <span>₹{cgst.toFixed(2)} + ₹{sgst.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="border-t border-dashed border-gray-200 my-2 pt-2 flex justify-between font-bold text-black">
                        <span>To Pay</span>
                        <span>₹{ceil2(total + (isDelivery ? Number(deliverySettings?.delivery_fee || 0) : 0)).toFixed(2)}</span>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <div className="fixed bottom-[80px] inset-x-0 mx-auto w-full max-w-md p-4 bg-white border-t border-gray-100 z-30 flex items-center justify-between gap-3 shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
                {cartItems.length > 0 ? (
                    <button
                        type="button"
                        onClick={() => setIsClearAllPending(true)}
                        className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-xl text-sm font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 active:scale-95 transition-all cursor-pointer"
                        title="Clear all items in cart"
                    >
                        <LucideTrash2 size={16} />
                        <span>Clear</span>
                    </button>
                ) : <div />}
                
                <button
                    onClick={handlePlaceOrder}
                    disabled={submitting || (isDelivery && (!!deliveryLocationError || (deliverySettings?.minimum_order_amount && subtotal < deliverySettings.minimum_order_amount)))}
                    className={`flex-1 py-3.5 ${
                        submitting || (isDelivery && (!!deliveryLocationError || (deliverySettings?.minimum_order_amount && subtotal < deliverySettings.minimum_order_amount)))
                            ? 'bg-gray-400 opacity-60 cursor-not-allowed' 
                            : 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                    } text-white font-black rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-wide text-sm shadow-md shadow-emerald-600/20`}
                >
                    {submitting ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                            Placing Order...
                        </>
                    ) : isDelivery && deliveryLocationError ? (
                        <>Delivery Unavailable</>
                    ) : (
                        <>
                            Place Order
                            <span className="bg-white/20 px-2 py-0.5 rounded text-xs shadow-xs">
                                ₹{Math.round((total + (isDelivery ? Number(deliverySettings?.delivery_fee || 0) : 0)) * 100) / 100}
                            </span>
                        </>
                    )}
                </button>
            </div>

            {/* Modal for Confirming Removal of Items / Clearing Cart */}
            <ConfirmRemoveItemModal
                isOpen={!!itemPendingRemoval || isClearAllPending}
                item={itemPendingRemoval}
                isClearAll={isClearAllPending}
                totalItems={totalItems}
                onConfirm={handleConfirmRemove}
                onCancel={handleCancelRemove}
            />

            {/* Modal for Editing Contact / Delivery Details */}
            {showCustomerModal && (
                <div 
                    className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
                    onClick={() => setShowCustomerModal(false)}
                >
                    <div 
                        className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base font-black text-slate-900">
                                {isDelivery ? 'Delivery Details' : 'Takeaway Details'}
                            </h3>
                            <button
                                onClick={() => setShowCustomerModal(false)}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <LucideX size={18} />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">Name *</label>
                                <input
                                    type="text"
                                    value={customerName}
                                    onChange={e => setCustomerName(e.target.value)}
                                    placeholder="Your Name"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">Phone Number *</label>
                                <input
                                    type="tel"
                                    value={customerPhone}
                                    onChange={e => setCustomerPhone(e.target.value)}
                                    placeholder="Mobile Number"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none"
                                />
                            </div>

                            {isDelivery && (
                                <>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">Delivery Address *</label>
                                        <textarea
                                            value={deliveryAddress}
                                            onChange={e => setDeliveryAddress(e.target.value)}
                                            placeholder="House no., street, area"
                                            rows={2}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">Landmark (optional)</label>
                                        <input
                                            type="text"
                                            value={deliveryLandmark}
                                            onChange={e => setDeliveryLandmark(e.target.value)}
                                            placeholder="Near landmark"
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1 block">Delivery Instructions</label>
                                        <input
                                            type="text"
                                            value={deliveryNotes}
                                            onChange={e => setDeliveryNotes(e.target.value)}
                                            placeholder="e.g. Ring bell, leave with guard"
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none"
                                        />
                                    </div>
                                </>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    if (!customerName.trim() || !customerPhone.trim()) {
                                        toast.error('Name and phone are required');
                                        return;
                                    }
                                    if (isDelivery && !deliveryAddress.trim()) {
                                        toast.error('Delivery address is required');
                                        return;
                                    }
                                    try {
                                        localStorage.setItem(`ros_customer_name_${urlRestaurantId}`, customerName.trim());
                                        localStorage.setItem(`ros_customer_mobile_${urlRestaurantId}`, customerPhone.trim());
                                        if (deliveryAddress) localStorage.setItem(`ros_delivery_address_${urlRestaurantId}`, deliveryAddress.trim());
                                    } catch {}
                                    setShowCustomerModal(false);
                                    toast.success('Details saved');
                                }}
                                className="w-full py-3 rounded-2xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer mt-2"
                            >
                                Save Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
