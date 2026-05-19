'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { OrderService, type Order, type TableMergeGroup } from '@/app/services/orders';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';

export default function WaiterKitchen() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const [orders, setOrders] = useState<Order[]>([]);
    const [mergeGroups, setMergeGroups] = useState<TableMergeGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const params = useParams();
    const staffMobile = params.staffMobile as string;

    useEffect(() => {
        let active = true;
        if (!restaurantLoading && restaurantId) {
            const loadData = async () => {
                try {
                    const [data, groups] = await Promise.all([
                        OrderService.fetchActiveOrders(restaurantId),
                        OrderService.fetchMergeGroups(restaurantId)
                    ]);
                    if (active) {
                        setOrders(data || []);
                        setMergeGroups(groups || []);
                    }
                } catch (err) {
                    console.error('Failed to load kitchen data', err);
                } finally {
                    if (active) setLoading(false);
                }
            };

            loadData();

            const sub = OrderService.subscribeToOrders(restaurantId, () => {
                if (active) loadData();
            });
            const subItems = OrderService.subscribeToOrderItems(restaurantId, () => {
                if (active) loadData();
            });

            return () => {
                active = false;
                sub.unsubscribe();
                subItems.unsubscribe();
            };
        }
        return () => { active = false; };
    }, [restaurantId, restaurantLoading]);

    // Filter Logic
    // Ready: Has at least one item 'ready'
    const readyOrders = orders.filter(o =>
        o.items?.some((i: any) => i.status === 'ready')
    );

    // Cooking: Has items 'preparing' OR is 'placed'/'preparing' status
    // Exclude if it's already in "Ready" list? 
    // Actually an order can be partially ready and partially cooking.
    // The previous design had sections. 
    // Let's show in "Ready" if ANY item is ready (highest priority action).
    // Let's show in "Cooking" if it has preparing items AND NOT completely ready/served.
    // To match KDS logic roughly.

    // Actually, distinct lists usually mean an order appears once.
    // If an order has some ready items, it needs attention (Serve them).
    // If an order has only cooking items, it's just monitoring.
    // So priority: Ready > Cooking.

    const cookingOrders = orders.filter(o =>
        !readyOrders.includes(o) &&
        (o.status === 'placed' || o.status === 'preparing' || o.items?.some((i: any) => i.status === 'preparing'))
    );

    const handleOrderClick = (tableId: number | string | null | undefined, mergeGroupId?: string | null) => {
        if (mergeGroupId) {
            router.push(`/${restaurantId}/waiter/${staffMobile}/order/${mergeGroupId}`);
        } else if (tableId) {
            router.push(`/${restaurantId}/waiter/${staffMobile}/order/${tableId}`);
        }
    };

    const getTableName = (order: Order) => {
        const mgId = order.merge_group_id;
        if (mgId) {
            return mergeGroups.find(g => g.id === mgId)?.display_name || 'Merged';
        }
        return order.table_number || `Table ${order.table_id}`;
    };

    if (loading) {
        return <div className="flex h-full items-center justify-center text-black">Loading Kitchen View...</div>;
    }

    return (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <header className="flex items-center bg-white p-4 pb-2 justify-between sticky top-0 z-10 border-b border-divider shrink-0">
                <div className="text-primary flex size-10 shrink-0 items-center justify-center">
                    <span className="material-icons-outlined text-2xl">skillet</span>
                </div>
                <h2 className="text-charcoal text-lg font-bold leading-tight tracking-tight flex-1 text-center">Kitchen Live</h2>
                <div className="flex w-10 items-center justify-end">
                    <button className="flex cursor-pointer items-center justify-center rounded-lg h-10 w-10 bg-transparent text-charcoal">
                        <span className="material-icons-outlined">refresh</span>
                    </button>
                </div>
            </header>

            {/* Main List */}
            <main className="flex-1 overflow-y-auto pb-32 bg-light-gray/30">

                {/* READY TO SERVE SECTION */}
                {readyOrders.length > 0 && (
                    <>
                        <div className="bg-green-50 border-b border-green-100 p-4 pb-2 sticky top-0 z-0">
                            <div className="flex items-center gap-2 text-green-700 mb-2">
                                <span className="material-icons-outlined text-lg animate-bounce">notifications_active</span>
                                <h3 className="text-xs font-black uppercase tracking-widest">Ready to Serve ({readyOrders.length})</h3>
                            </div>
                        </div>
                        <div className="p-4 grid grid-cols-1 gap-3">
                            {readyOrders.map(order => (
                                <div
                                    key={order.id}
                                    onClick={() => handleOrderClick(order.table_id, order.merge_group_id)}
                                    className="bg-white rounded-xl border border-green-200 shadow-sm overflow-hidden flex flex-col cursor-pointer active:scale-[0.98] transition-transform"
                                >
                                    <div className="p-3 bg-green-50 border-b border-green-100 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="min-w-8 px-2 h-8 rounded bg-green-200 text-green-800 flex items-center justify-center font-bold text-xs">
                                                {getTableName(order)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-black uppercase tracking-wide">ORDER #{order.id.slice(0, 4)}</span>
                                                <span className="text-[10px] font-bold text-black">
                                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                        <span className="px-2 py-0.5 rounded bg-green-200 text-green-800 text-[10px] font-bold uppercase">Ready</span>
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col justify-between">
                                        <div className="mb-3">
                                            {order.items?.filter((i: any) => i.status === 'ready').map((item: any, idx: number) => (
                                                <div key={item.id || `waiter-ready-${idx}`} className="flex justify-between items-start text-sm text-black font-bold leading-tight mb-1">
                                                    <span>{item.quantity}x {item.name}</span>
                                                    <span className="text-green-600 text-[10px] uppercase">Ready</span>
                                                </div>
                                            ))}
                                            {(order.items || []).filter((i: any) => i.status !== 'ready').length > 0 && (
                                                <p className="text-xs text-black mt-2 italic">
                                                    + {(order.items || []).filter((i: any) => i.status !== 'ready').length} other items
                                                </p>
                                            )}
                                        </div>
                                        <button className="w-full h-8 rounded-lg bg-green-600 text-white text-xs font-bold shadow-md shadow-green-200 flex items-center justify-center gap-1">
                                            <span className="material-icons-outlined text-sm">room_service</span>
                                            SERVE NOW
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* COOKING SECTION */}
                {cookingOrders.length > 0 && (
                    <>
                        <div className="bg-orange-50 border-y border-orange-100 p-4 pb-2 mt-2 sticky top-0 z-0">
                            <div className="flex items-center gap-2 text-orange-700 mb-2">
                                <span className="material-icons-outlined text-lg">soup_kitchen</span>
                                <h3 className="text-xs font-black uppercase tracking-widest">Cooking ({cookingOrders.length})</h3>
                            </div>
                        </div>
                        <div className="p-4 grid grid-cols-1 gap-3">
                            {cookingOrders.map(order => (
                                <div
                                    key={order.id}
                                    onClick={() => handleOrderClick(order.table_id, order.merge_group_id)}
                                    className="bg-white rounded-xl border border-divider shadow-sm overflow-hidden flex flex-col cursor-pointer active:scale-[0.98] transition-transform"
                                >
                                    <div className="p-3 bg-gray-50 border-b border-divider flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="min-w-8 px-2 h-8 rounded bg-orange-100 text-orange-800 flex items-center justify-center font-bold text-xs border border-orange-200">
                                                {getTableName(order)}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] font-bold text-black uppercase tracking-wide">ORDER #{order.id.slice(0, 4)}</span>
                                                <span className="text-[10px] font-bold text-black">
                                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-3 flex-1">
                                        <div className="space-y-2">
                                            {order.items?.map((item: any, idx: number) => (
                                                <div key={item.id || `waiter-cooking-${idx}`}>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-xs font-bold text-charcoal">{item.quantity}x {item.name}</span>
                                                        <span className={`text-[9px] font-black uppercase ${item.status === 'ready' ? 'text-green-500' :
                                                            item.status === 'paid' ? 'text-green-500' :
                                                                item.status === 'preparing' ? 'text-orange-500' : 'text-black'
                                                            }`}>
                                                            {item.status === 'preparing' ? 'Cooking' : item.status}
                                                        </span>
                                                    </div>
                                                    <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${item.status === 'ready' ? 'bg-green-500 w-full' :
                                                            item.status === 'preparing' ? 'bg-orange-500 w-2/3' : 'bg-gray-300 w-1/4'
                                                            }`}></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {readyOrders.length === 0 && cookingOrders.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-64 text-black">
                        <span className="material-icons-outlined text-4xl mb-2 opacity-50">check_circle</span>
                        <p className="text-sm">All caught up!</p>
                    </div>
                )}

            </main>
        </div>
    );
}
