'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Store, Check, Globe } from 'lucide-react';
import { useOwner } from '@/context/OwnerContext';

export default function BranchSelector() {
    const { 
        selectedRestaurantId, 
        setSelectedRestaurant, 
        restaurants, 
        currentRestaurant, 
        isAllRestaurants 
    } = useOwner();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const displayLabel = isAllRestaurants ? 'All Restaurants' : (currentRestaurant?.name || 'Select Restaurant');
    const activeRestaurants = restaurants.filter(r => r.status === 'active' || r.status === 'ACTIVE');

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2.5 px-4 py-2.5 bg-white dark:bg-zinc-800/60 border border-neutral-200/60 dark:border-zinc-700/40 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-600/40 transition-all shadow-sm group cursor-pointer"
            >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isAllRestaurants ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'bg-emerald-50 dark:bg-emerald-950/30'}`}>
                    {isAllRestaurants ? (
                        <Globe size={14} className="text-indigo-500" />
                    ) : (
                        <Store size={14} className="text-emerald-500" />
                    )}
                </div>
                <div className="text-left min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-neutral-400 dark:text-neutral-500 leading-none">Restaurant</p>
                    <p className="text-sm font-bold text-neutral-800 dark:text-white truncate max-w-[160px]">{displayLabel}</p>
                </div>
                <motion.div
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown size={14} className="text-neutral-400" />
                </motion.div>
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
                        className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-zinc-900 border border-neutral-200/60 dark:border-zinc-700/40 rounded-2xl shadow-xl shadow-black/8 dark:shadow-black/30 z-50 overflow-hidden"
                    >
                        {/* All Restaurants Option */}
                        <button
                            onClick={() => { setSelectedRestaurant('all'); setOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 transition-all cursor-pointer ${
                                isAllRestaurants 
                                    ? 'bg-indigo-50/80 dark:bg-indigo-950/20' 
                                    : 'hover:bg-neutral-50 dark:hover:bg-zinc-800/50'
                            }`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                isAllRestaurants ? 'bg-indigo-100 dark:bg-indigo-900/30' : 'bg-neutral-100 dark:bg-zinc-800'
                            }`}>
                                <Globe size={15} className={isAllRestaurants ? 'text-indigo-500' : 'text-neutral-400'} />
                            </div>
                            <div className="flex-1 text-left">
                                <p className={`text-sm font-bold ${isAllRestaurants ? 'text-indigo-700 dark:text-indigo-300' : 'text-neutral-700 dark:text-neutral-300'}`}>
                                    All Restaurants
                                </p>
                                <p className="text-[10px] text-neutral-400">Consolidated cross-restaurant view</p>
                            </div>
                            {isAllRestaurants && <Check size={16} className="text-indigo-500" />}
                        </button>

                        {/* Divider */}
                        {activeRestaurants.length > 0 && (
                            <div className="px-4 py-2 border-t border-neutral-100 dark:border-zinc-800/60">
                                <p className="text-[9px] font-black uppercase tracking-widest text-neutral-400 dark:text-neutral-500">
                                    {activeRestaurants.length} Restaurant{activeRestaurants.length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        )}

                        {/* Restaurant List */}
                        <div className="max-h-64 overflow-y-auto premium-scrollbar">
                            {activeRestaurants.map((rest, index) => {
                                const isSelected = selectedRestaurantId === rest.id;
                                return (
                                    <motion.button
                                        key={rest.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        onClick={() => { setSelectedRestaurant(rest.id); setOpen(false); }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 transition-all cursor-pointer ${
                                            isSelected 
                                                ? 'bg-emerald-50/80 dark:bg-emerald-950/20' 
                                                : 'hover:bg-neutral-50 dark:hover:bg-zinc-800/50'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                                            isSelected 
                                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' 
                                                : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-500'
                                        }`}>
                                            {rest.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 text-left min-w-0">
                                            <p className={`text-sm font-semibold truncate ${
                                                isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-neutral-700 dark:text-neutral-300'
                                            }`}>
                                                {rest.name}
                                            </p>
                                            <p className="text-[10px] text-neutral-400 font-mono">ID: {rest.id}</p>
                                        </div>
                                        {isSelected && <Check size={16} className="text-emerald-500 flex-shrink-0" />}
                                    </motion.button>
                                );
                            })}
                        </div>

                        {activeRestaurants.length === 0 && (
                            <div className="px-4 py-6 text-center">
                                <Store size={24} className="text-neutral-300 mx-auto mb-2" />
                                <p className="text-xs text-neutral-400">No restaurants found</p>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
