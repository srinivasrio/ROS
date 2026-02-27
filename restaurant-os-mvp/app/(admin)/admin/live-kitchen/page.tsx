'use client';

import OrderKanbanBoard from '@/app/components/admin/OrderKanbanBoard';

export default function LiveKitchenPage() {
    return (
        <div className="h-full p-4 flex flex-col">
            <div className="mb-4 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900">Live Kitchen</h1>
                    <p className="text-sm text-neutral-500">Real-time Kitchen Display System</p>
                </div>
            </div>

            <div className="flex-1 border rounded-xl overflow-hidden shadow-sm border-neutral-200">
                <OrderKanbanBoard density="compact" isReadOnly={true} />
            </div>
        </div>
    );
}
