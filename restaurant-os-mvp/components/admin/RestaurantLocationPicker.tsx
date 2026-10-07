'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    MapPin, Navigation, Search, CheckCircle2, AlertCircle,
    Loader2, Save, Utensils, ShoppingBag, Bike, ShieldAlert,
    HelpCircle, Layers, RefreshCw, Compass, Ruler, ArrowRight,
    Edit3, Sparkles, Check, Lock, ChevronRight, Map as LucideMap, X
} from 'lucide-react';
import { toast } from 'sonner';

interface RestaurantLocationPickerProps {
    restaurantCode: string;
    onSaved?: (settings: any) => void;
    initialSettings?: any;
    onGoToZones?: () => void;
}

interface LocationSettings {
    latitude: number | null;
    longitude: number | null;
    address: string;
    dine_in_order_radius: number; // in km (e.g. 0.1 for 100m)
    takeaway_order_radius: number; // in km (e.g. 0.5 for 500m)
    delivery_order_radius: number | null; // in km (e.g. 5.0 for 5km)
    dine_in_takeaway_order_radius?: number;
    max_delivery_radius_km?: number | null;
    dine_in_enabled: boolean;
    takeaway_enabled: boolean;
    delivery_enabled: boolean;
    delivery_fee: number;
    minimum_order_amount: number;
    estimated_delivery_minutes: number;
}

type DistanceUnit = 'm' | 'km';

// Helper to format radius display
function formatRadiusDisplay(km: number | null | undefined): string {
    if (km == null || isNaN(km)) return 'Not configured';
    const m = Math.round(km * 1000);
    if (m < 1000) {
        return `${m} m (${km.toFixed(2)} km)`;
    }
    return `${km.toFixed(km % 1 === 0 ? 0 : 2)} km (${m.toLocaleString()} m)`;
}

// Short format for badges
function formatShort(km: number | null | undefined): string {
    if (km == null || isNaN(km)) return 'No limit';
    const m = Math.round(km * 1000);
    if (m < 1000) return `${m} m`;
    return `${km.toFixed(km % 1 === 0 ? 0 : 1)} km`;
}

