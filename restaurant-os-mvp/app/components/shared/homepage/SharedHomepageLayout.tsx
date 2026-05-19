'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { Settings2, MapPin, ReceiptText, UtensilsCrossed, Sparkle, Timer } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import { HomepageSection, ThemeSettings } from '@/app/services/homepage-builder.service';
import { OrderService } from '@/app/services/orders';
import { cn, getCategoryMenuItemImage } from '@/app/lib/utils';
import { useCartSafe } from '@/app/context/CartContext';
import { HomepageBuilderService } from '@/app/services/homepage-builder.service';
import { SharedServicePopupCard } from '@/app/components/shared/services/SharedServicePopupCard';
import { MainHeader } from '@/app/components/shared/MainHeader';
import BannerSlider from './BannerSlider';
import SharedQuantityControl from '@/app/components/shared/SharedQuantityControl';

// --- Shared Types ---
export interface SectionStyleSettings {
    id?: string;
    restaurant_id: string;
    section_name: string;
    page_bg_color?: string;
    card_bg_color?: string;
    section_bg_color?: string;
    border_color?: string;
    title_color?: string;
    subtitle_color?: string;
    button_color?: string;
    button_text_color?: string;
    badge_color?: string;
    title_font_size?: string;
    border_radius?: string;
    padding?: string;
    margin?: string;
    shadow?: string;
    opacity?: string;
}

// ─── Item Status Utility ───
const getItemStatus = (item: any) => {
    if (item.active === false) return 'disabled';
    if (!item.expiry_datetime) return 'active';
    const expiry = new Date(item.expiry_datetime);
    return expiry < new Date() ? 'expired' : 'active';
};

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
        <div className="flex items-center gap-1 text-[9px] font-black uppercase tracking-tighter text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100 animate-pulse">
            <Timer size={10} className="shrink-0" />
            <span>
                Ending in: {timeLeft.d > 0 ? `${timeLeft.d}d ` : ''}{timeLeft.h.toString().padStart(2, '0')}:{timeLeft.m.toString().padStart(2, '0')}:{timeLeft.s.toString().padStart(2, '0')}
            </span>
        </div>
    );
};

export interface SharedHomepageProps {
    mode: 'customer' | 'admin';
    restaurantId: string;
    tableNumber?: string;
    profile: any;
    theme: any;
    sections: HomepageSection[];
    data: {
        banners: any[];
        categories: any[];
        services: any[];
        specials: any[];
        combos: any[];
        offers: any[];
        popularItems: any[];
        recentOrders: any[];
        menuItems: any[];
        sectionStyles?: any;
    };
    onUpdate?: (type: string, data: any) => void;
    addToCart: (item: any, qty: number) => void;
    updateQuantity: (itemId: string, delta: number) => void;
    getItemQtyInCart: (itemId: string) => number;
    addSpecialToCart: (item: any) => void;
    onSearchClick?: () => void;
    onCategoryClick?: (category: any) => void;
    onServiceClick?: (service: any) => void;
    onServicesHeaderClick?: () => void;
    onBannersChange?: () => void;
}

const MAX_WIDTH = 'max-w-[400px]';

// ─── Countdown Timer Component ───


// Icon mapping for services
const getServiceIcon = (iconName: string) => {
    if (!iconName) return null;
    const mapping: Record<string, string> = {
        'call_waiter': 'HandPlatter',
        'bill_requested': 'Receipt',
        'water_requested': 'GlassWater',
        'cutlery_requested': 'Utensils',
        'glass_requested': 'GlassWater',
        'straw_requested': 'Pipette',
        'plate_requested': 'Disc',
        'bowl_requested': 'Soup',
        'salt_requested': 'GripHorizontal',
        'pepper_requested': 'Wind',
        'sauce_requested': 'Droplet',
        'order_ready': 'GlassWater'
    };
    const mappedName = mapping[iconName] || iconName;
    return (LucideIcons as any)[mappedName];
};

