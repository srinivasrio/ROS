'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCartSafe } from '@/context/CartContext';
import { HomepageBuilderService } from '@/services/homepage-builder.service';
import { OrderService } from '@/services/orders.service';
import { 
    ChevronLeft as LucideChevronLeft, 
    Sparkles as LucideSparkles, 
    Search as LucideSearch,
    X as LucideX,
    Utensils as LucideUtensils
} from 'lucide-react';
import { SharedSkeleton } from '@/components/customer/SharedSkeleton';
import PopularItemCard from '@/components/shared/homepage/PopularItemCard';
import { SharedItemDetailModal } from '@/components/shared/details';

export default function AllPopularItemsPage() {
    const params = useParams();
    const router = useRouter();
    const restaurantId = (params.restaurantCode || params.restaurantId) as string;
    const tableNumber = params.tableNumber as string;

    const cartContext = useCartSafe();
    const addToCart = cartContext?.addToCart || (() => {});
    const updateQuantity = cartContext?.updateQuantity || (() => {});
    const cart = cartContext?.cart || {};
    const setTableNumber = cartContext?.setTableNumber || (() => {});

    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<any | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<'ALL' | 'Veg' | 'Non-Veg'>('ALL');
    const [tableDisplayName, setTableDisplayName] = useState(tableNumber);

    const getItemQtyInCart = (id: string) => cart[String(id)]?.quantity || 0;

    useEffect(() => {
        if (tableNumber) setTableNumber(tableNumber);
    }, [tableNumber, setTableNumber]);

    useEffect(() => {
        const loadPopularItems = async () => {
            try {
                const [data, tableInfo] = await Promise.all([
                    HomepageBuilderService.getPopularItems(restaurantId, 60),
                    tableNumber ? OrderService.findTableAnywhere(tableNumber, restaurantId) : Promise.resolve(null)
                ]);
                setItems(data || []);
                if (tableInfo) {
                    setTableDisplayName(tableInfo.display_name?.replace('Table ', '') || tableInfo.table_number?.toString() || tableNumber);
                }
            } catch (err) {
                console.error('Failed to load popular items:', err);
            } finally {
                setLoading(false);
            }
        };
        loadPopularItems();
    }, [restaurantId, tableNumber]);

    // Filter items by search query and dietary selection
    const filteredItems = useMemo(() => {
        return items.filter((item) => {
            const matchesSearch = !searchTerm.trim() || 
                item.name.toLowerCase().includes(searchTerm.toLowerCase().trim()) || 
                (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase().trim()));

            const dietary = (item.item_type || (item.is_veg ? 'Veg' : 'Non-Veg')).toLowerCase();
            const isVeg = dietary === 'veg' || dietary === 'vegetarian' || item.is_veg === true;
            const isNonVeg = !isVeg;

            let matchesDiet = true;
            if (activeFilter === 'Veg') matchesDiet = isVeg;
            if (activeFilter === 'Non-Veg') matchesDiet = isNonVeg;

            return matchesSearch && matchesDiet;
        });
    }, [items, searchTerm, activeFilter]);

    const formattedTable = (tableDisplayName || tableNumber || '').toLowerCase().startsWith('table')
        ? (tableDisplayName || tableNumber || '')
        : 'Table ' + (tableDisplayName || tableNumber || '');

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 pb-28">
                <header className="bg-white px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                    <div className="size-8 bg-slate-100 rounded-full animate-pulse" />
                    <div className="flex-1 space-y-1.5">
                        <div className="h-5 bg-slate-100 rounded-md w-36 animate-pulse" />
                        <div className="h-3 bg-slate-100 rounded-md w-24 animate-pulse" />
                    </div>
                </header>
                <main className="p-4">
                    <SharedSkeleton count={6} />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col pb-28 font-sans">
            {/* Top Fixed Header */}
            <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
                {/* Row 1: Back Button, Title, Table Badge */}
                <div className="px-3.5 sm:px-4 py-2.5 flex items-center justify-between gap-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <button
                            onClick={() => router.back()}
                            aria-label="Go back"
                            className="size-8 rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0"
                        >
                            <LucideChevronLeft size={18} />
                        </button>
                        <div className="flex flex-col min-w-0">
                            <h1 className="text-sm sm:text-base font-black text-slate-900 leading-tight truncate">
                                <span>Most Loved Dishes</span>
                            </h1>
                            <p className="text-[10px] font-semibold text-slate-500 truncate">
                                {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'} available
                            </p>
                        </div>
                    </div>

                    {/* Table Badge */}
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] font-black shrink-0 shadow-2xs">
                        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="whitespace-nowrap">{formattedTable}</span>
                    </div>
                </div>

                {/* Row 2: Search Input & Dietary Segmented Filter */}
                <div className="px-3.5 sm:px-4 py-2 flex items-center gap-2">
                    <div className="relative flex-1">
                        <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                            type="text"
                            placeholder="Search popular dishes..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-100/90 rounded-xl py-1.5 pl-8 pr-7 text-xs font-semibold text-slate-800 placeholder-slate-400 border border-slate-200/80 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:bg-white transition-all"
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

                    {/* Diet Segmented Control */}
                    <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shrink-0">
                        {(['ALL', 'Veg', 'Non-Veg'] as const).map((type) => {
                            const isActive = activeFilter === type;
                            return (
                                <button
                                    key={type}
                                    onClick={() => setActiveFilter(type)}
                                    className={`relative px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer ${
                                        isActive 
                                            ? 'bg-white text-slate-900 shadow-xs' 
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    <span className="flex items-center gap-1">
                                        {type === 'Veg' && <span className="size-1.5 rounded-full bg-emerald-500" />}
                                        {type === 'Non-Veg' && <span className="size-1.5 rounded-full bg-rose-500" />}
                                        <span>{type}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </header>

            {/* Main Content Grid */}
            <main className="p-3.5 sm:p-4 md:p-6 max-w-6xl mx-auto w-full">
                {filteredItems.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs max-w-md mx-auto">
                        <div className="size-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mx-auto mb-3">
                            <LucideUtensils size={24} />
                        </div>
                        <h2 className="text-base font-bold text-slate-900">No dishes found</h2>
                        <p className="text-xs text-slate-500 mt-1">Try changing your search terms or dietary filter.</p>
                        {(searchTerm || activeFilter !== 'ALL') && (
                            <button
                                onClick={() => {
                                    setSearchTerm('');
                                    setActiveFilter('ALL');
                                }}
                                className="mt-3 text-xs font-bold text-orange-600 underline cursor-pointer"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4.5">
                        {filteredItems.map((item) => (
                            <div key={item.id} className="flex">
                                <PopularItemCard
                                    item={item}
                                    quantity={getItemQtyInCart(String(item.id))}
                                    onAdd={(it) => addToCart(it, 1)}
                                    onIncrement={(id) => updateQuantity(id, 1)}
                                    onDecrement={(id) => updateQuantity(id, -1)}
                                    onClick={() => setSelectedItem(item)}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Standardized Luxury Item Detail Modal */}
            <SharedItemDetailModal
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onAddToCart={(it) => addToCart(it, 1)}
                onUpdateQuantity={(id, delta) => updateQuantity(id, delta)}
                cartQuantity={selectedItem ? getItemQtyInCart(String(selectedItem.id)) : 0}
                currencySymbol="₹"
                colorHex="#ea580c"
            />
        </div>
    );
}
