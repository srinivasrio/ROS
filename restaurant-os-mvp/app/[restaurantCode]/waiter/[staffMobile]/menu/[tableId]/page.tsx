'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { getCategoryMenuItemImage } from '@/lib/utils';
import { OrderService } from '@/services/orders.service';
import { MenuService, type Category, type SubCategory, type MenuItem } from '@/services/menu.service';
import { SpecialsService, type TodaySpecial } from '@/services/specials.service';
import { isSpecialActive } from '@/context/CartContext';
import {
    Search, X, ShoppingBag, Plus, Minus, UtensilsCrossed,
    Flame, ChevronRight, ChevronDown, Lock,
} from 'lucide-react';
import { haptic, useIsHydrated, normalizeTableStatus } from '../../../components/ui';
import TablePickerSheet from '../../../components/TablePickerSheet';

const QUICK_NOTES = ['Less spicy', 'No onion', 'No garlic', 'Extra spicy', 'Crispy', 'Serve hot'];

type DietKey = 'ALL' | 'Veg' | 'Non-Veg';

function getCategoryImage(name: string) {
    const n = name.toLowerCase();
    if (n.includes('soup')) return '/menu/hot-and-sour-soup.jpeg';
    if (n.includes('veg starter')) return '/menu/paneer-tikka.png';
    if (n.includes('non-veg starter')) return '/menu/chicken-lollipop.jpeg';
    if (n.includes('starter')) return '/menu/paneer-tikka.png';
    if (n.includes('veg curr')) return '/menu/paneer-butter-masala.jpeg';
    if (n.includes('non-veg curr')) return '/menu/mutton-rogan-josh.jpeg';
    if (n.includes('biryani')) return '/menu/mutton-biryani.jpeg';
    if (n.includes('ghee rice')) return '/menu/ghee-rice.jpeg';
    if (n.includes('rice')) return '/menu/jeera-rice.jpeg';
    if (n.includes('chinese') || n.includes('noodles')) return '/menu/veg-hakka-noodles.jpeg';
    if (n.includes('bread') || n.includes('roti') || n.includes('naan')) return '/menu/tandoori-roti.jpeg';
    if (n.includes('dessert') || n.includes('sweet')) return '/menu/rasmalai.jpeg';
    if (n.includes('drink') || n.includes('beverage')) return '/menu/ice-cream-3-flavours.jpeg';
    return '/menu/veg-biryani.png';
}

function hasRealSubCats(subs: SubCategory[]) {
    const dietNames = new Set(['general', 'veg', 'non-veg', 'nonveg', 'egg']);
    return subs.length > 0 && subs.some((s) => !dietNames.has(s.name.toLowerCase()));
}

// Persistent in-memory cache for instant tab switching without screen reload/skeleton flash
let cachedMenuData: {
    restaurantCode: string;
    categories: Category[];
    menuItems: MenuItem[];
    specials: TodaySpecial[];
} | null = null;

