'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, usePathname, useSearchParams, useRouter } from 'next/navigation';
import { getCategoryMenuItemImage } from '@/lib/utils';
import { MenuService, Category, SubCategory, MenuItem } from '@/services/menu.service';
import { OrderService } from '@/services/orders.service';
import { useCartSafe, isSpecialActive, getActivePrice } from '@/context/CartContext';
import { 
    Utensils as LucideUtensils, 
    Search as LucideSearch, 
    Flame as LucideFlame, 
    ShoppingBag as LucideShoppingBag,
    X as LucideX, 
    Sparkles as LucideSparkles, 
    ArrowLeft as LucideArrowLeft,
    ChevronRight as LucideChevronRight,
    AlertCircle as LucideAlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SpecialsService, TodaySpecial } from '@/services/specials.service';
import { SharedSkeleton } from '@/components/customer/SharedSkeleton';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { CustomerCache } from '@/services/homepage-cache.service';
import SharedQuantityControl from '@/components/shared/SharedQuantityControl';
import { toast } from 'sonner';
import { SharedItemDetailModal, SharedSpecialDetailModal, SharedComboDetailModal, VegNonVegBadge } from '@/components/shared/details';

export function PersistentMenu({ restaurantId, tableNumber }: { restaurantId: string, tableNumber: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const isVisible = pathname.includes('/customer/menu/');
    const searchParams = useSearchParams();
    const categoryParam = searchParams.get('category');
    const itemParam = searchParams.get('item');
    const handledBannerItemRef = useRef<string | null>(null);

    // Completely clear banner item query parameter from URL history and router
    const clearBannerParam = useCallback(() => {
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (url.searchParams.has('item')) {
                url.searchParams.delete('item');
                const cleanSearch = url.searchParams.toString();
                const cleanUrl = url.pathname + (cleanSearch ? `?${cleanSearch}` : '');
                window.history.replaceState(null, '', cleanUrl);
                router.replace(cleanUrl, { scroll: false });
            }
        }
    }, [router]);
    
    const cartContext = useCartSafe();
    const addToCart = cartContext?.addToCart || (() => {});
    const addSpecialToCart = cartContext?.addSpecialToCart || (() => {});
    const cart = cartContext?.cart || {};
    const updateQuantity = cartContext?.updateQuantity || (() => {});
    const setTableNumber = cartContext?.setTableNumber || (() => {});

    // Cache handling
    const cachedData = CustomerCache.get(restaurantId, 'menu', tableNumber);
    
    const [categories, setCategories] = useState<Category[]>(cachedData?.categories || []);
    const [allMenuItems, setAllMenuItems] = useState<MenuItem[]>(cachedData?.allMenuItems || []);
    const [allSubCategories, setAllSubCategories] = useState<SubCategory[]>(cachedData?.allSubCategories || []);
    const [subCategories, setSubCategories] = useState<SubCategory[]>(cachedData?.subCategories || []);
    const [menuItems, setMenuItems] = useState<MenuItem[]>(cachedData?.menuItems || []);
    const [activeCategory, setActiveCategory] = useState<number | string | null>(cachedData?.activeCategory || null);
    const [specials, setSpecials] = useState<MenuItem[]>(cachedData?.specials || []);
    const [combos, setCombos] = useState<MenuItem[]>(cachedData?.combos || []);
    const [activeSubCategory, setActiveSubCategory] = useState<number | 'ALL'>(cachedData?.activeSubCategory || 'ALL');

    const [activeTypeFilter, setActiveTypeFilter] = useState<'ALL' | 'Veg' | 'Non-Veg'>('ALL');
    const [loading, setLoading] = useState(!cachedData);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [isVegMode, setIsVegMode] = useState(false);
    const [tableDisplayName, setTableDisplayName] = useState(tableNumber);
    const [tableNotFound, setTableNotFound] = useState(false);
    const [profile, setProfile] = useState<any>(cachedData?.profile || null);
    const [sectionStyles, setSectionStyles] = useState<any>(cachedData?.sectionStyles || null);

    const [selectedItemForDetail, setSelectedItemForDetail] = useState<any | null>(null);
    const [selectedSpecialForDetail, setSelectedSpecialForDetail] = useState<any | null>(null);
    const [selectedComboForDetail, setSelectedComboForDetail] = useState<any | null>(null);
    const dishesContainerRef = useRef<HTMLDivElement>(null);
    const dishesScrollPos = useRef(0);
    const isFirstRun = useRef(true);

    const loadData = useCallback(async (showLoading = true) => {
        if (showLoading && !CustomerCache.get(restaurantId, 'menu', tableNumber)) setLoading(true);
        try {
            const [
                catsResult,
                allItemsResult,
                allSubsResult,
                specialsResult,
                combosResult,
                tableInfoResult,
                profileResult,
                stylesResult
            ] = await Promise.allSettled([
                MenuService.fetchCategories(restaurantId),
                MenuService.fetchMenuItems(restaurantId),
                MenuService.fetchAllSubCategories(restaurantId),
                SpecialsService.fetchActiveSpecials(restaurantId),
                HomepageBuilderService.getCombos(restaurantId, true),
                OrderService.findTableAnywhere(tableNumber, restaurantId),
                HomepageBuilderService.getProfile(restaurantId),
                HomepageBuilderService.getSectionStyles(restaurantId)
            ]);

            const cats = catsResult.status === 'fulfilled' ? (catsResult.value || []) : [];
            const allItems = allItemsResult.status === 'fulfilled' ? (allItemsResult.value || []) : [];
            const allSubs = allSubsResult.status === 'fulfilled' ? (allSubsResult.value || []) : [];
            const specialsData = specialsResult.status === 'fulfilled' ? (specialsResult.value || []) : [];
            const combosData = combosResult.status === 'fulfilled' ? (combosResult.value || []) : [];
            const tableInfo = tableInfoResult.status === 'fulfilled' ? tableInfoResult.value : null;
            const profileData = profileResult.status === 'fulfilled' ? profileResult.value : null;
            const stylesData = stylesResult.status === 'fulfilled' ? stylesResult.value : null;

            setProfile(profileData);
            setSectionStyles(stylesData);

            const normTable = String(tableNumber || '').trim().toLowerCase();
            const isVirtualMode = normTable === 'takeaway' || normTable === 'delivery';

            if (isVirtualMode) {
                setTableDisplayName(normTable === 'takeaway' ? 'Takeaway' : 'Delivery');
                setTableNotFound(false);
            } else if (tableInfo) {
                setTableDisplayName(tableInfo.display_name?.replace('Table ', '') || tableInfo.table_number?.toString() || tableNumber);
                setTableNotFound(false);
            } else {
                setTableNotFound(true);
            }

            // 1. Partition and normalize Combos
            const rawCombos: any[] = [...(combosData || [])];
            (specialsData || []).forEach((s: any) => {
                if (s.is_combo || s.special_type === 'combo') {
                    if (!rawCombos.some((c: any) => String(c.id) === String(s.id))) {
                        rawCombos.push(s);
                    }
                }
            });
            (allItems || []).forEach((item: any) => {
                if (item.item_type?.toLowerCase() === 'combo' || (item as any).is_combo || (item as any).isCombo) {
                    if (!rawCombos.some((c: any) => String(c.id) === String(item.id))) {
                        rawCombos.push(item);
                    }
                }
            });

            const normalizedCombos: MenuItem[] = rawCombos.map((c: any) => {
                const items = c.items || c.combo_items || [];
                const calculatedOriginalPrice = c.original_price || (items.length > 0
                    ? items.reduce((sum: number, si: any) => sum + (si.menu_item?.price || si.price || 0) * (si.quantity || 1), 0)
                    : undefined) || c.price || c.special_price || 0;

                return {
                    ...c,
                    id: c.id,
                    name: c.title || c.name || "Combo Deal",
                    title: c.title || c.name || "Combo Deal",
                    price: calculatedOriginalPrice,
                    special_price: c.special_price !== undefined && c.special_price !== null ? c.special_price : c.price,
                    is_today_special: false,
                    isSpecial: false,
                    is_combo: true,
                    isCombo: true,
                    item_type: 'combo',
                    items: items,
                    image_url: c.image_url || (items[0]?.menu_item?.image_url) || getCategoryMenuItemImage(c.title || c.name)
                } as unknown as MenuItem;
            });

            // 2. Partition and normalize Specials (Today's Specials / Chef's Specials)
            const rawSpecials: any[] = [];
            (specialsData || []).forEach((s: any) => {
                if (!s.is_combo && s.special_type !== 'combo') {
                    if (!rawSpecials.some((item: any) => String(item.id) === String(s.id))) {
                        rawSpecials.push(s);
                    }
                }
            });
            (allItems || []).forEach((item: any) => {
                if (isSpecialActive(item) && !item.is_combo && item.item_type?.toLowerCase() !== 'combo') {
                    if (!rawSpecials.some((s: any) => String(s.id) === String(item.id))) {
                        rawSpecials.push(item);
                    }
                }
            });

            const normalizedSpecials: MenuItem[] = rawSpecials.map((s: any) => {
                const items = s.items || [];
                const calculatedOriginalPrice = s.original_price || (items.length > 0
                    ? items.reduce((sum: number, si: any) => sum + (si.menu_item?.price || si.price || 0) * (si.quantity || 1), 0)
                    : undefined) || s.price || s.special_price || 0;

                return {
                    ...s,
                    id: s.id,
                    name: s.title || s.name || "Chef's Special",
                    title: s.title || s.name || "Chef's Special",
                    price: calculatedOriginalPrice,
                    special_price: s.special_price !== undefined && s.special_price !== null ? s.special_price : s.price,
                    is_today_special: true,
                    isSpecial: true,
                    is_combo: false,
                    isCombo: false,
                    item_type: items[0]?.menu_item?.item_type || s.item_type || 'special',
                    items: items,
                    image_url: s.image_url || (items[0]?.menu_item?.image_url) || getCategoryMenuItemImage(s.title || s.name)
                } as unknown as MenuItem;
            });

            setCategories(cats || []);
            setAllMenuItems(allItems || []);
            setAllSubCategories(allSubs || []);
            setSpecials(normalizedSpecials);
            setCombos(normalizedCombos);

            let initialCat = cats && cats.length > 0 ? cats[0].id : null;
            if (categoryParam) {
                const up = categoryParam.toUpperCase();
                if (up === 'SPECIALS' || up === 'TODAY_SPECIALS') {
                    initialCat = 'SPECIALS';
                } else if (up === 'COMBOS' || up === 'COMBOS_OFFERS' || up === 'COMBO') {
                    initialCat = 'COMBOS';
                } else {
                    const paramMatch = cats?.find((c: any) => 
                        c.name.toLowerCase() === categoryParam.toLowerCase() || 
                        String(c.id) === String(categoryParam)
                    );
                    if (paramMatch) initialCat = paramMatch.id;
                }
            }

            setActiveCategory(initialCat);
            
            CustomerCache.set(restaurantId, 'menu', {
                categories: cats,
                allMenuItems: allItems,
                allSubCategories: allSubs,
                activeCategory: initialCat,
                specials: normalizedSpecials,
                combos: normalizedCombos,
                profile: profileData,
                sectionStyles: stylesData
            }, tableNumber);

        } catch (err) {
            console.error('Error loading menu:', err);
        } finally {
            setLoading(false);
        }
    }, [restaurantId, tableNumber, categoryParam]);

    useEffect(() => {
        loadData(isFirstRun.current && !cachedData);
        isFirstRun.current = false;
    }, [loadData]);

    // Reactively switch category when user redirects from homepage category buttons
    useEffect(() => {
        if (!categoryParam) return;
        const up = categoryParam.toUpperCase();
        if (up === 'SPECIALS' || up === 'TODAY_SPECIALS') {
            setActiveCategory('SPECIALS');
            return;
        }
        if (up === 'COMBOS' || up === 'COMBOS_OFFERS' || up === 'COMBO') {
            setActiveCategory('COMBOS');
            return;
        }
        if (categories.length > 0) {
            const match = categories.find((c: any) => 
                c.name.toLowerCase() === categoryParam.toLowerCase() || 
                String(c.id) === String(categoryParam)
            );
            if (match) {
                setActiveCategory(match.id);
            }
        }
    }, [categoryParam, categories]);

    // Reset handled ref when itemParam is cleared so future banner clicks work
    useEffect(() => {
        if (!itemParam) {
            handledBannerItemRef.current = null;
        }
    }, [itemParam]);

    // Clean up modal and banner URL state if user navigates away from menu tab
    useEffect(() => {
        if (!isVisible) {
            setSelectedItemForDetail(null);
            clearBannerParam();
        }
    }, [isVisible, clearBannerParam]);

    // Reactively open exact menu item detail view directly when redirected from a banner (ONCE per banner navigation)
    useEffect(() => {
        if (!isVisible || !itemParam) return;
        if (handledBannerItemRef.current === String(itemParam)) return;

        const searchPool = [...allMenuItems, ...specials, ...combos, ...menuItems];
        if (searchPool.length === 0) return;

        const found = searchPool.find(i => 
            String(i.id) === String(itemParam) || 
            i.name?.toLowerCase() === String(itemParam).toLowerCase()
        );
        if (found) {
            handledBannerItemRef.current = String(itemParam);
            if ((found as any).isCombo || (found as any).item_type === 'combo') {
                setActiveCategory('COMBOS');
            } else if ((found as any).isSpecial || (found as any).is_today_special) {
                setActiveCategory('SPECIALS');
            } else if (found.category_id) {
                setActiveCategory(found.category_id);
            }
            if ((found as any).isCombo || (found as any).item_type === 'combo') {
                setSelectedComboForDetail(found);
            } else if ((found as any).isSpecial || (found as any).is_today_special) {
                setSelectedSpecialForDetail(found);
            } else {
                setSelectedItemForDetail(found);
            }
            clearBannerParam();
        } else if (!loading) {
            handledBannerItemRef.current = String(itemParam);
            clearBannerParam();
            toast.error('The selected menu item is no longer available');
        }
    }, [isVisible, itemParam, allMenuItems, specials, combos, menuItems, loading, clearBannerParam]);

    useEffect(() => {
        if (activeCategory === null) {
            setSubCategories([]);
            setMenuItems(allMenuItems);
            return;
        }

        setItemsLoading(true);
        if (activeCategory === 'SPECIALS') {
            setSubCategories([]);
            setMenuItems(specials);
            setActiveSubCategory('ALL');
            setItemsLoading(false);
        } else if (activeCategory === 'COMBOS') {
            setSubCategories([]);
            setMenuItems(combos);
            setActiveSubCategory('ALL');
            setItemsLoading(false);
        } else {
            const filteredSubs = allSubCategories.filter(sc => String(sc.category_id) === String(activeCategory));
            setSubCategories(filteredSubs);
            const filteredItems = allMenuItems.filter(mi => String(mi.category_id) === String(activeCategory));
            setMenuItems(filteredItems);
            setActiveSubCategory('ALL');
            setItemsLoading(false);
        }
    }, [activeCategory, allSubCategories, allMenuItems, specials, combos]);

    // Handle scroll persistence within dishes container
    useEffect(() => {
        if (isVisible && dishesContainerRef.current) {
            dishesContainerRef.current.scrollTop = dishesScrollPos.current;
        }
    }, [isVisible]);

    const handleDishesScroll = () => {
        if (dishesContainerRef.current) {
            dishesScrollPos.current = dishesContainerRef.current.scrollTop;
        }
    };

    const handleCategoryClick = (catId: number | string) => {
        clearBannerParam();
        setSelectedItemForDetail(null);
        setSelectedSpecialForDetail(null);
        setSelectedComboForDetail(null);
        setActiveCategory(catId);
        setActiveSubCategory('ALL');
        dishesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubCategoryClick = (subId: number | 'ALL') => {
        clearBannerParam();
        setSelectedItemForDetail(null);
        setSelectedSpecialForDetail(null);
        setSelectedComboForDetail(null);
        setActiveSubCategory(subId);
        dishesContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleAdd = (item: any, e?: React.MouseEvent) => {
        e?.stopPropagation();
        const isCombo = Boolean(
            item.isCombo || 
            item.is_combo || 
            item.item_type?.toLowerCase() === 'combo' || 
            item.special_type === 'combo' || 
            activeCategory === 'COMBOS'
        );
        const hasItems = (Array.isArray(item.items) && item.items.length > 0) || 
                         (Array.isArray(item.combo_items) && item.combo_items.length > 0) ||
                         (Array.isArray(item.specialItemsData) && item.specialItemsData.length > 0);
        const isSpecial = Boolean(item.isSpecial || activeCategory === 'SPECIALS' || item.special_type === 'special' || (item as any).is_today_special || hasItems);
        
        if (isCombo || isSpecial) {
            addSpecialToCart(item);
            toast.success(`${item.name || item.title || (isCombo ? 'Combo' : 'Special')} added to cart`);
        } else {
            addToCart(item, 1);
            toast.success(`${item.name || item.title || 'Item'} added to cart`);
        }
    };

    const filteredItems = (searchTerm.trim() ? allMenuItems : menuItems).filter(item => {
        const hasSearch = searchTerm.trim().length > 0;
        const matchesSub = hasSearch || activeSubCategory === 'ALL' || item.sub_category_id === activeSubCategory;
        const matchesType = activeTypeFilter === 'ALL' || item.item_type === activeTypeFilter;
        const matchesVeg = !isVegMode || item.item_type === 'Veg' || item.is_veg === true;
        const matchesSearch = !hasSearch || item.name.toLowerCase().includes(searchTerm.toLowerCase()) || (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchesSub && matchesType && matchesVeg && matchesSearch;
    });

    const getItemQtyInCart = (itemId: number | string) => {
        if (!itemId && itemId !== 0) return 0;
        if (cartContext?.getItemQtyInCart) {
            return cartContext.getItemQtyInCart(itemId);
        }
        const cart = cartContext?.cart || {};
        const key = String(itemId);
        if (cart[key]) return cart[key].quantity;
        if (cart[`special-${key}`]) return cart[`special-${key}`].quantity;
        if (cart[`combo-${key}`]) return cart[`combo-${key}`].quantity;
        const clean = key.replace(/^(special|combo)-/, '');
        if (cart[`special-${clean}`]) return cart[`special-${clean}`].quantity;
        if (cart[`combo-${clean}`]) return cart[`combo-${clean}`].quantity;
        if (cart[clean]) return cart[clean].quantity;
        return 0;
    };

    const formattedTable = (tableDisplayName || tableNumber || '').toLowerCase().startsWith('table')
        ? (tableDisplayName || tableNumber || '')
        : 'Table ' + (tableDisplayName || tableNumber || '');

    const currentCategoryName = activeCategory === 'SPECIALS'
        ? "Today's Specials"
        : categories.find(c => String(c.id) === String(activeCategory))?.name || 'All Dishes';

    if (tableNotFound) {
        return (
            <div style={{ display: isVisible ? 'flex' : 'none' }} className="w-full h-full flex-col items-center justify-center p-6 text-center bg-slate-50">
                <div className="w-20 h-20 bg-rose-50 border border-rose-100 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-rose-500/10">
                    <LucideUtensils className="text-rose-500" size={36} />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-bold uppercase tracking-wider mb-4">
                    <LucideAlertCircle size={14} />
                    <span>Table Not Found</span>
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                    No table named &ldquo;{tableNumber}&rdquo; in this restaurant
                </h2>
                <p className="text-slate-500 text-sm mb-8 leading-relaxed max-w-xs">
                    Table <span className="font-bold text-slate-800">{tableNumber}</span> does not exist or has not been created by the restaurant admin. Customers can only view the menu and place orders from valid, admin-created tables.
                </p>
                <button 
                    onClick={() => loadData(true)}
                    className="py-3.5 px-8 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-slate-900/20 text-sm cursor-pointer"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div style={{ display: isVisible ? 'block' : 'none' }}>
                <SharedSkeleton type="menu" />
            </div>
        );
    }

    return (
        <div 
            style={{ display: isVisible ? 'flex' : 'none', backgroundColor: '#EEF2F6' }} 
            className="w-full h-full flex flex-col min-h-0 overflow-hidden font-sans select-none"
        >
            {/* Top Fixed Header: Brand, Table, Veg Toggle, Search */}
            <header 
                className="shrink-0 z-20"
                style={{
                    backgroundColor: '#EEF2F6',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.8)',
                    boxShadow: '0 2px 8px rgba(166, 180, 200, 0.15)'
                }}
            >
                {/* Row 1: Brand Info & Right-Aligned Controls */}
                <div 
                    className="px-3.5 sm:px-4 py-2 flex items-center justify-between gap-2"
                    style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.7)' }}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div 
                            className="size-8 sm:size-9 rounded-xl overflow-hidden flex items-center justify-center shrink-0 p-1"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                border: '1px solid rgba(255, 255, 255, 0.8)'
                            }}
                        >
                            {profile?.logo_url || profile?.logo ? (
                                <img 
                                    src={profile.logo_url || profile.logo} 
                                    alt={profile.name || 'Restaurant'} 
                                    className="w-full h-full object-contain" 
                                />
                            ) : (
                                <LucideUtensils className="text-orange-500 size-4" />
                            )}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h1 className="text-xs sm:text-sm font-black text-slate-800 leading-tight truncate">
                                {profile?.name || 'Restaurant Menu'}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Table Badge - Right Aligned */}
                        <div 
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-emerald-800 text-[11px] font-black"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                border: '1px solid rgba(255, 255, 255, 0.8)'
                            }}
                        >
                            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="whitespace-nowrap">{formattedTable}</span>
                        </div>
                    </div>
                </div>

                {/* Row 2: Search Bar & Diet Segmented Filter */}
                <div className="px-3.5 sm:px-4 py-2 flex items-center gap-2">
                    <div className="relative flex-1">
                        <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search dishes or items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full rounded-xl py-2 sm:py-1.5 pl-8 pr-7 text-base sm:text-xs font-semibold text-slate-800 placeholder-slate-400 transition-all focus:outline-none"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: 'inset 2px 2px 5px rgba(166, 180, 200, 0.38), inset -2px -2px 5px rgba(255, 255, 255, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.8)'
                            }}
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <LucideX size={13} />
                            </button>
                        )}
                    </div>

                    {/* Segmented Filter: All, Veg, Non-Veg */}
                    <div 
                        className="flex items-center gap-1 p-1 rounded-xl shrink-0"
                        style={{
                            backgroundColor: '#EEF2F6',
                            boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.35), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.7)'
                        }}
                    >
                        {(['ALL', 'Veg', 'Non-Veg'] as const).map((type) => {
                            const isActive = isVegMode ? type === 'Veg' : activeTypeFilter === type;
                            const isForcedDisabled = isVegMode && type === 'Non-Veg';

                            const activeBg = 
                                type === 'Veg'
                                    ? 'bg-green-600 text-white shadow-md shadow-green-600/30'
                                    : type === 'Non-Veg'
                                        ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
                                        : 'bg-black text-white shadow-md shadow-black/30';

                            return (
                                <button
                                    key={type}
                                    disabled={isForcedDisabled}
                                    onClick={() => {
                                        if (isVegMode && type !== 'Veg') setIsVegMode(false);
                                        if (!isForcedDisabled) setActiveTypeFilter(type);
                                    }}
                                    className={`relative px-2.5 sm:px-3 py-1 sm:py-1.2 rounded-lg text-[11px] sm:text-xs font-black transition-all duration-200 cursor-pointer ${
                                        isActive 
                                            ? activeBg
                                            : isForcedDisabled 
                                                ? 'text-slate-300 cursor-not-allowed'
                                                : 'text-slate-600 hover:text-slate-900 active:scale-95'
                                    }`}
                                    style={isActive ? {
                                        border: '1px solid rgba(255, 255, 255, 0.25)',
                                    } : {}}
                                >
                                    <span className="flex items-center gap-1.5">
                                        {type === 'Veg' && (
                                            <span className={`size-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-green-600'}`} />
                                        )}
                                        {type === 'Non-Veg' && (
                                            <span className={`size-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-red-600'}`} />
                                        )}
                                        <span>{type === 'ALL' ? 'All' : type}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </header>

            {/* Two-Column Master-Detail Layout */}
            <div className="flex-1 flex overflow-hidden min-h-0 relative">
                {/* Left Column: Category Sidebar (Completely independent scrolling, rock solid) */}
                <aside 
                    className="w-[92px] sm:w-28 shrink-0 h-full overflow-y-auto no-scrollbar py-3 px-2 sm:px-2.5 space-y-3 pb-36"
                    style={{
                        backgroundColor: '#EEF2F6',
                        borderRight: '1px solid rgba(255, 255, 255, 0.8)'
                    }}
                >
                    {/* Specials Category Button */}
                    {specials.length > 0 && (() => {
                        const isSpecialsActive = activeCategory === 'SPECIALS' || String(activeCategory).toUpperCase() === 'SPECIALS';
                        const specialsCategoryImage = profile?.specials_category_image || specials.find((s: any) => Boolean(s.image_url))?.image_url || '/menu/chicken-tikka.jpeg';
                        return (
                            <button
                                onClick={() => handleCategoryClick('SPECIALS')}
                                className="w-full relative rounded-2xl py-2 px-1 transition-all duration-200 cursor-pointer flex flex-col items-center gap-1.5 active:scale-95 group"
                            >
                                {/* Smooth Travel Animated Left Edge Indicator (Non-Overlaying) */}
                                {isSpecialsActive && (
                                    <motion.div
                                        layoutId="activeSidebarCategoryPill"
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-r-full bg-gradient-to-b from-orange-500 to-orange-600 shadow-[0_0_8px_rgba(255,107,53,0.6)] z-20"
                                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                    />
                                )}

                                <div className="flex flex-col items-center gap-1.5 w-full">
                                    <div
                                        className={`size-14 sm:size-16 rounded-xl overflow-hidden flex items-center justify-center transition-all ${
                                            isSpecialsActive
                                                ? 'ring-[2.5px] ring-orange-500 ring-offset-2 shadow-md scale-105'
                                                : 'bg-white shadow-xs border border-neutral-100 group-hover:shadow-md group-hover:scale-102'
                                        }`}
                                    >
                                        {specialsCategoryImage ? (
                                            <img
                                                src={specialsCategoryImage}
                                                alt="Specials"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <LucideFlame 
                                                className={isSpecialsActive ? 'text-orange-600' : 'text-amber-500'} 
                                                size={26} 
                                            />
                                        )}
                                    </div>
                                    <span className={`text-xs sm:text-[13px] text-center leading-tight transition-colors duration-200 ${
                                        isSpecialsActive
                                            ? 'text-orange-600 font-black'
                                            : 'text-amber-900 font-bold'
                                    }`}>
                                        Specials
                                    </span>
                                </div>
                            </button>
                        );
                    })()}

                    {/* Combos Category Button */}
                    {combos.length > 0 && (() => {
                        const isCombosActive = activeCategory === 'COMBOS' || String(activeCategory).toUpperCase() === 'COMBOS';
                        const combosCategoryImage = profile?.combo_category_image || combos.find((c: any) => Boolean(c.image_url))?.image_url || '/menu/tandoori-chicken.jpeg';
                        return (
                            <button
                                onClick={() => handleCategoryClick('COMBOS')}
                                className="w-full relative rounded-2xl py-2 px-1 transition-all duration-200 cursor-pointer flex flex-col items-center gap-1.5 active:scale-95 group"
                            >
                                {/* Smooth Travel Animated Left Edge Indicator (Non-Overlaying) */}
                                {isCombosActive && (
                                    <motion.div
                                        layoutId="activeSidebarCategoryPill"
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-r-full bg-gradient-to-b from-orange-500 to-orange-600 shadow-[0_0_8px_rgba(255,107,53,0.6)] z-20"
                                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                    />
                                )}

                                <div className="flex flex-col items-center gap-1.5 w-full">
                                    <div
                                        className={`size-14 sm:size-16 rounded-xl overflow-hidden flex items-center justify-center transition-all ${
                                            isCombosActive
                                                ? 'ring-[2.5px] ring-orange-500 ring-offset-2 shadow-md scale-105'
                                                : 'bg-white shadow-xs border border-neutral-100 group-hover:shadow-md group-hover:scale-102'
                                        }`}
                                    >
                                        {combosCategoryImage ? (
                                            <img
                                                src={combosCategoryImage}
                                                alt="Combos"
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <LucideShoppingBag 
                                                className={isCombosActive ? 'text-orange-600' : 'text-orange-500'} 
                                                size={26} 
                                            />
                                        )}
                                    </div>
                                    <span className={`text-xs sm:text-[13px] text-center leading-tight transition-colors duration-200 ${
                                        isCombosActive
                                            ? 'text-orange-600 font-black'
                                            : 'text-amber-900 font-bold'
                                    }`}>
                                        Combos
                                    </span>
                                </div>
                            </button>
                        );
                    })()}

                    {/* Regular Categories */}
                    {categories.map((cat) => {
                        const isCatActive = activeCategory !== null && String(activeCategory) === String(cat.id);
                        return (
                            <button
                                key={cat.id}
                                onClick={() => handleCategoryClick(cat.id)}
                                className="w-full relative rounded-2xl py-2 px-1 transition-all duration-200 cursor-pointer flex flex-col items-center gap-1.5 active:scale-95 group"
                            >
                                {/* Smooth Travel Animated Left Edge Indicator (Non-Overlaying) */}
                                {isCatActive && (
                                    <motion.div
                                        layoutId="activeSidebarCategoryPill"
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-r-full bg-gradient-to-b from-orange-500 to-orange-600 shadow-[0_0_8px_rgba(255,107,53,0.6)] z-20"
                                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                    />
                                )}

                                <div className="flex flex-col items-center gap-1.5 w-full">
                                    <div 
                                        className={`size-14 sm:size-16 rounded-xl overflow-hidden transition-all ${
                                            isCatActive
                                                ? 'ring-[2.5px] ring-orange-500 ring-offset-2 shadow-md scale-105'
                                                : 'bg-white shadow-xs border border-neutral-100 group-hover:shadow-md group-hover:scale-102'
                                        }`}
                                    >
                                        <img
                                            src={cat.image_url || getCategoryMenuItemImage(cat.name)}
                                            alt={cat.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <span className={`text-xs sm:text-[13px] text-center leading-tight line-clamp-2 px-0.5 transition-colors duration-200 ${
                                        isCatActive ? 'text-orange-600 font-black' : 'text-slate-700 font-extrabold'
                                    }`}>
                                        {cat.name}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </aside>

                {/* Right Column: Dishes Feed */}
                <main 
                    ref={dishesContainerRef}
                    onScroll={handleDishesScroll}
                    className="flex-1 h-full min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3 pb-36 no-scrollbar scroll-smooth"
                >
                    {/* Section Header Title inside dishes feed */}
                    <div 
                        className="flex items-center justify-between pb-2"
                        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.8)' }}
                    >
                        <div>
                            <h2 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                                {activeCategory === 'SPECIALS' && <LucideFlame size={15} className="text-amber-500" />}
                                {activeCategory === 'COMBOS' && <LucideShoppingBag size={15} className="text-orange-500" />}
                                <span>{currentCategoryName}</span>
                            </h2>
                            <p className="text-[10px] font-semibold text-slate-500">
                                {filteredItems.length} {filteredItems.length === 1 ? 'dish available' : 'dishes available'}
                            </p>
                        </div>
                    </div>

                    {loading || itemsLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div 
                                    key={i} 
                                    className="h-24 rounded-2xl animate-pulse" 
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.35), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                                        border: '1px solid rgba(255, 255, 255, 0.85)'
                                    }}
                                />
                            ))}
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div 
                            className="text-center py-16 px-4 rounded-2xl space-y-2"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: 'inset 2px 2px 5px rgba(166, 180, 200, 0.35), inset -2px -2px 5px rgba(255, 255, 255, 0.9)',
                                border: '1px solid rgba(255, 255, 255, 0.8)'
                            }}
                        >
                            <p className="text-xs font-bold text-slate-700">No dishes found matching your criteria.</p>
                            <p className="text-[11px] text-slate-500">Try changing the search keyword or dietary filter.</p>
                            {(searchTerm || activeTypeFilter !== 'ALL' || isVegMode) && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setActiveTypeFilter('ALL');
                                        setIsVegMode(false);
                                    }}
                                    className="mt-2 text-xs font-bold text-orange-600 underline cursor-pointer"
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>
                    ) : (
                        filteredItems.map((item) => {
                            const isTodaySpecial = Boolean((item as any).is_today_special);
                            const isSpecial = Boolean((item as any).isSpecial || activeCategory === 'SPECIALS' || isTodaySpecial);
                            const isCmb = Boolean((item as any).isCombo || (item as any).is_combo || (item as any).item_type === 'combo' || (item as any).item_type === 'Combo' || activeCategory === 'COMBOS');
                            const hasSpecialPrice = item.special_price !== undefined && item.special_price !== null && Number(item.special_price) > 0;
                            const currentPrice = hasSpecialPrice ? Number(item.special_price) : Number(item.price ?? 0);
                            const originalPrice = Number(item.price ?? 0);
                            const savings = hasSpecialPrice && originalPrice > currentPrice ? originalPrice - currentPrice : 0;
                            
                            const itemCartKey = (isCmb || isSpecial) ? `special-${item.id}` : String(item.id);
                            const cartQty = getItemQtyInCart(itemCartKey) || getItemQtyInCart(item.id);
                            const comboItems = (item as any).items || (item as any).combo_items;

                            return (
                                <div 
                                    key={item.id}
                                    onClick={() => {
                                        clearBannerParam();
                                        if (isCmb) {
                                            setSelectedComboForDetail(item);
                                        } else if (isSpecial) {
                                            setSelectedSpecialForDetail(item);
                                        } else {
                                            setSelectedItemForDetail(item);
                                        }
                                    }}
                                    className="rounded-2xl p-3 transition-all flex gap-3 cursor-pointer group active:scale-[0.99] relative"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.38), -4px -4px 10px rgba(255, 255, 255, 0.95)',
                                        border: '1px solid rgba(255, 255, 255, 0.85)'
                                    }}
                                >
                                    {/* Left Thumbnail */}
                                    <div 
                                        className="size-20 sm:size-24 rounded-xl overflow-hidden shrink-0 relative p-1"
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: 'inset 2px 2px 4px rgba(166, 180, 200, 0.3), inset -2px -2px 4px rgba(255, 255, 255, 0.9)',
                                            border: '1px solid rgba(255, 255, 255, 0.8)'
                                        }}
                                    >
                                        <img 
                                            src={item.image_url || getCategoryMenuItemImage(item.name)} 
                                            alt={item.name} 
                                            className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-300" 
                                        />
                                        {isCmb ? (
                                            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-orange-600 text-white text-[8px] font-black uppercase tracking-wider shadow-xs">
                                                Combo
                                            </span>
                                        ) : isSpecial ? (
                                            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider shadow-xs">
                                                Special
                                            </span>
                                        ) : null}
                                    </div>

                                    {/* Right Details */}
                                    <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                                        <div>
                                            <div className="flex items-start justify-between gap-1.5">
                                                <h3 className="font-black text-slate-800 text-xs sm:text-sm leading-snug line-clamp-1 group-hover:text-orange-600 transition-colors">
                                                    {item.name}
                                                </h3>

                                                {/* Veg / Non-Veg Indicator */}
                                                <VegNonVegBadge
                                                    type={item.item_type}
                                                    isVeg={item.is_veg}
                                                    name={item.name}
                                                    size="xs"
                                                    showLabel={false}
                                                    className="mt-0.5"
                                                />
                                            </div>

                                            {item.description && (
                                                <p className="text-[11px] font-medium text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                                                    {item.description}
                                                </p>
                                            )}

                                            {/* If Bundle/Combo with items */}
                                            {comboItems && comboItems.length > 0 && (
                                                <p className="text-[10px] font-bold text-amber-600 mt-1 flex items-center gap-1">
                                                    <LucideSparkles size={11} />
                                                    <span>Includes {comboItems.length} items • View details ▾</span>
                                                </p>
                                            )}
                                        </div>

                                        {/* Bottom Row: Price & Quantity Control */}
                                        <div 
                                            className="flex items-end justify-between mt-2 pt-1"
                                            style={{ borderTop: '1px solid rgba(255, 255, 255, 0.8)' }}
                                        >
                                            <div className="flex flex-col">
                                                <div className="flex items-baseline gap-1.5">
                                                    <span className="font-black text-slate-900 text-sm sm:text-base">
                                                        ₹{currentPrice}
                                                    </span>
                                                    {savings > 0 && (
                                                        <span className="text-xs text-slate-400 line-through">
                                                            ₹{originalPrice}
                                                        </span>
                                                    )}
                                                </div>
                                                {savings > 0 && (
                                                    <span 
                                                        className="text-[9px] font-black text-emerald-800 px-1.5 py-0.2 rounded w-fit mt-0.5"
                                                        style={{
                                                            backgroundColor: '#EEF2F6',
                                                            boxShadow: 'inset 1px 1px 2px rgba(166, 180, 200, 0.3), inset -1px -1px 2px rgba(255, 255, 255, 0.9)',
                                                            border: '1px solid rgba(16, 185, 129, 0.4)'
                                                        }}
                                                    >
                                                        Save ₹{savings}
                                                    </span>
                                                )}
                                            </div>

                                            <div onClick={(e) => e.stopPropagation()}>
                                                <SharedQuantityControl
                                                    qty={cartQty}
                                                    onAdd={() => handleAdd(item)}
                                                    onUpdateQuantity={(delta) => updateQuantity(itemCartKey, delta)}
                                                    buttonStyle="text"
                                                    colorHex="#ea580c"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </main>
            </div>

            {/* Standardized Luxury Item Detail Modal */}
            <SharedItemDetailModal
                item={selectedItemForDetail}
                isOpen={Boolean(selectedItemForDetail)}
                onClose={() => {
                    setSelectedItemForDetail(null);
                    clearBannerParam();
                }}
                onAddToCart={(item) => handleAdd(item)}
                onUpdateQuantity={(itemId, delta) => updateQuantity(itemId, delta)}
                cartQuantity={selectedItemForDetail ? getItemQtyInCart(selectedItemForDetail.id) : 0}
                currencySymbol="₹"
                colorHex="#ea580c"
            />

            <SharedSpecialDetailModal
                special={selectedSpecialForDetail}
                isOpen={Boolean(selectedSpecialForDetail)}
                onClose={() => {
                    setSelectedSpecialForDetail(null);
                    clearBannerParam();
                }}
                onAddToCart={(item) => handleAdd(item)}
                onUpdateQuantity={(itemId, delta) => updateQuantity(itemId, delta)}
                quantity={selectedSpecialForDetail ? (getItemQtyInCart(`special-${selectedSpecialForDetail.id}`) || getItemQtyInCart(selectedSpecialForDetail.id)) : 0}
                currencySymbol="₹"
                colorHex="#ea580c"
            />

            <SharedComboDetailModal
                combo={selectedComboForDetail}
                isOpen={Boolean(selectedComboForDetail)}
                onClose={() => {
                    setSelectedComboForDetail(null);
                    clearBannerParam();
                }}
                onAddToCart={(item) => handleAdd(item)}
                onUpdateQuantity={(itemId, delta) => updateQuantity(itemId, delta)}
                quantity={selectedComboForDetail ? (getItemQtyInCart(`special-${selectedComboForDetail.id}`) || getItemQtyInCart(selectedComboForDetail.id)) : 0}
                currencySymbol="₹"
                colorHex="#ea580c"
            />
        </div>
    );
}
