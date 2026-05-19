import React from 'react';
import * as LucideIcons from 'lucide-react';

interface SharedQuantityControlProps {
    qty: number;
    onAdd: () => void;
    onUpdateQuantity: (delta: number) => void;
    colorHex?: string; // Optional custom color, defaults to orange-500
    buttonStyle?: 'icon' | 'text'; // 'icon' uses +, 'text' uses 'ADD'
    size?: 'md' | 'lg'; // Controls size of the buttons
}

export default function SharedQuantityControl({
    qty,
    onAdd,
    onUpdateQuantity,
    colorHex = '#ea580c', // Default orange-600
    buttonStyle = 'icon',
    size = 'md'
}: SharedQuantityControlProps) {
    const isDark = colorHex !== '#ea580c' && colorHex !== '#f97316' && colorHex !== '#ffffff';

    const pClass = size === 'lg' ? 'p-3' : 'p-1.5';
    const iconSize = size === 'lg' ? 24 : 16;
    const textClass = size === 'lg' ? 'text-lg min-w-[36px]' : 'text-sm min-w-[24px]';

    if (qty > 0) {
        return (
            <div className={`flex items-center bg-white border shadow-sm overflow-hidden ${size === 'lg' ? 'rounded-2xl' : 'rounded-xl'}`} style={{ borderColor: `${colorHex}30` }}>
                <button 
                    className={`${pClass} transition-colors active:bg-gray-100`}
                    style={{ color: colorHex }}
                    onClick={(e) => { e.stopPropagation(); onUpdateQuantity(-1); }}
                >
                    <LucideIcons.Minus size={iconSize} />
                </button>
                <span className={`px-2 font-black text-center ${textClass} text-black`}>{qty}</span>
                <button 
                    className={`${pClass} transition-colors active:bg-gray-100`}
                    style={{ color: colorHex }}
                    onClick={(e) => { e.stopPropagation(); onUpdateQuantity(1); }}
                >
                    <LucideIcons.Plus size={iconSize} />
                </button>
            </div>
        );
    }

    if (buttonStyle === 'text') {
        const btnClass = size === 'lg' ? 'px-8 py-4 text-base font-black uppercase rounded-[24px]' : 'px-4 py-2 text-xs font-black uppercase rounded-lg';
        return (
            <button 
                onClick={(e) => { e.stopPropagation(); onAdd(); }} 
                className={`${btnClass} bg-white border border-gray-200 shadow-sm active:scale-95 transition-all`}
                style={{ color: colorHex }}
            >
                Add
            </button>
        );
    }

    const iconBtnClass = size === 'lg' ? 'w-14 h-14 rounded-2xl' : 'w-9 h-9 rounded-xl';
    return (
        <button 
            className={`${iconBtnClass} flex items-center justify-center border shadow-sm active:scale-90 transition-transform bg-white`}
            style={{ 
                color: colorHex,
                borderColor: `${colorHex}30` 
            }}
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
        >
            <LucideIcons.Plus size={size === 'lg' ? 24 : 18} />
        </button>
    );
}
