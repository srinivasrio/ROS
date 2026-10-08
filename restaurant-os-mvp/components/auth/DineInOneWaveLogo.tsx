'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface DineInOneWaveLogoProps {
    portalName?: string;
    subText?: string;
    size?: number | 'sm' | 'md' | 'lg' | 'xl';
    className?: string;
}

const SIZE_MAP: Record<string, number> = {
    sm: 48,
    md: 56,
    lg: 72,
    xl: 84,
};

/**
 * Animated Dine in One logo with the signature wave animation on each letter
 * of the logo text (matching the main website wave animation).
 */
export function DineInOneWaveLogo({
    portalName,
    subText,
    size = 'md',
    className = '',
}: DineInOneWaveLogoProps) {
    const pixelSize = typeof size === 'number' ? size : (SIZE_MAP[size] || 64);
    const letters = [
        { char: 'D', isGradient: false },
        { char: 'i', isGradient: false },
        { char: 'n', isGradient: false },
        { char: 'e', isGradient: false },
        { char: '\u00A0', isGradient: false },
        { char: 'i', isGradient: true },
        { char: 'n', isGradient: true },
        { char: '\u00A0', isGradient: false },
        { char: 'O', isGradient: false },
        { char: 'n', isGradient: false },
        { char: 'e', isGradient: false },
    ];

    return (
        <div className={`flex flex-col items-center select-none text-center ${className}`}>
            {/* Logo Icon with subtle floating glow */}
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="relative mb-4 group cursor-pointer"
            >
                <div
                    className="relative flex items-center justify-center rounded-2xl bg-white shadow-xl shadow-orange-500/20 border border-white/80 p-2.5 overflow-hidden transition-transform duration-300 hover:scale-105"
                    style={{ width: pixelSize, height: pixelSize }}
                >
                    <img
                        src="/favicon.png"
                        alt="Dine in One"
                        className="w-full h-full object-contain"
                    />
                </div>
                {/* Ambient pulse halo */}
                <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-r from-orange-500/30 to-rose-500/30 blur-lg animate-pulse" />
            </motion.div>

            {/* Wave Animated Text: Dine in One */}
            <div className="flex items-center justify-center text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
                {letters.map((item, index) => (
                    <motion.span
                        key={index}
                        animate={{
                            y: [0, -7, 0],
                        }}
                        transition={{
                            duration: 1.6,
                            repeat: Infinity,
                            ease: 'easeInOut',
                            delay: index * 0.1,
                        }}
                        className={`inline-block ${
                            item.isGradient
                                ? 'bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] bg-clip-text text-transparent font-black px-[1px]'
                                : 'text-white'
                        }`}
                    >
                        {item.char}
                    </motion.span>
                ))}
            </div>

            {/* Smart POS / Portal Subtitle */}
            <div className="mt-1.5 flex flex-col items-center">
                <span className="text-[9px] font-black tracking-[0.35em] text-white/70 uppercase">
                    SMART POS
                </span>

                {portalName && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-[10px] font-extrabold uppercase tracking-widest text-orange-200">
                        <span>{portalName}</span>
                    </div>
                )}

                {subText && (
                    <p className="text-xs text-slate-300/80 font-medium mt-1 max-w-xs text-center">
                        {subText}
                    </p>
                )}
            </div>
        </div>
    );
}

export default DineInOneWaveLogo;
