'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    MapPin, Plus, Trash2, Edit3, Check, X, AlertTriangle,
    Layers, Loader2, Save, Eye, EyeOff, Navigation, CheckCircle2,
    Info, RotateCcw, ShieldCheck, DollarSign, CornerDownRight, Compass,
    Sparkles, Target, Crosshair, Building2, Sliders, Radio, Maximize2
} from 'lucide-react';
import { toast } from 'sonner';

interface DeliveryZone {
    id: string;
    restaurantId: string;
    name: string;
    deliveryFee: number;
    minimumOrderAmount: number;
    enabled: boolean;
    geojson: {
        type: 'Polygon';
        coordinates: number[][][]; // [ [ [lng, lat], ... ] ]
    };
    createdAt?: string;
    updatedAt?: string;
}

interface AvailableRestaurant {
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    distanceKm?: number;
}

interface DeliveryZonesManagerProps {
    restaurantCode: string;
    onGoToSettings?: () => void;
}

const ZONE_COLORS = [
    { stroke: '#2563eb', fill: '#3b82f6', name: 'Blue' },
    { stroke: '#059669', fill: '#10b981', name: 'Emerald' },
    { stroke: '#d97706', fill: '#f59e0b', name: 'Amber' },
    { stroke: '#7c3aed', fill: '#8b5cf6', name: 'Purple' },
    { stroke: '#db2777', fill: '#ec4899', name: 'Pink' },
    { stroke: '#0891b2', fill: '#06b6d4', name: 'Cyan' },
    { stroke: '#ea580c', fill: '#f97316', name: 'Orange' },
];

/**
 * Line segment intersection check to prevent self-intersecting polygons client-side
 */
function ccw(A: [number, number], B: [number, number], C: [number, number]) {
    return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0]);
}

function doSegmentsIntersect(
    p1: [number, number],
    p2: [number, number],
    p3: [number, number],
    p4: [number, number]
) {
    return (
        ccw(p1, p3, p4) !== ccw(p2, p3, p4) &&
        ccw(p1, p2, p3) !== ccw(p1, p2, p4)
    );
}

