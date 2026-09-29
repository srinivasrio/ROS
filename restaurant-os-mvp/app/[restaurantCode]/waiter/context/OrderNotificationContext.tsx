'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import OrderReadyModal from '@/app/[restaurantCode]/waiter/components/OrderReadyModal';
import { OrderService, Order } from '@/services/orders.service';
import { useRestaurantId } from '@/hooks/useRestaurantId';

interface OrderNotificationContextType {
    triggerOrderReady: (tableId: number | string | null | undefined, items: { name: string; quantity: number; image_url?: string | null }[]) => void;
}

const OrderNotificationContext = createContext<OrderNotificationContextType | undefined>(undefined);

export function useOrderNotification() {
    const context = useContext(OrderNotificationContext);
    if (!context) {
        throw new Error('useOrderNotification must be used within an OrderNotificationProvider');
    }
    return context;
}

export function OrderNotificationProvider({ children }: { children: ReactNode }) {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const params = useParams();
    const staffMobile = params?.staffMobile as string;

    const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; tableId: number | string | null | undefined; items: { name: string; quantity: number; image_url?: string | null }[] }>({
        isOpen: false,
        tableId: 0,
        items: [],
    });

    const [waiterRecord, setWaiterRecord] = useState<any>(null);

    useEffect(() => {
        let active = true;
        const fetchWaiter = async () => {
            try {
                if (typeof window !== 'undefined') {
                    const cached = localStorage.getItem('waiterSession');
                    if (cached) {
                        const parsed = JSON.parse(cached);
                        if (active && parsed?.id) {
                            setWaiterRecord(parsed);
                            return;
                        }
                    }
                }
            } catch (_) {}

            if (restaurantId && staffMobile) {
                try {
                    const waiter = await OrderService.getStaffByMobile(staffMobile, restaurantId);
                    if (active && waiter?.id) {
                        setWaiterRecord(waiter);
                    }
                } catch (_) {}
            }
        };
        fetchWaiter();
        return () => { active = false; };
    }, [restaurantId, staffMobile]);

    const triggerOrderReady = (tableId: number | string | null | undefined, items: { name: string; quantity: number; image_url?: string | null }[]) => {
        setModalConfig({ isOpen: true, tableId, items });
    };

    const handleClose = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };

    const handlePickup = async (orderId?: string) => {
        handleClose();
        if (orderId && restaurantId) {
            await OrderService.updateOrderStatus(orderId, restaurantId, 'served');
        }
    };

    // Helper to strictly verify that an order or its table is currently assigned to this waiter
    const isOrderAssignedToWaiter = (fullOrder: any, currentWaiterId: string): boolean => {
        if (!fullOrder || !currentWaiterId) return false;
        const orderWaiterId = fullOrder.waiter_id ? String(fullOrder.waiter_id).toLowerCase() : null;
        const tableAssignedId = fullOrder.tables?.assigned_waiter_id
            ? String(fullOrder.tables.assigned_waiter_id).toLowerCase()
            : (fullOrder.table_merge_groups?.assigned_waiter_id ? String(fullOrder.table_merge_groups.assigned_waiter_id).toLowerCase() : null);
        const coWaiters: string[] = Array.isArray(fullOrder.tables?.co_waiter_ids)
            ? fullOrder.tables.co_waiter_ids.map((id: any) => String(id).toLowerCase())
            : [];

        // STRICT ROUTING: Only return true if this waiter is the primary assigned waiter or an approved co-waiter
        if (orderWaiterId === currentWaiterId) return true;
        if (tableAssignedId === currentWaiterId) return true;
        if (coWaiters.includes(currentWaiterId)) return true;

        // Unassigned or assigned to someone else -> ZERO notifications or popups
        return false;
    };

    // Subscribing to Real-time Order Updates — strictly requiring active waiterRecord
    useEffect(() => {
        let active = true;
        // Unassigned or not-yet-loaded waiters receive ZERO notifications
        if (!restaurantLoading && restaurantId && waiterRecord?.id) {
            const currentWaiterId = String(waiterRecord.id).toLowerCase();

            const subscription = OrderService.subscribeToOrders(restaurantId, (payload) => {
                if (!active) return;
                const newOrder = payload.new as Order;

                // Trigger ONLY when status changes to 'ready'
                if (newOrder.status === 'ready' && (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT')) {
                    // Fetch full details to check order & table assignment
                    OrderService.getOrderDetails(newOrder.id, restaurantId).then(fullOrder => {
                        if (!active || !fullOrder) return;
                        if (!isOrderAssignedToWaiter(fullOrder, currentWaiterId)) {
                            // Unassigned or assigned to another waiter -> drop notification
                            return;
                        }

                        if (fullOrder.items) {
                            // Filter for items that are actually 'ready'
                            const readyItems = fullOrder.items
                                .filter(item => item.status === 'ready')
                                .map(item => ({
                                    name: item.name,
                                    quantity: item.quantity,
                                    image_url: item.image_url,
                                    combo_items: item.combo_items,
                                    item_type: item.item_type
                                }));

                            const displayItems = readyItems.length > 0 ? readyItems : [{ name: 'Order is Ready', quantity: 1 }];
                            triggerOrderReady(fullOrder?.table_number || fullOrder?.table_id || newOrder.table_id || newOrder.merge_group_id, displayItems);
                        } else {
                            triggerOrderReady(fullOrder?.table_number || fullOrder?.table_id || newOrder.table_id || newOrder.merge_group_id, [{ name: 'Order #' + newOrder.id.slice(0, 4), quantity: 1 }]);
                        }
                    });
                }
            }, waiterRecord.id);

            // Keep track of which order items have already triggered a notification in this session
            const notifiedItemsRef = new Set<string>();

            // Subscribing to Real-time Order Item Updates (For individual item ready)
            const itemSubscription = OrderService.subscribeToOrderItems(restaurantId, (payload) => {
                if (!active) return;
                const newItem = payload.new as any;

                // Trigger when an ITEM status changes to 'ready'
                if (newItem.status === 'ready' && (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT')) {
                    if (notifiedItemsRef.has(newItem.id)) {
                        return;
                    }
                    notifiedItemsRef.add(newItem.id);

                    OrderService.getOrderDetails(newItem.order_id, restaurantId).then(fullOrder => {
                        if (!active || !fullOrder) return;
                        if (!isOrderAssignedToWaiter(fullOrder, currentWaiterId)) {
                            // Unassigned or assigned to another waiter -> drop notification
                            return;
                        }

                        if (fullOrder.items) {
                            const readyItems = fullOrder.items
                                .filter(item => item.status === 'ready')
                                .map(item => ({
                                    name: item.name,
                                    quantity: item.quantity,
                                    image_url: item.image_url,
                                    combo_items: item.combo_items,
                                    item_type: item.item_type
                                }));

                            if (readyItems.length > 0) {
                                triggerOrderReady(fullOrder?.table_number || fullOrder?.table_id || fullOrder?.merge_group_id, readyItems);
                            }
                        }
                    });
                }
            });

            return () => {
                active = false;
                subscription.unsubscribe();
                itemSubscription.unsubscribe();
            };
        }
    }, [restaurantId, restaurantLoading, waiterRecord?.id]);

    return (
        <OrderNotificationContext.Provider value={{ triggerOrderReady }}>
            {children}
            <OrderReadyModal
                isOpen={modalConfig.isOpen}
                onClose={handleClose}
                onPickup={() => handlePickup()}
                tableId={modalConfig.tableId as any}
                items={modalConfig.items}
            />
        </OrderNotificationContext.Provider>
    );
}
