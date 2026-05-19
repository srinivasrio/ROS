'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { OrderService } from '@/app/services/orders';
import { ServiceOptionsService, ServiceOption } from '@/app/services/service-options.service';
import { GlassWater as LucideGlassWater, Receipt as LucideReceipt, Utensils as LucideUtensils, HandPlatter as LucideHandPlatter, ChevronLeft as LucideChevronLeft, Disc as LucideDisc, Soup as LucideSoup, Wind as LucideWind, Droplet as LucideDroplet, GripHorizontal as LucideGripHorizontal, Pipette as LucidePipette, CheckCircle as LucideCheckCircle, Image as LucideImage } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { cn } from '@/app/lib/utils';
import { getServiceRequestDetails } from '@/app/lib/service-utils';
import { AnimatePresence, motion } from 'framer-motion';
import { CustomerCache } from '@/app/services/homepage-cache.service';

const ActiveRequestsList = ({ tableNumber, restaurantId }: { tableNumber: number | string, restaurantId: string }) => {
    const [requests, setRequests] = useState<any[]>([]);
    const [deliveredIds, setDeliveredIds] = useState<number[]>([]);
    const requestsRef = useRef<any[]>([]);

    const updateRequests = (newRequests: any[]) => {
        const filtered = newRequests.filter(r => r.request_type !== 'order_ready');
        setRequests(filtered);
        requestsRef.current = filtered;
    };

    const fetchRequests = useCallback(async () => {
        try {
            const data = await OrderService.fetchServiceRequestsForTable(tableNumber, restaurantId);
            updateRequests(data || []);
        } catch (error) {
            console.error(error);
        }
    }, [tableNumber, restaurantId]);

    useEffect(() => {
        fetchRequests();

        const sub = OrderService.subscribeToServiceRequests(restaurantId, (payload) => {
            if (payload.eventType === 'DELETE') {
                const deletedId = payload.old.id;
                const match = requestsRef.current.find(r => String(r.id) === String(deletedId));
                if (match) {
                    if (match.status === 'accepted' || match.status === 'delivered') {
                        setDeliveredIds(prev => [...prev, deletedId]);
                        setTimeout(() => {
                            updateRequests(requestsRef.current.filter(r => r.id !== deletedId));
                            setDeliveredIds(prev => prev.filter(id => id !== deletedId));
                        }, 2000);
                    } else {
                        updateRequests(requestsRef.current.filter(r => r.id !== deletedId));
                    }
                }
            } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const newRecord = payload.new;
                if (String(newRecord.table_id) === String(tableNumber)) {
                    fetchRequests();
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

        return () => { sub.unsubscribe(); };
    }, [fetchRequests, restaurantId, tableNumber]);

    if (requests.length === 0) return null;

    return (
        <div className="mb-6 space-y-2">
            <h3 className="text-sm font-bold text-black uppercase tracking-widest px-1">Active Requests</h3>
            <div className="space-y-2">
                <AnimatePresence mode='popLayout'>
                    {requests.map((req) => {
                        const details = getServiceRequestDetails(req.request_type);
                        const isDelivered = deliveredIds.includes(req.id) || req.status === 'delivered';
                        const isAccepted = req.status === 'accepted';

                        let stateBgColor = '#ffffff';
                        let borderColor = '#f3f4f6';
                        let statusColor = 'text-orange-500 bg-orange-50';
                        let statusText = 'Pending';
                        let iconBg = details.bg;

                        if (isDelivered || isAccepted) {
                            stateBgColor = '#ecfdf5';
                            borderColor = '#10b981';
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
                                            <Image src={details.image} alt={details.label} fill sizes="48px" className={cn("object-cover transition-opacity duration-300", (isDelivered || isAccepted) ? "opacity-50" : "opacity-100")} />
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
                                        <p className={cn("font-bold transition-colors duration-300", (isDelivered || isAccepted) ? "text-green-900" : "text-black")}>{details.label}</p>
                                        <p className={cn("text-xs font-medium transition-colors duration-300", (isDelivered || isAccepted) ? "text-green-600" : "text-black")}>
                                            {(isDelivered || isAccepted) ? 'Successfully Served' : 'Notified Waiter'}
                                        </p>
                                    </div>
                                </div>
                                <div className={cn("text-xs font-bold px-3 py-1 rounded-full transition-all duration-300 flex items-center gap-1", statusColor)}>
                                    {(isDelivered || isAccepted) ? (
                                        <>Successfully Served <LucideCheckCircle size={12} /></>
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

export function PersistentService({ restaurantId, tableNumber }: { restaurantId: string, tableNumber: string }) {
    const pathname = usePathname();
    const isVisible = pathname.includes('/customer/service/');
    
    const cachedData = CustomerCache.get(restaurantId, 'service', tableNumber);
    const [loading, setLoading] = useState(false);
    const [options, setOptions] = useState<ServiceOption[]>(cachedData?.options || []);
    const [selectedOption, setSelectedOption] = useState<any>(null);
    const [quantity, setQuantity] = useState(1);
    const [isValidTable, setIsValidTable] = useState<boolean | null>(true);

    const scrollPos = useRef(0);
    const isFirstRun = useRef(true);

    const loadData = useCallback(async () => {
        try {
            const tableData = await OrderService.verifyTableExists(restaurantId, tableNumber);
            if (tableData) {
                const optionsData = await ServiceOptionsService.fetchActive(restaurantId);
                setOptions(optionsData);
                CustomerCache.set(restaurantId, 'service', { options: optionsData }, tableNumber);
            }
        } catch (err) {
            console.error('Error loading service data:', err);
        }
    }, [restaurantId, tableNumber]);

    useEffect(() => {
        if (isFirstRun.current) {
            loadData();
            isFirstRun.current = false;
        }
    }, [loadData]);

    useEffect(() => {
        if (isVisible) {
            window.scrollTo(0, scrollPos.current);
            const handleScroll = () => {
                scrollPos.current = window.scrollY;
            };
            window.addEventListener('scroll', handleScroll);
            return () => window.removeEventListener('scroll', handleScroll);
        }
    }, [isVisible]);

    const handleCall = (option: any) => {
        setSelectedOption(option);
        setQuantity(1);
    };

    const submitRequest = async (type: string, qty: number = 1) => {
        setLoading(true);
        try {
            await OrderService.submitServiceRequest(tableNumber, type, restaurantId, qty);
            toast.success('Request Sent!');
            setSelectedOption(null);
        } catch (error) {
            toast.error('Failed to send request');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: isVisible ? 'block' : 'none' }} className="min-h-screen bg-gray-50 pb-32">
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100 p-4 pt-safe-top">
                <h1 className="text-xl font-black text-black tracking-tight">Service</h1>
            </header>

            <main className="p-6">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-black mb-2">How can we help?</h2>
                    <p className="text-black">Tap a button below to notify us instantly.</p>
                </div>

                <ActiveRequestsList tableNumber={tableNumber} restaurantId={restaurantId} />

                <div className="grid grid-cols-3 gap-3">
                    {options.filter(opt => opt.service_key !== 'order_ready').map((opt) => (
                        <button
                            key={opt.id}
                            disabled={loading}
                            onClick={() => handleCall({ id: opt.service_key, label: opt.label, image: opt.image_url, countable: opt.countable })}
                            className={cn(
                                "group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 active:scale-[0.98]",
                                "bg-white border border-gray-100 shadow-sm flex flex-col items-center justify-center gap-3 text-center h-40"
                            )}
                        >
                            <div className="relative size-16 rounded-xl overflow-hidden shadow-sm">
                                {opt.image_url ? (
                                    <img src={opt.image_url} alt={opt.label} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                                        <LucideImage size={24} className="text-black" />
                                    </div>
                                )}
                            </div>
                            <h3 className="text-sm font-black text-black leading-tight">{opt.label}</h3>
                        </button>
                    ))}
                </div>
            </main>

            <AnimatePresence>
                {selectedOption && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl">
                             <div className="text-center mb-6">
                                <h3 className="text-xl font-bold text-black mb-1">{selectedOption.countable ? 'How many?' : 'Confirm Request?'}</h3>
                                <p className="text-black text-sm">Requesting {selectedOption.label}</p>
                            </div>

                            {selectedOption.countable && (
                                <div className="flex items-center justify-center gap-6 mb-8">
                                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="size-12 rounded-xl bg-gray-100 flex items-center justify-center">-</button>
                                    <span className="text-4xl font-black text-black w-16 text-center">{quantity}</span>
                                    <button onClick={() => setQuantity(Math.min(10, quantity + 1))} className="size-12 rounded-xl bg-gray-900 text-white flex items-center justify-center">+</button>
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button onClick={() => setSelectedOption(null)} className="flex-1 py-4 rounded-xl font-bold bg-gray-100">Cancel</button>
                                <button onClick={() => submitRequest(selectedOption.id, selectedOption.countable ? quantity : 1)} className="flex-1 py-4 rounded-xl font-bold bg-gray-900 text-white shadow-lg">Confirm</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
