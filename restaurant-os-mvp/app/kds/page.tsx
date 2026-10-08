'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { Loader2 } from 'lucide-react';

export default function KDSIndexRedirectPage() {
    const router = useRouter();
    const { restaurantId, loading } = useRestaurantId();

    useEffect(() => {
        if (loading) return;
        if (restaurantId) {
            router.replace(`/${restaurantId}/kds`);
        } else {
            router.replace('/login/kds');
        }
    }, [restaurantId, loading, router]);

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-900">
            <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-200/90 shadow-sm text-xs font-bold text-slate-600">
                <Loader2 className="size-4 text-orange-500 animate-spin" />
                <span>Launching Kitchen Display System...</span>
            </div>
        </div>
    );
}
