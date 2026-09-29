'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Navigation, MapPin, Phone, ExternalLink, ArrowRight, ShieldCheck, CheckCircle2, Package, Clock, AlertCircle } from 'lucide-react';

interface DeliveryMapProps {
    activeDelivery: any | null;
    restaurantLat: number | null;
    restaurantLng: number | null;
    restaurantName?: string;
    restaurantAddress?: string;
    onUpdateStatus?: (assignmentId: string, status: string, extra?: any) => Promise<void>;
    onOpenDetails?: (delivery: any) => void;
}

export default function DeliveryMap({
    activeDelivery,
    restaurantLat,
    restaurantLng,
    restaurantName = 'Dine in One',
    restaurantAddress = 'Restaurant Location',
    onUpdateStatus,
    onOpenDetails,
}: DeliveryMapProps) {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [distanceKm, setDistanceKm] = useState<string>('2.5');
    const [etaMinutes, setEtaMinutes] = useState<number>(15);

    // Fallback coordinates (Downtown Mumbai / default hub if not specified)
    const defaultLat = restaurantLat || 19.0760;
    const defaultLng = restaurantLng || 72.8777;

    const order = activeDelivery?.order;
    const customerLat = order?.delivery_lat ? Number(order.delivery_lat) : defaultLat + 0.015;
    const customerLng = order?.delivery_lng ? Number(order.delivery_lng) : defaultLng + 0.018;
    const customerAddress = order?.delivery_address || 'Customer Delivery Address';
    const customerName = order?.customer_name || 'Customer';
    const customerPhone = order?.delivery_phone || order?.customer_phone || '';

    // Calculate approximate distance
    useEffect(() => {
        if (defaultLat && defaultLng && customerLat && customerLng) {
            const R = 6371; // Earth radius in km
            const dLat = ((customerLat - defaultLat) * Math.PI) / 180;
            const dLng = ((customerLng - defaultLng) * Math.PI) / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos((defaultLat * Math.PI) / 180) *
                    Math.cos((customerLat * Math.PI) / 180) *
                    Math.sin(dLng / 2) *
                    Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const d = R * c;
            const km = d.toFixed(1);
            setDistanceKm(km);
            // Approx 3-4 mins per km in city traffic + 5 min buffer
            setEtaMinutes(Math.max(8, Math.round(d * 3.5 + 4)));
        }
    }, [defaultLat, defaultLng, customerLat, customerLng]);

    // Initialize Leaflet Map
    useEffect(() => {
        let isMounted = true;

        if (!document.getElementById('leaflet-css')) {
            const link = document.createElement('link');
            link.id = 'leaflet-css';
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            document.head.appendChild(link);
        }

        import('leaflet').then((L) => {
            if (!isMounted || !mapContainerRef.current) return;

            // Destroy previous instance if container was reused
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }

            const map = L.map(mapContainerRef.current, {
                zoomControl: false,
                attributionControl: false,
            }).setView([defaultLat, defaultLng], 14);

            L.control.zoom({ position: 'topright' }).addTo(map);

            // Clean open street map tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
            }).addTo(map);

            // Restaurant Marker
            const restIcon = L.divIcon({
                className: 'custom-rest-marker',
                html: `
                    <div style="background: #ea580c; color: white; width: 34px; height: 34px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(234, 88, 12, 0.4); border: 2px solid white;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                    </div>
                `,
                iconSize: [34, 34],
                iconAnchor: [17, 17],
            });

            const restMarker = L.marker([defaultLat, defaultLng], { icon: restIcon }).addTo(map);
            restMarker.bindPopup(`<b>${restaurantName}</b><br/><span style="font-size:11px;color:#666;">Pickup Hub</span>`);

            if (activeDelivery) {
                // Customer Destination Marker
                const customerIcon = L.divIcon({
                    className: 'custom-customer-marker',
                    html: `
                        <div style="background: #10b981; color: white; width: 34px; height: 34px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4); border: 2px solid white;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        </div>
                    `,
                    iconSize: [34, 34],
                    iconAnchor: [17, 17],
                });

                const custMarker = L.marker([customerLat, customerLng], { icon: customerIcon }).addTo(map);
                custMarker.bindPopup(`<b>${customerName}</b><br/><span style="font-size:11px;color:#666;">${customerAddress}</span>`);

                // Polyline Route representation
                const routeLine = L.polyline(
                    [
                        [defaultLat, defaultLng],
                        [customerLat, customerLng],
                    ],
                    {
                        color: '#ea580c',
                        weight: 4,
                        opacity: 0.85,
                        dashArray: '8, 8',
                    }
                ).addTo(map);

                // Fit map bounds to show both markers
                const group = L.featureGroup([restMarker, custMarker, routeLine]);
                map.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 16 });
            } else {
                // Circle around restaurant showing coverage
                L.circle([defaultLat, defaultLng], {
                    radius: 4000,
                    color: '#ea580c',
                    fillColor: '#ea580c',
                    fillOpacity: 0.08,
                    weight: 1.5,
                }).addTo(map);
            }

            mapInstanceRef.current = map;
            setMapLoaded(true);
        });

        return () => {
            isMounted = false;
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [defaultLat, defaultLng, customerLat, customerLng, activeDelivery, restaurantName, customerName, customerAddress]);

    const handleOpenExternalNavigation = () => {
        if (!order) return;
        const navUrl = `https://www.google.com/maps/dir/?api=1&origin=${defaultLat},${defaultLng}&destination=${customerLat},${customerLng}`;
        window.open(navUrl, '_blank');
    };

    return (
        <div className="relative w-full h-[calc(100vh-140px)] flex flex-col overflow-hidden bg-[#e8edf5] dark:bg-[#15181e] rounded-3xl shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),4px_4px_14px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/5">
            {/* Map Canvas */}
            <div ref={mapContainerRef} className="w-full flex-1 z-0" />

            {/* Top Overlay Badge */}
            <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between pointer-events-none">
                <div className="pointer-events-auto bg-[#e8edf5]/95 dark:bg-[#1a1e26]/95 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] border border-white/60 dark:border-white/5 flex items-center gap-2.5">
                    <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {activeDelivery ? `Route Active • Order #${order?.order_number || order?.id?.slice(0, 5)}` : 'Standby at Restaurant'}
                    </span>
                </div>

                {activeDelivery && (
                    <button
                        onClick={handleOpenExternalNavigation}
                        className="pointer-events-auto bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs px-3.5 py-2 rounded-2xl shadow-[-2px_-2px_6px_rgba(255,255,255,0.8),3px_4px_12px_rgba(249,115,22,0.4)] flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    >
                        <Navigation size={14} />
                        <span>Google Maps</span>
                    </button>
                )}
            </div>

            {/* Bottom Route Card */}
            <div className="absolute bottom-4 left-4 right-4 z-10">
                {activeDelivery ? (
                    <div className="bg-[#e8edf5]/98 dark:bg-[#1a1e26]/98 backdrop-blur-xl rounded-3xl p-4.5 shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),4px_4px_14px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/5 text-slate-900 dark:text-slate-100">
                        {/* Metrics Bar */}
                        <div className="grid grid-cols-2 gap-2.5 pb-3 mb-3 border-b border-slate-200/60 dark:border-slate-800">
                            <div className="flex items-center gap-2.5 bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.02)] p-2.5 rounded-2xl">
                                <div className="size-8 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center">
                                    <MapPin size={16} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Distance</p>
                                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">{distanceKm} km</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5 bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45),inset_-2px_-2px_4px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.02)] p-2.5 rounded-2xl">
                                <div className="size-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                                    <Clock size={16} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Est. Time</p>
                                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">{etaMinutes} mins</p>
                                </div>
                            </div>
                        </div>

                        {/* Customer & Address */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="min-w-0">
                                <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">
                                    {customerName}
                                </h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
                                    {customerAddress}
                                </p>
                            </div>
                            {customerPhone && (
                                <a
                                    href={`tel:${customerPhone}`}
                                    className="p-3 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] text-emerald-600 dark:text-emerald-400 shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] transition-all shrink-0 cursor-pointer"
                                    title="Call Customer"
                                >
                                    <Phone size={16} />
                                </a>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleOpenExternalNavigation}
                                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),3px_5px_12px_rgba(249,115,22,0.35)] active:scale-[0.98] transition-all cursor-pointer"
                            >
                                <Navigation size={14} />
                                <span>Navigate with GPS</span>
                            </button>
                            {onOpenDetails && (
                                <button
                                    onClick={() => onOpenDetails(activeDelivery)}
                                    className="py-3.5 px-4 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer"
                                >
                                    Details
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-[#e8edf5]/95 dark:bg-[#1a1e26]/95 backdrop-blur-md rounded-3xl p-5 shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),4px_4px_14px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/5 text-center">
                        <div className="size-10 mx-auto rounded-2xl bg-[#e2e8f2] dark:bg-[#13161c] text-slate-500 flex items-center justify-center mb-2">
                            <Navigation size={18} />
                        </div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">No Active Delivery Route</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                            When an order is assigned and accepted, turn-by-turn navigation and customer route will appear here.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
