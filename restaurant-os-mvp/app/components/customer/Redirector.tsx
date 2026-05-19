'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import { OrderService } from '@/app/services/orders';
import { Utensils as LucideUtensils } from 'lucide-react';

export function Redirector() {
    const params = useParams();
    const router = useRouter();
    const pathname = usePathname();
    const [error, setError] = useState<string | null>(null);

    // In a [tableId] route, params.tableId is our ID
    // In a [restaurantId]/[tableId] route, params.restaurantId is actually the tableId if it's 2 segments total
    // But since this component is only used in [tableId] routes, params.tableId should be correct.
    const tableId = params.tableId as string;

    useEffect(() => {
        async function doRedirect() {
            if (!tableId) return;
            
            try {
                const tableInfo = await OrderService.findTableAnywhere(tableId);
                
                if (tableInfo && tableInfo.restaurant_id) {
                    const restaurantId = tableInfo.restaurant_id;
                    const segments = pathname.split('/').filter(Boolean);
                    const action = segments[0]; // home, menu, service, etc.
                    
                    // Use table_number if available, otherwise fallback to id
                    const tableIdentifier = tableInfo.table_number || tableInfo.id;
                    
                    let newPath = `/${action}/${restaurantId}/${tableIdentifier}`;
                    
                    // Handle extra segments
                    if (segments.length > 2) {
                        const extra = segments.slice(2).join('/');
                        newPath += `/${extra}`;
                    }
                    
                    router.replace(newPath);
                } else {
                    setError("Table not found. Please scan the QR code again.");
                }
            } catch (e) {
                console.error('Redirection error:', e);
                setError("Something went wrong. Please scan the QR code again.");
            }
        }
        doRedirect();
    }, [tableId, router, pathname]);

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-white p-6 text-center">
                <div className="bg-red-50 p-6 rounded-3xl mb-6">
                    <LucideUtensils className="text-red-500 mx-auto" size={48} />
                </div>
                <h2 className="text-2xl font-black text-black mb-2">No table number in this restaurant</h2>
                <p className="text-black mb-8 max-w-xs">{error}</p>
                <button 
                    onClick={() => window.location.reload()}
                    className="px-8 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-neutral-800 transition-all active:scale-95"
                >
                    Try Again
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
            <p className="text-black font-medium">Redirecting to your table...</p>
        </div>
    );
}
