'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { OrderService } from '@/app/services/orders';
import { ArrowRightLeft as LucideTransfer, Users as LucideUsers, X as LucideX, CheckCircle2 as LucideCheckCircle2, Bell as LucideBell, ArrowRight as LucideArrowRight } from 'lucide-react';
import { getServiceRequestDetails, preloadServiceOptions, subscribeServiceOptionsCache } from '@/app/lib/service-utils';

interface ServiceRequest {
    id: number;
    table_id: number;
    tables: { 
        table_number: string;
        assigned_waiter_id: string | null;
    };
    request_type: string;
    request_status: string;
    created_at: string;
    quantity?: number;
    assigned_waiter_id?: string | null;
}

// ...

// In JSX:
// Table {alert.tables?.table_number || '?'}



const TimeAgo = ({ timestamp }: { timestamp: string }) => {
    const [timeAgo, setTimeAgo] = useState('Just Now');

    useEffect(() => {
        const calculateTimeAgo = () => {
            const now = new Date();
            const created = new Date(timestamp);
            const diffInSeconds = Math.floor((now.getTime() - created.getTime()) / 1000);

            if (diffInSeconds < 60) {
                setTimeAgo('Just Now');
            } else if (diffInSeconds < 3600) {
                const minutes = Math.floor(diffInSeconds / 60);
                setTimeAgo(`${minutes}m ago`);
            } else if (diffInSeconds < 86400) {
                const hours = Math.floor(diffInSeconds / 3600);
                setTimeAgo(`${hours}h ago`);
            } else {
                const days = Math.floor(diffInSeconds / 86400);
                setTimeAgo(`${days}d ago`);
            }
        };

        calculateTimeAgo();
        // Update every 30 seconds to keep it relatively fresh without over-polling
        const interval = setInterval(calculateTimeAgo, 30000);
        return () => clearInterval(interval);
    }, [timestamp]);

    return <>{timeAgo}</>;
};

