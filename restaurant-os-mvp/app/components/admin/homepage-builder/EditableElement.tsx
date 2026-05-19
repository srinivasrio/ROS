'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Edit3, Replace, Trash2, Calendar, Move, GripVertical,
    Plus, Image as ImageIcon, Type, MousePointerClick,
    ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Maximize2, Copy,
} from 'lucide-react';
import { BuilderElement, BuilderSection } from './useBuilderState';

interface HoverControlsProps {
    element: BuilderElement;
    section: BuilderSection;
    isSelected: boolean;
    isHovered: boolean;
    onSelect: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onMoveUp: () => void;
    onMoveDown: () => void;
    onMoveLeft?: () => void;
    onMoveRight?: () => void;
    onSchedule: () => void;
    children: React.ReactNode;
    dispatch: React.Dispatch<any>;
}

export default function EditableElement({
    element,
    section,
    isSelected,
    isHovered,
    onSelect,
    onEdit,
    onDelete,
    onDuplicate,
    onMoveUp,
    onMoveDown,
    onMoveLeft = () => {},
    onMoveRight = () => {},
    onSchedule,
    children,
    dispatch,
}: HoverControlsProps) {
    const [showControls, setShowControls] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const elementRef = useRef<HTMLDivElement>(null);

    // ─────────────────────────── Resizing Logic ───────────────────────────
    // ─────────────────────────── Resizing Logic ───────────────────────────
    const handleResizeStart = (e: React.MouseEvent, handle: string) => {
        e.stopPropagation();
        e.preventDefault();
        setIsResizing(true);

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = elementRef.current?.offsetWidth || 0;
        const startHeight = elementRef.current?.offsetHeight || 0;
        const initialLeft = parseInt(element.style?.left || '0');
        const initialTop = parseInt(element.style?.top || '0');

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            const updates: any = {
                position: 'absolute'
            };
            
            // Width and Left adjustments
            if (handle.includes('r')) {
                updates.width = `${Math.max(40, startWidth + dx)}px`;
            } else if (handle.includes('l')) {
                const newWidth = Math.max(40, startWidth - dx);
                if (newWidth > 40) {
                    updates.width = `${newWidth}px`;
                    updates.left = `${initialLeft + dx}px`;
                }
            }

            // Height and Top adjustments
            if (handle.includes('b')) {
                updates.height = `${Math.max(40, startHeight + dy)}px`;
            } else if (handle.includes('t')) {
                const newHeight = Math.max(40, startHeight - dy);
                if (newHeight > 40) {
                    updates.height = `${newHeight}px`;
                    updates.top = `${initialTop + dy}px`;
                }
            }

            // Clear aspectRatio to allow free resize
            if (element.type === 'banner' || element.type === 'image') {
                updates.aspectRatio = 'auto';
            }

            dispatch({
                type: 'UPDATE_ELEMENT_STYLE',
                sectionId: section.id,
                elementId: element.id,
                style: updates
            });
        };

        const onMouseUp = () => {
            setIsResizing(false);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // ─────────────────────────── Drag Move Logic ───────────────────────────
    const handleDragStart = (e: React.MouseEvent) => {
        // Don't drag if we're clicking a button or handle
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.group\\/handle')) {
            return;
        }

        e.stopPropagation();
        e.preventDefault();

        const startX = e.clientX;
        const startY = e.clientY;
        let moved = false;
        
        // Get initial styles or default to 0
        const initialLeft = parseInt(element.style?.left || '0');
        const initialTop = parseInt(element.style?.top || '0');

        const onMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            // Only start dragging if we've moved at least 3 pixels
            if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
                moved = true;
            }

            if (moved) {
                const updates: any = {
                    position: 'absolute',
                    left: `${initialLeft + dx}px`,
                    top: `${initialTop + dy}px`,
                };

                dispatch({
                    type: 'UPDATE_ELEMENT_STYLE',
                    sectionId: section.id,
                    elementId: element.id,
                    style: updates
                });
            }
        };

        const onMouseUp = () => {
            // If we didn't move, trigger select
            if (!moved) {
                onSelect();
            }
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const hasContent = element.content && (
        element.content.imageUrl ||
        element.content.text ||
        element.content.title ||
        element.content.heading ||
        element.content.label ||
        element.type === 'status'
    );

    const formatStyleValue = (key: string, value: string | number | undefined) => {
        if (value === undefined || value === null || value === '') return undefined;
        const stringValue = value?.toString() || '';
        const unitProps = ['fontSize', 'borderRadius', 'padding', 'margin', 'width', 'height', 'gap', 'minHeight', 'maxWidth', 'maxHeight', 'left', 'top', 'right', 'bottom'];
        
        if (unitProps.includes(key)) {
            if (/^\d+$/.test(stringValue)) return `${stringValue}px`;
            if (/^\d+\.?\d*$/.test(stringValue)) return `${stringValue}px`;
            if (/^\d+(px|em|rem|%|vh|vw)$/.test(stringValue)) return stringValue;
        }
        return stringValue;
    };

    const style = element.style || {};
    const wrapperStyle: React.CSSProperties = {
        position: (style.position as any) || (style.left !== undefined || style.top !== undefined ? 'absolute' : 'relative'),
        left: formatStyleValue('left', style.left),
        top: formatStyleValue('top', style.top),
        right: formatStyleValue('right', style.right),
        bottom: formatStyleValue('bottom', style.bottom),
        width: formatStyleValue('width', style.width),
        height: formatStyleValue('height', style.height),
        zIndex: isSelected ? 50 : (style.zIndex || 1),
        padding: formatStyleValue('padding', style.padding),
        margin: formatStyleValue('margin', style.margin),
        display: style.display as any,
        flexDirection: style.flexDirection as any,
        alignItems: style.alignItems as any,
        justifyContent: style.justifyContent as any,
        gap: formatStyleValue('gap', style.gap),
        opacity: style.opacity,
    };

    return (
        <motion.div
            ref={elementRef}
            layout
            style={wrapperStyle}
            className={`
                group/editable transition-all duration-200
                ${isSelected
                    ? 'ring-2 ring-violet-500 ring-offset-2 rounded-xl z-20 cursor-grab active:cursor-grabbing'
                    : isHovered
                        ? 'ring-2 ring-violet-300/50 ring-offset-1 rounded-xl z-10 cursor-grab'
                        : 'cursor-pointer'
                }
            `}
            onMouseDown={handleDragStart}
            onMouseEnter={() => {
                setShowControls(true);
                dispatch({ type: 'HOVER_ELEMENT', elementId: element.id });
            }}
            onMouseLeave={() => {
                setShowControls(false);
                dispatch({ type: 'HOVER_ELEMENT', elementId: null });
            }}
        >
            {/* Content */}
            {children}

            {/* Hover Overlay */}
            <AnimatePresence>
                {(showControls || isSelected) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute inset-0 pointer-events-none rounded-xl"
                        style={{
                            background: isSelected
                                ? 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(139,92,246,0.02) 100%)'
                                : 'linear-gradient(135deg, rgba(139,92,246,0.03) 0%, transparent 100%)',
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Floating Controls Bar */}
            <AnimatePresence>
                {(showControls || isSelected) && (
                    <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className="absolute -top-11 left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
                    >
                        <div className="flex items-center gap-0.5 bg-neutral-900 rounded-lg px-1.5 py-1 shadow-xl shadow-neutral-900/30">
                            <div 
                                className="p-1.5 text-black hover:text-white cursor-grab active:cursor-grabbing"
                                onMouseDown={handleDragStart}
                                title="Drag to Move"
                            >
                                <Move size={13} strokeWidth={2} />
                            </div>
                            <div className="w-px h-4 bg-neutral-700 mx-0.5" />
                            
                            {hasContent ? (
                                <>
                                    <ControlButton icon={Edit3} label="Edit" onClick={onEdit} />
                                    <ControlButton icon={Copy} label="Duplicate" onClick={onDuplicate} />
                                    <div className="flex items-center gap-0.5 px-1 bg-neutral-800/50 rounded mx-0.5">
                                        <ControlButton icon={ArrowUp} label="Up" onClick={onMoveUp} />
                                        <ControlButton icon={ArrowDown} label="Down" onClick={onMoveDown} />
                                        <ControlButton icon={ArrowLeft} label="Left" onClick={onMoveLeft} />
                                        <ControlButton icon={ArrowRight} label="Right" onClick={onMoveRight} />
                                    </div>
                                    <ControlButton icon={Calendar} label="Schedule" onClick={onSchedule} />
                                    <div className="w-px h-5 bg-neutral-700 mx-0.5" />
                                    <ControlButton icon={Trash2} label="Delete" onClick={onDelete} danger />
                                </>
                            ) : (
                                <ControlButton icon={Plus} label="Add Content" onClick={onEdit} highlight />
                            )}
                        </div>
                        {/* Arrow */}
                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-neutral-900 rotate-45" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Resize Handles */}
            <AnimatePresence>
                {isSelected && !isResizing && (
                    <>
                        {/* Edges */}
                        <ResizeHandle side="t" onMouseDown={(e) => handleResizeStart(e, 't')} />
                        <ResizeHandle side="b" onMouseDown={(e) => handleResizeStart(e, 'b')} />
                        <ResizeHandle side="l" onMouseDown={(e) => handleResizeStart(e, 'l')} />
                        <ResizeHandle side="r" onMouseDown={(e) => handleResizeStart(e, 'r')} />

                        {/* Corners */}
                        <ResizeHandle side="tl" onMouseDown={(e) => handleResizeStart(e, 'tl')} />
                        <ResizeHandle side="tr" onMouseDown={(e) => handleResizeStart(e, 'tr')} />
                        <ResizeHandle side="bl" onMouseDown={(e) => handleResizeStart(e, 'bl')} />
                        <ResizeHandle side="br" onMouseDown={(e) => handleResizeStart(e, 'br')} />
                    </>
                )}
            </AnimatePresence>

            {/* Element Type Badge */}
            <AnimatePresence>
                {isSelected && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-30"
                    >
                        <span className="text-[9px] font-bold uppercase tracking-widest bg-violet-500 text-white px-2 py-0.5 rounded-full shadow-lg whitespace-nowrap">
                            {element.type.replace('_', ' ')}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ─────────── Resize Handle Component ───────────

function ResizeHandle({ 
    side, 
    onMouseDown 
}: { 
    side: 't' | 'b' | 'l' | 'r' | 'tl' | 'tr' | 'bl' | 'br'; 
    onMouseDown: (e: React.MouseEvent) => void;
}) {
    const isCorner = side.length === 2;
    
    const baseClasses = "absolute z-40 transition-all duration-200 group/handle";
    const positionClasses = {
        t: "-top-1 left-0 right-0 h-2 cursor-ns-resize hover:bg-violet-500/30",
        b: "-bottom-1 left-0 right-0 h-2 cursor-ns-resize hover:bg-violet-500/30",
        l: "-left-1 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-violet-500/30",
        r: "-right-1 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-violet-500/30",
        tl: "-left-2 -top-2 w-4 h-4 cursor-nwse-resize",
        tr: "-right-2 -top-2 w-4 h-4 cursor-nesw-resize",
        bl: "-left-2 -bottom-2 w-4 h-4 cursor-nesw-resize",
        br: "-right-2 -bottom-2 w-4 h-4 cursor-nwse-resize",
    }[side];

    return (
        <div 
            className={`${baseClasses} ${positionClasses}`}
            onMouseDown={onMouseDown}
        >
            {isCorner ? (
                <div className="w-full h-full flex items-center justify-center">
                    <div className="w-2.5 h-2.5 bg-white border-2 border-violet-500 rounded-full shadow-md group-hover/handle:scale-125 transition-transform" />
                </div>
            ) : (
                <div className={`
                    absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-violet-500 rounded-full opacity-0 group-hover/handle:opacity-100 transition-opacity
                    ${(side === 't' || side === 'b') ? 'h-1 w-8' : 'w-1 h-8'}
                `} />
            )}
        </div>
    );
}

// ─────────── Small Control Button ───────────

function ControlButton({
    icon: Icon,
    label,
    onClick,
    danger = false,
    highlight = false,
}: {
    icon: React.ElementType;
    label: string;
    onClick: (e: React.MouseEvent) => void;
    danger?: boolean;
    highlight?: boolean;
}) {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onClick(e);
            }}
            title={label}
            className={`
                p-1.5 rounded-md transition-colors
                ${danger
                    ? 'text-black hover:text-red-400 hover:bg-red-500/10'
                    : highlight
                        ? 'text-white bg-violet-600 hover:bg-violet-500'
                        : 'text-black hover:text-white hover:bg-neutral-700'
                }
            `}
        >
            <Icon size={13} strokeWidth={2} />
        </button>
    );
}

// ─────────── Add Content Placeholder ───────────

export function EmptySlotPlaceholder({
    type,
    onClick,
}: {
    type: string;
    onClick: () => void;
}) {
    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full border-2 border-dashed border-neutral-200 hover:border-violet-300 rounded-xl p-8 flex flex-col items-center justify-center gap-2 transition-all hover:bg-violet-50/30 group"
        >
            <div className="w-10 h-10 rounded-xl bg-neutral-100 group-hover:bg-violet-100 flex items-center justify-center transition-colors">
                <Plus size={20} className="text-black group-hover:text-violet-500 transition-colors" />
            </div>
            <span className="text-xs font-semibold text-black group-hover:text-violet-600 capitalize transition-colors">
                Add {type.replace('_', ' ')}
            </span>
        </motion.button>
    );
}
