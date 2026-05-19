'use client';

import { useState, useEffect } from 'react';
import { X as LucideX, Loader2 as LucideLoader2 } from 'lucide-react';
import { OfferService, Offer } from '@/app/services/offers';

interface CreateOfferModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    restaurantId: string;
    offer?: Offer | null;
}

export default function CreateOfferModal({ isOpen, onClose, onSuccess, restaurantId, offer }: CreateOfferModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        code: offer?.code || '',
        title: offer?.title || '',
        description: offer?.description || '',
        discount_type: (offer?.discount_type || 'percentage') as Offer['discount_type'],
        discount_value: offer?.discount_value || 0,
        max_discount: offer?.max_discount || '',
        status: (offer?.status || 'active') as Offer['status'],
        end_datetime: offer?.end_datetime ? new Date(offer.end_datetime).toISOString().slice(0, 16) : ''
    });

    // Reset form when offer changes or modal opens
    useEffect(() => {
        if (offer) {
            setFormData({
                code: offer.code,
                title: offer.title || '',
                description: offer.description || '',
                discount_type: offer.discount_type,
                discount_value: offer.discount_value,
                max_discount: offer.max_discount || '',
                status: offer.status,
                end_datetime: offer.end_datetime ? new Date(offer.end_datetime).toISOString().slice(0, 16) : ''
            });
        } else {
            setFormData({
                code: '',
                title: '',
                description: '',
                discount_type: 'percentage',
                discount_value: 0,
                max_discount: '',
                status: 'active',
                end_datetime: ''
            });
        }
    }, [offer, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                max_discount: formData.discount_type === 'percentage' && formData.max_discount ? Number(formData.max_discount) : null,
                end_datetime: formData.end_datetime ? new Date(formData.end_datetime).toISOString() : null,
                restaurant_id: restaurantId
            };

            if (offer?.id) {
                await OfferService.updateOffer(offer.id, restaurantId, payload);
            } else {
                await OfferService.createOffer(payload as any);
            }
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert(`Failed to ${offer ? 'update' : 'create'} offer. Code might be duplicate.`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-neutral-100">
                    <h3 className="text-lg font-bold text-black">{offer ? 'Edit' : 'Create New'} Coupon/Offer</h3>
                    <button onClick={onClose} className="text-black hover:text-black">
                        <LucideX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
                    <div>
                        <label className="block text-sm font-medium text-black mb-1">Offer Code</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. WELCOME10"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono"
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-black mb-1">Title</label>
                        <input
                            type="text"
                            placeholder="e.g. Welcome Discount"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-black mb-1">Description</label>
                        <textarea
                            placeholder="e.g. Get 10% off on your first order"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px] resize-none"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Discount Type</label>
                            <select
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.discount_type}
                                onChange={e => setFormData({ ...formData, discount_type: e.target.value as any })}
                            >
                                <option value="percentage">Percentage (%)</option>
                                <option value="flat">Flat Amount (₹)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Value</label>
                            <input
                                type="number"
                                required
                                min="1"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.discount_value}
                                onChange={e => setFormData({ ...formData, discount_value: parseInt(e.target.value) || 0 })}
                            />
                        </div>
                    </div>

                    {formData.discount_type === 'percentage' && (
                        <div>
                            <label className="block text-sm font-medium text-black mb-1">Maximum Discount (₹) (Optional)</label>
                            <input
                                type="number"
                                min="1"
                                placeholder="e.g. 100"
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={formData.max_discount}
                                onChange={e => setFormData({ ...formData, max_discount: e.target.value ? parseInt(e.target.value) : '' })}
                            />
                            <p className="text-[10px] text-black mt-1 uppercase font-bold">Cap the maximum discount amount</p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-black mb-1">Status</label>
                        <select
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                        >
                            <option value="active">Active</option>
                            <option value="paused">Paused</option>
                            <option value="expired">Expired</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-black mb-1">Expiry Date & Time (Optional)</label>
                        <input
                            type="datetime-local"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.end_datetime}
                            onChange={e => setFormData({ ...formData, end_datetime: e.target.value })}
                        />
                        <p className="text-[10px] text-black mt-1 uppercase font-bold">Leave blank for no expiry</p>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-neutral-300 text-black font-medium rounded-lg hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center"
                        >
                            {loading ? <LucideLoader2 className="animate-spin" size={18} /> : offer ? 'Update Offer' : 'Create Coupon/Offer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