export default function WaiterAlerts() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const { staffMobile } = useParams();
    const [alerts, setAlerts] = useState<ServiceRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [waiterRecord, setWaiterRecord] = useState<any>(null);
    const [staffList, setStaffList] = useState<any[]>([]);
    const [transferModalOpen, setTransferModalOpen] = useState(false);
    const [selectedRequestIds, setSelectedRequestIds] = useState<number[]>([]);
    const activeRef = useRef(true);

    useEffect(() => {
        const loadWaiter = async () => {
            if (!restaurantId || !staffMobile) return;
            try {
                const waiter = await OrderService.getStaffByMobile(staffMobile as string, restaurantId);
                if (activeRef.current) setWaiterRecord(waiter);
            } catch (error) {
                console.error('Failed to load waiter:', error);
            }
        };
        loadWaiter();
    }, [staffMobile, restaurantId]);

    const loadAlerts = async () => {
        if (!restaurantId) return;
        try {
            const activeRequests = await OrderService.fetchActiveServiceRequests(restaurantId, waiterRecord?.id);
            if (activeRef.current && activeRequests) {
                setAlerts(activeRequests);
            }
        } catch (error) {
            console.error('Failed to load alerts:', error);
        } finally {
            if (activeRef.current) setLoading(false);
        }
    };

    const loadStaff = async () => {
        if (!restaurantId) return;
        try {
            const staff = await OrderService.fetchStaffWithWorkload(restaurantId);
            if (activeRef.current) setStaffList(staff.filter(s => s.id !== waiterRecord?.id));
        } catch (error) {
            console.error('Failed to load staff:', error);
        }
    };

    useEffect(() => {
        activeRef.current = true;
        if (restaurantLoading || !restaurantId) return;
        
        loadAlerts();
        loadStaff();
        preloadServiceOptions();

        // Subscribe to Service Requests
        let sub: { unsubscribe: () => void } | null = null;
        if (waiterRecord?.id) {
            sub = OrderService.subscribeToServiceRequests(restaurantId, (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    loadAlerts(); // Refresh list
                }
            }, waiterRecord.id);
        }

        const cacheSub = subscribeServiceOptionsCache();

        return () => {
            activeRef.current = false;
            if (sub) sub.unsubscribe();
            cacheSub.unsubscribe();
        };
    }, [restaurantId, restaurantLoading, waiterRecord?.id]);

    // Group alerts by table and request type
    const groupedAlerts = Object.values(
        alerts.reduce((acc, alert) => {
            const key = `${alert.table_id}-${alert.request_type}-${alert.request_status}`;
            if (!acc[key]) {
                acc[key] = { ...alert, count: 0, ids: [] };
            }
            acc[key].count += (alert.quantity || 1);
            acc[key].ids.push(alert.id);
            return acc;
        }, {} as Record<string, ServiceRequest & { count: number; ids: number[] }>)
    );

    const handleMarkServed = async (requestIds: number[]) => {
        try {
            // Optimistic update - immediately remove from UI
            setAlerts(prev => prev.filter(a => !requestIds.includes(a.id)));
            await OrderService.resolveMultipleServiceRequests(requestIds);
            toast.success('Service Completed');
        } catch (error) {
            console.error(error);
            toast.error('Failed to update status');
            loadAlerts(); // Revert on error
        }
    };

    const handleAcceptRequest = async (requestIds: number[]) => {
        if (!waiterRecord?.id) {
            toast.error('Waiter profile loading, please try again.');
            return;
        }
        try {
            // Optimistic update - set status of these requests to 'accepted'
            setAlerts(prev => prev.map(a => requestIds.includes(a.id) ? { ...a, request_status: 'accepted' } : a));
            for (const id of requestIds) {
                await OrderService.acceptServiceRequest(id, String(restaurantId), waiterRecord.id);
            }
            toast.success('Request Accepted');
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Failed to accept request');
            loadAlerts(); // Revert on error
        }
    };

    const handleTransferClick = (requestIds: number[]) => {
        setSelectedRequestIds(requestIds);
        setTransferModalOpen(true);
    };

    const handleTransferExecute = async (targetWaiterId: string) => {
        try {
            setTransferModalOpen(false);
            // Optimistic update
            setAlerts(prev => prev.filter(a => !selectedRequestIds.includes(a.id)));
            
            // Transfer each request
            for (const requestId of selectedRequestIds) {
                await OrderService.transferServiceRequest(String(requestId), targetWaiterId, restaurantId!);
            }
            
            toast.success('Task Transferred Successfully');
        } catch (error) {
            console.error(error);
            toast.error('Transfer Failed');
            loadAlerts();
        }
    };

    if (loading || restaurantLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                <p className="text-black text-xs font-bold uppercase tracking-wider">Checking Alerts...</p>
            </div>
        );
    }

    if (alerts.length === 0) {
        return (
            <div className="flex flex-col h-full bg-white">
                <header className="flex items-center bg-white p-4 pb-2 justify-between sticky top-0 z-10 border-b border-divider shrink-0">
                    <div className="text-primary flex size-10 shrink-0 items-center justify-center">
                        <LucideBell size={24} />
                    </div>
                    <h2 className="text-charcoal text-lg font-bold leading-tight tracking-tight flex-1 text-center">Alerts</h2>
                    <div className="w-10"></div>
                </header>
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 pb-20">
                    <div className="size-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-black">
                        <LucideCheckCircle2 size={32} />
                    </div>
                    <h3 className="text-charcoal font-bold text-lg mb-2">All Caught Up!</h3>
                    <p className="text-black text-sm">No active alerts from tables.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-neutral-50/50 pb-32">
            {/* Header */}
            <header className="flex items-center bg-white p-4 pb-3 justify-between sticky top-0 z-10 border-b border-gray-100 shadow-sm shrink-0">
                <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <LucideBell size={18} />
                    </div>
                    <h2 className="text-charcoal text-lg font-bold leading-tight tracking-tight">Alerts</h2>
                </div>
                <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-bold">
                    {alerts.length} Active
                </div>
            </header>

            {/* Main List */}
            <main className="flex-1 overflow-y-auto p-4 space-y-3 pb-32">
                <AnimatePresence mode='popLayout'>
                    {groupedAlerts.map(alert => {
                        const details = getServiceRequestDetails(alert.request_type);
                        const Icon = details.icon;

                        return (
                            <motion.div
                                key={alert.id} // Use first ID as key
                                layout
                                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
                                className={`rounded-2xl p-4 flex items-center gap-4 shadow-sm border relative overflow-hidden group active:scale-[0.99] transition-transform bg-white border-gray-100`}
                            >
                                {/* Left Color Bar */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${details.bg.replace('bg-', 'bg-').replace('100', '500')}`} />

                                {/* Icon / Image */}
                                <div className={`relative size-12 rounded-xl shrink-0 overflow-hidden flex items-center justify-center ${details.bg} ${details.borderColor ? `border ${details.borderColor}` : ''}`}>
                                    {details.image ? (
                                        <Image
                                            src={details.image}
                                            alt={details.label}
                                            fill
                                            className={`object-cover`}
                                        />
                                    ) : (
                                        <div className={details.color}>
                                            <Icon size={22} />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className={`text-xs font-bold uppercase tracking-wider text-black`}>
                                            Table {alert.tables?.table_number || '?'}
                                        </span>
                                        {alert.request_status === 'accepted' && (
                                            <>
                                                <span className="text-[10px] text-black">•</span>
                                                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                    Accepted
                                                </span>
                                            </>
                                        )}
                                        <span className="text-[10px] text-black">•</span>
                                        <span className="text-[10px] font-medium text-black">
                                            <TimeAgo timestamp={alert.created_at} />
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <h3 className={`font-bold text-base leading-tight truncate text-charcoal`}>
                                            {details.label}
                                        </h3>
                                        {alert.count > 1 && (
                                            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                                                x{alert.count}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleTransferClick(alert.ids)}
                                        className="size-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 text-black rounded-full active:scale-95 transition-all border border-gray-100"
                                        aria-label="Transfer Task"
                                    >
                                        <LucideTransfer size={18} />
                                    </button>
                                    {alert.request_status === 'accepted' ? (
                                        <button
                                            onClick={() => handleMarkServed(alert.ids)}
                                            className="px-4 py-2 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-xs font-bold rounded-full shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all flex items-center gap-2"
                                            aria-label="Mark Served"
                                        >
                                            <LucideCheckCircle2 size={16} />
                                            Mark Served
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleAcceptRequest(alert.ids)}
                                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white text-xs font-bold rounded-full shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all flex items-center gap-2"
                                            aria-label="Accept Request"
                                        >
                                            <LucideArrowRight size={16} />
                                            Accept
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {/* Transfer Modal */}
                <AnimatePresence>
                    {transferModalOpen && (
                        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/40 backdrop-blur-sm">
                            <motion.div 
                                initial={{ y: '100%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '100%' }}
                                className="w-full max-w-md bg-white rounded-t-[32px] overflow-hidden shadow-2xl"
                            >
                                <div className="p-6">
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h3 className="text-xl font-bold text-charcoal">Transfer Task</h3>
                                            <p className="text-xs text-black">Reassign this request to a colleague</p>
                                        </div>
                                        <button 
                                            onClick={() => setTransferModalOpen(false)}
                                            className="size-10 bg-gray-100 rounded-full flex items-center justify-center text-black"
                                        >
                                            <LucideX size={20} />
                                        </button>
                                    </div>

                                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pb-6">
                                        {staffList.length > 0 ? staffList.map(staff => (
                                            <button
                                                key={staff.id}
                                                onClick={() => handleTransferExecute(staff.id)}
                                                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-100 hover:border-primary/30 hover:bg-primary/5 transition-all group"
                                            >
                                                <div className="size-12 rounded-full bg-gray-100 flex items-center justify-center text-black group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                                    <LucideUsers size={24} />
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <div className="font-bold text-charcoal">{staff.name}</div>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`h-full rounded-full ${
                                                                    staff.active_workload < 30 ? 'bg-green-500' :
                                                                    staff.active_workload < 70 ? 'bg-orange-500' : 'bg-red-500'
                                                                }`}
                                                                style={{ width: `${Math.min(staff.active_workload, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-bold uppercase text-black">
                                                            {staff.active_workload < 30 ? 'Low Load' :
                                                             staff.active_workload < 70 ? 'Med Load' : 'High Load'}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="size-8 rounded-full border border-gray-200 flex items-center justify-center text-black group-hover:border-primary group-hover:text-primary">
                                                    <LucideTransfer size={16} />
                                                </div>
                                            </button>
                                        )) : (
                                            <div className="py-10 text-center text-black">
                                                No other staff available.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {alerts.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center text-center pt-20 px-6 opacity-60"
                    >
                        <div className="size-24 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-black">
                            <LucideCheckCircle2 size={40} />
                        </div>
                        <h3 className="text-charcoal font-bold text-xl mb-2">All Caught Up!</h3>
                        <p className="text-black text-sm max-w-xs mx-auto">
                            Great job! There are no active service requests at the moment.
                        </p>
                    </motion.div>
                )}
            </main>
        </div>
    );
}
