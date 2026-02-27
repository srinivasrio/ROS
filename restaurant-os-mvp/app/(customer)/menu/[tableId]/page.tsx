'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCategoryMenuItemImage } from '@/app/lib/utils';
import { MenuService, Category, SubCategory, MenuItem } from '@/app/services/menu';
import { OrderService } from '@/app/services/orders';
import { useCart } from '../../context/CartContext';
import { LucideUtensils, LucideCoffee, LucideIceCream, LucideGlassWater, LucideSearch, LucideShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';

export default function CustomerMenu() {
    const params = useParams();
    const router = useRouter();
    const urlTableId = typeof params.tableId === 'string' ? params.tableId : '';
    const { addToCart, cart, updateQuantity, removeFromCart, totalItems, subtotal, setTableId } = useCart();

    const [categories, setCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [activeCategory, setActiveCategory] = useState<number | null>(null);
    const [activeSubCategory, setActiveSubCategory] = useState<number | 'ALL'>('ALL');
    const [activeTypeFilter, setActiveTypeFilter] = useState<'ALL' | 'Veg' | 'Non-Veg'>('ALL'); // New Filter State
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (urlTableId) {
            setTableId(urlTableId);
        }
    }, [urlTableId, setTableId]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [cats, items] = await Promise.all([
                    MenuService.fetchCategories(),
                    MenuService.fetchMenuItems()
                ]);
                setCategories(cats);
                setMenuItems(items);
                if (cats.length > 0) {
                    setActiveCategory(cats[0].id);
                }
            } catch (error) {
                console.error('Failed to load menu:', error);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        const loadSubCategories = async () => {
            if (!activeCategory) {
                setSubCategories([]);
                return;
            }
            try {
                const subs = await MenuService.fetchSubCategories(activeCategory);
                setSubCategories(subs);
                setActiveSubCategory('ALL'); // Reset subcategory when category changes
                setActiveSubCategory('ALL'); // Reset subcategory when category changes
            } catch (err) {
                console.error('Failed to load subcategories', err);
            }
        };
        loadSubCategories();
    }, [activeCategory]);

    const getItemQtyInCart = (id: number) => cart[id]?.quantity || 0;

    const categoryItems = menuItems.filter(i => i.category_id === activeCategory);
    const hasVeg = categoryItems.some(i => i.item_type === 'Veg');
    const hasNonVeg = categoryItems.some(i => i.item_type === 'Non-Veg' || i.item_type === 'Egg');
    const showTypeFilter = hasVeg && hasNonVeg;

    const filteredItems = menuItems.filter(item => {
        const matchesCategory = activeCategory ? item.category_id === activeCategory : true;
        const matchesSubCategory = activeSubCategory === 'ALL' || item.sub_category_id === activeSubCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());

        // Type Filter Logic:
        // Only apply the filter if the category is mixed (showTypeFilter is true).
        // If the category is pure Veg or pure Non-Veg, we ignore the sticky filter to avoid empty screens with hidden controls.
        const effectiveTypeFilter = showTypeFilter ? activeTypeFilter : 'ALL';
        const typeMatch = effectiveTypeFilter === 'ALL' || item.item_type === effectiveTypeFilter;

        return matchesCategory && matchesSubCategory && matchesSearch && item.is_available && typeMatch;
    });

    const getCategoryIcon = (name: string) => {
        const n = name.toLowerCase();
        if (n.includes('drink') || n.includes('beverage')) return <LucideGlassWater size={20} />;
        if (n.includes('desert') || n.includes('sweet') || n.includes('ice')) return <LucideIceCream size={20} />;
        if (n.includes('tea') || n.includes('coffee')) return <LucideCoffee size={20} />;
        return <LucideUtensils size={20} />;
    };

    const handleCallWaiter = async () => {
        if (!urlTableId) return;
        try {
            await OrderService.setTableAlert(Number(urlTableId), 'call_waiter');
            // Optimistic UI or Toast
            alert('Waiter has been notified!');
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
                <p className="text-neutral-400 font-medium">Loading Menu...</p>
            </div>
        );
    }


    // Search input
    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Sidebar Categories */}
            <aside className="w-20 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-4 overflow-y-auto no-scrollbar z-10 shadow-[2px_0_20px_rgba(0,0,0,0.02)] pt-safe-top">
                {/* Logo / Menu Icon */}
                <div className="size-10 bg-neutral-900 rounded-xl flex items-center justify-center text-white mb-2 shadow-lg shadow-neutral-900/20 shrink-0">
                    <LucideUtensils size={20} />
                </div>

                <div className="flex flex-col gap-3 w-full items-center pb-24">
                    {categories.map(cat => {
                        const isActive = activeCategory === cat.id;

                        // Map category names to images
                        const getCategoryImage = (name: string) => {
                            const n = name.toLowerCase();
                            if (n.includes('soup')) return '/menu/hot-and-sour-soup.jpeg';
                            if (n.includes('veg starter')) return '/menu/paneer-tikka.png';
                            if (n.includes('non-veg starter')) return '/menu/chicken-lollipop.jpeg';
                            if (n.includes('veg curr')) return '/menu/paneer-butter-masala.jpeg'; // Green gravy for contrast
                            if (n.includes('non-veg curr')) return '/menu/mutton-rogan-josh.jpeg'; // Red gravy
                            if (n.includes('biryani')) return '/menu/mutton-biryani.jpeg'; // Prioritize Biryani
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
                                onClick={() => setActiveCategory(cat.id)}
                                className="relative w-16 h-20 flex flex-col items-center justify-center gap-1.5 z-0 group"
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeSidebar"
                                        className="absolute inset-x-0 top-1 bottom-0 bg-orange-500 rounded-2xl border border-orange-400 shadow-md shadow-orange-500/20"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}

                                {(() => {
                                    const imagePath = getCategoryImage(cat.name);
                                    return (
                                        <div className={`relative z-10 size-12 rounded-xl overflow-hidden shadow-md transition-all duration-300 ${isActive ? 'ring-2 ring-white ring-offset-2 ring-offset-orange-500 scale-110' : 'group-hover:scale-105'}`}>
                                            <img
                                                src={imagePath}
                                                alt={cat.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    );
                                })()}
                                <span className={`relative z-10 text-[10px] font-bold text-center leading-tight line-clamp-2 max-w-full transition-colors duration-300 ${isActive ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-900'}`}>
                                    {cat.name}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full relative">
                {/* Minimal Header */}
                <header className="bg-white/80 backdrop-blur-sm p-4 sticky top-0 z-10 border-b border-gray-100 grid grid-cols-3 items-center pt-safe-top">
                    <h1 className="text-xl font-black text-neutral-900 tracking-tight">Menu</h1>
                    <p className="text-sm font-black text-neutral-900 uppercase tracking-widest text-center whitespace-nowrap">TABLE {urlTableId}</p>
                    <div />
                </header>

                {/* SubCategories & Search */}
                <div className="p-4 bg-gray-50/50 backdrop-blur-xl z-20">
                    {/* Search */}
                    <div className="relative mb-3">
                        <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white rounded-xl py-2.5 pl-9 pr-4 text-sm font-medium text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/10 shadow-sm border border-gray-100"
                        />
                    </div>

                    {/* Type Filter (Veg/Non-Veg) - Only shown for mixed categories */}
                    {showTypeFilter && (
                        <div className="flex gap-2 mb-3 bg-gray-100 p-1 rounded-xl relative z-0">
                            {(['Veg', 'Non-Veg'] as const).map(type => {
                                const isActive = activeTypeFilter === type;
                                return (
                                    <button
                                        key={type}
                                        onClick={() => setActiveTypeFilter(isActive ? 'ALL' : type)}
                                        className={`flex-1 relative py-2 rounded-lg text-xs font-bold transition-colors z-10 ${isActive
                                            ? 'text-white'
                                            : 'text-neutral-500 hover:text-neutral-900'
                                            }`}
                                    >
                                        {isActive && (
                                            <motion.div
                                                layoutId="activeFilter"
                                                className={`absolute inset-0 rounded-lg shadow-sm ${type === 'Veg' ? 'bg-green-600'
                                                    : type === 'Non-Veg' ? 'bg-red-600'
                                                        : 'bg-neutral-900'
                                                    }`}
                                                initial={false}
                                                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                                style={{ zIndex: -1 }}
                                            />
                                        )}
                                        <span className="relative z-10">{type}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Horizontal SubCats - Hide if only "General" exists */}
                    {activeCategory && subCategories.length > 0 && !(subCategories.length === 1 && subCategories[0].name === 'General') && (
                        <div className="flex overflow-x-auto gap-2 pb-1 no-scrollbar">
                            <button
                                onClick={() => setActiveSubCategory('ALL')}
                                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${activeSubCategory === 'ALL'
                                    ? 'bg-neutral-900 text-white border-neutral-900 shadow-md shadow-neutral-900/10'
                                    : 'bg-white text-neutral-500 border-gray-200'
                                    }`}
                            >
                                All
                            </button>
                            {subCategories.map(sub => (
                                <button
                                    key={sub.id}
                                    onClick={() => setActiveSubCategory(sub.id)}
                                    className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${activeSubCategory === sub.id
                                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-md shadow-neutral-900/10'
                                        : 'bg-white text-neutral-500 border-gray-200'
                                        }`}
                                >
                                    {sub.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Scrollable Menu List */}
                <main className="flex-1 overflow-y-auto p-4 pt-0 pb-32 space-y-3 relative z-0">
                    {filteredItems.length === 0 ? (
                        <div className="text-center py-20">
                            <div className="inline-block p-4 rounded-full bg-gray-100 mb-4">
                                <LucideUtensils className="text-gray-400" size={24} />
                            </div>
                            <p className="text-neutral-400 font-medium">No items found.</p>
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
                                        <>
                                            <div className="absolute inset-0 bg-neutral-900/5" />
                                            <span className="text-2xl relative z-10">🍽️</span>
                                        </>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                    <div>
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-bold text-neutral-900 text-base leading-tight line-clamp-2">{item.name}</h3>
                                            <div className={`mt-1 size-2.5 rounded-full flex-shrink-0 border-[1.5px] p-[1.5px] ${item.item_type === 'Veg' ? 'border-green-600' :
                                                item.item_type === 'Non-Veg' ? 'border-red-600' :
                                                    item.item_type === 'Egg' ? 'border-yellow-600' : 'border-gray-300'
                                                }`}>
                                                <div className={`w-full h-full rounded-full ${item.item_type === 'Veg' ? 'bg-green-600' :
                                                    item.item_type === 'Non-Veg' ? 'bg-red-600' :
                                                        item.item_type === 'Egg' ? 'bg-yellow-600' : 'bg-gray-300'
                                                    }`}></div>
                                            </div>
                                        </div>
                                        {item.description && (
                                            <p className="text-[11px] text-neutral-500 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                                        )}
                                    </div>

                                    <div className="flex items-end justify-between mt-3">
                                        <p className="font-black text-neutral-900">₹{item.price}</p>

                                        {getItemQtyInCart(item.id) > 0 ? (
                                            <div className="flex items-center bg-neutral-900 rounded-lg p-0.5 shadow-lg shadow-neutral-900/20">
                                                <button
                                                    onClick={() => updateQuantity(item.id, -1)}
                                                    className="size-7 flex items-center justify-center text-white hover:bg-white/20 rounded-md transition-colors"
                                                >
                                                    -
                                                </button>
                                                <span className="w-6 text-center text-white font-bold text-xs">{getItemQtyInCart(item.id)}</span>
                                                <button
                                                    onClick={() => updateQuantity(item.id, 1)}
                                                    className="size-7 flex items-center justify-center text-white hover:bg-white/20 rounded-md transition-colors"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => addToCart(item, 1)}
                                                className="px-4 py-2 bg-white text-neutral-900 text-xs font-black uppercase tracking-wider rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all"
                                            >
                                                Add
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </main>
            </div>

            {totalItems > 0 && (
                <div className="fixed bottom-20 left-0 right-0 z-40 pointer-events-none flex justify-center">
                    <div className="w-full max-w-md px-4 flex justify-end">
                        <button
                            onClick={() => router.push('/cart')}
                            className="pointer-events-auto bg-orange-500 text-white rounded-2xl p-3 shadow-2xl shadow-orange-500/30 flex items-center gap-4 transform hover:scale-[1.02] active:scale-[0.98] transition-all backdrop-blur-md bg-orange-500/95"
                        >
                            <div className="flex flex-col items-end leading-none">
                                <span className="text-[10px] font-bold text-white/90 uppercase tracking-wider mb-0.5">{totalItems} Items</span>
                                <span className="text-lg font-bold">₹{subtotal}</span>
                            </div>
                            <div className="bg-white/20 p-2 rounded-xl">
                                <LucideShoppingCart size={20} fill="currentColor" />
                            </div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
