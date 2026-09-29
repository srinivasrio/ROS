'use client';

import { use } from 'react';
import { PersistentProfile } from '@/components/customer/PersistentProfile';

export default function CustomerProfilePage({ params: paramsPromise }: any) {
    const params: any = use(paramsPromise);
    const restaurantId = (params?.restaurantCode || params?.restaurantId || '') as string;
    const tableNumber = (params?.tableNumber || '') as string;

    return <PersistentProfile restaurantId={restaurantId} tableNumber={tableNumber} />;
}
