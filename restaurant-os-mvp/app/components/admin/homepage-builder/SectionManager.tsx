'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
    Layers, Plus, Eye, EyeOff, GripVertical, Trash2, ChevronDown,
    LayoutDashboard, Image as ImageIcon, Grid, Tags, Zap, Award,
    ShoppingBag, Megaphone, ChefHat, LayoutTemplate, MoveUp, MoveDown, Sparkles
} from 'lucide-react';
import { BuilderSection, BuilderState, createDefaultSection, generateId } from './useBuilderState';

const SECTION_ICONS: Record<string, React.ElementType> = {
    header: LayoutDashboard,
    hero_banners: ImageIcon,
    categories: Grid,
    services: Zap,
    specials: ChefHat,
    combos: ShoppingBag,
    offers: Megaphone,
    popular: Award,
    reorder: Layers,
    footer: LayoutTemplate,
};

interface SectionManagerProps {
    sections: BuilderSection[];
    selectedSectionId: string | null;
    dispatch: React.Dispatch<any>;
}

export default function SectionManager({ sections, selectedSectionId, dispatch }: SectionManagerProps) {
    const handleToggleActive = (e: React.MouseEvent, sectionId: string) => {
        e.stopPropagation();
        dispatch({ type: 'TOGGLE_SECTION_ACTIVE', sectionId });
    };

    const sortedSections = [...sections].sort((a, b) => a.order - b.order);

    return (
        <div className="h-full flex flex-col bg-white border-r border-neutral-200">
            {/* Panel Header */}
            <div className="px-5 py-4 border-b border-neutral-100">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                            <Layers size={16} className="text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm text-black">Homepage Sections</h3>
                            <p className="text-[10px] text-black font-medium">Fixed Order System</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section List */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 scrollbar-hide">
                {sortedSections.map((section, index) => {
                    const Icon = SECTION_ICONS[section.type] || Layers;
                    const isSelected = selectedSectionId === section.id;

                    return (
                        <motion.div
                            key={section.id}
                            layout
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ delay: index * 0.03 }}
                            onClick={() => dispatch({ type: 'SELECT_SECTION', sectionId: section.id })}
                            className={`
                                group relative flex items-center gap-2.5 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200
                                ${isSelected
                                    ? 'bg-violet-50 border border-violet-200 shadow-sm shadow-violet-500/5'
                                    : 'hover:bg-neutral-50 border border-transparent'
                                }
                                ${!section.active ? 'opacity-50' : ''}
                            `}
                        >
                            {/* Icon */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                isSelected ? 'bg-violet-100 text-violet-600' : 'bg-neutral-100 text-black'
                            }`}>
                                <Icon size={15} />
                            </div>

                            {/* Title */}
                            <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold truncate ${isSelected ? 'text-violet-900' : 'text-black'}`}>
                                    {section.title || section.type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                </p>
                                <p className="text-[10px] text-black font-medium capitalize">
                                    {section.type.replace('_', ' ')}
                                </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => handleToggleActive(e, section.id)}
                                    className="p-1 rounded-md hover:bg-white transition-colors"
                                    title={section.active ? 'Hide section' : 'Show section'}
                                >
                                    {section.active
                                        ? <Eye size={13} className="text-black" />
                                        : <EyeOff size={13} className="text-black" />
                                    }
                                </button>
                            </div>

                            {/* Selected Indicator */}
                            {isSelected && (
                                <motion.div
                                    layoutId="section-indicator"
                                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-violet-500 rounded-r-full"
                                />
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
