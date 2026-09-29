'use client';

import { useParams } from 'next/navigation';
import { PersistentOrders } from '@/components/customer/PersistentOrders';

export default function CustomerOrdersPage() {
    const params = useParams();
    const restaurantCode = (params.restaurantCode || params.restaurantId) as string;
    const tableNumber = (params.tableNumber) as string;

    if (!restaurantCode || !tableNumber) {
        return null;
    }

    return <PersistentOrders restaurantId={restaurantCode} tableNumber={tableNumber} />;
}
