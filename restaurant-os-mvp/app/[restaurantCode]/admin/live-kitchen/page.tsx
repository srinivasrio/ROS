'use client';

import OrderKanbanBoard from '@/app/components/admin/OrderKanbanBoard';

export default function LiveKitchenPage() {
    return (
        <div className="p-8 flex flex-col h-screen space-y-7 overflow-hidden">
            <div className="shrink-0">
                <h1 className="text-2xl font-black text-black tracking-tight">Live Kitchen</h1>
                <p className="text-sm font-medium text-black mt-1">Real-time Kitchen Display System (KDS) for order processing.</p>
            </div>

            <div className="flex-1 bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden flex flex-col min-h-0">
                <OrderKanbanBoard density="compact" isReadOnly={true} />
            </div>
        </div>
    );
}
