'use client';

import { useState, useEffect } from 'react';
import { OrderService } from '@/services/orders.service';
import OrderKanbanBoard from '@/components/admin/OrderKanbanBoard';
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
        <div className="flex flex-col h-screen overflow-hidden bg-neutral-50 text-neutral-900 font-sans">
            {/* Top Bar */}
            <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-neutral-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm shadow-black/5">
                <div className="flex items-center gap-4">
                    <div className="size-10 bg-gradient-to-br from-orange-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <span className="material-icons-outlined text-white text-xl">restaurant</span>
                    </div>
                    <h1 className="text-lg font-black tracking-wider text-neutral-900">KDS <span className="text-neutral-500 font-semibold ml-2 text-sm uppercase tracking-widest bg-neutral-100 px-3 py-1 rounded-lg">Main Kitchen</span></h1>
                </div>

                <div className="flex items-center gap-4">
                    {/* Clock */}
                    <div className="bg-white border border-neutral-200 px-4 py-1.5 rounded-xl shadow-sm">
                        <p className="text-base font-black font-mono text-orange-600 tracking-wider">
                            {time}
                        </p>
                    </div>
                </div>
            </header>

            {/* Kanban Board Component */}
            <div className="flex-1 h-full overflow-hidden bg-neutral-50">
                <OrderKanbanBoard />
            </div>
        </div>
    );
}