export default function WaiterMenuSelection() {
    const params = useParams();
    const router = useRouter();
    const rawTableId = typeof params.tableId === 'string' ? params.tableId : '';
    const isBrowse = rawTableId === 'browse';
    const tableId = isBrowse ? '' : rawTableId;
    const staffMobile = params.staffMobile as string;
    const restaurantCode = params.restaurantCode as string;

    const isHydrated = useIsHydrated();
    const hasCache = isHydrated && Boolean(
        cachedMenuData &&
        cachedMenuData.restaurantCode === restaurantCode &&
        cachedMenuData.categories.length > 0
    );

    const [categories, setCategories] = useState<Category[]>(() => hasCache ? cachedMenuData!.categories : []);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>(() => hasCache ? cachedMenuData!.menuItems : []);
    const [specials, setSpecials] = useState<TodaySpecial[]>(() => hasCache ? cachedMenuData!.specials : []);
    const [specialCategoryImages, setSpecialCategoryImages] = useState<{ combos?: string; specials?: string }>({});
    const [activeCategory, setActiveCategory] = useState<number | string | null>(() => hasCache ? (cachedMenuData!.categories[0]?.id || 'COMBOS') : 'COMBOS');
    const [activeSubCategory, setActiveSubCategory] = useState<number | 'ALL'>('ALL');
    const [diet, setDiet] = useState<DietKey>('ALL');
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState<Record<string, number>>({});
    const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
    const [customizing, setCustomizing] = useState<{ id: string; name: string } | null>(null);
    const [tableName, setTableName] = useState('');
    const [selectedTable, setSelectedTable] = useState<{ id: string | number; table_number: string | number; display_name?: string } | null>(null);
    const [tablePickerOpen, setTablePickerOpen] = useState(false);
    const [floorTables, setFloorTables] = useState<any[]>([]);
    const [loadingTables, setLoadingTables] = useState(false);
    const [loading, setLoading] = useState(!hasCache);

    // Restore draft cart from sessionStorage if available
    useEffect(() => {
        try {
            if (tableId) {
                const rawDraft = sessionStorage.getItem(`waiter_draft_order_${tableId}`);
                if (rawDraft) {
                    const parsed = JSON.parse(rawDraft);
                    if (parsed.cart) setCart(parsed.cart);
                    if (parsed.itemNotes) setItemNotes(parsed.itemNotes);
                }
            } else if (isBrowse) {
                const rawBrowse = sessionStorage.getItem(`waiter_browse_cart_${restaurantCode}`);
                if (rawBrowse) {
                    const parsed = JSON.parse(rawBrowse);
                    if (parsed.cart) setCart(parsed.cart);
                    if (parsed.itemNotes) setItemNotes(parsed.itemNotes);
                    if (parsed.selectedTable) setSelectedTable(parsed.selectedTable);
                }
            }
        } catch (_) {}
    }, [tableId, isBrowse, restaurantCode]);

    /* Data load */
    useEffect(() => {
        const loadData = async () => {
            try {
                if (tableId) {
                    const tableData = await OrderService.findTableAnywhere(tableId, restaurantCode);
                    if (tableData) {
                        setTableName(tableData.display_name || `Table ${tableData.table_number}`);
                    }
                }
                const [cats, items, specialsData, specialImages] = await Promise.all([
                    MenuService.fetchCategories(restaurantCode),
                    MenuService.fetchMenuItems(restaurantCode),
                    SpecialsService.fetchActiveSpecials(restaurantCode),
                    SpecialsService.getSpecialCategoryImages(restaurantCode),
                ]);
                const uniqueCats = (cats || []).filter((cat: any, index: number, self: any[]) =>
                    index === self.findIndex((c: any) => c.name === cat.name)
                );
                setCategories(uniqueCats);
                setMenuItems(items);
                setSpecials(specialsData);
                if (specialImages) setSpecialCategoryImages(specialImages);
                setActiveCategory((prev) => prev ?? (uniqueCats[0]?.id || 'COMBOS'));

                if (restaurantCode) {
                    cachedMenuData = {
                        restaurantCode,
                        categories: uniqueCats,
                        menuItems: items,
                        specials: specialsData,
                    };
                }
            } catch (error) {
                console.error('Failed to load menu data:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();

        const sub = OrderService.subscribeToMenuItems(restaurantCode, () => loadData());
        return () => {
            sub.unsubscribe();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!activeCategory || typeof activeCategory === 'string') {
            setSubCategories([]);
            return;
        }
        MenuService.fetchSubCategories(activeCategory, restaurantCode)
            .then((subs) => {
                setSubCategories(subs);
                setActiveSubCategory('ALL');
            })
            .catch(console.error);
    }, [activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

    const getItemQty = (id: number | string) => cart[String(id)] || 0;

    const updateQty = (id: number | string, delta: number) => {
        const strId = String(id);
        haptic.light();
        setCart((prev) => {
            const newQty = (prev[strId] || 0) + delta;
            if (newQty <= 0) {
                const { [strId]: _, ...rest } = prev;
                setItemNotes((n) => {
                    const { [strId]: __, ...restNotes } = n;
                    return restNotes;
                });
                return rest;
            }
            return { ...prev, [strId]: newQty };
        });
    };

    const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
    const subtotal = Object.entries(cart).reduce((sum, [idStr, qty]) => {
        if (idStr.startsWith('special-')) {
            const special = specials.find((s) => s.id === idStr.replace('special-', ''));
            const price = special?.special_price || (special?.items || []).reduce((s, si) => s + (si.menu_item?.price || 0) * si.quantity, 0);
            return sum + price * qty;
        }
        const item = menuItems.find((i) => i.id === Number(idStr));
        return sum + (item ? (isSpecialActive(item) && item.special_price ? item.special_price * qty : item.price * qty) : 0);
    }, 0);

    const todaySpecials = useMemo(() => {
        return menuItems.filter((item) => isSpecialActive(item));
    }, [menuItems]);

    const comboOffers = useMemo(() => {
        return specials.filter((s) => s.special_type === 'combo' || s.is_combo);
    }, [specials]);

    const comboCategoryImage = specialCategoryImages.combos || specials.find(s => (s.is_combo || s.special_type === 'combo') && Boolean(s.image_url))?.image_url || '/menu/tandoori-chicken.jpeg';
    const specialsCategoryImage = specialCategoryImages.specials || specials.find(s => !s.is_combo && s.special_type !== 'combo' && Boolean(s.image_url))?.image_url || todaySpecials.find(s => Boolean(s.image_url))?.image_url || '/menu/chicken-tikka.jpeg';

    const searching = search.trim().length > 0;
    const searchResults = useMemo(() => {
        if (!searching) return [];
        const q = search.trim().toLowerCase();
        return menuItems.filter((i) => {
            const fallbackType = i.item_type || (i.is_veg ? 'Veg' : 'Non-Veg');
            const typeMatch = diet === 'ALL' || fallbackType === diet || (diet === 'Non-Veg' && fallbackType === 'Egg');
            return i.is_available && i.active !== false && typeMatch &&
                (i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q));
        });
    }, [search, menuItems, searching, diet]);

    const matchingCombos = useMemo(() => {
        if (!searching) return [];
        const q = search.trim().toLowerCase();
        return (comboOffers.length > 0 ? comboOffers : specials).filter((s) => {
            const matchesQuery = s.title.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q);
            if (!matchesQuery) return false;
            if (diet === 'ALL') return true;
            const items = s.items || [];
            const isVeg = items.length > 0 && items.every(si => si.menu_item?.item_type === 'Veg' || (si.menu_item as any)?.is_veg === true);
            if (diet === 'Veg') return isVeg;
            if (diet === 'Non-Veg') return !isVeg;
            return true;
        });
    }, [search, searching, comboOffers, specials, diet]);

    const filteredItems = useMemo(() => {
        if (activeCategory === 'TODAY_SPECIALS') {
            return todaySpecials.filter((item) => {
                const fallbackType = item.item_type || (item.is_veg ? 'Veg' : 'Non-Veg');
                const typeMatch = diet === 'ALL' || fallbackType === diet || (diet === 'Non-Veg' && fallbackType === 'Egg');
                return item.is_available && item.active !== false && typeMatch;
            });
        }
        return menuItems.filter((item) => {
            const matchesCategory = item.category_id === activeCategory;
            const matchesSub = activeSubCategory === 'ALL' || item.sub_category_id === activeSubCategory;
            const fallbackType = item.item_type || (item.is_veg ? 'Veg' : 'Non-Veg');
            const typeMatch = diet === 'ALL' || fallbackType === diet || (diet === 'Non-Veg' && fallbackType === 'Egg');
            return matchesCategory && matchesSub && item.is_available && item.active !== false && typeMatch;
        });
    }, [menuItems, activeCategory, activeSubCategory, diet, todaySpecials]);

    /* ── Build structured cart details ────────────────────────── */
    const buildCartDetails = () => {
        const cartDetails: Record<string, {
            id: string | number;
            name: string;
            price: number;
            imageUrl?: string;
            isSpecial?: boolean;
            combo_items?: any[];
            special_type?: string;
            gst_percentage?: number;
            cgst_percentage?: number;
            sgst_percentage?: number;
        }> = {};
        Object.keys(cart).forEach((k) => {
            if (k.startsWith('special-')) {
                const sp = specials.find((s) => String(s.id) === k.replace('special-', ''));
                if (sp) {
                    const price = sp.special_price || (sp.items || []).reduce((s, si) => s + (si.menu_item?.price || 0) * si.quantity, 0);
                    const firstMenuItem = (sp.items || [])[0]?.menu_item;
                    const spGst = (firstMenuItem?.gst_percentage != null && !isNaN(Number(firstMenuItem.gst_percentage)))
                        ? Number(firstMenuItem.gst_percentage)
                        : (firstMenuItem?.tax_percent != null && Number(firstMenuItem.tax_percent) > 0 ? Number(firstMenuItem.tax_percent) : 5);
                    const spCgst = firstMenuItem?.cgst_percentage != null ? Number(firstMenuItem.cgst_percentage) : (spGst / 2);
                    const spSgst = firstMenuItem?.sgst_percentage != null ? Number(firstMenuItem.sgst_percentage) : (spGst / 2);

                    const subItems = (sp.items || []).map((si: any) => ({
                        menu_item_id: si.menu_item_id || si.menu_item?.id || null,
                        name: si.menu_item?.name || 'Item',
                        quantity: Number(si.quantity) || 1,
                        price: Number(si.menu_item?.price || 0),
                        image_url: si.menu_item?.image_url || getCategoryMenuItemImage(si.menu_item?.name || 'Item'),
                        item_type: si.menu_item?.item_type || (si.menu_item?.is_veg ? 'Veg' : 'Non-Veg'),
                    }));

                    cartDetails[k] = {
                        id: k,
                        name: sp.title,
                        price,
                        imageUrl: sp.image_url,
                        isSpecial: true,
                        combo_items: subItems,
                        special_type: sp.special_type || (sp.is_combo ? 'combo' : 'special'),
                        gst_percentage: spGst,
                        cgst_percentage: spCgst,
                        sgst_percentage: spSgst,
                    };
                }
            } else {
                const item = menuItems.find((i) => String(i.id) === k);
                if (item) {
                    const gst = (item.gst_percentage != null && !isNaN(Number(item.gst_percentage)))
                        ? Number(item.gst_percentage)
                        : (item.tax_percent != null && Number(item.tax_percent) > 0 ? Number(item.tax_percent) : 5);
                    const cgst = item.cgst_percentage != null ? Number(item.cgst_percentage) : (gst / 2);
                    const sgst = item.sgst_percentage != null ? Number(item.sgst_percentage) : (gst / 2);

                    cartDetails[k] = {
                        id: item.id,
                        name: item.name,
                        price: isSpecialActive(item) && item.special_price ? item.special_price : item.price,
                        imageUrl: item.image_url,
                        isSpecial: false,
                        gst_percentage: gst,
                        cgst_percentage: cgst,
                        sgst_percentage: sgst,
                    };
                }
            }
        });
        return cartDetails;
    };

    // Keep browse draft in sync for seamless table selection & floor transfer
    useEffect(() => {
        if (!isBrowse) return;
        try {
            if (Object.keys(cart).length === 0) {
                sessionStorage.removeItem(`waiter_browse_cart_${restaurantCode}`);
            } else {
                const details = buildCartDetails();
                sessionStorage.setItem(`waiter_browse_cart_${restaurantCode}`, JSON.stringify({
                    cart,
                    itemNotes,
                    cartDetails: details,
                    subtotal,
                    totalItems,
                    selectedTable,
                }));
            }
        } catch (_) {}
    }, [cart, itemNotes, isBrowse, restaurantCode, subtotal, totalItems, selectedTable]); // eslint-disable-line react-hooks/exhaustive-deps

    const openTablePicker = async () => {
        haptic.selection();
        setTablePickerOpen(true);
        if (floorTables.length === 0) {
            setLoadingTables(true);
            try {
                const data = await OrderService.fetchTables(restaurantCode);
                setFloorTables(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error(err);
                toast.error('Failed to load tables');
            } finally {
                setLoadingTables(false);
            }
        }
    };

    const handleSelectTable = (tbl: any, andProceed = false) => {
        haptic.selection();
        const selected = {
            id: tbl.id,
            table_number: tbl.table_number,
            display_name: tbl.display_name,
        };
        setSelectedTable(selected);
        const details = buildCartDetails();
        sessionStorage.setItem(`waiter_draft_order_${tbl.id}`, JSON.stringify({
            cart,
            itemNotes,
            cartDetails: details,
        }));
        sessionStorage.setItem(`waiter_browse_cart_${restaurantCode}`, JSON.stringify({
            cart,
            itemNotes,
            cartDetails: details,
            subtotal,
            totalItems,
            selectedTable: selected,
        }));
        setTablePickerOpen(false);
        toast.success(`Assigned to Table ${tbl.table_number}`);
        if (andProceed) {
            router.push(`/${restaurantCode}/waiter/${staffMobile}/cart/${tbl.id}`);
        }
    };

    /* ── Cart hand-off to review page ────────────────────────── */
    const goCart = () => {
        if (totalItems === 0) return;
        const targetTable = tableId || selectedTable?.id;
        if (!targetTable) {
            openTablePicker();
            return;
        }
        const cartDetails = buildCartDetails();
        sessionStorage.setItem(`waiter_draft_order_${targetTable}`, JSON.stringify({ cart, itemNotes, cartDetails }));
        sessionStorage.removeItem(`waiter_browse_cart_${restaurantCode}`);
        router.push(`/${restaurantCode}/waiter/${staffMobile}/cart/${targetTable}`);
    };

    if (loading && categories.length === 0 && menuItems.length === 0) {
        return (
            <div className="flex h-[calc(100vh-64px)] bg-gray-50 items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="size-10 rounded-full border-3 border-orange-500 border-t-transparent animate-spin" />
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Loading Menu...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[calc(100vh-64px)] bg-gray-50 overflow-hidden relative select-none">
            {/* ── Left Sidebar Categories (Exact Customer Panel Style) ─────────────────────────────────── */}
            <aside className="w-[72px] sm:w-20 bg-white border-r border-gray-100 flex flex-col items-center py-2.5 sm:py-3 gap-2.5 sm:gap-3 overflow-y-auto no-scrollbar z-10 shadow-[2px_0_20px_rgba(0,0,0,0.02)] shrink-0">
                <div className="flex flex-col gap-2 sm:gap-2.5 w-full items-center pb-24">
                    {/* Combos and Offers Virtual Category */}
                    <button
                        onClick={() => {
                            haptic.selection();
                            setSearch('');
                            setActiveCategory('COMBOS');
                        }}
                        id="cat-btn-COMBOS"
                        className="relative w-full flex flex-col items-center py-1.5 px-0.5 group"
                    >
                        {activeCategory === 'COMBOS' && !searching && (
                            <motion.div
                                layoutId="activeSidebarIndicator"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-orange-500 to-orange-600 shadow-[0_0_8px_rgba(255,107,53,0.6)] z-20"
                                transition={{ type: "spring", stiffness: 450, damping: 35 }}
                            />
                        )}
                        <div className="flex flex-col items-center gap-1 w-full">
                            <div className={`size-14 rounded-xl overflow-hidden flex items-center justify-center transition-all duration-300 ${
                                activeCategory === 'COMBOS' && !searching
                                    ? 'ring-2 ring-orange-500 ring-offset-1 shadow-sm scale-105'
                                    : 'bg-white border border-neutral-100 shadow-xs group-hover:shadow-md'
                            }`}>
                                {comboCategoryImage ? (
                                    <img src={comboCategoryImage} alt="Combos" className="w-full h-full object-cover" />
                                ) : (
                                    <ShoppingBag size={22} className={activeCategory === 'COMBOS' && !searching ? 'text-orange-600' : 'text-orange-500'} />
                                )}
                            </div>
                            <span className={`text-[10px] sm:text-[11px] text-center leading-tight line-clamp-2 max-w-full transition-colors duration-200 ${
                                activeCategory === 'COMBOS' && !searching ? 'text-orange-600 font-black' : 'text-black font-black uppercase'
                            }`}>
                                Combos
                            </span>
                        </div>
                    </button>

                    {/* Today Specials Virtual Category */}
                    {todaySpecials.length > 0 && (
                        <button
                            onClick={() => {
                                haptic.selection();
                                setSearch('');
                                setActiveCategory('TODAY_SPECIALS');
                            }}
                            id="cat-btn-TODAY_SPECIALS"
                            className="relative w-full flex flex-col items-center py-1.5 px-0.5 group"
                        >
                            {activeCategory === 'TODAY_SPECIALS' && !searching && (
                                <motion.div
                                    layoutId="activeSidebarIndicator"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-orange-500 to-orange-600 shadow-[0_0_8px_rgba(255,107,53,0.6)] z-20"
                                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                />
                            )}
                            <div className="flex flex-col items-center gap-1 w-full">
                                <div className={`size-14 rounded-xl overflow-hidden flex items-center justify-center transition-all duration-300 ${
                                    activeCategory === 'TODAY_SPECIALS' && !searching
                                        ? 'ring-2 ring-orange-500 ring-offset-1 shadow-sm scale-105'
                                        : 'bg-white border border-neutral-100 shadow-xs group-hover:shadow-md'
                                }`}>
                                    {specialsCategoryImage ? (
                                        <img src={specialsCategoryImage} alt="Specials" className="w-full h-full object-cover" />
                                    ) : (
                                        <Flame size={22} className={activeCategory === 'TODAY_SPECIALS' && !searching ? 'text-orange-600' : 'text-orange-500'} />
                                    )}
                                </div>
                                <span className={`text-[10px] sm:text-[11px] text-center leading-tight line-clamp-2 max-w-full transition-colors duration-200 ${
                                    activeCategory === 'TODAY_SPECIALS' && !searching ? 'text-orange-600 font-black' : 'text-black font-black uppercase'
                                }`}>
                                    Specials
                                </span>
                            </div>
                        </button>
                    )}

                    {/* Standard Categories */}
                    {categories.map((cat) => {
                        const isActive = activeCategory === cat.id && !searching;
                        const imagePath = cat.image_url || getCategoryImage(cat.name);
                        return (
                            <button
                                key={cat.id}
                                id={`cat-btn-${cat.id}`}
                                onClick={() => {
                                    haptic.selection();
                                    setSearch('');
                                    setActiveCategory(cat.id);
                                }}
                                className="relative w-full flex flex-col items-center py-1.5 px-0.5 group"
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeSidebarIndicator"
                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-gradient-to-b from-orange-500 to-orange-600 shadow-[0_0_8px_rgba(255,107,53,0.6)] z-20"
                                        transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                    />
                                )}
                                <div className="flex flex-col items-center gap-1 w-full">
                                    <div className={`size-14 rounded-xl overflow-hidden transition-all duration-300 ${
                                        isActive
                                            ? 'ring-2 ring-orange-500 ring-offset-1 shadow-sm scale-105'
                                            : 'bg-white shadow-xs border border-neutral-100 group-hover:shadow-md'
                                    }`}>
                                        <img
                                            src={imagePath}
                                            alt={cat.name}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                    <span className={`text-[10px] sm:text-[11px] text-center leading-tight line-clamp-2 max-w-full transition-colors duration-200 ${
                                        isActive ? 'text-orange-600 font-black' : 'text-black font-black uppercase'
                                    }`}>
                                        {cat.name}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* ── Main Content Area ─────────────────────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-gray-50">
                {/* Header Bar */}
                <header className="bg-white border-b border-gray-100 px-4 py-2.5 flex items-center justify-between shrink-0 shadow-xs z-20">
                    <div className="flex items-center gap-2 min-w-0">
                        {!isBrowse && (
                            <button
                                onClick={() => router.back()}
                                aria-label="Back"
                                className="size-8 rounded-full bg-gray-100 flex items-center justify-center text-slate-700 active:scale-90 transition-transform shrink-0"
                            >
                                <ChevronRight size={18} className="rotate-180" />
                            </button>
                        )}
                        <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 leading-none mb-0.5">
                                Menu
                            </p>
                            <h1 className="text-sm font-black text-black leading-tight truncate">
                                {isBrowse
                                    ? (selectedTable ? `Ordering for Table ${selectedTable.table_number}` : 'Browse Menu')
                                    : `Ordering for ${tableName || `Table ${tableId}`}`}
                            </h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {isBrowse ? (
                            <button
                                onClick={openTablePicker}
                                className={`text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap flex items-center gap-1 transition-all active:scale-95 ${
                                    selectedTable
                                        ? 'bg-orange-500 text-white shadow-sm'
                                        : 'bg-gray-100 text-slate-700 hover:bg-gray-200'
                                }`}
                            >
                                <span>{selectedTable ? `Table ${selectedTable.table_number}` : 'Select Table'}</span>
                                <ChevronDown size={13} />
                            </button>
                        ) : (
                            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap text-black bg-gray-100">
                                {tableName || `Table ${tableId}`}
                            </span>
                        )}
                    </div>
                </header>

                {/* Search & Filters (Exact Customer Panel Style) */}
                <div className="p-3.5 bg-gray-50/90 backdrop-blur-xl border-b border-gray-100/60 shrink-0 z-10">
                    {/* Search Bar */}
                    <div className="relative mb-2.5">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-black" size={16} />
                        <input
                            type="text"
                            placeholder="Search dishes..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-white rounded-xl py-2 pl-9 pr-8 text-sm font-medium text-black placeholder:text-black focus:outline-none focus:ring-2 focus:ring-orange-500/10 shadow-xs border border-gray-100"
                        />
                        {searching && (
                            <button
                                onClick={() => setSearch('')}
                                aria-label="Clear search"
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>

                    {/* Veg / Non-Veg Diet Filter Bar */}
                    <div className="flex gap-2 mb-2 bg-gray-100 p-1 rounded-xl relative z-0">
                        {(['ALL', 'Veg', 'Non-Veg'] as const).map((type) => {
                            const isActive = diet === type;
                            const filterBgColor = type === 'Veg' ? 'bg-green-600' : type === 'Non-Veg' ? 'bg-red-600' : 'bg-black';
                            return (
                                <button
                                    key={type}
                                    onClick={() => {
                                        haptic.selection();
                                        setDiet(type);
                                    }}
                                    className={`flex-1 relative py-1.5 rounded-lg text-xs font-bold transition-all z-10 ${
                                        isActive ? 'text-white' : 'text-black hover:text-black'
                                    }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="waiterDietFilter"
                                            transition={{
                                                type: "spring",
                                                stiffness: 400,
                                                damping: 35,
                                                mass: 1,
                                            }}
                                            className={`absolute inset-0 rounded-lg shadow-xs ${filterBgColor}`}
                                            style={{ zIndex: -1 }}
                                        />
                                    )}
                                    <span className="relative z-10">{type === 'ALL' ? 'All' : type}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Horizontal SubCategories Pills */}
                    {hasRealSubCats(subCategories) && (
                        <div className="flex overflow-x-auto gap-2 pb-0.5 no-scrollbar">
                            <button
                                onClick={() => {
                                    haptic.selection();
                                    setActiveSubCategory('ALL');
                                }}
                                className="relative whitespace-nowrap px-3.5 py-1 rounded-full text-xs font-bold border border-transparent z-0"
                            >
                                {activeSubCategory === 'ALL' && (
                                    <motion.div
                                        layoutId="activeSubCat"
                                        className="absolute inset-0 bg-neutral-900 rounded-full shadow-xs shadow-neutral-900/10"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        style={{ zIndex: -1 }}
                                    />
                                )}
                                <span className={`relative z-10 transition-colors duration-200 ${activeSubCategory === 'ALL' ? 'text-white' : 'text-black'}`}>
                                    All
                                </span>
                            </button>
                            {subCategories.map((sub) => (
                                <button
                                    key={sub.id}
                                    onClick={() => {
                                        haptic.selection();
                                        setActiveSubCategory(sub.id);
                                    }}
                                    className="relative whitespace-nowrap px-3.5 py-1 rounded-full text-xs font-bold border border-transparent z-0"
                                >
                                    {activeSubCategory === sub.id && (
                                        <motion.div
                                            layoutId="activeSubCat"
                                            className="absolute inset-0 bg-neutral-900 rounded-full shadow-xs shadow-neutral-900/10"
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            style={{ zIndex: -1 }}
                                        />
                                    )}
                                    <span className={`relative z-10 transition-colors duration-200 ${activeSubCategory === sub.id ? 'text-white' : 'text-black'}`}>
                                        {sub.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Scrollable Menu Dish List ─────────────────────────────────────────────────────── */}
                <main className="flex-1 overflow-y-auto p-2.5 sm:p-3.5 pt-2 pb-36 space-y-2.5 sm:space-y-3 relative z-0 min-w-0">
                    {searching ? (
                        (searchResults.length === 0 && matchingCombos.length === 0) ? (
                            <div className="text-center py-16">
                                <div className="inline-block p-4 rounded-full bg-gray-100 mb-3">
                                    <UtensilsCrossed className="text-black" size={24} />
                                </div>
                                <p className="text-black font-bold">No dishes found</p>
                                <p className="text-xs text-gray-400 mt-1">No items matched &ldquo;{search}&rdquo;</p>
                            </div>
                        ) : (
                            <>
                                {matchingCombos.map((special) => {
                                    const key = `special-${special.id}`;
                                    return (
                                        <WaiterComboCard
                                            key={special.id}
                                            special={special}
                                            qty={getItemQty(key)}
                                            hasNote={Boolean(itemNotes[key])}
                                            onAdd={() => updateQty(key, 1)}
                                            onRemove={() => updateQty(key, -1)}
                                            onCustomize={() => setCustomizing({ id: key, name: special.title })}
                                        />
                                    );
                                })}
                                {searchResults.map((item) => (
                                    <WaiterDishCard
                                        key={item.id}
                                        item={item}
                                        qty={getItemQty(item.id)}
                                        hasNote={Boolean(itemNotes[String(item.id)])}
                                        onAdd={() => updateQty(item.id, 1)}
                                        onRemove={() => updateQty(item.id, -1)}
                                        onCustomize={() => setCustomizing({ id: String(item.id), name: item.name })}
                                    />
                                ))}
                            </>
                        )
                    ) : activeCategory === 'COMBOS' ? (
                        (() => {
                            const combosToDisplay = (comboOffers.length > 0 ? comboOffers : specials).filter((special) => {
                                if (diet === 'ALL') return true;
                                const items = special.items || [];
                                const isVeg = items.length > 0 && items.every(si => {
                                    const it = si.menu_item;
                                    return it?.item_type === 'Veg' || (it as any)?.is_veg === true;
                                });
                                if (diet === 'Veg') return isVeg;
                                if (diet === 'Non-Veg') return !isVeg;
                                return true;
                            });

                            if (combosToDisplay.length === 0) {
                                return (
                                    <div className="text-center py-16">
                                        <div className="inline-block p-4 rounded-full bg-gray-100 mb-3">
                                            <UtensilsCrossed className="text-black" size={24} />
                                        </div>
                                        <p className="text-black font-bold">No Combos Available</p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {diet !== 'ALL' ? 'No combos match the selected diet filter' : 'Check back later for exciting offers'}
                                        </p>
                                    </div>
                                );
                            }

                            return combosToDisplay.map((special) => {
                                const key = `special-${special.id}`;
                                return (
                                    <WaiterComboCard
                                        key={special.id}
                                        special={special}
                                        qty={getItemQty(key)}
                                        hasNote={Boolean(itemNotes[key])}
                                        onAdd={() => updateQty(key, 1)}
                                        onRemove={() => updateQty(key, -1)}
                                        onCustomize={() => setCustomizing({ id: key, name: special.title })}
                                    />
                                );
                            });
                        })()
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-16">
                            <div className="inline-block p-4 rounded-full bg-gray-100 mb-3">
                                <UtensilsCrossed className="text-black" size={24} />
                            </div>
                            <p className="text-black font-bold">No dishes found</p>
                            <p className="text-xs text-gray-400 mt-1">Try changing category or veg filter.</p>
                        </div>
                    ) : (
                        filteredItems.map((item) => (
                            <WaiterDishCard
                                key={item.id}
                                item={item}
                                qty={getItemQty(item.id)}
                                hasNote={Boolean(itemNotes[String(item.id)])}
                                onAdd={() => updateQty(item.id, 1)}
                                onRemove={() => updateQty(item.id, -1)}
                                onCustomize={() => setCustomizing({ id: String(item.id), name: item.name })}
                            />
                        ))
                    )}
                </main>
            </div>

            {/* ── Modern Floating Cart Bar ────────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {totalItems > 0 && (
                    <motion.div
                        initial={{ y: 90, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 90, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="fixed bottom-[68px] left-0 right-0 max-w-md mx-auto z-40 px-3.5"
                    >
                        <div className="bg-neutral-900 text-white rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3 border border-neutral-800">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded-xl bg-orange-500 flex items-center justify-center text-white shrink-0 font-black text-sm shadow-md shadow-orange-500/30">
                                    {totalItems}
                                </div>
                                <div className="min-w-0">
                                    <button
                                        type="button"
                                        onClick={openTablePicker}
                                        className="text-[10px] font-black text-gray-400 hover:text-white uppercase tracking-wider leading-none flex items-center gap-1 transition-colors text-left"
                                    >
                                        <span>{isBrowse ? (selectedTable ? `Table ${selectedTable.table_number}` : 'Table not selected') : tableName || `Table ${tableId}`}</span>
                                        {isBrowse && <span className="text-orange-400 underline font-bold lowercase text-[10px]">({selectedTable ? 'change' : 'choose'})</span>}
                                    </button>
                                    <p className="text-base font-black text-white leading-tight mt-0.5">
                                        ₹{subtotal.toLocaleString('en-IN')}
                                    </p>
                                </div>
                            </div>
                            {isBrowse && !selectedTable ? (
                                <button
                                    onClick={openTablePicker}
                                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-black shadow-md shadow-orange-500/30 active:scale-95 transition-all flex items-center gap-1 shrink-0"
                                >
                                    Select Table <ChevronRight size={14} />
                                </button>
                            ) : (
                                <button
                                    onClick={goCart}
                                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-black shadow-md shadow-orange-500/30 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                                >
                                    <ShoppingBag size={15} /> View Cart & Order
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Customization Modal ─────────────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {customizing && (
                    <WaiterCustomizationSheet
                        itemName={customizing.name}
                        initialNote={itemNotes[customizing.id] || ''}
                        onSave={(note) => {
                            setItemNotes((prev) => ({ ...prev, [customizing.id]: note }));
                            setCustomizing(null);
                        }}
                        onClose={() => setCustomizing(null)}
                    />
                )}
            </AnimatePresence>

            {/* ── Table Selection Modal for Browse Mode ───────────────────────────────────────────── */}
            <TablePickerSheet
                open={tablePickerOpen}
                tables={floorTables}
                loading={loadingTables}
                selectedTableId={selectedTable?.id}
                totalItems={totalItems}
                subtotal={subtotal}
                onSelectTable={handleSelectTable}
                onClose={() => setTablePickerOpen(false)}
            />
        </div>
    );
}

/* ── Customer-Style Dish Card Component ─────────────────────────────────────────────────────── */
function WaiterDishCard({
    item,
    qty,
    hasNote,
    onAdd,
    onRemove,
    onCustomize,
}: {
    item: MenuItem;
    qty: number;
    hasNote: boolean;
    onAdd: () => void;
    onRemove: () => void;
    onCustomize: () => void;
}) {
    const isSpecial = isSpecialActive(item);
    const itemType = item.item_type || (item.is_veg ? 'Veg' : 'Non-Veg');

    return (
        <div className="bg-white rounded-2xl p-2.5 sm:p-3 shadow-xs border border-gray-100 flex gap-2.5 sm:gap-3 transform transition-all active:scale-[0.99] overflow-hidden">
            {/* Item Image */}
            <div className="size-20 sm:size-24 bg-gray-50 rounded-xl shrink-0 flex items-center justify-center relative overflow-hidden">
                <img
                    src={item.image_url || getCategoryMenuItemImage(item.name)}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                />
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div>
                    <div className="flex items-start justify-between gap-1.5">
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="font-bold text-black text-sm sm:text-base leading-tight line-clamp-2">{item.name}</h3>
                                {isSpecial && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 text-[8px] font-black uppercase tracking-wider shrink-0">
                                        Special
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* Veg / Non-Veg dot badge */}
                        <div className={`mt-0.5 size-2.5 rounded-full shrink-0 border-[1.5px] p-[1.5px] ${
                            itemType === 'Veg' ? 'border-green-600' :
                            itemType === 'Non-Veg' ? 'border-red-600' :
                            itemType === 'Egg' ? 'border-yellow-600' : 'border-black'
                        }`}>
                            <div className={`w-full h-full rounded-full ${
                                itemType === 'Veg' ? 'bg-green-600' :
                                itemType === 'Non-Veg' ? 'bg-red-600' :
                                itemType === 'Egg' ? 'bg-yellow-600' : 'bg-black'
                            }`} />
                        </div>
                    </div>

                    {item.description && (
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                    )}

                    {qty > 0 && (
                        <button
                            onClick={onCustomize}
                            className="text-[10px] sm:text-[10.5px] font-black text-orange-600 mt-1 underline underline-offset-2 flex items-center gap-1"
                        >
                            Customizable options {hasNote && '✓ Note added'}
                        </button>
                    )}
                </div>

                <div className="flex items-end justify-between gap-1.5 mt-2 shrink-0">
                    <div className="flex flex-col min-w-0">
                        {isSpecial && item.special_price ? (
                            <div className="flex flex-col leading-tight">
                                <span className="font-black text-black text-sm sm:text-base leading-tight">₹{item.special_price}</span>
                                {item.price > item.special_price && (
                                    <span className="text-[10px] sm:text-xs text-gray-400 line-through leading-tight">₹{item.price}</span>
                                )}
                            </div>
                        ) : (
                            <p className="font-black text-black text-sm sm:text-base leading-tight">₹{item.price ?? 0}</p>
                        )}
                    </div>

                    {/* Stepper or Add button */}
                    {qty > 0 ? (
                        <div className="flex items-center bg-gray-100 rounded-xl p-0.5 sm:p-1 gap-1 sm:gap-1.5 shrink-0">
                            <button
                                onClick={onRemove}
                                aria-label="Decrease quantity"
                                className="size-6 sm:size-7 rounded-lg bg-white shadow-xs flex items-center justify-center text-black font-bold active:scale-95 transition-all shrink-0"
                            >
                                <Minus size={13} />
                            </button>
                            <span className="text-xs sm:text-sm font-black text-black min-w-3.5 sm:min-w-4 text-center px-0.5">{qty}</span>
                            <button
                                onClick={onAdd}
                                aria-label="Increase quantity"
                                className="size-6 sm:size-7 rounded-lg bg-white shadow-xs flex items-center justify-center text-black font-bold active:scale-95 transition-all shrink-0"
                            >
                                <Plus size={13} />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onAdd}
                            className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-black shadow-md shadow-orange-500/25 active:scale-95 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap"
                        >
                            <Plus size={13} /> ADD
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ── Redesigned Waiter Combo Card Component ─────────────────────────────────────────────────── */
function WaiterComboCard({
    special,
    qty,
    hasNote,
    onAdd,
    onRemove,
    onCustomize,
}: {
    special: TodaySpecial;
    qty: number;
    hasNote: boolean;
    onAdd: () => void;
    onRemove: () => void;
    onCustomize: () => void;
}) {
    const items = special.items || [];
    const comboTotal = items.reduce((s, si) => s + (si.menu_item?.price || 0) * (si.quantity || 1), 0);
    const price = special.special_price || comboTotal;
    const savings = comboTotal > price ? comboTotal - price : 0;

    // Diet type logic (Veg / Non-Veg / Egg)
    const isVeg = items.length > 0 && items.every(si => {
        const it = si.menu_item;
        return it?.item_type === 'Veg' || (it as any)?.is_veg === true;
    });
    const hasEgg = !isVeg && items.some(si => si.menu_item?.item_type === 'Egg');
    const dietType = isVeg ? 'Veg' : (hasEgg ? 'Egg' : 'Non-Veg');

    // Hero Image resolution
    const firstItemImage = items.find(si => si.menu_item?.image_url)?.menu_item?.image_url;
    const heroImage = special.image_url || firstItemImage || getCategoryMenuItemImage(special.title);

    return (
        <div className="bg-white rounded-2xl p-2.5 sm:p-3.5 shadow-xs border border-gray-100 flex flex-col gap-2.5 transition-all hover:border-gray-200 overflow-hidden">
            {/* Top Row: Hero Thumbnail + Info */}
            <div className="flex gap-2.5 sm:gap-3 items-start">
                {/* Combo Image with optional Save tag */}
                <div className="size-20 sm:size-22 bg-gray-50 rounded-xl shrink-0 relative overflow-hidden border border-gray-100">
                    <img
                        src={heroImage}
                        alt={special.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                            e.currentTarget.src = getCategoryMenuItemImage(special.title);
                        }}
                    />
                    {savings > 0 && (
                        <div className="absolute top-1 left-1 bg-emerald-600/95 backdrop-blur-xs text-white text-[8px] sm:text-[8.5px] font-black px-1.5 py-0.5 rounded shadow-xs uppercase tracking-wider">
                            Save ₹{savings}
                        </div>
                    )}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="font-bold text-black text-sm sm:text-base leading-tight truncate">
                                    {special.title}
                                </h3>
                                <span className="px-1.5 py-0.5 rounded bg-orange-100/90 text-orange-700 text-[8.5px] font-black uppercase tracking-wider shrink-0">
                                    COMBO
                                </span>
                            </div>
                        </div>

                        {/* Veg / Non-Veg dot badge */}
                        <div className={`mt-0.5 size-2.5 rounded-full shrink-0 border-[1.5px] p-[1.5px] ${
                            dietType === 'Veg' ? 'border-green-600' :
                            dietType === 'Non-Veg' ? 'border-red-600' : 'border-yellow-600'
                        }`}>
                            <div className={`w-full h-full rounded-full ${
                                dietType === 'Veg' ? 'bg-green-600' :
                                dietType === 'Non-Veg' ? 'bg-red-600' : 'bg-yellow-600'
                            }`} />
                        </div>
                    </div>

                    {special.description ? (
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                            {special.description}
                        </p>
                    ) : (
                        <p className="text-[10.5px] text-neutral-400 mt-0.5 font-medium">
                            {items.length} items bundled together
                        </p>
                    )}

                    {/* Instruction note trigger when in cart */}
                    {qty > 0 && (
                        <button
                            onClick={onCustomize}
                            className="text-[10px] sm:text-[10.5px] font-black text-orange-600 mt-1.5 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
                        >
                            Special instructions {hasNote && '✓ Note added'}
                        </button>
                    )}
                </div>
            </div>

            {/* Included Items Breakdown (Sleek, Compact, Beautiful) */}
            {items.length > 0 && (
                <div className="bg-neutral-50/80 rounded-xl p-2 sm:p-2.5 border border-neutral-100">
                    <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400">
                            Includes ({items.length} Dishes)
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {items.map((si, idx) => {
                            if (!si.menu_item) return null;
                            const itemImg = si.menu_item.image_url || getCategoryMenuItemImage(si.menu_item.name);
                            const isItemVeg = si.menu_item.item_type === 'Veg' || (si.menu_item as any).is_veg === true;

                            return (
                                <div
                                    key={si.id || `si-${idx}`}
                                    className="flex items-center gap-2 bg-white p-1.5 rounded-lg border border-neutral-200/60 shadow-2xs"
                                >
                                    <div className="size-7 sm:size-8 rounded-md bg-neutral-100 overflow-hidden shrink-0 border border-neutral-100">
                                        <img
                                            src={itemImg}
                                            alt={si.menu_item.name}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            onError={(e) => {
                                                e.currentTarget.src = getCategoryMenuItemImage(si.menu_item?.name || '');
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-1">
                                        <div className="flex items-center gap-1">
                                            <div className={`size-1.5 rounded-full shrink-0 ${isItemVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                                            <p className="text-[11px] sm:text-xs font-bold text-neutral-800 truncate leading-snug">
                                                {si.menu_item.name}
                                            </p>
                                        </div>
                                        <p className="text-[10px] text-neutral-400 font-medium pl-2.5">
                                            ₹{si.menu_item.price} each
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-black text-neutral-700 bg-neutral-100 px-1.5 py-0.5 rounded shrink-0">
                                        {si.quantity}x
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Price & Action Row */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-neutral-100">
                <div className="flex items-baseline gap-2">
                    <span className="font-black text-black text-base sm:text-lg tracking-tight">
                        ₹{price}
                    </span>
                    {savings > 0 && (
                        <span className="text-xs text-gray-400 line-through font-semibold">
                            ₹{comboTotal}
                        </span>
                    )}
                </div>

                {qty > 0 ? (
                    <div className="flex items-center bg-gray-100 rounded-xl p-0.5 sm:p-1 gap-1 sm:gap-1.5 shrink-0">
                        <button
                            onClick={onRemove}
                            aria-label="Decrease quantity"
                            className="size-6 sm:size-7 rounded-lg bg-white shadow-xs flex items-center justify-center text-black font-bold active:scale-95 transition-all shrink-0 cursor-pointer"
                        >
                            <Minus size={13} />
                        </button>
                        <span className="text-xs sm:text-sm font-black text-black min-w-3.5 sm:min-w-4 text-center px-0.5">
                            {qty}
                        </span>
                        <button
                            onClick={onAdd}
                            aria-label="Increase quantity"
                            className="size-6 sm:size-7 rounded-lg bg-white shadow-xs flex items-center justify-center text-black font-bold active:scale-95 transition-all shrink-0 cursor-pointer"
                        >
                            <Plus size={13} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={onAdd}
                        className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-black shadow-md shadow-orange-500/25 active:scale-95 transition-all flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                    >
                        <Plus size={13} /> ADD
                    </button>
                )}
            </div>
        </div>
    );
}

/* ── Customization Sheet ─────────────────────────────────────────────────────────────────────── */
function WaiterCustomizationSheet({
    itemName,
    initialNote,
    onSave,
    onClose,
}: {
    itemName: string;
    initialNote: string;
    onSave: (note: string) => void;
    onClose: () => void;
}) {
    const [note, setNote] = useState(initialNote);

    return (
        <div className="fixed inset-0 z-[80] flex items-end justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose} />
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                className="relative w-full max-w-md bg-white rounded-t-3xl p-5 safe-bottom shadow-2xl border-t border-gray-100"
            >
                <div className="flex justify-center mb-3">
                    <span className="w-10 h-1.5 rounded-full bg-gray-200" />
                </div>
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-black text-black truncate">{itemName}</h3>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-black">
                        <X size={18} />
                    </button>
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Special instructions</p>
                <div className="flex flex-wrap gap-2 mb-3">
                    {QUICK_NOTES.map((q) => (
                        <button
                            key={q}
                            onClick={() => {
                                haptic.light();
                                setNote((n) => (n ? `${n}, ${q}` : q));
                            }}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 text-slate-700 active:scale-95 transition-transform hover:bg-gray-200"
                        >
                            {q}
                        </button>
                    ))}
                </div>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    placeholder="e.g. Less salt, packing separately..."
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none font-semibold text-slate-800 placeholder:text-gray-400 bg-gray-50 border border-gray-200 focus:border-orange-500"
                />
                <button
                    className="w-full mt-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm shadow-md shadow-orange-500/25 active:scale-95 transition-all"
                    onClick={() => onSave(note.trim())}
                >
                    Save Instruction
                </button>
            </motion.div>
        </div>
    );
}
