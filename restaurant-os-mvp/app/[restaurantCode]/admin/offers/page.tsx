'use client';

import { Plus as LucidePlus, Copy as LucideCopy, Trash2 as LucideTrash2, Tags as LucideTags } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { OfferService, Offer } from '@/app/services/offers';
import { UserService } from '@/app/services/users';
import CreateOfferModal from '@/app/components/admin/CreateOfferModal';
import { getCached, setCache } from '@/app/lib/data-cache';

export default function Offers() {
    const params = useParams();
    const restaurantId = params.restaurantCode as string;
    const cachedOffers = getCached<Offer[]>(`offers-${restaurantId}`);
    const [offers, setOffers] = useState<Offer[]>(cachedOffers || []);
    const [loading, setLoading] = useState(!cachedOffers);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingOffer, setEditingOffer] = useState<Offer | null>(null);

    useEffect(() => {
        if (restaurantId) {
            loadOffers(restaurantId);
        }
    }, [restaurantId]);

    const loadOffers = async (resId?: string) => {
        const targetResId = resId || restaurantId;
        if (!targetResId) return;

        try {
            const data = await OfferService.fetchOffers(targetResId);
            setOffers(data);
            setCache(`offers-${restaurantId}`, data);
        } catch (error) {
            console.error('Failed to load offers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this offer?')) return;
        try {
            await OfferService.deleteOffer(id, restaurantId);
            loadOffers();
        } catch (error) {
            alert('Failed to delete offer');
        }
    };

    return (
        <div className="p-8 flex flex-col h-screen space-y-7 overflow-hidden">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-black tracking-tight">Coupons and Offers</h2>
                    <p className="text-sm font-medium text-black mt-1">Manage promotional coupons, promo codes, and special discounts.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingOffer(null);
                        setIsCreateModalOpen(true);
                    }}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                >
                    <LucidePlus size={16} />
                    Create New Offer
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 pb-8">

            {loading ? (
                <div className="text-center py-10 text-black">Loading offers...</div>
            ) : offers.length === 0 ? (
                <div className="text-center py-10 text-black">No offers found.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {offers.map((offer) => (
                        <div key={offer.id} className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                        <LucideTags size={24} />
                                    </div>
                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${offer.status === 'active' ? 'bg-green-100 text-green-700' :
                                        offer.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : 'bg-neutral-100 text-black'
                                        }`}>
                                        {offer.status}
                                    </span>
                                </div>

                                <div className="flex items-baseline gap-2 mb-1">
                                    <h3 className="text-2xl font-mono font-bold text-black">{offer.code}</h3>
                                    <button className="text-black hover:text-blue-600"><LucideCopy size={14} /></button>
                                </div>
                                <h4 className="text-sm font-black text-black">{offer.title}</h4>
                                <p className="text-[11px] text-black mt-0.5 line-clamp-1">{offer.description}</p>
                                <p className="text-black font-bold text-xs mt-2">
                                    {offer.discount_type === 'flat' ? `₹${offer.discount_value} OFF` : `${offer.discount_value}% OFF`}
                                </p>
                                
                                {offer.end_datetime && (
                                    <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-orange-600 uppercase">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse" />
                                        Expires: {new Date(offer.end_datetime).toLocaleDateString()} {new Date(offer.end_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                )}

                                <div className="mt-6 pt-4 border-t border-neutral-100 flex justify-between items-center text-sm">
                                    <span className="text-black"><strong className="text-black">{offer.usage_count}</strong> times used</span>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => {
                                                setEditingOffer(offer);
                                                setIsCreateModalOpen(true);
                                            }}
                                            className="text-blue-600 hover:underline"
                                        >
                                            Edit
                                        </button>
                                        <span className="text-black">|</span>
                                        <button onClick={() => handleDelete(offer.id)} className="text-red-600 hover:underline">Delete</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            </div>

            <CreateOfferModal
                isOpen={isCreateModalOpen}
                onClose={() => {
                    setIsCreateModalOpen(false);
                    setEditingOffer(null);
                }}
                onSuccess={() => loadOffers()}
                restaurantId={restaurantId || ''}
                offer={editingOffer}
            />
        </div>
    );
}
