'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { HomepageBuilderService } from '@/app/services/homepage-builder.service';
import { OrderService } from '@/app/services/orders';
import { ServiceOptionsService, ServiceOption } from '@/app/services/service-options.service';
import {
    ChevronLeft as LucideChevronLeft,
    Headset as LucideHeadset,
    Image as LucideImage,
    CheckCircle as LucideCheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/app/lib/utils';
import { SharedSkeleton } from '@/app/components/customer/SharedSkeleton';
import { SharedServicePopupCard } from '@/app/components/shared/services/SharedServicePopupCard';

export default function AllServicesPage() {
    const params = useParams();
    const router = useRouter();
    const restaurantId = (params.restaurantCode || params.restaurantId) as string;
    const tableNumber = params.tableNumber as string;

    const [services, setServices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOption, setSelectedOption] = useState<any>(null);

    useEffect(() => {
        const loadServices = async () => {
            try {
                // Try to load from service_options (full service data with countable flags)
                const options = await ServiceOptionsService.fetchActive(restaurantId);
                if (options && options.length > 0) {
                    setServices(options.filter(o => o.service_key !== 'order_ready'));
                } else {
                    // Fallback to homepage services
                    const homepageServices = await HomepageBuilderService.getServices(restaurantId);
                    setServices((homepageServices || []).filter((s: any) => s.active !== false));
                }
            } catch (err) {
                console.error('Failed to load services:', err);
            } finally {
                setLoading(false);
            }
        };
        loadServices();
    }, [restaurantId]);

    const handleServiceClick = (service: any) => {
        setSelectedOption(service);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <header className="bg-white px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full animate-pulse" />
                        <div className="flex-1 space-y-2">
                            <div className="h-5 bg-gray-100 rounded-full w-32 animate-pulse" />
                            <div className="h-3 bg-gray-100 rounded-full w-20 animate-pulse" />
                        </div>
                    </div>
                </header>
                <main className="p-4">
                    <SharedSkeleton count={5} />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-100 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <LucideChevronLeft className="text-black" size={20} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-black text-black tracking-tight">Services</h1>
                        <p className="text-[10px] font-bold text-black uppercase tracking-widest">
                            {services.length} {services.length === 1 ? 'service' : 'services'} available
                        </p>
                    </div>
                    <div className="flex flex-col items-end mr-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-0.5 text-black">
                            Table
                        </p>
                        <p className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap text-black bg-black/5">
                            {tableNumber.toLowerCase().includes('table') ? tableNumber : `Table ${tableNumber}`}
                        </p>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="p-4">
                <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-black mb-1">How can we help?</h2>
                    <p className="text-black text-sm">Tap a service to notify us instantly.</p>
                </div>

                {services.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-block p-5 rounded-2xl bg-blue-50 mb-4">
                            <LucideHeadset className="text-blue-300" size={40} />
                        </div>
                        <h3 className="text-lg font-bold text-black mb-1">No services available</h3>
                        <p className="text-black text-sm">Services have not been set up yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-3">
                        <AnimatePresence>
                            {services.map((service, idx) => (
                                <motion.button
                                    key={service.id || idx}
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: idx * 0.04 }}
                                    onClick={() => handleServiceClick(service)}
                                    className={cn(
                                        "group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 active:scale-[0.98]",
                                        "bg-white/40 backdrop-blur-xl border border-white/50 shadow-xl",
                                        "hover:shadow-2xl hover:bg-white/60 flex flex-col items-center justify-center gap-3 text-center h-40"
                                    )}
                                >
                                    <div className="relative z-10 flex flex-col items-center justify-center gap-3">
                                        <div className="relative size-16 rounded-xl overflow-hidden shadow-sm transition-transform duration-300 group-hover:scale-110">
                                            {service.image_url ? (
                                                <img
                                                    src={service.image_url}
                                                    alt={service.label || service.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-neutral-100 flex items-center justify-center">
                                                    <LucideImage size={24} className="text-black" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-0.5">
                                            <h3 className="text-sm font-black leading-tight text-black">
                                                {service.label || service.name}
                                            </h3>
                                            {service.sub_label && (
                                                <p className="text-[9px] font-bold text-black uppercase tracking-widest leading-tight line-clamp-1">
                                                    {service.sub_label}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </motion.button>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </main>

            <SharedServicePopupCard
                service={selectedOption}
                isOpen={!!selectedOption}
                onClose={() => setSelectedOption(null)}
                restaurantId={restaurantId}
                tableNumber={tableNumber || ''}
            />
        </div>
    );
}
