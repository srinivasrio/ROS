'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import OrderReadyModal from '../components/OrderReadyModal';
import { OrderService, Order } from '@/app/services/orders';

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
    const [modalConfig, setModalConfig] = useState<{ isOpen: boolean; tableId: number | string | null | undefined; items: { name: string; quantity: number; image_url?: string | null }[] }>({
        isOpen: false,
        tableId: 0,
        items: [],
    });

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
            await OrderService.updateOrderStatus(orderId, 'served');
        }
    };

    // Subscribing to Real-time Order Updates
    useEffect(() => {
        const subscription = OrderService.subscribeToOrders((payload) => {
            const newOrder = payload.new as Order;
            const oldOrder = payload.old as Order;

            // Trigger ONLY when status changes to 'ready'
            if (newOrder.status === 'ready' && (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT')) {
                // Fetch full details to get item names
                OrderService.getOrderDetails(newOrder.id).then(fullOrder => {
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

                        triggerOrderReady(newOrder.table_id || newOrder.merge_group_id, displayItems);
                    } else {
                        triggerOrderReady(newOrder.table_id || newOrder.merge_group_id, [{ name: 'Order #' + newOrder.id.slice(0, 4), quantity: 1 }]);
                    }
                });
            }
        });

        // Subscribing to Real-time Order Item Updates (For individual item ready)
        const itemSubscription = OrderService.subscribeToOrderItems((payload) => {
            const newItem = payload.new as any; // Cast as any because OrderItem type might not match DB payload perfectly

            // Trigger when an ITEM status changes to 'ready'
            if (newItem.status === 'ready' && (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT')) {
                // We need the Table ID, which is on the Order, not the Item.
                // So we must fetch the order details.
                OrderService.getOrderDetails(newItem.order_id).then(fullOrder => {
                    if (fullOrder && fullOrder.items) {
                        // Option A: Show ONLY this ready item?
                        // "Pop even if single item is ready"
                        // But wait, if multiple items are ready, do we show all of them? 
                        // The user probably wants to know "What is ready right now?".
                        // If we just show the one item, it's clear.
                        // If we show all ready items, it might be confusing if some were already picked up?
                        // Let's assume we show ALL currently ready items for context, or just the new one?
                        // Implementation: Show ALL items that are currently 'ready' (not served) for this table/order.

                        const readyItems = fullOrder.items
                            .filter(item => item.status === 'ready')
                            .map(item => ({
                                name: item.name,
                                quantity: item.quantity,
                                image_url: item.image_url
                            }));

                        if (readyItems.length > 0) {
                            triggerOrderReady(fullOrder.table_id || fullOrder.merge_group_id, readyItems);
                        }
                    }
                });
            }
        });

        return () => {
            subscription.unsubscribe();
            itemSubscription.unsubscribe();
        };
    }, []);

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
