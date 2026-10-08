'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import CustomerCart from '@/app/[restaurantCode]/customer/cart/[tableNumber]/page';

export default function CustomerTokenCartPage() {
    const params = useParams();
    const token = (params?.token as string) || '';

    const [sessionData, setSessionData] = useState<{
        restaurant_id: string;
        restaurant_slug: string;
        table_number: string;
    } | null>(() => {
        if (typeof window === 'undefined' || !token) return null;
        try {
            const raw = sessionStorage.getItem(`ros_session_${token}`);
            if (raw) return JSON.parse(raw);
        } catch {}
        return null;
    });

    useEffect(() => {
        if (sessionData || !token) return;

        let isMounted = true;
        async function fetchSession() {
            try {
                const res = await fetch('/api/customer/table-session/validate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.valid && data.table && isMounted) {
                        const targetRes = data.restaurant.slug || data.restaurant.id;
                        setSessionData({
                            restaurant_id: data.restaurant.id,
                            restaurant_slug: targetRes,
                            table_number: data.table.table_number,
                        });
                    }
                }
            } catch (err) {
                console.error('[CustomerTokenCartPage] Failed to load session:', err);
            }
        }
        fetchSession();

        return () => {
            isMounted = false;
        };
    }, [token, sessionData]);

    if (!sessionData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-3" />
                <p className="text-xs font-semibold text-slate-500">Loading your cart...</p>
            </div>
        );
    }

    return (
        <CustomerCart
            restaurantCode={sessionData.restaurant_slug || sessionData.restaurant_id}
            tableNumber={sessionData.table_number}
        />
    );
}
