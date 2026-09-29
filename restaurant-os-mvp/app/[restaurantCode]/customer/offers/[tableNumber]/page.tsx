'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { 
    LucideChevronLeft, 
    LucideTicket, 
    LucidePercent, 
    LucideClock, 
    LucideCopy,
    LucideTimer,
    CheckCircle as LucideCheckCircle,
    Sparkles as LucideSparkles,
    X as LucideX
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { SharedSkeleton } from '@/components/customer/SharedSkeleton';
import { copyToClipboard } from '@/lib/utils';
import { SharedOfferDetailModal } from '@/components/shared/details';

export default function AllOffersPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const idParam = searchParams?.get('id') || searchParams?.get('offer');
    const restaurantId = (params.restaurantCode || params.restaurantId) as string;
    const tableNumber = (params.tableNumber || '1') as string;

    const [offers, setOffers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [selectedOffer, setSelectedOffer] = useState<any>(null);

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

    const handleCopyCode = async (code: string, offerId: string) => {
        const success = await copyToClipboard(code);
        if (success) {
            setCopiedId(offerId);
            toast.success(`Coupon code ${code} copied!`, {
                duration: 2000,
                position: 'bottom-center',
                icon: <LucideCheckCircle size={16} className="text-emerald-500" />,
            });
            setTimeout(() => setCopiedId(null), 2000);
        } else {
            toast.info(`Coupon code: ${code}`);
        }
    };

    const handledOfferParamRef = useRef<string | null>(null);

    const clearOfferParam = useCallback(() => {
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (url.searchParams.has('id') || url.searchParams.has('offer')) {
                url.searchParams.delete('id');
                url.searchParams.delete('offer');
                const cleanSearch = url.searchParams.toString();
                const cleanUrl = url.pathname + (cleanSearch ? `?${cleanSearch}` : '');
                window.history.replaceState(null, '', cleanUrl);
                router.replace(cleanUrl, { scroll: false });
            }
        }
    }, [router]);

    useEffect(() => {
        if (!idParam) {
            handledOfferParamRef.current = null;
        }
    }, [idParam]);

    // Automatically select and highlight the exact offer record if redirected from banner (ONCE per navigation)
    useEffect(() => {
        if (!idParam || offers.length === 0) return;
        if (handledOfferParamRef.current === String(idParam)) return;

        const found = offers.find(o => 
            String(o.id) === String(idParam) ||
            o.code?.toLowerCase() === String(idParam).toLowerCase() ||
            o.coupon_code?.toLowerCase() === String(idParam).toLowerCase() ||
            o.title?.toLowerCase() === String(idParam).toLowerCase()
        );
        if (found) {
            handledOfferParamRef.current = String(idParam);
            setSelectedOffer(found);
            const code = found.code || found.coupon_code || 'PROMO';
            handleCopyCode(code, found.id);
            clearOfferParam();
        } else if (!loading) {
            handledOfferParamRef.current = String(idParam);
            clearOfferParam();
            toast.error('The selected offer is no longer available');
        }
    }, [idParam, offers, loading, clearOfferParam]);

    if (loading) {
        return (
            <div className="min-h-screen bg-transparent p-4">
                <header className="bg-white/60 backdrop-blur-xl rounded-2xl px-4 py-3 border border-white/70 mb-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/60 rounded-full animate-pulse" />
                        <div className="flex-1 space-y-2">
                            <div className="h-5 bg-white/60 rounded-full w-32 animate-pulse" />
                            <div className="h-3 bg-white/60 rounded-full w-20 animate-pulse" />
                        </div>
                    </div>
                </header>
                <main className="grid grid-cols-2 gap-3.5">
                    <SharedSkeleton count={4} />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-transparent p-4 pb-28">
            {/* Header */}
            <header className="bg-white/60 backdrop-blur-2xl sticky top-2 z-30 border border-white/80 rounded-2xl px-4 py-3 shadow-lg shadow-indigo-100/30 mb-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-xl bg-white/70 hover:bg-white border border-white/80 text-slate-800 transition-all active:scale-95 cursor-pointer shadow-xs"
                    >
                        <LucideChevronLeft size={18} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-base font-extrabold text-slate-900 tracking-tight">Coupons & Offers</h1>
                        <p className="text-[11px] font-semibold text-slate-600">
                            {offers.length} {offers.length === 1 ? 'offer' : 'offers'} available
                        </p>
                    </div>
                    <div className="p-2.5 bg-[#32CD32] rounded-xl text-white shadow-md shadow-[#32CD32]/25">
                        <LucideTicket size={20} />
                    </div>
                </div>
            </header>

            {/* 1:1 Small Square Cards Grid Container */}
            <main className="max-w-md mx-auto">
                {offers.length === 0 ? (
                    <div className="text-center py-16 px-4 bg-white/40 backdrop-blur-2xl rounded-[32px] border border-white/70 shadow-xl">
                        <div className="inline-flex p-4 rounded-2xl bg-lime-50 text-[#28a728] mb-3 border border-lime-200 shadow-sm">
                            <LucideTicket size={36} />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-1">No active coupons</h3>
                        <p className="text-xs text-slate-600">Check back soon for new special deals!</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3.5 w-full">
                        <AnimatePresence>
                            {offers.map((offer, idx) => {
                                const code = offer.code || offer.coupon_code || 'PROMO';
                                const isCopied = copiedId === (offer.id || idx);

                                return (
                                    <motion.div
                                        key={offer.id || idx}
                                        initial={{ opacity: 0, scale: 0.92 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.04 }}
                                        className="relative aspect-square bg-gradient-to-br from-[#32CD32] via-[#32CD32] to-[#28a728] rounded-[24px] p-3.5 shadow-[0_4px_20px_-2px_rgba(50,205,50,0.38)] hover:shadow-[0_8px_24px_-2px_rgba(50,205,50,0.48)] text-white flex flex-col justify-between overflow-hidden transition-all duration-300 group cursor-pointer select-none"
                                        onClick={() => {
                                            clearOfferParam();
                                            setSelectedOffer(offer);
                                            handleCopyCode(code, offer.id || idx);
                                        }}
                                    >
                                        {/* Decorative background curves */}
                                        <div className="absolute -right-6 -bottom-6 size-28 rounded-full bg-white/15 pointer-events-none" />
                                        <div className="absolute right-8 top-0 size-12 rounded-full bg-white/10 pointer-events-none" />

                                        {/* Left & Right Ticket Edge Notches */}
                                        <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-[#EEF2F6] pointer-events-none shadow-inner z-10" />
                                        <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 size-3.5 rounded-full bg-[#EEF2F6] pointer-events-none shadow-inner z-10" />

                                        {/* Top Info */}
                                        <div className="relative z-10">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/20 backdrop-blur-md text-[9px] font-bold text-white uppercase tracking-wider">
                                                    <LucideSparkles className="size-2.5 fill-white" />
                                                    <span>{offer.discount_type === 'flat' ? `₹${offer.discount_value} OFF` : `${offer.discount_value}% OFF`}</span>
                                                </span>
                                            </div>

                                            <h3 className="font-extrabold text-white text-xs line-clamp-2 leading-snug tracking-tight mb-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.25)]">
                                                {offer.title || (offer.discount_type === 'flat' ? `Flat ₹${offer.discount_value} Off` : `${offer.discount_value}% Savings`)}
                                            </h3>
                                            
                                            {offer.description && (
                                                <p className="text-[10px] text-white/90 line-clamp-1 font-medium drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)]">
                                                    {offer.description}
                                                </p>
                                            )}
                                        </div>

                                        {/* Bottom Action Box */}
                                        <div className="relative z-10 bg-black/30 backdrop-blur-md border border-white/25 rounded-xl p-2 flex items-center justify-between transition-all active:scale-[0.96]">
                                            <div className="flex flex-col min-w-0 pr-1">
                                                <span className="text-[7px] font-extrabold text-lime-200 uppercase tracking-widest">CODE</span>
                                                <span className="font-mono text-xs font-black text-white tracking-wider truncate uppercase">
                                                    {code}
                                                </span>
                                            </div>

                                            <div className="bg-white text-slate-900 p-1.5 rounded-lg shadow-xs shrink-0 flex items-center justify-center">
                                                {isCopied ? <LucideCheckCircle size={12} className="text-[#28a728]" /> : <LucideCopy size={12} />}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </main>

            {/* Standardized Luxury Offer Detail Modal */}
            <SharedOfferDetailModal
                offer={selectedOffer}
                onClose={() => {
                    setSelectedOffer(null);
                    clearOfferParam();
                }}
                restaurantCode={restaurantId}
                tableNumber={tableNumber}
            />
        </div>
    );
}
