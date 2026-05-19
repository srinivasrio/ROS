'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { OrderService } from '@/app/services/orders';

interface SharedServicePopupCardProps {
    service: any;
    isOpen: boolean;
    onClose: () => void;
    restaurantId: string;
    tableNumber: string;
    onSuccess?: () => void;
}

export function SharedServicePopupCard({
    service,
    isOpen,
    onClose,
    restaurantId,
    tableNumber,
    onSuccess
}: SharedServicePopupCardProps) {
    const [quantity, setQuantity] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset quantity when service changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setQuantity(1);
            setIsSubmitting(false);
        }
    }, [isOpen, service]);

    if (!service) return null;

    const sTitle = service.service_title || service.label || service.name;
    const sSubtitle = service.service_subtitle || service.sub_label || '';
    const sImage = service.service_image || service.image_url;
    const isCountable = service.countable || false;

    const handleSubmit = async () => {
        if (!tableNumber) {
            toast.error('Table number not found');
            return;
        }
        
        setIsSubmitting(true);
        try {
            await OrderService.submitServiceRequest(
                tableNumber, 
                service.service_key || service.id, 
                restaurantId, 
                isCountable ? quantity : 1
            );
            toast.success('Request Sent!', {
                description: `Your request for ${sTitle} has been received.`,
                duration: 3000,
            });
            onClose();
            onSuccess?.();
        } catch (error) {
            console.error('Failed to submit service request:', error);
            toast.error('Failed to send request');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="text-center mb-6">
                            <div className="relative size-24 rounded-2xl mx-auto mb-4 overflow-hidden bg-neutral-100 border border-neutral-100 shadow-md">
                                {sImage ? (
                                    <Image
                                        src={sImage}
                                        alt={sTitle || 'Service'}
                                        fill
                                        sizes="96px"
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <LucideIcons.Bell size={32} className="text-black" />
                                    </div>
                                )}
                            </div>
                            <h3 className="text-xl font-black mb-2 text-black">{sTitle}</h3>
                            {sSubtitle && (
                                <p className="text-sm text-black line-clamp-2">{sSubtitle}</p>
                            )}
                        </div>

                        {isCountable && (
                            <div className="flex items-center justify-between bg-neutral-50 p-4 rounded-2xl mb-6 border border-neutral-100">
                                <span className="font-bold text-black">Quantity</span>
                                <div className="flex items-center gap-4">
                                    <button 
                                        type="button"
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="size-10 rounded-full bg-white border border-neutral-200 flex items-center justify-center active:scale-95 transition-transform shadow-sm"
                                    >
                                        <LucideIcons.Minus size={18} className="text-black" />
                                    </button>
                                    <span className="w-8 text-center font-black text-lg text-black">{quantity}</span>
                                    <button 
                                        type="button"
                                        onClick={() => setQuantity(quantity + 1)}
                                        className="size-10 rounded-full bg-neutral-900 flex items-center justify-center active:scale-95 transition-transform shadow-lg"
                                    >
                                        <LucideIcons.Plus size={18} className="text-white" />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={handleSubmit}
                                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-neutral-900 text-white hover:bg-neutral-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
                            >
                                {isSubmitting ? 'Sending...' : 'Confirm Request'}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-neutral-50 text-black hover:bg-neutral-100 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
