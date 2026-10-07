'use client';

import React from 'react';

export interface DineInOneLogoProps {
    size?: number | string;
    className?: string;
    imgClassName?: string;
    priority?: boolean;
    showText?: boolean;
    textSize?: string;
}

export function DineInOneLogo({
    size = 56,
    className = '',
    imgClassName = '',
    priority = true,
    showText = false,
    textSize = 'text-2xl',
}: DineInOneLogoProps) {
    const dimensionStyle = typeof size === 'number' ? { width: size, height: size } : { width: size, height: size };

    return (
        <div className={`inline-flex items-center gap-3 ${className}`}>
            <div
                className="relative inline-flex items-center justify-center rounded-2xl bg-white shadow-lg shadow-indigo-500/10 border border-slate-200/80 p-2 overflow-hidden shrink-0 select-none transition-transform hover:scale-105"
                style={dimensionStyle}
            >
                <img
                    src="/favicon.png"
                    alt="Dine in One"
                    className={`w-full h-full object-contain ${imgClassName}`}
                    loading={priority ? 'eager' : 'lazy'}
                />
            </div>
            {showText && (
                <span className={`font-black tracking-tight text-slate-900 ${textSize}`}>
                    Dine <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">in</span> One
                </span>
            )}
        </div>
    );
}

export default DineInOneLogo;
