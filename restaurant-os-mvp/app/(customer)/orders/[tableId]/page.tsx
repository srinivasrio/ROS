'use client';

import { OrderService, Order } from '@/app/services/orders';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LucideChevronLeft, LucideFileText, LucideCheck, LucideClock, LucideChefHat, LucideUtensils, LucideCheckCircle, LucidePrinter } from 'lucide-react';
import { formatCurrency } from '@/app/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { InvoiceComponent } from '@/app/components/InvoiceComponent';

// Timeline Component
const OrderTimeline = ({ status }: { status: string }) => {
    const steps = [
        { id: 'placed', icon: LucideClock, label: 'PLACED', color: 'bg-blue-500', shadow: 'shadow-blue-200', hex: '#3b82f6' },
        { id: 'preparing', icon: LucideChefHat, label: 'COOKING', color: 'bg-orange-500', shadow: 'shadow-orange-200', hex: '#f97316' },
        { id: 'ready', icon: LucideUtensils, label: 'READY', color: 'bg-green-500', shadow: 'shadow-green-200', hex: '#22c55e' },
        { id: 'served', icon: LucideCheck, label: 'SERVED', color: 'bg-neutral-900', shadow: 'shadow-neutral-200', hex: '#171717' },
    ];

    const currentStepIndex = steps.findIndex(s => s.id === status);
    const activeIndex = currentStepIndex === -1 ? (status === 'paid' ? 3 : 0) : currentStepIndex;

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 mb-6 relative overflow-hidden">
            <div className="flex justify-between items-start relative z-10 px-2">
                {/* Progress Bar Background */}
                <div className="absolute top-5 left-0 w-full h-0.5 bg-neutral-100 -z-10" />

                {steps.map((step, index) => {
                    const isActive = index <= activeIndex;
                    const isCurrent = index === activeIndex;

                    return (
                        <div key={step.id} className="flex flex-col items-center bg-white px-1">
                            <motion.div
                                initial={false}
                                animate={{
                                    scale: isCurrent ? 1.1 : 1,
                                    backgroundColor: isActive ? step.hex : '#f5f5f5',
                                    borderColor: isActive ? step.hex : '#ffffff'
                                }}
                                className={`size-10 rounded-full flex items-center justify-center transition-all duration-500 border-4 shadow-lg ${isActive ? `text-white ${step.shadow}` : 'text-neutral-300 shadow-none'
                                    }`}
                            >
                                <step.icon size={16} strokeWidth={isActive ? 3 : 2.5} />
                            </motion.div>
                            <span className={`text-[9px] font-black uppercase mt-2 tracking-widest transition-colors duration-300 ${isActive ? 'text-neutral-900' : 'text-neutral-300'
                                }`}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>

            <div className="mt-6 bg-neutral-50 rounded-xl p-3 text-center border border-neutral-100">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={status}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        className="text-xs font-bold text-neutral-500"
                    >
                        {status === 'placed' && "Waiting for kitchen confirmation..."}
                        {status === 'preparing' && "Chefs are preparing your delicious food..."}
                        {status === 'ready' && "Your order is ready to be served!"}
                        {status === 'served' && "Enjoy your meal!"}
                        {status === 'paid' && "Thank you for dining with us!"}
                    </motion.p>
                </AnimatePresence>
            </div>
        </div>
    );
};

// Bill Confirmation Modal
const BillConfirmationModal = ({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-4 right-4 bottom-32 md:left-1/2 md:-translate-x-1/2 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:max-w-sm bg-white rounded-3xl p-6 shadow-2xl z-50 flex flex-col gap-4 text-center"
                    >
                        <div className="size-12 rounded-full bg-neutral-100 flex items-center justify-center mx-auto text-neutral-900">
                            <LucideFileText size={24} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-neutral-900">Request Bill?</h3>
                            <p className="text-sm text-neutral-500 mt-1">
                                Are you ready to settle your bill? A waiter will come to your table shortly.
                            </p>
                        </div>
                        <div className="flex gap-3 mt-2">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 bg-neutral-100 text-neutral-900 font-bold rounded-xl active:scale-95 transition-transform text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={onConfirm}
                                className="flex-1 py-3 bg-neutral-900 text-white font-bold rounded-xl shadow-lg shadow-neutral-900/20 active:scale-95 transition-transform text-sm"
                            >
                                Confirm
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default function CustomerOrdersPage() {
    const params = useParams();
    const router = useRouter();
    const tableId = typeof params.tableId === 'string' && isNaN(Number(params.tableId)) ? params.tableId : Number(params.tableId);

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [showBillConfirmation, setShowBillConfirmation] = useState(false);

    const componentRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: componentRef,
    });

    // Validate Table
    const [isValidTable, setIsValidTable] = useState<boolean | null>(null);
    useEffect(() => {
        const checkTable = async () => {
            if (tableId) {
                const exists = await OrderService.verifyTableExists(tableId);
                setIsValidTable(exists);
            }
        };
        checkTable();
    }, [tableId]);

    if (isValidTable === false) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-sm">
                    <div className="size-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                        <LucideUtensils size={32} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Table Not Found</h2>
                    <p className="text-gray-500 mb-6 font-medium">Please scan a valid QR code.</p>
                </div>
            </div>
        );
    }

    useEffect(() => {
        if (!tableId) return;

        const fetchOrder = async () => {
            try {
                const activeOrder = await OrderService.getActiveOrderForTable(tableId);
                setOrder(activeOrder);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchOrder();

        const sub = OrderService.subscribeToOrders((payload) => {
            if (payload.new && (payload.new as any).table_id === tableId) {
                fetchOrder();
            }
        });

        const subItems = OrderService.subscribeToOrderItems(() => fetchOrder());

        return () => {
            sub.unsubscribe();
            subItems.unsubscribe();
        };
    }, [tableId]);

    // Handle "Request Bill"
    const handleRequestBill = () => {
        setShowBillConfirmation(true);
    };

    const confirmBillRequest = async () => {
        try {
            await OrderService.setTableAlert(tableId, 'bill_requested');
            setShowBillConfirmation(false);
            // Optional: Show success toast or feedback
        } catch (e) {
            console.error(e);
            alert("Failed to request bill.");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900"></div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-8">
                <p className="text-neutral-500 mb-4 font-bold">No active order found.</p>
                <button
                    onClick={() => router.push(`/menu/${tableId}`)}
                    className="bg-neutral-900 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-neutral-900/20"
                >
                    Go to Menu
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white p-4 sticky top-0 z-20 flex items-center justify-between border-b border-neutral-100 shadow-sm pt-safe-top">
                <button
                    onClick={() => router.push(`/menu/${tableId}`)}
                    className="flex items-center text-neutral-600 font-bold text-sm"
                >
                    <LucideChevronLeft size={20} className="-ml-1 mr-1" />
                    Menu
                </button>
                <div className="text-right">
                    <p className="text-xs font-black text-neutral-900 uppercase tracking-widest">ORDER #{order.id.slice(0, 6)}</p>
                    <p className="text-[10px] text-neutral-400 font-bold">Table {tableId}</p>
                </div>
            </header>

            <div className="flex-1 p-4 pb-32 overflow-y-auto">
                {/* Timeline */}
                <OrderTimeline status={order.status} />

                {/* Items List */}
                <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 p-6">
                    <h2 className="text-sm font-bold text-neutral-900 mb-6">Items Ordered</h2>

                    <div className="space-y-6">
                        {order.items?.map((item) => (
                            <div key={item.id} className="flex items-start gap-4">
                                <div className="size-8 bg-neutral-50 rounded-lg flex items-center justify-center text-xs font-bold text-neutral-600 shrink-0 border border-neutral-100">
                                    {item.quantity}x
                                </div>
                                <div className="size-12 bg-gray-100 rounded-lg flex-shrink-0 flex items-center justify-center text-lg overflow-hidden relative border border-gray-100">
                                    {item.image_url ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span>🍽️</span>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-sm font-bold text-neutral-900 leading-tight">{item.name}</h3>
                                        <span className="text-sm font-medium text-neutral-900">{formatCurrency(item.price * item.quantity)}</span>
                                    </div>
                                    <p className={`text-[10px] font-black uppercase mt-1 tracking-widest ${item.status === 'placed' ? 'text-blue-500' :
                                        item.status === 'preparing' ? 'text-orange-500' :
                                            item.status === 'ready' ? 'text-green-600' :
                                                item.status === 'served' ? 'text-neutral-400' : 'text-neutral-400'
                                        }`}>
                                        {item.status || 'PLACED'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Total */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6 mt-4 flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-neutral-500">Total Amount</span>
                        {order.status === 'paid' && (
                            <span className="text-[10px] font-black uppercase tracking-wider text-green-600 bg-green-50 px-2 py-0.5 rounded-md w-fit mt-1 border border-green-100">
                                PAID
                            </span>
                        )}
                    </div>
                    <span className="text-2xl font-black text-neutral-900 tracking-tight">{formatCurrency(order.total_amount * 1.05)}</span>
                </div>
            </div>

            {/* Bottom Actions - Floating above Nav */}
            {/* Bottom Actions - Floating above Nav */}
            <div className="fixed bottom-20 left-0 w-full flex justify-center z-40 pointer-events-none">
                <div className="w-full max-w-xs px-4 flex gap-3">
                    {order.status === 'paid' ? (
                        <div className="w-full flex gap-3 animate-in slide-in-from-bottom-5 pointer-events-auto">
                            <div className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 text-sm">
                                <LucideCheckCircle size={18} />
                                Bill Paid
                            </div>
                            <button
                                onClick={() => handlePrint()}
                                className="flex-1 py-3 bg-white border border-green-200 text-green-700 font-bold rounded-xl shadow-lg shadow-green-600/10 flex items-center justify-center gap-2 text-sm active:scale-95 transition-transform"
                            >
                                <LucidePrinter size={18} />
                                Print Bill
                            </button>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={() => router.push(`/menu/${tableId}`)}
                                className="flex-1 py-2.5 bg-white border border-neutral-200 text-neutral-900 font-bold rounded-xl shadow-sm active:scale-95 transition-transform text-xs pointer-events-auto"
                            >
                                Add More Items
                            </button>
                            <button
                                onClick={handleRequestBill}
                                className="flex-1 py-2.5 bg-neutral-900 text-white font-bold rounded-xl shadow-sm shadow-neutral-900/20 active:scale-95 transition-transform flex items-center justify-center gap-2 text-xs pointer-events-auto"
                            >
                                Request Bill
                                <LucideFileText size={14} className="text-neutral-400" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Bill Confirmation Modal */}
            <BillConfirmationModal
                isOpen={showBillConfirmation}
                onClose={() => setShowBillConfirmation(false)}
                onConfirm={confirmBillRequest}
            />

            {/* Hidden Print Component */}
            <div style={{ display: 'none' }}>
                {order && <InvoiceComponent ref={componentRef} order={order} />}
            </div>
        </div>
    );
}
