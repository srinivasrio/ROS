'use client';

import { LucidePlus, LucideCopy, LucideTrash2, LucideTags } from 'lucide-react';
import { useEffect, useState } from 'react';
import { OfferService, Offer } from '@/app/services/offers';
import CreateOfferModal from '@/app/components/admin/CreateOfferModal';

export default function Offers() {
    const [offers, setOffers] = useState<Offer[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    useEffect(() => {
        loadOffers();
    }, []);

    const loadOffers = async () => {
        try {
            const data = await OfferService.fetchOffers();
            setOffers(data);
        } catch (error) {
            console.error('Failed to load offers:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this offer?')) return;
        try {
            await OfferService.deleteOffer(id);
            loadOffers();
        } catch (error) {
            alert('Failed to delete offer');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-neutral-900">Offers & Discounts</h2>
                    <p className="text-neutral-500">Manage coupons and promo codes.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <LucidePlus size={18} className="mr-2" />
                    Create New Offer
                </button>
            </div>

            {loading ? (
                <div className="text-center py-10 text-neutral-400">Loading offers...</div>
            ) : offers.length === 0 ? (
                <div className="text-center py-10 text-neutral-400">No offers found.</div>
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
                                        offer.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : 'bg-neutral-100 text-neutral-500'
                                        }`}>
                                        {offer.status}
                                    </span>
                                </div>

                                <div className="flex items-baseline gap-2 mb-1">
                                    <h3 className="text-2xl font-mono font-bold text-neutral-900">{offer.code}</h3>
                                    <button className="text-neutral-400 hover:text-blue-600"><LucideCopy size={14} /></button>
                                </div>
                                <p className="text-neutral-500 font-medium">
                                    {offer.discount_type === 'flat' ? `₹${offer.discount_value} OFF` : `${offer.discount_value}% OFF`}
                                </p>

                                <div className="mt-6 pt-4 border-t border-neutral-100 flex justify-between items-center text-sm">
                                    <span className="text-neutral-500"><strong className="text-neutral-900">{offer.usage_count}</strong> times used</span>
                                    <div className="flex gap-2">
                                        <button className="text-blue-600 hover:underline">Edit</button>
                                        <span className="text-neutral-300">|</span>
                                        <button onClick={() => handleDelete(offer.id)} className="text-red-600 hover:underline">Delete</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CreateOfferModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={loadOffers}
            />
        </div>
    );
}
