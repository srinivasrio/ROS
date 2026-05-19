'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getCategoryMenuItemImage } from '@/app/lib/utils';
import { OrderService } from '@/app/services/orders';
import { MenuService, Category, SubCategory, MenuItem } from '@/app/services/menu';
import { UserService } from '@/app/services/users';
import { Utensils as LucideUtensils, Coffee as LucideCoffee, IceCream as LucideIceCream, GlassWater as LucideGlassWater, Citrus as LucideCitrus, Search as LucideSearch, Flame as LucideFlame } from 'lucide-react';
import { motion } from 'framer-motion';
import { SpecialsService, TodaySpecial } from '@/app/services/specials.service';

export default function WaiterMenuSelection() {
    const params = useParams();
    const router = useRouter();
    const tableId = typeof params.tableId === 'string' ? params.tableId : '';
    const staffMobile = params.staffMobile as string;

    const [categories, setCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [activeCategory, setActiveCategory] = useState<number | string | null>(null);
    const [specials, setSpecials] = useState<TodaySpecial[]>([]);
    const [activeSubCategory, setActiveSubCategory] = useState<number | 'ALL'>('ALL');
    const [activeTypeFilter, setActiveTypeFilter] = useState<'ALL' | 'Veg' | 'Non-Veg'>('ALL');
    const [cart, setCart] = useState<Record<string, number>>({});
    const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [tableName, setTableName] = useState<string>(`Table ${tableId}`);
    const [isVegMode, setIsVegMode] = useState(false); // Global Veg Mode

    useEffect(() => {
        const loadData = async () => {
            try {
                // If tableId is a UUID, we need to fetch the group name
                let resolvedName = `Table ${tableId}`;
                const tableData = await OrderService.findTableAnywhere(tableId, params.restaurantCode as string);
                
                if (tableData) {
                    if (tableData.display_name) {
                        resolvedName = tableData.display_name;
                    } else if (tableData.table_number) {
                        resolvedName = `Table ${tableData.table_number}`;
                    }
                }
                setTableName(resolvedName);

                const [cats, items, specialsData] = await Promise.all([
                    MenuService.fetchCategories(params.restaurantCode as string),
                    MenuService.fetchMenuItems(params.restaurantCode as string),
                    SpecialsService.fetchActiveSpecials(params.restaurantCode as string)
                ]);
                setCategories(cats);
                setMenuItems(items);
                setSpecials(specialsData);
                if (specialsData.length > 0 && !activeCategory) {
                    setActiveCategory('SPECIALS');
                } else if (cats.length > 0 && !activeCategory) {
                    setActiveCategory(cats[0].id);
                }
            } catch (error) {
                console.error('Failed to load menu data:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();

        // Subscribe to Menu Changes (Price updates, Availability)
        const sub = OrderService.subscribeToMenuItems(params.restaurantCode as string, () => loadData());

        return () => {
            sub.unsubscribe();
        };
    }, []);

    // Load subcategories when activeCategory changes
    useEffect(() => {
        if (!activeCategory || typeof activeCategory === 'string') {
            setSubCategories([]);
            return;
        }

        const loadSubs = async () => {
            try {
                const subs = await MenuService.fetchSubCategories(activeCategory, params.restaurantCode as string);
                setSubCategories(subs);
                setActiveSubCategory('ALL');
            } catch (e) {
                console.error(e);
            }
        }
        loadSubs();
    }, [activeCategory]);


    const getItemQty = (id: number | string) => cart[String(id)] || 0;

    const updateQty = (id: number | string, delta: number) => {
        const strId = String(id);
        setCart(prev => {
            const newQty = (prev[strId] || 0) + delta;
            if (newQty <= 0) {
                const { [strId]: _, ...rest } = prev;
                setItemNotes(prevNotes => {
                    const { [strId]: __, ...restNotes } = prevNotes;
                    return restNotes;
                });
                return rest;
            }
            return { ...prev, [strId]: newQty };
        });
    };

    const updateNote = (id: number | string, note: string) => {
        setItemNotes(prev => ({ ...prev, [String(id)]: note }));
    };

    const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
    const subtotal = Object.entries(cart).reduce((sum, [idStr, qty]) => {
        if (idStr.startsWith('special-')) {
            const specialId = idStr.replace('special-', '');
            const special = specials.find(s => s.id === specialId);
            const price = special?.special_price || (special?.items || []).reduce((s, si) => s + (si.menu_item?.price || 0) * si.quantity, 0);
            return sum + (price * qty);
        }
        const item = menuItems.find(i => i.id === Number(idStr));
        return sum + (item ? item.price * qty : 0);
    }, 0);

    const filteredItems = menuItems.filter(item => {
        const matchesCategory = item.category_id === activeCategory;
        const matchesSubCategory = activeSubCategory === 'ALL' || item.sub_category_id === activeSubCategory;

        const fallbackType = item.item_type || (item.is_veg ? 'Veg' : 'Non-Veg');
        const effectiveFilter = isVegMode ? 'Veg' : activeTypeFilter;
        const typeMatch = effectiveFilter === 'ALL'
            || fallbackType === effectiveFilter
            || (effectiveFilter === 'Non-Veg' && fallbackType === 'Egg');

        return matchesCategory && matchesSubCategory && item.is_available && item.active !== false && typeMatch;
    });

    const handlePlaceOrder = async () => {
        if (totalItems === 0) return;
        setSubmitting(true);
        try {
            const orderItems = Object.entries(cart).map(([idStr, qty]) => {
                if (idStr.startsWith('special-')) {
                    const specialId = idStr.replace('special-', '');
                    const special = specials.find(s => s.id === specialId);
                    const isCombo = special?.is_combo || false;
                    return {
                        menu_item_id: null,
                        quantity: qty,
                        price: special?.special_price || (special?.items || []).reduce((s, si) => s + (si.menu_item?.price || 0) * si.quantity, 0),
                        notes: itemNotes[idStr] || '',
                        item_type: isCombo ? 'combo' : 'special',
                        combo_name: special?.title,
                        combo_id: special?.id,
                        combo_items: special?.items || [],
                        combo_image: special?.image_url,
                        combo_price: special?.special_price || (special?.items || []).reduce((s, si) => s + (si.menu_item?.price || 0) * si.quantity, 0)
                    };
                }

                const item = menuItems.find(i => i.id === Number(idStr));
                return {
                    menu_item_id: Number(idStr),
                    quantity: qty,
                    price: item?.price || 0,
                    notes: itemNotes[idStr] || ''
                };
            });

            const idParam = isNaN(Number(tableId)) ? tableId : Number(tableId);

            const sessionStr = localStorage.getItem('waiterSession');
            let waiterId = undefined;
            if (sessionStr) {
                try {
                    const session = JSON.parse(sessionStr);
                    waiterId = session.id;
                } catch (e) {
                    console.error("Failed to parse waiter session", e);
                }
            }

            await OrderService.createOrder(idParam, orderItems, params.restaurantCode as string, 'placed', waiterId);
            // alert('Order Sent to Kitchen!'); // Removed alert for smoother flow? Or keep it? User didn't specify. Keeping for feedback.
            setCart({});
            setItemNotes({});
            router.push(`/${params.restaurantCode}/waiter/${staffMobile}/dashboard`);
        } catch (error) {
            console.error(error);
            const msg = error instanceof Error ? error.message : JSON.stringify(error);
            alert(`Failed to place order: ${msg}`);
        } finally {
            setSubmitting(false);
        }
    };

    // Helper to get icon for category (basic mapping or default)
    const getCategoryIcon = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('drink') || n.includes('beverage')) return <LucideGlassWater size={24} />;
        if (n.includes('desert') || n.includes('sweet') || n.includes('ice')) return <LucideIceCream size={24} />;
        if (n.includes('tea') || n.includes('coffee')) return <LucideCoffee size={24} />;
        return <LucideUtensils size={24} />;
    };

    if (loading) {
        return <div className="flex items-center justify-center h-screen text-black">Loading Menu...</div>;
    }

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Header */}
            <header className="flex items-center bg-white p-4 pb-2 border-b border-gray-100 shrink-0 sticky top-0 z-30">
                <button onClick={() => router.back()} className="mr-3">
                    <span className="material-icons-outlined text-charcoal text-2xl">arrow_back_ios</span>
                </button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold text-charcoal leading-none">{tableName}</h1>
                    <p className="text-xs text-black font-medium">Ordering</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${isVegMode ? 'text-green-600' : 'text-black'}`}>Veg</span>
                    <button
                        onClick={() => setIsVegMode(!isVegMode)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 ${isVegMode ? 'bg-green-500' : 'bg-neutral-200'}`}
                    >
                        <span className={`inline-block size-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${isVegMode ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Categories */}
                <aside className="w-20 bg-gray-50 flex flex-col items-center py-4 gap-6 overflow-y-auto shrink-0 no-scrollbar">
                    {/* Today Special Virtual Category */}
                    {specials.length > 0 && (
                        <button
                            onClick={() => setActiveCategory('SPECIALS')}
                            className="relative w-[72px] flex flex-col items-center z-0 group"
                        >
                            {activeCategory === 'SPECIALS' && (
                                <motion.div
                                    layoutId="waiterActiveSidebar"
                                    className="absolute inset-0 bg-gradient-to-b from-amber-400 to-orange-500 rounded-2xl shadow-lg shadow-orange-400/25"
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                            )}
                            <div className="relative z-10 flex flex-col items-center gap-1 py-2.5 px-1">
                                <div className={`size-14 rounded-xl flex items-center justify-center transition-all duration-300 ${activeCategory === 'SPECIALS' ? 'bg-white/20 ring-[2.5px] ring-white/90 shadow-md' : 'bg-gradient-to-br from-amber-100 to-orange-100 shadow-sm group-hover:shadow-md group-hover:scale-105'}`}>
                                    <LucideFlame size={24} className={activeCategory === 'SPECIALS' ? 'text-white' : 'text-orange-500'} />
                                </div>
                                <span className={`text-[10px] font-bold text-center leading-tight line-clamp-2 max-w-full transition-colors duration-300 ${activeCategory === 'SPECIALS' ? 'text-white' : 'text-black group-hover:text-black'}`}>
                                    Today Special
                                </span>
                            </div>
                        </button>
                    )}
                    {categories.map(cat => {
                        const isActive = activeCategory === cat.id;
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setActiveCategory(cat.id)}
                                className="relative w-[72px] flex flex-col items-center z-0 group"
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="waiterActiveSidebar"
                                        className="absolute inset-0 bg-gradient-to-b from-orange-400 to-orange-500 rounded-2xl shadow-lg shadow-orange-400/25"
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    />
                                )}

                                <div className="relative z-10 flex flex-col items-center gap-1 py-2.5 px-1">
                                    <div className={`size-14 rounded-xl overflow-hidden transition-all duration-300 ${isActive ? 'ring-[2.5px] ring-white/90 shadow-md' : 'shadow-sm group-hover:shadow-md group-hover:scale-105'}`}>
                                        <img
                                            src={cat.image_url || getCategoryMenuItemImage(cat.name)}
                                            alt={cat.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <span className={`text-[10px] font-bold text-center leading-tight line-clamp-2 max-w-full transition-colors duration-200 ${isActive ? 'text-white' : 'text-black group-hover:text-black'}`}>
                                        {cat.name}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-4 pb-32">
                    <div className="flex flex-col gap-4 mb-4">
                        <h2 className="text-xs font-bold text-black uppercase tracking-widest">
                            {categories.find(c => c.id === activeCategory)?.name}
                        </h2>

                        {/* Veg / Non-Veg Filter */}
                        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl relative z-0">
                            {(['ALL', 'Veg', 'Non-Veg'] as const).map(type => {
                                const isActive = isVegMode ? type === 'Veg' : activeTypeFilter === type;
                                const isForcedDisabled = isVegMode && type === 'Non-Veg';
                                const waiterFilterBgColor = type === 'Veg' ? 'bg-green-600' : type === 'Non-Veg' ? 'bg-red-600' : 'bg-neutral-900';

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
                                                layoutId="waiterTypeFilter"
                                                className={`absolute inset-0 rounded-lg shadow-sm ${waiterFilterBgColor}`}
                                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                                style={{ zIndex: -1 }}
                                            />
                                        )}
                                        <span className="relative z-10">{type === 'ALL' ? 'All' : type}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Subcategories - Hide if only diet-type names */}
                        {(() => {
                            const dietNames = new Set(['general', 'veg', 'non-veg', 'nonveg', 'egg']);
                            const hasRealSubCats = subCategories.length > 0 && subCategories.some(s => !dietNames.has(s.name.toLowerCase()));
                            return hasRealSubCats;
                        })() && (
                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4">
                                    <button
                                        onClick={() => setActiveSubCategory('ALL')}
                                        className="relative whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-transparent z-0"
                                    >
                                        {activeSubCategory === 'ALL' && (
                                            <motion.div
                                                layoutId="waiterActiveSubCat"
                                                className="absolute inset-0 bg-neutral-900 rounded-full shadow-md"
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
                                            className="relative whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-transparent z-0"
                                        >
                                            {activeSubCategory === sub.id && (
                                                <motion.div
                                                    layoutId="waiterActiveSubCat"
                                                    className="absolute inset-0 bg-neutral-900 rounded-full shadow-md"
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

                    <div className="space-y-3">
                        {activeCategory === 'SPECIALS' ? (
                            specials.length === 0 ? (
                                <div className="text-center py-10 text-black text-sm">No specials today.</div>
                            ) : (
                                specials.map(special => (
                                    <div key={special.id} className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200/50">
                                        <div className="flex items-center gap-2 mb-2">
                                            <LucideFlame className="text-orange-500" size={16} />
                                            <h3 className="font-bold text-charcoal text-sm">{special.title}</h3>
                                            {special.is_combo && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[9px] font-bold uppercase rounded">Combo</span>}
                                        </div>
                                        {special.special_price && (
                                            <p className="text-sm font-bold text-orange-600 mb-2">₹{special.special_price} <span className="text-xs text-black line-through">₹{(special.items || []).reduce((s, si) => s + (si.menu_item?.price || 0) * si.quantity, 0)}</span></p>
                                        )}
                                        <div className="space-y-2">
                                            {(special.items || []).map((si, idx) => si.menu_item && (
                                                <div key={`${special.id}-${si.id || si.menu_item_id || idx}`} className="bg-white rounded-lg p-3 flex items-center gap-3 border border-gray-100">
                                                    <div className="size-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                                        {si.menu_item.image_url ? (
                                                            <img src={si.menu_item.image_url} alt={si.menu_item.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center text-black">
                                                                <LucideUtensils size={14} />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-charcoal text-sm">{si.menu_item.name} {si.quantity > 1 ? `×${si.quantity}` : ''}</h4>
                                                        <p className="text-xs text-black">₹{si.menu_item.price}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {/* Special/Combo Controls */}
                                        {getItemQty(`special-${special.id}`) > 0 ? (
                                            <div className="mt-3 flex items-center justify-between bg-neutral-900 rounded-xl p-1 shadow-lg shadow-neutral-900/20">
                                                <button onClick={() => updateQty(`special-${special.id}`, -1)} className="flex-1 py-2 text-white hover:bg-white/20 rounded-lg font-bold flex items-center justify-center"><span className="material-icons-outlined text-sm">remove</span></button>
                                                <span className="w-12 text-center text-white font-bold text-sm">{getItemQty(`special-${special.id}`)}</span>
                                                <button onClick={() => updateQty(`special-${special.id}`, 1)} className="flex-1 py-2 text-white hover:bg-white/20 rounded-lg font-bold flex items-center justify-center"><span className="material-icons-outlined text-sm">add</span></button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => updateQty(`special-${special.id}`, 1)}
                                                className="mt-3 w-full py-2.5 bg-orange-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-600 active:scale-95 transition-all flex items-center justify-center gap-2"
                                            >
                                                <span className="material-icons-outlined text-sm">add_shopping_cart</span>
                                                Add {special.is_combo ? 'Combo' : 'Special'} — ₹{special.special_price || (special.items || []).reduce((s, si) => s + (si.menu_item?.price || 0) * si.quantity, 0)}
                                            </button>
                                        )}
                                    </div>
                                ))
                            )
                        ) : filteredItems.length === 0 ? (
                            <div className="text-center py-10 text-black text-sm">
                                No items available in this category.
                            </div>
                        ) : (
                            filteredItems.map(item => (
                                <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center justify-between">
                                    <div className="flex gap-3">
                                        {/* Image Thumbnail */}
                                        <div className="size-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                            {item.image_url ? (
                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-black">
                                                    <LucideUtensils size={16} />
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                {item.item_type === 'Veg' && <div className="w-3 h-3 border border-green-600 flex items-center justify-center p-[1px]"><div className="w-full h-full bg-green-600 rounded-full"></div></div>}
                                                {item.item_type === 'Non-Veg' && <div className="w-3 h-3 border border-red-600 flex items-center justify-center p-[1px]"><div className="w-full h-full bg-red-600 rounded-full"></div></div>}
                                                {item.item_type === 'Egg' && <div className="w-3 h-3 border border-yellow-600 flex items-center justify-center p-[1px]"><div className="w-full h-full bg-yellow-600 rounded-full"></div></div>}
                                                <h3 className="font-bold text-charcoal text-sm">{item.name}</h3>
                                            </div>
                                            <p className="text-sm font-bold text-black">₹{item.price.toLocaleString()}</p>
                                            {item.description && <p className="text-xs text-black mt-1 line-clamp-1">{item.description}</p>}
                                        </div>
                                    </div>

                                    {getItemQty(item.id) > 0 ? (
                                        <div className="flex flex-col items-end gap-2">
                                            <div className="flex items-center bg-gray-100 rounded-full p-1">
                                                <button
                                                    onClick={() => updateQty(item.id, -1)}
                                                    className="size-8 rounded-full bg-charcoal text-white flex items-center justify-center shadow-sm active:scale-95 transition-transform"
                                                >
                                                    <span className="material-icons-outlined text-sm">remove</span>
                                                </button>
                                                <span className="w-8 text-center font-bold text-charcoal text-sm">{getItemQty(item.id)}</span>
                                                <button
                                                    onClick={() => updateQty(item.id, 1)}
                                                    className="size-8 rounded-full bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-200 active:scale-95 transition-transform"
                                                >
                                                    <span className="material-icons-outlined text-sm">add</span>
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Note..."
                                                value={itemNotes[item.id] || ''}
                                                onChange={(e) => updateNote(item.id, e.target.value)}
                                                className="w-24 text-[10px] bg-gray-50 border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-orange-500 transition-colors"
                                            />
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => updateQty(item.id, 1)}
                                            className="size-10 rounded-full bg-gray-100 text-charcoal flex items-center justify-center hover:bg-gray-200 active:scale-95 transition-all"
                                        >
                                            <span className="material-icons-outlined">add</span>
                                        </button>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </main>
            </div>
            {/* Sticky Footer */}
            {totalItems > 0 && (
                <div className="sticky bottom-0 left-0 w-full bg-white border-t border-gray-100 p-4 pb-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
                    <div className="flex justify-between items-end mb-3 px-1">
                        <div>
                            <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-0.5">Current Order</p>
                            <p className="text-lg font-bold text-charcoal">{totalItems} Items Selected</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-0.5">Subtotal</p>
                            <p className="text-2xl font-black text-charcoal">₹{subtotal.toLocaleString()}</p>
                        </div>
                    </div>
                    <button
                        onClick={handlePlaceOrder}
                        disabled={submitting}
                        className={`w-full py-3.5 ${submitting ? 'bg-gray-400' : 'bg-orange-500'} text-white font-black rounded-xl shadow-xl shadow-orange-200 active:scale-95 transition-transform flex items-center justify-center gap-2 uppercase tracking-wide text-sm`}
                    >
                        <span className="material-icons-outlined">{submitting ? 'hourglass_top' : 'send'}</span>
                        {submitting ? 'Sending...' : 'Send to Kitchen'}
                    </button>
                </div>
            )}
        </div>
    );
}
