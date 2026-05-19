'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import OrderReadyModal from '@/app/[restaurantCode]/waiter/components/OrderReadyModal';
import { OrderService, Order } from '@/app/services/orders';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';

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
    const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; tableId: number | string | null | undefined; items: { name: string; quantity: number; image_url?: string | null }[] }>({
        isOpen: false,
        tableId: 0,
        items: [],
    });

    const [waiterRecord, setWaiterRecord] = useState<any>(null);

    useEffect(() => {
        let active = true;
        const fetchWaiter = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!active) return;
            if (user && restaurantId) {
                try {
                    const record = await OrderService.getWaiterRecord(restaurantId, user.id);
                    if (active) setWaiterRecord(record);
                } catch (err) {
                    console.error('Error fetching waiter record for notifications:', err);
                }
            }
        };
        if (restaurantId && !restaurantLoading) fetchWaiter();
        return () => { active = false; };
    }, [restaurantId, restaurantLoading]);

    const triggerOrderReady = (tableId: number | string | null | undefined, items: { name: string; quantity: number; image_url?: string | null }[]) => {
        setModalConfig({ isOpen: true, tableId, items });
    };

    const handleClose = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };

    const handlePickup = async (orderId?: string) => {
        // Optimistically close
        handleClose();

        // If we had the Order ID here, we could update status to 'served'
        // For MVP, we'll assume the waiter just acknowledges it locally
        // Or we pass the order ID in the modal config to call OrderService.updateOrderStatus(id, 'served')
        if (orderId) {
            if (!restaurantId) return;
            await OrderService.updateOrderStatus(orderId, restaurantId, 'served');
        }
    };

    // Subscribing to Real-time Order Updates
    useEffect(() => {
        let active = true;
        if (!restaurantLoading && restaurantId) {
            const subscription = OrderService.subscribeToOrders(restaurantId, (payload) => {
                if (!active) return;
                const newOrder = payload.new as Order;

                // Trigger ONLY when status changes to 'ready'
                if (newOrder.status === 'ready' && (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT')) {
                    // Double check waiter_id if we have it
                    if (waiterRecord?.id && newOrder.waiter_id !== waiterRecord.id) return;

                    // Fetch full details to get item names
                    OrderService.getOrderDetails(newOrder.id, restaurantId).then(fullOrder => {
                        if (!active) return;
                        if (fullOrder && fullOrder.items) {
                            // Filter for items that are actually 'ready' (exclude served/preparing)
                            const readyItems = fullOrder.items
                                .filter(item => item.status === 'ready')
                                .map(item => ({
                                    name: item.name,
                                    quantity: item.quantity,
                                    image_url: item.image_url
                                }));

                            // Fallback if no specific ready items found (e.g. edge case), show all or generic
                            const displayItems = readyItems.length > 0 ? readyItems : [{ name: 'Order is Ready', quantity: 1 }];

                            triggerOrderReady(fullOrder?.table_number || fullOrder?.table_id || newOrder.table_id || newOrder.merge_group_id, displayItems);
                        } else {
                            triggerOrderReady(fullOrder?.table_number || fullOrder?.table_id || newOrder.table_id || newOrder.merge_group_id, [{ name: 'Order #' + newOrder.id.slice(0, 4), quantity: 1 }]);
                        }
                    });
                }
            }, waiterRecord?.id);

            // Keep track of which order items have already triggered a notification in this session
            const notifiedItemsRef = new Set<string>();

            // Subscribing to Real-time Order Item Updates (For individual item ready)
            const itemSubscription = OrderService.subscribeToOrderItems(restaurantId, (payload) => {
                if (!active) return;
                console.log('--- Real-time Order Item Update Received ---', payload);
                const newItem = payload.new as any;

                // Trigger when an ITEM status changes to 'ready'
                if (newItem.status === 'ready' && (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT')) {
                    // Deduplicate: If we already notified about this exact item turning ready, ignore
                    if (notifiedItemsRef.has(newItem.id)) {
                        console.log('Item already notified, skipping:', newItem.id);
                        return;
                    }
                    notifiedItemsRef.add(newItem.id);

                    console.log('New Item marked ready, fetching full order for table UI...', newItem);
                    // We need the Table ID, which is on the Order, not the Item.
                    // So we must fetch the order details.
                    OrderService.getOrderDetails(newItem.order_id, restaurantId).then(fullOrder => {
                        if (!active) return;
                        if (fullOrder && fullOrder.items) {
                            // Check if this order is assigned to the current waiter
                            if (waiterRecord?.id && fullOrder.waiter_id !== waiterRecord.id) return;

                            const readyItems = fullOrder.items
                                .filter(item => item.status === 'ready')
                                .map(item => ({
                                    name: item.name,
                                    quantity: item.quantity,
                                    image_url: item.image_url
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
                onPickup={() => handlePickup()} // Pass ID if we store it
                tableId={modalConfig.tableId as any}
                items={modalConfig.items}
            />
        </OrderNotificationContext.Provider>
    );
}
