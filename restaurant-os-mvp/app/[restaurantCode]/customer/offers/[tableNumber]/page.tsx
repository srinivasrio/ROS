'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { HomepageBuilderService } from '@/app/services/homepage-builder.service';
import { 
    LucideChevronLeft, 
    LucideTicket, 
    LucidePercent, 
    LucideClock, 
    LucideInfo, 
    LucideChevronRight, 
    LucideCopy,
    LucideTimer,
    CheckCircle as LucideCheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { SharedSkeleton } from '@/app/components/customer/SharedSkeleton';

// ─── Countdown Timer Component ───
const CountdownTimer = ({ expiryDate }: { expiryDate: string }) => {
    const [timeLeft, setTimeLeft] = useState<{ d: number, h: number, m: number, s: number } | null>(null);

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const distance = new Date(expiryDate).getTime() - now;

            if (distance < 0) {
                clearInterval(timer);
                setTimeLeft(null);
                return;
            }

            setTimeLeft({
                d: Math.floor(distance / (1000 * 60 * 60 * 24)),
                h: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                m: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
                s: Math.floor((distance % (1000 * 60)) / 1000)
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [expiryDate]);

    if (!timeLeft) return null;

    return (
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100 mt-2 self-start animate-pulse">
            <LucideTimer size={12} className="shrink-0" />
            <span>
                Ends in: {timeLeft.d > 0 ? `${timeLeft.d}d ` : ''}{timeLeft.h.toString().padStart(2, '0')}:{timeLeft.m.toString().padStart(2, '0')}:{timeLeft.s.toString().padStart(2, '0')}
            </span>
        </div>
    );
};

export default function AllOffersPage() {
    const params = useParams();
    const router = useRouter();
    const restaurantId = (params.restaurantCode || params.restaurantId) as string;
    const tableNumber = params.tableNumber as string;

    const [offers, setOffers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        const loadOffers = async () => {
            try {
                const data = await HomepageBuilderService.getOffers(restaurantId);
                // Filter active offers only (status and expiry)
                const activeOffers = (data || []).filter((o: any) => 
                    o.status === 'active' && 
                    (!o.end_datetime || new Date(o.end_datetime) > new Date())
                );
                setOffers(activeOffers);
            } catch (err) {
                console.error('Failed to load offers:', err);
            } finally {
                setLoading(false);
            }
        };
        loadOffers();
    }, [restaurantId]);

    const handleCopyCode = (code: string, offerId: string) => {
        navigator.clipboard.writeText(code).then(() => {
            setCopiedId(offerId);
            toast.success('Coupon code copied!', {
                duration: 2000,
                position: 'bottom-center',
                icon: <LucideCheckCircle size={16} className="text-green-500" />,
            });
            setTimeout(() => setCopiedId(null), 2000);
        }).catch(() => {
            toast.error('Failed to copy');
        });
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
                        <h1 className="text-lg font-black text-black tracking-tight">Coupons & Offers</h1>
                        <p className="text-[10px] font-bold text-black uppercase tracking-widest">
                            {offers.length} {offers.length === 1 ? 'offer' : 'offers'} available
                        </p>
                    </div>
                    <div className="p-2 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl">
                        <LucideTicket size={20} className="text-emerald-500" />
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="p-4 space-y-4">
                {offers.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="inline-block p-5 rounded-2xl bg-emerald-50 mb-4">
                            <LucideTicket className="text-emerald-300" size={40} />
                        </div>
                        <h3 className="text-lg font-bold text-black mb-1">No offers right now</h3>
                        <p className="text-black text-sm">Check back later for exclusive deals!</p>
                    </div>
                ) : (
                    <AnimatePresence>
                        {offers.map((offer, idx) => (
                            <motion.div
                                key={offer.id || idx}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
                            >
                                {/* Banner Image */}
                                {offer.banner_image && (
                                    <div className="relative h-40 w-full">
                                        <img
                                            src={offer.banner_image}
                                            alt={offer.title}
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
                                    </div>
                                )}

                                {/* Offer Content */}
                                <div className="p-4">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-md">
                                            {offer.discount_type === 'flat' ? `₹${offer.discount_value} OFF` : `${offer.discount_value}% OFF`}
                                        </span>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="p-2.5 bg-emerald-50 rounded-xl shrink-0">
                                            <LucidePercent size={20} className="text-emerald-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-black text-black text-base">{offer.title}</h3>
                                            <p className="text-sm text-black mt-1 line-clamp-2">
                                                {offer.description}
                                            </p>
                                            
                                            {offer.end_datetime && <CountdownTimer expiryDate={offer.end_datetime} />}
                                        </div>
                                    </div>

                                    {/* Coupon Code */}
                                    {offer.code && (
                                        <div className="mt-3 flex items-center gap-2">
                                            <div className="flex-1 bg-emerald-50 border border-dashed border-emerald-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                                                <span className="font-black text-emerald-700 tracking-widest text-sm">
                                                    {offer.code}
                                                </span>
                                                <button
                                                    onClick={() => handleCopyCode(offer.code, offer.id)}
                                                    className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors"
                                                >
                                                    {copiedId === offer.id ? (
                                                        <LucideCheckCircle size={16} className="text-emerald-600" />
                                                    ) : (
                                                        <LucideCopy size={16} className="text-emerald-500" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Expiry */}
                                    {offer.end_datetime && (
                                        <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-black uppercase tracking-widest">
                                            <LucideClock size={10} />
                                            <span>
                                                Expires {new Date(offer.end_datetime).toLocaleDateString('en-IN', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric'
                                                })}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </main>
        </div>
    );
}
