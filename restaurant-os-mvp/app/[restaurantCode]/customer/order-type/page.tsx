'use client';

import { useParams } from 'next/navigation';
import OrderTypeSelector from '@/components/customer/OrderTypeSelector';

export default function OrderTypeSelectionPage() {
    const params = useParams();
    const rawCode = params?.restaurantCode;
    const restaurantCode = (Array.isArray(rawCode) ? rawCode[0] : rawCode) || '';

    if (!restaurantCode) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#EEF2F6]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
        );
    }

    return <OrderTypeSelector restaurantCode={restaurantCode} />;
}
