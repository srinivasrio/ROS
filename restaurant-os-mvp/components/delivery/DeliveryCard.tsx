'use client';

import React, { useState } from 'react';
import { 
    Phone, Navigation, MapPin, Package, Clock, CheckCircle2, 
    AlertTriangle, Banknote, ChevronRight, Copy, Check, Eye,
    ArrowRight, Loader2, Sparkles, AlertCircle
} from 'lucide-react';
import { formatCurrency, formatAddress } from '@/lib/utils';

export interface DeliveryAssignment {
    id: string;
    order_id: string;
    delivery_boy_id: string;
    status: string;
    assigned_at: string;
    accepted_at?: string;
    picked_up_at?: string;
    out_for_delivery_at?: string;
    delivered_at?: string;
    cancelled_at?: string;
    cancellation_reason?: string;
    notes?: string;
    order?: {
        id: string;
        order_number?: number;
        total_amount?: number;
        delivery_address?: string;
        delivery_phone?: string;
        customer_name?: string;
        customer_phone?: string;
        delivery_notes?: string;
        delivery_fee?: number;
        delivery_lat?: number | null;
        delivery_lng?: number | null;
        paid_by?: string;
        payment_status?: string;
        status?: string;
        created_at?: string;
        items?: Array<{
            id: string;
            name: string;
            quantity: number;
            price: number;
            notes?: string;
        }>;
    };
    delivery_boy?: any;
}

interface DeliveryCardProps {
    assignment: DeliveryAssignment;
    isUpdating?: boolean;
    onUpdateStatus: (assignmentId: string, status: string, extra?: any) => Promise<void>;
    onOpenDetails: (assignment: DeliveryAssignment) => void;
    onReportIssue: (assignment: DeliveryAssignment) => void;
    onConfirmDelivery: (assignment: DeliveryAssignment) => void;
}

const STATUS_CONFIG: Record<string, { label: string; badgeBg: string; badgeText: string; dotBg: string }> = {
    'ASSIGNED': {
        label: 'Assigned',
        badgeBg: 'bg-blue-500/10 border-blue-500/20',
        badgeText: 'text-blue-600 dark:text-blue-400',
        dotBg: 'bg-blue-500'
    },
    'ACCEPTED': {
        label: 'Accepted',
        badgeBg: 'bg-indigo-500/10 border-indigo-500/20',
        badgeText: 'text-indigo-600 dark:text-indigo-400',
        dotBg: 'bg-indigo-500'
    },
    'PICKED_UP': {
        label: 'Picked Up',
        badgeBg: 'bg-amber-500/10 border-amber-500/20',
        badgeText: 'text-amber-600 dark:text-amber-400',
        dotBg: 'bg-amber-500'
    },
    'OUT_FOR_DELIVERY': {
        label: 'On the Way',
        badgeBg: 'bg-orange-500/10 border-orange-500/20',
        badgeText: 'text-orange-600 dark:text-orange-400',
        dotBg: 'bg-orange-500 animate-pulse'
    },
    'DELIVERED': {
        label: 'Delivered',
        badgeBg: 'bg-emerald-500/10 border-emerald-500/20',
        badgeText: 'text-emerald-600 dark:text-emerald-400',
        dotBg: 'bg-emerald-500'
    },
    'CANCELLED': {
        label: 'Cancelled / Issue',
        badgeBg: 'bg-red-500/10 border-red-500/20',
        badgeText: 'text-red-600 dark:text-red-400',
        dotBg: 'bg-red-500'
    },
    'REASSIGNED': {
        label: 'Reassigned',
        badgeBg: 'bg-purple-500/10 border-purple-500/20',
        badgeText: 'text-purple-600 dark:text-purple-400',
        dotBg: 'bg-purple-500'
    }
};