export default function RestaurantLocationPicker({
    restaurantCode,
    onSaved,
    initialSettings,
    onGoToZones
}: RestaurantLocationPickerProps) {
    const [settings, setSettings] = useState<LocationSettings>(() => {
        const dineIn = initialSettings?.dine_in_order_radius != null
            ? Number(initialSettings.dine_in_order_radius)
            : (initialSettings?.dine_in_takeaway_order_radius != null ? Number(initialSettings.dine_in_takeaway_order_radius) : 0.1);
        const takeaway = initialSettings?.takeaway_order_radius != null
            ? Number(initialSettings.takeaway_order_radius)
            : (initialSettings?.dine_in_takeaway_order_radius != null ? Number(initialSettings.dine_in_takeaway_order_radius) : 0.5);
        const delivery = initialSettings?.delivery_order_radius != null
            ? Number(initialSettings.delivery_order_radius)
            : (initialSettings?.max_delivery_radius_km != null ? Number(initialSettings.max_delivery_radius_km) : 5.0);

        return {
            latitude: initialSettings?.latitude != null ? Number(initialSettings.latitude) : null,
            longitude: initialSettings?.longitude != null ? Number(initialSettings.longitude) : null,
            address: initialSettings?.address ?? '',
            dine_in_order_radius: dineIn,
            takeaway_order_radius: takeaway,
            delivery_order_radius: delivery,
            dine_in_takeaway_order_radius: dineIn,
            max_delivery_radius_km: delivery,
            dine_in_enabled: initialSettings?.dine_in_enabled ?? true,
            takeaway_enabled: initialSettings?.takeaway_enabled ?? true,
            delivery_enabled: initialSettings?.delivery_enabled ?? initialSettings?.enabled ?? false,
            delivery_fee: initialSettings?.delivery_fee ?? '',
            minimum_order_amount: initialSettings?.minimum_order_amount ?? '',
            estimated_delivery_minutes: initialSettings?.estimated_delivery_minutes ?? 30,
        };
    });

    // Step state: 'location' (Step 1) or 'radii' (Step 2)
    // Enforce sequential requirement: If coordinates are null, ALWAYS start at 'location'!
    const [currentStep, setCurrentStep] = useState<'location' | 'radii'>(() => {
        return (initialSettings?.latitude != null && initialSettings?.longitude != null) ? 'radii' : 'location';
    });

    // Distance unit switches per mode
    const [dineInUnit, setDineInUnit] = useState<DistanceUnit>(() => (settings.dine_in_order_radius < 1 ? 'm' : 'km'));
    const [takeawayUnit, setTakeawayUnit] = useState<DistanceUnit>(() => (settings.takeaway_order_radius < 1 ? 'm' : 'km'));
    const [deliveryUnit, setDeliveryUnit] = useState<DistanceUnit>(() => (settings.delivery_order_radius && settings.delivery_order_radius < 1 ? 'm' : 'km'));

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [locatingUser, setLocatingUser] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchingAddress, setSearchingAddress] = useState(false);

    // Leaflet map refs
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const dineInCircleRef = useRef<any>(null);
    const takeawayCircleRef = useRef<any>(null);
    const deliveryCircleRef = useRef<any>(null);
    const LRef = useRef<any>(null);

    // Explicit Location Change Workflow States
    // 1. Never directly update restaurant location on map tap
    // 2. "Change Restaurant Location" -> 2 options: GPS & Manual Point -> Save to apply
    const [showChangeLocationModal, setShowChangeLocationModal] = useState(false);
    const [locationMode, setLocationMode] = useState<'none' | 'gps' | 'manual'>('none');
    const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [pendingAddress, setPendingAddress] = useState<string>('');
    const [isSavingNewLocation, setIsSavingNewLocation] = useState(false);

    const locationModeRef = useRef<'none' | 'gps' | 'manual'>('none');
    locationModeRef.current = locationMode;
    const pendingMarkerRef = useRef<any>(null);

    // Fetch existing settings on mount
    useEffect(() => {
        if (!restaurantCode) return;
        setLoading(true);
        fetch(`/api/delivery/settings?restaurantId=${encodeURIComponent(restaurantCode)}`)
            .then(res => res.json())
            .then(data => {
                if (data.settings) {
                    const s = data.settings;
                    const dineIn = s.dine_in_order_radius != null
                        ? Number(s.dine_in_order_radius)
                        : (s.dine_in_takeaway_order_radius != null ? Number(s.dine_in_takeaway_order_radius) : 0.1);
                    const takeaway = s.takeaway_order_radius != null
                        ? Number(s.takeaway_order_radius)
                        : (s.dine_in_takeaway_order_radius != null ? Number(s.dine_in_takeaway_order_radius) : 0.5);
                    const delivery = s.delivery_order_radius != null
                        ? Number(s.delivery_order_radius)
                        : (s.max_delivery_radius_km != null ? Number(s.max_delivery_radius_km) : 5.0);

                    const hasCoords = s.latitude != null && s.longitude != null;

                    setSettings({
                        latitude: s.latitude != null ? Number(s.latitude) : null,
                        longitude: s.longitude != null ? Number(s.longitude) : null,
                        address: s.address || '',
                        dine_in_order_radius: dineIn,
                        takeaway_order_radius: takeaway,
                        delivery_order_radius: delivery,
                        dine_in_takeaway_order_radius: dineIn,
                        max_delivery_radius_km: delivery,
                        dine_in_enabled: s.dine_in_enabled ?? true,
                        takeaway_enabled: s.takeaway_enabled ?? true,
                        delivery_enabled: s.delivery_enabled ?? s.enabled ?? false,
                        delivery_fee: s.delivery_fee != null ? Number(s.delivery_fee) : 0,
                        minimum_order_amount: s.minimum_order_amount != null ? Number(s.minimum_order_amount) : 0,
                        estimated_delivery_minutes: s.estimated_delivery_minutes != null ? Number(s.estimated_delivery_minutes) : 30,
                    });

                    setDineInUnit(dineIn < 1 ? 'm' : 'km');
                    setTakeawayUnit(takeaway < 1 ? 'm' : 'km');
                    setDeliveryUnit(delivery && delivery < 1 ? 'm' : 'km');

                    if (s.address) {
                        setSearchQuery(s.address);
                    }

                    // Enforce sequential rule: if no coordinates, must start at Step 1 (location)
                    if (hasCoords) {
                        setCurrentStep('radii');
                    } else {
                        setCurrentStep('location');
                    }
                }
            })
            .catch(err => {
                console.error('Failed to load settings:', err);
                toast.error('Failed to load restaurant location settings');
            })
            .finally(() => setLoading(false));
    }, [restaurantCode]);

    // Reverse geocode coordinates to human-readable address
    const reverseGeocode = async (lat: number, lng: number) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
                headers: { 'Accept-Language': 'en' }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.display_name) {
                    setSettings(prev => ({
                        ...prev,
                        address: data.display_name
                    }));
                    setSearchQuery(data.display_name);
                }
            }
        } catch {
            // Gracefully ignore geocoding failure
        }
    };

    // Reverse geocode for pending location
    const reverseGeocodePending = async (lat: number, lng: number) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
                headers: { 'Accept-Language': 'en' }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.display_name) {
                    setPendingAddress(data.display_name);
                }
            }
        } catch {
            // Gracefully ignore geocoding failure
        }
    };

    // Update or create the pending location preview marker
    const updatePendingMarker = useCallback((lat: number, lng: number) => {
        const L = LRef.current;
        const map = mapInstanceRef.current;
        if (!L || !map) return;

        if (pendingMarkerRef.current) {
            pendingMarkerRef.current.setLatLng([lat, lng]);
            pendingMarkerRef.current.setPopupContent(`
                <div style="font-family: inherit; padding: 4px;">
                    <b style="font-size: 13px; color: #2563eb;">📍 Pending Location</b>
                    <div style="font-size: 11px; color: #4b5563; margin-top: 2px;">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
                    <div style="font-size: 10px; color: #059669; font-weight: bold; margin-top: 3px;">Click "Save Location" to apply!</div>
                </div>
            `);
        } else {
            const customPendingIcon = L.divIcon({
                className: 'custom-pending-pin',
                html: `
                    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
                        <div style="
                            position: absolute;
                            width: 44px;
                            height: 44px;
                            border-radius: 50% 50% 50% 0;
                            background: rgba(37, 99, 235, 0.4);
                            transform: rotate(-45deg);
                            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
                        "></div>
                        <div style="
                            width: 38px;
                            height: 38px;
                            background: linear-gradient(135deg, #2563eb, #1d4ed8);
                            border-radius: 50% 50% 50% 0;
                            transform: rotate(-45deg);
                            box-shadow: 0 4px 16px rgba(37, 99, 235, 0.55);
                            border: 3px solid white;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            cursor: grab;
                            z-index: 10;
                        ">
                            <div style="transform: rotate(45deg); color: white; font-weight: 900; font-size: 16px;">📍</div>
                        </div>
                    </div>
                `,
                iconSize: [44, 44],
                iconAnchor: [22, 44],
                popupAnchor: [0, -44],
            });

            const marker = L.marker([lat, lng], { draggable: true, icon: customPendingIcon }).addTo(map);
            marker.bindPopup(`
                <div style="font-family: inherit; padding: 4px;">
                    <b style="font-size: 13px; color: #2563eb;">📍 Pending Location</b>
                    <div style="font-size: 11px; color: #4b5563; margin-top: 2px;">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
                    <div style="font-size: 10px; color: #059669; font-weight: bold; margin-top: 3px;">Click "Save Location" to apply!</div>
                </div>
            `).openPopup();

            marker.on('dragend', (e: any) => {
                const newPos = e.target.getLatLng();
                const nLat = Number(newPos.lat.toFixed(6));
                const nLng = Number(newPos.lng.toFixed(6));
                setPendingCoords({ lat: nLat, lng: nLng });
                reverseGeocodePending(nLat, nLng);
            });

            pendingMarkerRef.current = marker;
        }
    }, []);

    // Update map marker & radius circles
    const updateMapVisuals = useCallback((
        lat: number | null,
        lng: number | null,
        dineRadius: number,
        takeawayRadius: number,
        deliveryRadius: number | null,
        step: 'location' | 'radii'
    ) => {
        const L = LRef.current;
        const map = mapInstanceRef.current;
        if (!L || !map) return;

        if (lat == null || lng == null) {
            // Remove marker and circles if no coordinates
            if (markerRef.current) {
                map.removeLayer(markerRef.current);
                markerRef.current = null;
            }
            if (dineInCircleRef.current) {
                map.removeLayer(dineInCircleRef.current);
                dineInCircleRef.current = null;
            }
            if (takeawayCircleRef.current) {
                map.removeLayer(takeawayCircleRef.current);
                takeawayCircleRef.current = null;
            }
            if (deliveryCircleRef.current) {
                map.removeLayer(deliveryCircleRef.current);
                deliveryCircleRef.current = null;
            }
            return;
        }

        const pos: [number, number] = [lat, lng];

        // 1. Restaurant Kitchen Pin (Orange custom pin) - NOT draggable directly
        if (!markerRef.current) {
            const customIcon = L.divIcon({
                className: 'custom-restaurant-pin',
                html: `
                    <div style="
                        width: 42px;
                        height: 42px;
                        background: linear-gradient(135deg, #f97316, #ea580c);
                        border-radius: 50% 50% 50% 0;
                        transform: rotate(-45deg);
                        box-shadow: 0 4px 16px rgba(234, 88, 12, 0.5);
                        border: 3px solid white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                    ">
                        <div style="transform: rotate(45deg); color: white; font-weight: 900; font-size: 18px;">🍴</div>
                    </div>
                `,
                iconSize: [42, 42],
                iconAnchor: [21, 42],
                popupAnchor: [0, -42]
            });

            const marker = L.marker(pos, { draggable: false, icon: customIcon }).addTo(map);
            marker.bindPopup(`
                <div style="font-family: inherit; padding: 4px;">
                    <b style="font-size: 13px; color: #ea580c;">🍴 Restaurant Kitchen Origin (Confirmed)</b>
                    <div style="font-size: 11px; color: #4b5563; margin-top: 2px;">Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}</div>
                    <div style="font-size: 10px; color: #9ca3af; margin-top: 3px;">Use "Change Restaurant Location" to modify</div>
                </div>
            `);

            markerRef.current = marker;
        } else {
            markerRef.current.setLatLng(pos);
            markerRef.current.setPopupContent(`
                <div style="font-family: inherit; padding: 4px;">
                    <b style="font-size: 13px; color: #ea580c;">🍴 Restaurant Kitchen Origin (Confirmed)</b>
                    <div style="font-size: 11px; color: #4b5563; margin-top: 2px;">Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}</div>
                    <div style="font-size: 10px; color: #9ca3af; margin-top: 3px;">Use "Change Restaurant Location" to modify</div>
                </div>
            `);
        }

        // 2. Geofence Circles: Always render Dine-In, Takeaway, and Delivery radii with distinct colors
        // DINE-IN RADIUS CIRCLE (Royal Blue Dashed)
        const dineRadiusMeters = Math.max(10, Math.round((dineRadius || 0.1) * 1000));
        if (!dineInCircleRef.current) {
            dineInCircleRef.current = L.circle(pos, {
                radius: dineRadiusMeters,
                color: '#2563eb', // Royal Blue
                fillColor: '#3b82f6',
                fillOpacity: 0.22,
                weight: 2,
                dashArray: '5, 5'
            }).addTo(map);
            dineInCircleRef.current.bindTooltip(`🍽️ Dine-In Radius: ${formatShort(dineRadius)}`, { permanent: false });
        } else {
            dineInCircleRef.current.setLatLng(pos);
            dineInCircleRef.current.setRadius(dineRadiusMeters);
            dineInCircleRef.current.setTooltipContent(`🍽️ Dine-In Radius: ${formatShort(dineRadius)}`);
        }

        // TAKEAWAY RADIUS CIRCLE (Warm Amber Dashed)
        const takeawayRadiusMeters = Math.max(20, Math.round((takeawayRadius || 0.5) * 1000));
        if (!takeawayCircleRef.current) {
            takeawayCircleRef.current = L.circle(pos, {
                radius: takeawayRadiusMeters,
                color: '#d97706', // Warm Amber
                fillColor: '#f59e0b',
                fillOpacity: 0.16,
                weight: 2,
                dashArray: '6, 6'
            }).addTo(map);
            takeawayCircleRef.current.bindTooltip(`🛍️ Takeaway Radius: ${formatShort(takeawayRadius)}`, { permanent: false });
        } else {
            takeawayCircleRef.current.setLatLng(pos);
            takeawayCircleRef.current.setRadius(takeawayRadiusMeters);
            takeawayCircleRef.current.setTooltipContent(`🛍️ Takeaway Radius: ${formatShort(takeawayRadius)}`);
        }

        // DELIVERY RADIUS CIRCLE (Vibrant Deep Orange)
        if (deliveryRadius && deliveryRadius > 0) {
            const delivRadiusMeters = Math.round(deliveryRadius * 1000);
            if (!deliveryCircleRef.current) {
                deliveryCircleRef.current = L.circle(pos, {
                    radius: delivRadiusMeters,
                    color: '#ea580c', // Deep Orange
                    fillColor: '#f97316',
                    fillOpacity: 0.08,
                    weight: 2.5,
                    dashArray: '8, 8',
                }).addTo(map);
                deliveryCircleRef.current.bindTooltip(`🛵 Delivery Radius: ${formatShort(deliveryRadius)}`, { permanent: false });
            } else {
                deliveryCircleRef.current.setLatLng(pos);
                deliveryCircleRef.current.setRadius(delivRadiusMeters);
                deliveryCircleRef.current.setTooltipContent(`🛵 Delivery Radius: ${formatShort(deliveryRadius)}`);
            }
        } else if (deliveryCircleRef.current) {
            map.removeLayer(deliveryCircleRef.current);
            deliveryCircleRef.current = null;
        }
    }, []);

    // Initialize Leaflet Map once
    useEffect(() => {
        if (loading || !mapContainerRef.current) return;
        if (mapInstanceRef.current) return;

        let isCancelled = false;

        import('leaflet').then((L) => {
            if (isCancelled || !mapContainerRef.current) return;
            LRef.current = L;

            if (!document.getElementById('leaflet-css')) {
                const link = document.createElement('link');
                link.id = 'leaflet-css';
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
            }

            const hasCoords = settings.latitude != null && settings.longitude != null;
            const initialLat = hasCoords ? Number(settings.latitude) : 20.5937;
            const initialLng = hasCoords ? Number(settings.longitude) : 78.9629;
            const initialZoom = hasCoords ? 15 : 5;

            const map = L.map(mapContainerRef.current, {
                center: [initialLat, initialLng],
                zoom: initialZoom,
                scrollWheelZoom: true,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);

            // Map click listener: ONLY sets pending coordinates when actively in 'manual' mode
            map.on('click', (e: any) => {
                if (locationModeRef.current !== 'manual') {
                    // Do NOT directly change restaurant location by tapping map!
                    return;
                }
                const clickLat = Number(e.latlng.lat.toFixed(6));
                const clickLng = Number(e.latlng.lng.toFixed(6));
                setPendingCoords({ lat: clickLat, lng: clickLng });
                updatePendingMarker(clickLat, clickLng);
                reverseGeocodePending(clickLat, clickLng);
                toast.info(`📍 Manual point placed at (${clickLat.toFixed(5)}, ${clickLng.toFixed(5)}). Review and click "Save Location" to apply.`);
            });

            mapInstanceRef.current = map;

            if (hasCoords) {
                updateMapVisuals(
                    Number(settings.latitude),
                    Number(settings.longitude),
                    settings.dine_in_order_radius,
                    settings.takeaway_order_radius,
                    settings.delivery_order_radius,
                    currentStep
                );
            }

            setTimeout(() => {
                map.invalidateSize();
            }, 300);
        });

        return () => {
            isCancelled = true;
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                markerRef.current = null;
                if (pendingMarkerRef.current) {
                    pendingMarkerRef.current = null;
                }
                dineInCircleRef.current = null;
                takeawayCircleRef.current = null;
                deliveryCircleRef.current = null;
            }
        };
    }, [loading, updateMapVisuals, updatePendingMarker]);

    // Handle Radius changes and step transitions to update visuals in real-time
    useEffect(() => {
        if (mapInstanceRef.current) {
            updateMapVisuals(
                settings.latitude,
                settings.longitude,
                settings.dine_in_order_radius,
                settings.takeaway_order_radius,
                settings.delivery_order_radius,
                currentStep
            );
        }
    }, [
        settings.dine_in_order_radius,
        settings.takeaway_order_radius,
        settings.delivery_order_radius,
        settings.latitude,
        settings.longitude,
        currentStep,
        updateMapVisuals
    ]);

    // Invalidate map size when switching steps
    useEffect(() => {
        if (mapInstanceRef.current) {
            setTimeout(() => {
                mapInstanceRef.current?.invalidateSize();
                if (settings.latitude != null && settings.longitude != null) {
                    mapInstanceRef.current?.setView([settings.latitude, settings.longitude], currentStep === 'radii' ? 14 : 16);
                }
            }, 200);
        }
    }, [currentStep]);

    // Open Change Location Modal
    const handleOpenChangeLocationModal = () => {
        if (settings.latitude != null && settings.longitude != null) {
            setPendingCoords({ lat: settings.latitude, lng: settings.longitude });
            setPendingAddress(settings.address || '');
            updatePendingMarker(settings.latitude, settings.longitude);
        } else {
            setPendingCoords(null);
            setPendingAddress('');
        }
        setLocationMode('none');
        setShowChangeLocationModal(true);
    };

    // Option 1: Device GPS Selection
    const handleSelectGpsOption = () => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser');
            return;
        }

        setLocatingUser(true);
        setLocationMode('gps');
        toast.info('Acquiring real-time GPS coordinates...');

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = Number(pos.coords.latitude.toFixed(6));
                const lng = Number(pos.coords.longitude.toFixed(6));
                setPendingCoords({ lat, lng });

                if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([lat, lng], 16, { animate: true });
                }
                updatePendingMarker(lat, lng);
                reverseGeocodePending(lat, lng);
                setLocatingUser(false);
                toast.success(`📍 GPS coordinates acquired (${lat.toFixed(5)}, ${lng.toFixed(5)})! Click "Save Location" below to apply.`);
            },
            (err) => {
                setLocatingUser(false);
                console.error('Geolocation error:', err);
                toast.error('Failed to get GPS location. Please allow browser location permissions or choose Manual Point.');
            },
            { enableHighAccuracy: true, timeout: 12000 }
        );
    };

    // Option 2: Manual Point on Map Selection
    const handleSelectManualPointOption = () => {
        setLocationMode('manual');
        setShowChangeLocationModal(false); // Close modal so user can interact directly with map
        toast.info('🎯 Manual Point Mode active! Click anywhere on the map or drag the pin to place the pending restaurant location.');

        const center = mapInstanceRef.current ? mapInstanceRef.current.getCenter() : null;
        const initialLat = settings.latitude ?? center?.lat ?? 20.5937;
        const initialLng = settings.longitude ?? center?.lng ?? 78.9629;
        const targetLat = Number(initialLat.toFixed(6));
        const targetLng = Number(initialLng.toFixed(6));

        setPendingCoords({ lat: targetLat, lng: targetLng });
        updatePendingMarker(targetLat, targetLng);
        reverseGeocodePending(targetLat, targetLng);
    };

    // Confirm and Save New Location (ONLY now is restaurant location updated)
    const handleConfirmSaveNewLocation = async () => {
        if (!pendingCoords) {
            toast.error('Please pick a location using GPS or Manual Point first.');
            return;
        }

        setIsSavingNewLocation(true);
        try {
            const payload = {
                restaurantId: restaurantCode,
                latitude: pendingCoords.lat,
                longitude: pendingCoords.lng,
                address: pendingAddress || settings.address || '',
                dine_in_order_radius: settings.dine_in_order_radius,
                takeaway_order_radius: settings.takeaway_order_radius,
                delivery_order_radius: settings.delivery_order_radius,
                dine_in_takeaway_order_radius: settings.dine_in_order_radius,
                max_delivery_radius_km: settings.delivery_order_radius,
                dine_in_enabled: settings.dine_in_enabled,
                takeaway_enabled: settings.takeaway_enabled,
                delivery_enabled: settings.delivery_enabled,
                enabled: settings.delivery_enabled,
                delivery_fee: settings.delivery_fee,
                minimum_order_amount: settings.minimum_order_amount,
                estimated_delivery_minutes: settings.estimated_delivery_minutes,
            };

            const res = await fetch('/api/delivery/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save location');

            // ONLY upon Save does the restaurant location state update!
            setSettings(prev => ({
                ...prev,
                latitude: pendingCoords.lat,
                longitude: pendingCoords.lng,
                address: pendingAddress || prev.address,
            }));

            // Remove pending marker from map
            if (pendingMarkerRef.current && mapInstanceRef.current) {
                mapInstanceRef.current.removeLayer(pendingMarkerRef.current);
                pendingMarkerRef.current = null;
            }

            // Update confirmed restaurant marker and visuals
            updateMapVisuals(
                pendingCoords.lat,
                pendingCoords.lng,
                settings.dine_in_order_radius,
                settings.takeaway_order_radius,
                settings.delivery_order_radius,
                currentStep
            );

            if (onSaved) onSaved(data.settings);

            setLocationMode('none');
            setShowChangeLocationModal(false);
            setPendingCoords(null);
            setPendingAddress('');

            toast.success(`✓ Restaurant location saved to (${pendingCoords.lat.toFixed(4)}, ${pendingCoords.lng.toFixed(4)})!`);
        } catch (err: any) {
            console.error('Save location error:', err);
            toast.error(err.message || 'Error saving restaurant location');
        } finally {
            setIsSavingNewLocation(false);
        }
    };

    // Cancel Location Change
    const handleCancelChangeLocation = () => {
        if (pendingMarkerRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(pendingMarkerRef.current);
            pendingMarkerRef.current = null;
        }
        setLocationMode('none');
        setShowChangeLocationModal(false);
        setPendingCoords(null);
        setPendingAddress('');
        toast.info('Location change cancelled. Existing restaurant location unchanged.');
    };

    // Search address on OpenStreetMap Nominatim
    const handleSearchAddress = async () => {
        if (!searchQuery.trim()) return;
        setSearchingAddress(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim())}&limit=1`, {
                headers: { 'Accept-Language': 'en' }
            });
            if (!res.ok) throw new Error('Search failed');
            const results = await res.json();
            if (results && results.length > 0) {
                const lat = parseFloat(results[0].lat);
                const lng = parseFloat(results[0].lon);
                setSettings(prev => ({
                    ...prev,
                    latitude: lat,
                    longitude: lng,
                    address: results[0].display_name
                }));

                if (mapInstanceRef.current) {
                    mapInstanceRef.current.setView([lat, lng], 16);
                }
                updateMapVisuals(
                    lat,
                    lng,
                    settings.dine_in_order_radius,
                    settings.takeaway_order_radius,
                    settings.delivery_order_radius,
                    currentStep
                );
                toast.success('Found location and placed restaurant pin!');
            } else {
                toast.error('No locations found for this query. Try adding city or landmark.');
            }
        } catch (e: any) {
            toast.error('Address search error: ' + (e.message || 'Network issue'));
        } finally {
            setSearchingAddress(false);
        }
    };

    // STEP 1: Save Location Only (Save & Proceed to Range Options)
    const handleSaveLocationOnly = async () => {
        if (settings.latitude == null || settings.longitude == null) {
            toast.error('Please pinpoint your restaurant location on the map or click "Use Device GPS"');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                restaurantId: restaurantCode,
                latitude: settings.latitude,
                longitude: settings.longitude,
                address: settings.address,
                dine_in_order_radius: settings.dine_in_order_radius,
                takeaway_order_radius: settings.takeaway_order_radius,
                delivery_order_radius: settings.delivery_order_radius,
                dine_in_takeaway_order_radius: settings.dine_in_order_radius,
                max_delivery_radius_km: settings.delivery_order_radius,
                dine_in_enabled: settings.dine_in_enabled,
                takeaway_enabled: settings.takeaway_enabled,
                delivery_enabled: settings.delivery_enabled,
                enabled: settings.delivery_enabled,
                delivery_fee: settings.delivery_fee,
                minimum_order_amount: settings.minimum_order_amount,
                estimated_delivery_minutes: settings.estimated_delivery_minutes,
            };

            const res = await fetch('/api/delivery/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save location');

            toast.success('Restaurant location saved! Now proceed to configure your ordering ranges.');
            if (onSaved) onSaved(data.settings);
            setCurrentStep('radii');
        } catch (err: any) {
            console.error('Save location error:', err);
            toast.error(err.message || 'Error saving restaurant location');
        } finally {
            setSaving(false);
        }
    };

    // STEP 2: Save All Range & Delivery Settings
    const handleSaveAll = async () => {
        if (settings.latitude == null || settings.longitude == null) {
            toast.error('Please configure restaurant location first in Step 1');
            setCurrentStep('location');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                restaurantId: restaurantCode,
                latitude: settings.latitude,
                longitude: settings.longitude,
                address: settings.address,
                dine_in_order_radius: settings.dine_in_order_radius,
                takeaway_order_radius: settings.takeaway_order_radius,
                delivery_order_radius: settings.delivery_order_radius,
                dine_in_takeaway_order_radius: settings.dine_in_order_radius,
                max_delivery_radius_km: settings.delivery_order_radius,
                dine_in_enabled: settings.dine_in_enabled,
                takeaway_enabled: settings.takeaway_enabled,
                delivery_enabled: settings.delivery_enabled,
                enabled: settings.delivery_enabled,
                delivery_fee: Number(settings.delivery_fee) || 0,
                minimum_order_amount: Number(settings.minimum_order_amount) || 0,
                estimated_delivery_minutes: settings.estimated_delivery_minutes,
            };

            const res = await fetch('/api/delivery/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save settings');

            toast.success('Ordering radii & delivery settings saved successfully!');
            if (onSaved) onSaved(data.settings);
        } catch (err: any) {
            console.error('Save error:', err);
            toast.error(err.message || 'Error saving settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200 dark:border-zinc-800">
                <Loader2 className="animate-spin text-orange-500 mb-3" size={32} />
                <p className="text-sm font-semibold text-neutral-500">Loading restaurant location & configuration...</p>
            </div>
        );
    }

    const hasLocation = settings.latitude != null && settings.longitude != null;

    return (
        <div className="space-y-6">
            {/* Header & Step Wizard Bar */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-neutral-200/80 dark:border-zinc-800 shadow-sm space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/25">
                                <Compass size={20} />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-neutral-900 dark:text-white">
                                    Restaurant Location & Range Setup
                                </h2>
                                <p className="text-xs text-neutral-500">
                                    First establish your restaurant dispatch origin, then configure ordering radii and delivery options
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Step Switcher Tabs */}
                    <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-neutral-100 dark:bg-zinc-800 border border-neutral-200/80 dark:border-zinc-700/80">
                        {/* Tab 1: Restaurant Location */}
                        <button
                            type="button"
                            onClick={() => setCurrentStep('location')}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                currentStep === 'location'
                                    ? 'bg-white dark:bg-zinc-900 text-neutral-900 dark:text-white shadow-sm'
                                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-white'
                            }`}
                        >
                            <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-black">1</span>
                            <span>Restaurant Location</span>
                            {hasLocation && <Check size={13} className="text-emerald-500 stroke-[3]" />}
                        </button>

                        {/* Tab 2: Range & Delivery Options (LOCKED IF NO LOCATION) */}
                        <button
                            type="button"
                            onClick={() => {
                                if (!hasLocation) {
                                    toast.warning('Please set and save your restaurant location in Step 1 first.');
                                    return;
                                }
                                setCurrentStep('radii');
                            }}
                            disabled={!hasLocation}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                currentStep === 'radii'
                                    ? 'bg-white dark:bg-zinc-900 text-neutral-900 dark:text-white shadow-sm cursor-pointer'
                                    : hasLocation
                                        ? 'text-neutral-500 hover:text-neutral-800 dark:hover:text-white cursor-pointer'
                                        : 'text-neutral-400 dark:text-zinc-600 opacity-60 cursor-not-allowed'
                            }`}
                        >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                                hasLocation ? 'bg-blue-600 text-white' : 'bg-neutral-300 dark:bg-zinc-700 text-neutral-500'
                            }`}>
                                2
                            </span>
                            <span>Range & Delivery Options</span>
                            {!hasLocation && <Lock size={12} className="text-neutral-400" />}
                        </button>
                    </div>
                </div>

                {/* Status Notice Banner */}
                {!hasLocation ? (
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                                <AlertCircle size={20} />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                    Step 1: Set Your Restaurant Location First
                                </h4>
                                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
                                    Your restaurant coordinates are not configured yet. Click &ldquo;Set Restaurant Location&rdquo; below to choose GPS or Manual Point.
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleOpenChangeLocationModal}
                            className="px-4 py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                        >
                            <MapPin size={14} />
                            <span>Set Restaurant Location</span>
                        </button>
                    </div>
                ) : (
                    <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                        <div className="flex items-center gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                            <div>
                                <span className="font-bold">Restaurant Location Configured: </span>
                                <span>{settings.address || 'Address set'} </span>
                                <span className="font-mono text-[11px] text-neutral-500 dark:text-zinc-400">
                                    ({settings.latitude?.toFixed(4)}, {settings.longitude?.toFixed(4)})
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={handleOpenChangeLocationModal}
                                title="Change restaurant location via GPS or Manual Point"
                                className="px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                <MapPin size={13} />
                                <span>Change Restaurant Location</span>
                            </button>

                            {currentStep === 'radii' ? (
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep('location')}
                                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 text-xs font-bold border border-neutral-200 dark:border-zinc-700 shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                                >
                                    <Edit3 size={13} />
                                    <span>Review Range</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setCurrentStep('radii')}
                                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0"
                                >
                                    <span>Proceed to Range Options</span>
                                    <ArrowRight size={13} />
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Persistent Shared Map & Visualizer */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-neutral-200/80 dark:border-zinc-800 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <MapPin size={17} className="text-orange-500" />
                            <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider">
                                {currentStep === 'location' ? 'Step 1: Set Kitchen Origin' : 'Step 2: Geofence Range Visualizer'}
                            </h3>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">
                            {currentStep === 'location'
                                ? 'Pinpoint the dispatch location where kitchen staff & delivery boys meet.'
                                : 'Concentric circular ordering boundaries centered on your confirmed kitchen origin.'}
                        </p>
                    </div>

                    {/* Step 1 Quick Change Controls */}
                    {currentStep === 'location' && (
                        <button
                            type="button"
                            onClick={handleOpenChangeLocationModal}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 transition-all cursor-pointer"
                        >
                            <MapPin size={14} />
                            <span>{hasLocation ? 'Change Restaurant Location' : 'Set Restaurant Location'}</span>
                        </button>
                    )}
                </div>

                {/* Active Manual Point Floating Bar */}
                {locationMode === 'manual' && (
                    <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fadeIn border border-blue-400">
                        <div className="flex items-center gap-2.5 text-xs font-bold">
                            <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping shrink-0" />
                            <span>
                                🎯 Manual Point Mode Active: Click anywhere on the map or drag the blue pin to position the pending restaurant entrance.
                            </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {pendingCoords && (
                                <span className="px-2.5 py-1 rounded-xl bg-blue-800/80 font-mono text-[11px] font-bold">
                                    {pendingCoords.lat.toFixed(4)}, {pendingCoords.lng.toFixed(4)}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={handleConfirmSaveNewLocation}
                                disabled={isSavingNewLocation || !pendingCoords}
                                className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {isSavingNewLocation ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                <span>Save Location</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelChangeLocation}
                                className="px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-xs transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 1 Search Bar */}
                {currentStep === 'location' && (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearchAddress()}
                                placeholder="Type restaurant address or landmark (e.g. DLP, Nellore)..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/30 text-neutral-800 dark:text-white"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSearchAddress}
                            disabled={searchingAddress || !searchQuery.trim()}
                            className="px-5 py-2.5 rounded-2xl bg-neutral-900 hover:bg-black text-white dark:bg-zinc-700 dark:hover:bg-zinc-600 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
                        >
                            {searchingAddress ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                            <span>Locate on Map</span>
                        </button>
                    </div>
                )}

                {/* Interactive Leaflet Map Container */}
                <div className="relative w-full h-[420px] rounded-3xl overflow-hidden border border-neutral-200 dark:border-zinc-800 shadow-inner">
                    <div ref={mapContainerRef} className="w-full h-full z-0" />

                    {/* Floating Map Overlay Badge */}
                    <div className="absolute top-3 left-3 z-[400] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-neutral-200 dark:border-zinc-700 shadow-md pointer-events-none">
                        <div className="flex flex-col gap-1.5">
                            {currentStep === 'location' && (
                                <p className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                                    <MapPin size={13} className="text-orange-500" />
                                    <span>
                                        {locationMode === 'manual'
                                            ? '🎯 Click anywhere on map to position the pending pin, then click "Save Location"'
                                            : hasLocation
                                            ? 'Restaurant location confirmed • Click "Change Restaurant Location" to edit'
                                            : 'Click "Set Restaurant Location" to choose GPS or Manual Point'}
                                    </span>
                                </p>
                            )}
                            {hasLocation && (
                                <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-bold">
                                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white"></span>
                                        Dine In: {formatShort(settings.dine_in_order_radius)}
                                    </span>
                                    <span className="text-neutral-300 dark:text-zinc-700">•</span>
                                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white"></span>
                                        Takeaway: {formatShort(settings.takeaway_order_radius)}
                                    </span>
                                    <span className="text-neutral-300 dark:text-zinc-700">•</span>
                                    <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                                        <span className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-white"></span>
                                        Delivery: {formatShort(settings.delivery_order_radius)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Change Restaurant Location Modal */}
                {showChangeLocationModal && (
                    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                        <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 space-y-5 animate-scaleUp">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-md shadow-orange-500/25">
                                        <MapPin size={20} />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-neutral-900 dark:text-white">
                                            Change Restaurant Location
                                        </h3>
                                        <p className="text-xs text-neutral-500">
                                            Select how you want to pinpoint your restaurant kitchen origin
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleCancelChangeLocation}
                                    className="p-2 rounded-xl text-neutral-400 hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* 2 Clear Options */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {/* Option 1: Device GPS */}
                                <div
                                    onClick={handleSelectGpsOption}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                                        locationMode === 'gps'
                                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                                            : 'bg-neutral-50 dark:bg-zinc-800/40 border-neutral-200 dark:border-zinc-700 hover:border-orange-400'
                                    }`}
                                >
                                    <div className="space-y-1.5">
                                        <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                                            <Navigation size={18} />
                                        </div>
                                        <h4 className="text-xs font-black text-neutral-900 dark:text-white">
                                            Option 1: Device GPS
                                        </h4>
                                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                            Detect real-time GPS coordinates directly from your device hardware.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelectGpsOption();
                                        }}
                                        disabled={locatingUser}
                                        className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                        {locatingUser ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
                                        <span>{locatingUser ? 'Acquiring GPS...' : 'Use Device GPS'}</span>
                                    </button>
                                </div>

                                {/* Option 2: Manual Point */}
                                <div
                                    onClick={handleSelectManualPointOption}
                                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                                        locationMode === 'manual'
                                            ? 'bg-orange-50 dark:bg-orange-950/40 border-orange-500 shadow-md ring-2 ring-orange-500/20'
                                            : 'bg-neutral-50 dark:bg-zinc-800/40 border-neutral-200 dark:border-zinc-700 hover:border-orange-400'
                                    }`}
                                >
                                    <div className="space-y-1.5">
                                        <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                                            <MapPin size={18} />
                                        </div>
                                        <h4 className="text-xs font-black text-neutral-900 dark:text-white">
                                            Option 2: Manual Point
                                        </h4>
                                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                            Tap anywhere on the map or drag the pin to set the exact restaurant entrance.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleSelectManualPointOption();
                                        }}
                                        className="w-full py-2 px-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                        <MapPin size={13} />
                                        <span>Pick Point on Map</span>
                                    </button>
                                </div>
                            </div>

                            {/* Pending Location Review Card (if coordinates picked) */}
                            {pendingCoords && (
                                <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 space-y-1.5 animate-fadeIn">
                                    <div className="flex items-center justify-between text-xs font-bold text-neutral-800 dark:text-neutral-200">
                                        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                                            <CheckCircle2 size={14} /> New Selected Coordinates:
                                        </span>
                                        <span className="font-mono text-[11px] bg-white dark:bg-zinc-900 px-2 py-0.5 rounded-md border border-neutral-200 dark:border-zinc-700">
                                            {pendingCoords.lat.toFixed(5)}, {pendingCoords.lng.toFixed(5)}
                                        </span>
                                    </div>
                                    {pendingAddress && (
                                        <p className="text-[11px] text-neutral-500 truncate">
                                            📍 {pendingAddress}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-neutral-400 italic">
                                        Note: The new location will only take effect after clicking &ldquo;Save Location&rdquo;.
                                    </p>
                                </div>
                            )}

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100 dark:border-zinc-800">
                                <button
                                    type="button"
                                    onClick={handleCancelChangeLocation}
                                    className="px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmSaveNewLocation}
                                    disabled={isSavingNewLocation || !pendingCoords}
                                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                >
                                    {isSavingNewLocation ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                    <span>Save Location</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ════════════════════════════════════════════════════════════ */}
                {/* STEP 1 CONTROLS: COORDINATES & SAVE LOCATION                */}
                {/* ════════════════════════════════════════════════════════════ */}
                {currentStep === 'location' && (
                    <div className="space-y-4 pt-2 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 mb-1.5 block">
                                    Restaurant Latitude
                                </label>
                                <input
                                    type="number"
                                    step="0.000001"
                                    value={settings.latitude !== null ? settings.latitude : ''}
                                    onChange={e => {
                                        const lat = parseFloat(e.target.value);
                                        setSettings(s => ({ ...s, latitude: isNaN(lat) ? null : lat }));
                                    }}
                                    placeholder="e.g. 14.4426"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/30 text-neutral-800 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 mb-1.5 block">
                                    Restaurant Longitude
                                </label>
                                <input
                                    type="number"
                                    step="0.000001"
                                    value={settings.longitude !== null ? settings.longitude : ''}
                                    onChange={e => {
                                        const lng = parseFloat(e.target.value);
                                        setSettings(s => ({ ...s, longitude: isNaN(lng) ? null : lng }));
                                    }}
                                    placeholder="e.g. 79.9865"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/30 text-neutral-800 dark:text-white"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 mb-1.5 block">
                                    Restaurant Address / Landmark
                                </label>
                                <input
                                    type="text"
                                    value={settings.address}
                                    onChange={e => setSettings(s => ({ ...s, address: e.target.value }))}
                                    placeholder="e.g. DLP, Nellore, Andhra Pradesh - 524346"
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/30 text-neutral-800 dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Save Location & Continue Action */}
                        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-neutral-100 dark:border-zinc-800">
                            <p className="text-xs text-neutral-400">
                                Saving your location enables Dine In, Takeaway, and Delivery radius geofencing.
                            </p>

                            <div className="flex flex-wrap items-center gap-2">
                                {onGoToZones && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await handleSaveLocationOnly();
                                            onGoToZones();
                                        }}
                                        disabled={saving || !hasLocation}
                                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <Sparkles size={14} />
                                        <span>Save & Create Delivery Zones →</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleSaveLocationOnly}
                                    disabled={saving || !hasLocation}
                                    className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs shadow-md shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                                >
                                    {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                                    <span>Save & Proceed to Radii →</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* STEP 2: RANGE OPTIONS & GEOFENCING CONFIGURATION             */}
            {/* ════════════════════════════════════════════════════════════ */}
            {currentStep === 'radii' && (
                <div className="space-y-6 animate-fadeIn">
                    {/* Mode Toggles */}
                    <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-neutral-200/80 dark:border-zinc-800 shadow-sm space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider">
                                    Ordering Modes Permissions
                                </h3>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    Enable or disable customer ordering channels for your restaurant
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* DINE IN TOGGLE */}
                            <div className={`p-4 rounded-2xl border transition-all ${
                                settings.dine_in_enabled 
                                    ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40' 
                                    : 'bg-neutral-50 dark:bg-zinc-800/50 border-neutral-200 dark:border-zinc-700 opacity-60'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                            <Utensils size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Dine In</h4>
                                            <p className="text-[11px] text-neutral-500">QR or Table Ordering</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSettings(s => ({ ...s, dine_in_enabled: !s.dine_in_enabled }))}
                                        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                                            settings.dine_in_enabled ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-zinc-700'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                                            settings.dine_in_enabled ? 'translate-x-5' : 'translate-x-0'
                                        }`} />
                                    </button>
                                </div>
                                <p className="text-[11px] text-neutral-500 mt-2 font-medium">
                                    Allowed within <strong className="text-blue-600 dark:text-blue-400">{formatShort(settings.dine_in_order_radius)}</strong> of restaurant
                                </p>
                            </div>

                            {/* TAKEAWAY TOGGLE */}
                            <div className={`p-4 rounded-2xl border transition-all ${
                                settings.takeaway_enabled 
                                    ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40' 
                                    : 'bg-neutral-50 dark:bg-zinc-800/50 border-neutral-200 dark:border-zinc-700 opacity-60'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                            <ShoppingBag size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Takeaway</h4>
                                            <p className="text-[11px] text-neutral-500">Counter Pickup</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSettings(s => ({ ...s, takeaway_enabled: !s.takeaway_enabled }))}
                                        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                                            settings.takeaway_enabled ? 'bg-amber-500' : 'bg-neutral-300 dark:bg-zinc-700'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                                            settings.takeaway_enabled ? 'translate-x-5' : 'translate-x-0'
                                        }`} />
                                    </button>
                                </div>
                                <p className="text-[11px] text-neutral-500 mt-2 font-medium">
                                    Allowed within <strong className="text-amber-600 dark:text-amber-400">{formatShort(settings.takeaway_order_radius)}</strong> of restaurant
                                </p>
                            </div>

                            {/* DELIVERY TOGGLE */}
                            <div className={`p-4 rounded-2xl border transition-all ${
                                settings.delivery_enabled 
                                    ? 'bg-orange-50/60 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40' 
                                    : 'bg-neutral-50 dark:bg-zinc-800/50 border-neutral-200 dark:border-zinc-700 opacity-60'
                            }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
                                            <Bike size={18} />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Delivery</h4>
                                            <p className="text-[11px] text-neutral-500">Doorstep Delivery</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSettings(s => ({ ...s, delivery_enabled: !s.delivery_enabled }))}
                                        className={`w-11 h-6 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                                            settings.delivery_enabled ? 'bg-orange-500' : 'bg-neutral-300 dark:bg-zinc-700'
                                        }`}
                                    >
                                        <div className={`w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
                                            settings.delivery_enabled ? 'translate-x-5' : 'translate-x-0'
                                        }`} />
                                    </button>
                                </div>
                                <p className="text-[11px] text-neutral-500 mt-2 font-medium">
                                    Radius: <strong className="text-orange-600 dark:text-orange-400">{formatShort(settings.delivery_order_radius)}</strong>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Independent Radii Configuration (Meters & Kilometers) */}
                    <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-neutral-200/80 dark:border-zinc-800 shadow-sm space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Ruler size={18} className="text-orange-500" />
                                    <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider">
                                        Ordering Radii & Distance Limits
                                    </h3>
                                </div>
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    Configure distance limits in meters (m) or kilometers (km) measured from your confirmed restaurant origin
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            {/* 1. DINE-IN RADIUS */}
                            <div className="p-5 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 space-y-4 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                                            <Utensils size={16} />
                                            <span className="text-xs font-black uppercase tracking-wider">Dine-In Radius</span>
                                        </div>

                                        <div className="inline-flex p-0.5 rounded-xl bg-white dark:bg-zinc-800 border border-blue-200 dark:border-zinc-700 shadow-xs">
                                            <button
                                                type="button"
                                                onClick={() => setDineInUnit('m')}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                                    dineInUnit === 'm'
                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                                }`}
                                            >
                                                Meters (m)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDineInUnit('km')}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                                    dineInUnit === 'km'
                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                                }`}
                                            >
                                                Km
                                            </button>
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-neutral-500 leading-tight">
                                        Customer location must be within this proximity to place Dine In orders.
                                    </p>

                                    <div className="mt-3.5 p-3 rounded-xl bg-white dark:bg-zinc-900/80 border border-blue-200/70 dark:border-blue-900/50 flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-neutral-500">Active Limit:</span>
                                        <div className="text-right">
                                            <span className="text-sm font-black text-blue-700 dark:text-blue-400">
                                                {dineInUnit === 'm'
                                                    ? `${Math.round(settings.dine_in_order_radius * 1000)} m`
                                                    : `${settings.dine_in_order_radius.toFixed(settings.dine_in_order_radius < 1 ? 2 : 1)} km`}
                                            </span>
                                            <span className="text-[10px] text-neutral-400 block font-mono">
                                                {formatRadiusDisplay(settings.dine_in_order_radius)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Slider */}
                                    <div className="mt-4 space-y-1.5">
                                        <input
                                            type="range"
                                            min={dineInUnit === 'm' ? 10 : 0.05}
                                            max={dineInUnit === 'm' ? 1000 : 2}
                                            step={dineInUnit === 'm' ? 10 : 0.05}
                                            value={dineInUnit === 'm' ? Math.round(settings.dine_in_order_radius * 1000) : settings.dine_in_order_radius}
                                            onChange={e => {
                                                const val = parseFloat(e.target.value);
                                                const inKm = dineInUnit === 'm' ? val / 1000 : val;
                                                setSettings(s => ({ ...s, dine_in_order_radius: inKm }));
                                            }}
                                            className="w-full h-2 bg-blue-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                        <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                                            <span>{dineInUnit === 'm' ? '10 m' : '0.05 km'}</span>
                                            <span>{dineInUnit === 'm' ? '1,000 m (1 km)' : '2 km'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. TAKEAWAY RADIUS */}
                            <div className="p-5 rounded-2xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 space-y-4 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                            <ShoppingBag size={16} />
                                            <span className="text-xs font-black uppercase tracking-wider">Takeaway Radius</span>
                                        </div>

                                        <div className="inline-flex p-0.5 rounded-xl bg-white dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700 shadow-xs">
                                            <button
                                                type="button"
                                                onClick={() => setTakeawayUnit('m')}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                                    takeawayUnit === 'm'
                                                        ? 'bg-amber-500 text-white shadow-xs'
                                                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                                }`}
                                            >
                                                Meters (m)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTakeawayUnit('km')}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                                    takeawayUnit === 'km'
                                                        ? 'bg-amber-500 text-white shadow-xs'
                                                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                                }`}
                                            >
                                                Km
                                            </button>
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-neutral-500 leading-tight">
                                        Distance range for counter pickup takeaway orders.
                                    </p>

                                    <div className="mt-3.5 p-3 rounded-xl bg-white dark:bg-zinc-900/80 border border-amber-200/70 dark:border-amber-900/50 flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-neutral-500">Active Limit:</span>
                                        <div className="text-right">
                                            <span className="text-sm font-black text-amber-700 dark:text-amber-400">
                                                {takeawayUnit === 'm'
                                                    ? `${Math.round(settings.takeaway_order_radius * 1000)} m`
                                                    : `${settings.takeaway_order_radius.toFixed(settings.takeaway_order_radius < 1 ? 2 : 1)} km`}
                                            </span>
                                            <span className="text-[10px] text-neutral-400 block font-mono">
                                                {formatRadiusDisplay(settings.takeaway_order_radius)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Slider */}
                                    <div className="mt-4 space-y-1.5">
                                        <input
                                            type="range"
                                            min={takeawayUnit === 'm' ? 50 : 0.1}
                                            max={takeawayUnit === 'm' ? 5000 : 10}
                                            step={takeawayUnit === 'm' ? 50 : 0.1}
                                            value={takeawayUnit === 'm' ? Math.round(settings.takeaway_order_radius * 1000) : settings.takeaway_order_radius}
                                            onChange={e => {
                                                const val = parseFloat(e.target.value);
                                                const inKm = takeawayUnit === 'm' ? val / 1000 : val;
                                                setSettings(s => ({ ...s, takeaway_order_radius: inKm }));
                                            }}
                                            className="w-full h-2 bg-amber-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                        />
                                        <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                                            <span>{takeawayUnit === 'm' ? '50 m' : '0.1 km'}</span>
                                            <span>{takeawayUnit === 'm' ? '5,000 m (5 km)' : '10 km'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. DELIVERY RADIUS */}
                            <div className="p-5 rounded-2xl bg-orange-50/40 dark:bg-orange-950/20 border border-orange-200/80 dark:border-orange-900/40 space-y-4 flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                                            <Bike size={16} />
                                            <span className="text-xs font-black uppercase tracking-wider">Delivery Radius</span>
                                        </div>

                                        <div className="inline-flex p-0.5 rounded-xl bg-white dark:bg-zinc-800 border border-orange-200 dark:border-zinc-700 shadow-xs">
                                            <button
                                                type="button"
                                                onClick={() => setDeliveryUnit('km')}
                                                className={`px-2 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer ${
                                                    deliveryUnit === 'km'
                                                        ? 'bg-orange-500 text-white shadow-xs'
                                                        : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                                                }`}
                                            >
                                                Km
                                            </button>
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-neutral-500 leading-tight">
                                        Default circular radius for doorstep delivery coverage.
                                    </p>

                                    <div className="mt-3.5 p-3 rounded-xl bg-white dark:bg-zinc-900/80 border border-orange-200/70 dark:border-orange-900/50 flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-neutral-500">Active Limit:</span>
                                        <div className="text-right">
                                            <span className="text-sm font-black text-orange-700 dark:text-orange-400">
                                                {settings.delivery_order_radius != null ? `${settings.delivery_order_radius} km` : 'None'}
                                            </span>
                                            <span className="text-[10px] text-neutral-400 block font-mono">
                                                {formatRadiusDisplay(settings.delivery_order_radius)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Slider */}
                                    <div className="mt-4 space-y-1.5">
                                        <input
                                            type="range"
                                            min="0.5"
                                            max="30"
                                            step="0.5"
                                            value={settings.delivery_order_radius || 5}
                                            onChange={e => {
                                                const val = parseFloat(e.target.value);
                                                setSettings(s => ({ ...s, delivery_order_radius: val }));
                                            }}
                                            className="w-full h-2 bg-orange-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                        />
                                        <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                                            <span>0.5 km</span>
                                            <span>30 km</span>
                                        </div>
                                    </div>

                                    {onGoToZones && (
                                        <button
                                            type="button"
                                            onClick={onGoToZones}
                                            className="w-full mt-3 py-2 px-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                                        >
                                            <LucideMap size={13} />
                                            <span>Draw Polygon Delivery Zones →</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Delivery Fees & Limits */}
                        <div className="p-5 rounded-2xl bg-neutral-50 dark:bg-zinc-800/50 border border-neutral-200 dark:border-zinc-700 grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 mb-1.5 block">
                                    Default Delivery Fee (₹)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={settings.delivery_fee === 0 ? '' : (settings.delivery_fee ?? '')}
                                    onChange={e => setSettings(s => ({ ...s, delivery_fee: e.target.value === '' ? ('' as any) : (Number(e.target.value) || 0) }))}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-700 text-xs font-bold text-neutral-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 mb-1.5 block">
                                    Minimum Order Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="0"
                                    value={settings.minimum_order_amount === 0 ? '' : (settings.minimum_order_amount ?? '')}
                                    onChange={e => setSettings(s => ({ ...s, minimum_order_amount: e.target.value === '' ? ('' as any) : (Number(e.target.value) || 0) }))}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-700 text-xs font-bold text-neutral-900 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 mb-1.5 block">
                                    Estimated Delivery Time (mins)
                                </label>
                                <input
                                    type="number"
                                    min="5"
                                    value={settings.estimated_delivery_minutes}
                                    onChange={e => setSettings(s => ({ ...s, estimated_delivery_minutes: Number(e.target.value) || 30 }))}
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-700 text-xs font-bold text-neutral-900 dark:text-white"
                                />
                            </div>
                        </div>

                        {/* Save Action */}
                        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-neutral-100 dark:border-zinc-800">
                            <button
                                type="button"
                                onClick={() => setCurrentStep('location')}
                                className="text-xs font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-white cursor-pointer"
                            >
                                ← Back to Location Setup
                            </button>

                            <button
                                type="button"
                                onClick={handleSaveAll}
                                disabled={saving}
                                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                <span>Save All Range & Delivery Settings</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
