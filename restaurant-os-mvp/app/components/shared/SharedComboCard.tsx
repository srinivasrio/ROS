import React from 'react';
import Image from 'next/image';
import SharedQuantityControl from './SharedQuantityControl';

interface SharedComboCardProps {
    name: string;
    image_url?: string;
    price: number;
    quantity: number;
    items: { name: string; quantity: number }[];
    notes?: string;
    onUpdateQuantity?: (delta: number) => void;
    onRemove?: () => void;
    onUpdateNotes?: (notes: string) => void;
    readOnly?: boolean;
}

export default function SharedComboCard({
    name,
    image_url,
    price,
    quantity,
    items,
    notes,
    onUpdateQuantity,
    onRemove,
    onUpdateNotes,
    readOnly = false
}: SharedComboCardProps) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-3">
            <div className="flex gap-3">
                {/* Image */}
                <div className="w-20 h-20 bg-gray-100 rounded-lg flex-shrink-0 relative overflow-hidden">
                    {image_url ? (
                        <Image src={image_url} alt={name} fill className="object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">🎁</div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <h3 className="font-bold text-black text-sm leading-tight">{name}</h3>
                        <p className="font-bold text-black text-sm">₹{price * quantity}</p>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                        <p className="text-xs font-bold text-orange-500 uppercase tracking-wide">Combo</p>
                        
                        {!readOnly && onUpdateQuantity && (
                            <SharedQuantityControl 
                                qty={quantity}
                                onAdd={() => {}} // No add logic needed here
                                onUpdateQuantity={(delta) => onUpdateQuantity(delta)}
                                colorHex="#f97316"
                                buttonStyle="text"
                            />
                        )}
                        {readOnly && (
                            <span className="font-bold text-sm text-black">Qty: {quantity}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Included Items */}
            {items && items.length > 0 && (
                <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                    <p className="text-xs font-bold text-black mb-1">INCLUDES:</p>
                    <ul className="text-xs text-black space-y-0.5">
                        {items.map((item, idx) => (
                            <li key={idx} className="flex justify-between">
                                <span>{item.name}</span>
                                <span>x{item.quantity * quantity}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Actions / Notes */}
            {!readOnly && (
                <div className="mt-3 flex items-center justify-between gap-2">
                    <input
                        type="text"
                        value={notes || ''}
                        onChange={(e) => onUpdateNotes?.(e.target.value)}
                        placeholder="Add cooking instructions..."
                        className="flex-1 bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-3 text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all placeholder:text-black"
                    />
                    {onRemove && (
                        <button
                            onClick={onRemove}
                            className="text-[10px] font-bold text-red-500 hover:text-red-600 uppercase tracking-wide px-2 py-1.5"
                        >
                            Remove
                        </button>
                    )}
                </div>
            )}
            
            {readOnly && notes && (
                <div className="mt-2 bg-yellow-50 p-2 rounded text-xs text-yellow-800 border border-yellow-100">
                    <strong>Notes:</strong> {notes}
                </div>
            )}
        </div>
    );
}
