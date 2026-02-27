'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getCategoryMenuItemImage } from '@/app/lib/utils';
import { OrderService } from '@/app/services/orders';
import { MenuService, Category, SubCategory, MenuItem } from '@/app/services/menu';
import { LucideUtensils, LucideCoffee, LucideIceCream, LucideGlassWater, LucideCitrus, LucideSearch } from 'lucide-react';

export default function WaiterMenuSelection() {
    const params = useParams();
    const router = useRouter();
    const tableId = typeof params.tableId === 'string' ? params.tableId : '';

    const [categories, setCategories] = useState<Category[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
    const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
    const [activeCategory, setActiveCategory] = useState<number | null>(null);
    const [activeSubCategory, setActiveSubCategory] = useState<number | 'ALL'>('ALL');
    const [cart, setCart] = useState<Record<number, number>>({});
    const [itemNotes, setItemNotes] = useState<Record<number, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [tableName, setTableName] = useState<string>(`Table ${tableId}`);

    useEffect(() => {
        const loadData = async () => {
            try {
                // If tableId is a UUID, we need to fetch the group name
                let resolvedName = `Table ${tableId}`;
                if (isNaN(Number(tableId))) {
                    const groups = await OrderService.fetchMergeGroups();
                    const group = groups?.find((g: any) => g.id === tableId);
                    if (group) {
                        resolvedName = group.display_name;
                    } else {
                        resolvedName = 'Merged Group';
                    }
                }
                setTableName(resolvedName);

                const [cats, items] = await Promise.all([
                    MenuService.fetchCategories(),
                    MenuService.fetchMenuItems()
                ]);
                setCategories(cats);
                setMenuItems(items);
                if (cats.length > 0 && !activeCategory) {
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
        const sub = OrderService.subscribeToMenuItems(() => loadData());

        return () => {
            sub.unsubscribe();
        };
    }, []);

    // Load subcategories when activeCategory changes
    useEffect(() => {
        if (!activeCategory) return;

        const loadSubs = async () => {
            try {
                const subs = await MenuService.fetchSubCategories(activeCategory);
                setSubCategories(subs);
                setActiveSubCategory('ALL');
            } catch (e) {
                console.error(e);
            }
        }
        loadSubs();
    }, [activeCategory]);


    const getItemQty = (id: number) => cart[id] || 0;

    const updateQty = (id: number, delta: number) => {
        setCart(prev => {
            const newQty = (prev[id] || 0) + delta;
            if (newQty <= 0) {
                const { [id]: _, ...rest } = prev;
                setItemNotes(prevNotes => {
                    const { [id]: __, ...restNotes } = prevNotes;
                    return restNotes;
                });
                return rest;
            }
            return { ...prev, [id]: newQty };
        });
    };

    const updateNote = (id: number, note: string) => {
        setItemNotes(prev => ({ ...prev, [id]: note }));
    };

    const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);
    const subtotal = Object.entries(cart).reduce((sum, [id, qty]) => {
        const item = menuItems.find(i => i.id === Number(id));
        return sum + (item ? item.price * qty : 0);
    }, 0);

    const filteredItems = menuItems.filter(item => {
        const matchesCategory = item.category_id === activeCategory;
        const matchesSubCategory = activeSubCategory === 'ALL' || item.sub_category_id === activeSubCategory;
        return matchesCategory && matchesSubCategory && item.is_available;
    });

    const handlePlaceOrder = async () => {
        if (totalItems === 0) return;
        setSubmitting(true);
        try {
            const orderItems = Object.entries(cart).map(([id, qty]) => {
                const item = menuItems.find(i => i.id === Number(id));
                return {
                    menu_item_id: Number(id),
                    quantity: qty,
                    price: item?.price || 0,
                    notes: itemNotes[Number(id)] || ''
                };
            });

            const idParam = isNaN(Number(tableId)) ? tableId : Number(tableId);

            // Get Waiter Session
            let waiterId = undefined;
            const sessionStr = localStorage.getItem('waiterSession');
            if (sessionStr) {
                try {
                    const session = JSON.parse(sessionStr);
                    if (session.id) waiterId = session.id;
                } catch (e) { }
            }

            await OrderService.createOrder(idParam, orderItems, 'placed', waiterId);
            // alert('Order Sent to Kitchen!'); // Removed alert for smoother flow? Or keep it? User didn't specify. Keeping for feedback.
            setCart({});
            setItemNotes({});
            router.push('/waiter/dashboard');
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
        return <div className="flex items-center justify-center h-screen text-neutral-500">Loading Menu...</div>;
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
                    <p className="text-xs text-gray-500 font-medium">Ordering</p>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Categories */}
                <aside className="w-20 bg-gray-50 flex flex-col items-center py-4 gap-6 overflow-y-auto shrink-0 no-scrollbar">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex flex-col items-center gap-1.5 w-full relative z-0 group ${activeCategory === cat.id ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}
                        >
                            {/* Active Indicator & Background */}
                            {activeCategory === cat.id && (
                                <div className="absolute inset-x-2 top-0 bottom-0 bg-white rounded-xl shadow-sm border border-orange-100 -z-10"></div>
                            )}

                            <div className={`relative size-10 rounded-full overflow-hidden shadow-sm transition-transform duration-200 mt-1 ${activeCategory === cat.id ? 'scale-110 ring-2 ring-orange-500 ring-offset-2' : 'group-hover:scale-105'}`}>
                                <img
                                    src={getCategoryMenuItemImage(cat.name)}
                                    alt={cat.name}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <span className={`text-[9px] font-bold text-center px-1 line-clamp-2 leading-tight max-w-full ${activeCategory === cat.id ? 'text-orange-600' : 'text-neutral-500'}`}>
                                {cat.name}
                            </span>
                        </button>
                    ))}
                </aside>

                {/* Main Content */}
                <main className="flex-1 overflow-y-auto p-4 pb-32">
                    <div className="flex flex-col gap-4 mb-4">
                        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                            {categories.find(c => c.id === activeCategory)?.name}
                        </h2>

                        {/* Subcategories */}
                        {subCategories.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-4 px-4">
                                <button
                                    onClick={() => setActiveSubCategory('ALL')}
                                    className={`
                                        whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors border
                                        ${activeSubCategory === 'ALL'
                                            ? 'bg-neutral-900 text-white border-neutral-900'
                                            : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300'}
                                    `}
                                >
                                    All
                                </button>
                                {subCategories.map(sub => (
                                    <button
                                        key={sub.id}
                                        onClick={() => setActiveSubCategory(sub.id)}
                                        className={`
                                            whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors border
                                            ${activeSubCategory === sub.id
                                                ? 'bg-neutral-900 text-white border-neutral-900'
                                                : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-300'}
                                        `}
                                    >
                                        {sub.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        {filteredItems.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 text-sm">
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
                                                <div className="w-full h-full flex items-center justify-center text-gray-300">
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
                                            <p className="text-sm font-bold text-gray-800">₹{item.price.toLocaleString()}</p>
                                            {item.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{item.description}</p>}
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
                <div className="absolute bottom-0 left-0 w-full bg-white border-t border-gray-100 p-4 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-40">
                    <div className="flex justify-between items-end mb-3 px-1">
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Current Order</p>
                            <p className="text-lg font-bold text-charcoal">{totalItems} Items Selected</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Subtotal</p>
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
