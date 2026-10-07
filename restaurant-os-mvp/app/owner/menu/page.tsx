'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOwner } from '@/context/OwnerContext';
import {
    UtensilsCrossed, Layers, Building2, Search, Filter,
    CheckCircle2, AlertCircle, Sparkles, Store, RefreshCw,
    ToggleLeft, ToggleRight, Tag, ChevronRight, Eye, Flame,
    DollarSign, Check
} from 'lucide-react';
import { toast } from 'sonner';

interface MenuItem {
    id: number | string;
    name: string;
    description?: string;
    price: number;
    is_veg?: boolean;
    is_available?: boolean;
    category_id?: number | string;
    category_name?: string;
    restaurant_id?: string;
    restaurant_name?: string;
    branch_id?: string;
    image_url?: string;
}

export default function MenuPage() {
    const { isAllRestaurants, currentRestaurant, selectedRestaurantId, setSelectedRestaurant, restaurants } = useOwner();
    const [search, setSearch] = useState('');
    const [categories, setCategories] = useState<any[]>([]);
    const [items, setItems] = useState<MenuItem[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'non-veg'>('all');
    const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all');
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState<string | number | null>(null);

    const fetchMenu = useCallback(async () => {
        setLoading(true);
        try {
            const branchParam = selectedRestaurantId && selectedRestaurantId !== 'all' ? `?branch=${selectedRestaurantId}` : '';
            const res = await fetch(`/api/owner/menu${branchParam}`);
            if (res.ok) {
                const data = await res.json();
                setCategories(data.categories || []);
                setItems(data.items || []);
            }
        } catch (err) {
            console.error('Failed to load menu:', err);
            toast.error('Failed to load menu catalog');
        } finally {
            setLoading(false);
        }
    }, [selectedRestaurantId]);

    useEffect(() => {
        fetchMenu();
    }, [fetchMenu]);

    // Handle Availability Toggle
    const handleToggleAvailability = async (item: MenuItem) => {
        const nextState = !item.is_available;
        setUpdatingId(item.id);
        try {
            const res = await fetch('/api/owner/menu', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: item.id, is_available: nextState })
            });

            if (res.ok) {
                setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: nextState } : i));
                toast.success(`${item.name} is now ${nextState ? 'Available' : 'Out of Stock'}`);
            } else {
                toast.error('Failed to update item availability');
            }
        } catch (err) {
            toast.error('Network error toggling item');
        } finally {
            setUpdatingId(null);
        }
    };

    // Filter Items
    const filteredItems = items.filter(item => {
        // Search
        const matchesSearch = item.name?.toLowerCase().includes(search.toLowerCase()) ||
            (item.description && item.description.toLowerCase().includes(search.toLowerCase())) ||
            (item.category_name && item.category_name.toLowerCase().includes(search.toLowerCase()));

        // Category
        const matchesCategory = selectedCategory === 'all' ||
            String(item.category_id) === String(selectedCategory) ||
            item.category_name?.toLowerCase() === selectedCategory.toLowerCase();

        // Diet Filter
        const matchesDiet = dietFilter === 'all' ||
            (dietFilter === 'veg' && item.is_veg) ||
            (dietFilter === 'non-veg' && !item.is_veg);

        // Availability Filter
        const matchesAvailability = availabilityFilter === 'all' ||
            (availabilityFilter === 'available' && item.is_available !== false) ||
            (availabilityFilter === 'unavailable' && item.is_available === false);

        return matchesSearch && matchesCategory && matchesDiet && matchesAvailability;
    });

    // Counts
    const totalCount = items.length;
    const vegCount = items.filter(i => i.is_veg).length;
    const nonVegCount = items.filter(i => !i.is_veg).length;
    const inStockCount = items.filter(i => i.is_available !== false).length;

    return (
        <div className="p-6 lg:p-8 space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-neutral-900 dark:text-white tracking-tight">Menu Catalog & Recipes</h2>
                    <p className="text-sm text-neutral-500 mt-0.5 font-medium">
                        {isAllRestaurants
                            ? 'Franchise-wide catalog across all restaurant branches'
                            : `${currentRestaurant?.name || 'Selected Restaurant'} catalog`}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800/60 border border-neutral-200/60 dark:border-zinc-700/30 rounded-xl w-60 shadow-xs">
                        <Search size={14} className="text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search dishes, tags..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-transparent text-xs outline-none w-full text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400"
                        />
                    </div>
                    <button
                        onClick={() => fetchMenu()}
                        disabled={loading}
                        className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-neutral-200/60 dark:border-zinc-700/30 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer shadow-xs"
                        title="Refresh catalog"
                    >
                        <RefreshCw size={14} className={loading ? "animate-spin text-indigo-500" : ""} />
                    </button>
                </div>
            </div>



            {/* KPI Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/60 dark:border-zinc-800/60 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                        <UtensilsCrossed size={18} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Total Items</p>
                        <p className="text-xl font-black text-neutral-900 dark:text-white tabular-nums">{loading ? '...' : totalCount}</p>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/60 dark:border-zinc-800/60 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                        <span className="w-3.5 h-3.5 border-2 border-emerald-600 rounded-sm flex items-center justify-center p-0.5">
                            <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                        </span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Pure Veg</p>
                        <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{loading ? '...' : vegCount}</p>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/60 dark:border-zinc-800/60 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
                        <span className="w-3.5 h-3.5 border-2 border-rose-600 rounded-sm flex items-center justify-center p-0.5">
                            <span className="w-1.5 h-1.5 bg-rose-600 rounded-xs" />
                        </span>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Non-Veg</p>
                        <p className="text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">{loading ? '...' : nonVegCount}</p>
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/60 dark:border-zinc-800/60 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
                        <CheckCircle2 size={18} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">In Stock</p>
                        <p className="text-xl font-black text-teal-600 dark:text-teal-400 tabular-nums">{loading ? '...' : inStockCount}</p>
                    </div>
                </div>
            </div>

            {/* Filter Toolbar: Categories, Diet Filter, Stock Filter */}
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/60 dark:border-zinc-800/60 shadow-xs space-y-3">
                {/* Category Pills Bar */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 premium-scrollbar">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                            selectedCategory === 'all'
                                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                                : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-zinc-700'
                        }`}
                    >
                        All Categories ({totalCount})
                    </button>
                    {categories.map(cat => {
                        const countInCat = items.filter(i => String(i.category_id) === String(cat.id) || i.category_name?.toLowerCase() === cat.name?.toLowerCase()).length;
                        const isSelected = String(selectedCategory) === String(cat.id) || selectedCategory.toLowerCase() === cat.name?.toLowerCase();
                        return (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCategory(String(cat.id))}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                                        : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-zinc-700'
                                }`}
                            >
                                {cat.name} ({countInCat})
                            </button>
                        );
                    })}
                </div>

                {/* Sub-Filters: Veg/Non-Veg + In Stock */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-100 dark:border-zinc-800">
                    {/* Diet Toggle */}
                    <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-zinc-800/80 p-1 rounded-xl">
                        <button
                            onClick={() => setDietFilter('all')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                dietFilter === 'all' ? 'bg-white dark:bg-zinc-900 text-neutral-900 dark:text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-900'
                            }`}
                        >
                            All Diet
                        </button>
                        <button
                            onClick={() => setDietFilter('veg')}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                dietFilter === 'veg' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-neutral-500 hover:text-emerald-600'
                            }`}
                        >
                            <span className="w-2.5 h-2.5 border border-current rounded-xs flex items-center justify-center p-0.5">
                                <span className="w-1 h-1 bg-current rounded-full" />
                            </span>
                            <span>Pure Veg</span>
                        </button>
                        <button
                            onClick={() => setDietFilter('non-veg')}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                dietFilter === 'non-veg' ? 'bg-rose-600 text-white shadow-2xs' : 'text-neutral-500 hover:text-rose-600'
                            }`}
                        >
                            <span className="w-2.5 h-2.5 border border-current rounded-xs flex items-center justify-center p-0.5">
                                <span className="w-1 h-1 bg-current rounded-xs" />
                            </span>
                            <span>Non-Veg</span>
                        </button>
                    </div>

                    {/* Stock Filter */}
                    <div className="flex items-center gap-1.5 bg-neutral-100 dark:bg-zinc-800/80 p-1 rounded-xl">
                        <button
                            onClick={() => setAvailabilityFilter('all')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                availabilityFilter === 'all' ? 'bg-white dark:bg-zinc-900 text-neutral-900 dark:text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-900'
                            }`}
                        >
                            All Stock
                        </button>
                        <button
                            onClick={() => setAvailabilityFilter('available')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                availabilityFilter === 'available' ? 'bg-teal-600 text-white shadow-2xs' : 'text-neutral-500 hover:text-teal-600'
                            }`}
                        >
                            In Stock
                        </button>
                        <button
                            onClick={() => setAvailabilityFilter('unavailable')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                availabilityFilter === 'unavailable' ? 'bg-neutral-800 text-white shadow-2xs' : 'text-neutral-500 hover:text-neutral-900'
                            }`}
                        >
                            Sold Out
                        </button>
                    </div>
                </div>
            </div>

            {/* Menu Items Grid */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-64 rounded-3xl bg-neutral-100/70 dark:bg-zinc-800/40 animate-pulse border border-neutral-200/40 dark:border-zinc-800/40" />
                    ))}
                </div>
            ) : filteredItems.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/50 dark:border-zinc-800/50">
                    <UtensilsCrossed size={40} className="text-neutral-300 mx-auto mb-3" />
                    <h3 className="text-base font-black text-neutral-800 dark:text-white">No dishes found</h3>
                    <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
                        Try changing your category filters, search keyword, or selecting another restaurant branch.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {filteredItems.map(item => {
                        const isAvailable = item.is_available !== false;
                        const isVeg = item.is_veg;

                        return (
                            <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="group bg-white dark:bg-zinc-900 rounded-3xl border border-neutral-200/70 dark:border-zinc-800/70 shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                            >
                                <div>
                                    {/* Top Image or Header Banner */}
                                    <div className="relative h-44 w-full bg-neutral-100 dark:bg-zinc-800 overflow-hidden">
                                        {item.image_url ? (
                                            <img
                                                src={item.image_url}
                                                alt={item.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200 dark:from-zinc-800 dark:to-zinc-800/60 text-neutral-400">
                                                <UtensilsCrossed size={36} className="opacity-40 mb-1" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">Dine in Recipe</span>
                                            </div>
                                        )}

                                        {/* Overlay gradient */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

                                        {/* Veg / Non-Veg Standard FSSAI Indicator Badge */}
                                        <div className="absolute top-3 left-3 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-1.5 rounded-lg shadow-sm">
                                            <div className={`w-4 h-4 border-2 ${isVeg ? 'border-emerald-600' : 'border-rose-600'} rounded-xs flex items-center justify-center p-0.5`}>
                                                <span className={`w-2 h-2 ${isVeg ? 'bg-emerald-600 rounded-full' : 'bg-rose-600 rounded-xs'}`} />
                                            </div>
                                        </div>

                                        {/* Category Tag */}
                                        {item.category_name && (
                                            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-white shadow-sm">
                                                {item.category_name}
                                            </div>
                                        )}

                                        {/* Price overlay on image */}
                                        <div className="absolute bottom-3 left-3">
                                            <span className="text-lg font-black text-white drop-shadow-md">
                                                ₹{parseFloat(String(item.price || 0)).toFixed(0)}
                                            </span>
                                        </div>

                                        {/* Stock Pill on image */}
                                        <div className="absolute bottom-3 right-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-xs ${
                                                isAvailable
                                                    ? 'bg-emerald-500/90 text-white'
                                                    : 'bg-rose-500/90 text-white'
                                            }`}>
                                                {isAvailable ? 'In Stock' : 'Sold Out'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Card Content */}
                                    <div className="p-4 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className="text-sm font-black text-neutral-900 dark:text-white line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                {item.name}
                                            </h4>
                                        </div>

                                        <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 min-h-[32px] leading-relaxed">
                                            {item.description || 'Specially crafted recipe prepared fresh with finest ingredients.'}
                                        </p>

                                        {/* Restaurant Outlet Pill (if in All Outlets view) */}
                                        {isAllRestaurants && item.restaurant_name && (
                                            <div className="pt-2 flex items-center gap-1.5 text-[10px] text-neutral-400 font-medium">
                                                <Store size={12} className="text-indigo-500" />
                                                <span className="truncate">{item.restaurant_name}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Card Footer: Availability Quick Action */}
                                <div className="p-3 bg-neutral-50/80 dark:bg-zinc-800/40 border-t border-neutral-100 dark:border-zinc-800 flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-neutral-400">Availability:</span>
                                    <button
                                        type="button"
                                        disabled={updatingId === item.id}
                                        onClick={() => handleToggleAvailability(item)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            isAvailable
                                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border border-neutral-200'
                                        }`}
                                    >
                                        {isAvailable ? (
                                            <>
                                                <ToggleRight size={15} className="text-emerald-600" />
                                                <span>In Stock</span>
                                            </>
                                        ) : (
                                            <>
                                                <ToggleLeft size={15} className="text-neutral-400" />
                                                <span>Mark Ready</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
