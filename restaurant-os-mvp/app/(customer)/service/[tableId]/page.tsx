'use client';

import { OrderService } from '@/app/services/orders';
import { LucideGlassWater, LucideReceipt, LucideUtensils, LucideHandPlatter, LucideChevronLeft, LucideDisc, LucideSoup, LucideWind, LucideDroplet, LucideGripHorizontal, LucidePipette, LucideCheckCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { cn } from '@/app/lib/utils';
import { getServiceRequestDetails } from '@/app/lib/service-utils';
import { CustomerBottomNav } from '@/app/components/customer/CustomerBottomNav';
import { AnimatePresence, motion } from 'framer-motion';



const ActiveRequestsList = ({ tableId }: { tableId: number | string }) => {
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
        try {
            const data = await OrderService.fetchServiceRequestsForTable(tableId);
            updateRequests(data || []);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchRequests();

        // Subscribe to changes
        const sub = OrderService.subscribeToServiceRequests((payload) => {
            if (payload.eventType === 'DELETE') {
                // Check if the deleted request is one of ours
                const deletedId = payload.old.id;
                // Force string comparison to handle potential type mismatches (number vs string)
                const isMyRequest = requestsRef.current.some(r => String(r.id) === String(deletedId));

                if (isMyRequest) {
                    // Mark as delivered first
                    setDeliveredIds(prev => [...prev, deletedId]);

                    // Remove after delay
                    setTimeout(() => {
                        updateRequests(requestsRef.current.filter(r => r.id !== deletedId));
                        setDeliveredIds(prev => prev.filter(id => id !== deletedId));
                    }, 2000);
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
        });

        return () => {
            sub.unsubscribe();
        };
    }, [tableId]);

    if (requests.length === 0) return null;

    return (
        <div className="mb-6 space-y-2">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest px-1">Active Requests</h3>
            <div className="space-y-2">
                <AnimatePresence mode='popLayout'>
                    {requests.map((req) => {
                        const details = getServiceRequestDetails(req.request_type);
                        const isDelivered = deliveredIds.includes(req.id);
                        const isAccepted = req.status === 'accepted'; // Check DB status

                        // Determine Visual State
                        let bgColor = '#ffffff';
                        let borderColor = '#f3f4f6';
                        let statusColor = 'text-orange-500 bg-orange-50';
                        let statusText = 'Pending';
                        let iconBg = details.bg;

                        if (isDelivered) {
                            bgColor = '#ecfdf5'; // green-50
                            borderColor = '#10b981'; // green-500
                            statusColor = 'text-green-600 bg-green-100';
                            statusText = 'Completed';
                            iconBg = 'bg-green-100';
                        } else if (isAccepted) {
                            bgColor = '#eff6ff'; // blue-50
                            borderColor = '#3b82f6'; // blue-500
                            statusColor = 'text-blue-600 bg-blue-100';
                            statusText = 'Accepted';
                            iconBg = 'bg-blue-100';
                        }

                        return (
                            <motion.div
                                key={req.id}
                                layout
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                    scale: 1,
                                    backgroundColor: bgColor,
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
                                                className={cn("object-cover transition-opacity duration-300", isDelivered ? "opacity-50" : "opacity-100")}
                                            />
                                        ) : (
                                            <div className={cn("size-full flex items-center justify-center", details.color)}>
                                                <details.icon size={20} />
                                            </div>
                                        )}
                                        {isDelivered && (
                                            <div className="absolute inset-0 flex items-center justify-center text-green-600">
                                                <LucideCheckCircle size={24} className="animate-bounce" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className={cn("font-bold transition-colors duration-300", isDelivered ? "text-green-900" : "text-gray-900")}>
                                            {details.label}
                                        </p>
                                        <p className={cn("text-xs font-medium transition-colors duration-300", isDelivered ? "text-green-600" : (isAccepted ? "text-blue-600" : "text-gray-500"))}>
                                            {isDelivered ? 'Request Completed' : (isAccepted ? 'Waiter is on the way' : 'Notified Waiter')}
                                        </p>
                                        {req.quantity > 1 && !isDelivered && (
                                            <p className="text-xs font-bold text-blue-600">x{req.quantity}</p>
                                        )}
                                    </div>
                                </div>
                                <div className={cn(
                                    "text-xs font-bold px-3 py-1 rounded-full transition-all duration-300 flex items-center gap-1",
                                    statusColor
                                )}>
                                    {isDelivered ? (
                                        <>Done <LucideCheckCircle size={12} /></>
                                    ) : isAccepted ? (
                                        <>Accepted <LucideCheckCircle size={12} /></>
                                    ) : (
                                        'Pending'
                                    )}
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
    const tableId = typeof params.tableId === 'string' && isNaN(Number(params.tableId)) ? params.tableId : Number(params.tableId);
    const [loading, setLoading] = useState(false);
    const [isValidTable, setIsValidTable] = useState<boolean | null>(null);

    useEffect(() => {
        const checkTable = async () => {
            const exists = await OrderService.verifyTableExists(tableId);
            setIsValidTable(exists);
        };
        if (tableId) checkTable();
    }, [tableId]);

    if (isValidTable === false) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm">
                    <LucideUtensils className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Table Not Found</h2>
                    <p className="text-gray-500 mb-6">Please scan a valid QR code.</p>
                </div>
            </div>
        );
    }

    const [selectedOption, setSelectedOption] = useState<any>(null);
    const [quantity, setQuantity] = useState(1);

    const handleCall = async (option: any) => {
        setSelectedOption(option);
        setQuantity(1);
    };

    const submitRequest = async (type: string, qty: number = 1) => {
        setLoading(true);
        try {
            await OrderService.submitServiceRequest(tableId, type, qty);
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

    const options = [
        {
            id: 'call_waiter',
            label: 'Call Waiter',
            sub: 'General Help',
            image: '/services/Waiter.png',
            gradient: 'from-orange-400/20 to-orange-600/20',
            border: 'border-orange-200/50',
            text: 'text-orange-900',
            countable: false
        },
        {
            id: 'bill_requested',
            label: 'Request Bill',
            sub: 'Ready to Pay',
            image: '/services/Bill.png',
            gradient: 'from-violet-400/20 to-violet-600/20',
            border: 'border-violet-200/50',
            text: 'text-violet-900',
            countable: false
        },
        {
            id: 'water_requested',
            label: 'Water',
            sub: 'Refill Please',
            image: '/services/Water.png',
            gradient: 'from-blue-400/20 to-blue-600/20',
            border: 'border-blue-200/50',
            text: 'text-blue-900',
            countable: false
        },
        {
            id: 'cutlery_requested',
            label: 'Cutlery',
            sub: 'Extras',
            image: '/services/Cutlery.webp',
            gradient: 'from-emerald-400/20 to-emerald-600/20',
            border: 'border-emerald-200/50',
            text: 'text-emerald-900',
            countable: true
        },
        {
            id: 'glass_requested',
            label: 'Extra Glass',
            sub: 'Drinkware',
            image: '/services/Glass.jpg',
            gradient: 'from-sky-400/20 to-sky-600/20',
            border: 'border-sky-200/50',
            text: 'text-sky-900',
            countable: true
        },
        {
            id: 'straw_requested',
            label: 'Straw',
            sub: 'Drinkware',
            image: '/services/Straw.png',
            gradient: 'from-yellow-400/20 to-yellow-600/20',
            border: 'border-yellow-200/50',
            text: 'text-yellow-900',
            countable: true
        },
        {
            id: 'plate_requested',
            label: 'Extra Plate',
            sub: 'Dinnerware',
            image: '/services/Plate.png',
            gradient: 'from-zinc-400/20 to-zinc-600/20',
            border: 'border-zinc-200/50',
            text: 'text-zinc-900',
            countable: true
        },
        {
            id: 'bowl_requested',
            label: 'Finger Bowl',
            sub: 'Cleaning',
            image: '/services/Finger bowl.jpg',
            gradient: 'from-teal-400/20 to-teal-600/20',
            border: 'border-teal-200/50',
            text: 'text-teal-900',
            countable: true
        },
        {
            id: 'salt_requested',
            label: 'Salt',
            sub: 'Seasoning',
            image: '/services/Salt.jpg',
            gradient: 'from-stone-400/20 to-stone-600/20',
            border: 'border-stone-200/50',
            text: 'text-stone-900',
            countable: false
        },
        {
            id: 'pepper_requested',
            label: 'Pepper',
            sub: 'Seasoning',
            image: '/services/Pepper.jpg',
            gradient: 'from-neutral-400/20 to-neutral-600/20',
            border: 'border-neutral-200/50',
            text: 'text-neutral-900',
            countable: false
        },
        {
            id: 'sauce_requested',
            label: 'Ketchup',
            sub: 'Sauce',
            image: '/services/Ketchup.jpg',
            gradient: 'from-red-400/20 to-red-600/20',
            border: 'border-red-200/50',
            text: 'text-red-900',
            countable: false
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100 p-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <LucideChevronLeft className="text-gray-600" />
                    </button>
                    <h1 className="text-xl font-black text-gray-900 tracking-tight">Service</h1>
                </div>
            </header>

            <main className="p-6">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">How can we help?</h2>
                    <p className="text-gray-500">Tap a button below to notify us instantly.</p>
                </div>

                {/* Active Requests */}
                <ActiveRequestsList tableId={tableId} />

                <div className="grid grid-cols-3 gap-3">
                    {options.map((opt) => (
                        <button
                            key={opt.id}
                            disabled={loading}
                            onClick={() => handleCall(opt)}
                            className={cn(
                                "group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 active:scale-[0.98]",
                                "bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl", // Liquid Glass Base
                                "hover:shadow-2xl hover:bg-white/60 flex flex-col items-center justify-center gap-3 text-center h-40",
                                opt.border
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
                                    <Image
                                        src={opt.image}
                                        alt={opt.label}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                                <div className="space-y-0.5">
                                    <h3 className={cn("text-sm font-black leading-tight", opt.text)}>{opt.label}</h3>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-tight line-clamp-1">{opt.sub}</p>
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
                                        className="object-cover"
                                    />
                                </div>
                                {selectedOption.countable ? (
                                    <>
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">How many?</h3>
                                        <p className="text-gray-500 text-sm">Select quantity for {selectedOption.label}</p>
                                    </>
                                ) : (
                                    <>
                                        <h3 className="text-xl font-bold text-gray-900 mb-1">Confirm Request?</h3>
                                        <p className="text-gray-500 text-sm">Do you want to request {selectedOption.label}?</p>
                                    </>
                                )}
                            </div>

                            {selectedOption.countable && (
                                <div className="flex items-center justify-center gap-6 mb-8">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="size-12 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xl active:scale-95 transition-transform"
                                    >
                                        -
                                    </button>
                                    <span className="text-4xl font-black text-gray-900 w-16 text-center">{quantity}</span>
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
                                    className="flex-1 py-4 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
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
