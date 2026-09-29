import React from 'react';
import * as LucideIcons from 'lucide-react';

interface SharedQuantityControlProps {
    qty: number;
    onAdd: () => void;
    onUpdateQuantity: (delta: number) => void;
    colorHex?: string; // Optional custom color, defaults to orange-500
    buttonStyle?: 'icon' | 'text'; // 'icon' uses +, 'text' uses 'ADD'
    size?: 'sm' | 'md' | 'lg'; // Controls size of the buttons
}

export default function SharedQuantityControl({
    qty,
    onAdd,
    onUpdateQuantity,
    colorHex = '#ea580c', // Default orange-600
    buttonStyle = 'icon',
    size = 'md'
}: SharedQuantityControlProps) {
    const iconSize = size === 'lg' ? 20 : (size === 'sm' ? 11 : 15);
    const textClass = size === 'lg' ? 'text-base min-w-[28px]' : (size === 'sm' ? 'text-[11px] font-black min-w-[16px]' : 'text-xs min-w-[20px]');
    const containerHeight = size === 'lg' ? 'h-12 min-w-[116px]' : (size === 'sm' ? 'h-6 min-w-[62px]' : 'h-8 min-w-[80px]');
    const btnSizeClass = size === 'lg' ? 'w-10 h-12' : (size === 'sm' ? 'w-5 h-5 rounded-md' : 'w-7 h-8');

    if (qty > 0) {
        return (
            <div 
                className={`inline-flex items-center justify-between border shadow-xs overflow-hidden select-none p-0.5 gap-1 ${containerHeight} ${size === 'lg' ? 'rounded-2xl' : (size === 'sm' ? 'rounded-lg' : 'rounded-xl')}`} 
                style={{ borderColor: `${colorHex}45`, backgroundColor: `${colorHex}0c` }}
            >
                {/* Fixed-size Decrease Button (-) highlighted with vibrant color */}
                <button 
                    type="button"
                    className={`flex items-center justify-center transition-all active:scale-90 shrink-0 rounded-lg shadow-2xs font-bold cursor-pointer hover:opacity-95 ${btnSizeClass}`}
                    style={{ backgroundColor: colorHex, color: '#ffffff' }}
                    onClick={(e) => { e.stopPropagation(); onUpdateQuantity(-1); }}
                    aria-label="Decrease count"
                >
                    <LucideIcons.Minus size={iconSize} strokeWidth={3} />
                </button>

                {/* Fixed-width Centered Quantity */}
                <span className={`px-1 font-black text-center ${textClass} text-slate-900 tabular-nums flex-1`}>
                    {qty}
                </span>

                {/* Fixed-size Increase Button (+) highlighted with vibrant color */}
                <button 
                    type="button"
                    className={`flex items-center justify-center transition-all active:scale-90 shrink-0 rounded-lg shadow-2xs font-bold cursor-pointer hover:opacity-95 ${btnSizeClass}`}
                    style={{ backgroundColor: colorHex, color: '#ffffff' }}
                    onClick={(e) => { e.stopPropagation(); onUpdateQuantity(1); }}
                    aria-label="Increase count"
                >
                    <LucideIcons.Plus size={iconSize} strokeWidth={3} />
                </button>
            </div>
        );
    }

    if (buttonStyle === 'text') {
        const btnClass = size === 'lg' 
            ? 'h-12 min-w-[116px] px-6 text-sm font-black uppercase rounded-2xl' 
            : 'h-8 min-w-[80px] px-3 text-xs font-black uppercase rounded-xl';
        return (
            <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); onAdd(); }} 
                className={`${btnClass} inline-flex items-center justify-center border shadow-xs active:scale-95 transition-all select-none font-black cursor-pointer`}
                style={{ 
                    color: colorHex,
                    backgroundColor: `${colorHex}12`,
                    borderColor: `${colorHex}50`
                }}
            >
                Add
            </button>
        );
    }

    const iconBtnClass = size === 'lg' ? 'w-12 h-12 rounded-2xl' : 'w-8 h-8 rounded-xl';
    return (
        <button 
            type="button"
            className={`${iconBtnClass} inline-flex items-center justify-center border shadow-xs active:scale-90 transition-transform select-none cursor-pointer`}
            style={{ 
                color: colorHex,
                backgroundColor: `${colorHex}12`,
                borderColor: `${colorHex}50` 
            }}
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
        >
            <LucideIcons.Plus size={iconSize} strokeWidth={3} />
        </button>
    );
}
