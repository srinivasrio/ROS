'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function AreasRedirectPage() {
    const router = useRouter();
    const params = useParams();
    const restaurantCode = params?.restaurantCode as string;

    useEffect(() => {
        if (restaurantCode) {
            router.replace(`/${restaurantCode}/admin/tables?tab=areas`);
        }
    }, [restaurantCode, router]);

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-3 text-neutral-500">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
                <p className="text-sm font-semibold">Redirecting to Tables & Areas...</p>
            </div>
        </div>
    );
}
