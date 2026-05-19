'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { getCategoryMenuItemImage } from '@/app/lib/utils';
import { MenuService, Category, SubCategory, MenuItem } from '@/app/services/menu';
import { OrderService } from '@/app/services/orders';
import { useCartSafe } from '@/app/context/CartContext';
import { Utensils as LucideUtensils, Coffee as LucideCoffee, IceCream as LucideIceCream, GlassWater as LucideGlassWater, Search as LucideSearch, ShoppingBag as LucideShoppingBag, Flame as LucideFlame } from 'lucide-react';
import { motion } from 'framer-motion';
import { SpecialsService, TodaySpecial } from '@/app/services/specials.service';
import { SharedSkeleton } from '@/app/components/customer/SharedSkeleton';
import { MainHeader } from '@/app/components/shared/MainHeader';
import { HomepageBuilderService } from '@/app/services/homepage-builder.service';
import { CustomerCache } from '@/app/services/homepage-cache.service';
import SharedQuantityControl from '@/app/components/shared/SharedQuantityControl';

export function PersistentMenu({ restaurantId, tableNumber }: { restaurantId: string, tableNumber: string }) {
    const pathname = usePathname();
    const isVisible = pathname.includes('/customer/menu/');
    const searchParams = useSearchParams();
    const categoryParam = searchParams.get('category');
    
    const cartContext = useCartSafe();
    const addToCart = cartContext?.addToCart || (() => {});
    const addSpecialToCart = cartContext?.addSpecialToCart || (() => {});
    const cart = cartContext?.cart || {};
    const updateQuantity = cartContext?.updateQuantity || (() => {});
    const setTableNumber = cartContext?.setTableNumber || (() => {});

    // Cache handling
    const cachedData = CustomerCache.get(restaurantId, 'menu', tableNumber);
    
    const [categories, setCategories] = useState<Category[]>(cachedData?.categories || []);
    const [subCategories, setSubCategories] = useState<SubCategory[]>(cachedData?.subCategories || []);
    const [menuItems, setMenuItems] = useState<MenuItem[]>(cachedData?.menuItems || []);
    const [activeCategory, setActiveCategory] = useState<number | string | null>(cachedData?.activeCategory || null);
    const [specials, setSpecials] = useState<TodaySpecial[]>(cachedData?.specials || []);
    const [activeSubCategory, setActiveSubCategory] = useState<number | 'ALL'>(cachedData?.activeSubCategory || 'ALL');

    const [activeTypeFilter, setActiveTypeFilter] = useState<'ALL' | 'Veg' | 'Non-Veg'>('ALL');
    const [loading, setLoading] = useState(!cachedData);
    const [searchTerm, setSearchTerm] = useState('');

    const [isVegMode, setIsVegMode] = useState(false);
    const [tableDisplayName, setTableDisplayName] = useState(tableNumber);
    const [tableNotFound, setTableNotFound] = useState(false);
    const [profile, setProfile] = useState<any>(cachedData?.profile || null);
    const [sectionStyles, setSectionStyles] = useState<any>(cachedData?.sectionStyles || null);

    const scrollPos = useRef(0);
    const isFirstRun = useRef(true);

    const loadData = useCallback(async (showLoading = true) => {
        if (showLoading && !CustomerCache.get(restaurantId, 'menu', tableNumber)) setLoading(true);
        try {
            const [cats, items, specialsData, tableInfo, profileData, stylesData] = await Promise.all([
                MenuService.fetchCategories(restaurantId),
                MenuService.fetchMenuItems(restaurantId),
                SpecialsService.fetchActiveSpecials(restaurantId),
                tableNumber ? OrderService.verifyTableExists(restaurantId, tableNumber) : Promise.resolve(null),
                HomepageBuilderService.getProfile(restaurantId),
                HomepageBuilderService.getSectionStyles(restaurantId)
            ]);
            
            if (tableInfo) {
                if (tableInfo.restaurant_id !== restaurantId) {
                    setTableNotFound(true);
                } else {
                    const newName = tableInfo.display_name || tableInfo.table_number || tableNumber;
                    setTableDisplayName(newName);
                }
            } else {
                setTableNotFound(true);
            }

            const uniqueCats = (cats || []).filter((cat, index, self) =>
                index === self.findIndex((c) => c.name === cat.name)
            );

            setCategories(uniqueCats);
            setMenuItems(items);
            setSpecials(specialsData);
            setProfile(profileData);
            setSectionStyles(stylesData);

            // Initial category selection if none active
            if (!activeCategory) {
                if (specialsData.length > 0) {
                    setActiveCategory('SPECIALS');
                } else if (uniqueCats.length > 0) {
                    setActiveCategory(uniqueCats[0].id);
                }
            }

            // Save to cache
            CustomerCache.set(restaurantId, 'menu', {
                categories: uniqueCats,
                menuItems: items,
                specials: specialsData,
                profile: profileData,
                sectionStyles: stylesData,
                activeCategory: activeCategory || (specialsData.length > 0 ? 'SPECIALS' : uniqueCats[0]?.id)
            }, tableNumber);

        } catch (error) {
            console.error('Failed to load menu:', error);
        } finally {
            setLoading(false);
        }
    }, [restaurantId, tableNumber, activeCategory]);

    useEffect(() => {
        if (isFirstRun.current) {
            loadData(!cachedData);
            isFirstRun.current = false;
        }
    }, [loadData, cachedData]);

    // Handle visibility and scroll
    useEffect(() => {
        if (isVisible) {
            window.scrollTo(0, scrollPos.current);
            const handleScroll = () => {
                scrollPos.current = window.scrollY;
            };
            window.addEventListener('scroll', handleScroll);
            return () => window.removeEventListener('scroll', handleScroll);
        }
    }, [isVisible]);

    useEffect(() => {
        if (tableNumber) {
            setTableNumber(tableNumber);
        }
    }, [tableNumber, setTableNumber]);

    useEffect(() => {
        if (categoryParam) {
            const num = Number(categoryParam);
            if (!isNaN(num) && categoryParam.trim() !== '') {
                setActiveCategory(num);
            } else {
                setActiveCategory(categoryParam);
            }
        }
    }, [categoryParam]);

    useEffect(() => {
        const loadSubCategories = async () => {
            if (!activeCategory || typeof activeCategory === 'string') {
                setSubCategories([]);
                return;
            }
            try {
                const subs = await MenuService.fetchSubCategories(activeCategory, restaurantId);
                setSubCategories(subs);
                setActiveSubCategory('ALL');
            } catch (err) {
                console.error('Failed to load subcategories', err);
            }
        };
        loadSubCategories();
    }, [activeCategory, restaurantId]);

    const getItemQtyInCart = (id: number | string) => cart[String(id)]?.quantity || 0;

    const filteredItems = menuItems.filter(item => {
        const matchesCategory = activeCategory ? String(item.category_id) === String(activeCategory) : true;
        const matchesSubCategory = activeSubCategory === 'ALL' || item.sub_category_id === activeSubCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());

        const fallbackType = item.item_type || (item.is_veg ? 'Veg' : 'Non-Veg');
        const effectiveFilter = isVegMode ? 'Veg' : activeTypeFilter;
        const typeMatch = effectiveFilter === 'ALL'
            || fallbackType === effectiveFilter
            || (effectiveFilter === 'Non-Veg' && fallbackType === 'Egg');

        return matchesCategory && matchesSubCategory && matchesSearch && item.is_available && item.active !== false && typeMatch;
    });

    if (tableNotFound && isVisible) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-white p-6 text-center">
                <div className="bg-red-50 p-6 rounded-3xl mb-6">
                    <LucideUtensils className="text-red-500 mx-auto" size={48} />
                </div>
                <h2 className="text-2xl font-black text-black mb-2">No table number</h2>
                <p className="text-black mb-8 max-w-xs">Please scan the QR code again.</p>
            </div>
        );
    }

    return (
        <div style={{ display: isVisible ? 'flex' : 'none' }} className="h-screen bg-gray-50 overflow-hidden">
             {/* Sidebar Categories */}
             <aside className="w-20 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-4 overflow-y-auto no-scrollbar z-10 shadow-[2px_0_20px_rgba(0,0,0,0.02)] pt-safe-top">
                <div className="flex flex-col gap-3 w-full items-center pb-24">
                    {specials.length > 0 && (
                        <button
                            onClick={() => setActiveCategory('SPECIALS')}
                            className="relative w-[72px] flex flex-col items-center z-0 group"
                        >
                            {activeCategory === 'SPECIALS' && (
                                <motion.div
                                    layoutId="activeSidebarMenu"
                                    className="absolute inset-0 bg-gradient-to-b from-amber-400 to-orange-500 rounded-2xl"
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                            )}
                            <div className="relative z-10 flex flex-col items-center gap-1 py-2.5 px-1">
                                <div className={`size-14 rounded-xl flex items-center justify-center transition-all duration-300 ${activeCategory === 'SPECIALS' ? 'bg-white/20 ring-[2.5px] ring-white/90' : 'bg-gradient-to-br from-amber-100 to-orange-100'}`}>
                                    <LucideFlame size={24} className={activeCategory === 'SPECIALS' ? 'text-white' : 'text-orange-500'} />
                                </div>
                                <span className={`text-[10px] font-bold text-center leading-tight line-clamp-2 max-w-full ${activeCategory === 'SPECIALS' ? 'text-white' : 'text-black'}`}>
                                    Special
                                </span>
                            </div>
                        </button>
                    )}
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className="relative w-[72px] flex flex-col items-center z-0 group"
                        >
                            {activeCategory === cat.id && (
                                <motion.div
                                    layoutId="activeSidebarMenu"
                                    className="absolute inset-0 bg-gradient-to-b from-orange-400 to-orange-500 rounded-2xl"
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                            )}
                            <div className="relative z-10 flex flex-col items-center gap-1 py-2.5 px-1">
                                <div className={`size-14 rounded-xl overflow-hidden transition-all duration-300 ${activeCategory === cat.id ? 'ring-[2.5px] ring-white/90' : ''}`}>
                                    <img src={cat.image_url || getCategoryMenuItemImage(cat.name)} alt={cat.name} className="w-full h-full object-cover" />
                                </div>
                                <span className={`text-[10px] font-bold text-center leading-tight line-clamp-2 max-w-full ${activeCategory === cat.id ? 'text-white' : 'text-black'}`}>
                                    {cat.name}
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full relative">
                <MainHeader profile={profile} sectionStyle={sectionStyles?.['header']} showSearch={false} className="pt-safe-top">
                    <div className="flex flex-col items-center flex-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-0.5 text-black">Menu</p>
                        <p className="text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-black/5">
                            {tableDisplayName}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isVegMode ? 'text-green-600' : 'text-black'}`}>Veg</span>
                        <button onClick={() => setIsVegMode(!isVegMode)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isVegMode ? 'bg-green-500' : 'bg-neutral-200'}`}>
                            <span className={`inline-block size-3 transform rounded-full bg-white transition-transform ${isVegMode ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </MainHeader>

                <div className="p-4 bg-gray-50/50 backdrop-blur-xl z-20">
                    <div className="relative mb-3">
                        <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-black" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white rounded-xl py-2.5 pl-9 pr-4 text-sm font-medium border border-gray-100"
                        />
                    </div>

                    <div className="flex gap-2 mb-3 bg-gray-100 p-1 rounded-xl relative z-0">
                        {(['ALL', 'Veg', 'Non-Veg'] as const).map(type => {
                            const isActive = isVegMode ? type === 'Veg' : activeTypeFilter === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setActiveTypeFilter(type)}
                                    className={`flex-1 relative py-2 rounded-lg text-xs font-bold transition-all z-10 ${isActive ? 'text-white' : 'text-black'}`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="menuTypeFilter"
                                            className={`absolute inset-0 rounded-lg ${type === 'Veg' ? 'bg-green-600' : type === 'Non-Veg' ? 'bg-red-600' : 'bg-neutral-900'}`}
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            style={{ zIndex: -1 }}
                                        />
                                    )}
                                    <span className="relative z-10">{type}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <main className="flex-1 overflow-y-auto p-4 pt-0 pb-32 space-y-3 relative z-0 no-scrollbar">
                    {loading ? (
                        <div className="space-y-4">
                            {[1,2,3,4].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-20 text-black font-medium">No items found.</div>
                    ) : (
                        filteredItems.map(item => (
                            <div key={item.id} className="bg-white rounded-2xl p-3 border border-gray-100 flex gap-3">
                                <div className="size-24 bg-gray-50 rounded-xl flex-shrink-0 overflow-hidden">
                                    <img src={item.image_url || getCategoryMenuItemImage(item.name)} alt={item.name} className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 flex flex-col justify-between py-1">
                                    <div>
                                        <div className="flex items-start justify-between">
                                            <h3 className="font-bold text-black text-base leading-tight line-clamp-2">{item.name}</h3>
                                            <div className={`mt-1 size-2.5 rounded-full border-[1.5px] p-[1.5px] ${item.item_type === 'Veg' ? 'border-green-600' : 'border-red-600'}`}>
                                                <div className={`w-full h-full rounded-full ${item.item_type === 'Veg' ? 'bg-green-600' : 'bg-red-600'}`} />
                                            </div>
                                        </div>
                                        {item.description && <p className="text-[11px] text-black mt-1 line-clamp-2">{item.description}</p>}
                                    </div>
                                    <div className="flex items-end justify-between mt-3">
                                        <p className="font-black text-black">₹{item.price}</p>
                                        <SharedQuantityControl 
                                            qty={getItemQtyInCart(item.id)}
                                            onAdd={() => addToCart(item, 1)}
                                            onUpdateQuantity={(delta) => updateQuantity(item.id, delta)}
                                            buttonStyle="text"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </main>
            </div>
        </div>
    );
}
