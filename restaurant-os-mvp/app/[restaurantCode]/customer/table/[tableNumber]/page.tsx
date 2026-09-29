import { redirect } from 'next/navigation';

export default async function TableRedirectPage({ params }: { params: Promise<{ restaurantCode: string; tableNumber: string }> }) {
    const { restaurantCode, tableNumber } = await params;
    redirect(`/${restaurantCode}/customer?table=${encodeURIComponent(tableNumber)}`);
}

