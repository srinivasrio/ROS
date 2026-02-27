'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { OrderService, type Order } from '@/app/services/orders';
import Timer from '@/app/components/Timer';
import { LucideIndianRupee } from 'lucide-react';
import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { InvoiceComponent } from '@/app/components/InvoiceComponent';
import Image from 'next/image';
import { getServiceRequestDetails } from '@/app/lib/service-utils';

export default function OrderDetails() {
    const params = useParams();
    const router = useRouter();
    const tableId = typeof params.tableId === 'string' ? params.tableId : '';

    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
    });

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [serviceRequests, setServiceRequests] = useState<any[]>([]);

    const loadOrder = async () => {
        if (!tableId) return;
        try {
            const data = await OrderService.getActiveOrderForTable(tableId as string | number);
            setOrder(data);
        } catch (err) {
            console.error('Failed to load table order:', err);
        } finally {
            setLoading(false);
        }
    };

    const loadServiceRequests = async () => {
        if (!tableId) return;
        try {
            const data = await OrderService.fetchServiceRequestsForTable(tableId as string | number);
            setServiceRequests(data || []);
        } catch (err) {
            console.error('Failed to load service requests:', err);
        }
    };

    useEffect(() => {
        loadOrder();
        loadServiceRequests();

        const subscription = OrderService.subscribeToOrders(() => {
            loadOrder();
        });

        const serviceSubscription = OrderService.subscribeToServiceRequests(payload => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE' || payload.eventType === 'UPDATE') {
                const newRecord = payload.new as any;
                const oldRecord = payload.old as any;
                if (String(newRecord?.table_id) === String(tableId) || String(oldRecord?.table_id) === String(tableId)) {
                    loadServiceRequests();
                }
            }
        });

        return () => {
            subscription.unsubscribe();
            serviceSubscription.unsubscribe();
        };
    }, [tableId]);

    const handleAction = async (requestId: number, action: 'accept' | 'deliver') => {
        try {
            if (action === 'accept') {
                await OrderService.acceptServiceRequest(requestId);
                setServiceRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'accepted' } : r));
            } else if (action === 'deliver') {
                await OrderService.markRequestDelivered(requestId);
                setServiceRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: 'delivered' } : r));

                // Auto-delete after 2 seconds
                setTimeout(async () => {
                    try {
                        await OrderService.completeServiceRequest(requestId);
                        setServiceRequests(prev => prev.filter(r => r.id !== requestId));
                    } catch (e) {
                        console.error('Failed to auto-delete request', e);
                    }
                }, 2000);
            }
        } catch (err) {
            console.error('Failed to update request:', err);
        }
    };

    const isOccupied = !!order;

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSettleModal, setShowSettleModal] = useState(false);
    const [showClearModal, setShowClearModal] = useState(false);

    const handleMarkServed = () => {
        if (!order) return;
        setShowConfirmModal(true);
    };

    const handleServeItem = async (itemId: string) => {
        try {
            await OrderService.updateOrderItemStatus(itemId, 'served');
            const freshOrder = await OrderService.getActiveOrderForTable(tableId as string | number);
            if (freshOrder) {
                const allServed = freshOrder.items && freshOrder.items.every((i: any) => i.status === 'served');
                if (allServed && freshOrder.status !== 'served') {
                    await OrderService.updateOrderStatus(freshOrder.id, 'served');
                    freshOrder.status = 'served';
                }
                setOrder(freshOrder);
            } else {
                loadOrder();
            }
        } catch (err) {
            console.error('Failed to serve item:', err);
            alert('Failed to serve item');
        }
    };

    const confirmServe = async () => {
        if (!order) return;
        try {
            const unservedItems = order.items?.filter((i: any) => i.status !== 'served') || [];
            await Promise.all(unservedItems.map((item: any) =>
                OrderService.updateOrderItemStatus(item.id, 'served')
            ));
            await OrderService.updateOrderStatus(order.id, 'served');
            setShowConfirmModal(false);
            loadOrder();
        } catch (err) {
            console.error('Failed to mark served:', err);
            alert('Failed to update status');
        }
    };

    const handleSettleBill = () => {
        if (!order) return;
        setShowSettleModal(true);
    };

    const confirmSettle = async () => {
        if (!order) return;
        try {
            await OrderService.settleBill(order.id, undefined, 'Waiter');
            setShowSettleModal(false);
            loadOrder();
        } catch (err) {
            console.error('Failed to settle bill:', err);
            alert('Failed to settle bill');
        }
    };

    const handleClearTable = () => {
        setShowClearModal(true);
    };

    const confirmClear = async () => {
        if (!tableId) return;
        try {
            await OrderService.clearTable(tableId as string | number);
            setShowClearModal(false);
            setOrder(null);
        } catch (err) {
            console.error('Failed to clear table:', err);
            alert('Failed to clear table');
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col h-full bg-white items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    const isPaid = order?.status === 'paid';

    return (
        <div className="flex flex-col h-full bg-white relative">
            {/* Header */}
            <header className="flex items-center bg-white p-4 pb-2 justify-between sticky top-0 z-10 border-b border-divider shrink-0">
                <div className="flex items-center gap-3">
                    <Link href="/waiter/dashboard" className="text-charcoal active:opacity-50">
                        <span className="material-icons-outlined text-2xl">arrow_back</span>
                    </Link>
                </div>

                <h2 className="text-charcoal text-lg font-bold leading-tight tracking-tight flex-1 text-center">
                    {isNaN(Number(tableId)) ? 'Merged Group' : `Table-${tableId}`}
                </h2>

                <div className="flex w-10 items-center justify-end">
                    {isOccupied && !isPaid && (
                        <div className="size-2 rounded-full bg-green-500 animate-pulse"></div>
                    )}
                    {isPaid && (
                        <LucideIndianRupee size={24} className="text-green-500" />
                    )}
                </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-6 bg-light-gray/30 p-4">
                {/* Service Requests Section */}
                {serviceRequests.filter(r => r.request_type !== 'order_ready').length > 0 && (
                    <div className="mb-4 space-y-2">
                        {serviceRequests
                            .filter(r => r.request_type !== 'order_ready')
                            .map(req => {
                                const details = getServiceRequestDetails(req.request_type);
                                return (
                                    <div key={req.id} className={`border rounded-xl p-3 flex items-center justify-between shadow-sm animate-in slide-in-from-top-2 ${details.bg} ${details.borderColor}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="size-12 rounded-lg bg-white shrink-0 overflow-hidden border border-white/50 shadow-sm relative">
                                                {details.image ? (
                                                    <Image
                                                        src={details.image}
                                                        alt={details.label}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                ) : (
                                                    <div className={`flex items-center justify-center size-full ${details.color}`}>
                                                        <details.icon size={24} />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className={`font-bold text-sm uppercase tracking-wide leading-tight ${details.color.replace('text-', 'text-opacity-80 text-').replace('600', '900')}`}>
                                                    {details.label}
                                                </h4>
                                                <p className={`text-xs font-medium ${details.color}`}>
                                                    <Timer startTime={req.created_at} variant="digital" />
                                                </p>
                                            </div>
                                        </div>
                                        {req.status === 'pending' && (
                                            <button
                                                onClick={() => handleAction(req.id, 'accept')}
                                                className={`px-4 py-2 bg-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm border active:scale-95 transition-transform ${details.color} ${details.borderColor}`}
                                            >
                                                Accept
                                            </button>
                                        )}
                                        {req.status === 'accepted' && (
                                            <button
                                                onClick={() => handleAction(req.id, 'deliver')}
                                                className={`px-4 py-2 bg-green-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm active:scale-95 transition-transform border border-green-700`}
                                            >
                                                Mark Done
                                            </button>
                                        )}
                                        {req.status === 'delivered' && (
                                            <span className="px-4 py-2 bg-gray-100 text-gray-500 text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-200">
                                                Delivered
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                )}

                {!isOccupied ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-6 text-center">
                        <div className="size-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
                            <span className="material-icons-outlined text-4xl">table_restaurant</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-charcoal">Table is Empty</h3>
                            <p className="text-sm text-gray-500 mt-1">Scan QR Code to start a new order.</p>
                        </div>
                        <Link
                            href={`/waiter/menu/${tableId}`}
                            className="w-full py-4 bg-neutral-900 text-white font-bold rounded-xl shadow-lg shadow-neutral-900/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
                        >
                            <span className="material-icons-outlined">add_circle</span>
                            Start New Order
                        </Link>
                        {isNaN(Number(tableId)) && (
                            <button
                                onClick={async () => {
                                    try {
                                        await OrderService.unmergeTables(tableId as string);
                                        router.push('/waiter/dashboard');
                                    } catch (err) {
                                        console.error('Failed to unmerge tables:', err);
                                        alert('Failed to unmerge tables');
                                    }
                                }}
                                className="w-full py-4 mt-2 bg-white border border-neutral-200 text-neutral-900 font-bold rounded-xl shadow-sm active:bg-neutral-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-icons-outlined">call_split</span>
                                Unmerge Table
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Order Details Card */}
                        <div className={`bg-white rounded-xl border ${isPaid ? 'border-green-200 ring-2 ring-green-100' : 'border-divider'} shadow-sm overflow-hidden mb-4 transition-all duration-300`}>
                            <div className={`px-4 py-3 border-b border-divider flex justify-between items-center ${isPaid ? 'bg-green-50' : 'bg-gray-50'}`}>
                                <span className={`text-xs font-bold tracking-widest uppercase ${isPaid ? 'text-green-700' : 'text-gray-500'}`}>
                                    {isPaid ? 'BILL SETTLED' : `ORDER #${order.order_number}`}
                                </span>
                                <span className="text-xs font-bold text-gray-500">
                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="divide-y divide-dashed divide-divider">
                                {order.items?.map((item: any, idx) => (
                                    <OrderItem
                                        key={idx}
                                        id={item.id}
                                        name={item.name}
                                        qty={item.quantity}
                                        status={item.status}
                                        isReady={item.status === 'ready'}
                                        isServed={item.status === 'served'}
                                        price={item.price}
                                        notes={item.notes}
                                        onServe={() => handleServeItem(item.id)}
                                        isReadOnly={isPaid}
                                        createdAt={order.created_at}
                                        servedAt={item.served_at}
                                        imageUrl={item.image_url}
                                    />
                                ))}
                            </div>
                            <div className={`p-4 border-t border-divider flex justify-between items-center ${isPaid ? 'bg-green-50' : 'bg-gray-50'}`}>
                                <span className="text-sm font-bold text-charcoal">Total Amount</span>
                                <span className="text-xl font-bold text-charcoal">
                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.total_amount)}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        {isPaid ? (
                            <div className="animate-in slide-in-from-bottom-4 duration-300">
                                <div className="bg-green-100 border border-green-200 rounded-xl p-4 mb-4 flex items-center gap-3">
                                    <span className="material-icons-outlined text-green-700 text-2xl">check_circle</span>
                                    <div>
                                        <h4 className="font-bold text-green-900 leading-tight">Bill Paid</h4>
                                        <p className="text-xs text-green-700 mt-0.5">Table is ready to be cleared.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleClearTable}
                                    className="w-full py-4 bg-charcoal text-white font-bold rounded-xl shadow-lg shadow-neutral-900/20 active:scale-95 transition-transform flex items-center justify-center gap-2"
                                >
                                    <span className="material-icons-outlined">cleaning_services</span>
                                    Free Table for New Guests
                                </button>
                                <button
                                    onClick={() => handlePrint()}
                                    className="w-full mt-3 py-4 bg-white border border-gray-200 text-charcoal font-bold rounded-xl shadow-sm active:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                                    <span className="material-icons-outlined text-orange-600">print</span>
                                    Print KOT
                                </button>
                            </div>
                        ) : (
                            <>
                                <p className="text-gray-500 text-[11px] font-bold leading-normal pb-3 pt-2 uppercase tracking-[0.15em]">Actions</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <Link href={`/waiter/menu/${tableId}`} className="flex flex-col items-center justify-center p-4 bg-white border border-divider rounded-xl shadow-sm active:bg-gray-50 transition-colors">
                                        <span className="material-icons-outlined text-blue-600 text-3xl mb-2">add</span>
                                        <span className="text-xs font-bold text-charcoal uppercase tracking-wide">Add Items</span>
                                    </Link>
                                    <button
                                        onClick={handleMarkServed}
                                        disabled={order.status === 'placed' || order.status === 'preparing'}
                                        className={`flex flex-col items-center justify-center p-4 bg-white border border-divider shadow-sm transition-colors rounded-xl ${order.status === 'placed' || order.status === 'preparing'
                                            ? 'opacity-50 cursor-not-allowed grayscale'
                                            : 'active:bg-gray-50'
                                            }`}
                                    >
                                        <span className="material-icons-outlined text-green-600 text-3xl mb-2">check_circle</span>
                                        <span className="text-xs font-bold text-charcoal uppercase tracking-wide">
                                            {order.status === 'placed' || order.status === 'preparing' ? 'Cooking...' : 'Mark Served'}
                                        </span>
                                    </button>
                                    <button
                                        disabled={true}
                                        className="flex flex-col items-center justify-center p-4 bg-gray-50 border border-divider rounded-xl shadow-sm opacity-50 cursor-not-allowed grayscale"
                                    >
                                        <span className="material-icons-outlined text-gray-400 text-3xl mb-2">print</span>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Print KOT (Pay First)</span>
                                    </button>
                                    <button
                                        onClick={handleSettleBill}
                                        className="flex flex-col items-center justify-center p-4 bg-charcoal text-white rounded-xl shadow-sm active:scale-95 transition-transform"
                                    >
                                        <LucideIndianRupee size={32} className="mb-2" />
                                        <span className="text-xs font-bold uppercase tracking-wide">Settle Bill</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </>
                )}
            </main>

            {/* Serve Confirmation Modal */}
            {showConfirmModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <div className="w-[85%] max-w-sm bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-200 scale-100">
                        <div className="size-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
                            <span className="material-icons-outlined text-green-600 text-4xl">restaurant</span>
                        </div>
                        <h3 className="text-xl font-bold text-charcoal mb-2">Serve Order?</h3>
                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                            This will mark all items as served.
                        </p>
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl active:scale-95 transition-transform"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmServe}
                                className="flex-1 py-3 px-4 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-200 active:scale-95 transition-transform"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settle Bill Modal */}
            {showSettleModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <div className="w-[85%] max-w-sm bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-200 scale-100">
                        <div className="size-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
                            <span className="material-icons-outlined text-blue-600 text-4xl">payments</span>
                        </div>
                        <h3 className="text-xl font-bold text-charcoal mb-2">Settle Bill?</h3>
                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                            Total Amount: {order && new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(order.total_amount)}
                            <br />
                            This will mark the order as Paid.
                        </p>
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setShowSettleModal(false)}
                                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl active:scale-95 transition-transform"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSettle}
                                className="flex-1 py-3 px-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 active:scale-95 transition-transform"
                            >
                                Pay & Close
                            </button>
                        </div>
                    </div>
                </div>
            )}



            {/* Clear Table Modal */}
            {showClearModal && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200">
                    <div className="w-[85%] max-w-sm bg-white rounded-2xl shadow-2xl p-6 flex flex-col items-center text-center animate-in zoom-in-95 duration-200 scale-100">
                        <div className="size-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                            <span className="material-icons-outlined text-red-600 text-4xl">cleaning_services</span>
                        </div>
                        <h3 className="text-xl font-bold text-charcoal mb-2">Free Table?</h3>
                        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                            Confirm that guests have left and the table is clean for new customers.
                        </p>
                        <div className="flex gap-3 w-full">
                            <button
                                onClick={() => setShowClearModal(false)}
                                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-bold rounded-xl active:scale-95 transition-transform"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmClear}
                                className="flex-1 py-3 px-4 bg-red-600 text-white font-bold rounded-xl shadow-lg shadow-red-200 active:scale-95 transition-transform"
                            >
                                Confirm Clear
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Print Component */}
            <div style={{ display: 'none' }}>
                {order && <InvoiceComponent ref={componentRef} order={order} />}
            </div>
        </div>
    );
}

function OrderItem({ id, name, qty, status, isReady, isServed, price, notes, onServe, isReadOnly, createdAt, servedAt, imageUrl }: { id: string, name: string; qty: number; status: string; isReady?: boolean; isServed?: boolean; price: number; notes?: string, onServe: () => void, isReadOnly?: boolean, createdAt: string, servedAt?: string, imageUrl?: string }) {
    return (
        <div className={`p-4 flex gap-3 ${isReady ? 'bg-green-50/50' : ''}`}>
            <div className="relative size-14 rounded-lg overflow-hidden shrink-0 border border-gray-100 bg-gray-50 flex items-center justify-center">
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={name}
                        fill
                        className="object-cover"
                    />
                ) : (
                    <span className="material-icons-outlined text-gray-300 text-2xl">restaurant</span>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <div className="flex items-start gap-2">
                        <span className="flex items-center justify-center h-5 min-w-[20px] rounded bg-gray-100 text-[10px] font-bold text-charcoal px-1 mt-0.5">
                            {qty}x
                        </span>
                        <div>
                            <p className="text-sm font-bold text-charcoal leading-tight line-clamp-2">{name}</p>
                            {notes && <p className="text-[10px] text-gray-500 italic mt-0.5">{notes}</p>}
                            <div className="flex items-center gap-2 mt-1">
                                <p className={`text-[10px] font-bold uppercase tracking-wide ${status === 'ready' ? 'text-green-600' :
                                    status === 'served' ? 'text-gray-400' :
                                        status === 'paid' ? 'text-green-600' :
                                            'text-orange-500'
                                    }`}>{status === 'preparing' ? 'COOKING' : status}</p>

                                {/* Timer Logic */}
                                <span className="text-[10px] text-gray-300">•</span>
                                {isServed && servedAt ? (
                                    <Timer
                                        startTime={createdAt}
                                        endTime={servedAt}
                                        className="text-[10px] font-medium text-green-600"
                                        prefix="In "
                                    />
                                ) : (
                                    <Timer
                                        startTime={createdAt}
                                        className="text-[10px] font-medium text-gray-400"
                                        prefix=""
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                        <p className="text-xs font-bold text-neutral-600">
                            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(price * qty)}
                        </p>
                        {/* Only show serve button if item is ready but not yet served */}
                        {isReady && !isServed && !isReadOnly && (
                            <button
                                onClick={onServe}
                                className="mt-1 flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-sm shadow-green-200 active:scale-95 transition-transform ml-auto"
                            >
                                <span>SERVE</span>
                            </button>
                        )}
                        {isServed && (
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1 block">SERVED</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
