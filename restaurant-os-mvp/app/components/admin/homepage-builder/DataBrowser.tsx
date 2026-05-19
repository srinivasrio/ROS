'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MenuService, MenuItem, Category } from '@/app/services/menu';
import { SpecialsService, TodaySpecial } from '@/app/services/specials.service';
import { ServiceOptionsService, ServiceOption } from '@/app/services/service-options.service';
import { OfferService, Offer } from '@/app/services/offers';
import {
    Search, Utensils, Grid3X3, Star, Package, ChevronDown, ChevronRight,
    Link, X, Loader2, Sparkles, Tag
} from 'lucide-react';

interface DataBrowserProps {
    restaurantId: string;
    onLinkItem: (type: string, item: any) => void;
    onClose: () => void;
}

type DataTab = 'menu' | 'specials' | 'services' | 'offers';

export default function DataBrowser({ restaurantId, onLinkItem, onClose }: DataBrowserProps) {
    const [activeTab, setActiveTab] = useState<DataTab>('menu');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());

    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [specials, setSpecials] = useState<TodaySpecial[]>([]);
    const [services, setServices] = useState<ServiceOption[]>([]);
    const [offers, setOffers] = useState<Offer[]>([]);

    useEffect(() => { loadData(); }, [restaurantId]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [m, c, sp, sv, o] = await Promise.all([
                MenuService.fetchMenuItems(restaurantId).catch(() => []),
                MenuService.fetchCategories(restaurantId).catch(() => []),
                SpecialsService.fetchActiveSpecials(restaurantId).catch(() => []),
                ServiceOptionsService.fetchAll(restaurantId).catch(() => []),
                OfferService.fetchOffers(restaurantId).catch(() => []),
            ]);
            setMenuItems(m || []);
            setCategories(c || []);
            setSpecials(sp || []);
            setServices(sv || []);
            setOffers(o || []);
        } catch (err) {
            console.error('Failed to load data browser:', err);
        } finally {
            setLoading(false);
        }
    };

    const toggleCat = (id: number) => {
        setExpandedCats(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const tabs: { id: DataTab; label: string; icon: React.ElementType; count: number }[] = [
        { id: 'menu', label: 'Menu', icon: Utensils, count: menuItems.length },
        { id: 'specials', label: "Today's Special", icon: Star, count: specials.length },
        { id: 'services', label: 'Services', icon: Package, count: services.length },
        { id: 'offers', label: 'Offers', icon: Tag, count: offers.length },
    ];

    const q = search.toLowerCase();
    const filterArr = (items: any[], fields: string[]) =>
        !q ? items : items.filter(i => fields.some(f => String(i[f] || '').toLowerCase().includes(q)));

    // Group menu items by category
    const catMap = new Map<number, { cat: Category; items: MenuItem[] }>();
    categories.forEach(c => catMap.set(c.id, { cat: c, items: [] }));
    menuItems.forEach(mi => {
        const bucket = catMap.get(mi.category_id);
        if (bucket) bucket.items.push(mi);
        else catMap.set(mi.category_id, { cat: { id: mi.category_id, name: mi.category?.name || 'Other', slug: '', category_type: 'food' }, items: [mi] });
    });

    const filteredCats = Array.from(catMap.values()).map(({ cat, items }) => ({
        cat,
        items: filterArr(items, ['name', 'description']),
    })).filter(g => g.items.length > 0 || (!q && g.items.length === 0));

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed inset-y-0 right-0 w-[380px] bg-white shadow-2xl border-l border-neutral-200 z-50 flex flex-col"
        >
            {/* Header */}
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                        <Sparkles size={14} className="text-white" />
                    </div>
                    <div>
                        <h3 className="font-bold text-sm text-black">Data Browser</h3>
                        <p className="text-[10px] text-black">Link content to your homepage</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 transition-colors">
                    <X size={16} className="text-black" />
                </button>
            </div>

            {/* Search */}
            <div className="px-4 py-2 border-b border-neutral-100 shrink-0">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black" />
                    <input
                        type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search items..."
                        className="w-full pl-9 pr-3 py-2 text-xs border border-neutral-200 rounded-lg outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/30 bg-neutral-50"
                    />
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-neutral-100 shrink-0">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors relative ${
                            activeTab === tab.id ? 'text-violet-600' : 'text-black hover:text-black'
                        }`}
                    >
                        <tab.icon size={12} />
                        {tab.label}
                        <span className={`ml-0.5 text-[9px] px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-violet-100 text-violet-700' : 'bg-neutral-100 text-black'}`}>
                            {tab.count}
                        </span>
                        {activeTab === tab.id && (
                            <motion.div layoutId="data-tab" className="absolute bottom-0 left-1 right-1 h-0.5 bg-violet-500 rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-hide">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                        <Loader2 size={24} className="animate-spin text-violet-400 mb-2" />
                        <p className="text-xs text-black">Loading data...</p>
                    </div>
                ) : (
                    <>
                        {/* ─── Menu Items grouped by Category ─── */}
                        {activeTab === 'menu' && (
                            <div className="space-y-1">
                                {/* View All Menu */}
                                <div 
                                    className="flex items-center gap-3 p-3 rounded-xl bg-violet-600 text-white cursor-pointer hover:bg-violet-700 transition-all mb-4 shadow-md shadow-violet-200"
                                    onClick={() => onLinkItem('menu_view_all', { name: 'Full Menu', target: '/{restaurantCode}/customer/menu/{tableNumber}' })}
                                >
                                    <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                                        <Utensils size={18} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold truncate">View All Menu</p>
                                        <p className="text-[10px] text-white/70">Link to full restaurant menu</p>
                                    </div>
                                    <Link size={12} className="text-white/70" />
                                </div>
                                {filteredCats.map(({ cat, items }) => (
                                    <div key={cat.id}>
                                        {/* Category header — clickable to link category */}
                                        <div className="flex items-center gap-1 group">
                                            <button onClick={() => toggleCat(cat.id)} className="p-1 rounded hover:bg-neutral-100 transition-colors">
                                                {expandedCats.has(cat.id) ? <ChevronDown size={12} className="text-black" /> : <ChevronRight size={12} className="text-black" />}
                                            </button>
                                            <div
                                                className="flex-1 flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-violet-50/40 cursor-pointer transition-colors"
                                                onClick={() => onLinkItem('category', cat)}
                                            >
                                                {cat.image_url ? (
                                                    <img src={cat.image_url} className="w-7 h-7 rounded-lg object-cover" />
                                                ) : (
                                                    <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center"><Grid3X3 size={12} className="text-orange-400" /></div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-black truncate">{cat.name}</p>
                                                    <p className="text-[10px] text-black">{items.length} items</p>
                                                </div>
                                                <button className="p-1 rounded bg-violet-100 text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Link category">
                                                    <Link size={10} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Items under this category */}
                                        {expandedCats.has(cat.id) && (
                                            <div className="ml-7 space-y-0.5 mt-0.5 mb-1">
                                                {items.map(item => (
                                                    <DataItemCard
                                                        key={item.id}
                                                        title={item.name}
                                                        subtitle={`₹${item.price} • ${item.item_type}`}
                                                        imageUrl={item.image_url}
                                                        available={item.is_available}
                                                        onLink={() => onLinkItem('menu_item', item)}
                                                    />
                                                ))}
                                                {items.length === 0 && (
                                                    <p className="text-[10px] text-black py-2 text-center">No items</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {filteredCats.length === 0 && (
                                    <p className="text-xs text-black py-8 text-center">No menu items found</p>
                                )}
                            </div>
                        )}

                        {/* ─── Today's Specials ─── */}
                        {activeTab === 'specials' && (
                            <div className="space-y-1">
                                {/* View All Specials */}
                                <div 
                                    className="flex items-center gap-3 p-3 rounded-xl bg-orange-500 text-white cursor-pointer hover:bg-orange-600 transition-all mb-4 shadow-md shadow-orange-200"
                                    onClick={() => onLinkItem('special_view_all', { name: "All Today's Specials", target: '/{restaurantCode}/customer/specials/{tableNumber}' })}
                                >
                                    <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                                        <Star size={18} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold truncate">View All Specials</p>
                                        <p className="text-[10px] text-white/70">Link to all active specials</p>
                                    </div>
                                    <Link size={12} className="text-white/70" />
                                </div>

                                {filterArr(specials, ['title', 'description']).length > 0 ? (
                                    filterArr(specials, ['title', 'description']).map(sp => (
                                        <DataItemCard
                                            key={sp.id}
                                            title={sp.title}
                                            subtitle={`${sp.description || ''} • ${sp.is_combo ? 'Combo' : 'Single'} • ₹${sp.special_price || ''}`}
                                            available={sp.is_active}
                                            onLink={() => onLinkItem('special', sp)}
                                        />
                                    ))
                                ) : (
                                    <p className="text-xs text-black py-8 text-center">No specials found</p>
                                )}
                            </div>
                        )}

                        {/* ─── Services ─── */}
                        {activeTab === 'services' && (
                            <div className="space-y-1">
                                {/* View All Services */}
                                <div 
                                    className="flex items-center gap-3 p-3 rounded-xl bg-teal-600 text-white cursor-pointer hover:bg-teal-700 transition-all mb-4 shadow-md shadow-teal-200"
                                    onClick={() => onLinkItem('service_view_all', { name: 'All Services', target: '/{restaurantCode}/customer/services/{tableNumber}' })}
                                >
                                    <div className="w-9 h-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                                        <Package size={18} className="text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold truncate">View All Services</p>
                                        <p className="text-[10px] text-white/70">Link to all available services</p>
                                    </div>
                                    <Link size={12} className="text-white/70" />
                                </div>

                                {filterArr(services, ['label', 'sub_label']).length > 0 ? (
                                    filterArr(services, ['label', 'sub_label']).map(svc => (
                                        <DataItemCard
                                            key={svc.id}
                                            title={svc.label}
                                            subtitle={svc.sub_label}
                                            imageUrl={svc.image_url || undefined}
                                            available={svc.is_active}
                                            onLink={() => onLinkItem('service', svc)}
                                        />
                                    ))
                                ) : (
                                    <p className="text-xs text-black py-8 text-center">No services found</p>
                                )}
                            </div>
                        )}

                        {/* ─── Offers ─── */}
                        {activeTab === 'offers' && (
                            <div className="space-y-1">
                                {filterArr(offers, ['code']).length > 0 ? (
                                    filterArr(offers, ['code']).map(offer => (
                                        <DataItemCard
                                            key={offer.id}
                                            title={offer.code}
                                            subtitle={`${offer.discount_value}${offer.discount_type === 'percentage' ? '%' : '₹'} OFF • ${offer.status}`}
                                            available={offer.status === 'active'}
                                            onLink={() => onLinkItem('offer', offer)}
                                        />
                                    ))
                                ) : (
                                    <p className="text-xs text-black py-8 text-center">No offers found</p>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );
}

function DataItemCard({ title, subtitle, imageUrl, available = true, onLink }: {
    title: string; subtitle: string; imageUrl?: string; available?: boolean; onLink: () => void;
}) {
    return (
        <div
            className={`flex items-center gap-3 p-2 rounded-xl border border-neutral-100 hover:border-violet-200 hover:bg-violet-50/20 transition-all cursor-pointer group ${!available ? 'opacity-50' : ''}`}
            onClick={onLink}
        >
            {imageUrl ? (
                <img src={imageUrl} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0 border border-neutral-100" />
            ) : (
                <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center shrink-0">
                    <Utensils size={13} className="text-black" />
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-black truncate">{title}</p>
                <p className="text-[10px] text-black truncate">{subtitle}</p>
            </div>
            <button className="p-1.5 rounded-lg bg-violet-100 text-violet-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" title="Link to element">
                <Link size={11} />
            </button>
        </div>
    );
}
