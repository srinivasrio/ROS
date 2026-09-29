'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import Image from 'next/image';
import { toast } from 'sonner';
import { OrderService } from '@/services/orders.service';

import { getServiceImageUrl, isVideoUrl } from '@/components/shared/homepage/ServiceCard';
import { CutleryConfirmationModal } from '@/components/customer/CutleryConfirmationModal';

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

    // Lock body scroll and handle Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!service) return null;

    const isCutlery = 
        service?.service_key === 'cutlery' ||
        service?.service_key === 'cutlery_requested' ||
        service?.id === 'cutlery' ||
        service?.id === 'cutlery_requested' ||
        service?.service_title?.toLowerCase().includes('cutlery') ||
        service?.label?.toLowerCase().includes('cutlery') ||
        service?.name?.toLowerCase().includes('cutlery');

    if (isCutlery) {
        return (
            <CutleryConfirmationModal
                isOpen={isOpen}
                onClose={onClose}
                restaurantId={restaurantId}
                tableNumber={tableNumber}
                onSuccess={onSuccess}
            />
        );
    }

    const sTitle = service.service_title || service.label || service.name || 'Service';
    const sSubtitle = service.service_subtitle || service.sub_label || '';
    const sImage = getServiceImageUrl(service);
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

    const formattedTable = tableNumber
        ? (tableNumber.toLowerCase().startsWith('table') ? tableNumber : `Table ${tableNumber}`)
        : '';

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
                    onClick={onClose}
                    role="dialog"
                    aria-modal="true"
                >
                    <motion.div
                        initial={{ scale: 0.92, y: 16 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.92, y: 16 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        style={{
                            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.4)',
                            border: '1px solid rgba(255, 255, 255, 0.85)',
                        }}
                        className="bg-[#EEF2F6] rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close Icon Button */}
                        <button
                            onClick={onClose}
                            aria-label="Close"
                            style={{
                                boxShadow: '2px 2px 5px rgba(166, 180, 200, 0.4), -2px -2px 5px rgba(255, 255, 255, 0.9)',
                                border: '1px solid rgba(255, 255, 255, 0.8)',
                            }}
                            className="absolute top-4 right-4 size-8 rounded-full bg-[#EEF2F6] text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer active:scale-95"
                        >
                            <LucideIcons.X size={16} />
                        </button>

                        <div className="text-center mb-5">
                            {/* Confirmation Badge */}
                            <div 
                                style={{
                                    boxShadow: 'inset 1px 1px 3px rgba(166, 180, 200, 0.3), inset -1px -1px 3px rgba(255, 255, 255, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.7)',
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#EEF2F6] text-orange-700 mb-3"
                            >
                                <LucideIcons.BellRing size={12} className="text-orange-600 animate-bounce" />
                                <span>Confirm Service Request</span>
                            </div>

                            <div 
                                style={{
                                    boxShadow: 'inset 2px 2px 5px rgba(166, 180, 200, 0.35), inset -2px -2px 5px rgba(255, 255, 255, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.8)',
                                }}
                                className="relative size-20 rounded-2xl mx-auto mb-3 overflow-hidden bg-[#EEF2F6] flex items-center justify-center p-2"
                            >
                                {sImage ? (
                                    isVideoUrl(sImage) ? (
                                        <video
                                            src={encodeURI(sImage)}
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                            className="w-full h-full object-contain p-1 pointer-events-none"
                                        />
                                    ) : (
                                        <img
                                            src={encodeURI(sImage)}
                                            alt={sTitle || 'Service'}
                                            className="w-full h-full object-contain p-1"
                                        />
                                    )
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <LucideIcons.Bell size={30} className="text-orange-600" />
                                    </div>
                                )}
                            </div>

                            <h3 className="text-lg font-black text-slate-800 leading-tight mb-1">
                                Request {sTitle}?
                            </h3>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-[260px] mx-auto">
                                Are you sure you want to notify staff for <span className="font-bold text-slate-800">{sTitle}</span>{formattedTable ? ` at ${formattedTable}` : ''}?
                            </p>
                        </div>

                        {isCountable && (
                            <div 
                                style={{
                                    boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.3), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.85)',
                                    border: '1px solid rgba(255, 255, 255, 0.7)',
                                }}
                                className="flex items-center justify-between bg-[#EEF2F6] p-3.5 rounded-2xl mb-5"
                            >
                                <div className="text-left">
                                    <span className="text-xs font-bold text-slate-700 block">Quantity</span>
                                    <span className="text-[10px] text-slate-400 font-medium">Select number required</span>
                                </div>
                                <div 
                                    style={{
                                        boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                        border: '1px solid rgba(255, 255, 255, 0.7)',
                                    }}
                                    className="flex items-center gap-3 bg-[#EEF2F6] p-1 rounded-2xl"
                                >
                                    <button 
                                        type="button"
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        style={{
                                            boxShadow: '2px 2px 4px rgba(234, 88, 12, 0.35)',
                                        }}
                                        className="size-9 rounded-xl bg-orange-600 text-white flex items-center justify-center active:scale-95 transition-transform hover:bg-orange-700 cursor-pointer"
                                        aria-label="Decrease quantity"
                                    >
                                        <LucideIcons.Minus size={16} strokeWidth={3} className="text-white" />
                                    </button>
                                    <span className="w-6 text-center font-black text-base text-slate-800 tabular-nums">{quantity}</span>
                                    <button 
                                        type="button"
                                        onClick={() => setQuantity(quantity + 1)}
                                        style={{
                                            boxShadow: '2px 2px 4px rgba(234, 88, 12, 0.35)',
                                        }}
                                        className="size-9 rounded-xl bg-orange-600 text-white flex items-center justify-center active:scale-95 transition-transform hover:bg-orange-700 cursor-pointer"
                                        aria-label="Increase quantity"
                                    >
                                        <LucideIcons.Plus size={16} strokeWidth={3} className="text-white" />
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    boxShadow: '3px 3px 6px rgba(166, 180, 200, 0.4), -3px -3px 6px rgba(255, 255, 255, 0.9)',
                                    border: '1px solid rgba(255, 255, 255, 0.9)',
                                }}
                                className="flex-1 py-3 px-4 rounded-xl bg-[#EEF2F6] text-slate-700 font-bold text-xs sm:text-sm active:scale-95 transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={isSubmitting}
                                onClick={handleSubmit}
                                style={{
                                    boxShadow: '4px 4px 10px rgba(234, 88, 12, 0.35), -2px -2px 6px rgba(255, 255, 255, 0.8)',
                                    border: '1px solid rgba(255, 255, 255, 0.4)',
                                }}
                                className="flex-1 py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-black text-xs sm:text-sm active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Sending...</span>
                                    </>
                                ) : (
                                    <>
                                        <LucideIcons.BellRing size={15} />
                                        <span>Confirm Request</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
