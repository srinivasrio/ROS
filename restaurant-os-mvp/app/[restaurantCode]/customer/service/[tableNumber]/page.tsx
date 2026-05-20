'use client';

import { OrderService } from '@/app/services/orders';
import { ServiceOptionsService, ServiceOption } from '@/app/services/service-options.service';
import { GlassWater as LucideGlassWater, Receipt as LucideReceipt, Utensils as LucideUtensils, HandPlatter as LucideHandPlatter, ChevronLeft as LucideChevronLeft, Disc as LucideDisc, Soup as LucideSoup, Wind as LucideWind, Droplet as LucideDroplet, GripHorizontal as LucideGripHorizontal, Pipette as LucidePipette, CheckCircle as LucideCheckCircle, Image as LucideImage } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { cn } from '@/app/lib/utils';
import { getServiceRequestDetails } from '@/app/lib/service-utils';
import { CustomerBottomNav } from '@/app/components/customer/CustomerBottomNav';
import { AnimatePresence, motion } from 'framer-motion';



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
                    if (match.request_status === 'accepted' || match.request_status === 'completed' || match.request_status === 'delivered') {
                        // Mark as delivered first to show success state briefly
                        setDeliveredIds(prev => [...prev, deletedId]);

                        // Remove after delay
                        setTimeout(() => {
                            updateRequests(requestsRef.current.filter(r => r.id !== deletedId));
                            setDeliveredIds(prev => prev.filter(id => id !== deletedId));
                        }, 2000);
                    } else {
                        // If it was not accepted (i.e. 'pending'), remove it immediately
                        updateRequests(requestsRef.current.filter(r => r.id !== deletedId));
                    }
                }
            } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const newRecord = payload.new;
                if (String(newRecord.table_id) === String(tableId)) {
                    fetchRequests();

                    // Show Popup/Toast for Order Ready (User requested popup only, no list item)
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

        return () => {
            sub.unsubscribe();
        };
    }, [tableNumber, tableId, restaurantId]);

    if (requests.length === 0) return null;

    return (
        <div className="mb-6 space-y-2">
            <h3 className="text-sm font-bold text-black uppercase tracking-widest px-1">Active Requests</h3>
            <div className="space-y-2">
                <AnimatePresence mode='popLayout'>
                    {requests.map((req) => {
                        const details = getServiceRequestDetails(req.request_type);
                        const isDelivered = deliveredIds.includes(req.id) || req.request_status === 'completed' || req.request_status === 'delivered';
                        const isAccepted = req.request_status === 'accepted'; // Check DB status

                        // Determine Visual State
                        let stateBgColor = '#ffffff';
                        let borderColor = '#f3f4f6';
                        let statusColor = 'text-orange-500 bg-orange-50';
                        let statusText = 'Pending';
                        let iconBg = details.bg;

                        if (isDelivered || isAccepted) {
                            stateBgColor = '#ecfdf5'; // green-50
                            borderColor = '#10b981'; // green-500
                            statusColor = 'text-green-600 bg-green-100';
                            statusText = 'Successfully Served';
                            iconBg = 'bg-green-100';
                        }

                        return (
                            <motion.div
                                key={req.id}
                                layout
                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                    scale: 1,
                                    backgroundColor: stateBgColor,
                                    borderColor: borderColor
                                }}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                className="rounded-xl p-4 shadow-sm border flex items-center justify-between relative overflow-hidden"
                            >
                                <div className="flex items-center gap-3 relative z-10">
                                    <div className={cn("relative size-12 rounded-lg overflow-hidden shadow-sm transition-colors duration-300", iconBg)}>
                                        {details.image ? (
                                            <Image
                                                src={details.image}
                                                alt={details.label}
                                                fill
                                                sizes="48px"
                                                className={cn("object-cover transition-opacity duration-300", (isDelivered || isAccepted) ? "opacity-50" : "opacity-100")}
                                            />
                                        ) : (
                                            <div className={cn("size-full flex items-center justify-center", details.color)}>
                                                <details.icon size={20} />
                                            </div>
                                        )}
                                        {(isDelivered || isAccepted) && (
                                            <div className="absolute inset-0 flex items-center justify-center text-green-600 bg-green-100/85 backdrop-blur-sm">
                                                <LucideCheckCircle size={24} className="animate-bounce" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className={cn("font-bold transition-colors duration-300", (isDelivered || isAccepted) ? "text-green-900" : "text-black")}>
                                            {details.label}
                                        </p>
                                        <p className={cn("text-xs font-medium transition-colors duration-300", (isDelivered || isAccepted) ? "text-green-600" : "text-black")}>
                                            {(isDelivered || isAccepted) ? 'Successfully Served' : 'Notified Waiter'}
                                        </p>
                                        {req.quantity > 1 && !(isDelivered || isAccepted) && (
                                            <p className="text-xs font-bold text-blue-600">x{req.quantity}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 relative z-10">
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
                                            className="text-xs font-bold text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full transition-all active:scale-95 border border-red-100 shrink-0"
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    <div className={cn(
                                        "text-xs font-bold px-3 py-1 rounded-full transition-all duration-300 flex items-center gap-1 shrink-0",
                                        statusColor
                                    )}>
                                        {(isDelivered || isAccepted) ? (
                                            <>Successfully Served <LucideCheckCircle size={12} /></>
                                        ) : (
                                            'Pending'
                                        )}
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
        setSelectedOption(option);
        setQuantity(1);
    };

    const submitRequest = async (type: string, qty: number = 1) => {
        if (!restaurantId) {
            toast.error('Restaurant ID not found');
            return;
        }
        setLoading(true);
        try {
            await OrderService.submitServiceRequest(tableNumber, type, urlRestaurantId, qty);
            toast.success('Request Sent!', {
                description: 'A waiter will be with you shortly.',
                duration: 3000,
            });
            setSelectedOption(null);
        } catch (error) {
            console.error(error);
            toast.error('Failed to send request');
        } finally {
            setLoading(false);
        }
    };

    if (isValidTable === false) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm">
                    <div className="size-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-black">
                        <LucideUtensils size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-black mb-2">No table number in this restaurant</h2>
                    <p className="text-black mb-6 font-medium">Please scan a valid QR code.</p>
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
                                        <img
                                            src={opt.image_url}
                                            alt={opt.label}
                                            className="w-full h-full object-cover"
                                        />
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
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
                        >
                            <div className="text-center mb-6">
                                <div className={cn("relative size-24 rounded-2xl mx-auto mb-4 overflow-hidden shadow-md")}>
                                    <Image
                                        src={selectedOption.image}
                                        alt={selectedOption.label}
                                        fill
                                        sizes="96px"
                                        className="object-cover"
                                    />
                                </div>
                                {selectedOption.countable ? (
                                    <>
                                        <h3 className="text-xl font-bold text-black mb-1">How many?</h3>
                                        <p className="text-black text-sm">Select quantity for {selectedOption.label}</p>
                                    </>
                                ) : (
                                    <>
                                        <h3 className="text-xl font-bold text-black mb-1">Confirm Request?</h3>
                                        <p className="text-black text-sm">Do you want to request {selectedOption.label}?</p>
                                    </>
                                )}
                            </div>

                            {selectedOption.countable && (
                                <div className="flex items-center justify-center gap-6 mb-8">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="size-12 rounded-xl bg-gray-100 flex items-center justify-center text-black font-bold text-xl active:scale-95 transition-transform"
                                    >
                                        -
                                    </button>
                                    <span className="text-4xl font-black text-black w-16 text-center">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(Math.min(10, quantity + 1))}
                                        className="size-12 rounded-xl bg-gray-900 text-white flex items-center justify-center font-bold text-xl active:scale-95 transition-transform"
                                    >
                                        +
                                    </button>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setSelectedOption(null)}
                                    className="flex-1 py-4 rounded-xl font-bold bg-gray-100 text-black hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => submitRequest(selectedOption.id, selectedOption.countable ? quantity : 1)}
                                    className="flex-1 py-4 rounded-xl font-bold bg-gray-900 text-white hover:bg-gray-800 transition-colors shadow-lg active:scale-[0.98]"
                                >
                                    Confirm Request
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

}
