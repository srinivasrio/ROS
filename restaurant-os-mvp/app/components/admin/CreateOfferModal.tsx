'use client';

import { useState } from 'react';
import { LucideX, LucideLoader2 } from 'lucide-react';
import { OfferService, Offer } from '@/app/services/offers';

interface CreateOfferModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateOfferModal({ isOpen, onClose, onSuccess }: CreateOfferModalProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        discount_type: 'percentage' as Offer['discount_type'],
        discount_value: 0,
        status: 'active' as Offer['status']
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await OfferService.createOffer(formData);
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to create offer. Code might be duplicate.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-neutral-100">
                    <h3 className="text-lg font-bold text-neutral-900">Create New Offer</h3>
                    <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
                        <LucideX size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Offer Code</label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. WELCOME10"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase font-mono"
                            value={formData.code}
                            onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">Discount Type</label>
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
                            <label className="block text-sm font-medium text-neutral-700 mb-1">Value</label>
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

                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
                        <select
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.status}
                            onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                        >
                            <option value="active">Active</option>
                            <option value="paused">Paused</option>
                        </select>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-neutral-300 text-neutral-700 font-medium rounded-lg hover:bg-neutral-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center"
                        >
                            {loading ? <LucideLoader2 className="animate-spin" size={18} /> : 'Create Offer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
