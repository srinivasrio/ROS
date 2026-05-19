'use client';

import { useState, useEffect } from 'react';
import { OrderService } from '@/app/services/orders';
import OrderKanbanBoard from '@/app/components/admin/OrderKanbanBoard';
import { useParams } from 'next/navigation';

export default function KitchenDashboard() {
    const params = useParams();
    const restaurantId = params.restaurantCode as string;
    const [time, setTime] = useState<string>('');

    useEffect(() => {
        setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        const timer = setInterval(() => {
            setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-neutral-50">
            {/* Top Bar */}
            <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="size-10 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/30">
                        <span className="material-icons-outlined text-white text-2xl">restaurant</span>
                    </div>
                    <h1 className="text-xl font-bold tracking-wide text-black">KDS <span className="text-black font-medium ml-2">Main Kitchen</span></h1>
                </div>

                <div className="flex items-center gap-4">
                    {/* Test Button */}
                    <button
                        onClick={() => OrderService.createTestOrder(Math.floor(Math.random() * 20) + 1, restaurantId)}
                        className="bg-neutral-100 hover:bg-neutral-200 text-black hover:text-black px-3 py-1 rounded text-xs border border-neutral-200 transition-colors font-medium"
                    >
                        + Test Order
                    </button>
                    {/* Clock */}
                    <div className="text-right">
                        <p className="text-lg font-bold font-mono text-black">
                            {time}
                        </p>
                    </div>
                </div>
            </header>

            {/* Kanban Board Component */}
            <div className="flex-1 h-full overflow-hidden">
                <OrderKanbanBoard />
            </div>
        </div>
    );
}
