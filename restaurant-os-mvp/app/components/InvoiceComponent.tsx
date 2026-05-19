import React from 'react';
import { Order } from '@/app/services/orders';
import { formatCurrency } from '@/app/lib/utils';
import { ChefHat as LucideChefHat, MapPin as LucideMapPin, Phone as LucidePhone, Mail as LucideMail } from 'lucide-react';
import SharedComboCard from '@/app/components/shared/SharedComboCard';

interface InvoiceProps {
    order: Order;
}

export const InvoiceComponent = React.forwardRef<HTMLDivElement, InvoiceProps>(({ order }, ref) => {
    const subtotal = order.total_amount; // Assuming total_amount in DB is subtotal for this logic, or adjust if it includes tax. 
    // Based on previous code: subtotal is total_amount, then tax added.
    // Let's match the logic in OrderDetailsModal: 
    // Subtotal: order.total_amount
    // Tax: order.total_amount * 0.05
    // Total: order.total_amount * 1.05

    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    return (
        <div ref={ref} className="p-8 bg-white text-black font-sans max-w-2xl mx-auto printable-content">
            {/* Header */}
            <div className="text-center mb-8 border-b-2 border-dashed border-gray-200 pb-8">
                <div className="flex justify-center mb-3">
                    <div className="size-16 bg-neutral-900 text-white rounded-full flex items-center justify-center">
                        <LucideChefHat size={32} />
                    </div>
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tight mb-2">Restaurant OS</h1>
                <p className="text-sm text-black font-medium mb-1">123 Culinary Avenue, Food City</p>
                <div className="flex justify-center gap-4 text-xs text-black">
                    <span className="flex items-center gap-1"><LucidePhone size={10} /> +91 98765 43210</span>
                    <span className="flex items-center gap-1"><LucideMail size={10} /> hello@restaurantos.com</span>
                </div>
            </div>

            {/* Order Info */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <p className="text-xs text-black font-bold uppercase tracking-widest mb-1">Bill To</p>
                    <h2 className="text-lg font-bold">Table {order.table_number || order.table_id}</h2>
                    <p className="text-sm text-black">Walk-in Customer</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-black font-bold uppercase tracking-widest mb-1">Invoice Details</p>
                    <p className="text-sm font-bold">#{order.order_number}</p>
                    <p className="text-xs text-black">{new Date(order.created_at).toLocaleDateString()} {new Date(order.created_at).toLocaleTimeString()}</p>
                </div>
            </div>

            {/* Items Table */}
            <div className="mb-8">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b-2 border-neutral-900">
                            <th className="py-3 text-xs font-black uppercase tracking-wider w-1/2">Item</th>
                            <th className="py-3 text-xs font-black uppercase tracking-wider text-center">Qty</th>
                            <th className="py-3 text-xs font-black uppercase tracking-wider text-right">Price</th>
                            <th className="py-3 text-xs font-black uppercase tracking-wider text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {order.items?.map((item, idx) => {
                            if (item.item_type?.toLowerCase() === 'combo') {
                                return (
                                    <tr key={item.id || `inv-combo-${idx}`} className="border-b border-gray-100 last:border-0">
                                        <td colSpan={4} className="py-4">
                                            <SharedComboCard
                                                name={item.name}
                                                image_url={item.image_url}
                                                price={item.price}
                                                quantity={item.quantity}
                                                items={item.combo_items || []}
                                                notes={item.notes}
                                                readOnly={true}
                                            />
                                        </td>
                                    </tr>
                                );
                            }
                            return (
                            <tr key={item.id || `inv-item-${idx}`} className="border-b border-gray-100 last:border-0">
                                <td className="py-4 font-medium">
                                    {item.name}
                                    {item.notes && <p className="text-xs text-black italic mt-0.5">{item.notes}</p>}
                                </td>
                                <td className="py-4 text-center text-black font-bold">{item.quantity}</td>
                                <td className="py-4 text-right text-black">{formatCurrency(item.price)}</td>
                                <td className="py-4 text-right font-bold">{formatCurrency(item.price * item.quantity)}</td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-12">
                <div className="w-1/2 space-y-3">
                    <div className="flex justify-between text-sm text-black">
                        <span>Subtotal</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-black">
                        <span>Tax (5%)</span>
                        <span className="font-medium">{formatCurrency(tax)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-black border-t-2 border-neutral-900 pt-3 mt-3">
                        <span>Grand Total</span>
                        <span>{formatCurrency(total)}</span>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-black border-t border-gray-100 pt-8">
                <p className="font-bold text-black mb-1">Thank you for dining with us!</p>
                <p>This is a computer generated invoice.</p>
            </div>

            <style jsx global>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body { visibility: hidden; }
                    .printable-content { visibility: visible; position: absolute; left: 0; top: 0; width: 100%; }
                    /* Hide other UI elements */
                    header, nav, footer, button { display: none !important; }
                }
            `}</style>
        </div>
    );
});

InvoiceComponent.displayName = 'InvoiceComponent';
