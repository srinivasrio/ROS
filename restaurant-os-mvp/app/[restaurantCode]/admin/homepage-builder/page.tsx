'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Undo2, Redo2, Save, Loader2, Check, Smartphone, Tablet, Monitor,
    Sparkles, Eye, Layout, Palette, Settings
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { HomepageBuilderService } from '@/app/services/homepage-builder.service';
import { BannerService } from '@/app/services/banner.service';
import { MenuService } from '@/app/services/menu';
import { compressImage, validateImageFile } from '@/app/lib/image-compress';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { LoadingState } from '@/components/ui/LoadingState';
import { toast } from 'sonner';
import SharedHomepageLayout from '@/app/components/shared/homepage/SharedHomepageLayout';
import { useBuilderState } from '@/app/components/admin/homepage-builder/useBuilderState';
import { CartProvider } from '@/app/context/CartContext';
import { useRef } from 'react';

const generateId = () => {
    try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
    } catch (e) {}
    
    // Fallback UUID v4 generator
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

export default function HomepageBuilderPage() {
    const params = useParams();
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const [dataLoading, setDataLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [previewMode, setPreviewMode] = useState<'mobile' | 'tablet' | 'desktop'>('mobile');

    const { state, dispatch, undo, redo, canUndo, canRedo } = useBuilderState();

    // ─── Load Data ───
    useEffect(() => {
        if (restaurantLoading || !restaurantId) return;
        loadData();
    }, [restaurantId, restaurantLoading]);

    const loadData = async () => {
        if (!restaurantId) return;
        try {
            const homepageData = await HomepageBuilderService.getHomepageData(restaurantId, '', 'admin');

            dispatch({ type: 'SET_THEME', theme: homepageData.theme });
            dispatch({ type: 'UPDATE_PROFILE', profile: homepageData.profile });
            dispatch({ type: 'SET_SECTIONS', sections: homepageData.sections });
            dispatch({ type: 'SET_HOMEPAGE_DATA', data: homepageData });
            
            setDataLoading(false);
        } catch (err) {
            console.error('Failed to load homepage builder:', err);
            toast.error('Failed to load homepage data');
        } finally {
            setDataLoading(false);
        }
    };

    // ─── Refresh banners from DB (called after BannerService direct CRUD) ───
    const refreshBanners = useCallback(async () => {
        if (!restaurantId) return;
        try {
            const freshBanners = await BannerService.getBanners(restaurantId, false);
            dispatch({ type: 'SET_HOMEPAGE_DATA', data: { ...state.data, banners: freshBanners } });
        } catch (err) {
            console.error('[Admin] Failed to refresh banners:', err);
        }
    }, [restaurantId, dispatch, state.data]);

    // ─── Update Handlers ───
    const [uploadConfig, setUploadConfig] = useState<{ type: string; payload: any } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpdate = useCallback(async (type: string, payload: any) => {
        // Banner uploads are now handled directly by BannerManager component,
        // so we only handle non-banner uploads here.
        if (type === 'upload_banner') {
            // Legacy path: still supported via file input for edge cases
            setUploadConfig({ type, payload });
            fileInputRef.current?.click();
            return;
        }

        if (type.includes('upload')) {
            setUploadConfig({ type, payload });
            fileInputRef.current?.click();
            return;
        }

        if (type === 'sections') {
            dispatch({ type: 'SET_SECTIONS', sections: payload });
        } else if (type === 'profile') {
            dispatch({ type: 'UPDATE_PROFILE', profile: payload });
        } else if (type === 'theme') {
            dispatch({ type: 'UPDATE_THEME', updates: payload });
        } else if (type === 'update_section_style') {
            dispatch({ type: 'UPDATE_SECTION_STYLE', section_name: payload.section_name, style: payload.style });
        } else if (type === 'delete_special') {
            dispatch({ type: 'REMOVE_SECTION_ITEM', section: 'specials', id: payload.id });
        } else if (type === 'delete_combo') {
            dispatch({ type: 'REMOVE_SECTION_ITEM', section: 'combos', id: payload.id });
        } else if (type === 'delete_banner') {
            dispatch({ type: 'REMOVE_SECTION_ITEM', section: 'banners', id: payload.id });
        } else if (type === 'add_element') {
            dispatch({ type: 'ADD_ELEMENT', sectionId: payload.sectionId, element: payload.element });
        } else if (type === 'remove_element') {
            dispatch({ type: 'REMOVE_ELEMENT', sectionId: payload.sectionId, elementId: payload.elementId });
        } else if (type === 'update_element_content') {
            dispatch({ type: 'UPDATE_ELEMENT_CONTENT', sectionId: payload.sectionId, elementId: payload.elementId, content: payload.content });
        } else {
            // Section specific updates - map "update_banner" to "banners", etc.
            const sectionMap: Record<string, string> = {
                'update_banner': 'banners',
                'update_category': 'categories',
                'update_service': 'services',
                'update_special': 'specials',
                'update_combo': 'combos',
                'update_offer': 'offers',
                'banners': 'banners',
                'categories': 'categories',
                'services': 'services',
                'specials': 'specials',
                'combos': 'combos',
                'offers': 'offers'
            };
            const section = sectionMap[type] || type;
            dispatch({ type: 'UPDATE_SECTION_DATA', section, payload });
        }
    }, [dispatch]);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadConfig) return;

        const validationError = validateImageFile(file);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        try {
            const compressed = await compressImage(file);
            const imageUrl = await MenuService.uploadMenuImage(compressed.file);
            
            const { type, payload } = uploadConfig;
            
            // Helper to update or add to section data
            const updateOrAdd = (section: string, fieldName: string) => {
                const currentData = state.data[section] || [];
                const exists = currentData.some((item: any) => item.id === payload.id);
                
                if (exists && payload.id !== 'empty') {
                    dispatch({ 
                        type: 'UPDATE_SECTION_DATA', 
                        section, 
                        payload: { id: payload.id, data: { [fieldName]: imageUrl } } 
                    });
                } else {
                    // Create new item
                    const newItem = {
                        id: generateId(),
                        restaurant_id: restaurantId,
                        [fieldName]: imageUrl,
                        // Add some defaults based on type
                        ...(section === 'banners' ? { title: 'New Offer', description: 'Limited time', active: true, order_index: currentData.length } : {}),
                        ...(section === 'categories' ? { name: 'New Category', active: true, order_index: currentData.length } : {}),
                        ...(section === 'specials' ? { title: 'New Special', price: 0, active: true, special_type: 'single', items: [] } : {}),
                        ...(section === 'combos' ? { title: 'New Combo', price: 0, active: true, special_type: 'combo', items: [] } : {}),
                        ...(section === 'offers' ? { title: 'New Offer', description: 'Special discount just for you', code: 'SAVE10', active: true } : {}),
                        ...(section === 'services' ? { service_title: 'New Service', active: true, service_image: '', items: [] } : {}),
                    };
                    dispatch({ 
                        type: 'UPDATE_SECTION_DATA', 
                        section, 
                        payload: [...currentData, newItem] 
                    });
                }
            };

            if (type === 'upload_banner') {
                updateOrAdd('banners', 'image_url');
            } else if (type === 'upload_category') {
                updateOrAdd('categories', 'image_url');
            } else if (type === 'upload_service') {
                updateOrAdd('services', 'service_image');
            } else if (type === 'upload_special') {
                updateOrAdd('specials', 'image_url');
            } else if (type === 'upload_combo') {
                updateOrAdd('combos', 'image_url');
            } else if (type === 'upload_offer') {
                updateOrAdd('offers', 'banner_image');
            } else if (type === 'upload_logo') {
                if (payload.elementId) {
                    dispatch({ 
                        type: 'UPDATE_ELEMENT_CONTENT', 
                        sectionId: 'header', 
                        elementId: payload.elementId,
                        content: { url: imageUrl }
                    });
                } else {
                    dispatch({ type: 'UPDATE_PROFILE', profile: { logo_url: imageUrl } });
                }
            }
            toast.success('Image uploaded successfully!');
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload image. Please try again.');
        } finally {
            setUploadConfig(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ─── Save ───
    const handleSave = useCallback(async () => {
        if (!restaurantId || saving) return;
        setSaving(true);
        setSaveStatus('saving');

        try {
            await HomepageBuilderService.saveFullState(restaurantId, state);

            dispatch({ type: 'SET_DIRTY', isDirty: false });
            setSaveStatus('saved');
            toast.success('Homepage saved successfully!');
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (err: any) {
            console.error('Save failed:', err);
            toast.error(`Save failed: ${err?.message || 'Unknown error'}`);
            setSaveStatus('idle');
        } finally {
            setSaving(false);
        }
    }, [restaurantId, state, saving, dispatch]);

    // ─── Keyboard Shortcuts ───
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
            if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleSave(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [undo, redo, handleSave]);

    if (dataLoading) return <LoadingState message="Launching Live Editor..." fullScreen />;

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-neutral-100">
            {/* ═══ Top Toolbar ═══ */}
            <div className="h-16 bg-white/80 backdrop-blur-md border-b border-neutral-200 flex items-center justify-between px-6 shrink-0 z-50 sticky top-0">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center border border-orange-600">
                        <Sparkles className="text-white" size={20} />
                    </div>
                    <div>
                        <h1 className="text-sm font-black text-black leading-none">Live Editor</h1>
                        <p className="text-[10px] text-black font-bold uppercase tracking-wider mt-1">Direct Storefront Preview</p>
                    </div>
                </div>

                {/* Device Switcher */}
                <div className="hidden md:flex items-center bg-neutral-100 p-1 rounded-xl gap-1">
                    <button 
                        onClick={() => setPreviewMode('mobile')}
                        className={`p-2 rounded-lg transition-all ${previewMode === 'mobile' ? 'bg-white text-orange-600 border border-neutral-100' : 'text-black hover:text-black'}`}
                    >
                        <Smartphone size={18} />
                    </button>
                    <button 
                        onClick={() => setPreviewMode('tablet')}
                        className={`p-2 rounded-lg transition-all ${previewMode === 'tablet' ? 'bg-white text-orange-600 border border-neutral-100' : 'text-black hover:text-black'}`}
                    >
                        <Tablet size={18} />
                    </button>
                    <button 
                        onClick={() => setPreviewMode('desktop')}
                        className={`p-2 rounded-lg transition-all ${previewMode === 'desktop' ? 'bg-white text-orange-600 border border-neutral-100' : 'text-black hover:text-black'}`}
                    >
                        <Monitor size={18} />
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <button onClick={undo} disabled={!canUndo} className="p-2 rounded-xl text-black hover:bg-neutral-50 disabled:opacity-30 transition-colors">
                            <Undo2 size={18} />
                        </button>
                        <button onClick={redo} disabled={!canRedo} className="p-2 rounded-xl text-black hover:bg-neutral-50 disabled:opacity-30 transition-colors">
                            <Redo2 size={18} />
                        </button>
                    </div>
                    
                    <div className="h-8 w-px bg-neutral-200 mx-1" />

                    <motion.button
                        onClick={handleSave}
                        disabled={saving || !state.isDirty}
                        whileTap={{ scale: 0.96 }}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all border ${
                            state.isDirty
                                ? 'bg-orange-600 hover:bg-orange-700 text-white border-orange-700'
                                : saveStatus === 'saved'
                                    ? 'bg-emerald-500 text-white border-emerald-600'
                                    : 'bg-neutral-200 text-black border-neutral-300 shadow-none cursor-not-allowed'
                        }`}
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" />
                            : saveStatus === 'saved' ? <Check size={16} />
                            : <Save size={16} />
                        }
                        {saving ? 'Publishing...' : saveStatus === 'saved' ? 'Published!' : 'Publish Changes'}
                    </motion.button>
                </div>
            </div>

            {/* ═══ Main Content ═══ */}
            <div className="flex-1 overflow-y-auto scrollbar-hide py-12 px-4">
                <div className={`mx-auto transition-all duration-500 ${
                    previewMode === 'mobile' ? 'max-w-[400px]' : 
                    previewMode === 'tablet' ? 'max-w-[768px]' : 'max-w-full'
                }`}>
                    <CartProvider>
                        <SharedHomepageLayout 
                            mode="admin"
                            restaurantId={restaurantId!}
                            profile={state.profile}
                            theme={state.theme}
                            sections={state.sections}
                            data={state.data}
                            onUpdate={handleUpdate}
                            addToCart={() => {}}
                            updateQuantity={() => {}}
                            getItemQtyInCart={() => 0}
                            addSpecialToCart={() => {}}
                            onSearchClick={() => {}}
                            onCategoryClick={() => {}}
                            onServiceClick={() => {}}
                            onServicesHeaderClick={() => {}}
                            onBannersChange={refreshBanners}
                        />
                    </CartProvider>
                </div>
            </div>

            {/* Float Controls Overlay */}
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl border border-neutral-200 shadow-none px-6 py-3 rounded-2xl flex items-center gap-6 z-[60]">
                <button className="flex items-center gap-2 text-xs font-bold text-black hover:text-orange-600 transition-colors">
                    <Layout size={14} /> Sections
                </button>
                <div className="w-px h-4 bg-neutral-200" />
                <button className="flex items-center gap-2 text-xs font-bold text-black hover:text-orange-600 transition-colors">
                    <Palette size={14} /> Theme
                </button>
                <div className="w-px h-4 bg-neutral-200" />
                <button className="flex items-center gap-2 text-xs font-bold text-black hover:text-orange-600 transition-colors">
                    <Settings size={14} /> Settings
                </button>
            </div>

            {/* Hidden File Input for Image Uploads */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
            />
        </div>
    );
}