function isPolygonSelfIntersecting(points: [number, number][]): boolean {
    const n = points.length;
    if (n < 4) return false;

    // Check all non-adjacent segment pairs
    for (let i = 0; i < n; i++) {
        const a1 = points[i];
        const a2 = points[(i + 1) % n];

        for (let j = i + 2; j < n; j++) {
            if (i === 0 && j === n - 1) continue; // Skip adjacent first and last

            const b1 = points[j];
            const b2 = points[(j + 1) % n];

            if (doSegmentsIntersect(a1, a2, b1, b2)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Great-circle distance between two coordinates in kilometers (Haversine formula)
 */
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(2));
}

/**
 * Generate regular polygon approximating a circle around center [lat, lng] on the globe
 */
function generateGeodesicPolygon(
    centerLat: number,
    centerLng: number,
    radiusKm: number,
    numVertices: number = 16
): [number, number][] {
    const points: [number, number][] = [];
    const R = 6371; // km
    const d = radiusKm / R;
    const lat1 = (centerLat * Math.PI) / 180;
    const lng1 = (centerLng * Math.PI) / 180;

    for (let i = 0; i < numVertices; i++) {
        const bearing = (2 * Math.PI * i) / numVertices;
        const lat2 = Math.asin(
            Math.sin(lat1) * Math.cos(d) +
            Math.cos(lat1) * Math.sin(d) * Math.cos(bearing)
        );
        const lng2 = lng1 + Math.atan2(
            Math.sin(bearing) * Math.sin(d) * Math.cos(lat1),
            Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
        );
        points.push([
            Number(((lat2 * 180) / Math.PI).toFixed(6)),
            Number(((lng2 * 180) / Math.PI).toFixed(6))
        ]);
    }
    return points;
}

export default function DeliveryZonesManager({ restaurantCode, onGoToSettings }: DeliveryZonesManagerProps) {
    const [zones, setZones] = useState<DeliveryZone[]>([]);
    const [loading, setLoading] = useState(true);
    const [restaurantCoords, setRestaurantCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [restaurantName, setRestaurantName] = useState<string>('Restaurant Kitchen');
    const [restaurantAddress, setRestaurantAddress] = useState<string>('');
    const [availableRestaurants, setAvailableRestaurants] = useState<AvailableRestaurant[]>([]);

    // Device GPS state
    const [userGpsCoords, setUserGpsCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
    const [isLocatingGps, setIsLocatingGps] = useState(false);
    const [nearestRestaurant, setNearestRestaurant] = useState<(AvailableRestaurant & { distanceKm: number }) | null>(null);

    // Quick-Draw GPS Modal state
    const [showGpsModal, setShowGpsModal] = useState(false);
    const [gpsCenterType, setGpsCenterType] = useState<'nearest_restaurant' | 'user_gps' | 'specific_restaurant'>('nearest_restaurant');
    const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>('');
    const [gpsRadiusKm, setGpsRadiusKm] = useState<number>(3);
    const [gpsPolygonSides, setGpsPolygonSides] = useState<number>(16);

    // Map drawing/editing state
    const [mode, setMode] = useState<'view' | 'drawing' | 'editing'>('view');
    const [draftPoints, setDraftPoints] = useState<[number, number][]>([]); // [lat, lng]
    const [selectedZone, setSelectedZone] = useState<DeliveryZone | null>(null);
    const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);
    const draftPointsRef = useRef<[number, number][]>([]);
    const selectedVertexRef = useRef<number | null>(null);
    draftPointsRef.current = draftPoints;
    selectedVertexRef.current = selectedVertexIndex;

    const handleUndoPoint = () => {
        if (draftPoints.length === 0) return;
        const next = draftPoints.slice(0, -1);
        setDraftPoints(next);
        draftPointsRef.current = next;
        setSelectedVertexIndex(null);
        toast.info('Removed last point.');
    };

    const handleDeleteSelectedPoint = () => {
        if (selectedVertexIndex === null) return;
        if (draftPoints.length <= 3) {
            toast.error('A delivery zone must have at least 3 points.');
            return;
        }
        const ptNum = selectedVertexIndex + 1;
        const next = draftPoints.filter((_, idx) => idx !== selectedVertexIndex);
        setDraftPoints(next);
        draftPointsRef.current = next;
        setSelectedVertexIndex(null);
        toast.info(`Deleted Point #${ptNum}.`);
    };

    // Form inputs for current zone
    const [formName, setFormName] = useState('');
    const [formFee, setFormFee] = useState<number>(40);
    const [formMinOrder, setFormMinOrder] = useState<number>(150);
    const [formEnabled, setFormEnabled] = useState(true);
    const [savingZone, setSavingZone] = useState(false);
    const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

    // Leaflet refs & state
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const [mapReady, setMapReady] = useState(false);
    const zoneLayersRef = useRef<Map<string, any>>(new Map());
    const draftPolygonLayerRef = useRef<any>(null);
    const draftMarkersRef = useRef<any[]>([]);
    const userGpsMarkerRef = useRef<any>(null);
    const gpsLineRef = useRef<any>(null);
    const restaurantMarkersRef = useRef<any[]>([]);
    const radiusCircleRef = useRef<any>(null);
    const dineInCircleRef = useRef<any>(null);
    const takeawayCircleRef = useRef<any>(null);
    const deliveryCircleRef = useRef<any>(null);
    const LRef = useRef<any>(null);

    // Radii & Radius Enforcement
    const [dineInRadiusKm, setDineInRadiusKm] = useState<number>(0.1);
    const [takeawayRadiusKm, setTakeawayRadiusKm] = useState<number>(0.5);
    const [restaurantDeliveryRadiusKm, setRestaurantDeliveryRadiusKm] = useState<number>(5.0);
    const [showRadiusRings, setShowRadiusRings] = useState<boolean>(true);
    const [radiusWarning, setRadiusWarning] = useState<string | null>(null);

    // Zone Filter in list (Requirement 2)
    const [zoneFilter, setZoneFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

    const handleFitAllZones = () => {
        const L = LRef.current;
        const map = mapInstanceRef.current;
        if (!L || !map) return;

        const allLatLngs: [number, number][] = [];
        if (restaurantCoords) {
            allLatLngs.push([restaurantCoords.lat, restaurantCoords.lng]);
        }
        zones.forEach(z => {
            if (z.geojson?.coordinates && z.geojson.coordinates[0]) {
                z.geojson.coordinates[0].forEach((pt) => {
                    if (pt && pt.length >= 2) {
                        allLatLngs.push([pt[1], pt[0]]);
                    }
                });
            }
        });

        if (allLatLngs.length > 0) {
            const bounds = L.latLngBounds(allLatLngs);
            map.fitBounds(bounds, { padding: [40, 40], animate: true });
            toast.info(`Framed all ${zones.length} delivery zone(s) on map.`);
        } else {
            toast.info('No zones to fit yet.');
        }
    };

    // Fetch zones & restaurant coordinates
    const fetchZones = useCallback(async () => {
        if (!restaurantCode) return;
        try {
            setLoading(true);
            // Fetch restaurant location for center and available restaurants
            const setRes = await fetch(`/api/delivery/settings?restaurantId=${restaurantCode}`);
            const setData = await setRes.json();
            if (setData.settings?.latitude != null && setData.settings?.longitude != null) {
                setRestaurantCoords({
                    lat: Number(setData.settings.latitude),
                    lng: Number(setData.settings.longitude),
                });
            } else if (Array.isArray(setData.availableRestaurants) && setData.availableRestaurants.length > 0 && setData.availableRestaurants[0].latitude != null) {
                setRestaurantCoords({
                    lat: Number(setData.availableRestaurants[0].latitude),
                    lng: Number(setData.availableRestaurants[0].longitude),
                });
            } else {
                setRestaurantCoords(null);
            }
            if (setData.settings?.restaurant_name) {
                setRestaurantName(setData.settings.restaurant_name);
            }
            if (setData.settings?.address) {
                setRestaurantAddress(setData.settings.address);
            } else {
                setRestaurantAddress('');
            }
            const resolvedRadius = Number(setData.settings?.delivery_order_radius ?? setData.settings?.max_delivery_radius_km ?? 5.0);
            setRestaurantDeliveryRadiusKm(resolvedRadius > 0 ? resolvedRadius : 5.0);
            const resolvedDineIn = Number(setData.settings?.dine_in_order_radius ?? setData.settings?.dine_in_takeaway_order_radius ?? 0.1);
            setDineInRadiusKm(resolvedDineIn > 0 ? resolvedDineIn : 0.1);
            const resolvedTakeaway = Number(setData.settings?.takeaway_order_radius ?? setData.settings?.dine_in_takeaway_order_radius ?? 0.5);
            setTakeawayRadiusKm(resolvedTakeaway > 0 ? resolvedTakeaway : 0.5);
            if (Array.isArray(setData.availableRestaurants) && setData.availableRestaurants.length > 0) {
                setAvailableRestaurants(setData.availableRestaurants);
                setSelectedRestaurantId(setData.availableRestaurants[0].id);
            } else {
                setAvailableRestaurants([]);
                setSelectedRestaurantId(restaurantCode);
            }

            // Fetch delivery zones
            const zonesRes = await fetch(`/api/delivery/zones?restaurantId=${restaurantCode}`);
            const zonesData = await zonesRes.json();
            if (zonesData.zones) {
                setZones(zonesData.zones);
            }
        } catch (err) {
            console.error('Failed to load delivery zones:', err);
            toast.error('Failed to load delivery zones');
        } finally {
            setLoading(false);
        }
    }, [restaurantCode]);

    useEffect(() => {
        fetchZones();
    }, [fetchZones]);

    // Initialize Leaflet Map
    useEffect(() => {
        if (loading || !mapContainerRef.current || mapInstanceRef.current) return;

        let isCancelled = false;

        import('leaflet').then((L) => {
            if (isCancelled || !mapContainerRef.current) return;
            LRef.current = L;

            // Ensure Leaflet CSS
            if (!document.getElementById('leaflet-css')) {
                const link = document.createElement('link');
                link.id = 'leaflet-css';
                link.rel = 'stylesheet';
                link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                document.head.appendChild(link);
            }

            const hasCoords = restaurantCoords?.lat != null && restaurantCoords?.lng != null;
            const initialLat = hasCoords ? restaurantCoords.lat : 20.5937;
            const initialLng = hasCoords ? restaurantCoords.lng : 78.9629;
            const initialZoom = hasCoords ? 13 : 5;

            const map = L.map(mapContainerRef.current, {
                center: [initialLat, initialLng],
                zoom: initialZoom,
                scrollWheelZoom: true,
            });

            // OpenStreetMap tile layer with attribution
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxZoom: 19,
            }).addTo(map);

            mapInstanceRef.current = map;
            setMapReady(true);

            setTimeout(() => {
                map.invalidateSize();
                renderRadiusCircles();
            }, 300);
        });

        return () => {
            isCancelled = true;
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
                setMapReady(false);
            }
        };
    }, [loading, restaurantCoords]);

    // Center map when restaurant coordinates become available
    useEffect(() => {
        if (!mapReady || !mapInstanceRef.current || !restaurantCoords) return;
        const map = mapInstanceRef.current;
        const currentCenter = map.getCenter();
        const dist = Math.abs(currentCenter.lat - restaurantCoords.lat) + Math.abs(currentCenter.lng - restaurantCoords.lng);
        // If map was at default center or coordinates changed significantly, center to restaurant
        if (dist > 0.05) {
            map.setView([restaurantCoords.lat, restaurantCoords.lng], 13);
        }
    }, [mapReady, restaurantCoords]);

    // Render POI Pins (Restaurants & User GPS Beacon) on Map
    useEffect(() => {
        const L = LRef.current;
        const map = mapInstanceRef.current;
        if (!L || !map || !mapReady) return;

        // Clear existing restaurant markers
        restaurantMarkersRef.current.forEach(m => map.removeLayer(m));
        restaurantMarkersRef.current = [];

        // Clear GPS line and user marker
        if (userGpsMarkerRef.current) {
            map.removeLayer(userGpsMarkerRef.current);
            userGpsMarkerRef.current = null;
        }
        if (gpsLineRef.current) {
            map.removeLayer(gpsLineRef.current);
            gpsLineRef.current = null;
        }

        // Render restaurant pins
        const listToRender: AvailableRestaurant[] = availableRestaurants.length > 0
            ? availableRestaurants
            : (restaurantCoords ? [{ id: restaurantCode, name: restaurantName, latitude: restaurantCoords.lat, longitude: restaurantCoords.lng, address: '' }] : []);

        listToRender.forEach((rest) => {
            const isMain = rest.id === restaurantCode;
            const customIcon = L.divIcon({
                className: 'custom-restaurant-pin',
                html: `
                    <div style="
                        width: 34px;
                        height: 34px;
                        background: ${isMain ? 'linear-gradient(135deg, #f97316, #ea580c)' : 'linear-gradient(135deg, #6366f1, #4f46e5)'};
                        border-radius: 50% 50% 50% 0;
                        transform: rotate(-45deg);
                        box-shadow: 0 4px 12px ${isMain ? 'rgba(234, 88, 12, 0.45)' : 'rgba(79, 70, 229, 0.45)'};
                        border: 2px solid white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        cursor: pointer;
                    ">
                        <div style="transform: rotate(45deg); color: white; font-weight: 900; font-size: 15px;">
                            ${isMain ? '🍴' : '🏬'}
                        </div>
                    </div>
                `,
                iconSize: [34, 34],
                iconAnchor: [17, 34],
            });

            const marker = L.marker([rest.latitude, rest.longitude], { icon: customIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="font-family: inherit; padding: 4px;">
                        <b style="font-size: 13px; color: #111827;">${rest.name}</b>
                        <div style="font-size: 11px; color: #6b7280; margin-top: 2px;">${rest.address || 'Restaurant Dispatch Origin'}</div>
                        <div style="font-size: 10px; font-mono; color: #9ca3af; margin-top: 4px;">Coords: ${rest.latitude.toFixed(4)}, ${rest.longitude.toFixed(4)}</div>
                        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #e5e7eb; font-size: 11px; display: flex; flex-direction: column; gap: 3px;">
                            <span style="color: #2563eb; font-weight: bold;">🍽️ Dine-In: ${dineInRadiusKm < 1 ? Math.round(dineInRadiusKm * 1000) + 'm' : dineInRadiusKm + 'km'}</span>
                            <span style="color: #d97706; font-weight: bold;">🛍️ Takeaway: ${takeawayRadiusKm < 1 ? Math.round(takeawayRadiusKm * 1000) + 'm' : takeawayRadiusKm + 'km'}</span>
                            <span style="color: #ea580c; font-weight: bold;">🛵 Delivery: ${restaurantDeliveryRadiusKm} km</span>
                        </div>
                    </div>
                `);

            restaurantMarkersRef.current.push(marker);
        });

        // Render User GPS Marker if active
        if (userGpsCoords) {
            const gpsIcon = L.divIcon({
                className: 'custom-gps-user-pin',
                html: `
                    <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
                        <div style="position: absolute; width: 30px; height: 30px; background: rgba(37, 99, 235, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                        <div style="width: 14px; height: 14px; background: #2563eb; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.35); z-index: 10;"></div>
                    </div>
                `,
                iconSize: [30, 30],
                iconAnchor: [15, 15],
            });

            const userMarker = L.marker([userGpsCoords.lat, userGpsCoords.lng], { icon: gpsIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="font-family: inherit; padding: 4px;">
                        <b style="font-size: 13px; color: #1e40af;">📍 Your Current Location (GPS)</b>
                        <div style="font-size: 11px; color: #4b5563; margin-top: 2px;">
                            ${nearestRestaurant ? `Nearest: <b>${nearestRestaurant.name}</b> (${nearestRestaurant.distanceKm < 1 ? Math.round(nearestRestaurant.distanceKm * 1000) + 'm' : nearestRestaurant.distanceKm + 'km'} away)` : 'GPS position locked'}
                        </div>
                    </div>
                `);
            userGpsMarkerRef.current = userMarker;

            // Render connecting line to nearest restaurant
            if (nearestRestaurant) {
                const line = L.polyline(
                    [[userGpsCoords.lat, userGpsCoords.lng], [nearestRestaurant.latitude, nearestRestaurant.longitude]],
                    {
                        color: '#2563eb',
                        weight: 2,
                        dashArray: '5, 5',
                        opacity: 0.75,
                    }
                ).addTo(map);

                line.bindTooltip(`Distance: ${nearestRestaurant.distanceKm} km`, {
                    permanent: true,
                    direction: 'center',
                });
                gpsLineRef.current = line;
            }
        }
    }, [mapReady, availableRestaurants, restaurantCoords, restaurantName, userGpsCoords, nearestRestaurant, restaurantCode, dineInRadiusKm, takeawayRadiusKm, restaurantDeliveryRadiusKm]);

    // Render Saved Delivery Zones on Map
    const renderZonesOnMap = useCallback(() => {
        const L = LRef.current;
        const map = mapInstanceRef.current;
        if (!L || !map) return;

        // Clear existing zone layers
        zoneLayersRef.current.forEach((layer) => {
            map.removeLayer(layer);
        });
        zoneLayersRef.current.clear();

        // Render each zone (both active and disabled prominently highlighted)
        // NOTE: Disabled zones are rendered in solid black color per requirement!
        zones.forEach((zone, idx) => {
            if (!zone.geojson?.coordinates || !zone.geojson.coordinates[0]) return;

            // In GeoJSON, coords are [lng, lat]. In Leaflet, coords are [lat, lng].
            const latlngs: [number, number][] = zone.geojson.coordinates[0].map(([lng, lat]) => [lat, lng]);
            const colorScheme = ZONE_COLORS[idx % ZONE_COLORS.length];
            const isEnabled = zone.enabled;

            // Disabled zones: bold solid black border (#000000) & black fill (#000000) with 0.35 opacity and dashed pattern
            // Enabled zones: vibrant color scheme with 0.28 fill opacity
            const initialWeight = isEnabled ? 3 : 3.5;
            const initialOpacity = isEnabled ? 0.28 : 0.35;
            const strokeColor = isEnabled ? colorScheme.stroke : '#000000';
            const fillColor = isEnabled ? colorScheme.fill : '#000000';

            const polygon = L.polygon(latlngs, {
                color: strokeColor,
                fillColor: fillColor,
                fillOpacity: initialOpacity,
                weight: initialWeight,
                dashArray: isEnabled ? undefined : '6, 6',
            }).addTo(map);

            // Interactive hover highlight: Increase opacity and weight so users can clearly see zone boundaries
            polygon.on('mouseover', () => {
                polygon.setStyle({
                    fillOpacity: isEnabled ? 0.52 : 0.58,
                    weight: isEnabled ? 4.5 : 5,
                });
            });

            polygon.on('mouseout', () => {
                polygon.setStyle({
                    fillOpacity: initialOpacity,
                    weight: initialWeight,
                });
            });

            // Tooltip clearly highlighting zone name, status, delivery fee, and minimum order
            polygon.bindTooltip(`
                <div style="font-family: inherit; font-size: 12px; font-weight: bold; padding: 4px 6px;">
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 3px;">
                        <span style="font-size: 13px; color: ${isEnabled ? '#111827' : '#000000'}; font-weight: 800;">${zone.name}</span>
                        <span style="font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px; ${
                            isEnabled
                                ? 'background: #dcfce7; color: #15803d; border: 1px solid #86efac;'
                                : 'background: #000000; color: #ffffff; border: 1px solid #333333;'
                        }">
                            ${isEnabled ? '🟢 ACTIVE' : '⚫ DISABLED'}
                        </span>
                    </div>
                    <div style="font-size: 11px; font-weight: 500; color: ${isEnabled ? '#4b5563' : '#374151'};">
                        Delivery Fee: <b>₹${zone.deliveryFee}</b> • Min Order: <b>₹${zone.minimumOrderAmount}</b>
                    </div>
                    <div style="font-size: 10px; color: #6366f1; margin-top: 3px;">
                        Click zone to select & edit
                    </div>
                </div>
            `, { permanent: false, direction: 'center' });

            polygon.on('click', () => {
                handleSelectZoneForEdit(zone);
            });

            zoneLayersRef.current.set(zone.id, polygon);
        });
    }, [zones]);

    useEffect(() => {
        if (!loading && mapReady && mapInstanceRef.current) {
            renderZonesOnMap();
        }
    }, [mapReady, zones, loading, renderZonesOnMap]);

    // Render/Remove restaurant service radius circles: Dine-In, Takeaway, and Delivery (Always visible with distinct colors)
    const renderRadiusCircles = useCallback(() => {
        const L = LRef.current;
        const map = mapInstanceRef.current;
        if (!L || !map) return;

        // Clean up previous circles
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
        if (radiusCircleRef.current) {
            map.removeLayer(radiusCircleRef.current);
            radiusCircleRef.current = null;
        }

        // Always show all 3 service radii if restaurant coordinates are available and showRadiusRings is enabled
        if (restaurantCoords?.lat != null && restaurantCoords?.lng != null && showRadiusRings) {
            const center: [number, number] = [restaurantCoords.lat, restaurantCoords.lng];

            // 1. DELIVERY RADIUS CIRCLE (Vibrant Deep Orange / Coral)
            const resolvedDelivKm = Number(restaurantDeliveryRadiusKm) > 0 ? Number(restaurantDeliveryRadiusKm) : 5.0;
            const delivRadiusMeters = Math.round(resolvedDelivKm * 1000);
            const delivCircle = L.circle(center, {
                radius: delivRadiusMeters,
                color: '#ea580c', // Bright orange boundary line
                weight: 2.5,
                dashArray: '8, 8',
                fillColor: '#f97316',
                fillOpacity: 0.07,
                interactive: false, // Click-through so drawing & zone selection work seamlessly
            }).addTo(map);

            delivCircle.bindTooltip(`🛵 Delivery Radius: ${resolvedDelivKm} km`, {
                permanent: false,
                direction: 'top',
                className: 'font-sans font-bold text-xs',
            });
            deliveryCircleRef.current = delivCircle;
            radiusCircleRef.current = delivCircle;

            // 2. TAKEAWAY RADIUS CIRCLE (Warm Amber / Ochre)
            const resolvedTakeawayKm = Number(takeawayRadiusKm) > 0 ? Number(takeawayRadiusKm) : 0.5;
            const takeawayRadiusMeters = Math.max(20, Math.round(resolvedTakeawayKm * 1000));
            const takeawayCircle = L.circle(center, {
                radius: takeawayRadiusMeters,
                color: '#d97706', // Amber 600
                weight: 2,
                dashArray: '5, 5',
                fillColor: '#f59e0b',
                fillOpacity: 0.14,
                interactive: false,
            }).addTo(map);

            takeawayCircle.bindTooltip(`🛍️ Takeaway Radius: ${resolvedTakeawayKm < 1 ? `${Math.round(resolvedTakeawayKm * 1000)}m` : `${resolvedTakeawayKm}km`}`, {
                permanent: false,
                direction: 'top',
                className: 'font-sans font-bold text-xs',
            });
            takeawayCircleRef.current = takeawayCircle;

            // 3. DINE-IN RADIUS CIRCLE (Royal Blue)
            const resolvedDineInKm = Number(dineInRadiusKm) > 0 ? Number(dineInRadiusKm) : 0.1;
            const dineRadiusMeters = Math.max(10, Math.round(resolvedDineInKm * 1000));
            const dineCircle = L.circle(center, {
                radius: dineRadiusMeters,
                color: '#2563eb', // Royal Blue 600
                weight: 2,
                dashArray: '4, 4',
                fillColor: '#3b82f6',
                fillOpacity: 0.22,
                interactive: false,
            }).addTo(map);

            dineCircle.bindTooltip(`🍽️ Dine-In Radius: ${resolvedDineInKm < 1 ? `${Math.round(resolvedDineInKm * 1000)}m` : `${resolvedDineInKm}km`}`, {
                permanent: false,
                direction: 'top',
                className: 'font-sans font-bold text-xs',
            });
            dineInCircleRef.current = dineCircle;
        }
    }, [restaurantCoords, showRadiusRings, restaurantDeliveryRadiusKm, dineInRadiusKm, takeawayRadiusKm]);

    useEffect(() => {
        if (mapReady) {
            renderRadiusCircles();
        }
        return () => {
            const map = mapInstanceRef.current;
            if (map) {
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
                if (radiusCircleRef.current) {
                    map.removeLayer(radiusCircleRef.current);
                    radiusCircleRef.current = null;
                }
            }
        };
    }, [mapReady, renderRadiusCircles]);

    // Handle Map Clicks during Freehand Drawing or Vertex Relocation
    useEffect(() => {
        const map = mapInstanceRef.current;
        const L = LRef.current;
        if (!map || !L || !mapReady) return;

        const handleMapClick = (e: any) => {
            const clickLat = Number(e.latlng.lat.toFixed(6));
            const clickLng = Number(e.latlng.lng.toFixed(6));

            // Normal map tap: do nothing unless drawing or editing a delivery zone
            if (mode !== 'drawing' && mode !== 'editing') return;
            const newPt: [number, number] = [clickLat, clickLng];

            // 1. If a vertex is currently selected -> Move that vertex to tapped location!
            if (selectedVertexRef.current !== null) {
                const targetIdx = selectedVertexRef.current;

                // Prevent moving point outside restaurant delivery radius
                if (restaurantCoords) {
                    const distFromRest = calculateDistanceKm(restaurantCoords.lat, restaurantCoords.lng, clickLat, clickLng);
                    if (distFromRest > restaurantDeliveryRadiusKm) {
                        toast.error(`❌ Point is outside restaurant delivery radius (${distFromRest} km > ${restaurantDeliveryRadiusKm} km). All boundary points must stay inside the orange radius circle.`);
                        return;
                    }
                }

                const updated = [...draftPointsRef.current];
                updated[targetIdx] = newPt;
                draftPointsRef.current = updated;
                setDraftPoints(updated);
                toast.success(`✓ Point #${targetIdx + 1} moved to tapped position!`);
                return;
            }

            // 2. If in drawing mode -> Add new point to polygon
            if (mode === 'drawing') {
                if (restaurantCoords) {
                    const distFromRest = calculateDistanceKm(restaurantCoords.lat, restaurantCoords.lng, clickLat, clickLng);
                    if (distFromRest > restaurantDeliveryRadiusKm) {
                        toast.error(`❌ Point is outside restaurant delivery radius (${distFromRest} km > ${restaurantDeliveryRadiusKm} km). All boundary points must stay inside the orange radius circle.`);
                        setRadiusWarning(`Point at ${distFromRest} km exceeds the ${restaurantDeliveryRadiusKm} km delivery radius.`);
                        return;
                    }
                }

                setRadiusWarning(null);
                const updated = [...draftPointsRef.current, newPt];
                draftPointsRef.current = updated;
                setDraftPoints(updated);
                return;
            }

            // 3. In editing mode: clicking empty space deselects any active vertex
            if (mode === 'editing') {
                setSelectedVertexIndex(null);
            }
        };

        map.on('click', handleMapClick);
        return () => {
            map.off('click', handleMapClick);
        };
    }, [mapReady, mode, restaurantCoords, restaurantDeliveryRadiusKm]);

    // Update Draft Polygon and Draggable Vertex Markers
    useEffect(() => {
        const L = LRef.current;
        const map = mapInstanceRef.current;
        if (!L || !map || !mapReady) return;

        // Clear previous draft markers
        draftMarkersRef.current.forEach(m => map.removeLayer(m));
        draftMarkersRef.current = [];

        // Clear previous draft polygon layer
        if (draftPolygonLayerRef.current) {
            map.removeLayer(draftPolygonLayerRef.current);
            draftPolygonLayerRef.current = null;
        }

        if (draftPoints.length === 0) return;

        // Check if any point exceeds delivery radius
        let anyPointOutOfRadius = false;
        if (restaurantCoords) {
            const outOfRadiusPts = draftPoints.filter(pt => calculateDistanceKm(restaurantCoords.lat, restaurantCoords.lng, pt[0], pt[1]) > restaurantDeliveryRadiusKm);
            if (outOfRadiusPts.length > 0) {
                anyPointOutOfRadius = true;
                const maxDist = Math.max(...draftPoints.map(pt => calculateDistanceKm(restaurantCoords.lat, restaurantCoords.lng, pt[0], pt[1])));
                setRadiusWarning(`⚠️ ${outOfRadiusPts.length} boundary point(s) extend beyond the ${restaurantDeliveryRadiusKm} km delivery radius (furthest is ${maxDist} km). All vertices must be inside the orange circle.`);
            } else {
                setRadiusWarning(null);
            }
        }

        // Add draggable vertex markers in both drawing and editing modes
        draftPoints.forEach((point, index) => {
            const isFirst = index === 0;
            const isSelected = selectedVertexIndex === index;
            const distFromRest = restaurantCoords ? calculateDistanceKm(restaurantCoords.lat, restaurantCoords.lng, point[0], point[1]) : 0;
            const isOutOfRadius = restaurantCoords ? distFromRest > restaurantDeliveryRadiusKm : false;

            const bgColor = isOutOfRadius 
                ? '#ef4444' 
                : isSelected 
                ? '#2563eb' 
                : isFirst 
                ? '#10b981' 
                : '#f97316';

            const size = isSelected ? 28 : 22;
            const halfSize = size / 2;

            const markerIcon = L.divIcon({
                className: 'custom-draft-vertex',
                html: `
                    <div style="
                        width: ${size}px;
                        height: ${size}px;
                        background: ${bgColor};
                        border: ${isSelected ? '3px solid white' : '2px solid white'};
                        border-radius: 50%;
                        box-shadow: ${isSelected ? '0 0 0 4px #3b82f6, 0 4px 14px rgba(37,99,235,0.6)' : '0 2px 8px rgba(0,0,0,0.35)'};
                        cursor: grab;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: ${isSelected ? '12px' : '10px'};
                        font-weight: 900;
                        color: white;
                        user-select: none;
                        -webkit-user-select: none;
                        touch-action: none;
                        transition: transform 0.15s ease, box-shadow 0.15s ease;
                    ">
                        ${index + 1}
                    </div>
                `,
                iconSize: [size, size],
                iconAnchor: [halfSize, halfSize],
            });

            const marker = L.marker(point, {
                icon: markerIcon,
                draggable: true, // ALWAYS draggable in both drawing & editing modes!
                autoPan: true,
            }).addTo(map);

            if (isOutOfRadius) {
                marker.bindTooltip(`⚠️ Point ${index + 1} (${distFromRest} km) is OUTSIDE delivery radius (${restaurantDeliveryRadiusKm} km)!`, { permanent: true, direction: 'top' });
            } else if (isSelected) {
                marker.bindTooltip(`📍 Point ${index + 1} Selected • Tap anywhere on map to move here, or drag pin`, { permanent: true, direction: 'top' });
            } else if (mode === 'drawing' && isFirst && draftPoints.length >= 3) {
                marker.bindTooltip('Click to close & finish polygon (or tap to select/move)', { permanent: false, direction: 'top' });
            }

            // Click / Tap on marker to select, deselect, or close polygon
            marker.on('click', (e: any) => {
                L.DomEvent.stopPropagation(e);
                if (mode === 'drawing' && isFirst && draftPoints.length >= 3 && selectedVertexIndex !== 0) {
                    handleFinishDrawing();
                    return;
                }
                setSelectedVertexIndex(prev => {
                    const next = prev === index ? null : index;
                    if (next !== null) {
                        toast.info(`📍 Point #${index + 1} selected! Tap anywhere inside the orange circle to move it, or drag it.`);
                    }
                    return next;
                });
            });

            // Smooth Real-time Dragging: Update polygon on the fly without tearing down React DOM
            marker.on('dragstart', (e: any) => {
                L.DomEvent.stopPropagation(e);
            });

            marker.on('drag', (e: any) => {
                const newPos = e.target.getLatLng();
                const curPts = [...draftPointsRef.current];
                curPts[index] = [newPos.lat, newPos.lng];
                draftPointsRef.current = curPts;

                // Update polygon shape in Leaflet directly without tearing down markers
                if (draftPolygonLayerRef.current) {
                    draftPolygonLayerRef.current.setLatLngs(curPts);
                }

                // Check radius in real-time
                if (restaurantCoords) {
                    const d = calculateDistanceKm(restaurantCoords.lat, restaurantCoords.lng, newPos.lat, newPos.lng);
                    const out = d > restaurantDeliveryRadiusKm;
                    if (draftPolygonLayerRef.current) {
                        draftPolygonLayerRef.current.setStyle({
                            color: out ? '#ef4444' : '#2563eb',
                            fillColor: out ? '#f87171' : '#3b82f6',
                        });
                    }
                }
            });

            marker.on('dragend', (e: any) => {
                const newPos = e.target.getLatLng();
                const lat = Number(newPos.lat.toFixed(6));
                const lng = Number(newPos.lng.toFixed(6));
                const curPts = [...draftPointsRef.current];
                curPts[index] = [lat, lng];
                draftPointsRef.current = curPts;

                if (restaurantCoords) {
                    const dist = calculateDistanceKm(restaurantCoords.lat, restaurantCoords.lng, lat, lng);
                    if (dist > restaurantDeliveryRadiusKm) {
                        toast.warning(`⚠️ Point #${index + 1} (${dist} km) is outside delivery radius (${restaurantDeliveryRadiusKm} km). All points must stay inside the circle.`);
                    }
                }

                setDraftPoints([...curPts]);
            });

            draftMarkersRef.current.push(marker);

            // ── Delete button for each vertex (only when > 3 points) ──
            if (draftPoints.length > 3) {
                const deleteIcon = L.divIcon({
                    className: 'custom-vertex-delete',
                    html: `
                        <div style="
                            width: 18px;
                            height: 18px;
                            background: #ef4444;
                            border: 1.5px solid white;
                            border-radius: 50%;
                            box-shadow: 0 2px 6px rgba(239,68,68,0.5);
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            font-size: 11px;
                            font-weight: 900;
                            color: white;
                            user-select: none;
                            -webkit-user-select: none;
                            line-height: 1;
                        ">✕</div>
                    `,
                    iconSize: [18, 18],
                    iconAnchor: [-2, 20], // offset to top-right of vertex pin
                });

                const deleteMarker = L.marker(point, {
                    icon: deleteIcon,
                    draggable: false,
                    interactive: true,
                    zIndexOffset: 1000,
                }).addTo(map);

                deleteMarker.on('click', (e: any) => {
                    L.DomEvent.stopPropagation(e);
                    const curPts = draftPointsRef.current;
                    if (curPts.length <= 3) {
                        toast.error('A delivery zone must have at least 3 points.');
                        return;
                    }
                    const ptNum = index + 1;
                    const next = curPts.filter((_: any, idx: number) => idx !== index);
                    draftPointsRef.current = next;
                    setDraftPoints(next);
                    // Adjust selectedVertexIndex if needed
                    if (selectedVertexIndex !== null) {
                        if (selectedVertexIndex === index) {
                            setSelectedVertexIndex(null);
                        } else if (selectedVertexIndex > index) {
                            setSelectedVertexIndex(selectedVertexIndex - 1);
                        }
                    }
                    toast.info(`🗑️ Deleted Point #${ptNum}`);
                });

                draftMarkersRef.current.push(deleteMarker);
            }
        });

        // Draw polygon or polyline connecting the points
        const polygonColor = anyPointOutOfRadius ? '#ef4444' : '#2563eb';
        const polygonFill = anyPointOutOfRadius ? '#f87171' : '#3b82f6';

        if (draftPoints.length >= 3) {
            draftPolygonLayerRef.current = L.polygon(draftPoints, {
                color: polygonColor,
                fillColor: polygonFill,
                fillOpacity: anyPointOutOfRadius ? 0.35 : 0.28,
                weight: 2.5,
                dashArray: '4, 4',
            }).addTo(map);
        } else if (draftPoints.length === 2) {
            draftPolygonLayerRef.current = L.polyline(draftPoints, {
                color: polygonColor,
                weight: 2,
                dashArray: '4, 4',
            }).addTo(map);
        }
    }, [mapReady, draftPoints, selectedVertexIndex, mode, restaurantCoords, restaurantDeliveryRadiusKm]);

    // Locate Device GPS and Find Nearest Restaurant
    const handleLocateDeviceGps = useCallback(() => {
        if (!navigator.geolocation) {
            toast.error('Geolocation is not supported by your browser.');
            return;
        }

        setIsLocatingGps(true);
        toast.info('Acquiring device GPS position...');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setIsLocatingGps(false);
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                setUserGpsCoords({ lat: userLat, lng: userLng, accuracy });

                // Find nearest restaurant
                const allRests: AvailableRestaurant[] = [...availableRestaurants];
                if (restaurantCoords && !allRests.some(r => r.latitude === restaurantCoords.lat && r.longitude === restaurantCoords.lng)) {
                    allRests.push({
                        id: restaurantCode,
                        name: restaurantName || 'Current Restaurant',
                        address: '',
                        latitude: restaurantCoords.lat,
                        longitude: restaurantCoords.lng,
                    });
                }

                let nearest: (AvailableRestaurant & { distanceKm: number }) | null = null;
                if (allRests.length > 0) {
                    const withDist = allRests.map(r => ({
                        ...r,
                        distanceKm: calculateDistanceKm(userLat, userLng, r.latitude, r.longitude),
                    }));
                    withDist.sort((a, b) => a.distanceKm - b.distanceKm);
                    nearest = withDist[0];
                    setNearestRestaurant(nearest);
                    setSelectedRestaurantId(nearest.id);
                }

                // Pan or fit map
                const map = mapInstanceRef.current;
                const L = LRef.current;
                if (map && L) {
                    if (nearest) {
                        const bounds = L.latLngBounds([
                            [userLat, userLng],
                            [nearest.latitude, nearest.longitude]
                        ]);
                        map.fitBounds(bounds, { padding: [70, 70], maxZoom: 16 });
                    } else {
                        map.setView([userLat, userLng], 15);
                    }
                }

                if (nearest) {
                    const distLabel = nearest.distanceKm < 1
                        ? `${Math.round(nearest.distanceKm * 1000)} meters`
                        : `${nearest.distanceKm} km`;
                    toast.success(`📍 GPS locked! Nearest restaurant is "${nearest.name}" (${distLabel} away).`);
                } else {
                    toast.success(`📍 GPS location acquired: ${userLat.toFixed(4)}, ${userLng.toFixed(4)}`);
                }
            },
            (error) => {
                setIsLocatingGps(false);
                console.warn('GPS location error:', error);
                if (error.code === error.PERMISSION_DENIED) {
                    toast.error('Location permission was denied. Please allow location access in your browser.');
                } else {
                    toast.error('Failed to acquire GPS location. Using restaurant coordinates.');
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000,
            }
        );
    }, [availableRestaurants, restaurantCoords, restaurantCode, restaurantName]);

    // Center Map & Show Restaurant Location
    const handleCenterOnRestaurant = () => {
        const target = (restaurantCoords ? { latitude: restaurantCoords.lat, longitude: restaurantCoords.lng, name: restaurantName } : null) 
            || (availableRestaurants.find(r => r.id === restaurantCode) ? availableRestaurants.find(r => r.id === restaurantCode) : null)
            || (availableRestaurants[0] ? availableRestaurants[0] : null);

        if (!target || target.latitude == null || target.longitude == null) {
            toast.warning('Restaurant location not set yet. Click "Set Restaurant Location via GPS" to pin your restaurant.');
            return;
        }

        const map = mapInstanceRef.current;
        if (map) {
            map.flyTo([target.latitude, target.longitude], 16, { duration: 1.2 });
            const marker = restaurantMarkersRef.current.find(m => {
                const ll = m.getLatLng?.();
                if (!ll) return false;
                return Math.abs(ll.lat - target.latitude) < 0.0001 && Math.abs(ll.lng - target.longitude) < 0.0001;
            }) || restaurantMarkersRef.current[0];

            if (marker) {
                marker.openPopup();
            }
            toast.info(`Showing restaurant location: ${target.name || 'Restaurant'}`);
        }
    };

    // Generate Delivery Zone from Nearest Restaurant or GPS Location
    const handleGenerateZoneFromGps = async () => {
        let centerLat: number | null = null;
        let centerLng: number | null = null;
        let centerLabel = '';

        if (gpsCenterType === 'user_gps') {
            if (!userGpsCoords) {
                toast.error('Device GPS coordinates not acquired yet. Please click "Locate GPS" first.');
                return;
            }
            centerLat = userGpsCoords.lat;
            centerLng = userGpsCoords.lng;
            centerLabel = 'Device GPS';
        } else if (gpsCenterType === 'specific_restaurant' && selectedRestaurantId) {
            const found = availableRestaurants.find(r => r.id === selectedRestaurantId);
            if (found) {
                centerLat = found.latitude;
                centerLng = found.longitude;
                centerLabel = found.name;
            }
        }

        // Default or nearest restaurant: PRIORITIZE restaurantCoords
        if (centerLat == null || centerLng == null) {
            if (restaurantCoords) {
                centerLat = restaurantCoords.lat;
                centerLng = restaurantCoords.lng;
                centerLabel = restaurantName || 'Restaurant Kitchen';
            } else if (nearestRestaurant) {
                centerLat = nearestRestaurant.latitude;
                centerLng = nearestRestaurant.longitude;
                centerLabel = nearestRestaurant.name;
            } else if (availableRestaurants.length > 0) {
                centerLat = availableRestaurants[0].latitude;
                centerLng = availableRestaurants[0].longitude;
                centerLabel = availableRestaurants[0].name;
            }
        }

        if (centerLat == null || centerLng == null) {
            toast.error('No restaurant coordinates found. Please set your restaurant location first using GPS.');
            return;
        }

        const radius = Number(gpsRadiusKm) || 3;
        if (radius > restaurantDeliveryRadiusKm) {
            toast.error(`❌ Zone radius (${radius} km) cannot exceed the restaurant delivery radius (${restaurantDeliveryRadiusKm} km). Please choose a smaller radius.`);
            return;
        }
        const sides = Number(gpsPolygonSides) || 16;

        // Generate geodesic polygon points
        const points = generateGeodesicPolygon(centerLat, centerLng, radius, sides);

        setSelectedZone(null);
        setSelectedVertexIndex(null);
        setDraftPoints(points);
        draftPointsRef.current = points;
        setFormName(`${centerLabel} - ${radius}km Zone`);

        // Smart tiered pricing suggestions
        if (radius <= 2) {
            setFormFee(25);
            setFormMinOrder(100);
        } else if (radius <= 4) {
            setFormFee(40);
            setFormMinOrder(150);
        } else if (radius <= 7) {
            setFormFee(60);
            setFormMinOrder(250);
        } else {
            setFormFee(85);
            setFormMinOrder(350);
        }

        setFormEnabled(true);
        setOverlapWarning(null);
        setRadiusWarning(null);
        setMode('editing');
        setShowGpsModal(false);

        // Fit map bounds to generated polygon
        const map = mapInstanceRef.current;
        const L = LRef.current;
        if (map && L) {
            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [50, 50] });
        }

        toast.success(`⚡ Generated ${radius} km delivery zone around ${centerLabel}! Review details and click "Save Delivery Zone".`);
    };

    // Start Freehand Drawing Mode
    const handleStartDrawing = () => {
        if (!restaurantCoords) {
            toast.error('Please configure restaurant location first in Settings before creating zones.');
            if (onGoToSettings) onGoToSettings();
            return;
        }
        setSelectedZone(null);
        setSelectedVertexIndex(null);
        setDraftPoints([]);
        draftPointsRef.current = [];
        setFormName(`Zone ${zones.length + 1}`);
        setFormFee(40);
        setFormMinOrder(150);
        setFormEnabled(true);
        setOverlapWarning(null);
        setRadiusWarning(null);
        setMode('drawing');

        // Zoom map to fit the delivery radius circle
        if (mapInstanceRef.current && LRef.current) {
            const radiusMeters = restaurantDeliveryRadiusKm * 1000;
            const bounds = LRef.current.latLng(restaurantCoords.lat, restaurantCoords.lng).toBounds(radiusMeters * 2);
            mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30] });
        }

        toast.info(`Click anywhere inside the ${restaurantDeliveryRadiusKm} km orange circle to place boundary points. Place at least 3 points.`);
    };

    const handleOpenQuickDraw = () => {
        if (!restaurantCoords) {
            toast.error('Please configure restaurant location first in Settings before creating zones.');
            if (onGoToSettings) onGoToSettings();
            return;
        }
        setShowGpsModal(true);
    };


    // Finish Drawing
    const handleFinishDrawing = () => {
        if (draftPoints.length < 3) {
            toast.error('A delivery zone requires at least 3 boundary points.');
            return;
        }

        if (isPolygonSelfIntersecting(draftPoints)) {
            toast.error('The drawn polygon is self-intersecting. Please adjust boundary points to form a simple shape.');
            return;
        }

        // Validate boundary points stay within delivery radius
        if (restaurantCoords) {
            const outOfRadiusPoints = draftPoints.filter(pt => calculateDistanceKm(restaurantCoords.lat, restaurantCoords.lng, pt[0], pt[1]) > restaurantDeliveryRadiusKm);
            if (outOfRadiusPoints.length > 0) {
                const maxDist = Math.max(...draftPoints.map(pt => calculateDistanceKm(restaurantCoords.lat, restaurantCoords.lng, pt[0], pt[1])));
                toast.error(`❌ Zone boundary extends outside the restaurant delivery radius (${maxDist} km > ${restaurantDeliveryRadiusKm} km). All boundary points must stay inside the orange circle.`);
                setRadiusWarning(`Cannot complete zone: ${outOfRadiusPoints.length} point(s) lie outside the ${restaurantDeliveryRadiusKm} km delivery radius.`);
                return; // DO NOT ACCEPT!
            }
        }

        setRadiusWarning(null);
        setMode('editing');
        toast.success('Boundary defined! Now review details and save zone.');
    };

    // Select Existing Zone for Edit
    const handleSelectZoneForEdit = (zone: DeliveryZone) => {
        setSelectedZone(zone);
        setSelectedVertexIndex(null);
        setFormName(zone.name);
        setFormFee(zone.deliveryFee);
        setFormMinOrder(zone.minimumOrderAmount);
        setFormEnabled(zone.enabled);
        setOverlapWarning(null);
        setRadiusWarning(null);

        // Convert GeoJSON to Leaflet [lat, lng]
        if (zone.geojson?.coordinates?.[0]) {
            const pts: [number, number][] = zone.geojson.coordinates[0]
                .slice(0, -1)
                .map(([lng, lat]) => [lat, lng]);
            setDraftPoints(pts);
            draftPointsRef.current = pts;

            // Pan map to zone
            if (mapInstanceRef.current && pts.length > 0) {
                const L = LRef.current;
                if (L) {
                    const bounds = L.latLngBounds(pts);
                    mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
                }
            }
        }

        setMode('editing');
    };

    // Cancel Drawing or Edit
    const handleCancel = () => {
        setMode('view');
        setDraftPoints([]);
        draftPointsRef.current = [];
        setSelectedZone(null);
        setSelectedVertexIndex(null);
        setOverlapWarning(null);
        setRadiusWarning(null);
    };

    // Save Zone (Create or Update)
    const handleSaveZone = async (forceAllowOverlap = false) => {
        if (!formName.trim()) {
            toast.error('Zone name is required');
            return;
        }

        if (draftPoints.length < 3) {
            toast.error('A polygon requires at least 3 vertices');
            return;
        }

        if (isPolygonSelfIntersecting(draftPoints)) {
            toast.error('The polygon boundary is self-intersecting. Please reposition vertex handles to form a valid non-overlapping boundary.');
            return;
        }

        // Validate that NO point extends beyond restaurant delivery radius
        if (restaurantCoords) {
            const outOfRadius = draftPoints.filter(pt => calculateDistanceKm(restaurantCoords.lat, restaurantCoords.lng, pt[0], pt[1]) > restaurantDeliveryRadiusKm);
            if (outOfRadius.length > 0) {
                const maxDist = Math.max(...draftPoints.map(pt => calculateDistanceKm(restaurantCoords.lat, restaurantCoords.lng, pt[0], pt[1])));
                toast.error(`❌ Cannot save zone: Zone boundary extends outside the restaurant delivery radius (${maxDist} km > ${restaurantDeliveryRadiusKm} km). All zones must be contained within the delivery radius circle.`);
                setRadiusWarning(`Cannot save: ${outOfRadius.length} boundary vertex(es) exceed the ${restaurantDeliveryRadiusKm} km delivery radius limit.`);
                return; // DO NOT ACCEPT!
            }
        }

        try {
            setSavingZone(true);

            // Convert Leaflet [lat, lng] to GeoJSON [lng, lat] with closed ring
            const closedCoordinates = [
                ...draftPoints.map(([lat, lng]) => [lng, lat]),
                [draftPoints[0][1], draftPoints[0][0]], // Repeat first vertex to close ring
            ];

            const geojsonPayload = {
                type: 'Polygon',
                coordinates: [closedCoordinates],
            };

            const res = await fetch('/api/delivery/zones', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedZone?.id || null,
                    restaurantId: restaurantCode,
                    name: formName.trim(),
                    geojson: geojsonPayload,
                    deliveryFee: Number(formFee) || 0,
                    minimumOrderAmount: Number(formMinOrder) || 0,
                    enabled: formEnabled,
                    allowOverlap: forceAllowOverlap,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (res.status === 409 && data.error === 'OVERLAPPING_ZONES') {
                    setOverlapWarning(data.message);
                    toast.warning('Zone boundary overlaps with an existing enabled zone.');
                    return;
                }
                throw new Error(data.message || data.error || 'Failed to save zone');
            }

            toast.success(selectedZone ? 'Delivery zone updated successfully' : 'New delivery zone saved to PostGIS');
            setMode('view');
            setDraftPoints([]);
            draftPointsRef.current = [];
            setSelectedZone(null);
            setSelectedVertexIndex(null);
            setOverlapWarning(null);
            fetchZones();
        } catch (err: any) {
            console.error('Save zone error:', err);
            toast.error(err.message || 'Failed to save delivery zone');
        } finally {
            setSavingZone(false);
        }
    };

    // Toggle Zone Enabled/Disabled
    const handleToggleZone = async (zone: DeliveryZone) => {
        try {
            const nextState = !zone.enabled;
            const res = await fetch('/api/delivery/zones', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: zone.id,
                    restaurantId: restaurantCode,
                    enabled: nextState,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update zone');
            }

            toast.success(`Zone "${zone.name}" ${nextState ? 'enabled' : 'disabled'}`);
            setZones(prev => prev.map(z => z.id === zone.id ? { ...z, enabled: nextState } : z));
        } catch (err: any) {
            toast.error(err.message || 'Failed to toggle zone');
        }
    };

    // Delete Zone
    const handleDeleteZone = async (zoneId: string, zoneName: string) => {
        if (!confirm(`Are you sure you want to delete "${zoneName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/delivery/zones?id=${zoneId}&restaurantId=${restaurantCode}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete zone');
            }

            toast.success(`Zone "${zoneName}" deleted`);
            setZones(prev => prev.filter(z => z.id !== zoneId));
            if (selectedZone?.id === zoneId) {
                handleCancel();
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete zone');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200 dark:border-zinc-800">
                <Loader2 className="animate-spin text-orange-500 mb-3" size={32} />
                <p className="text-sm font-semibold text-neutral-500">Loading delivery zones & map...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-neutral-200/80 dark:border-zinc-800 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/25">
                            <Layers size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black text-neutral-900 dark:text-white">
                                    Delivery Zones
                                </h2>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                    GPS Enabled
                                </span>
                            </div>
                            <p className="text-xs text-neutral-500">
                                Draw custom polygon delivery zones with zone-specific delivery fees & minimum order values
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Fit All Zones Button (Requirement 2) */}
                        <button
                            onClick={handleFitAllZones}
                            className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 text-neutral-700 dark:text-neutral-200 font-bold text-xs transition-all cursor-pointer shadow-xs"
                            title="Fit all delivery zones (enabled and disabled) in view"
                        >
                            <Maximize2 size={14} />
                            <span>Fit All Zones ({zones.length})</span>
                        </button>

                        {mode === 'view' ? (
                            <button
                                onClick={handleStartDrawing}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                            >
                                <Plus size={15} />
                                <span>Draw Freehand Zone</span>
                            </button>
                        ) : (
                            <button
                                onClick={handleCancel}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 text-neutral-700 dark:text-neutral-200 font-bold text-xs transition-all cursor-pointer"
                            >
                                <X size={15} />
                                <span>Cancel {mode === 'drawing' ? 'Drawing' : 'Edit'}</span>
                            </button>
                        )}
                    </div>
                </div>


                {/* GPS Status Banner */}
                {userGpsCoords && (
                    <div className="mt-4 p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fadeIn">
                        <div className="flex items-center gap-2 text-xs text-blue-900 dark:text-blue-200">
                            <span className="flex h-2.5 w-2.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
                            </span>
                            <span>
                                <strong>GPS Location:</strong> {userGpsCoords.lat.toFixed(4)}, {userGpsCoords.lng.toFixed(4)}
                                {nearestRestaurant && (
                                    <> • Nearest Restaurant: <strong>{nearestRestaurant.name}</strong> ({nearestRestaurant.distanceKm < 1 ? Math.round(nearestRestaurant.distanceKm * 1000) + 'm' : nearestRestaurant.distanceKm + 'km'} away)</>
                                )}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => setUserGpsCoords(null)}
                                className="px-2.5 py-1 rounded-xl bg-white dark:bg-zinc-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-white font-medium text-[11px] transition-all cursor-pointer"
                            >
                                Clear GPS
                            </button>
                        </div>
                    </div>
                )}

                {/* Mode status banner */}
                {mode === 'drawing' && (
                    <div className="mt-4 space-y-2">
                        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
                            <div className="flex items-center gap-2.5 text-emerald-800 dark:text-emerald-300 text-xs">
                                <Info size={16} className="shrink-0 text-emerald-600" />
                                <span>
                                    <strong>Freehand Mode:</strong> Click on the map to add boundary points (minimum 3). Drag any pin or tap a pin then tap map to move it.
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-950/60 px-2.5 py-1 rounded-xl border border-orange-200 dark:border-orange-900 flex items-center gap-1.5" title="All zone boundary points must stay inside this radius circle">
                                    <Target size={13} className="text-orange-600" /> Max Radius: {restaurantDeliveryRadiusKm} km
                                </span>
                                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-zinc-700">
                                    {draftPoints.length} points
                                </span>
                                {draftPoints.length > 0 && (
                                    <button
                                        onClick={handleUndoPoint}
                                        title="Undo last added boundary point"
                                        className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-neutral-700 dark:text-neutral-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                                    >
                                        <RotateCcw size={12} />
                                        <span>Undo Point</span>
                                    </button>
                                )}
                                <button
                                    onClick={handleFinishDrawing}
                                    disabled={draftPoints.length < 3}
                                    className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-xs"
                                >
                                    Finish Polygon
                                </button>
                            </div>
                        </div>

                        {radiusWarning && (
                            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 flex items-center gap-2.5 text-xs text-red-800 dark:text-red-300 animate-fadeIn">
                                <AlertTriangle size={16} className="shrink-0 text-red-600" />
                                <span className="font-bold">{radiusWarning}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Main Interactive Grid: Map + Editor Drawer */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 2-Columns Map View */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="relative w-full h-[540px] rounded-3xl overflow-hidden border border-neutral-200 dark:border-zinc-800 shadow-sm">
                        <div ref={mapContainerRef} className="w-full h-full z-0" />

                        {/* Top-Left Floating Instructions */}
                        <div className="absolute top-3 left-3 z-[400] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-neutral-200 dark:border-zinc-700 shadow-md pointer-events-none">
                            <p className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-2">
                                <Compass size={14} className="text-emerald-500" />
                                {mode === 'drawing'
                                    ? 'Click map to place points • Drag pins or tap pin then tap map to move'
                                    : mode === 'editing'
                                    ? 'Drag pins or tap pin then tap map to relocate'
                                    : 'Click any zone polygon to inspect or edit'}
                            </p>
                        </div>

                        {/* Selected Vertex Relocation Toolbar */}
                        {selectedVertexIndex !== null && (
                            <div className="absolute top-14 left-3 z-[400] flex items-center gap-2 bg-blue-600/95 dark:bg-blue-600/95 text-white px-3.5 py-2 rounded-2xl shadow-xl border border-blue-400 backdrop-blur-md animate-fadeIn text-xs font-bold">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                                    Point #{selectedVertexIndex + 1} Selected — Tap map to relocate or drag pin
                                </span>
                                {draftPoints.length > 3 && (
                                    <button
                                        onClick={handleDeleteSelectedPoint}
                                        className="ml-1.5 px-2.5 py-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold transition-all cursor-pointer shadow-sm"
                                    >
                                        Delete Point
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedVertexIndex(null)}
                                    className="px-2.5 py-1 rounded-xl bg-blue-800 hover:bg-blue-900 text-white text-[11px] font-bold transition-all cursor-pointer shadow-sm"
                                >
                                    Deselect
                                </button>
                            </div>
                        )}

                        {/* Top-Right Floating Quick-Draw Actions */}
                        <div className="absolute top-3 right-3 z-[400] flex flex-wrap items-center gap-1.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-1.5 rounded-2xl border border-neutral-200 dark:border-zinc-700 shadow-md">
                            <button
                                onClick={handleFitAllZones}
                                title="Fit and center all delivery zones on map"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 text-neutral-700 dark:text-neutral-200 font-bold text-xs transition-all cursor-pointer"
                            >
                                <Maximize2 size={13} />
                                <span>Fit All ({zones.length})</span>
                            </button>

                            <button
                                onClick={handleLocateDeviceGps}
                                disabled={isLocatingGps}
                                title="Locate Current Device GPS and find nearest restaurant"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                            >
                                {isLocatingGps ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />}
                                <span>{isLocatingGps ? 'Locating...' : 'My GPS'}</span>
                            </button>

                            <button
                                onClick={handleCenterOnRestaurant}
                                title="Show restaurant location on map"
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 text-neutral-700 dark:text-neutral-200 font-bold text-xs transition-all cursor-pointer"
                            >
                                <Target size={13} className="text-orange-500" />
                                <span>Restaurant</span>
                            </button>
                        </div>

                        {/* Bottom-Left Service Radii Legend (Dine-In, Takeaway, Delivery) */}
                        {restaurantCoords ? (
                            <div className="absolute bottom-3 left-3 z-[400] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-3 rounded-2xl border border-neutral-200 dark:border-zinc-700 shadow-xl space-y-2 min-w-[220px]">
                                <div className="flex items-center justify-between border-b border-neutral-100 dark:border-zinc-800 pb-1.5">
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-900 dark:text-white flex items-center gap-1.5">
                                        <Target size={12} className="text-orange-500" />
                                        Service Radii
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => setShowRadiusRings(prev => !prev)}
                                        className="flex items-center gap-1 text-[10px] font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
                                        title={showRadiusRings ? "Hide radius rings on map" : "Show radius rings on map"}
                                    >
                                        {showRadiusRings ? <Eye size={12} className="text-emerald-600" /> : <EyeOff size={12} className="text-neutral-400" />}
                                        <span>{showRadiusRings ? 'Visible' : 'Hidden'}</span>
                                    </button>
                                </div>

                                <div className="space-y-1 text-xs">
                                    {/* Dine-In */}
                                    <div
                                        onClick={() => {
                                            if (mapInstanceRef.current && restaurantCoords) {
                                                mapInstanceRef.current.setView([restaurantCoords.lat, restaurantCoords.lng], 18, { animate: true });
                                                toast.info(`Zoomed to 🍽️ Dine-In Radius (${dineInRadiusKm < 1 ? `${Math.round(dineInRadiusKm * 1000)}m` : `${dineInRadiusKm}km`})`);
                                            }
                                        }}
                                        title="Click to zoom in and view Dine-In radius"
                                        className="flex items-center justify-between gap-3 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-zinc-800/80 px-2 py-1 rounded-xl cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white dark:border-zinc-800 shrink-0 shadow-xs" />
                                            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">🍽️ Dine-In</span>
                                        </div>
                                        <span className="font-mono text-[11px] font-bold text-neutral-900 dark:text-white">
                                            {dineInRadiusKm < 1 ? `${Math.round(dineInRadiusKm * 1000)} m` : `${dineInRadiusKm} km`}
                                        </span>
                                    </div>

                                    {/* Takeaway */}
                                    <div
                                        onClick={() => {
                                            if (mapInstanceRef.current && restaurantCoords) {
                                                mapInstanceRef.current.setView([restaurantCoords.lat, restaurantCoords.lng], 16, { animate: true });
                                                toast.info(`Zoomed to 🛍️ Takeaway Radius (${takeawayRadiusKm < 1 ? `${Math.round(takeawayRadiusKm * 1000)}m` : `${takeawayRadiusKm}km`})`);
                                            }
                                        }}
                                        title="Click to zoom in and view Takeaway radius"
                                        className="flex items-center justify-between gap-3 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-zinc-800/80 px-2 py-1 rounded-xl cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 border border-white dark:border-zinc-800 shrink-0 shadow-xs" />
                                            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">🛍️ Takeaway</span>
                                        </div>
                                        <span className="font-mono text-[11px] font-bold text-neutral-900 dark:text-white">
                                            {takeawayRadiusKm < 1 ? `${Math.round(takeawayRadiusKm * 1000)} m` : `${takeawayRadiusKm} km`}
                                        </span>
                                    </div>

                                    {/* Delivery */}
                                    <div
                                        onClick={() => {
                                            if (mapInstanceRef.current && restaurantCoords) {
                                                const radiusMeters = restaurantDeliveryRadiusKm * 1000;
                                                if (LRef.current) {
                                                    const bounds = LRef.current.latLng(restaurantCoords.lat, restaurantCoords.lng).toBounds(radiusMeters * 2);
                                                    mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30], animate: true });
                                                } else {
                                                    mapInstanceRef.current.setView([restaurantCoords.lat, restaurantCoords.lng], 13, { animate: true });
                                                }
                                                toast.info(`Fitted to 🛵 Max Delivery Radius (${restaurantDeliveryRadiusKm} km)`);
                                            }
                                        }}
                                        title="Click to zoom out and fit Delivery radius"
                                        className="flex items-center justify-between gap-3 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-zinc-800/80 px-2 py-1 rounded-xl cursor-pointer transition-colors"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-orange-600 border border-white dark:border-zinc-800 shrink-0 shadow-xs" />
                                            <span className="text-[11px] font-bold text-orange-700 dark:text-orange-400">🛵 Max Delivery</span>
                                        </div>
                                        <span className="font-mono text-[11px] font-bold text-neutral-900 dark:text-white">
                                            {restaurantDeliveryRadiusKm} km
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="absolute bottom-3 left-3 z-[400] bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 p-2.5 rounded-2xl shadow-lg max-w-[280px] text-xs">
                                <p className="font-bold flex items-center gap-1.5 text-[11px]">
                                    <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                                    Kitchen Location Not Set
                                </p>
                                <p className="text-[10px] opacity-90 mt-1">
                                    Set your restaurant location using &quot;Change Restaurant Location&quot; above to view Dine-In, Takeaway, and Delivery radiuses on the map.
                                </p>
                            </div>
                        )}

                        {/* Bottom-Right Map Zones Legend (Requirement 2: Highlight & show all zones, disabled in black) */}
                        <div className="absolute bottom-3 right-3 z-[400] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-3 rounded-2xl border border-neutral-200 dark:border-zinc-700 shadow-xl space-y-2 w-[240px]">
                            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-zinc-800 pb-1.5">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-900 dark:text-white">
                                        All Zones ({zones.length})
                                    </p>
                                    <p className="text-[9px] text-neutral-500 font-medium">
                                        <span className="text-emerald-600 font-bold">{zones.filter(z => z.enabled).length} Active</span> • <span className="text-neutral-900 dark:text-neutral-200 font-bold">{zones.filter(z => !z.enabled).length} Disabled</span>
                                    </p>
                                </div>
                                <button
                                    onClick={handleFitAllZones}
                                    title="Fit all zones on map"
                                    className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-500 text-[10px] cursor-pointer"
                                >
                                    <Maximize2 size={12} />
                                </button>
                            </div>

                            {zones.length === 0 ? (
                                <p className="text-[11px] text-neutral-400 py-1">No zones created yet</p>
                            ) : (
                                <div className="space-y-1.5 max-h-[170px] overflow-y-auto pr-1">
                                    {zones.map((z, i) => (
                                        <div
                                            key={z.id}
                                            onClick={() => handleSelectZoneForEdit(z)}
                                            className="flex items-center justify-between text-[11px] font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer p-1 rounded-lg hover:bg-neutral-100/70 dark:hover:bg-zinc-800/70 transition-colors"
                                            title={z.enabled ? `Active Zone: ₹${z.deliveryFee} fee` : 'Disabled Zone (Rendered in Black on map)'}
                                        >
                                            <div className="flex items-center gap-1.5 truncate">
                                                <div
                                                    className="w-2.5 h-2.5 rounded-full shrink-0 border"
                                                    style={{
                                                        backgroundColor: z.enabled ? ZONE_COLORS[i % ZONE_COLORS.length].stroke : '#000000',
                                                        borderColor: z.enabled ? 'transparent' : '#ffffff'
                                                    }}
                                                />
                                                <span className={`truncate text-xs ${!z.enabled ? 'font-black text-black dark:text-white' : ''}`}>
                                                    {z.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {!z.enabled ? (
                                                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-black text-white">
                                                        Disabled
                                                    </span>
                                                ) : (
                                                    <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                                                        ₹{z.deliveryFee}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 1-Column Zone Configuration Panel */}
                <div className="space-y-4">
                    {mode === 'editing' ? (
                        /* Edit / Configure Zone Card */
                        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-neutral-200/80 dark:border-zinc-800 shadow-sm space-y-5 animate-fadeIn">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
                                        <Edit3 size={16} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-neutral-900 dark:text-white">
                                            {selectedZone ? 'Edit Zone Details' : 'Configure New Zone'}
                                        </h3>
                                        <p className="text-[11px] text-neutral-500">
                                            {draftPoints.length} vertices • Drag orange pins on map to adjust
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={handleCancel}
                                    className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-zinc-800 text-neutral-400 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Overlap Warning Alert */}
                            {overlapWarning && (
                                <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 space-y-2">
                                    <div className="flex items-start gap-2 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                                        <AlertTriangle size={16} className="shrink-0 text-amber-600 mt-0.5" />
                                        <span>{overlapWarning}</span>
                                    </div>
                                    <div className="flex justify-end gap-2 pt-1">
                                        <button
                                            onClick={() => handleSaveZone(true)}
                                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all cursor-pointer"
                                        >
                                            Save Overlapping Zone Anyway
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Zone Form Fields */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                                        Zone Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g. Indiranagar Commercial, 3km Radius"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-zinc-700 bg-neutral-50/50 dark:bg-zinc-800/50 text-neutral-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                                            Delivery Fee (₹)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-bold">₹</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={formFee}
                                                onChange={(e) => setFormFee(Math.max(0, Number(e.target.value)))}
                                                className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-neutral-200 dark:border-zinc-700 bg-neutral-50/50 dark:bg-zinc-800/50 text-neutral-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 mb-1.5">
                                            Min Order (₹)
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-xs text-neutral-400 font-bold">₹</span>
                                            <input
                                                type="number"
                                                min="0"
                                                step="10"
                                                value={formMinOrder}
                                                onChange={(e) => setFormMinOrder(Math.max(0, Number(e.target.value)))}
                                                className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-neutral-200 dark:border-zinc-700 bg-neutral-50/50 dark:bg-zinc-800/50 text-neutral-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-2xl bg-neutral-50 dark:bg-zinc-800/50 border border-neutral-200 dark:border-zinc-700">
                                    <div>
                                        <p className="text-xs font-bold text-neutral-800 dark:text-neutral-200">Zone Enabled</p>
                                        <p className="text-[10px] text-neutral-500">Allow customers in this area to order</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setFormEnabled(!formEnabled)}
                                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                                            formEnabled ? 'bg-emerald-500' : 'bg-neutral-300 dark:bg-zinc-600'
                                        }`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                                            formEnabled ? 'translate-x-6' : 'translate-x-0'
                                        }`} />
                                    </button>
                                </div>
                            </div>

                            {/* Out of Radius Warning before Save */}
                            {restaurantCoords && draftPoints.some(pt => calculateDistanceKm(restaurantCoords.lat, restaurantCoords.lng, pt[0], pt[1]) > restaurantDeliveryRadiusKm) && (
                                <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-600" />
                                    <span className="font-bold">
                                        Boundary points exceed the {restaurantDeliveryRadiusKm} km restaurant delivery radius. Move all vertices inside the orange circle before saving.
                                    </span>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="pt-2 flex flex-col gap-2">
                                <button
                                    onClick={() => handleSaveZone(false)}
                                    disabled={savingZone || (Boolean(restaurantCoords) && draftPoints.some(pt => calculateDistanceKm(restaurantCoords!.lat, restaurantCoords!.lng, pt[0], pt[1]) > restaurantDeliveryRadiusKm))}
                                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                                >
                                    {savingZone ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                    <span>
                                        {Boolean(restaurantCoords) && draftPoints.some(pt => calculateDistanceKm(restaurantCoords!.lat, restaurantCoords!.lng, pt[0], pt[1]) > restaurantDeliveryRadiusKm)
                                            ? 'Cannot Save (Outside Radius)'
                                            : selectedZone
                                            ? 'Update Delivery Zone'
                                            : 'Save Delivery Zone'}
                                    </span>
                                </button>

                                {selectedZone && (
                                    <button
                                        onClick={() => handleDeleteZone(selectedZone.id, selectedZone.name)}
                                        className="w-full py-2.5 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                        <Trash2 size={14} />
                                        <span>Delete This Zone</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Delivery Zones Summary & List (Requirement 2: Highlight & show all created zones) */
                        <div className="p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-neutral-200/80 dark:border-zinc-800 shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider">
                                    Delivery Zones ({zones.length})
                                </h3>
                                <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                    <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                                        {zones.filter(z => z.enabled).length} Active
                                    </span>
                                    <span className="text-black dark:text-white bg-neutral-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                        {zones.filter(z => !z.enabled).length} Disabled
                                    </span>
                                </div>
                            </div>

                            {/* Filter Tabs for All, Active, and Disabled Zones */}
                            <div className="flex rounded-2xl bg-neutral-100 dark:bg-zinc-800/80 p-1 text-xs font-bold">
                                <button
                                    type="button"
                                    onClick={() => setZoneFilter('all')}
                                    className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer text-center ${
                                        zoneFilter === 'all'
                                            ? 'bg-white dark:bg-zinc-900 text-neutral-900 dark:text-white shadow-xs'
                                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-white'
                                    }`}
                                >
                                    All ({zones.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setZoneFilter('enabled')}
                                    className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer text-center ${
                                        zoneFilter === 'enabled'
                                            ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-white'
                                    }`}
                                >
                                    🟢 Active ({zones.filter(z => z.enabled).length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setZoneFilter('disabled')}
                                    className={`flex-1 py-1.5 rounded-xl transition-all cursor-pointer text-center ${
                                        zoneFilter === 'disabled'
                                            ? 'bg-black text-white shadow-xs'
                                            : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-white'
                                    }`}
                                >
                                    ⚫ Disabled ({zones.filter(z => !z.enabled).length})
                                </button>
                            </div>

                            {zones.length === 0 ? (
                                <div className="text-center py-8 space-y-3">
                                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-zinc-800 text-neutral-400 flex items-center justify-center mx-auto">
                                        <MapPin size={24} />
                                    </div>
                                    <p className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                                        No zones configured
                                    </p>
                                    <p className="text-[11px] text-neutral-400 max-w-[200px] mx-auto">
                                        Draw custom polygons on the map to define delivery zones
                                    </p>
                                    <div className="flex flex-col gap-2 pt-2">
                                        <button
                                            onClick={handleStartDrawing}
                                            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                        >
                                            <Compass size={14} />
                                            <span>Start Freehand Drawing</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                                    {zones
                                        .filter(z => zoneFilter === 'all' ? true : zoneFilter === 'enabled' ? z.enabled : !z.enabled)
                                        .map((zone, idx) => {
                                            const color = ZONE_COLORS[idx % ZONE_COLORS.length];
                                            const isEnabled = zone.enabled;
                                            return (
                                                <div
                                                    key={zone.id}
                                                    className={`p-3.5 rounded-2xl border transition-all ${
                                                        isEnabled
                                                            ? 'bg-neutral-50/80 dark:bg-zinc-800/50 border-neutral-200/80 dark:border-zinc-700/80'
                                                            : 'bg-neutral-100/90 dark:bg-zinc-800/90 border-2 border-black dark:border-neutral-500 shadow-xs'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div
                                                            className="flex items-start gap-2.5 cursor-pointer flex-1"
                                                            onClick={() => handleSelectZoneForEdit(zone)}
                                                            title="Click to view & edit zone"
                                                        >
                                                            <div
                                                                className="w-4 h-4 rounded-full shrink-0 mt-0.5 border"
                                                                style={{
                                                                    backgroundColor: isEnabled ? color.stroke : '#000000',
                                                                    borderColor: isEnabled ? '#ffffff' : '#ffffff',
                                                                    boxShadow: isEnabled ? undefined : '0 0 0 2px rgba(0,0,0,0.2)'
                                                                }}
                                                            />
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <h4 className={`text-xs font-black ${isEnabled ? 'text-neutral-900 dark:text-white' : 'text-black dark:text-white'}`}>
                                                                        {zone.name}
                                                                    </h4>
                                                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                                                                        isEnabled
                                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                                                            : 'bg-black text-white border border-neutral-700'
                                                                    }`}>
                                                                        {isEnabled ? '🟢 Active' : '⚫ Disabled (Black)'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2 text-[10px] text-neutral-600 dark:text-neutral-400 mt-1">
                                                                    <span>Fee: <strong>₹{zone.deliveryFee}</strong></span>
                                                                    <span>•</span>
                                                                    <span>Min: <strong>₹{zone.minimumOrderAmount}</strong></span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Quick Actions */}
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                onClick={() => handleToggleZone(zone)}
                                                                title={zone.enabled ? 'Disable zone (will turn black on map)' : 'Enable zone'}
                                                                className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                                                                    zone.enabled ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-zinc-700'
                                                                }`}
                                                            >
                                                                {zone.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
                                                            </button>
                                                            <button
                                                                onClick={() => handleSelectZoneForEdit(zone)}
                                                                title="Edit zone boundary and settings"
                                                                className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                                                            >
                                                                <Edit3 size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteZone(zone.id, zone.name)}
                                                                title="Delete zone"
                                                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick-Draw Zone by Nearest Restaurant (GPS) Modal */}
            {showGpsModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 space-y-5 animate-scaleUp">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-neutral-900 dark:text-white">
                                        Draw Zone by Nearest Restaurant
                                    </h3>
                                    <p className="text-xs text-neutral-500">
                                        Automatically generates an editable delivery polygon around GPS coordinates
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowGpsModal(false)}
                                className="p-2 rounded-xl text-neutral-400 hover:bg-neutral-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Center Point Selection */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                                Zone Center Origin
                            </label>

                            <div className="space-y-2">
                                {/* Option 1: Nearest Restaurant */}
                                <div
                                    onClick={() => setGpsCenterType('nearest_restaurant')}
                                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                                        gpsCenterType === 'nearest_restaurant'
                                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200'
                                            : 'bg-neutral-50 dark:bg-zinc-800/40 border-neutral-200 dark:border-zinc-700 text-neutral-700 dark:text-neutral-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center font-bold">
                                                🍴
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold">
                                                    {restaurantName}
                                                </p>
                                                <p className="text-[10px] text-neutral-500">
                                                    {restaurantCoords 
                                                        ? `📍 ${restaurantCoords.lat.toFixed(4)}, ${restaurantCoords.lng.toFixed(4)}${restaurantAddress ? ` (${restaurantAddress})` : ''}`
                                                        : 'Location not set yet'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                            gpsCenterType === 'nearest_restaurant' ? 'border-blue-600 bg-blue-600' : 'border-neutral-300'
                                        }`}>
                                            {gpsCenterType === 'nearest_restaurant' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                    </div>

                                    {/* Link to Settings for Kitchen Location */}
                                    {onGoToSettings && (
                                        <div className="pt-1.5 border-t border-blue-100 dark:border-zinc-700/50 flex items-center justify-between">
                                            <span className="text-[10px] text-neutral-500">To configure restaurant location:</span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setShowGpsModal(false);
                                                    onGoToSettings();
                                                }}
                                                className="text-[10px] font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer"
                                            >
                                                Manage in Settings →
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Option 2: Device GPS Location */}
                                <div
                                    onClick={() => {
                                        setGpsCenterType('user_gps');
                                        if (!userGpsCoords) handleLocateDeviceGps();
                                    }}
                                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 ${
                                        gpsCenterType === 'user_gps'
                                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200'
                                            : 'bg-neutral-50 dark:bg-zinc-800/40 border-neutral-200 dark:border-zinc-700 text-neutral-700 dark:text-neutral-300'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold">
                                                📍
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold">My Current Device GPS</p>
                                                <p className="text-[10px] text-neutral-500">
                                                    {userGpsCoords
                                                        ? `${userGpsCoords.lat.toFixed(4)}, ${userGpsCoords.lng.toFixed(4)} (Accuracy: ±${Math.round(userGpsCoords.accuracy || 10)}m)`
                                                        : 'Click to detect real-time GPS position'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                            gpsCenterType === 'user_gps' ? 'border-blue-600 bg-blue-600' : 'border-neutral-300'
                                        }`}>
                                            {gpsCenterType === 'user_gps' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                        </div>
                                    </div>

                                </div>

                                {/* Option 3: Select from all available branches if multiple */}
                                {availableRestaurants.length > 1 && (
                                    <div
                                        onClick={() => setGpsCenterType('specific_restaurant')}
                                        className={`p-3 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                                            gpsCenterType === 'specific_restaurant'
                                                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200'
                                                : 'bg-neutral-50 dark:bg-zinc-800/40 border-neutral-200 dark:border-zinc-700 text-neutral-700 dark:text-neutral-300'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center font-bold">
                                                    <Building2 size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold">Select Branch Location</p>
                                                    <p className="text-[10px] text-neutral-500">Choose from {availableRestaurants.length} registered locations</p>
                                                </div>
                                            </div>
                                            <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                                gpsCenterType === 'specific_restaurant' ? 'border-blue-600 bg-blue-600' : 'border-neutral-300'
                                            }`}>
                                                {gpsCenterType === 'specific_restaurant' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                        </div>

                                        {gpsCenterType === 'specific_restaurant' && (
                                            <select
                                                value={selectedRestaurantId}
                                                onChange={(e) => setSelectedRestaurantId(e.target.value)}
                                                className="w-full px-3 py-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-white dark:bg-zinc-900 text-xs font-semibold focus:outline-none"
                                            >
                                                {availableRestaurants.map(r => (
                                                    <option key={r.id} value={r.id}>
                                                        {r.name} - {r.address || `${r.latitude.toFixed(3)}, ${r.longitude.toFixed(3)}`}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Delivery Radius Presets & Fine-Tuning Slider */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                                    Delivery Coverage Radius
                                </label>
                                <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-900">
                                    {gpsRadiusKm} km ({Math.round(gpsRadiusKm * 1000)}m)
                                </span>
                            </div>

                            {/* Preset Radius Chips */}
                            <div className="flex flex-wrap gap-1.5">
                                {[1, 2, 3, 5, 7, 10].filter(rad => rad <= restaurantDeliveryRadiusKm).map(rad => (
                                    <button
                                        key={rad}
                                        type="button"
                                        onClick={() => setGpsRadiusKm(rad)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            gpsRadiusKm === rad
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 text-neutral-700 dark:text-neutral-300'
                                        }`}
                                    >
                                        {rad} km
                                    </button>
                                ))}
                            </div>

                            {/* Fine Slider */}
                            <input
                                type="range"
                                min="0.5"
                                max={restaurantDeliveryRadiusKm || 10}
                                step="0.5"
                                value={Math.min(gpsRadiusKm, restaurantDeliveryRadiusKm || 10)}
                                onChange={(e) => setGpsRadiusKm(Math.min(restaurantDeliveryRadiusKm || 10, Number(e.target.value)))}
                                className="w-full h-2 bg-neutral-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                            />
                        </div>

                        {/* Polygon Shape Resolution */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                                Polygon Geometry Shape
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { sides: 16, label: 'Circle (16-pt)', desc: 'Smooth Radial' },
                                    { sides: 6, label: 'Hexagon (6-pt)', desc: 'Honeycomb' },
                                    { sides: 8, label: 'Octagon (8-pt)', desc: 'Cardinal Grid' },
                                ].map(sh => (
                                    <button
                                        key={sh.sides}
                                        type="button"
                                        onClick={() => setGpsPolygonSides(sh.sides)}
                                        className={`p-2 rounded-2xl border text-center transition-all cursor-pointer ${
                                            gpsPolygonSides === sh.sides
                                                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-200'
                                                : 'bg-neutral-50 dark:bg-zinc-800/40 border-neutral-200 dark:border-zinc-700 text-neutral-600 dark:text-neutral-400'
                                        }`}
                                    >
                                        <p className="text-xs font-bold">{sh.label}</p>
                                        <p className="text-[10px] opacity-75">{sh.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setShowGpsModal(false)}
                                className="px-4 py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-zinc-800 text-neutral-700 dark:text-neutral-300 font-bold text-xs transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleGenerateZoneFromGps}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                            >
                                <Sparkles size={15} />
                                <span>Generate Zone on Map</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
