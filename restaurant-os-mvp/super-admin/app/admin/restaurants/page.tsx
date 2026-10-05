'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RestaurantsRedirect() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/admin/owners');
    }, [router]);

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center space-y-3">
                <div className="inline-block h-8 w-8 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin" />
                <p className="text-sm font-bold text-[#172033]">Redirecting to Owners Hub...</p>
                <p className="text-xs text-[#667085]">Restaurants and locations are now managed centrally through their Owner accounts.</p>
            </div>
        </div>
    );
}
