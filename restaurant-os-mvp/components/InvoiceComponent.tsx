import React from 'react';
import { Order } from '@/services/orders.service';
import { formatCurrency } from '@/lib/utils';
import { ChefHat as LucideChefHat, MapPin as LucideMapPin, Phone as LucidePhone, Mail as LucideMail } from 'lucide-react';
import SharedComboCard from '@/components/shared/SharedComboCard';
import { isComboItem, parseComboSubItems } from '@/lib/combo-utils';

interface InvoiceProps {
    order: Order;
}

export const InvoiceComponent = React.forwardRef<HTMLDivElement, InvoiceProps>(({ order }, ref) => {
    const ceil2 = (num: number) => {
        const n = Number(num || 0);
        const clean = Math.round(n * 1e8) / 1e8;
        return Math.ceil(clean * 100) / 100;
    };
    const round2 = ceil2;

    const itemsSubtotal = round2(
        (order.items || []).reduce((sum, item) => sum + ((Number(item.price) || Number((item as any).price_at_time) || 0) * (Number(item.quantity) || 1)), 0)
    );
    const calculatedCgst = (order.items || []).reduce((sum, item) => {
        const rate = (item as any).cgst_percent ?? (item as any).cgst_percentage ?? (((item as any).tax_percent ?? (item as any).gst_percentage ?? 5) / 2);
        return sum + ((Number(item.price) || Number((item as any).price_at_time) || 0) * (Number(item.quantity) || 1) * (rate / 100));
    }, 0);
    const calculatedSgst = (order.items || []).reduce((sum, item) => {
        const rate = (item as any).sgst_percent ?? (item as any).sgst_percentage ?? (((item as any).tax_percent ?? (item as any).gst_percentage ?? 5) / 2);
        return sum + ((Number(item.price) || Number((item as any).price_at_time) || 0) * (Number(item.quantity) || 1) * (rate / 100));
    }, 0);
    const calculatedGst = calculatedCgst + calculatedSgst;

    const cgst = (order.cgst_amount != null && Number(order.cgst_amount) > 0)
        ? round2(Number(order.cgst_amount))
        : round2(calculatedCgst);
    const sgst = (order.sgst_amount != null && Number(order.sgst_amount) > 0)
        ? round2(Number(order.sgst_amount))
        : round2(calculatedSgst);
    const sumCgstSgst = round2(cgst + sgst);
    const gst = sumCgstSgst > 0
        ? sumCgstSgst
        : (order.gst_amount != null && Number(order.gst_amount) > 0
            ? round2(Number(order.gst_amount))
            : round2(calculatedGst));

    const deliveryFee = round2(Number((order as any).delivery_fee || 0));
    const discountAmount = round2(Number(order.discount_amount || 0));

    const subtotal = itemsSubtotal > 0
        ? itemsSubtotal
        : round2(Math.max(0, (Number(order.total_amount) || 0) - gst - deliveryFee + discountAmount));

    const total = (order.total_amount != null && Number(order.total_amount) > 0)
        ? round2(Number(order.total_amount))
        : round2(subtotal + gst + deliveryFee - discountAmount);

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
                            const isCombo = isComboItem(item);
                            const subItems = isCombo ? parseComboSubItems(item) : [];

                            if (isCombo && subItems.length > 0) {
                                return (
                                    <tr key={item.id || `inv-combo-${idx}`} className="border-b border-gray-100 last:border-0">
                                        <td colSpan={4} className="py-4">
                                            <SharedComboCard
                                                name={item.name}
                                                image_url={item.combo_image || item.image_url}
                                                price={item.price}
                                                quantity={item.quantity}
                                                items={subItems}
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
                                <td className="py-4 text-right text-black">{formatCurrency(Number(item.price) || Number((item as any).price_at_time) || 0)}</td>
                                <td className="py-4 text-right font-bold">{formatCurrency(((Number(item.price) || Number((item as any).price_at_time) || 0)) * (item.quantity || 1))}</td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-12">
                <div className="w-1/2 space-y-2">
                    <div className="flex justify-between text-sm text-black">
                        <span>Subtotal</span>
                        <span className="font-medium">{formatCurrency(subtotal)}</span>
                    </div>
                    {cgst > 0 && (
                        <div className="flex justify-between text-sm text-black">
                            <span>CGST</span>
                            <span className="font-medium">{formatCurrency(cgst)}</span>
                        </div>
                    )}
                    {sgst > 0 && (
                        <div className="flex justify-between text-sm text-black">
                            <span>SGST</span>
                            <span className="font-medium">{formatCurrency(sgst)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm text-black font-semibold border-t border-gray-100 pt-1">
                        <span>Total GST</span>
                        <span>{formatCurrency(gst)}</span>
                    </div>
                    {deliveryFee > 0 && (
                        <div className="flex justify-between text-sm text-black font-medium">
                            <span>Delivery Fee</span>
                            <span>{formatCurrency(deliveryFee)}</span>
                        </div>
                    )}
                    {discountAmount > 0 && (
                        <div className="flex justify-between text-sm text-emerald-700 font-medium">
                            <span>Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</span>
                            <span>-{formatCurrency(discountAmount)}</span>
                        </div>
                    )}
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
