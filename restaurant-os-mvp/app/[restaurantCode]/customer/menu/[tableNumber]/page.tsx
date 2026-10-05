'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getCategoryMenuItemImage } from '@/lib/utils';
import { MenuService, Category, SubCategory, MenuItem } from '@/services/menu.service';
import { OrderService } from '@/services/orders.service';
import { useCart, isSpecialActive, getActivePrice } from '@/context/CartContext';
import { LayoutGrid as LucideLayoutGrid, Utensils as LucideUtensils, Coffee as LucideCoffee, IceCream as LucideIceCream, GlassWater as LucideGlassWater, Search as LucideSearch, ShoppingBag as LucideShoppingBag, Flame as LucideFlame, Sparkles as LucideSparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SpecialsService, TodaySpecial } from '@/services/specials.service';
import { SharedSkeleton } from '@/components/customer/SharedSkeleton';
import SharedQuantityControl from '@/components/shared/SharedQuantityControl';
import { MainHeader } from '@/components/shared/MainHeader';
import { HomepageBuilderService } from '@/services/homepage-builder.service';

export default function CustomerMenu() {
    const params = useParams();
    const router = useRouter();
    const urlTableNumber = typeof params.tableNumber === 'string' ? params.tableNumber : '';
    const urlRestaurantId = typeof params.restaurantCode === 'string' ? params.restaurantCode : typeof params.restaurantId === 'string' ? params.restaurantId : '';
    const { addToCart, addSpecialToCart, cart, updateQuantity, removeFromCart, totalItems, subtotal, setTableNumber } = useCart();
    const searchParams = useSearchParams();
    const categoryParam = searchParams.get('category');
    const itemParam = searchParams.get('item');

    const [categories, setCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [activeCategory, setActiveCategory] = useState<number | string | null>('ALL');
    const [specials, setSpecials] = useState<TodaySpecial[]>([]);
    const [todaySpecials, setTodaySpecials] = useState<MenuItem[]>([]);
    const [comboOffers, setComboOffers] = useState<TodaySpecial[]>([]);
    const [activeSubCategory, setActiveSubCategory] = useState<number | 'ALL'>('ALL');

    const [activeTypeFilter, setActiveTypeFilter] = useState<'ALL' | 'Veg' | 'Non-Veg'>('ALL');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isVegMode, setIsVegMode] = useState(false); // Global Veg Mode
    const [tableDisplayName, setTableDisplayName] = useState(urlTableNumber);
    const [tableNotFound, setTableNotFound] = useState(false);
    const [profile, setProfile] = useState<any>(null);
    const [sectionStyles, setSectionStyles] = useState<any>(null);

    useEffect(() => {
        if (urlTableNumber) {
            setTableNumber(urlTableNumber);
        }
    }, [urlTableNumber, setTableNumber]);

    const loadData = useCallback(async (showLoading = true) => {
        if (showLoading) setLoading(true);
        try {
            const [publicMenuRes, tableInfo] = await Promise.all([
                fetch(`/api/public/${encodeURIComponent(urlRestaurantId)}/menu`).then(r => r.json()).catch(err => {
                    console.warn('Public menu endpoint fallback:', err);
                    return null;
                }),
                urlTableNumber ? OrderService.verifyTableExists(urlRestaurantId, urlTableNumber) : Promise.resolve(null)
            ]);

            let cats: any[] = [];
            let items: any[] = [];
            let specialsData: any[] = [];
            let profileData: any = null;
            let stylesData: any = null;

            if (publicMenuRes && publicMenuRes.success) {
                cats = publicMenuRes.categories || [];
                items = publicMenuRes.menu_items || [];
                specialsData = publicMenuRes.specials || [];
                profileData = publicMenuRes.profile || null;
                stylesData = publicMenuRes.section_styles || null;
            } else {
                // Resilient fallback to individual services if API is temporarily unavailable
                const [c, i, s, p, st] = await Promise.all([
                    MenuService.fetchCategories(urlRestaurantId),
                    MenuService.fetchMenuItems(urlRestaurantId),
                    SpecialsService.fetchActiveSpecials(urlRestaurantId),
                    HomepageBuilderService.getProfile(urlRestaurantId),
                    HomepageBuilderService.getSectionStyles(urlRestaurantId)
                ]);
                cats = c;
                items = i;
                specialsData = s;
                profileData = p;
                stylesData = st;
            }
            
            if (tableInfo) {
                // Check if the table belongs to this restaurant
                if (tableInfo.restaurant_id !== urlRestaurantId) {
                    setTableNotFound(true);
                } else {
                    const newName = tableInfo.display_name || tableInfo.table_number || urlTableNumber;
                    setTableDisplayName(newName);
                }
            } else if (urlTableNumber) {
                setTableNotFound(true);
            }

            const uniqueCats = (cats || []).filter((cat: any, index: number, self: any[]) =>
                index === self.findIndex((c: any) => c.name === cat.name)
            );
            setCategories(uniqueCats);
            setMenuItems(items);
            setSpecials(specialsData);
            const activeTodaySpecials = items.filter((item: any) => isSpecialActive(item));
            setTodaySpecials(activeTodaySpecials);
            setComboOffers(specialsData.filter(s => s.special_type === 'combo' || s.is_combo));
            setProfile(profileData);
            setSectionStyles(stylesData);
            if (categoryParam) {
                const parsedCat = isNaN(Number(categoryParam)) ? categoryParam : Number(categoryParam);
                setActiveCategory(parsedCat);
            } else {
                setActiveCategory('ALL');
            }
        } catch (error) {
            console.error('Failed to load menu:', error);
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [urlRestaurantId, urlTableNumber, categoryParam, itemParam]);

    useEffect(() => {
        loadData(true);
    }, [loadData]);

    useEffect(() => {
        let active = true;
        let profileSub: any;

        const setupSubs = async () => {
            const sub = await HomepageBuilderService.subscribeToProfile(urlRestaurantId, () => {
                if (active) loadData(false);
            });
            if (!active) {
                sub?.unsubscribe();
            } else {
                profileSub = sub;
            }
        };

        setupSubs();

        return () => {
            active = false;
            if (profileSub?.unsubscribe) {
                profileSub.unsubscribe();
            }
        };
    }, [urlRestaurantId, loadData]);

    useEffect(() => {
        // Subscribe to real-time menu changes (images, prices, availability)
        const sub = OrderService.subscribeToMenuItems(urlRestaurantId, () => loadData(false));

        return () => {
            sub.unsubscribe();
        };
    }, []);

    useEffect(() => {
        const loadSubCategories = async () => {
            const isVirtual = activeCategory === 'ALL' || activeCategory === 'TODAY_SPECIALS' || activeCategory === 'COMBO_OFFERS';
            if (!activeCategory || isVirtual) {
                if (activeCategory === 'TODAY_SPECIALS' || activeCategory === 'COMBO_OFFERS' || activeCategory === 'ALL') {
                    setTimeout(() => {
                        const el = document.getElementById(`cat-btn-${activeCategory}`);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }, 100);
                }
                setSubCategories([]);
                return;
            }
            try {
                // Scroll into view
                setTimeout(() => {
                    const el = document.getElementById(`cat-btn-${activeCategory}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }, 100);

                const subs = await MenuService.fetchSubCategories(Number(activeCategory), urlRestaurantId);
                setSubCategories(subs);
                setActiveSubCategory('ALL'); // Reset subcategory when category changes
            } catch (err) {
                console.error('Failed to load subcategories', err);
            }
        };
        loadSubCategories();
    }, [activeCategory]);

    const getItemQtyInCart = (id: number | string) => cart[String(id)]?.quantity || 0;

    const filteredItems = menuItems.filter(item => {
        const hasSearch = searchTerm.trim().length > 0;
        const matchesCategory = hasSearch
            || activeCategory === 'ALL'
            || (activeCategory === 'TODAY_SPECIALS' && isSpecialActive(item))
            || (activeCategory ? String(item.category_id) === String(activeCategory) : true);
        const matchesSubCategory = hasSearch || activeSubCategory === 'ALL' || String(item.sub_category_id) === String(activeSubCategory);
        const matchesSearch = !hasSearch || item.name.toLowerCase().includes(searchTerm.toLowerCase()) || (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));

        // Type filter: Veg mode overrides, otherwise use activeTypeFilter
        const fallbackType = item.item_type || (item.is_veg ? 'Veg' : 'Non-Veg');
        const effectiveFilter = isVegMode ? 'Veg' : activeTypeFilter;
        const typeMatch = effectiveFilter === 'ALL'
            || fallbackType === effectiveFilter
            || (effectiveFilter === 'Non-Veg' && fallbackType === 'Egg');

        return matchesCategory && matchesSubCategory && matchesSearch && item.is_available && item.active !== false && typeMatch;
    });

    const getCategoryIcon = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('drink') || n.includes('beverage')) return <LucideGlassWater size={20} />;
        if (n.includes('desert') || n.includes('sweet') || n.includes('ice')) return <LucideIceCream size={20} />;
        if (n.includes('tea') || n.includes('coffee')) return <LucideCoffee size={20} />;
        return <LucideUtensils size={20} />;
    };

    const handleCallWaiter = async () => {
        if (!urlTableNumber) return;
        try {
            await OrderService.setTableAlert(
                urlTableNumber, 
                'call_waiter', 
                urlRestaurantId
            );
            // Optimistic UI or Toast
            alert('Waiter has been notified!');
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) {
        return <SharedSkeleton type="menu" />;
    }

    if (tableNotFound) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-white p-6 text-center">
                <div className="bg-red-50 p-6 rounded-3xl mb-6">
                    <LucideUtensils className="text-red-500 mx-auto" size={48} />
                </div>
                <h2 className="text-2xl font-black text-black mb-2">No table named &ldquo;{urlTableNumber}&rdquo; in this restaurant</h2>
                <p className="text-black mb-8 max-w-xs">Table &ldquo;{urlTableNumber}&rdquo; does not exist or has not been created by the restaurant admin. Customers can only view the menu and place orders from valid, admin-created tables.</p>
                <button 
                    onClick={() => loadData(true)}
                    className="px-8 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all active:scale-95"
                >
                    Try Again
                </button>
            </div>
        );
    }


    const comboCategoryImage = profile?.combo_category_image || comboOffers.find((c: any) => Boolean(c.image_url))?.image_url || specials.find((s: any) => (s.is_combo || s.special_type === 'combo') && Boolean(s.image_url))?.image_url || '/menu/tandoori-chicken.jpeg';
    const specialsCategoryImage = profile?.specials_category_image || todaySpecials.find((s: any) => Boolean(s.image_url))?.image_url || specials.find((s: any) => !s.is_combo && s.special_type !== 'combo' && Boolean(s.image_url))?.image_url || '/menu/chicken-tikka.jpeg';

    // Search input
    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar Categories */}
            <aside className="w-24 sm:w-28 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-4 overflow-y-auto no-scrollbar z-10 shadow-[2px_0_20px_rgba(0,0,0,0.02)] pt-safe-top">

                <div className="flex flex-col gap-3 w-full items-center pb-24">
                    {/* Combos and Offers Category */}
                    <button
                        onClick={() => setActiveCategory('COMBOS_OFFERS')}
                        id="cat-btn-COMBOS_OFFERS"
                        className="relative w-full flex flex-col items-center py-2 px-1 group"
                    >
                        {activeCategory === 'COMBOS_OFFERS' && (
                            <motion.div
                                layoutId="activeSidebarIndicator"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-r-full bg-gradient-to-b from-orange-500 to-orange-600 shadow-[0_0_8px_rgba(255,107,53,0.6)] z-20"
                                transition={{ type: "spring", stiffness: 450, damping: 35 }}
                            />
                        )}
                        <div className="flex flex-col items-center gap-1.5 w-full">
                            <div className={`size-16 rounded-xl overflow-hidden flex items-center justify-center transition-all duration-300 ${activeCategory === 'COMBOS_OFFERS' ? 'ring-[2.5px] ring-orange-500 ring-offset-2 shadow-md scale-105' : 'bg-white border border-neutral-100 shadow-xs group-hover:shadow-md group-hover:scale-102'}`}>
                                {comboCategoryImage ? (
                                    <img
                                        src={comboCategoryImage}
                                        alt="Combos & Offers"
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <LucideSparkles size={28} className={activeCategory === 'COMBOS_OFFERS' ? 'text-orange-600' : 'text-orange-500'} />
                                )}
                            </div>
                            <span className={`text-xs text-center leading-tight line-clamp-2 max-w-full transition-colors duration-200 ${activeCategory === 'COMBOS_OFFERS' ? 'text-orange-600 font-black' : 'text-black font-black uppercase'}`}>
                                Combos & Offers
                            </span>
                        </div>
                    </button>
                    {/* Today Special Virtual Category */}
                    {todaySpecials.length > 0 && (
                        <button
                            onClick={() => setActiveCategory('TODAY_SPECIALS')}
                            id="cat-btn-TODAY_SPECIALS"
                            className="relative w-full flex flex-col items-center py-2 px-1 group"
                        >
                            {activeCategory === 'TODAY_SPECIALS' && (
                                <motion.div
                                    layoutId="activeSidebarIndicator"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-r-full bg-gradient-to-b from-orange-500 to-orange-600 shadow-[0_0_8px_rgba(255,107,53,0.6)] z-20"
                                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                />
                            )}
                            <div className="flex flex-col items-center gap-1.5 w-full">
                                <div className={`size-16 rounded-xl overflow-hidden flex items-center justify-center transition-all duration-300 ${activeCategory === 'TODAY_SPECIALS' ? 'ring-[2.5px] ring-orange-500 ring-offset-2 shadow-md scale-105' : 'bg-white border border-neutral-100 shadow-xs group-hover:shadow-md group-hover:scale-102'}`}>
                                    {specialsCategoryImage ? (
                                        <img
                                            src={specialsCategoryImage}
                                            alt="Specials"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <LucideFlame size={28} className={activeCategory === 'TODAY_SPECIALS' ? 'text-orange-600' : 'text-orange-500'} />
                                    )}
                                </div>
                                <span className={`text-xs text-center leading-tight line-clamp-2 max-w-full transition-colors duration-200 ${activeCategory === 'TODAY_SPECIALS' ? 'text-orange-600 font-black' : 'text-black font-black uppercase'}`}>
                                    Specials
                                </span>
                            </div>
                        </button>
                    )}

                    {/* Combo Offers Virtual Category */}
                    {comboOffers.length > 0 && (
                        <button
                            onClick={() => setActiveCategory('COMBO_OFFERS')}
                            id="cat-btn-COMBO_OFFERS"
                            className="relative w-full flex flex-col items-center py-2 px-1 group"
                        >
                            {activeCategory === 'COMBO_OFFERS' && (
                                <motion.div
                                    layoutId="activeSidebarIndicator"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-r-full bg-gradient-to-b from-orange-500 to-orange-600 shadow-[0_0_8px_rgba(255,107,53,0.6)] z-20"
                                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                />
                            )}
                            <div className="flex flex-col items-center gap-1.5 w-full">
                                <div className={`size-16 rounded-xl overflow-hidden flex items-center justify-center transition-all duration-300 ${activeCategory === 'COMBO_OFFERS' ? 'ring-[2.5px] ring-orange-500 ring-offset-2 shadow-md scale-105' : 'bg-white border border-neutral-100 shadow-xs group-hover:shadow-md group-hover:scale-102'}`}>
                                    {comboCategoryImage ? (
                                        <img
                                            src={comboCategoryImage}
                                            alt="Combos"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <LucideShoppingBag size={28} className={activeCategory === 'COMBO_OFFERS' ? 'text-orange-600' : 'text-purple-600'} />
                                    )}
                                </div>
                                <span className={`text-xs text-center leading-tight line-clamp-2 max-w-full transition-colors duration-200 ${activeCategory === 'COMBO_OFFERS' ? 'text-orange-600 font-black' : 'text-black font-black uppercase'}`}>
                                    Combos
                                </span>
                            </div>
                        </button>
                    )}
                    {categories.map(cat => {
                        const isActive = activeCategory === cat.id;

                        // Map category names to images
                        const getCategoryImage = (name: string) => {
                            const n = name.toLowerCase();
                            if (n.includes('soup')) return '/menu/hot-and-sour-soup.jpeg';
                            if (n.includes('veg starter')) return '/menu/paneer-tikka.png';
                            if (n.includes('non-veg starter')) return '/menu/chicken-lollipop.jpeg';
                            if (n.includes('starter')) return '/menu/paneer-tikka.png';
                            if (n.includes('veg curr')) return '/menu/paneer-butter-masala.jpeg'; // Green gravy for contrast
                            if (n.includes('non-veg curr')) return '/menu/mutton-rogan-josh.jpeg'; // Red gravy
                            if (n.includes('biryani')) return '/menu/mutton-biryani.jpeg'; // Prioritize Biryani
                            if (n.includes('ghee rice')) return '/menu/ghee-rice.jpeg';
                            if (n.includes('rice')) return '/menu/jeera-rice.jpeg';
                            if (n.includes('chinese') || n.includes('noodles')) return '/menu/veg-hakka-noodles.jpeg';
                            if (n.includes('bread') || n.includes('roti') || n.includes('naan')) return '/menu/tandoori-roti.jpeg';
                            if (n.includes('dessert') || n.includes('sweet')) return '/menu/rasmalai.jpeg';
                            if (n.includes('drink') || n.includes('beverage')) return '/menu/ice-cream-3-flavours.jpeg';
                            return '/menu/veg-biryani.png'; // Default fallback
                        };

                        return (
                            <button
                                key={cat.id}
                                id={`cat-btn-${cat.id}`}
                                onClick={() => setActiveCategory(cat.id)}
                                className="relative w-full flex flex-col items-center py-2 px-1 group"
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeSidebarIndicator"
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-10 rounded-r-full bg-gradient-to-b from-orange-500 to-orange-600 shadow-[0_0_8px_rgba(255,107,53,0.6)] z-20"
                                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                    />
                                )}

                                <div className="flex flex-col items-center gap-1.5 w-full">
                                    {(() => {
                                        const imagePath = cat.image_url || getCategoryImage(cat.name);
                                        return (
                                            <div className={`size-16 rounded-xl overflow-hidden transition-all duration-300 ${isActive ? 'ring-[2.5px] ring-orange-500 ring-offset-2 shadow-md scale-105' : 'bg-white shadow-xs border border-neutral-100 group-hover:shadow-md group-hover:scale-102'}`}>
                                                <img
                                                    src={imagePath}
                                                    alt={cat.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        );
                                    })()}
                                    <span className={`text-xs text-center leading-tight line-clamp-2 max-w-full transition-colors duration-200 ${isActive ? 'text-orange-600 font-black' : 'text-black font-black uppercase group-hover:text-black'}`}>
                                        {cat.name}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full relative">
                {/* Main Header */}
                <MainHeader
                    profile={profile}
                    sectionStyle={sectionStyles?.['header']}
                    showSearch={false}
                    className="pt-safe-top"
                >
                    <div className="flex flex-col items-start flex-1">
                        <p 
                            className="text-[10px] font-black uppercase tracking-[0.2em] mb-0.5 text-black"
                        >
                            Menu
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <p 
                            className="text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap text-black"
                            style={{ 
                                backgroundColor: 'rgba(0,0,0,0.05)'
                            }}
                        >
                            {tableDisplayName.toLowerCase().includes('table') ? tableDisplayName : `Table ${tableDisplayName}`}
                        </p>
                        <div className="flex items-center gap-2">
                            <span 
                                className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${isVegMode ? 'text-green-600' : 'text-black'}`}
                            >
                                Veg
                            </span>
                            <button
                                onClick={() => setIsVegMode(!isVegMode)}
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none ${isVegMode ? 'bg-green-500' : 'bg-neutral-200'}`}
                            >
                                <span className={`inline-block size-3 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${isVegMode ? 'translate-x-5' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                </MainHeader>

                {/* SubCategories & Search */}
                <div className="p-4 bg-gray-50/50 backdrop-blur-xl z-20">
                    {/* Search */}
                    <div className="relative mb-3">
                        <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-black" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white rounded-xl py-2.5 pl-9 pr-4 text-base sm:text-sm font-medium text-black placeholder-black focus:outline-none focus:ring-2 focus:ring-orange-500/10 shadow-sm border border-gray-100"
                        />
                    </div>

                    {/* Veg / Non-Veg Filter */}
                    <div className="flex gap-2 mb-3 bg-gray-100 p-1 rounded-xl relative z-0">
                        {(['ALL', 'Veg', 'Non-Veg'] as const).map(type => {
                            const isActive = isVegMode ? type === 'Veg' : activeTypeFilter === type;
                            const isForcedDisabled = isVegMode && type === 'Non-Veg';
                            const filterBgColor = type === 'Veg' ? 'bg-green-600' : type === 'Non-Veg' ? 'bg-red-600' : 'bg-black';

                            return (
                                <button
                                    key={type}
                                    disabled={isForcedDisabled}
                                    onClick={() => {
                                        if (!isForcedDisabled) setActiveTypeFilter(type);
                                    }}
                                    className={`flex-1 relative py-2 rounded-lg text-xs font-bold transition-all z-10 ${isActive
                                        ? 'text-white'
                                        : isForcedDisabled ? 'text-black cursor-not-allowed' : 'text-black hover:text-black'
                                        }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="customerTypeFilter"
                                            transition={{
                                                type: "spring",
                                                stiffness: 400,
                                                damping: 35,
                                                mass: 1
                                            }}
                                            className={`absolute inset-0 rounded-lg shadow-sm ${filterBgColor}`}
                                            style={{ zIndex: -1 }}
                                        />
                                    )}
                                    <span className="relative z-10">{type === 'ALL' ? 'All' : type}</span>
                                </button>
                            );
                        })}
                    </div>
                    {/* Horizontal SubCats - Hide if only diet-type names or "General" */}
                    {(() => {
                        const dietNames = new Set(['general', 'veg', 'non-veg', 'nonveg', 'egg']);
                        const hasRealSubCats = activeCategory && subCategories.length > 0 && subCategories.some(s => !dietNames.has(s.name.toLowerCase()));
                        return hasRealSubCats;
                    })() && (
                            <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar">
                                <button
                                    onClick={() => setActiveSubCategory('ALL')}
                                    className="relative whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold border border-transparent z-0"
                                >
                                    {activeSubCategory === 'ALL' && (
                                        <motion.div
                                            layoutId="activeSubCat"
                                            className="absolute inset-0 bg-neutral-900 rounded-full shadow-md shadow-neutral-900/10"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            style={{ zIndex: -1 }}
                                        />
                                    )}
                                    <span className={`relative z-10 transition-colors duration-200 ${activeSubCategory === 'ALL' ? 'text-white' : 'text-black'}`}>All</span>
                                </button>
                                {subCategories.map(sub => (
                                    <button
                                        key={sub.id}
                                        onClick={() => setActiveSubCategory(sub.id)}
                                        className="relative whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold border border-transparent z-0"
                                    >
                                        {activeSubCategory === sub.id && (
                                            <motion.div
                                                layoutId="activeSubCat"
                                                className="absolute inset-0 bg-neutral-900 rounded-full shadow-md shadow-neutral-900/10"
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                style={{ zIndex: -1 }}
                                            />
                                        )}
                                        <span className={`relative z-10 transition-colors duration-200 ${activeSubCategory === sub.id ? 'text-white' : 'text-black'}`}>{sub.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                </div>

                {/* Scrollable Menu List */}
                <main className="flex-1 overflow-y-auto p-4 pt-0 pb-32 space-y-4 relative z-0">
                    {/* Featured Sections in ALL view */}
                    {activeCategory === 'ALL' && !searchTerm && (
                        <>
                            {/* Today Specials Section */}
                            {todaySpecials.length > 0 && (
                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <div className="flex items-center gap-2">
                                            <div className="size-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                                <LucideFlame size={14} />
                                            </div>
                                            <h2 className="text-base font-black text-black uppercase tracking-tight">Today Specials</h2>
                                        </div>
                                        <button 
                                            onClick={() => setActiveCategory('TODAY_SPECIALS')}
                                            className="text-[11px] font-black text-black uppercase underline underline-offset-4"
                                        >
                                            View All
                                        </button>
                                    </div>
                                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 px-2">
                                        {todaySpecials.slice(0, 5).map(special => (
                                            <div key={special.id} className="min-w-[280px] bg-white rounded-3xl p-4 border border-neutral-100 shadow-sm flex flex-col justify-between">
                                                <div>
                                                    <div className="size-32 bg-neutral-50 rounded-2xl mx-auto mb-3 overflow-hidden border border-neutral-100">
                                                        <img 
                                                            src={special.image_url || getCategoryMenuItemImage(special.name)} 
                                                            alt={special.name} 
                                                            className="w-full h-full object-cover" 
                                                        />
                                                    </div>
                                                    <h3 className="font-black text-black text-sm tracking-tight truncate mb-2">{special.name}</h3>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <span className="text-base font-black text-black">₹{special.special_price}</span>
                                                            {(special.price || (special as any).original_price) && (Number(special.price || (special as any).original_price) > Number(special.special_price)) && (
                                                                <span className="text-xs text-gray-400 line-through">₹{(special as any).original_price || special.price}</span>
                                                            )}
                                                        </div>
                                                        <SharedQuantityControl
                                                            qty={getItemQtyInCart(special.id)}
                                                            onAdd={() => addToCart(special, 1)}
                                                            onUpdateQuantity={(delta) => updateQuantity(special.id, delta)}
                                                            colorHex="#ea580c"
                                                            size="md"
                                                            buttonStyle="text"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Combo Offers Section */}
                            {comboOffers.length > 0 && (
                                <div className="mb-8">
                                    <div className="flex items-center justify-between mb-4 px-2">
                                        <div className="flex items-center gap-2">
                                            <div className="size-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                                <LucideShoppingBag size={14} />
                                            </div>
                                            <h2 className="text-base font-black text-black uppercase tracking-tight">Combo Offers</h2>
                                        </div>
                                        <button 
                                            onClick={() => setActiveCategory('COMBO_OFFERS')}
                                            className="text-[11px] font-black text-black uppercase underline underline-offset-4"
                                        >
                                            View All
                                        </button>
                                    </div>
                                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 px-2">
                                        {comboOffers.slice(0, 5).map(special => (
                                            <div key={special.id} className="min-w-[280px] bg-white rounded-3xl p-4 border border-neutral-100 shadow-sm flex flex-col justify-between">
                                                <div>
                                                    <div className="size-32 bg-neutral-50 rounded-2xl mx-auto mb-3 overflow-hidden border border-neutral-100">
                                                        <img 
                                                            src={special.image_url || getCategoryMenuItemImage(special.title)} 
                                                            alt={special.title} 
                                                            className="w-full h-full object-cover" 
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <h3 className="font-black text-black text-sm tracking-tight truncate">{special.title}</h3>
                                                        <span className="px-2 py-0.5 bg-black text-white text-[8px] font-black uppercase rounded-full tracking-widest">COMBO</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                            <span className="text-base font-black text-black">₹{special.special_price}</span>
                                                        </div>
                                                        <SharedQuantityControl
                                                            qty={cart[`special-${special.id}`]?.quantity || 0}
                                                            onAdd={() => addSpecialToCart(special)}
                                                            onUpdateQuantity={(delta) => updateQuantity(`special-${special.id}`, delta)}
                                                            colorHex="#000000"
                                                            size="md"
                                                            buttonStyle="text"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Section Header for the rest of the items */}
                            <div className="px-2 mb-2">
                                <h2 className="text-base font-black text-black uppercase tracking-tight">Full Menu</h2>
                            </div>
                        </>
                    )}

                    {/* Combo Offers View */}
                    {activeCategory === 'COMBO_OFFERS' && (
                        comboOffers.length === 0 ? (
                            <div className="text-center py-20">
                                <LucideShoppingBag className="text-black mx-auto mb-4" size={32} />
                                <p className="text-black font-bold">No combo offers available.</p>
                            </div>
                        ) : (
                            comboOffers.map(special => (
                                <div key={special.id} className="bg-white rounded-3xl p-5 border border-neutral-100 shadow-sm min-h-[660px] flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="size-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                                    <LucideShoppingBag size={18} />
                                                </div>
                                                <h3 className="font-black text-black text-xl tracking-tight">{special.title}</h3>
                                            </div>
                                            <span className="px-3 py-1 bg-black text-white text-[10px] font-black uppercase rounded-full tracking-widest">COMBO</span>
                                        </div>
                                        {special.description && (
                                            <p className="text-sm text-black mb-5 font-medium leading-relaxed">{special.description}</p>
                                        )}
                                        {special.special_price && (
                                            <div className="mb-6 flex items-center gap-3 bg-neutral-50 p-4 rounded-2xl w-full border border-neutral-100">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-black mb-1">Combo Price</span>
                                                    <span className="text-3xl font-black text-black">₹{special.special_price}</span>
                                                </div>
                                                <div className="ml-auto flex flex-col items-end">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-black mb-1">Save</span>
                                                    <span className="text-sm text-green-600 font-black">₹{((special.items || []).reduce((s, si) => s + (si.menu_item?.price || 0) * si.quantity, 0)) - (special.special_price || 0)}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-4">
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black px-1">Includes</p>
                                            {(special.items || []).map((si, idx) => si.menu_item && (
                                                <div key={si.id || `si-${idx}`} className="flex gap-4 items-center bg-neutral-50/50 p-3 rounded-2xl border border-neutral-100/50">
                                                    <div className="size-14 bg-white rounded-xl flex-shrink-0 overflow-hidden border border-neutral-100">
                                                        {si.menu_item.image_url ? (
                                                            <img src={si.menu_item.image_url} alt={si.menu_item.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <img src={getCategoryMenuItemImage(si.menu_item.name)} alt={si.menu_item.name} className="w-full h-full object-cover" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-black text-black text-sm tracking-tight">{si.menu_item.name}</h4>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[11px] font-black text-black bg-white px-2 py-0.5 rounded-md border border-neutral-100">QTY: {si.quantity}</span>
                                                            <span className="text-[11px] font-bold text-black">₹{si.menu_item.price} each</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-8 flex items-center justify-between border-t border-neutral-50 pt-5">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-black">Limited Offer</span>
                                            <span className="text-sm font-black text-black">Add to Cart</span>
                                        </div>
                                        <SharedQuantityControl
                                            qty={getItemQtyInCart(`special-${special.id}`)}
                                            onAdd={() => addSpecialToCart(special)}
                                            onUpdateQuantity={(delta) => updateQuantity(`special-${special.id}`, delta)}
                                            colorHex="#000000"
                                            size="lg"
                                            buttonStyle="text"
                                        />
                                    </div>
                                </div>
                            ))
                        )
                    )}

                    {activeCategory !== 'COMBO_OFFERS' && (
                        filteredItems.length === 0 ? (
                            <div className="text-center py-20">
                                <div className="inline-block p-4 rounded-full bg-gray-100 mb-4">
                                    <LucideUtensils className="text-black" size={24} />
                                </div>
                                <p className="text-black font-medium">No items found.</p>
                            </div>
                        ) : (
                            filteredItems.map(item => (
                            <div key={item.id} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex gap-3 transform transition-all active:scale-[0.99]">
                                {/* Image Placeholder or Actual Image */}
                                <div className="size-24 bg-gray-50 rounded-xl flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                                    {item.image_url ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <img
                                            src={getCategoryMenuItemImage(item.name)}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                    <div>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex flex-col min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h3 className="font-bold text-black text-base leading-tight line-clamp-2">{item.name}</h3>
                                                    {isSpecialActive(item) && (
                                                        <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-orange-100 text-orange-600 text-[8px] font-black uppercase tracking-wider">
                                                            Today Special
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={`mt-1 size-2.5 rounded-full flex-shrink-0 border-[1.5px] p-[1.5px] ${item.item_type === 'Veg' ? 'border-green-600' :
                                                item.item_type === 'Non-Veg' ? 'border-red-600' :
                                                    item.item_type === 'Egg' ? 'border-yellow-600' : 'border-black'
                                                }`}>
                                                <div className={`w-full h-full rounded-full ${item.item_type === 'Veg' ? 'bg-green-600' :
                                                    item.item_type === 'Non-Veg' ? 'bg-red-600' :
                                                        item.item_type === 'Egg' ? 'bg-yellow-600' : 'bg-black'
                                                    }`}></div>
                                            </div>
                                        </div>
                                        {item.description && (
                                            <p className="text-[11px] text-black mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                                        )}
                                    </div>

                                    <div className="flex items-end justify-between mt-3">
                                        <div className="flex flex-col">
                                            {item.special_price !== undefined && item.special_price !== null && Number(item.special_price) > 0 ? (
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="font-black text-black">₹{item.special_price}</span>
                                                        {(item.price !== undefined && item.price !== null && Number(item.price) > Number(item.special_price)) && (
                                                            <span className="text-xs text-gray-400 line-through">₹{item.price}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="font-black text-black">₹{item.price ?? 0}</p>
                                            )}
                                        </div>

                                        <SharedQuantityControl
                                            qty={getItemQtyInCart(item.id)}
                                            onAdd={() => addToCart(item, 1)}
                                            onUpdateQuantity={(delta) => updateQuantity(item.id, delta)}
                                            colorHex="#ea580c"
                                        />
                                    </div>
                                </div>
                            </div>
                        )))
                    )}
                </main>
            </div>

            {/* Standardized floating cart is handled by the layout */}
        </div>
    );
}
