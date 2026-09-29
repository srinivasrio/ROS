'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { OrderService } from '@/services/orders.service';
import { ServiceOptionsService, ServiceOption } from '@/services/service-options.service';
import { GlassWater as LucideGlassWater, Receipt as LucideReceipt, Utensils as LucideUtensils, HandPlatter as LucideHandPlatter, ChevronLeft as LucideChevronLeft, Disc as LucideDisc, Soup as LucideSoup, Wind as LucideWind, Droplet as LucideDroplet, GripHorizontal as LucideGripHorizontal, Pipette as LucidePipette, CheckCircle as LucideCheckCircle, Image as LucideImage, Bell as LucideBell } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getServiceRequestDetails } from '@/lib/service-utils';
import { AnimatePresence, motion } from 'framer-motion';
import { CustomerCache } from '@/services/homepage-cache.service';
import { getServiceImageUrl, isVideoUrl } from '@/components/shared/homepage/ServiceCard';
import { CutleryConfirmationModal } from '@/components/customer/CutleryConfirmationModal';

const ActiveRequestsList = ({ tableNumber, tableId, restaurantId, isVisible }: { tableNumber: number | string, tableId: number | null, restaurantId: string, isVisible: boolean }) => {
    const [requests, setRequests] = useState<any[]>([]);
    const [deliveredIds, setDeliveredIds] = useState<number[]>([]);
    const requestsRef = useRef<any[]>([]);
    const prevStatusMap = useRef<Record<string, string>>({});

    const updateRequests = (newRequests: any[]) => {
        const filtered = newRequests.filter(r => r.request_type !== 'order_ready');

        // Avoid re-renders if requests signature hasn't changed
        const prevSig = requestsRef.current.map(r => `${r.id}:${r.request_status}`).join(',');
        const newSig = filtered.map(r => `${r.id}:${r.request_status}`).join(',');
        if (prevSig === newSig && requestsRef.current.length === filtered.length) {
            return;
        }

        // Check for status changes to trigger instant toasts
        filtered.forEach(req => {
            const prevStatus = prevStatusMap.current[String(req.id)];
            const currentStatus = req.request_status;
            const details = getServiceRequestDetails(req.request_type, req.additional_notes);

            if (prevStatus && prevStatus !== currentStatus) {
                if (currentStatus === 'accepted') {
                    toast.success(`✅ ${details.label} request accepted! Waiter is on the way.`);
                } else if (currentStatus === 'completed') {
                    toast.success(`🎉 ${details.label} delivered successfully!`);
                    setDeliveredIds(prev => [...prev, Number(req.id)]);
                }
            }
            prevStatusMap.current[String(req.id)] = currentStatus;
        });

        setRequests(filtered);
        requestsRef.current = filtered;
    };

    const fetchRequests = useCallback(async () => {
        try {
            const target = tableId || tableNumber;
            if (!target) return;
            const data = await OrderService.fetchServiceRequestsForTable(target, restaurantId);
            updateRequests(data || []);
        } catch (error) {
            console.error(error);
        }
    }, [tableId, tableNumber, restaurantId]);

    useEffect(() => {
        if (!isVisible) return;
        fetchRequests();

        // Gentle background sync every 25 seconds as network backup
        const pollInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                fetchRequests();
            }
        }, 25000);

        const sub = OrderService.subscribeToServiceRequests(
            restaurantId, 
            (payload) => {
                if (document.visibilityState !== 'visible') return;
                fetchRequests();
            },
            undefined,
            tableId || undefined
        );

        return () => {
            clearInterval(pollInterval);
            if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe();
        };
    }, [tableId, tableNumber, restaurantId, isVisible, fetchRequests]);

    if (!requests || requests.length === 0) return null;

    return (
        <div className="mb-6">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                </span>
                Active Requests
            </h3>
            <div className="space-y-3">
                <AnimatePresence>
                    {requests.map((req) => {
                        const details = getServiceRequestDetails(req.request_type, req.additional_notes);
                        const isAccepted = req.request_status === 'accepted';
                        const isDelivered = deliveredIds.includes(req.id) || req.request_status === 'completed';

                        let statusColor = "text-amber-700";
                        let statusDot = "bg-amber-500";
                        if (isDelivered) {
                            statusColor = "text-emerald-700";
                            statusDot = "bg-emerald-500";
                        } else if (isAccepted) {
                            statusColor = "text-blue-700";
                            statusDot = "bg-blue-500";
                        }

                        return (
                            <motion.div
                                key={req.id}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="p-4 rounded-2xl flex items-center justify-between transition-all duration-300"
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.4), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                                    border: '1px solid rgba(255, 255, 255, 0.85)',
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <div 
                                        className="size-10 rounded-xl flex items-center justify-center text-orange-500 shrink-0"
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                            border: '1px solid rgba(255, 255, 255, 0.8)',
                                        }}
                                    >
                                        <LucideBell size={18} />
                                    </div>
                                    <div>
                                        <p className="font-extrabold text-slate-800 text-sm">
                                            {details.label}
                                            {req.quantity && req.quantity > 1 ? ` (x${req.quantity})` : ''}
                                        </p>
                                        {req.notes && (
                                            <p className="text-xs font-bold text-orange-600 mt-0.5">
                                                {req.notes}
                                            </p>
                                        )}
                                        <p className="text-xs font-semibold text-slate-500 mt-0.5">
                                            {isDelivered ? 'Delivered successfully! 🎉' : isAccepted ? 'Waiter accepted • On the way 🚀' : 'Waiting for waiter...'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!isAccepted && !isDelivered && (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                try {
                                                    await OrderService.cancelServiceRequest(req.id, restaurantId);
                                                    toast.success('Request Cancelled');
                                                } catch (err) {
                                                    toast.error('Failed to cancel request');
                                                }
                                            }}
                                            className="text-xs font-bold text-rose-600 px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer"
                                            style={{
                                                backgroundColor: '#EEF2F6',
                                                boxShadow: '2px 2px 5px rgba(166, 180, 200, 0.4), -2px -2px 5px rgba(255, 255, 255, 0.9)',
                                                border: '1px solid rgba(255, 255, 255, 0.8)'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    <div 
                                        className={cn("text-xs font-black px-3 py-1 rounded-full flex items-center gap-1.5", statusColor)}
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                            border: '1px solid rgba(255, 255, 255, 0.7)'
                                        }}
                                    >
                                        <span className={cn("size-2 rounded-full", statusDot)} />
                                        <span>{isDelivered ? 'Delivered' : isAccepted ? 'On Way' : 'Pending'}</span>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
};

export function PersistentService({ restaurantId, tableNumber }: { restaurantId: string, tableNumber: string }) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const idParam = searchParams?.get('id') || searchParams?.get('service');
    const isVisible = pathname.includes('/customer/service/');
    
    const cachedData = CustomerCache.get(restaurantId, 'service', tableNumber);
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState<ServiceOption[]>(cachedData?.options || []);
    const [selectedOption, setSelectedOption] = useState<any>(null);
    const [quantity, setQuantity] = useState(1);
    const [tableId, setTableId] = useState<number | null>(null);
    const [isCutleryModalOpen, setIsCutleryModalOpen] = useState(false);

    const loadData = useCallback(async () => {
        try {
            // 1. Fetch active service options immediately
            const optionsData = await ServiceOptionsService.fetchActive(restaurantId);
            if (optionsData && optionsData.length > 0) {
                setOptions(optionsData);
                CustomerCache.set(restaurantId, 'service', { options: optionsData }, tableNumber);
            }
        } catch (err: any) {
            console.error('Error loading service options:', err?.message || err);
        }

        try {
            // 2. Verify table exists in background
            const tableData = await OrderService.verifyTableExists(restaurantId, tableNumber);
            if (tableData) {
                setTableId(tableData.id);
            }
        } catch (err) {
            console.warn('Table verification deferred:', err);
        }
    }, [restaurantId, tableNumber]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCall = (option: any) => {
        const isCutlery = 
            option?.id === 'cutlery' || 
            option?.id === 'cutlery_requested' || 
            option?.service_key === 'cutlery' ||
            option?.service_key === 'cutlery_requested' ||
            option?.label?.toLowerCase().includes('cutlery');

        if (isCutlery) {
            setIsCutleryModalOpen(true);
            return;
        }
        setSelectedOption(option);
        setQuantity(1);
    };

    // Auto-open exact service when redirected from a banner
    useEffect(() => {
        if (!isVisible || !idParam || options.length === 0) return;
        const found = options.find(opt => 
            String(opt.id) === String(idParam) ||
            opt.service_key === String(idParam) ||
            opt.label?.toLowerCase() === String(idParam).toLowerCase()
        );
        if (found) {
            handleCall({
                id: found.service_key,
                label: found.label,
                image: found.image_url,
                countable: found.countable
            });
        }
    }, [isVisible, idParam, options]);

    const submitRequest = async (optionId: string, qty: number) => {
        setLoading(true);
        try {
            let targetTable: any = tableId;
            if (!targetTable) {
                const tableData = await OrderService.verifyTableExists(restaurantId, tableNumber);
                if (tableData) {
                    targetTable = tableData.id;
                    setTableId(tableData.id);
                } else {
                    targetTable = tableNumber;
                }
            }
            await OrderService.submitServiceRequest(targetTable, optionId, restaurantId, qty);
            toast.success('Request sent to waiter!');
            setSelectedOption(null);
        } catch (error) {
            toast.error('Failed to send request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: isVisible ? 'block' : 'none' }} className="min-h-screen bg-transparent pb-32">
            <header 
                className="sticky top-0 z-20 p-4 pt-safe-top"
                style={{
                    backgroundColor: '#EEF2F6',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.8)',
                    boxShadow: '0 2px 8px rgba(166, 180, 200, 0.2)'
                }}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-black text-slate-800 tracking-tight">Table Service</h1>
                        <p className="text-xs font-semibold text-slate-500">Need something? Tap below to notify staff</p>
                    </div>
                    <div 
                        className="px-3 py-1 rounded-full text-xs font-black text-slate-700"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.7)'
                        }}
                    >
                        {tableNumber?.toLowerCase().startsWith('table') ? tableNumber : `Table ${tableNumber}`}
                    </div>
                </div>
            </header>

            <main className="p-5">
                <div className="text-center mb-6">
                    <h2 className="text-xl font-black text-slate-800 mb-1">How can we help?</h2>
                    <p className="text-xs font-semibold text-slate-500">Instant direct notification to your assigned table staff</p>
                </div>

                <ActiveRequestsList tableNumber={tableNumber} tableId={tableId} restaurantId={restaurantId} isVisible={isVisible} />

                <div className="grid grid-cols-3 gap-3.5">
                    {options.filter(opt => opt.service_key !== 'order_ready').map((opt) => {
                        const optImg = getServiceImageUrl({
                            ...opt,
                            service_image: opt.image_url,
                            service_key: opt.service_key,
                            service_title: opt.label
                        });
                        return (
                            <button
                                key={opt.id}
                                disabled={loading}
                                onClick={() => handleCall({ id: opt.service_key, label: opt.label, image: optImg || opt.image_url, countable: opt.countable })}
                                className={cn(
                                    "group relative overflow-hidden rounded-2xl p-3.5 transition-all duration-200 active:scale-[0.96] cursor-pointer",
                                    "flex flex-col items-center justify-center gap-2.5 text-center h-36"
                                )}
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: '5px 5px 12px rgba(166, 180, 200, 0.4), -5px -5px 12px rgba(255, 255, 255, 0.95)',
                                    border: '1px solid rgba(255, 255, 255, 0.85)',
                                }}
                            >
                                <div 
                                    className="relative size-14 rounded-2xl overflow-hidden p-1.5 flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.8)'
                                    }}
                                >
                                    {optImg ? (
                                        isVideoUrl(optImg) ? (
                                            <video
                                                src={encodeURI(optImg)}
                                                autoPlay
                                                loop
                                                muted
                                                playsInline
                                                className="w-full h-full object-contain pointer-events-none"
                                            />
                                        ) : (
                                            <img src={encodeURI(optImg)} alt={opt.label} className="w-full h-full object-contain" />
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-orange-500">
                                            <LucideBell size={22} />
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-xs font-black text-slate-800 leading-tight line-clamp-2">{opt.label}</h3>
                            </button>
                        );
                    })}
                </div>
            </main>

            <AnimatePresence>
                {selectedOption && (
                    <div 
                        className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
                        onClick={() => setSelectedOption(null)}
                    >
                        <motion.div 
                            initial={{ scale: 0.92, y: 16 }} 
                            animate={{ scale: 1, y: 0 }} 
                            exit={{ scale: 0.92, y: 16 }} 
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            className="rounded-3xl p-6 w-full max-w-sm relative overflow-hidden"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '12px 12px 28px rgba(166, 180, 200, 0.5), -12px -12px 28px rgba(255, 255, 255, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.85)'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-center mb-5">
                                <div 
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider text-orange-600 mb-3"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.7)'
                                    }}
                                >
                                    <LucideBell size={12} className="text-orange-500 animate-bounce" />
                                    <span>Confirm Service Request</span>
                                </div>

                                <div 
                                    className="relative size-20 rounded-2xl mx-auto mb-3 overflow-hidden p-2 flex items-center justify-center"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: 'inset 3px 3px 6px rgba(166, 180, 200, 0.4), inset -3px -3px 6px rgba(255, 255, 255, 0.95)',
                                        border: '1px solid rgba(255, 255, 255, 0.8)'
                                    }}
                                >
                                    {selectedOption.image ? (
                                        isVideoUrl(selectedOption.image) ? (
                                            <video
                                                src={encodeURI(selectedOption.image)}
                                                autoPlay
                                                loop
                                                muted
                                                playsInline
                                                className="w-full h-full object-contain pointer-events-none"
                                            />
                                        ) : (
                                            <img
                                                src={encodeURI(selectedOption.image)}
                                                alt={selectedOption.label}
                                                className="w-full h-full object-contain"
                                            />
                                        )
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-orange-500">
                                            <LucideBell size={30} />
                                        </div>
                                    )}
                                </div>

                                <h3 className="text-lg font-black text-slate-800 leading-tight mb-1">
                                    Request {selectedOption.label}?
                                </h3>
                                <p className="text-xs text-slate-500 leading-relaxed max-w-[260px] mx-auto">
                                    Notify staff for <span className="font-bold text-slate-700">{selectedOption.label}</span> at {tableNumber?.toLowerCase().startsWith('table') ? tableNumber : `Table ${tableNumber}`}.
                                </p>
                            </div>

                            {selectedOption.countable && (
                                <div 
                                    className="flex items-center justify-between p-3.5 rounded-2xl mb-5"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: 'inset 2px 2px 5px rgba(166, 180, 200, 0.35), inset -2px -2px 5px rgba(255, 255, 255, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.7)'
                                    }}
                                >
                                    <div className="text-left">
                                        <span className="text-xs font-bold text-slate-700 block">Quantity</span>
                                        <span className="text-[10px] text-slate-400">Select number required</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            type="button"
                                            onClick={() => setQuantity(Math.max(1, quantity - 1))} 
                                            className="size-9 rounded-xl flex items-center justify-center active:scale-95 transition-transform cursor-pointer font-black text-slate-700"
                                            style={{
                                                backgroundColor: '#EEF2F6',
                                                boxShadow: '3px 3px 6px rgba(166, 180, 200, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.9)',
                                                border: '1px solid rgba(255, 255, 255, 0.8)'
                                            }}
                                            aria-label="Decrease quantity"
                                        >
                                            -
                                        </button>
                                        <span className="w-6 text-center font-black text-base text-slate-800 tabular-nums">{quantity}</span>
                                        <button 
                                            type="button"
                                            onClick={() => setQuantity(Math.min(10, quantity + 1))} 
                                            className="size-9 rounded-xl flex items-center justify-center active:scale-95 transition-transform cursor-pointer font-black text-slate-700"
                                            style={{
                                                backgroundColor: '#EEF2F6',
                                                boxShadow: '3px 3px 6px rgba(166, 180, 200, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.9)',
                                                border: '1px solid rgba(255, 255, 255, 0.8)'
                                            }}
                                            aria-label="Increase quantity"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-2.5">
                                <button 
                                    type="button"
                                    onClick={() => setSelectedOption(null)} 
                                    className="flex-1 py-3 px-4 rounded-xl text-slate-600 font-bold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: '3px 3px 7px rgba(166, 180, 200, 0.4), -3px -3px 7px rgba(255, 255, 255, 0.95)',
                                        border: '1px solid rgba(255, 255, 255, 0.85)'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button"
                                    disabled={loading}
                                    onClick={() => submitRequest(selectedOption.id, selectedOption.countable ? quantity : 1)} 
                                    className="flex-1 py-3 px-4 rounded-xl text-white font-bold text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    style={{
                                        backgroundColor: '#F97316',
                                        boxShadow: '3px 3px 8px rgba(249, 115, 22, 0.35), -2px -2px 6px rgba(255, 255, 255, 0.4)',
                                    }}
                                >
                                    {loading ? (
                                        <>
                                            <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Sending...</span>
                                        </>
                                    ) : (
                                        <>
                                            <LucideBell size={15} />
                                            <span>Confirm</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <CutleryConfirmationModal
                isOpen={isCutleryModalOpen}
                onClose={() => setIsCutleryModalOpen(false)}
                restaurantId={restaurantId}
                tableNumber={tableNumber}
                tableId={tableId}
                onSuccess={() => {
                    loadData();
                }}
            />
        </div>
    );
}
