'use client';

import { useState, useEffect } from 'react';
import { OrderService } from '@/app/services/orders';
import { LucideBell, LucideCheckCircle } from 'lucide-react';
import Image from 'next/image';
import { getServiceRequestDetails } from '@/app/lib/service-utils';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

interface ServiceRequest {
    id: number;
    table_id: number;
    tables: { table_number: string };
    request_type: string;
    status: string;
    created_at: string;
    quantity?: number;
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
    const [alerts, setAlerts] = useState<ServiceRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const loadAlerts = async () => {
        try {
            const activeRequests = await OrderService.fetchActiveServiceRequests();
            if (activeRequests) {
                setAlerts(activeRequests);
            }
        } catch (error) {
            console.error('Failed to load alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAlerts();

        // Subscribe to Service Requests
        const sub = OrderService.subscribeToServiceRequests((payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                loadAlerts(); // Refresh list
            }
        });

        return () => {
            sub.unsubscribe();
        };
    }, []);

    // Group alerts by table and request type
    const groupedAlerts = Object.values(
        alerts.reduce((acc, alert) => {
            const key = `${alert.table_id}-${alert.request_type}-${alert.status}`;
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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Checking Alerts...</p>
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
                    <div className="size-20 bg-gray-50 rounded-full flex items-center justify-center mb-4 text-gray-300">
                        <LucideCheckCircle size={32} />
                    </div>
                    <h3 className="text-charcoal font-bold text-lg mb-2">All Caught Up!</h3>
                    <p className="text-gray-500 text-sm">No active alerts from tables.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-neutral-50/50 pb-6">
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
            <main className="flex-1 overflow-y-auto p-4 space-y-3 pb-6">
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
                                        <span className={`text-xs font-bold uppercase tracking-wider text-gray-500`}>
                                            Table {alert.tables?.table_number || '?'}
                                        </span>
                                        <span className="text-[10px] text-gray-300">•</span>
                                        <span className="text-[10px] font-medium text-gray-400">
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

                                {/* Action */}
                                <button
                                    onClick={() => handleMarkServed(alert.ids)}
                                    className="px-4 py-2 bg-green-500 hover:bg-green-600 active:bg-green-700 text-white text-xs font-bold rounded-full shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all flex items-center gap-2"
                                    aria-label="Mark Served"
                                >
                                    <LucideCheckCircle size={16} />
                                    Mark Served
                                </button>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {alerts.length === 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center text-center pt-20 px-6 opacity-60"
                    >
                        <div className="size-24 bg-gray-100 rounded-full flex items-center justify-center mb-6 text-gray-300">
                            <LucideCheckCircle size={40} />
                        </div>
                        <h3 className="text-charcoal font-bold text-xl mb-2">All Caught Up!</h3>
                        <p className="text-gray-500 text-sm max-w-xs mx-auto">
                            Great job! There are no active service requests at the moment.
                        </p>
                    </motion.div>
                )}
            </main>
        </div>
    );
}
