import { redirect } from 'next/navigation';
import { getTableTokenByNumber } from '@/lib/customer-table-session';

export default async function TableRedirectPage({ params }: { params: Promise<{ restaurantCode: string; tableNumber: string }> }) {
    const { restaurantCode, tableNumber } = await params;
    
    // Look up cryptographic table token
    const token = await getTableTokenByNumber(restaurantCode, tableNumber);
    if (token) {
        redirect(`/customer/t/${token}/home`);
    }

    redirect(`/${restaurantCode}/customer?table=${encodeURIComponent(tableNumber)}`);
}