export default function SharedHomepageLayout({ 
    mode, 
    restaurantId, 
    tableNumber, 
    profile, 
    theme, 
    sections, 
    data,
    onUpdate,
    addToCart: propAddToCart,
    updateQuantity: propUpdateQuantity,
    getItemQtyInCart: propGetItemQtyInCart,
    addSpecialToCart: propAddSpecialToCart,
    onSearchClick: propOnSearchClick,
    onCategoryClick: propOnCategoryClick,
    onServiceClick: propOnServiceClick,
    onServicesHeaderClick: propOnServicesHeaderClick,
    onBannersChange
}: SharedHomepageProps) {
    const router = useRouter();
    const cartContext = useCartSafe();
    
    // Merge props with context
    const addToCart = propAddToCart || cartContext?.addToCart;
    const updateQuantity = propUpdateQuantity || cartContext?.updateQuantity;
    const getItemQtyInCart = propGetItemQtyInCart || cartContext?.getItemQtyInCart;
    const addSpecialToCart = propAddSpecialToCart || cartContext?.addSpecialToCart;

    // Helper to de-duplicate items by ID
    const deduplicate = (items: any[]) => {
        if (!items) return [];
        const seen = new Set();
        return items.filter(item => {
            const id = item.id || item.section_type || item.name || item.title || JSON.stringify(item);
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    };

    const [localData, setLocalData] = useState({
        banners: deduplicate(data?.banners || []),
        categories: deduplicate(data?.categories || []),
        services: deduplicate(data?.services || []),
        specials: deduplicate(data?.specials || []),
        combos: deduplicate(data?.combos || []),
        offers: deduplicate(data?.offers || []),
        popularItems: deduplicate(data?.popularItems || []),
        recentOrders: data?.recentOrders || [],
        menuItems: data?.menuItems || [],
        sectionStyles: data?.sectionStyles || {}
    });
    const [localProfile, setLocalProfile] = useState(profile || {});
    const [localSections, setLocalSections] = useState(deduplicate(sections || []));
    
    // Service Request State
    const [selectedService, setSelectedService] = useState<any>(null);

    // Direct Interaction State
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    // --- Unified Search Pool ---
    const combinedSearchItems = React.useMemo(() => {
        const items = [
            ...(localData.menuItems || []).map(i => ({ ...i, type: 'menu' })),
            ...(localData.specials || []).map(i => ({ ...i, name: i.title, type: 'special' })),
            ...(localData.combos || []).map(i => ({ ...i, name: i.title, type: 'combo' })),
            ...(localData.popularItems || []).map(i => ({ ...i, type: 'popular' }))
        ];
        const seen = new Set();
        return items.filter(item => {
            if (!item) return false;
            const key = item.id || `${item.name}-${item.price}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }, [localData.menuItems, localData.specials, localData.combos, localData.popularItems]);

    const filteredSearchItems = React.useMemo(() => {
        if (!searchTerm) return [];
        const query = searchTerm.toLowerCase();
        return combinedSearchItems.filter(item => 
            item.name?.toLowerCase().includes(query) || 
            item.description?.toLowerCase().includes(query)
        ).slice(0, 20);
    }, [combinedSearchItems, searchTerm]);

    const categoryItems = React.useMemo(() => {
        if (!selectedCategory || !localData?.menuItems) return [];
        return localData.menuItems.filter((item: any) => item.category_id === selectedCategory.id);
    }, [selectedCategory, localData?.menuItems]);
    
    useEffect(() => {
        if (isSearchModalOpen && searchInputRef.current) {
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isSearchModalOpen]);

    const [localTheme, setLocalTheme] = useState(theme);

    useEffect(() => {
        setLocalData({
            banners: deduplicate(data?.banners || []),
            categories: deduplicate(data?.categories || []),
            services: deduplicate(data?.services || []),
            specials: deduplicate(data?.specials || []),
            combos: deduplicate(data?.combos || []),
            offers: deduplicate(data?.offers || []),
            popularItems: deduplicate(data?.popularItems || []),
            recentOrders: data?.recentOrders || [],
            menuItems: data?.menuItems || [],
            sectionStyles: data?.sectionStyles || {}
        });
        setLocalProfile(profile || {});
        setLocalSections(deduplicate(sections || []));
        setLocalTheme(theme);
    }, [data, profile, sections, theme]);
    
    const activeTheme = {
        bg_color: '#F9FAFB',
        primary_button_color: '#F97316',
        secondary_button_color: '#000000',
        text_color: '#000000',
        font_style: 'Inter',
        card_radius: '16px',
        webpage_bg_color: '#ffffff',
        header_bg_color: '#ffffff',
        ...(localTheme || {})
    };

    const containerStyle = {
        backgroundColor: activeTheme.webpage_bg_color,
        color: activeTheme.text_color,
        fontFamily: activeTheme.font_family || activeTheme.font_style
    };

    const handleTextUpdate = (section: string, index: number, field: string, value: string) => {
        if (mode !== 'admin' || !onUpdate) return;
        onUpdate(section, { index, field, value });
    };

    const toggleSectionVisibility = (sectionId: string) => {
        if (mode !== 'admin' || !onUpdate) return;
        const newSections = localSections.map(s => s.id === sectionId ? { ...s, active: !s.active } : s);
        setLocalSections(newSections);
        onUpdate('sections', newSections);
    };

    const handleCategoryClick = (category: any) => {
        if (mode === 'admin') return;
        // Prioritize 'link' if available (this is where we resolved the real category ID)
        const targetId = category.link || category.id;
        router.push(`/${restaurantId}/customer/menu/${tableNumber}?category=${targetId}`);
    };

    const handleServiceClick = (service: any) => {
        if (mode === 'admin') return;
        setSelectedService(service);
    };

    const handleServicesHeaderClick = () => {
        if (mode === 'admin') return;
        router.push(`/${restaurantId}/customer/services/${tableNumber}`);
    };

    return (
        <div className={`min-h-screen transition-colors duration-500 ${mode === 'admin' ? 'bg-neutral-100/50' : ''}`} style={{ backgroundColor: activeTheme.webpage_bg_color || (mode === 'admin' ? '#f5f5f5' : '#fafafa') }}>
            <div 
                className={`${mode === 'admin' ? MAX_WIDTH + ' mx-auto border-x border-neutral-200' : 'w-full overflow-x-hidden'} relative min-h-screen transition-colors duration-500`} 
                style={{ backgroundColor: activeTheme.webpage_bg_color || '#ffffff' }}
            >
                {/* Global Style Control (Admin only) */}
                {mode === 'admin' && (
                    <div className="absolute top-4 right-4 z-[100]">
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                const el = document.getElementById('global-style-popover');
                                if (el) el.classList.toggle('hidden');
                            }}
                            className="bg-white/90 backdrop-blur p-2.5 rounded-full border border-neutral-100 hover:scale-110 active:scale-95 transition-all text-orange-600 group"
                            title="Page Settings"
                        >
                            <LucideIcons.Palette size={18} className="group-hover:rotate-12 transition-transform" />
                        </button>
                        
                        <div id="global-style-popover" className="hidden absolute right-0 mt-3 bg-white rounded-2xl p-5 w-64 border border-neutral-100 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center justify-between border-b border-neutral-50 pb-3">
                                <h4 className="font-black text-[10px] uppercase tracking-widest text-black">Page Design</h4>
                                <button onClick={() => document.getElementById('global-style-popover')?.classList.add('hidden')} className="text-black hover:text-black"><LucideIcons.X size={14} /></button>
                            </div>
                            
                            <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-black font-bold">Page Background</span>
                                    <div className="relative w-10 h-6 rounded-full border border-neutral-100 overflow-hidden cursor-pointer">
                                        <input 
                                            type="color" 
                                            value={activeTheme.webpage_bg_color || '#ffffff'}
                                            onChange={(e) => onUpdate?.('theme', { webpage_bg_color: e.target.value })}
                                            className="absolute -top-3 -left-3 w-16 h-12 cursor-pointer border-none"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-black font-bold">Header Background</span>
                                    <div className="relative w-10 h-6 rounded-full border border-neutral-100 overflow-hidden cursor-pointer">
                                        <input 
                                            type="color" 
                                            value={activeTheme.header_bg_color || '#ffffff'}
                                            onChange={(e) => onUpdate?.('theme', { header_bg_color: e.target.value })}
                                            className="absolute -top-3 -left-3 w-16 h-12 cursor-pointer border-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <button 
                                onClick={() => onUpdate?.('theme', { webpage_bg_color: '#ffffff', header_bg_color: '#ffffff' })}
                                className="mt-2 py-2 px-3 bg-neutral-50 hover:bg-neutral-100 text-[10px] font-black uppercase tracking-widest text-black hover:text-black rounded-xl border border-neutral-100 transition-all flex items-center justify-center gap-2"
                            >
                                <LucideIcons.RefreshCcw size={10} /> Reset Page Design
                            </button>
                        </div>
                    </div>
                )}
                
                {localSections.map((section, idx) => (
                    <SectionRenderer 
                        key={section.id || idx}
                        section={section}
                        mode={mode}
                        data={localData}
                        profile={localProfile}
                        theme={activeTheme}
                        restaurantId={restaurantId}
                        tableNumber={tableNumber}
                        onUpdate={onUpdate}
                        onToggleVisibility={() => toggleSectionVisibility(section.id)}
                        router={router}
                        onCategoryClick={propOnCategoryClick || handleCategoryClick}
                        onServiceClick={propOnServiceClick || handleServiceClick}
                        onServicesHeaderClick={propOnServicesHeaderClick || handleServicesHeaderClick}
                        onSearchClick={propOnSearchClick || (() => setIsSearchModalOpen(true))}
                        cartContext={cartContext}
                        addToCart={addToCart}
                        updateQuantity={updateQuantity}
                        getItemQtyInCart={getItemQtyInCart}
                        addSpecialToCart={addSpecialToCart}
                        onBannersChange={onBannersChange}
                    />
                ))}

                <SharedServicePopupCard
                    service={selectedService}
                    isOpen={!!selectedService}
                    onClose={() => setSelectedService(null)}
                    restaurantId={restaurantId}
                    tableNumber={tableNumber || ''}
                />

                {/* Category Items Modal (Direct View) */}
                <AnimatePresence>
                    {selectedCategory && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:p-4"
                            onClick={() => setSelectedCategory(null)}
                        >
                            <motion.div
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col border border-neutral-100"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Modal Header */}
                                <div className="relative p-6 pb-4 border-b border-neutral-100 shrink-0">
                                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-neutral-200 rounded-full sm:hidden" />
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="size-12 rounded-2xl overflow-hidden relative border border-neutral-100 bg-neutral-50">
                                                <img src={selectedCategory.image || selectedCategory.image_url || '/placeholder-category.jpg'} className="w-full h-full object-cover" alt={selectedCategory.name} loading="lazy" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-black">{selectedCategory.name}</h3>
                                                <p className="text-sm text-black font-medium">{categoryItems.length} items available</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => setSelectedCategory(null)}
                                            className="size-10 rounded-full bg-neutral-100 flex items-center justify-center text-black hover:bg-neutral-200 transition-colors"
                                        >
                                            <LucideIcons.X size={20} />
                                        </button>
                                    </div>
                                </div>

                                {/* Modal Body (Items List) */}
                                <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
                                    {categoryItems.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-4">
                                            {(categoryItems || []).map((item: any) => (
                                                <div 
                                                    key={item.id} 
                                                    className="flex gap-4 p-3 rounded-3xl border border-neutral-100 hover:border-orange-200 transition-colors bg-white group"
                                                >
                                                    <div className="relative size-24 shrink-0 rounded-2xl overflow-hidden bg-neutral-50 border border-neutral-50">
                                                        <img 
                                                            src={item.image_url || getCategoryMenuItemImage(item.name)} 
                                                            alt={item.name} 
                                                            className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" 
                                                            loading="lazy"
                                                        />
                                                        {item.is_veg !== null && (
                                                            <div className="absolute top-2 right-2 p-1 bg-white/90 backdrop-blur-sm rounded-lg border border-neutral-100">
                                                                <div className={`size-3 rounded-full ${item.is_veg ? 'bg-green-500' : 'bg-red-500'}`} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 flex flex-col justify-between py-1">
                                                        <div>
                                                            <h4 className="font-bold text-black line-clamp-1">{item.name}</h4>
                                                            <p className="text-xs text-black line-clamp-2 mt-1 leading-relaxed">
                                                                {item.description || 'No description available'}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center justify-between mt-2">
                                                            <span className="font-black text-lg text-black">₹{item.price}</span>
                                                            <button 
                                                                onClick={() => {
                                                                    if (addToCart) {
                                                                        addToCart(item, 1);
                                                                        toast.success(`${item.name} added to cart`, {
                                                                            duration: 2000,
                                                                            position: 'bottom-center',
                                                                            icon: <LucideIcons.ShoppingBag size={16} className="text-green-500" />
                                                                        });
                                                                    }
                                                                }}
                                                                className="h-10 px-6 rounded-xl font-bold text-white active:scale-95 transition-all flex items-center gap-2"
                                                                style={{ backgroundColor: activeTheme.primary_color }}
                                                            >
                                                                <LucideIcons.Plus size={16} />
                                                                Add
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-20 text-center">
                                            <div className="size-20 rounded-full bg-neutral-50 flex items-center justify-center mx-auto mb-4">
                                                <LucideIcons.ChefHat size={32} className="text-black" />
                                            </div>
                                            <h4 className="font-bold text-black">No items found in this category</h4>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Bottom View All Link */}
                                <div className="p-4 border-t border-neutral-100 bg-neutral-50/50 shrink-0">
                                    <button 
                                        onClick={() => {
                                            setSelectedCategory(null);
                                            router.push(`/${restaurantId}/customer/menu/${tableNumber}?category=${selectedCategory.id}`);
                                        }}
                                        className="w-full py-4 rounded-2xl font-black text-black hover:bg-white transition-all flex items-center justify-center gap-2 group border border-transparent hover:border-neutral-200"
                                    >
                                        View in Full Menu
                                        <LucideIcons.ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Services Selection Modal (Direct View) */}
                <AnimatePresence>
                    {isServiceModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:p-4"
                            onClick={() => setIsServiceModalOpen(false)}
                        >
                            <motion.div
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                                className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col border border-neutral-100"
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="relative p-6 pb-4 border-b border-neutral-100 shrink-0">
                                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-neutral-200 rounded-full sm:hidden" />
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-2xl font-black text-black">Request Services</h3>
                                            <p className="text-sm text-black font-medium">How can we help you today?</p>
                                        </div>
                                        <button 
                                            onClick={() => setIsServiceModalOpen(false)}
                                            className="size-10 rounded-full bg-neutral-100 flex items-center justify-center text-black hover:bg-neutral-200 transition-colors"
                                        >
                                            <LucideIcons.X size={20} />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar">
                                    <div className="grid grid-cols-2 gap-4">
                                        {(localData.services || []).filter((s: any) => mode === 'admin' || s.active).map((service: any) => (
                                            <button 
                                                key={service.id}
                                                onClick={() => {
                                                    setIsServiceModalOpen(false);
                                                    setSelectedService(service);
                                                }}
                                                className="flex flex-col items-center gap-4 p-6 rounded-[2rem] bg-neutral-50 hover:bg-orange-50 border-2 border-neutral-100 hover:border-orange-200 transition-all group"
                                            >
                                                <div className="size-16 rounded-2xl overflow-hidden relative bg-white border border-neutral-100 group-hover:scale-110 transition-transform flex items-center justify-center">
                                                    {service.image_url ? (
                                                        <Image src={service.image_url} alt={service.service_title || service.name || 'Service'} fill className="object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            {service.service_icon && getServiceIcon(service.service_icon) ? (
                                                                React.createElement(getServiceIcon(service.service_icon), {
                                                                    size: 24,
                                                                    className: "text-black"
                                                                })
                                                            ) : (
                                                                <LucideIcons.Bell size={24} className="text-black" />
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="font-bold text-black text-center">{service.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-4 bg-neutral-50/50 shrink-0">
                                    <p className="text-center text-xs text-black font-medium">
                                        Your request will be handled by our waitstaff immediately.
                                    </p>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Search Modal */}
                <AnimatePresence>
                    {isSearchModalOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[110] bg-white sm:bg-black/60 sm:backdrop-blur-sm sm:p-4"
                            onClick={() => setIsSearchModalOpen(false)}
                        >
                            <motion.div
                                initial={{ y: "-100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "-100%" }}
                                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                                className="bg-white w-full h-full sm:h-auto sm:max-h-[90vh] sm:rounded-[2.5rem] sm:max-w-xl mx-auto overflow-hidden flex flex-col shadow-2xl"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Search Header */}
                                <div className="p-4 sm:p-6 pb-2 shrink-0 bg-white">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 relative group">
                                            <LucideIcons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black group-focus-within:text-orange-500 transition-colors" size={20} />
                                            <input 
                                                autoFocus
                                                type="text" 
                                                placeholder="Search dishes, drinks, combos..."
                                                className="w-full h-14 pl-12 pr-12 rounded-2xl bg-neutral-100 border-none focus:ring-2 focus:ring-orange-500/20 font-bold text-black placeholder:text-black transition-all"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                            {searchTerm && (
                                                <button 
                                                    onClick={() => setSearchTerm('')}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 size-6 rounded-full bg-neutral-200 flex items-center justify-center text-black hover:bg-neutral-300 transition-colors"
                                                >
                                                    <LucideIcons.X size={14} />
                                                </button>
                                            )}
                                        </div>
                                        <button 
                                            onClick={() => setIsSearchModalOpen(false)}
                                            className="h-14 px-4 rounded-2xl bg-neutral-100 flex items-center justify-center text-black font-black uppercase tracking-widest text-[10px] hover:bg-neutral-200 transition-colors"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>

                                {/* Results Area */}
                                <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar bg-neutral-50/30">
                                    {searchTerm.length > 0 ? (
                                        filteredSearchItems.length > 0 ? (
                                            <div className="grid gap-3">
                                                {filteredSearchItems.map((item: any) => {
                                                    const qty = getItemQtyInCart ? getItemQtyInCart(item.id) : 0;
                                                    return (
                                                        <motion.div 
                                                            layout
                                                            initial={{ opacity: 0, scale: 0.95 }}
                                                            animate={{ opacity: 1, scale: 1 }}
                                                            key={item.id} 
                                                            className="flex gap-4 p-3 rounded-[24px] border border-neutral-100 bg-white hover:border-orange-200 transition-all shadow-sm active:scale-[0.98]"
                                                        >
                                                            <div className="relative size-20 shrink-0 rounded-2xl overflow-hidden bg-neutral-100">
                                                                <img 
                                                                    src={item.image_url || getCategoryMenuItemImage(item.name)} 
                                                                    alt={item.name} 
                                                                    className="w-full h-full object-cover" 
                                                                    loading="lazy"
                                                                />
                                                                {item.is_veg !== undefined && (
                                                                    <div className="absolute top-1.5 right-1.5 p-0.5 bg-white/90 backdrop-blur-sm rounded-md border border-neutral-100">
                                                                        <div className={`size-2 rounded-full ${item.is_veg ? 'bg-green-500' : 'bg-red-500'}`} />
                                                                    </div>
                                                                )}
                                                                {item.type && item.type !== 'menu' && (
                                                                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-orange-500 text-white text-[8px] font-black uppercase rounded-md tracking-widest">
                                                                        {item.type}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 flex flex-col justify-between py-1">
                                                                <div>
                                                                    <h4 className="font-black text-sm text-black line-clamp-1">{item.name}</h4>
                                                                    <p className="text-[10px] text-black line-clamp-1 mt-0.5 font-medium">
                                                                        {item.description || 'No description available'}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center justify-between mt-2">
                                                                    <span className="font-black text-base text-orange-600">₹{item.price}</span>
                                                                    <SharedQuantityControl 
                                                                        qty={qty}
                                                                        onAdd={() => {
                                                                            if (mode === 'customer' && addToCart) {
                                                                                addToCart(item, 1);
                                                                                toast.success(`${item.name} added to cart`, {
                                                                                    duration: 2000,
                                                                                    position: 'bottom-center',
                                                                                    icon: <LucideIcons.ShoppingBag size={16} className="text-green-500" />
                                                                                });
                                                                            }
                                                                        }}
                                                                        onUpdateQuantity={(delta) => updateQuantity?.(item.id, delta)}
                                                                        colorHex={activeTheme.primary_button_color || '#f97316'}
                                                                        buttonStyle="text"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <div className="py-20 text-center">
                                                <div className="size-20 rounded-3xl bg-neutral-100 flex items-center justify-center mx-auto mb-4 border border-neutral-200">
                                                    <LucideIcons.Search size={32} className="text-black" />
                                                </div>
                                                <h3 className="text-sm font-black text-black mb-1">No items found</h3>
                                                <p className="text-[10px] text-black font-medium">Try searching for something else</p>
                                            </div>
                                        )
                                    ) : (
                                        <div className="py-10 text-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-black mb-6">Popular Tags</p>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {['Burger', 'Pizza', 'Pasta', 'Drinks', 'Dessert'].map(tag => (
                                                    <button 
                                                        key={tag}
                                                        onClick={() => setSearchTerm(tag)}
                                                        className="px-4 py-2 rounded-xl bg-white border border-neutral-100 text-[10px] font-black uppercase tracking-widest text-black shadow-sm hover:border-orange-500 hover:text-orange-500 transition-all active:scale-95"
                                                    >
                                                        {tag}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
                
            </div>
        </div>
    );
}

function SectionRenderer({ section, mode, data, profile, theme, restaurantId, tableNumber, onUpdate, onToggleVisibility, router, onServiceClick, onCategoryClick, onServicesHeaderClick, onSearchClick, cartContext, addToCart, updateQuantity: propUpdateQuantity, getItemQtyInCart: propGetItemQtyInCart, addSpecialToCart: propAddSpecialToCart, onBannersChange }: any) {
    const { addSpecialToCart: contextAddSpecialToCart, updateQuantity: contextUpdateQuantity, getItemQtyInCart: contextGetItemQtyInCart } = cartContext || {};
    
    const addSpecialToCart = propAddSpecialToCart || contextAddSpecialToCart;
    const updateQuantity = propUpdateQuantity || contextUpdateQuantity;
    const getItemQtyInCart = propGetItemQtyInCart || contextGetItemQtyInCart;
    
    const [showSettings, setShowSettings] = useState(false);

    if (!section.active && mode === 'customer') return null;

    const wrapperClass = `relative group ${mode === 'admin' && !section.active ? 'opacity-40 grayscale blur-[1px]' : ''} transition-all duration-300`;
    
    const sectionStyle = data?.sectionStyles?.[section.section_type] || {};

    const handleStyleChange = (field: string, value: string) => {
        if (onUpdate) {
            onUpdate('update_section_style', { section_name: section.section_type, style: { [field]: value } });
        }
    };

    // Map section data - prefer elements from section object if available

    const sectionData = {
        banners: section.section_type === 'hero_banners' ? (data.banners || []) : ((section.elements && section.elements.length > 0) ? section.elements : (data.banners || [])),
        categories: (section.section_type === 'categories' && section.elements && section.elements.length > 0) ? section.elements : data.categories,
        services: (section.section_type === 'services' && section.elements && section.elements.length > 0) ? section.elements : data.services,
        // In admin mode, show all specials/combos so admin can manage inactive ones too
        specials: mode === 'admin' ? (data.specials || []) : (data.specials || []).filter((i: any) => getItemStatus(i) === 'active'),
        combos: mode === 'admin' ? (data.combos || []) : (data.combos || []).filter((i: any) => getItemStatus(i) === 'active'),
        offers: data.offers || [],
        popularItems: (data.popularItems || []).filter((i: any) => mode === 'admin' || (i.is_popular && i.active)),
        recentOrders: data.recentOrders || [],
    };

    const commonProps = { theme, restaurantId, tableNumber, mode, onUpdate, router, sectionStyle, section };
    
    if (section.section_type === 'hero_banners') {
        console.log(`[SharedHomepageLayout] Rendering hero_banners for ${restaurantId}:`, {
            count: sectionData.banners.length,
            banners: sectionData.banners.map((b: any) => ({ id: b.id, url: b.image_url || b.imageUrl }))
        });
    }

    const renderContent = () => {
        switch (section.section_type) {
            case 'header':
                return <HeaderSection profile={profile} theme={theme} restaurantId={restaurantId} tableNumber={tableNumber} mode={mode} onUpdate={onUpdate} onSearchClick={onSearchClick} cartContext={cartContext} section={section} sectionStyle={sectionStyle} themeProps={theme} />;
            case 'hero_banners':
                return <HeroBanners banners={sectionData.banners} theme={theme} mode={mode} onUpdate={onUpdate} sectionStyle={sectionStyle} restaurantId={restaurantId} onBannersChange={onBannersChange} />;
            case 'categories':
                return <CategoriesSection {...commonProps} categories={sectionData.categories} onCategoryClick={onCategoryClick} onServicesHeaderClick={onServicesHeaderClick} />;
            case 'services':
                return <ServicesSection {...commonProps} services={sectionData.services} onServiceClick={onServiceClick} onServicesHeaderClick={onServicesHeaderClick} />;
            case 'specials':
                return <SpecialsSection specials={sectionData.specials} {...commonProps} addSpecialToCart={addSpecialToCart} updateQuantity={updateQuantity} getItemQtyInCart={getItemQtyInCart} />;
            case 'combos':
                return <CombosSection combos={sectionData.combos} {...commonProps} addSpecialToCart={addSpecialToCart} updateQuantity={updateQuantity} getItemQtyInCart={getItemQtyInCart} />;
            case 'offers':
                return <OffersSection offers={sectionData.offers} {...commonProps} />;
            case 'popular':
                return <PopularItemsSection items={sectionData.popularItems} {...commonProps} addToCart={addToCart} updateQuantity={updateQuantity} getItemQtyInCart={getItemQtyInCart} />;
            case 'reorder':
                return <ReorderSection orders={sectionData.recentOrders} {...commonProps} />;
            case 'footer':
                return <FooterSection profile={profile} {...commonProps} />;
            default:
                return null;
        }
    };

    return (
        <div 
            className={wrapperClass} 
            id={`section-${section.section_type}`}
            style={{
                backgroundColor: sectionStyle.section_bg_color || 'transparent',
                padding: sectionStyle.padding || undefined,
                margin: sectionStyle.margin || undefined,
                borderRadius: sectionStyle.border_radius || undefined,
                opacity: sectionStyle.opacity || undefined,
                boxShadow: sectionStyle.shadow === 'sm' ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' : 
                           sectionStyle.shadow === 'md' ? '0 4px 6px -1px rgb(0 0 0 / 0.1)' : 
                           sectionStyle.shadow === 'lg' ? '0 10px 15px -3px rgb(0 0 0 / 0.1)' : 'none',
                transition: 'all 0.3s ease'
            }}
        >
            {/* Admin Section Controls */}
            {mode === 'admin' && (
                <div className="absolute left-2 top-2 z-[110] opacity-100 flex flex-col gap-2 transition-all group-hover:scale-105">
                    <button 
                        onClick={onToggleVisibility}
                        className={`p-2 rounded-full transition-all active:scale-95 ${section.active ? 'bg-emerald-500 text-white' : 'bg-white text-black'}`}
                        style={{ backgroundColor: section.active ? (sectionStyle?.badge_color || '#10b981') : '#ffffff' }}
                        title={section.active ? 'Hide Section' : 'Show Section'}
                    >
                        {section.active ? <LucideIcons.Eye size={14} /> : <LucideIcons.EyeOff size={14} />}
                    </button>
                    <div className="relative">
                        <button 
                            onClick={() => setShowSettings(!showSettings)}
                            className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-orange-500 text-white' : 'bg-white text-black hover:text-orange-500'}`}
                            title="Section Settings"
                        >
                            <LucideIcons.Settings size={14} />
                        </button>
                        
                        {/* Settings Popover */}
                        {showSettings && (
                            <div className="absolute left-12 top-0 bg-white rounded-2xl p-5 w-72 max-w-[calc(100vw-80px)] z-[100] border border-neutral-100 flex flex-col gap-4 animate-in fade-in slide-in-from-left-2 duration-200 shadow-2xl">
                                <div className="flex items-center justify-between border-b border-neutral-50 pb-3 mb-1">
                                    <h4 className="font-black text-[10px] uppercase tracking-widest text-black">Section Style</h4>
                                    <button onClick={() => setShowSettings(false)} className="text-black hover:text-black transition-colors"><LucideIcons.X size={14} /></button>
                                </div>

                                <div className="flex items-center justify-between border-b border-neutral-50 pb-2 mb-1">
                                    <h4 className="font-black text-[9px] uppercase tracking-widest text-black">Colors & Theme</h4>
                                    <button 
                                        onClick={() => {
                                            handleStyleChange('section_bg_color', 'transparent');
                                            handleStyleChange('card_bg_color', '#ffffff');
                                            handleStyleChange('border_color', '#f5f5f5');
                                            handleStyleChange('title_color', '#000000');
                                            handleStyleChange('subtitle_color', '#000000');
                                            handleStyleChange('button_color', '#f97316');
                                            handleStyleChange('badge_color', '#f97316');
                                        }}
                                        className="p-1 hover:bg-neutral-50 rounded text-black hover:text-orange-600 transition-colors"
                                        title="Reset Colors"
                                    >
                                        <LucideIcons.RotateCcw size={10} />
                                    </button>
                                </div>
                                
                                {[
                                    { id: 'section_bg_color', label: 'Section Background', default: 'transparent' },
                                    { id: 'card_bg_color', label: 'Card Background', default: '#ffffff' },
                                    { id: 'border_color', label: 'Border Color', default: '#f5f5f5' },
                                    { id: 'title_color', label: 'Heading Text', default: '#000000' },
                                    { id: 'subtitle_color', label: 'Body Text', default: '#000000' },
                                    { id: 'button_color', label: 'Action Color', default: '#f97316' },
                                    { id: 'badge_color', label: 'Badge / Icon', default: '#f97316' }
                                ].map((setting) => (
                                    <div key={setting.id} className="flex items-center justify-between">
                                        <span className="text-xs text-black font-medium">{setting.label}</span>
                                        <div className="relative w-10 h-6 rounded-full border border-neutral-100 overflow-hidden cursor-pointer">
                                            <input 
                                                type="color" 
                                                value={sectionStyle[setting.id] || setting.default}
                                                onChange={(e) => handleStyleChange(setting.id, e.target.value)}
                                                className="absolute -top-3 -left-3 w-16 h-12 cursor-pointer border-none"
                                            />
                                        </div>
                                    </div>
                                ))}

                                <div className="flex items-center justify-between border-b border-neutral-50 pb-2 mb-1">
                                    <h4 className="font-black text-[9px] uppercase tracking-widest text-black">Structure & Layout</h4>
                                    <button 
                                        onClick={() => {
                                            handleStyleChange('padding', '');
                                            handleStyleChange('margin', '');
                                            handleStyleChange('border_radius', '');
                                            handleStyleChange('shadow', 'none');
                                        }}
                                        className="p-1 hover:bg-neutral-50 rounded text-black hover:text-orange-600 transition-colors"
                                        title="Reset Structure"
                                    >
                                        <LucideIcons.RotateCcw size={10} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { id: 'padding', label: 'Padding', placeholder: '24px 0' },
                                        { id: 'margin', label: 'Margin', placeholder: '0' },
                                        { id: 'border_radius', label: 'Radius', placeholder: '24px' },
                                        { id: 'opacity', label: 'Opacity', placeholder: '1.0' }
                                    ].map(setting => (
                                        <div key={setting.id} className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-black uppercase tracking-tighter">{setting.label}</span>
                                            <input 
                                                type="text" 
                                                value={sectionStyle[setting.id] || ''} 
                                                placeholder={setting.placeholder}
                                                onChange={(e) => handleStyleChange(setting.id, e.target.value)}
                                                className="w-full text-[10px] border-none bg-neutral-50 rounded-lg px-2 py-1.5 focus:ring-1 ring-orange-500/20 transition-all"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-black uppercase tracking-tighter">Shadow Style</span>
                                    <select 
                                        value={sectionStyle.shadow || 'none'}
                                        onChange={(e) => handleStyleChange('shadow', e.target.value)}
                                        className="w-full text-[10px] border-none bg-neutral-50 rounded-lg px-2 py-1.5 focus:ring-1 ring-orange-500/20"
                                    >
                                        <option value="none">None</option>
                                        <option value="sm">Subtle Shadow</option>
                                        <option value="md">Soft Shadow</option>
                                        <option value="lg">Deep Shadow</option>
                                    </select>
                                </div>

                                {section.section_type === 'header' && (
                                    <>
                                        <div className="flex items-center justify-between border-b border-neutral-50 pb-2 mb-1 mt-2">
                                            <h4 className="font-black text-[9px] uppercase tracking-widest text-black">Header Specifics</h4>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-bold text-black uppercase tracking-tighter">Logo Size</span>
                                                <input 
                                                    type="text" 
                                                    value={sectionStyle.logo_size || '48'} 
                                                    placeholder="48"
                                                    onChange={(e) => handleStyleChange('logo_size', e.target.value)}
                                                    className="w-full text-[10px] border-none bg-neutral-50 rounded-lg px-2 py-1.5 focus:ring-1 ring-orange-500/20"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] font-bold text-black uppercase tracking-tighter">Font Size</span>
                                                <input 
                                                    type="text" 
                                                    value={sectionStyle.header_font_size || '24'} 
                                                    placeholder="24"
                                                    onChange={(e) => handleStyleChange('header_font_size', e.target.value)}
                                                    className="w-full text-[10px] border-none bg-neutral-50 rounded-lg px-2 py-1.5 focus:ring-1 ring-orange-500/20"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-black uppercase tracking-tighter">Header Font</span>
                                            <select 
                                                value={sectionStyle.header_font || "'Outfit', sans-serif"}
                                                onChange={(e) => handleStyleChange('header_font', e.target.value)}
                                                className="w-full text-[10px] border-none bg-neutral-50 rounded-lg px-2 py-1.5 focus:ring-1 ring-orange-500/20"
                                            >
                                                <option value="'Inter', sans-serif">Inter</option>
                                                <option value="'Outfit', sans-serif">Outfit</option>
                                                <option value="'Playfair Display', serif">Playfair Display</option>
                                                <option value="'Lexend', sans-serif">Lexend</option>
                                                <option value="'Bebas Neue', sans-serif">Bebas Neue</option>
                                                <option value="'Space Grotesk', sans-serif">Space Grotesk</option>
                                            </select>
                                        </div>

                                        <div className="flex flex-col gap-1">
                                            <span className="text-[10px] font-bold text-black uppercase tracking-tighter">Alignment</span>
                                            <select 
                                                value={sectionStyle.header_alignment || 'left'}
                                                onChange={(e) => handleStyleChange('header_alignment', e.target.value)}
                                                className="w-full text-[10px] border-none bg-neutral-50 rounded-lg px-2 py-1.5 focus:ring-1 ring-orange-500/20"
                                            >
                                                <option value="left">Left</option>
                                                <option value="center">Center</option>
                                                <option value="right">Right</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-xs text-black font-medium">Webpage BG</span>
                                            <div className="relative w-10 h-6 rounded-full border border-neutral-100 overflow-hidden cursor-pointer">
                                                <input 
                                                    type="color" 
                                                    value={theme?.webpage_bg_color || '#ffffff'}
                                                    onChange={(e) => onUpdate?.('theme', { webpage_bg_color: e.target.value })}
                                                    className="absolute -top-3 -left-3 w-16 h-12 cursor-pointer border-none"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                <button 
                                    onClick={() => onUpdate('update_section_style', { section_name: section.section_type, style: null })}
                                    className="mt-2 py-2 px-3 bg-neutral-50 hover:bg-neutral-100 text-[10px] font-black uppercase tracking-widest text-black hover:text-black rounded-xl border border-neutral-100 transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    <LucideIcons.RefreshCcw size={10} /> Reset to Default
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="relative">
                {renderContent()}
            </div>
        </div>
    );
}

// --- Header Section ---

function HeaderSection({ profile, mode, onUpdate, section, sectionStyle, onSearchClick, themeProps, tableNumber }: any) {
    return (
        <MainHeader 
            profile={profile}
            mode={mode}
            onUpdate={onUpdate}
            section={section}
            sectionStyle={sectionStyle}
            onSearchClick={onSearchClick}
            theme={themeProps}
        >
            {tableNumber && mode === 'customer' && (
                <div className="flex items-center gap-2">
                    <p className="text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap text-black bg-black/5">
                        {tableNumber.toString().toLowerCase().includes('table') ? tableNumber : `Table ${tableNumber}`}
                    </p>
                </div>
            )}
        </MainHeader>
    );
}


function HeroBanners({ banners = [], theme, mode, onUpdate, sectionStyle, restaurantId, onBannersChange }: any) {
    return (
        <BannerSlider
            banners={banners}
            mode={mode}
            restaurantId={restaurantId}
            onBannersChange={onBannersChange}
            sectionStyle={sectionStyle}
        />
    );
}

function CategoriesSection({ categories, theme, mode, onUpdate, restaurantId, tableNumber, router, onCategoryClick, onServicesHeaderClick, sectionStyle, section }: any) {
    if (mode === 'customer' && (!categories || categories.length === 0)) return null;

    const handleTextBlur = (id: string, value: string) => {
        if (mode !== 'admin' || !onUpdate) return;
        onUpdate('update_category', { id, data: { name: value } });

    };

    return (
        <section className="py-6 bg-transparent">
            <div className="px-6 flex items-center justify-between mb-4">
                <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: sectionStyle?.title_color || '#000000' }}>{section?.section_title || 'Categories'}</h2>
                {mode === 'customer' && (
                    <button 
                        onClick={() => router.push(`/${restaurantId}/customer/menu/${tableNumber}`)}
                        onMouseEnter={() => HomepageBuilderService.prefetchAll(restaurantId)}
                        className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1 hover:gap-1.5 transition-all"
                    >
                        View All <LucideIcons.ChevronRight size={12} />
                    </button>
                )}
            </div>
            <div className="flex gap-6 overflow-x-auto no-scrollbar px-6">
                {(categories || []).map((cat: any, idx: number) => (
                    <div 
                        key={cat.id || idx} 
                        className="flex flex-col items-center gap-2 shrink-0 group/cat relative cursor-pointer"
                        onClick={() => {
                            if (mode === 'customer') {
                                if (cat.id === 'services') {
                                    if (onServicesHeaderClick) onServicesHeaderClick();
                                } else {
                                    if (onCategoryClick) onCategoryClick(cat);
                                }
                            }
                        }}
                        onMouseEnter={() => HomepageBuilderService.prefetchAll(restaurantId)}
                    >
                        <div 
                            className="w-16 h-16 rounded-full border-2 p-1 overflow-hidden"
                            style={{ 
                                borderColor: sectionStyle?.border_color || '#ffedd5',
                                backgroundColor: sectionStyle?.card_bg_color || '#ffffff'
                            }}
                            onClick={(e) => {
                                if (mode === 'admin') {
                                    e.stopPropagation();
                                    onUpdate('upload_category', { id: cat.id });
                                }
                            }}
                        >
                            <div className="w-full h-full rounded-full overflow-hidden relative">
                                <img src={cat.image_url || '/placeholder-category.jpg'} className="w-full h-full object-cover" alt={cat.name} loading="lazy" />
                                {mode === 'admin' && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/cat:opacity-100 flex items-center justify-center transition-opacity">
                                        <LucideIcons.Camera size={12} className="text-white" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <span 
                            className={`text-[10px] font-bold uppercase tracking-tight transition-all ${mode === 'admin' ? 'hover:bg-neutral-100 px-1 rounded cursor-text' : ''}`}
                            style={{ color: sectionStyle?.subtitle_color || '#000000' }}
                            contentEditable={mode === 'admin'}
                            suppressContentEditableWarning={true}
                            onBlur={(e) => handleTextBlur(cat.id, e.target.innerText)}
                        >
                            {cat.name}
                        </span>
                    </div>
                ))}
                
                {mode === 'customer' && (
                    <div 
                        className="flex flex-col items-center gap-2 shrink-0 group/cat relative cursor-pointer"
                        onClick={() => {
                            const el = document.getElementById('services-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        onMouseEnter={() => HomepageBuilderService.prefetchAll(restaurantId)}
                    >
                        <div 
                            className="w-16 h-16 rounded-full border-2 p-1 overflow-hidden"
                            style={{ 
                                borderColor: sectionStyle?.border_color || '#ffedd5',
                                backgroundColor: sectionStyle?.card_bg_color || '#ffffff'
                            }}
                        >
                            <div 
                                className="w-full h-full rounded-full flex items-center justify-center"
                                style={{ backgroundColor: sectionStyle?.button_color ? `${sectionStyle.button_color}15` : '#fff7ed' }}
                            >
                                <LucideIcons.LayoutGrid size={24} style={{ color: sectionStyle?.button_color || '#f97316' }} />
                            </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-tight" style={{ color: sectionStyle?.subtitle_color || '#000000' }}>Services</span>
                    </div>
                )}
                {mode === 'admin' && (
                    <div 
                        onClick={() => onUpdate('upload_category', { id: 'empty' })}
                        className="flex flex-col items-center gap-2 shrink-0 group/add"
                    >
                        <div className="w-16 h-16 rounded-full border-2 border-dashed border-neutral-200 flex items-center justify-center bg-neutral-50 cursor-pointer hover:border-orange-500 hover:bg-orange-50 transition-colors">
                            <LucideIcons.Plus size={20} className="text-black group-hover/add:text-orange-500" />
                        </div>
                        <span className="text-[10px] font-bold text-black uppercase tracking-tight">Add</span>
                    </div>
                )}
            </div>
        </section>
    );
}

// --- Helpers ---
const getColorForGradient = (gradient: string) => {
    const presets: Record<string, string> = {
        'from-blue-400/20 to-blue-600/20': '#3b82f6',
        'from-emerald-400/20 to-emerald-600/20': '#10b981',
        'from-orange-400/20 to-orange-600/20': '#f97316',
        'from-purple-400/20 to-purple-600/20': '#8b5cf6',
        'from-rose-400/20 to-rose-600/20': '#f43f5e',
        'from-amber-400/20 to-amber-600/20': '#f59e0b'
    };
    return presets[gradient] || '#ef4444';
};

function ServicesSection({ services, theme, mode, onUpdate, restaurantId, tableNumber, router, onServiceClick, onServicesHeaderClick, sectionStyle, section }: any) {
    if (mode === 'customer' && (!services || services.length === 0)) return null;

    const handleTextBlur = (id: string, field: string, value: string) => {
        if (mode !== 'admin' || !onUpdate) return;
        onUpdate('update_service', { id, data: { [field]: value } });
    };

    return (
        <section id="services-section" className="py-6">
            <div className="px-6 flex items-center justify-between mb-4">
                <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: sectionStyle?.title_color || '#000000' }}>{section?.section_title || 'Services'}</h2>
                {mode === 'customer' && (
                    <button 
                        onClick={() => router.push(`/${restaurantId}/customer/services/${tableNumber}`)}
                        onMouseEnter={() => HomepageBuilderService.prefetchAll(restaurantId)}
                        className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1 hover:gap-1.5 transition-all"
                    >
                        View All <LucideIcons.ChevronRight size={12} />
                    </button>
                )}
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar px-6 pb-2">
                {(services || []).filter((s: any) => mode === 'admin' || s.active).map((service: any, idx: number) => {
                    const sTitle = service.service_title || service.name;
                    const sSubtitle = service.service_subtitle || '';
                    const sImage = service.service_image || service.image_url;
                    
                    const customGradient = service.gradient;
                    const customBorder = service.border_class;
                    const customText = service.text_class;
                    const iconColor = customGradient ? getColorForGradient(customGradient) : (sectionStyle?.button_color || '#ef4444');
                    
                    return (
                        <button 
                            key={`service-${service.id || idx}-${idx}`} 
                            className={cn(
                                "shrink-0 w-32 flex flex-col items-center gap-1 p-4 rounded-2xl border relative group/service transition-all",
                                customBorder || ""
                            )}
                            style={{ 
                                background: customGradient ? `linear-gradient(135deg, ${getColorForGradient(customGradient)}15, ${getColorForGradient(customGradient)}25)` : (sectionStyle?.card_bg_color || '#f9fafb'),
                                borderColor: !customBorder ? (sectionStyle?.border_color || '#f3f4f6') : undefined
                            }}
                            onClick={() => {
                                if (mode === 'customer') {
                                    onServiceClick(service);
                                }
                            }}
                            onMouseEnter={() => HomepageBuilderService.prefetchAll(restaurantId)}
                        >
                            <div className="w-10 h-10 flex items-center justify-center mb-1">
                                {sImage ? (
                                    <img 
                                        src={sImage} 
                                        alt={sTitle} 
                                        className="w-full h-full object-contain" 
                                        loading="lazy" 
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = 'none';
                                            const fallback = (e.target as HTMLImageElement).nextElementSibling;
                                            if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                        }}
                                    />
                                ) : null}
                                <div 
                                    className="w-full h-full flex items-center justify-center rounded-xl"
                                    style={{ 
                                        backgroundColor: `${iconColor}15`,
                                        display: sImage ? 'none' : 'flex'
                                    }}
                                >
                                    {service.service_icon && (LucideIcons as any)[service.service_icon] ? (
                                        React.createElement((LucideIcons as any)[service.service_icon], {
                                            size: 20,
                                            style: { color: iconColor }
                                        })
                                    ) : (
                                        <LucideIcons.Image size={20} style={{ color: `${iconColor}40` }} />
                                    )}
                                </div>
                            </div>
                            <div className="text-center">
                                <h4 
                                    className={cn(
                                        "font-bold text-xs text-center line-clamp-1",
                                        mode === 'admin' ? 'outline-none focus:ring-2 ring-orange-500/20 rounded cursor-text px-1' : '',
                                        customText || ""
                                    )}
                                    style={{ color: !customText ? (sectionStyle?.subtitle_color || '#000000') : undefined }}
                                    contentEditable={mode === 'admin'}
                                    suppressContentEditableWarning={true}
                                    onBlur={(e: any) => handleTextBlur(service.id, 'service_title', e.target.innerText)}
                                >
                                    {sTitle}
                                </h4>
                                {sSubtitle && (
                                    <p 
                                        className={`text-[9px] text-black line-clamp-1 ${mode === 'admin' ? 'outline-none focus:ring-2 ring-orange-500/20 rounded cursor-text px-1' : ''}`}
                                        contentEditable={mode === 'admin'}
                                        suppressContentEditableWarning={true}
                                        onBlur={(e) => handleTextBlur(service.id, 'service_subtitle', e.target.innerText)}
                                    >
                                        {sSubtitle}
                                    </p>
                                )}
                            </div>
                            {mode === 'admin' && (
                                <div className="absolute top-1 right-1 opacity-0 group-hover/service:opacity-100 transition-opacity">
                                    <LucideIcons.ToggleRight size={14} className={service.active ? 'text-emerald-500' : 'text-black'} />
                                </div>
                            )}
                        </button>
                    );
                })}
                {mode === 'admin' && (
                    <button 
                        onClick={() => onUpdate('upload_service', { id: 'empty' })}
                        className="flex flex-col items-center justify-center gap-2 p-4 bg-neutral-50 rounded-2xl border-2 border-dashed border-neutral-200 cursor-pointer hover:bg-orange-50 hover:border-orange-500 transition-colors group/add"
                    >
                        <LucideIcons.PlusCircle size={24} className="text-black group-hover/add:text-orange-500" />
                        <span className="text-[10px] font-black text-black uppercase tracking-widest">Add Service</span>
                    </button>
                )}
            </div>
        </section>
    );
}

function SpecialsSection({ specials, theme, mode, onUpdate, restaurantId, tableNumber, router, sectionStyle, section }: any) {
    const { addSpecialToCart, updateQuantity, getItemQtyInCart } = useCartSafe() || {};
    if (mode === 'customer' && (!specials || specials.length === 0)) return null;

    const handleSpecialUpdate = (id: string, field: string, value: string) => {
        if (mode !== 'admin' || !onUpdate) return;
        onUpdate('update_special', { id, data: { [field]: value } });
    };

    const handleTypeChange = (id: string, type: 'single' | 'combo') => {
        if (mode !== 'admin' || !onUpdate) return;
        onUpdate('update_special', { id, data: { special_type: type } });
    };

    return (
        <section className="py-4">
            <div className="px-6 flex items-center justify-between mb-4">
                <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: sectionStyle?.title_color || '#000000' }}>{section?.section_title || 'Today Specials'}</h2>
                {mode === 'customer' && (
                    <button 
                        onClick={() => router.push(`/${restaurantId}/customer/specials/${tableNumber}`)}
                        onMouseEnter={() => HomepageBuilderService.prefetchAll(restaurantId)}
                        className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1 hover:gap-1.5 transition-all"
                    >
                        View All <LucideIcons.ChevronRight size={12} />
                    </button>
                )}
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar px-6">
                {(specials || []).map((item: any, idx: number) => {
                    const cartKey = `special-${item.id}`;
                    const qty = getItemQtyInCart?.(cartKey) || 0;
                    const mrp = item.items?.reduce((sum: number, i: any) => sum + ((i.menu_item?.price || i.price || 0) * (i.quantity || 1)), 0) || 0;
                    return (
                        <div 
                            key={item.id || idx}
                            className="w-[220px] h-[290px] flex flex-col rounded-[24px] overflow-hidden border group/special relative shrink-0"
                            style={{ 
                                backgroundColor: sectionStyle?.card_bg_color || '#ffffff',
                                borderColor: sectionStyle?.border_color || '#f5f5f5',
                                boxShadow: '0 4px 20px -1px rgba(0,0,0,0.05)'
                            }}
                        >
                            <div className="h-[120px] shrink-0 relative">
                                <img src={item.image_url || '/placeholder-food.jpg'} className="w-full h-full object-cover" alt="" loading="lazy" />
                                {mode === 'admin' && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/special:opacity-100 flex items-center justify-center gap-3">
                                        <button 
                                            className="p-2 bg-white rounded-full text-black border border-neutral-100"
                                            onClick={() => onUpdate('upload_special', { id: item.id })}
                                        >
                                            <LucideIcons.Camera size={16} />
                                        </button>
                                        <button 
                                            className="p-2 bg-white rounded-full text-red-500 border border-neutral-100"
                                            onClick={() => onUpdate('delete_special', { id: item.id })}
                                        >
                                            <LucideIcons.Trash2 size={16} />
                                        </button>
                                    </div>
                                )}
                                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center border border-white/20">
                                    <LucideIcons.Heart size={12} className="text-black" />
                                </div>
                                {mode === 'admin' && (
                                    <div className="absolute top-2 left-2 flex gap-1">
                                        <select 
                                            className="bg-white/90 backdrop-blur-md border border-neutral-100 text-[9px] font-black uppercase tracking-widest rounded-lg px-1.5 py-0.5 cursor-pointer"
                                            value={item.special_type || 'single'}
                                            onChange={(e) => handleTypeChange(item.id, e.target.value as any)}
                                        >
                                            <option value="single">Single</option>
                                            <option value="combo">Combo</option>
                                        </select>
                                        {item.active === false && (
                                            <div className="px-1.5 py-0.5 bg-red-500 rounded-lg text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-1 border border-red-600">
                                                <LucideIcons.EyeOff size={8} /> Hidden
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div 
                                    className="absolute bottom-3 left-3 px-2 py-1 backdrop-blur-md rounded-lg text-[9px] font-black uppercase tracking-widest"
                                    style={{ 
                                        backgroundColor: sectionStyle?.badge_color ? `${sectionStyle.badge_color}99` : 'rgba(0,0,0,0.6)', 
                                        color: '#ffffff' 
                                    }}
                                >
                                    Chef's Choice
                                </div>
                            </div>
                            <div className="p-2.5 flex flex-col flex-1 min-h-0">
                                <div className="flex flex-col gap-0.5">
                                    <h3 
                                        className={`font-black text-[13px] line-clamp-1 leading-tight ${mode === 'admin' ? 'hover:bg-neutral-50 px-1 rounded cursor-text' : ''}`}
                                        style={{ color: sectionStyle?.subtitle_color || '#000000' }}
                                        contentEditable={mode === 'admin'}
                                        suppressContentEditableWarning={true}
                                        onBlur={(e) => handleSpecialUpdate(item.id, 'title', (e.target as HTMLElement).innerText)}
                                    >
                                        {item.title}
                                    </h3>
                                    <div className="mt-0">
                                        {item.special_type === 'single' && item.items?.[0]?.menu_item?.name && (
                                            <span className="text-[10px] font-bold text-orange-600 line-clamp-1 italic bg-orange-50/50 px-1.5 rounded inline-block w-fit">
                                                {item.items[0].menu_item.name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="overflow-hidden">
                                    <p 
                                        className={`text-[10px] leading-snug line-clamp-1 ${mode === 'admin' ? 'hover:bg-neutral-50 px-1 rounded cursor-text' : ''}`}
                                        style={{ color: sectionStyle?.subtitle_color || '#000000' }}
                                        contentEditable={mode === 'admin'}
                                        suppressContentEditableWarning={true}
                                        onBlur={(e) => handleSpecialUpdate(item.id, 'description', (e.target as HTMLElement).innerText)}
                                    >
                                        {item.description}
                                    </p>
                                </div>
                                
                                <div className="mt-auto flex items-center justify-between pt-1.5 border-t border-neutral-50">
                                    <div className="flex flex-col">
                                        <div className="flex items-end gap-2">
                                            <span className="text-xl font-black" style={{ color: sectionStyle?.button_color || '#f97316' }}>₹{item.price}</span>
                                            {mrp > item.price && (
                                                <span className="text-xs font-bold text-black line-through mb-[2px]">₹{mrp}</span>
                                            )}
                                        </div>
                                    </div>
                                    {mode === 'customer' ? (
                                        <SharedQuantityControl 
                                            qty={qty}
                                            onAdd={() => {
                                                if (addSpecialToCart) {
                                                    addSpecialToCart(item);
                                                    toast.success(`${item.title} added to cart`, {
                                                        duration: 2000,
                                                        position: 'bottom-center',
                                                        icon: <LucideIcons.ShoppingBag size={16} className="text-green-500" />
                                                    });
                                                }
                                            }}
                                            onUpdateQuantity={(delta) => updateQuantity?.(cartKey, delta)}
                                            colorHex={sectionStyle?.button_color || '#ea580c'}
                                            buttonStyle="text"
                                        />
                                    ) : (
                                        <div 
                                            className="w-8 h-8 rounded-xl flex items-center justify-center border"
                                            style={{ 
                                                backgroundColor: sectionStyle?.button_color ? `${sectionStyle.button_color}15` : '#fff7ed', 
                                                color: sectionStyle?.button_text_color || sectionStyle?.button_color || '#ea580c',
                                                borderColor: sectionStyle?.button_color ? `${sectionStyle.button_color}30` : '#ffedd5' 
                                            }}
                                        >
                                            <LucideIcons.Plus size={16} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {mode === 'admin' && (
                    <div 
                        onClick={() => onUpdate('upload_special', { id: 'empty' })}
                        className="w-[220px] h-[280px] flex flex-col items-center justify-center bg-neutral-50 rounded-[24px] border-2 border-dashed border-neutral-200 cursor-pointer hover:bg-orange-50 hover:border-orange-500 transition-colors shrink-0 group/add"
                    >
                        <div className="flex flex-col items-center gap-2">
                            <LucideIcons.PlusCircle size={32} className="text-black group-hover/add:text-orange-500" />
                            <span className="text-[10px] font-black text-black uppercase tracking-widest">Add Special</span>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

function ComboDetailModal({ combo, isOpen, onClose, theme, mode, sectionStyle }: any) {
    const { addSpecialToCart, updateQuantity, getItemQtyInCart } = useCartSafe() || {};
    if (!combo) return null;
    
    const cartKey = `special-${combo.id}`;
    const qty = getItemQtyInCart?.(cartKey) || 0;
    const mrp = combo.items?.reduce((sum: number, i: any) => sum + ((i.menu_item?.price || i.price || 0) * (i.quantity || 1)), 0) || 0;

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-0 sm:p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                    />
                    <motion.div 
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        className="relative w-full max-w-md bg-white rounded-t-[32px] sm:rounded-[32px] overflow-hidden border border-neutral-100 max-h-[90vh] overflow-y-auto no-scrollbar"
                    >
                        <div className="relative aspect-video">
                            <img src={combo.image_url || '/placeholder-food.jpg'} className="w-full h-full object-cover" alt="" loading="lazy" />
                            <button 
                                onClick={onClose}
                                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-black/40 transition-colors"
                            >
                                <LucideIcons.X size={20} />
                            </button>
                        </div>
                        <div className="p-6 pb-10">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-1 bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">Best Value</span>
                            </div>
                            <h2 className="text-xl font-black text-black mb-2">{combo.title}</h2>
                            <p className="text-sm text-black mb-6">{combo.description || "Special value meal curation"}</p>
                            
                            <div className="space-y-3 mb-8">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-black">Included Items</h3>
                                {combo.items?.map((item: any, idx: number) => {
                                    const itemName = item.menu_item?.name || item.name || item.title || 'Combo Item';
                                    const itemImage = item.menu_item?.image_url || item.image_url || item.item_image || item.menu_item?.item_image || '/placeholder-food.jpg';
                                    const itemPrice = item.menu_item?.price || item.price;

                                    return (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-neutral-50 rounded-2xl border border-neutral-100">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-neutral-100">
                                                    <img src={itemImage} className="w-full h-full object-cover" alt={itemName} loading="lazy" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-black">{itemName}</p>
                                                    {item.quantity > 1 && <p className="text-[10px] text-black">Qty: {item.quantity}</p>}
                                                </div>
                                            </div>
                                            {itemPrice && <span className="text-xs font-bold text-black">₹{itemPrice}</span>}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="flex items-center justify-between pt-6 border-t border-neutral-100 sticky bottom-0 bg-white">
                                <div className="flex flex-col">
                                    <div className="flex items-end gap-2">
                                        <span className="text-2xl font-black text-black">₹{combo.price}</span>
                                        {mrp > combo.price && (
                                            <span className="text-sm font-bold text-black line-through mb-1">₹{mrp}</span>
                                        )}
                                    </div>
                                </div>
                                {mode === 'customer' && (
                                    <SharedQuantityControl
                                        qty={qty}
                                        onAdd={() => {
                                            if (addSpecialToCart) {
                                                addSpecialToCart(combo);
                                                toast.success(`${combo.title} added to cart`, {
                                                    duration: 2000,
                                                    position: 'bottom-center',
                                                    icon: <LucideIcons.ShoppingBag size={16} className="text-green-500" />
                                                });
                                            }
                                        }}
                                        onUpdateQuantity={(delta) => updateQuantity?.(cartKey, delta)}
                                        colorHex={theme?.primary_color || '#ea580c'}
                                        buttonStyle="text"
                                        size="lg"
                                    />
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

function ComboOfferCard({ combo, onSelect, mode, onUpdate, sectionStyle, router, restaurantId, tableNumber }: any) {
    const { addSpecialToCart, updateQuantity, getItemQtyInCart } = useCartSafe() || {};
    const handleTextBlur = (field: string, value: string) => {
        if (mode !== 'admin' || !onUpdate) return;
        onUpdate('update_combo', { id: combo.id, data: { [field]: value } });
    };

    const itemsCount = combo.items?.length || 0;
    const previewItems = combo.items?.slice(0, 2) || [];
    const remainingCount = itemsCount - 2;

    const cartKey = `special-${combo.id}`;
    const qty = getItemQtyInCart?.(cartKey) || 0;
    const mrp = combo.items?.reduce((sum: number, i: any) => sum + ((i.menu_item?.price || i.price || 0) * (i.quantity || 1)), 0) || 0;

    return (
        <div 
            onClick={() => mode === 'customer' && onSelect()}
            className={`w-[220px] h-[320px] border rounded-2xl overflow-hidden relative group/combo flex flex-col shrink-0 ${mode === 'customer' ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
            style={{ 
                backgroundColor: sectionStyle?.card_bg_color || '#ffffff',
                borderColor: sectionStyle?.border_color || '#f5f5f5',
                boxShadow: '0 4px 20px -1px rgba(0,0,0,0.05)'
            }}
        >
            <div className="h-[160px] shrink-0 relative">
                <img src={combo.image_url || '/placeholder-food.jpg'} className="w-full h-full object-cover" alt="" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                <div className="absolute top-3 left-3">
                    <span className="px-2 py-0.5 bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest rounded-lg">Combo Offer</span>
                </div>
                {mode === 'admin' && (
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/combo:opacity-100 flex items-center justify-center gap-3 z-20">
                        <button 
                            className="p-2 bg-white rounded-full text-black border border-neutral-100"
                            onClick={(e) => { e.stopPropagation(); onUpdate('upload_combo', { id: combo.id }); }}
                        >
                            <LucideIcons.Camera size={16} />
                        </button>
                        <button 
                            className="p-2 bg-white rounded-full text-red-500 border border-neutral-100"
                            onClick={(e) => { e.stopPropagation(); onUpdate('delete_combo', { id: combo.id }); }}
                        >
                            <LucideIcons.Trash2 size={16} />
                        </button>
                    </div>
                )}
            </div>

            <div className="p-2.5 flex flex-col flex-1 min-h-0">
                <div className="flex flex-col">
                    <h3 
                    className={`font-black text-[13px] mb-0.5 line-clamp-1 ${mode === 'admin' ? 'hover:bg-neutral-50 px-1 rounded cursor-text' : ''}`}
                    style={{ color: sectionStyle?.subtitle_color || '#000000' }}
                    contentEditable={mode === 'admin'}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => handleTextBlur('title', e.currentTarget.innerText)}
                >
                    {combo.title}
                </h3>
                <p 
                    className={`text-[10px] leading-tight line-clamp-1 mb-1 ${mode === 'admin' ? 'hover:bg-neutral-50 px-1 rounded cursor-text' : ''}`}
                    style={{ color: sectionStyle?.subtitle_color || '#000000' }}
                    contentEditable={mode === 'admin'}
                    suppressContentEditableWarning={true}
                    onBlur={(e) => handleTextBlur('description', e.currentTarget.innerText)}
                >
                    {combo.description || 'Special value meal curation'}
                </p>

                {/* Compact Preview Logic */}
                {itemsCount > 0 && (
                    <div className="mb-1 space-y-0.5">
                        {previewItems.map((item: any, idx: number) => {
                            const itemName = item.menu_item?.name || item.name || item.title || 'Combo Item';
                            return (
                                <div key={idx} className="flex items-center gap-1.5 text-[10px] font-bold text-black truncate">
                                    <div className="w-1 h-1 rounded-full bg-orange-400 shrink-0" />
                                    <span className="truncate">{itemName}</span>
                                    {item.quantity > 1 && <span className="text-[9px] font-bold text-black">x{item.quantity}</span>}
                                </div>
                            );
                        })}
                        {remainingCount > 0 && (
                            <div className="text-[9px] font-black text-orange-500 uppercase tracking-widest pl-2.5">
                                +{remainingCount} more
                            </div>
                        )}
                    </div>
                )}
                </div>
                
                <div className="mt-auto flex items-center justify-between pt-1.5 border-t border-neutral-50">
                    <div className="flex items-end gap-1.5">
                        <div 
                            className={`text-lg font-black ${mode === 'admin' ? 'hover:bg-neutral-50 px-1 rounded cursor-text' : ''}`}
                            style={{ color: sectionStyle?.button_color || '#f97316' }}
                            contentEditable={mode === 'admin'}
                            suppressContentEditableWarning={true}
                            onBlur={(e) => handleTextBlur('price', e.currentTarget.innerText.replace('₹', ''))}
                        >
                            ₹{combo.price}
                        </div>
                        {mrp > combo.price && (
                            <span className="text-xs font-bold text-black line-through mb-[2px]">₹{mrp}</span>
                        )}
                    </div>
                    {mode === 'customer' ? (
                        <SharedQuantityControl 
                            qty={qty}
                            onAdd={() => {
                                addSpecialToCart?.(combo);
                            }}
                            onUpdateQuantity={(delta) => updateQuantity?.(cartKey, delta)}
                            colorHex={sectionStyle?.button_color || '#ea580c'}
                            buttonStyle="text"
                        />
                    ) : (
                        <div 
                            className="w-8 h-8 rounded-xl flex items-center justify-center border"
                            style={{ 
                                backgroundColor: sectionStyle?.button_color ? `${sectionStyle.button_color}15` : '#fff7ed', 
                                color: sectionStyle?.button_text_color || sectionStyle?.button_color || '#ea580c',
                                borderColor: sectionStyle?.button_color ? `${sectionStyle.button_color}30` : '#ffedd5' 
                            }}
                        >
                            <LucideIcons.Plus size={16} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function CombosSection({ combos, theme, mode, onUpdate, restaurantId, tableNumber, router, sectionStyle, section }: any) {
    const { addSpecialToCart, updateQuantity, getItemQtyInCart } = useCartSafe() || {};
    if (mode === 'customer' && (!combos || combos.length === 0)) return null;

    const [selectedCombo, setSelectedCombo] = useState<any>(null);

    return (
        <section className="py-4">
            <div className="px-6 flex items-center justify-between mb-4">
                <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: sectionStyle?.title_color || '#000000' }}>{section?.section_title || 'Combo Offers'}</h2>
                {mode === 'customer' && (
                    <button 
                        onClick={() => router.push(`/${restaurantId}/customer/combos/${tableNumber}`)}
                        onMouseEnter={() => HomepageBuilderService.prefetchAll(restaurantId)}
                        className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1 hover:gap-1.5 transition-all"
                    >
                        View All <LucideIcons.ChevronRight size={12} />
                    </button>
                )}
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar px-6">
                {(combos || []).map((combo: any) => (
                    <ComboOfferCard 
                        key={combo.id}
                        combo={combo}
                        mode={mode}
                        sectionStyle={sectionStyle}
                        onUpdate={onUpdate}
                        onSelect={() => setSelectedCombo(combo)}
                        router={router}
                        restaurantId={restaurantId}
                        tableNumber={tableNumber}
                    />
                ))}

                {mode === 'admin' && (
                    <div 
                        onClick={() => onUpdate('upload_combo', { id: 'empty' })}
                        className="min-w-[220px] h-[320px] flex items-center justify-center bg-neutral-50 rounded-[24px] border-2 border-dashed border-neutral-200 cursor-pointer hover:bg-orange-50 hover:border-orange-500 transition-colors shrink-0"
                    >
                        <div className="flex flex-col items-center gap-2">
                            <LucideIcons.PlusCircle size={32} className="text-black" />
                            <span className="text-[10px] font-black text-black uppercase tracking-widest">Add Combo</span>
                        </div>
                    </div>
                )}
            </div>

            <ComboDetailModal 
                combo={selectedCombo} 
                isOpen={!!selectedCombo} 
                onClose={() => setSelectedCombo(null)} 
                theme={theme}
                mode={mode}
                sectionStyle={sectionStyle}
            />
        </section>
    );
}

function OffersSection({ offers, theme, mode, onUpdate, restaurantId, tableNumber, router, sectionStyle, section }: any) {
    if (mode === 'customer' && (!offers || offers.length === 0)) return null;

    const [revealedCoupons, setRevealedCoupons] = useState<Record<string, boolean>>({});

    const handleTextBlur = (id: string, field: string, value: string) => {
        if (mode !== 'admin' || !onUpdate) return;
        // Map UI field names to database field names if necessary
        const dbField = field === 'offer_title' ? 'title' : field === 'offer_description' ? 'description' : field;
        onUpdate('update_offer', { id, data: { [dbField]: value } });
    };

    const activeOffers = mode === 'customer' 
        ? (offers || []).filter((o: any) => getItemStatus(o) === 'active')
        : offers;

    return (
        <section className="py-6">
            <div className="px-6 flex items-center justify-between mb-4">
                <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: sectionStyle?.title_color || '#000000' }}>{section?.section_title || 'Coupons and Offers'}</h2>
                {mode === 'customer' && (
                    <button 
                        onClick={() => router.push(`/${restaurantId}/customer/offers/${tableNumber}`)}
                        onMouseEnter={() => HomepageBuilderService.prefetchAll(restaurantId)}
                        className="text-[10px] font-black uppercase tracking-widest text-orange-500 flex items-center gap-1 hover:gap-1.5 transition-all"
                    >
                        View All <LucideIcons.ChevronRight size={12} />
                    </button>
                )}
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar px-6">
                {(activeOffers || []).map((offer: any) => (
                    <div key={offer.id} className="min-w-[240px] h-[180px] flex flex-col border rounded-[24px] overflow-hidden relative group/offer" style={{ backgroundColor: sectionStyle?.card_bg_color || '#ecfdf5', borderColor: sectionStyle?.border_color || '#d1fae5' }}>
                        {(offer.image_url || offer.banner_image) && (
                            <div className="h-[45px] w-full relative shrink-0">
                                <img src={offer.image_url || offer.banner_image} className="w-full h-full object-cover" alt="" loading="lazy" />
                                <div className="absolute inset-0 bg-gradient-to-t to-transparent" style={{ '--tw-gradient-from': `${sectionStyle?.card_bg_color || '#ecfdf5'} var(--tw-gradient-from-position)` } as any} />
                            </div>
                        )}
                        <div className="absolute top-0 right-0 w-24 h-24 rounded-full -mr-12 -mt-12" style={{ backgroundColor: sectionStyle?.card_bg_color ? `${sectionStyle.card_bg_color}80` : '#d1fae580' }} />
                        {mode === 'admin' && (
                            <div className="absolute top-2 right-2 z-20 opacity-0 group-hover/offer:opacity-100 transition-opacity flex gap-1">
                                <button 
                                    className="p-1.5 bg-white/80 backdrop-blur-md rounded-lg text-black"
                                    onClick={() => onUpdate('upload_offer', { id: offer.id })}
                                >
                                    <LucideIcons.Camera size={12} />
                                </button>
                                <button className="p-1.5 bg-white/80 backdrop-blur-md rounded-lg text-red-500"><LucideIcons.Trash2 size={12} /></button>
                            </div>
                        )}
                        <div className="p-2.5 relative z-10 flex flex-col flex-1 min-h-0">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-white text-[7px] font-black px-1 py-0.5 rounded-md uppercase tracking-widest" style={{ backgroundColor: sectionStyle?.badge_color || '#10b981' }}>
                                    {offer.discount_type === 'flat' ? `₹${offer.discount_value} OFF` : `${offer.discount_value}% OFF`}
                                </span>
                                {(offer.expiry_datetime || offer.end_datetime) && <CountdownTimer expiryDate={offer.expiry_datetime || offer.end_datetime} />}
                            </div>
                            
                            <h4 
                                className={`font-black text-xs mb-1 ${mode === 'admin' ? 'outline-none focus:ring-2 ring-emerald-500/20 rounded cursor-text' : ''}`}
                                style={{ color: sectionStyle?.title_color || '#064e3b' }}
                                contentEditable={mode === 'admin'}
                                suppressContentEditableWarning={true}
                                onBlur={(e) => handleTextBlur(offer.id, 'offer_title', e.target.innerText)}
                            >
                                {offer.title || (offer.discount_type === 'flat' ? `₹${offer.discount_value} OFF` : `${offer.discount_value}% OFF`)}
                            </h4>
                            <p 
                                className={`text-[8px] leading-tight mb-1.5 line-clamp-1 ${mode === 'admin' ? 'outline-none focus:ring-2 ring-emerald-500/20 rounded cursor-text' : ''}`}
                                style={{ color: sectionStyle?.subtitle_color || '#047857' }}
                                contentEditable={mode === 'admin'}
                                suppressContentEditableWarning={true}
                                onBlur={(e) => handleTextBlur(offer.id, 'offer_description', e.target.innerText)}
                            >
                                {offer.description || `Use code ${offer.code || offer.coupon_code} at checkout.`}
                            </p>

                            {/* Prominent Coupon Code Block */}
                            {!revealedCoupons[offer.id] ? (
                                <div 
                                    onClick={() => setRevealedCoupons(prev => ({ ...prev, [offer.id]: true }))}
                                    className="mb-2 p-1.5 border-2 border-dashed rounded-xl flex items-center justify-center gap-2 cursor-pointer bg-white/40 hover:bg-white/60 transition-all active:scale-95 shadow-sm border-neutral-300"
                                >
                                    <LucideIcons.Eye size={14} className="text-black" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-black">Reveal Coupon</span>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => {
                                        const code = offer.code || offer.coupon_code || 'PROMO';
                                        navigator.clipboard.writeText(code);
                                        toast.success(`Code ${code} copied!`, {
                                            duration: 2000,
                                            position: 'bottom-center',
                                            icon: <LucideIcons.Copy size={16} className="text-emerald-500" />
                                        });
                                    }}
                                    className="mb-2 p-1.5 border-2 border-dashed rounded-xl flex items-center justify-between cursor-pointer hover:bg-white/80 transition-all active:scale-95 shadow-sm"
                                    style={{ 
                                        borderColor: sectionStyle?.badge_color ? `${sectionStyle.badge_color}40` : '#d1fae5', 
                                        backgroundColor: '#ffffff60' 
                                    }}
                                >
                                    <div className="flex flex-col">
                                        <span className="text-[14px] font-black tracking-widest uppercase font-mono" style={{ color: sectionStyle?.title_color || '#064e3b' }}>
                                            {offer.code || offer.coupon_code || 'PROMO'}
                                        </span>
                                    </div>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white shadow-sm border border-neutral-100" style={{ color: sectionStyle?.badge_color || '#10b981' }}>
                                        <LucideIcons.Copy size={14} />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: sectionStyle?.border_color || '#d1fae580' }}>
                                <span className="text-[10px] font-bold italic" style={{ color: sectionStyle?.subtitle_color || '#000000' }}>Limited Time</span>
                                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: sectionStyle?.badge_color || '#10b981' }}>Tap to Copy</span>
                            </div>
                        </div>
                    </div>
                ))}
                {mode === 'admin' && (
                    <div 
                        onClick={() => onUpdate?.('upload_offer', { id: 'empty' })}
                        className="min-w-[240px] h-[180px] flex items-center justify-center bg-neutral-50 rounded-[24px] border-2 border-dashed border-neutral-200 cursor-pointer hover:bg-emerald-50 hover:border-emerald-500 transition-colors"
                    >
                        <div className="flex flex-col items-center gap-2">
                            <LucideIcons.PlusCircle size={32} className="text-black" />
                            <span className="text-[10px] font-black text-black uppercase tracking-widest">Add Coupon/Offer</span>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

function PopularItemsSection({ items, theme, mode, onUpdate, restaurantId, tableNumber, sectionStyle, section }: any) {
    const { addToCart, updateQuantity, getItemQtyInCart } = useCartSafe() || {};
    if (mode === 'customer' && (!items || items.length === 0)) return null;

    return (
        <section className="py-6">
            <h2 className="px-6 text-sm font-black uppercase tracking-widest mb-4" style={{ color: sectionStyle?.title_color || '#000000' }}>{section?.section_title || 'Popular Items'}</h2>
            <div className="grid grid-cols-2 gap-4 px-6">
                {(items || []).map((item: any) => {
                    const qty = getItemQtyInCart ? getItemQtyInCart(item.id) : 0;
                    
                    return (
                        <div key={item.id} className="rounded-[24px] p-3 border relative group/item" style={{ backgroundColor: sectionStyle?.card_bg_color || '#ffffff', borderColor: sectionStyle?.border_color || '#f5f5f5' }}>
                            <div className="w-full aspect-square rounded-xl overflow-hidden mb-3 relative">
                                <img src={item.image_url || '/placeholder-food.jpg'} className="w-full h-full object-cover" alt="" loading="lazy" />
                                {mode === 'admin' && (
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/item:opacity-100 flex items-center justify-center">
                                        <LucideIcons.Settings size={16} className="text-white" />
                                    </div>
                                )}
                            </div>
                            <h3 className="text-[11px] font-bold mb-1 truncate" style={{ color: sectionStyle?.subtitle_color || '#000000' }}>{item.name}</h3>
                            <div className="flex items-center gap-1 mb-2">
                                <LucideIcons.Star size={10} style={{ color: sectionStyle?.badge_color || '#f97316', fill: sectionStyle?.badge_color || '#f97316' }} />
                                <span className="text-[10px] font-bold" style={{ color: sectionStyle?.subtitle_color || '#000000' }}>{item.rating || '4.5'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black" style={{ color: sectionStyle?.subtitle_color || '#000000' }}>₹{item.price}</span>
                                
                                <SharedQuantityControl 
                                    qty={qty}
                                    onAdd={() => {
                                        if (mode === 'customer' && addToCart) {
                                            addToCart(item, 1);
                                            toast.success(`${item.name} added to cart`, {
                                                duration: 2000,
                                                position: 'bottom-center',
                                                icon: <LucideIcons.ShoppingBag size={16} className="text-green-500" />
                                            });
                                        }
                                    }}
                                    onUpdateQuantity={(delta) => updateQuantity?.(item.id, delta)}
                                    colorHex={sectionStyle?.button_color || '#ea580c'}
                                    buttonStyle="text"
                                />
                            </div>
                        </div>
                    );
                })}
                {(items || []).length === 0 && mode === 'admin' && (
                    <div className="col-span-2 py-8 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-[24px] bg-neutral-50 text-black">
                        <LucideIcons.Sparkles size={32} className="mb-2 opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No Popular Items Yet</p>
                        <p className="text-[8px] mt-1 text-black font-bold">Mark items as 'Popular' in your Menu</p>
                    </div>
                )}
            </div>
        </section>
    );
}

function ReorderSection({ orders, theme, mode, onUpdate, restaurantId, tableNumber, sectionStyle, section }: any) {
    if (mode === 'customer' && (!orders || orders.length === 0)) return null;

    return (
        <section className="py-6">
            <h2 className="px-6 text-sm font-black uppercase tracking-widest mb-4" style={{ color: sectionStyle?.title_color || '#000000' }}>{section?.section_title || 'Quick Reorder'}</h2>
            <div className="flex gap-4 overflow-x-auto no-scrollbar px-6">
                {(orders || []).map((order: any) => (
                    <div 
                        key={order.id} 
                        className="w-[240px] shrink-0 p-4 border rounded-[28px] relative overflow-hidden"
                        style={{ backgroundColor: sectionStyle?.card_bg_color || '#ffffff', borderColor: sectionStyle?.border_color || '#f5f5f5' }}
                    >
                        <div className="flex items-center justify-between mb-3">
                            <div className="p-2 rounded-xl bg-orange-50 text-orange-500">
                                <LucideIcons.Clock size={16} />
                            </div>
                            <span className="text-[10px] font-black text-black uppercase tracking-widest">{new Date(order.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="space-y-2 mb-4">
                            {(order.items || order.order_items || []).slice(0, 2).map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold truncate pr-2" style={{ color: sectionStyle?.subtitle_color || '#000000' }}>{item.quantity}x {item.menu_item?.name || item.menu_items?.name || 'Item'}</span>
                                    <span className="text-[10px] font-black" style={{ color: sectionStyle?.subtitle_color || '#000000' }}>₹{item.price}</span>
                                </div>
                            ))}
                        </div>
                        <button 
                            className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-95"
                            style={{ backgroundColor: sectionStyle?.button_color || '#f97316', color: sectionStyle?.button_text_color || '#ffffff' }}
                            onClick={() => {
                                if (mode === 'customer') {
                                    // Reorder logic
                                    toast.success('Adding previous items to cart...');
                                }
                            }}
                        >
                            <LucideIcons.RotateCcw size={14} /> Reorder Now
                        </button>
                    </div>
                ))}
                {(orders || []).length === 0 && mode === 'admin' && (
                    <div className="col-span-2 py-8 flex flex-col items-center justify-center border-2 border-dashed border-neutral-200 rounded-[24px] bg-neutral-50 text-black w-full min-w-[300px]">
                        <LucideIcons.History size={32} className="mb-2 opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest">Customer History Section</p>
                        <p className="text-[8px] mt-1 text-black font-bold">Will show recent orders to returning customers</p>
                    </div>
                )}
            </div>
        </section>
    );
}


function FooterSection({ profile, theme, mode, onUpdate, restaurantId, tableNumber, sectionStyle }: any) {
    const handleBlur = (e: React.FocusEvent<HTMLParagraphElement>) => {
        if (mode !== 'admin' || !onUpdate) return;
        onUpdate('profile', { footer_info: e.target.innerText });
    };

    const restaurantName = profile?.name || profile?.restaurant_info?.name || 'FlavorExpress';
    const footerInfo = profile?.footer_info || profile?.restaurant_info?.footer_info || 
        `${profile?.restaurant_info?.address?.street || '123 Delivery Avenue'}, ${profile?.restaurant_info?.address?.city || 'Food District'}\nPhone: ${profile?.restaurant_info?.phone || '+1 (555) 000-0000'}\nEmail: ${profile?.restaurant_info?.email || 'support@flavorexpress.com'}`;

    return (
        <footer className="px-6 py-12 border-t flex flex-col gap-10" style={{ backgroundColor: sectionStyle?.card_bg_color || '#fafafa80', borderColor: sectionStyle?.border_color || '#f5f5f5' }}>
            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-black uppercase tracking-tight" style={{ color: sectionStyle?.title_color || '#000000' }}>{restaurantName}</h2>
                <p 
                    className={`text-xs leading-relaxed whitespace-pre-line ${mode === 'admin' ? 'hover:bg-black/5 px-1 rounded cursor-text' : ''}`}
                    style={{ color: sectionStyle?.subtitle_color || '#000000' }}
                    contentEditable={mode === 'admin'}
                    suppressContentEditableWarning={true}
                    onBlur={handleBlur}
                >
                    {footerInfo}
                </p>
            </div>

            <div className="flex flex-col gap-6">
                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: sectionStyle?.subtitle_color || '#000000' }}>Opening Hours</h3>
                    <div className="flex justify-between text-[10px] font-bold" style={{ color: sectionStyle?.subtitle_color || '#000000' }}>
                        <span>Mon - Fri: 10:00 AM - 11:00 PM</span>
                        <span>Sat - Sun: 9:00 AM - 12:00 AM</span>
                    </div>
                </div>

                <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: sectionStyle?.subtitle_color || '#000000' }}>Support & Info</h3>
                    <div className="flex flex-col gap-3 text-[10px] font-bold" style={{ color: sectionStyle?.subtitle_color || '#000000' }}>
                        <span>FAQ</span>
                        <span>Privacy Policy</span>
                        <span>Terms of Service</span>
                        <span>Contact Us</span>
                    </div>
                </div>
            </div>

            <div className="pt-10 flex flex-col items-center gap-4">
                <p className="text-[10px] text-center" style={{ color: sectionStyle?.subtitle_color || '#000000' }}>
                    © 2024 {restaurantName}. All rights reserved.<br />
                    Powered by Restaurant OS
                </p>
            </div>
        </footer>
    );
}
