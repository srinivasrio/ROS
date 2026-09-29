'use client';

import { useParams, useSearchParams } from 'next/navigation';
import CustomerMobileEntry from '@/components/customer/CustomerMobileEntry';

export default function CustomerIndexPage() {
    const params = useParams();
    const searchParams = useSearchParams();

    const rawCode = params?.restaurantCode;
    const restaurantCode = (Array.isArray(rawCode) ? rawCode[0] : rawCode) || '';
    const tableParam = searchParams?.get('table') || searchParams?.get('tableNumber') || searchParams?.get('table_number') || searchParams?.get('t') || null;

    if (!restaurantCode) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#EEF2F6]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
            </div>
        );
    }

    return (
        <CustomerMobileEntry
            restaurantCode={restaurantCode}
            initialTable={tableParam}
        />
    );
}
