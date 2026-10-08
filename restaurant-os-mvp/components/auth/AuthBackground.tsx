'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useMotionValue } from 'framer-motion';

interface AuthBackgroundProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * High-end interactive background with mixed colors moving like gravity
 * when the cursor is moved across the screen.
 * Replaces old neumorphism with luminous, fluid multi-color gravitational light fields.
 */
export function AuthBackground({ children, className = '' }: AuthBackgroundProps) {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    // Smooth spring physics for fluid gravitational drift
    const springConfig = { damping: 25, stiffness: 45, mass: 0.8 };
    const orb1X = useSpring(mouseX, springConfig);
    const orb1Y = useSpring(mouseY, springConfig);

    const springConfig2 = { damping: 35, stiffness: 35, mass: 1.2 };
    const orb2X = useSpring(mouseX, springConfig2);
    const orb2Y = useSpring(mouseY, springConfig2);

    const springConfig3 = { damping: 45, stiffness: 25, mass: 1.6 };
    const orb3X = useSpring(mouseX, springConfig3);
    const orb3Y = useSpring(mouseY, springConfig3);

    const springConfig4 = { damping: 55, stiffness: 20, mass: 2.0 };
    const orb4X = useSpring(mouseX, springConfig4);
    const orb4Y = useSpring(mouseY, springConfig4);

    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        // Default center position
        const defaultX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
        const defaultY = typeof window !== 'undefined' ? window.innerHeight / 3 : 300;
        mouseX.set(defaultX);
        mouseY.set(defaultY);

        const handleMouseMove = (e: MouseEvent) => {
            mouseX.set(e.clientX);
            mouseY.set(e.clientY);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                mouseX.set(e.touches[0].clientX);
                mouseY.set(e.touches[0].clientY);
            }
        };

        window.addEventListener('mousemove', handleMouseMove, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: true });

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('touchmove', handleTouchMove);
        };
    }, [mouseX, mouseY]);

    return (
        <div className={`min-h-screen w-full relative overflow-x-hidden overflow-y-auto flex flex-col justify-center items-center p-4 sm:p-6 bg-slate-950 text-slate-900 ${className}`}>
            {/* ── GRAVITATIONAL MIXED-COLORS CANVAS / LIGHT FIELD ── */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#0B0F19]">
                {/* Deep background ambient gradient */}
                <div className="absolute inset-0 bg-radial from-slate-900/60 via-slate-950 to-black" />

                {/* Orb 1: Coral / Warm Flame (Primary Gravity Follower) */}
                <motion.div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                        x: orb1X,
                        y: orb1Y,
                        width: 520,
                        height: 520,
                        marginLeft: -260,
                        marginTop: -260,
                        background: 'radial-gradient(circle, rgba(255, 107, 107, 0.45) 0%, rgba(255, 142, 83, 0.25) 45%, transparent 70%)',
                        filter: 'blur(70px)',
                    }}
                />

                {/* Orb 2: Electric Violet / Purple (Gravity Orbit 1) */}
                <motion.div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                        x: orb2X,
                        y: orb2Y,
                        width: 600,
                        height: 600,
                        marginLeft: -150,
                        marginTop: -380,
                        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.45) 0%, rgba(99, 102, 241, 0.2) 50%, transparent 70%)',
                        filter: 'blur(80px)',
                    }}
                />

                {/* Orb 3: Turquoise / Teal (Gravity Orbit 2) */}
                <motion.div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                        x: orb3X,
                        y: orb3Y,
                        width: 550,
                        height: 550,
                        marginLeft: -380,
                        marginTop: -150,
                        background: 'radial-gradient(circle, rgba(78, 205, 196, 0.4) 0%, rgba(34, 197, 94, 0.15) 50%, transparent 70%)',
                        filter: 'blur(80px)',
                    }}
                />

                {/* Orb 4: Golden Amber / Sunset Pink (Counter-balance Drift) */}
                <motion.div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                        x: orb4X,
                        y: orb4Y,
                        width: 580,
                        height: 580,
                        marginLeft: -290,
                        marginTop: -100,
                        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, rgba(236, 72, 153, 0.2) 45%, transparent 70%)',
                        filter: 'blur(85px)',
                    }}
                />

                {/* Subtle Geometric Constellation Overlay */}
                <div
                    className="absolute inset-0 opacity-[0.15]"
                    style={{
                        backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px)`,
                        backgroundSize: '36px 36px',
                    }}
                />
            </div>

            {/* ── FOREGROUND CONTENT (Login card & Animated Logo) ── */}
            <div className="relative z-10 w-full flex flex-col items-center my-auto py-6 sm:py-10">
                {children}
            </div>
        </div>
    );
}

export default AuthBackground;
