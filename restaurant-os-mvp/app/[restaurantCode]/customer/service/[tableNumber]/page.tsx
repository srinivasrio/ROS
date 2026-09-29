'use client';

import { OrderService } from '@/services/orders.service';
import { ServiceOptionsService, ServiceOption } from '@/services/service-options.service';
import { GlassWater as LucideGlassWater, Receipt as LucideReceipt, Utensils as LucideUtensils, HandPlatter as LucideHandPlatter, ChevronLeft as LucideChevronLeft, Disc as LucideDisc, Soup as LucideSoup, Wind as LucideWind, Droplet as LucideDroplet, GripHorizontal as LucideGripHorizontal, Pipette as LucidePipette, CheckCircle as LucideCheckCircle, Image as LucideImage, Trash2 as LucideTrash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getServiceRequestDetails } from '@/lib/service-utils';
import { CustomerBottomNav } from '@/components/customer/CustomerBottomNav';
import { AnimatePresence, motion } from 'framer-motion';
import { isVideoUrl } from '@/components/shared/homepage/ServiceCard';
import { CutleryConfirmationModal } from '@/components/customer/CutleryConfirmationModal';



const ActiveRequestsList = ({ tableNumber, tableId, restaurantId }: { tableNumber: number | string, tableId: number | null, restaurantId: string }) => {
    const [requests, setRequests] = useState<any[]>([]);
    const [deliveredIds, setDeliveredIds] = useState<number[]>([]);
    const requestsRef = useRef<any[]>([]);

    const updateRequests = (newRequests: any[]) => {
        // Filter out 'order_ready' requests as they shouldn't appear in the Customer Service list
        const filtered = newRequests.filter(r => r.request_type !== 'order_ready');
        setRequests(filtered);
        requestsRef.current = filtered;
    };

    const fetchRequests = async () => {
        if (!tableId) return;
        try {
            const data = await OrderService.fetchServiceRequestsForTable(tableId, restaurantId);
            updateRequests(data || []);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        if (!tableId) return;
        fetchRequests();

        // Subscribe to changes
        const sub = OrderService.subscribeToServiceRequests(restaurantId, (payload) => {
            if (payload.eventType === 'DELETE') {
                const deletedId = payload.old.id;
                const match = requestsRef.current.find(r => String(r.id) === String(deletedId));

                if (match) {
                    if (match.request_status === 'accepted' || match.request_status === 'completed') {
                        // Mark as delivered first to show success state briefly
                        setDeliveredIds(prev => [...prev, deletedId]);

                        // Remove after delay
                        setTimeout(() => {
                            updateRequests(requestsRef.current.filter(r => r.id !== deletedId));
                            setDeliveredIds(prev => prev.filter(id => id !== deletedId));
                        }, 2000);
                    } else {
                        // If it was not accepted/completed (i.e. 'pending'), remove it immediately
                        updateRequests(requestsRef.current.filter(r => r.id !== deletedId));
                    }
                }
            } else if (payload.eventType === 'UPDATE') {
                const newRecord = payload.new;
                if (String(newRecord.table_id) === String(tableId)) {
                    if (newRecord.request_status === 'completed') {
                        const reqId = newRecord.id;
                        setDeliveredIds(prev => [...prev, reqId]);
                        
                        OrderService.fetchServiceRequestsForTable(tableId, restaurantId).then(activeRequests => {
                            const combined = [...(activeRequests || []), newRecord];
                            const unique = combined.filter((item, index, self) =>
                                self.findIndex(t => t.id === item.id) === index
                            );
                            updateRequests(unique);
                        });

                        setTimeout(() => {
                            setDeliveredIds(prev => prev.filter(id => id !== reqId));
                            fetchRequests();
                        }, 2000);
                    } else {
                        fetchRequests();
                    }
                }
            } else if (payload.eventType === 'INSERT') {
                const newRecord = payload.new;
                if (String(newRecord.table_id) === String(tableId)) {
                    fetchRequests();

                    // Show Popup/Toast for Order Ready
                    if (newRecord.request_type === 'order_ready') {
                        toast.success('Order Ready!', {
                            description: 'Your order is ready to be served.',
                            duration: 5000,
                            icon: <LucideCheckCircle className="text-green-500" />
                        });
                    }
                }
            }
        }, undefined, tableId);

        // Optimistic event listener for 0ms response on customer click
        const handleOptimistic = (e: any) => {
            if (e.detail) {
                updateRequests([e.detail, ...requestsRef.current.filter(r => r.id !== e.detail.id)]);
            }
        };
        window.addEventListener('service-request-added', handleOptimistic);

        return () => {
            sub.unsubscribe();
            window.removeEventListener('service-request-added', handleOptimistic);
        };
    }, [tableNumber, tableId, restaurantId]);

    const handleDeleteRequest = async (requestId: number) => {
        // Optimistic remove
        updateRequests(requestsRef.current.filter(r => r.id !== requestId));
        try {
            await OrderService.deleteServiceRequest(requestId, restaurantId);
            toast.success('Request deleted');
        } catch (err) {
            console.error('Failed to delete request:', err);
            fetchRequests();
            toast.error('Failed to delete request');
        }
    };

    if (requests.length === 0) return null;

    return (
        <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-black uppercase tracking-widest">Active Requests</h3>
                <span className="text-[10px] font-semibold text-neutral-400">Swipe left to delete</span>
            </div>
            <div className="space-y-2">
                <AnimatePresence mode='popLayout'>
                    {requests.map((req) => {
                        const details = getServiceRequestDetails(req.request_type, restaurantId);
                        const isDelivered = deliveredIds.includes(req.id) || req.request_status === 'completed';
                        const isAccepted = req.request_status === 'accepted';

                        // Determine Visual State
                        let stateBgColor = '#ffffff';
                        let borderColor = '#f3f4f6';
                        let statusColor = 'text-orange-500 bg-orange-50';
                        let statusText = 'Waiting for waiter';
                        let iconBg = details.bg;

                        if (isDelivered) {
                            stateBgColor = '#ecfdf5'; // green-50
                            borderColor = '#10b981'; // green-500
                            statusColor = 'text-green-600 bg-green-100';
                            statusText = 'Served';
                            iconBg = 'bg-green-100';
                        } else if (isAccepted) {
                            stateBgColor = '#eff6ff'; // blue-50
                            borderColor = '#3b82f6'; // blue-500
                            statusColor = 'text-blue-600 bg-blue-100';
                            statusText = 'Waiter is coming';
                            iconBg = 'bg-blue-100';
                        }

                        return (
                            <div key={req.id} className="relative overflow-hidden rounded-xl">
                                {/* Red Background for Swipe Left Action */}
                                <div 
                                    onClick={() => handleDeleteRequest(req.id)}
                                    className="absolute inset-0 bg-red-500 rounded-xl flex items-center justify-end px-5 gap-1.5 text-white font-black text-xs cursor-pointer select-none transition-colors hover:bg-red-600"
                                >
                                    <span>Delete</span>
                                    <LucideTrash2 size={16} />
                                </div>

                                {/* Draggable / Swipeable Card */}
                                <motion.div
                                    layout
                                    drag="x"
                                    dragDirectionLock
                                    dragConstraints={{ left: -100, right: 0 }}
                                    dragElastic={0.12}
                                    onDragEnd={(_, info) => {
                                        if (info.offset.x < -60 || info.velocity.x < -300) {
                                            handleDeleteRequest(req.id);
                                        }
                                    }}
                                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        scale: 1,
                                        backgroundColor: stateBgColor,
                                        borderColor: borderColor,
                                    }}
                                    exit={{ opacity: 0, scale: 0.9, x: -200, transition: { duration: 0.2 } }}
                                    className="rounded-xl p-4 shadow-sm border flex items-center justify-between relative z-10 select-none touch-pan-y"
                                >
                                    <div className="flex items-center gap-3 relative z-10 pointer-events-none">
                                        <div className={cn("relative size-12 rounded-lg overflow-hidden shadow-sm transition-colors duration-300", iconBg)}>
                                            {details.image ? (
                                                isVideoUrl(details.image) ? (
                                                    <video
                                                        src={encodeURI(details.image)}
                                                        autoPlay
                                                        loop
                                                        muted
                                                        playsInline
                                                        className={cn("w-full h-full object-cover transition-opacity duration-300", (isDelivered || isAccepted) ? "opacity-50" : "opacity-100")}
                                                    />
                                                ) : (
                                                    <Image
                                                        src={details.image}
                                                        alt={details.label}
                                                        fill
                                                        sizes="48px"
                                                        className={cn("object-cover transition-opacity duration-300", (isDelivered || isAccepted) ? "opacity-50" : "opacity-100")}
                                                    />
                                                )
                                            ) : (
                                                <div className={cn("size-full flex items-center justify-center", details.color)}>
                                                    <details.icon size={20} />
                                                </div>
                                            )}
                                            {isDelivered && (
                                                <div className="absolute inset-0 flex items-center justify-center text-green-600 bg-green-100/85 backdrop-blur-sm">
                                                    <LucideCheckCircle size={24} className="animate-bounce" />
                                                </div>
                                            )}
                                            {isAccepted && !isDelivered && (
                                                <div className="absolute inset-0 flex items-center justify-center text-blue-600 bg-blue-100/85 backdrop-blur-sm">
                                                    <LucideCheckCircle size={24} className="animate-pulse" />
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <p className={cn("font-bold transition-colors duration-300", isDelivered ? "text-green-900" : isAccepted ? "text-blue-900" : "text-black")}>
                                                {details.label}
                                            </p>
                                            {req.notes && (
                                                <p className="text-xs font-bold text-orange-600">
                                                    {req.notes}
                                                </p>
                                            )}
                                            <p className={cn("text-xs font-medium transition-colors duration-300", isDelivered ? "text-green-600" : isAccepted ? "text-blue-600" : "text-black")}>
                                                {isDelivered ? 'Served' : isAccepted ? 'Waiter is coming' : 'Waiting for waiter'}
                                            </p>
                                            {req.quantity > 1 && !isDelivered && !isAccepted && (
                                                <p className="text-xs font-bold text-blue-600">x{req.quantity}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 relative z-10">
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                handleDeleteRequest(req.id);
                                            }}
                                            className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full transition-all active:scale-95 border border-red-100 shrink-0"
                                        >
                                            Delete
                                        </button>
                                        <div className={cn(
                                            "text-xs font-bold px-3 py-1 rounded-full transition-all duration-300 flex items-center gap-1 shrink-0 pointer-events-none",
                                            statusColor
                                        )}>
                                            {isDelivered ? (
                                                <>Served <LucideCheckCircle size={12} /></>
                                            ) : isAccepted ? (
                                                <>Waiter is coming</>
                                            ) : (
                                                'Waiting for waiter'
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        );
                    })}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default function ServicePage() {
    const params = useParams();
    const router = useRouter();
    const urlRestaurantId = (params.restaurantCode || params.restaurantId) as string;
    const tableNumber = params.tableNumber as string;
    const [loading, setLoading] = useState(false);
    const [isValidTable, setIsValidTable] = useState<boolean | null>(null);
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [tableId, setTableId] = useState<number | null>(null);

    const [selectedOption, setSelectedOption] = useState<any>(null);
    const [quantity, setQuantity] = useState(1);
    const [options, setOptions] = useState<ServiceOption[]>([]);
    const [isCutleryModalOpen, setIsCutleryModalOpen] = useState(false);

    useEffect(() => {
        const loadTableData = async () => {
            try {
                const tableData = await OrderService.verifyTableExists(urlRestaurantId, tableNumber);
                if (tableData) {
                    if (tableData.restaurant_id !== urlRestaurantId) {
                        setIsValidTable(false);
                        return;
                    }
                    setIsValidTable(true);
                    setRestaurantId(tableData.restaurant_id);
                    setTableId(tableData.id);
                    
                    if (tableData.restaurant_id) {
                        const optionsData = await ServiceOptionsService.fetchActive(tableData.restaurant_id);
                        setOptions(optionsData);
                    }
                } else {
                    setIsValidTable(false);
                }
            } catch (err) {
                console.error('Error loading table data:', err);
                setIsValidTable(false);
            }
        };
        
        if (tableNumber) loadTableData();

        // Realtime: re-fetch when admin edits service options
        const sub = ServiceOptionsService.subscribeToChanges(restaurantId!, () => {
            if (restaurantId) {
                ServiceOptionsService.fetchActive(restaurantId).then(setOptions).catch(console.error);
            }
        });
        return () => { sub.unsubscribe(); };
    }, [tableNumber, urlRestaurantId]);

    const handleCall = async (option: any) => {
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

    const submitRequest = async (type: string, qty: number = 1) => {
        if (!restaurantId) {
            toast.error('Restaurant ID not found');
            return;
        }

        // Optimistic UI response: update local state & close modal immediately (0ms)
        const optimisticReq = {
            id: Date.now(),
            table_id: tableId,
            request_type: type,
            request_status: 'pending',
            quantity: qty,
            created_at: new Date().toISOString()
        };
        window.dispatchEvent(new CustomEvent('service-request-added', { detail: optimisticReq }));
        setSelectedOption(null);
        toast.success('Request Sent!', {
            description: 'A waiter will be with you shortly.',
            duration: 3000,
        });

        try {
            await OrderService.submitServiceRequest(tableNumber, type, urlRestaurantId, qty);
        } catch (error) {
            console.error(error);
            toast.error('Failed to send request');
        }
    };

    if (isValidTable === false) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm">
                    <div className="size-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-black">
                        <LucideUtensils size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-black mb-2">No table named &ldquo;{tableNumber}&rdquo; in this restaurant</h2>
                    <p className="text-black mb-6 font-medium">Table &ldquo;{tableNumber}&rdquo; does not exist or has not been created by the restaurant admin. Please scan a valid QR code.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100 p-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <LucideChevronLeft className="text-black" />
                    </button>
                    <h1 className="text-xl font-black text-black tracking-tight">Service</h1>
                </div>
            </header>

            <main className="p-6">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-black mb-2">How can we help?</h2>
                    <p className="text-black">Tap a button below to notify us instantly.</p>
                </div>

                {/* Active Requests */}
                <ActiveRequestsList tableNumber={tableNumber} tableId={tableId} restaurantId={urlRestaurantId} />

                <div className="grid grid-cols-3 gap-3">
                    {options.filter(opt => opt.service_key !== 'order_ready').map((opt) => (
                        <button
                            key={opt.id}
                            disabled={loading}
                            onClick={() => handleCall({ id: opt.service_key, label: opt.label, image: opt.image_url, countable: opt.countable })}
                            className={cn(
                                "group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 active:scale-[0.98]",
                                "bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl",
                                "hover:shadow-2xl hover:bg-white/60 flex flex-col items-center justify-center gap-3 text-center h-40",
                                opt.border_class
                            )}
                        >
                            {/* Inner Gradient Background */}
                            <div className={cn(
                                "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br",
                                opt.gradient
                            )} />

                            <div className="relative z-10 flex flex-col items-center justify-center gap-3">
                                <div className={cn(
                                    "relative size-16 rounded-xl overflow-hidden shadow-sm transition-transform duration-300 group-hover:scale-110"
                                )}>
                                    {opt.image_url ? (
                                        isVideoUrl(opt.image_url) ? (
                                            <video
                                                src={encodeURI(opt.image_url)}
                                                autoPlay
                                                loop
                                                muted
                                                playsInline
                                                className="w-full h-full object-cover pointer-events-none"
                                            />
                                        ) : (
                                            <img
                                                src={opt.image_url}
                                                alt={opt.label}
                                                className="w-full h-full object-cover"
                                            />
                                        )
                                    ) : (
                                        <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                                            <LucideImage size={24} className="text-black" />
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-0.5">
                                    <h3 className={cn("text-sm font-black leading-tight", opt.text_class)}>{opt.label}</h3>
                                    <p className="text-[9px] font-bold text-black uppercase tracking-widest leading-tight line-clamp-1">{opt.sub_label}</p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            </main>

            {/* Confirmation / Quantity Modal */}
            <AnimatePresence>
                {selectedOption && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedOption(null)}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 cursor-pointer"
                        role="dialog"
                        aria-modal="true"
                    >
                        <motion.div
                            initial={{ scale: 0.92, y: 16 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.92, y: 16 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-100 cursor-default relative overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="text-center mb-5">
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-200/80 mb-3 shadow-2xs">
                                    <LucideCheckCircle size={12} className="text-orange-600 animate-bounce" />
                                    <span>Confirm Service Request</span>
                                </div>

                                <div className="relative size-20 rounded-2xl mx-auto mb-3 overflow-hidden bg-slate-50 border border-slate-100 shadow-sm flex items-center justify-center">
                                    {selectedOption.image ? (
                                        isVideoUrl(selectedOption.image) ? (
                                            <video
                                                src={encodeURI(selectedOption.image)}
                                                autoPlay
                                                loop
                                                muted
                                                playsInline
                                                className="w-full h-full object-contain p-1 pointer-events-none"
                                            />
                                        ) : (
                                            <img
                                                src={selectedOption.image}
                                                alt={selectedOption.label}
                                                className="w-full h-full object-contain p-2"
                                            />
                                        )
                                    ) : (
                                        <div className="size-full flex items-center justify-center text-orange-600">
                                            <LucideUtensils size={28} />
                                        </div>
                                    )}
                                </div>

                                <h3 className="text-lg font-black text-slate-900 leading-tight mb-1">
                                    Request {selectedOption.label}?
                                </h3>
                                <p className="text-xs text-slate-500 leading-relaxed max-w-[260px] mx-auto">
                                    Are you sure you want to notify staff for <span className="font-bold text-slate-800">{selectedOption.label}</span> at Table {tableNumber}?
                                </p>
                            </div>

                            {selectedOption.countable && (
                                <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-2xl mb-5 border border-slate-200/70">
                                    <div className="text-left">
                                        <span className="text-xs font-bold text-slate-700 block">Quantity</span>
                                        <span className="text-[10px] text-slate-400">Select number required</span>
                                    </div>
                                    <div className="flex items-center gap-3 bg-orange-100/70 p-1 rounded-2xl border border-orange-300">
                                        <button
                                            type="button"
                                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                            className="size-9 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold text-base active:scale-95 transition-transform shadow-xs cursor-pointer hover:bg-orange-700"
                                            aria-label="Decrease quantity"
                                        >
                                            -
                                        </button>
                                        <span className="w-6 text-center font-black text-base text-orange-950 tabular-nums">{quantity}</span>
                                        <button
                                            type="button"
                                            onClick={() => setQuantity(Math.min(10, quantity + 1))}
                                            className="size-9 rounded-xl bg-orange-600 text-white flex items-center justify-center font-bold text-base active:scale-95 transition-transform shadow-xs cursor-pointer hover:bg-orange-700"
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
                                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={loading}
                                    onClick={() => submitRequest(selectedOption.id, selectedOption.countable ? quantity : 1)}
                                    className="flex-1 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-orange-600/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    {loading ? (
                                        <>
                                            <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            <span>Sending...</span>
                                        </>
                                    ) : (
                                        <span>Confirm Request</span>
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <CutleryConfirmationModal
                isOpen={isCutleryModalOpen}
                onClose={() => setIsCutleryModalOpen(false)}
                restaurantId={urlRestaurantId}
                tableNumber={tableNumber}
                tableId={tableId}
            />
        </div>
    );

}
