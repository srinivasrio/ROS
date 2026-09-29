'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Camera, Loader2, ImageIcon, CheckCircle2, AlertCircle, Link2 } from 'lucide-react';
import { BannerService, Banner } from '@/services/banner.service';
import BannerModal from './BannerModal';
import { toast } from 'sonner';

interface BannerManagerProps {
    restaurantId: string;
    banners: Banner[];
    /** Called after any CRUD so parent can refresh banner list */
    onBannersChange: () => void;
    currentBannerIndex: number;
    homepageData?: any;
}

type ActionState = 'idle' | 'uploading' | 'success' | 'error';

export function BannerManager({
    restaurantId,
    banners,
    onBannersChange,
    currentBannerIndex,
    homepageData,
}: BannerManagerProps) {
    const [actionState, setActionState] = useState<ActionState>('idle');
    const [actionMessage, setActionMessage] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');

    const editFileInputRef = useRef<HTMLInputElement>(null);
    const editingBannerRef = useRef<Banner | null>(null);

    const currentBanner = banners[currentBannerIndex] ?? banners[0];

    const handleEditBannerImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        const banner = editingBannerRef.current;
        if (!file || !banner) return;

        setActionState('uploading');
        setActionMessage('Replacing image...');
        try {
            await BannerService.replaceBannerImage(banner.id, restaurantId, file, banner.image_url);
            setActionState('success');
            setActionMessage('Image updated!');
            toast.success('Banner image updated!');
            onBannersChange();
        } catch (err: any) {
            setActionState('error');
            setActionMessage(err?.message || 'Upload failed');
            toast.error(`Failed to replace image: ${err?.message || 'Unknown error'}`);
        } finally {
            editingBannerRef.current = null;
            if (editFileInputRef.current) editFileInputRef.current.value = '';
            setTimeout(() => setActionState('idle'), 2000);
        }
    };

    const handleDeleteBanner = async () => {
        if (!currentBanner?.id) return;

        setActionState('uploading');
        setActionMessage('Deleting banner...');
        try {
            await BannerService.deleteBanner(currentBanner.id, true);
            setActionState('success');
            setActionMessage('Deleted!');
            toast.success('Banner deleted!');
            onBannersChange();
        } catch (err: any) {
            setActionState('error');
            setActionMessage(err?.message || 'Delete failed');
            toast.error(`Failed to delete banner: ${err?.message || 'Unknown error'}`);
        } finally {
            setTimeout(() => setActionState('idle'), 2000);
        }
    };

    const triggerEditImage = () => {
        editingBannerRef.current = currentBanner ?? null;
        editFileInputRef.current?.click();
    };

    const openAddModal = () => {
        setModalMode('create');
        setModalOpen(true);
    };

    const openEditModal = () => {
        setModalMode('edit');
        setModalOpen(true);
    };

    const isLoading = actionState === 'uploading';

    return (
        <>
            {/* Status badge */}
            <AnimatePresence>
                {actionState !== 'idle' && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-white shadow-lg"
                        style={{
                            backgroundColor:
                                actionState === 'uploading' ? '#f97316' :
                                actionState === 'success' ? '#10b981' : '#ef4444'
                        }}
                    >
                        {actionState === 'uploading' && <Loader2 size={12} className="animate-spin" />}
                        {actionState === 'success' && <CheckCircle2 size={12} />}
                        {actionState === 'error' && <AlertCircle size={12} />}
                        {actionMessage}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Control buttons */}
            <div className="absolute top-4 right-4 flex gap-2 z-30">
                {/* Add new banner */}
                <button
                    disabled={isLoading}
                    className="p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-orange-600 transition-colors border border-white/20 disabled:opacity-50 shadow-md"
                    onClick={openAddModal}
                    title="Add New Banner with Destination"
                >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                </button>

                {/* Edit current banner destination & details */}
                {currentBanner && (
                    <button
                        disabled={isLoading}
                        className="p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-orange-600 transition-colors border border-white/20 disabled:opacity-50 shadow-md"
                        onClick={openEditModal}
                        title="Edit Destination & CTA"
                    >
                        <Link2 size={16} />
                    </button>
                )}

                {/* Edit current banner image */}
                {currentBanner && (
                    <button
                        disabled={isLoading}
                        className="p-2 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/80 transition-colors border border-white/20 disabled:opacity-50 shadow-md"
                        onClick={triggerEditImage}
                        title="Replace Banner Image File"
                    >
                        <Camera size={16} />
                    </button>
                )}

                {/* Delete current banner */}
                {currentBanner && (
                    <button
                        disabled={isLoading}
                        className="p-2 bg-black/50 backdrop-blur-md rounded-full text-red-400 hover:bg-black/80 hover:text-red-500 transition-colors border border-white/20 disabled:opacity-50 shadow-md"
                        onClick={handleDeleteBanner}
                        title="Delete Banner"
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            {/* Hidden file input for quick image replacement */}
            <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleEditBannerImage}
            />

            {/* Banner creation / editing modal */}
            <BannerModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={onBannersChange}
                mode={modalMode}
                initialBanner={currentBanner}
                restaurantId={restaurantId}
                homepageData={homepageData}
            />
        </>
    );
}

// ─── Empty state for admin when no banners ───────────────────────────────────

interface EmptyBannerStateProps {
    restaurantId: string;
    onBannersChange: () => void;
    homepageData?: any;
}

export function EmptyBannerState({ restaurantId, onBannersChange, homepageData }: EmptyBannerStateProps) {
    const [modalOpen, setModalOpen] = useState(false);

    return (
        <>
            <div
                className="relative aspect-[16/9] sm:aspect-[21/9] rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-dashed border-neutral-300 bg-neutral-50 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all group"
                onClick={() => setModalOpen(true)}
            >
                <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <ImageIcon size={28} className="text-orange-500" />
                </div>
                <div className="text-center px-4">
                    <p className="text-sm font-black text-black">
                        Add Your First Banner
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        Click to upload image &amp; configure clickable destination
                    </p>
                </div>
            </div>

            <BannerModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                onSuccess={onBannersChange}
                mode="create"
                restaurantId={restaurantId}
                homepageData={homepageData}
            />
        </>
    );
}