export default function DeliveryCard({
    assignment,
    isUpdating = false,
    onUpdateStatus,
    onOpenDetails,
    onReportIssue,
    onConfirmDelivery,
}: DeliveryCardProps) {
    const [copied, setCopied] = useState(false);
    const order = assignment.order;
    const status = assignment.status;
    const statusMeta = STATUS_CONFIG[status] || STATUS_CONFIG['ASSIGNED'];

    const orderNumber = order?.order_number || assignment.order_id?.slice(0, 6) || '—';
    const customerName = order?.customer_name || 'Customer';
    const customerPhone = order?.delivery_phone || order?.customer_phone || '';
    const address = formatAddress(order?.delivery_address) || 'Address provided on invoice';
    const itemCount = order?.items?.length || 1;
    const totalAmount = order?.total_amount || 0;

    // Detect Cash on Delivery vs Prepaid
    const isCOD = (order?.paid_by || '').toLowerCase() === 'cash' || 
                  (order?.payment_status || '').toLowerCase() === 'pending' || 
                  (order?.payment_status || '').toLowerCase() === 'unpaid';

    const formatTime = (isoString?: string) => {
        if (!isoString) return '';
        try {
            return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '';
        }
    };

    const handleCopyAddress = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText(address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleOpenNavigation = (e: React.MouseEvent) => {
        e.stopPropagation();
        const query = order?.delivery_lat && order?.delivery_lng 
            ? `${order.delivery_lat},${order.delivery_lng}` 
            : encodeURIComponent(address);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
    };

    return (
        <div className="bg-[#e8edf5] dark:bg-[#1a1e26] rounded-3xl p-4.5 shadow-[-6px_-6px_16px_rgba(255,255,255,0.95),6px_6px_16px_rgba(163,177,198,0.45)] dark:shadow-[-4px_-4px_12px_rgba(255,255,255,0.03),4px_4px_14px_rgba(0,0,0,0.6)] border border-white/60 dark:border-white/5 flex flex-col space-y-3.5 transition-all">
            {/* Header: Order ID & Status */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-slate-400">Order</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">#{orderNumber}</span>
                </div>

                <div className={`px-3 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${statusMeta.badgeBg} ${statusMeta.badgeText}`}>
                    <span className={`size-1.5 rounded-full ${statusMeta.dotBg}`} />
                    <span>{statusMeta.label}</span>
                </div>
            </div>

            {/* Customer Info & Direct Call Button */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customer</p>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white truncate mt-0.5">{customerName}</h4>
                    {customerPhone && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{customerPhone}</p>
                    )}
                </div>

                {customerPhone && (
                    <a
                        href={`tel:${customerPhone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2.5 px-3 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] text-emerald-600 dark:text-emerald-400 shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] transition-all flex items-center gap-1.5 font-bold text-xs shrink-0 cursor-pointer"
                        title="Call Customer"
                    >
                        <Phone size={14} />
                        <span>Call</span>
                    </a>
                )}
            </div>

            {/* Delivery Address & Navigation */}
            <div className="bg-[#e2e8f2] dark:bg-[#13161c] shadow-[inset_2px_2px_5px_rgba(163,177,198,0.45),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] dark:shadow-[inset_2px_2px_6px_rgba(0,0,0,0.6),inset_-2px_-2px_6px_rgba(255,255,255,0.02)] p-3 rounded-2xl flex items-start gap-2.5">
                <MapPin size={16} className="text-orange-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-2 leading-relaxed">
                        {address}
                    </p>
                    {order?.delivery_notes && (
                        <div className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                            <span className="font-bold">Note:</span> {order.delivery_notes}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        onClick={handleCopyAddress}
                        className="p-1.5 rounded-xl bg-[#e8edf5] dark:bg-[#1f242e] text-slate-500 shadow-[-2px_-2px_5px_rgba(255,255,255,0.9),2px_2px_5px_rgba(163,177,198,0.4)] transition-colors"
                        title="Copy Address"
                    >
                        {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    </button>
                    <button
                        onClick={handleOpenNavigation}
                        className="p-1.5 rounded-xl bg-orange-600 text-white shadow-md shadow-orange-600/30 active:scale-95 transition-all"
                        title="Navigate in Google Maps"
                    >
                        <Navigation size={13} />
                    </button>
                </div>
            </div>

            {/* Items, Total, & Payment Status */}
            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                {/* Item count & details trigger */}
                <button
                    onClick={() => onOpenDetails(assignment)}
                    className="p-2.5 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] text-left transition-all flex items-center justify-between cursor-pointer"
                >
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Order Items</p>
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{itemCount} items</p>
                    </div>
                    <Eye size={14} className="text-slate-400" />
                </button>

                {/* Payment Status & Total */}
                <div className={`p-2.5 rounded-2xl flex flex-col justify-center ${
                    isCOD 
                        ? 'bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-500/20' 
                        : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-500/20'
                }`}>
                    <div className="flex items-center gap-1">
                        <Banknote size={12} className={isCOD ? 'text-amber-600' : 'text-emerald-600'} />
                        <span className="text-[10px] font-black uppercase tracking-wider">
                            {isCOD ? 'Cash on Delivery' : 'Prepaid'}
                        </span>
                    </div>
                    <p className="text-xs font-black mt-0.5">
                        {formatCurrency(totalAmount)}
                    </p>
                </div>
            </div>

            {/* Timestamps */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span className="flex items-center gap-1">
                    <Clock size={12} />
                    Assigned: {formatTime(assignment.assigned_at)}
                </span>
                {assignment.picked_up_at && (
                    <span>Picked: {formatTime(assignment.picked_up_at)}</span>
                )}
            </div>

            {/* Action Bar (Tactile Buttons) */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-2">
                {status === 'ASSIGNED' && (
                    <>
                        <button
                            disabled={isUpdating}
                            onClick={() => onUpdateStatus(assignment.id, 'ACCEPTED')}
                            className="flex-1 py-3.5 px-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),3px_5px_14px_rgba(249,115,22,0.4)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                        >
                            {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                            <span>Accept Delivery</span>
                        </button>
                        <button
                            disabled={isUpdating}
                            onClick={() => onReportIssue(assignment)}
                            className="py-3.5 px-4 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] dark:shadow-[-2px_-2px_6px_rgba(255,255,255,0.02),2px_2px_8px_rgba(0,0,0,0.5)] active:shadow-[inset_2px_2px_4px_rgba(163,177,198,0.45)] text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                            title="Decline / Report"
                        >
                            Decline
                        </button>
                    </>
                )}

                {status === 'ACCEPTED' && (
                    <>
                        <button
                            disabled={isUpdating}
                            onClick={() => onUpdateStatus(assignment.id, 'PICKED_UP')}
                            className="flex-1 py-3.5 px-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),3px_5px_14px_rgba(249,115,22,0.4)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                        >
                            {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Package size={15} />}
                            <span>Mark Picked Up</span>
                        </button>
                        <button
                            onClick={() => onReportIssue(assignment)}
                            className="py-3.5 px-3.5 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] text-slate-500 hover:text-red-600 font-bold text-xs cursor-pointer"
                            title="Report Issue"
                        >
                            <AlertTriangle size={15} />
                        </button>
                    </>
                )}

                {status === 'PICKED_UP' && (
                    <>
                        <button
                            disabled={isUpdating}
                            onClick={() => onUpdateStatus(assignment.id, 'OUT_FOR_DELIVERY')}
                            className="flex-1 py-3.5 px-4 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),3px_5px_14px_rgba(249,115,22,0.4)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                        >
                            {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={15} />}
                            <span>Start Delivery (On the Way)</span>
                        </button>
                        <button
                            onClick={() => onReportIssue(assignment)}
                            className="py-3.5 px-3.5 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] text-slate-500 hover:text-red-600 font-bold text-xs cursor-pointer"
                            title="Report Issue"
                        >
                            <AlertTriangle size={15} />
                        </button>
                    </>
                )}

                {status === 'OUT_FOR_DELIVERY' && (
                    <>
                        <button
                            disabled={isUpdating}
                            onClick={() => onConfirmDelivery(assignment)}
                            className="flex-1 py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-[-3px_-3px_8px_rgba(255,255,255,0.8),3px_5px_14px_rgba(16,185,129,0.4)] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                        >
                            {isUpdating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={15} />}
                            <span>{isCOD ? `Collect ${formatCurrency(totalAmount)} & Deliver` : 'Confirm Delivery'}</span>
                        </button>
                        <button
                            onClick={() => onReportIssue(assignment)}
                            className="py-3.5 px-3.5 rounded-2xl bg-[#e8edf5] dark:bg-[#1f242e] shadow-[-3px_-3px_8px_rgba(255,255,255,0.9),3px_3px_8px_rgba(163,177,198,0.4)] text-slate-500 hover:text-red-600 font-bold text-xs cursor-pointer"
                            title="Report Issue"
                        >
                            <AlertTriangle size={15} />
                        </button>
                    </>
                )}

                {status === 'DELIVERED' && (
                    <div className="w-full flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-bold px-1 py-1">
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={15} />
                            <span>Delivered at {formatTime(assignment.delivered_at)}</span>
                        </span>
                        <button
                            onClick={() => onOpenDetails(assignment)}
                            className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                        >
                            Receipt
                        </button>
                    </div>
                )}

                {status === 'CANCELLED' && (
                    <div className="w-full text-xs text-red-600 dark:text-red-400 font-medium px-1 py-1 flex items-center justify-between">
                        <span>{assignment.cancellation_reason || 'Order cancelled'}</span>
                        <button
                            onClick={() => onOpenDetails(assignment)}
                            className="text-xs font-bold text-slate-500 hover:underline cursor-pointer"
                        >
                            Details
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
