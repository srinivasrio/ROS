'use client';

import { OrderService } from '../services/orders';
import OrderKanbanBoard from '../components/admin/OrderKanbanBoard';

export default function KitchenDashboard() {
    return (
        <div className="flex flex-col h-screen overflow-hidden bg-neutral-50">
            {/* Top Bar */}
            <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="size-10 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-500/30">
                        <span className="material-icons-outlined text-white text-2xl">restaurant</span>
                    </div>
                    <h1 className="text-xl font-bold tracking-wide text-neutral-900">KDS <span className="text-neutral-400 font-medium ml-2">Main Kitchen</span></h1>
                </div>

                <div className="flex items-center gap-4">
                    {/* Test Button */}
                    <button
                        onClick={() => OrderService.createTestOrder(Math.floor(Math.random() * 20) + 1)}
                        className="bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-black px-3 py-1 rounded text-xs border border-neutral-200 transition-colors font-medium"
                    >
                        + Test Order
                    </button>
                    {/* Clock */}
                    <div className="text-right">
                        <p className="text-lg font-bold font-mono text-neutral-800">
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
