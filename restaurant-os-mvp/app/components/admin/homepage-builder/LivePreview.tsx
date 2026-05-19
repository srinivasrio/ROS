'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
const { Plus, Utensils, Search, Bell, Star, Clock, ChevronRight, MapPin, Phone, Tags, Instagram, Globe, Mail, MousePointer2, Image: ImageIcon, LayoutGrid, Type, Award, ChefHat, ShoppingBag, Flame, FileText } = LucideIcons;
import { BuilderSection, BuilderElement, BuilderState, ThemeConfig, createDefaultElement, generateId } from './useBuilderState';
import EditableElement, { EmptySlotPlaceholder } from './EditableElement';

interface LivePreviewProps {
    state: BuilderState;
    dispatch: React.Dispatch<any>;
}

const MOBILE_WIDTH = '390px';

const formatStyleValue = (key: string, value: string | number | undefined) => {
    if (value === undefined || value === null || value === '') return undefined;
    const stringValue = value?.toString() || '';
    const unitProps = ['fontSize', 'borderRadius', 'padding', 'margin', 'width', 'height', 'gap', 'minHeight', 'maxWidth', 'maxHeight', 'left', 'top', 'right', 'bottom'];
    
    if (unitProps.includes(key)) {
        if (/^-?\d+\.?\d*$/.test(stringValue)) return `${stringValue}px`;
        if (/^-?\d+\.?\d*(px|em|rem|%|vh|vw)$/.test(stringValue)) return stringValue;
    }
    
    if (key === 'width' && stringValue === 'full') return '100%';
    if (key === 'height' && stringValue === 'auto') return 'auto';
    
    return stringValue;
};

export default function LivePreview({ state, dispatch }: LivePreviewProps) {
    const { sections, theme: rawTheme, selectedElementId, selectedSectionId, hoveredElementId, previewMode } = state;

    // Normalize snake_case ThemeConfig to camelCase for render usage
    const theme = {
        primaryColor: rawTheme.primary_color,
        secondaryColor: rawTheme.secondary_color,
        backgroundColor: rawTheme.bg_color,
        buttonColor: rawTheme.button_color,
        cardRadius: rawTheme.card_radius,
        fontFamily: rawTheme.font_family,
        webpageBgColor: rawTheme.webpage_bg_color,
        headerBgColor: rawTheme.header_bg_color,
    };

    const sortedSections = [...sections].sort((a, b) => a.order - b.order);

    const handleSelectElement = (elementId: string, sectionId: string) => {
        dispatch({ type: 'SELECT_ELEMENT', elementId, sectionId });
    };

    const handleAddElement = (sectionId: string, type: BuilderElement['type']) => {
        const section = sections.find(s => s.id === sectionId);
        const order = section ? section.elements.length : 0;
        const element = createDefaultElement(type, sectionId, order);
        dispatch({ type: 'ADD_ELEMENT', sectionId, element });
        dispatch({ type: 'SELECT_ELEMENT', elementId: element.id, sectionId });
    };

    const handleDeleteElement = (sectionId: string, elementId: string) => {
        dispatch({ type: 'REMOVE_ELEMENT', sectionId, elementId });
    };

    const handleDuplicateElement = (sectionId: string, element: BuilderElement) => {
        const newEl = { ...element, id: generateId(), order: element.order + 1 };
        dispatch({ type: 'ADD_ELEMENT', sectionId, element: newEl });
    };

    const handleMoveElement = (sectionId: string, index: number, dir: 'up' | 'down' | 'left' | 'right') => {
        const section = sections.find(s => s.id === sectionId);
        if (!section) return;
        const toIndex = (dir === 'up' || dir === 'left') ? index - 1 : index + 1;
        if (toIndex < 0 || toIndex >= section.elements.length) return;
        dispatch({ type: 'MOVE_ELEMENT', sectionId, fromIndex: index, toIndex });
    };

    const handleInlineEdit = (sectionId: string, elementId: string, field: string, value: string) => {
        dispatch({ type: 'UPDATE_ELEMENT_CONTENT', sectionId, elementId, content: { [field]: value } });
    };

    // Google Font link
    const fontImport = theme.fontFamily && theme.fontFamily !== 'Inter'
        ? `https://fonts.googleapis.com/css2?family=${theme.fontFamily.replace(/ /g, '+')}:wght@300;400;500;600;700;800;900&display=swap`
        : null;

    // Device frame dimensions (Mobile Only)
    const frameStyles = { width: '380px', height: '780px', borderRadius: '3.5rem' };

    return (
        <div className="h-full overflow-y-auto bg-neutral-50 flex flex-col items-center py-12 px-4 no-scrollbar">
            {/* Load custom font */}
            {fontImport && (
                // eslint-disable-next-line @next/next/no-page-custom-font
                <link rel="stylesheet" href={fontImport} />
            )}

            {/* Header info */}
            <div className="mb-6 text-center">
                <h3 className="text-sm font-bold text-black uppercase tracking-widest mb-1">Mobile Preview</h3>
                <p className="text-xs text-black">Drag and resize elements to build your homepage</p>
            </div>
            
            {/* 📱 Mobile Device Frame */}
            <div className="relative mx-auto" style={{ width: '380px' }}>
                {/* Outer Shell */}
                <div 
                    className="relative bg-neutral-900 shadow-[0_0_0_2px_#000000,0_20px_50px_rgba(0,0,0,0.3)] ring-1 ring-white/10 overflow-hidden rounded-[3.5rem] p-3"
                    style={{ 
                        width: '380px', 
                        height: '780px'
                    }}
                >
                    {/* Inner Border */}
                    <div className="absolute inset-2 rounded-[2.8rem] border-[3px] border-neutral-800 pointer-events-none z-50" />
                    
                    {/* Notch / Dynamic Island */}
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 w-32 h-7 bg-neutral-900 rounded-full z-[60] flex items-center justify-end px-4 gap-1.5 shadow-inner">
                        <div className="w-2 h-2 rounded-full bg-neutral-800" />
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/20" />
                    </div>

                    {/* Status Bar Mock */}
                    <div className="absolute top-8 left-10 right-10 flex justify-between items-center z-50 px-2">
                        <span className="text-[10px] font-bold text-black">9:41</span>
                        <div className="flex items-center gap-1.5">
                            <LucideIcons.Wifi size={10} className="text-black" />
                            <LucideIcons.Battery size={12} className="text-black" />
                        </div>
                    </div>

                    {/* Screen Content Container */}
                    <div 
                        className={`w-full h-full bg-white overflow-hidden relative group transition-all duration-500`}
                        style={{ 
                            fontFamily: `'${theme.fontFamily}', sans-serif`,
                            backgroundColor: theme.backgroundColor || '#ffffff',
                            borderRadius: previewMode === 'desktop' ? '0' : '2.5rem'
                        }}
                    >
                        {/* Scrollable Content */}
                        <div 
                            className="h-full overflow-y-auto no-scrollbar scroll-smooth"
                            onClick={() => dispatch({ type: 'SELECT_ELEMENT', elementId: null })}
                        >
                            {sortedSections.map(section => {
                                if (!section.active) return null;
                                return (
                                    <div
                                        key={section.id}
                                        onClick={(e) => { e.stopPropagation(); dispatch({ type: 'SELECT_SECTION', sectionId: section.id }); }}
                                        className={`relative transition-all duration-200 ${selectedSectionId === section.id ? 'ring-2 ring-violet-500/40 ring-inset' : ''}`}
                                    >
                                        <RenderSection
                                            section={section}
                                            theme={theme}
                                            previewMode={previewMode}
                                            selectedElementId={selectedElementId}
                                            hoveredElementId={hoveredElementId}
                                            onSelectElement={handleSelectElement}
                                            onAddElement={handleAddElement}
                                            onDeleteElement={handleDeleteElement}
                                            onDuplicateElement={handleDuplicateElement}
                                            onMoveElement={handleMoveElement}
                                            onInlineEdit={handleInlineEdit}
                                            dispatch={dispatch}
                                        />
                                    </div>
                                );
                            })}
                            
                            {/* Home Indicator */}
                            <div className="sticky bottom-2 left-1/2 -translate-x-1/2 w-28 h-1 bg-neutral-200 rounded-full z-50 opacity-50" />
                        </div>
                    </div>

                    {/* Physical Buttons Mock */}
                    <div className="absolute left-[-2px] top-32 w-[3px] h-12 bg-neutral-700 rounded-r-sm" />
                    <div className="absolute left-[-2px] top-48 w-[3px] h-16 bg-neutral-700 rounded-r-sm" />
                    <div className="absolute left-[-2px] top-68 w-[3px] h-16 bg-neutral-700 rounded-r-sm" />
                    <div className="absolute right-[-2px] top-44 w-[3px] h-24 bg-neutral-700 rounded-l-sm" />
                </div>
            </div>
        </div>
    );
}

function RenderSection({ section, theme, previewMode, selectedElementId, hoveredElementId, onSelectElement, onAddElement, onDeleteElement, onDuplicateElement, onMoveElement, onInlineEdit, dispatch }: any) {
    const props = { selectedElementId, hoveredElementId, onSelectElement, onAddElement, onDeleteElement, onDuplicateElement, onMoveElement, onInlineEdit, dispatch, previewMode };
    
    switch (section.type) {
        case 'header':
            return <HeaderSection theme={theme} section={section} {...props} />;
        case 'hero_banners':
            return <BannerSlideshowSection section={section} theme={theme} {...props} />;
        case 'categories':
            return <GridSection section={section} theme={theme} elementType="category" {...props} />;
        case 'services':
            return <GridSection section={section} theme={theme} elementType="service" {...props} />;
        case 'specials':
            return <ScrollSection section={section} theme={theme} elementType="chef_special" {...props} />;
        case 'combos':
            return <ScrollSection section={section} theme={theme} elementType="combo" {...props} />;
        case 'offers':
            return <ScrollSection section={section} theme={theme} elementType="offer" {...props} />;
        case 'popular':
            return <GridSection section={section} theme={theme} elementType="popular_item" {...props} />;
        case 'reorder':
            return <ReorderSection section={section} theme={theme} {...props} />;
        case 'footer':
            return <FooterSection theme={theme} section={section} {...props} />;
        default:
            return <div className="p-4 border border-dashed border-neutral-200 rounded-lg text-center text-xs text-black">Unknown Section Type: {section.type}</div>;
    }
}

/* ═══════════════ Reorder Section ═══════════════ */

function ReorderSection({ section, theme, selectedElementId, hoveredElementId, onSelectElement, onAddElement, onDeleteElement, onDuplicateElement, onMoveElement, onInlineEdit, dispatch }: any) {
    const { elements } = section;
    return (
        <div className="px-6 py-6 bg-neutral-50/50">
            <h2 className="text-lg font-bold mb-4 text-black">{section.title || "Quick Reorder"}</h2>
            <div className="flex gap-4 overflow-x-auto no-scrollbar">
                {elements.length > 0 ? (
                    elements.map((el: any, index: number) => (
                        <div key={el.id} className="min-w-[200px] shrink-0">
                            <EditableElement
                                element={el}
                                section={section}
                                isSelected={selectedElementId === el.id}
                                isHovered={hoveredElementId === el.id}
                                onSelect={() => onSelectElement(el.id, section.id)}
                                onEdit={() => onSelectElement(el.id, section.id)}
                                onDelete={() => onDeleteElement(section.id, el.id)}
                                onDuplicate={() => onDuplicateElement(section.id, el)}
                                onMoveUp={() => onMoveElement(section.id, index, 'up')}
                                onMoveDown={() => onMoveElement(section.id, index, 'down')}
                                onSchedule={() => {}}
                                dispatch={dispatch}
                            >
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-100 flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center overflow-hidden">
                                        {el.content.imageUrl ? <img src={el.content.imageUrl} className="w-full h-full object-cover" /> : <Clock size={20} className="text-black" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-black truncate">{el.content.title || "Last Order"}</p>
                                        <p className="text-[10px] text-black">{el.content.date || "2 days ago"}</p>
                                    </div>
                                    <button className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </EditableElement>
                        </div>
                    ))
                ) : (
                    <div className="w-full">
                        <EmptySlotPlaceholder type="reorder_card" onClick={() => onAddElement(section.id, 'reorder_card')} />
                    </div>
                )}
            </div>
        </div>
    );
}

/* ═══════════════ Header ═══════════════ */

function HeaderSection({ theme, section, selectedElementId, hoveredElementId, onSelectElement, onAddElement, onDeleteElement, onDuplicateElement, onMoveElement, onInlineEdit, dispatch }: any) {
    const elements = section.elements || [];
    const layout = section.layout || {};
    
    const logoEl = elements.find((el: any) => el.type === 'image' && el.content?.isLogo);
    const headingEl = elements.find((el: any) => el.type === 'heading');
    const subtitleEl = elements.find((el: any) => el.type === 'subtitle');
    const statusEl = elements.find((el: any) => el.type === 'status');
    const tableInfoEl = elements.find((el: any) => el.type === 'table_info');

    const renderWrappedElement = (el: any) => (
        <EditableElement
            key={el.id}
            element={el}
            section={section}
            isSelected={selectedElementId === el.id}
            isHovered={hoveredElementId === el.id}
            onSelect={() => onSelectElement(el.id, section.id)}
            onEdit={() => onSelectElement(el.id, section.id)}
            onDelete={() => onDeleteElement(section.id, el.id)}
            onDuplicate={() => onDuplicateElement(section.id, el)}
            onMoveUp={() => {}}
            onMoveDown={() => {}}
            onMoveLeft={() => {}}
            onMoveRight={() => {}}
            onSchedule={() => {}}
            dispatch={dispatch}
        >
            <RenderElement isWrapped={true} element={el} section={section} theme={theme} onInlineEdit={(f: string, v: string) => onInlineEdit(section.id, el.id, f, v)} />
        </EditableElement>
    );

    const shadowStyles: Record<string, string> = {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        none: 'none'
    };

    return (
        <div 
            className="relative overflow-hidden w-full transition-all duration-300"
            style={{ 
                padding: layout.padding || '32px 24px',
                margin: layout.margin || '0px',
                borderRadius: layout.borderRadius || '0px',
                backgroundColor: layout.background || '#ffffff',
                border: layout.borderColor ? `1px solid ${layout.borderColor}` : 'none',
                boxShadow: shadowStyles[layout.boxShadow || 'none'],
                opacity: layout.opacity !== undefined ? layout.opacity / 100 : 1,
                minHeight: '140px'
            }}
        >
            {/* Background Image & Overlay */}
            {layout.backgroundImage && (
                <>
                    <div 
                        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${layout.backgroundImage})` }}
                    />
                    <div 
                        className="absolute inset-0 z-1"
                        style={{ 
                            backgroundColor: 'black',
                            opacity: (layout.overlayOpacity || 0) / 100 
                        }}
                    />
                </>
            )}

            <div className="relative z-10 max-w-2xl mx-auto h-full grid grid-cols-[auto_1fr_auto] gap-x-4 items-start">
                {/* Logo Area (Top Left) */}
                <div className="flex items-start pt-1">
                    {logoEl ? renderWrappedElement(logoEl) : (
                        <div className="p-2 border border-dashed border-neutral-200 rounded-lg" onClick={() => onAddElement(section.id, 'image')}>
                            <ImageIcon size={16} className="text-black" />
                        </div>
                    )}
                </div>

                {/* Content Area (Center/Title) */}
                <div className="flex flex-col gap-1">
                    {headingEl && renderWrappedElement(headingEl)}
                    {subtitleEl && renderWrappedElement(subtitleEl)}
                </div>

                {/* Actions Area (Right) */}
                <div className="flex flex-col items-end gap-3">
                    {tableInfoEl && renderWrappedElement(tableInfoEl)}
                    {statusEl && renderWrappedElement(statusEl)}
                </div>
            </div>

            {/* Quick Add Buttons for missing elements */}
            <div className="absolute top-2 left-2 flex gap-1 opacity-0 hover:opacity-100 transition-opacity z-[100]">
                {!headingEl && <button onClick={() => onAddElement(section.id, 'heading')} className="p-1 bg-violet-500 text-white rounded text-[10px]">Add Title</button>}
                {!subtitleEl && <button onClick={() => onAddElement(section.id, 'subtitle')} className="p-1 bg-violet-500 text-white rounded text-[10px]">Add Subtitle</button>}
                {!tableInfoEl && <button onClick={() => onAddElement(section.id, 'table_info')} className="p-1 bg-violet-500 text-white rounded text-[10px]">Add Table #</button>}
                {!statusEl && <button onClick={() => onAddElement(section.id, 'status')} className="p-1 bg-violet-500 text-white rounded text-[10px]">Add Status</button>}
            </div>
        </div>
    );
}



/* ═══════════════ Scroll Section (specials/offers) ═══════════════ */

function ScrollSection({ section, theme, elementType, selectedElementId, hoveredElementId, onSelectElement, onAddElement, onDeleteElement, onDuplicateElement, onMoveElement, onInlineEdit, dispatch }: any) {
    const { layout, elements } = section;
    const primaryColor = theme.primaryColor || '#f97316';

    return (
        <div style={{ padding: layout.padding || '8px 24px 24px 24px', background: layout.background, minHeight: layout.minHeight }}>
            {/* Section Title */}
            <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: layout.titleColor || '#000000' }}>
                    <Flame className="w-5 h-5" style={{ color: primaryColor }} />
                    {section.title || (elementType === 'offer' ? "Today's Specials" : "Featured Items")}
                </h2>
            </div>

            {/* Horizontal Scroll */}
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
                {elements.sort((a: any, b: any) => a.order - b.order).map((el: BuilderElement, index: number) => (
                    <div key={el.id} className="flex-shrink-0" style={{ width: formatStyleValue('width', el.style?.width) || (elementType === 'quick_action' ? '120px' : '260px') }}>
                        <EditableElement
                            element={el}
                            section={section}
                            isSelected={selectedElementId === el.id}
                            isHovered={hoveredElementId === el.id}
                            onSelect={() => onSelectElement(el.id, section.id)}
                            onEdit={() => onSelectElement(el.id, section.id)}
                            onDelete={() => onDeleteElement(section.id, el.id)}
                            onDuplicate={() => onDuplicateElement(section.id, el)}
                            onMoveUp={() => onMoveElement(section.id, index, 'up')}
                            onMoveDown={() => onMoveElement(section.id, index, 'down')}
                            onSchedule={() => {}}
                            dispatch={dispatch}
                        >
                            <RenderElement isWrapped={true} element={el} section={section} theme={theme} onInlineEdit={(field: string, value: string) => onInlineEdit(section.id, el.id, field, value)} />
                        </EditableElement>
                    </div>
                ))}

                {/* Add Slot */}
                <div className="min-w-[120px] flex-shrink-0">
                    <EmptySlotPlaceholder type={elementType} onClick={() => onAddElement(section.id, elementType)} />
                </div>
            </div>
        </div>
    );
}

/* ═══════════════ Grid Section (universal) ═══════════════ */

function GridSection({ section, theme, elementType, selectedElementId, hoveredElementId, onSelectElement, onAddElement, onDeleteElement, onDuplicateElement, onMoveElement, onInlineEdit, dispatch }: any) {
    const { layout, elements } = section;
    const cols = layout.columns || (elementType === 'category' ? 4 : 2);

    return (
        <div style={{ padding: layout.padding || '24px', background: layout.background, minHeight: layout.minHeight }}>
            {/* Section Title */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="font-bold text-lg" style={{ fontFamily: 'inherit', color: layout.titleColor || '#000000' }}>{section.title || (elementType === 'category' ? 'Categories' : (elementType === 'quick_action' ? 'Quick Actions' : 'Section'))}</h2>
                    {section.subtitle && <p className="text-xs mt-0.5" style={{ fontFamily: 'inherit', color: layout.subtitleColor || '#94a3b8' }}>{section.subtitle}</p>}
                </div>
                {elementType === 'category' && (
                    <button className="text-xs font-semibold flex items-center gap-0.5" style={{ color: theme.primaryColor }}>
                        View All <ChevronRight size={14} />
                    </button>
                )}
            </div>

            {/* Grid */}
            <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: `${layout.gap || (elementType === 'category' ? 16 : 12)}px` }}>
                {elements.sort((a: any, b: any) => a.order - b.order).map((el: BuilderElement, index: number) => (
                    <EditableElement
                        key={el.id}
                        element={el}
                        section={section}
                        isSelected={selectedElementId === el.id}
                        isHovered={hoveredElementId === el.id}
                        onSelect={() => onSelectElement(el.id, section.id)}
                        onEdit={() => onSelectElement(el.id, section.id)}
                        onDelete={() => onDeleteElement(section.id, el.id)}
                        onDuplicate={() => onDuplicateElement(section.id, el)}
                        onMoveUp={() => onMoveElement(section.id, index, 'up')}
                        onMoveDown={() => onMoveElement(section.id, index, 'down')}
                        onMoveLeft={() => onMoveElement(section.id, index, 'left')}
                        onMoveRight={() => onMoveElement(section.id, index, 'right')}
                        onSchedule={() => {}}
                        dispatch={dispatch}
                    >
                        <RenderElement isWrapped={true} element={el} section={section} theme={theme} onInlineEdit={(field: string, value: string) => onInlineEdit(section.id, el.id, field, value)} />
                    </EditableElement>
                ))}

                {/* Add Slot */}
                <EmptySlotPlaceholder type={elementType} onClick={() => onAddElement(section.id, elementType)} />
            </div>
        </div>
    );
}

/* ═══════════════ Element Renderer ═══════════════ */


function RenderElement({ element, section, theme, onInlineEdit, isWrapped }: { element: BuilderElement; section: BuilderSection; theme: any; onInlineEdit: (field: string, value: string) => void; isWrapped?: boolean }) {
    const { type, content, style } = element;
    const isHeader = section.type === 'header';
    const layout = section.layout || {};

    const textStyle: React.CSSProperties = {
        fontFamily: 'inherit',
        fontSize: formatStyleValue('fontSize', style?.fontSize),
        fontWeight: style?.fontWeight ? (parseInt(style.fontWeight) as any) : undefined,
        color: style?.color || (
            type === 'heading' ? layout.titleColor :
            type === 'subtitle' ? layout.subtitleColor :
            undefined
        ),
        textAlign: style?.textAlign as any,
    };

    const containerStyle: React.CSSProperties = {
        position: isWrapped ? 'relative' : ((style?.position as any) || (style?.left !== undefined || style?.top !== undefined ? 'absolute' : 'relative')),
        left: isWrapped ? '0' : formatStyleValue('left', style?.left),
        top: isWrapped ? '0' : formatStyleValue('top', style?.top),
        right: isWrapped ? '0' : formatStyleValue('right', style?.right),
        bottom: isWrapped ? '0' : formatStyleValue('bottom', style?.bottom),
        width: isWrapped ? '100%' : formatStyleValue('width', style?.width),
        height: isWrapped ? '100%' : formatStyleValue('height', style?.height),
        backgroundColor: style?.backgroundColor || (
            type === 'status' ? layout.badgeColor :
            type === 'table_info' ? layout.badgeColor :
            undefined
        ),
        padding: formatStyleValue('padding', style?.padding),
        margin: formatStyleValue('margin', style?.margin),
        zIndex: style?.zIndex,
        display: style?.display as any,
        flexDirection: style?.flexDirection as any,
        alignItems: style?.alignItems as any,
        justifyContent: style?.justifyContent as any,
        gap: formatStyleValue('gap', style?.gap),
        border: style?.border,
        boxShadow: style?.boxShadow,
        opacity: style?.opacity,
        borderRadius: formatStyleValue('borderRadius', style?.borderRadius),
        objectFit: style?.objectFit as any,
        aspectRatio: style?.aspectRatio,
        minHeight: isWrapped ? '100%' : formatStyleValue('minHeight', style?.minHeight),
    };

    const iconColor = layout.iconColor || theme.primaryColor;

    switch (type) {
        case 'banner': {
            const bannerTextAlign = style?.textAlign || 'center';
            const bannerAlignItems = bannerTextAlign === 'center' ? 'center' : bannerTextAlign === 'right' ? 'flex-end' : 'flex-start';
            const bannerContainerStyle = { 
                ...containerStyle,
                display: 'flex',
                flexDirection: 'column' as const,
                justifyContent: 'flex-end',
                margin: style?.left === undefined ? '0 auto' : undefined // Center if no absolute left
            };
            if (!style?.borderRadius) bannerContainerStyle.borderRadius = '1.5rem';

            return (
                <div 
                    className="relative overflow-hidden group cursor-pointer shadow-xl" 
                    style={bannerContainerStyle}
                >
                    {content.imageUrl ? (
                        <img src={content.imageUrl} alt={content.heading || ''} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-orange-400 via-rose-500 to-purple-600 flex items-center justify-center">
                            <ImageIcon size={48} className="text-white/20" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-0" />
                    <div className="relative p-6 w-full z-10" style={{ alignItems: bannerAlignItems, textAlign: bannerTextAlign as any }}>
                        <InlineText value={content.heading || 'Banner Heading'} field="heading" onSave={onInlineEdit} className="text-2xl font-black text-white leading-tight mb-1 drop-shadow-lg" style={textStyle} />
                        <InlineText value={content.subheading || 'Your subtitle here'} field="subheading" onSave={onInlineEdit} className="text-white/80 text-sm mb-4 line-clamp-2" style={textStyle} />
                        {content.ctaText && (
                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                                {content.ctaText}
                                <ChevronRight size={14} />
                            </span>
                        )}
                    </div>
                </div>
            );
        }

        case 'category':
            return (
                <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-neutral-50 hover:bg-neutral-100 transition-colors" style={containerStyle}>
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-100 to-orange-50 flex items-center justify-center overflow-hidden" style={{ borderRadius: theme.cardRadius }}>
                        {content.imageUrl ? <img src={content.imageUrl} className="w-full h-full object-cover" /> : <Utensils size={24} className="text-orange-400" />}
                    </div>
                    <InlineText value={content.title || 'Category'} field="title" onSave={onInlineEdit} className="text-xs font-semibold text-black text-center" style={textStyle} />
                </div>
            );

        case 'offer':
            return (
                <div className="rounded-2xl overflow-hidden border border-neutral-100 bg-white shadow-sm" style={{ borderRadius: theme.cardRadius, ...containerStyle }}>
                    <div className="h-28 bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center relative">
                        {content.imageUrl ? <img src={content.imageUrl} className="w-full h-full object-cover" /> : <Tags size={32} className="text-white/60" />}
                        {content.couponCode && <span className="absolute top-2 right-2 bg-white/90 text-xs font-bold px-2 py-0.5 rounded-full">{content.couponCode}</span>}
                        {content.isCombo && <span className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">Combo</span>}
                    </div>
                    <div className="p-3">
                        <InlineText value={content.title || 'Offer Title'} field="title" onSave={onInlineEdit} className="font-bold text-sm text-black" style={textStyle} />
                        <InlineText value={content.description || 'Description'} field="description" onSave={onInlineEdit} className="text-xs text-black mt-0.5" style={textStyle} />
                    </div>
                </div>
            );

        case 'quick_action':
            return (
                <div 
                    className="flex items-center gap-3 p-4 rounded-2xl border border-neutral-100 shadow-sm w-full overflow-hidden" 
                    style={{
                        ...containerStyle,
                        backgroundColor: style?.backgroundColor || '#ffffff'
                    }}
                >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-neutral-100 overflow-hidden" style={{ background: content.imageUrl ? 'transparent' : `${theme.primaryColor}15`, borderRadius: theme.cardRadius || '12px' }}>
                        {content.imageUrl ? (
                            <img src={content.imageUrl} alt={content.label} className="w-full h-full object-cover" />
                        ) : (
                            <Utensils size={18} style={{ color: iconColor }} />
                        )}
                    </div>
                    <InlineText value={content.label || 'Action'} field="label" onSave={onInlineEdit} className="text-sm font-bold text-black text-left truncate" style={textStyle} />
                </div>
            );

        case 'offer':
            return (
                <div 
                    className="rounded-2xl overflow-hidden border border-neutral-100 shadow-sm" 
                    style={{ 
                        borderRadius: theme.cardRadius, 
                        ...containerStyle,
                        backgroundColor: style?.backgroundColor || '#ffffff'
                    }}
                >
                    <div className="h-28 bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center relative">
                        {content.imageUrl ? <img src={content.imageUrl} className="w-full h-full object-cover" /> : <Tags size={32} className="text-white/60" />}
                        {content.couponCode && <span className="absolute top-2 right-2 bg-white/90 text-xs font-bold px-2 py-0.5 rounded-full">{content.couponCode}</span>}
                    </div>
                    <div className="p-3">
                        <InlineText value={content.title || 'Offer Title'} field="title" onSave={onInlineEdit} className="font-bold text-sm text-black" style={textStyle} />
                        <InlineText value={content.description || 'Description'} field="description" onSave={onInlineEdit} className="text-xs text-black mt-0.5" style={textStyle} />
                    </div>
                </div>
            );

        case 'promo':
            return (
                <div className="py-3 px-5 rounded-xl text-center" style={{ background: content.backgroundColor || theme.primaryColor, borderRadius: theme.cardRadius, ...containerStyle }}>
                    <InlineText value={content.text || 'Promo text'} field="text" onSave={onInlineEdit} className="text-sm font-bold" style={{ color: content.textColor || '#fff', ...textStyle }} />
                </div>
            );

        case 'footer_info':
            return (
                <div className="text-center space-y-2" style={containerStyle}>
                    <div className="flex items-center justify-center gap-2 text-white/70">
                        <Phone size={13} /> 
                        <InlineText value={content.phone || 'Add Phone'} field="phone" onSave={onInlineEdit} className="text-xs" style={textStyle} />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-white/70">
                        <Mail size={13} /> 
                        <InlineText value={content.email || 'Add Email'} field="email" onSave={onInlineEdit} className="text-xs" style={textStyle} />
                    </div>
                    <div className="flex items-center justify-center gap-2 text-white/70">
                        <MapPin size={13} /> 
                        <InlineText value={content.address || 'Add Address'} field="address" onSave={onInlineEdit} className="text-xs" style={textStyle} />
                    </div>
                    <InlineText value={content.copyright || '© 2026 Your Restaurant'} field="copyright" onSave={onInlineEdit} className="text-white/50 text-[10px] mt-3" style={textStyle} />
                    <div className="flex items-center justify-center gap-3 mt-2">
                        {content.instagram !== undefined && <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20"><Instagram size={14} className="text-white/60" /></div>}
                        {content.facebook !== undefined && <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20"><Globe size={14} className="text-white/60" /></div>}
                        {content.website !== undefined && <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20"><Globe size={14} className="text-white/60" /></div>}
                    </div>
                </div>
            );

        case 'image':
            return (
                <div 
                    className="overflow-hidden flex items-center justify-center rounded-xl"
                    style={{
                        ...containerStyle,
                        backgroundColor: style?.backgroundColor || '#f5f5f5'
                    }}
                >
                    {content.imageUrl ? (
                        <img src={content.imageUrl} className="w-full h-full object-cover" />
                    ) : (
                        <ImageIcon size={32} className="text-black" />
                    )}
                </div>
            );

        case 'heading':
            return (
                <div style={containerStyle}>
                    <InlineText value={content.text || 'Heading'} field="text" onSave={onInlineEdit} className={isHeader ? "text-2xl font-black" : "text-xl font-bold"} style={textStyle} />
                </div>
            );
        case 'subtitle':
            return (
                <div style={containerStyle}>
                    <InlineText value={content.text || 'Subtitle'} field="text" onSave={onInlineEdit} className={isHeader ? "text-sm opacity-60 font-medium" : "text-sm opacity-70"} style={textStyle} />
                </div>
            );
        case 'table_info':
            return (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 rounded-full whitespace-nowrap overflow-hidden" style={containerStyle}>
                    <span className="text-[11px] text-black font-bold uppercase tracking-wider shrink-0" style={textStyle}>
                        <InlineText value={content.prefix || 'Table'} field="prefix" onSave={onInlineEdit} />
                    </span>
                    <span className="text-sm font-black text-black shrink-0" style={textStyle}>12</span>
                </div>
            );
        case 'service':
            const ServiceIcon = (LucideIcons as any)[content.icon || 'Utensils'] || LucideIcons.Utensils;
            return (
                <div 
                    className="p-4 rounded-2xl shadow-sm border border-neutral-100 flex items-center gap-4" 
                    style={{
                        ...containerStyle,
                        backgroundColor: style?.backgroundColor || '#ffffff'
                    }}
                >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${iconColor}15`, color: iconColor }}>
                        <ServiceIcon size={24} />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <InlineText value={content.title || 'Service Name'} field="title" onSave={onInlineEdit} className="font-bold text-black truncate" style={textStyle} />
                        <InlineText value={content.description || 'Service description'} field="description" onSave={onInlineEdit} className="text-xs text-black truncate" style={textStyle} />
                    </div>
                    <ChevronRight size={16} className="text-black flex-shrink-0" />
                </div>
            );

        case 'popular_item':
            return (
                <div 
                    className="flex flex-col gap-2 p-3 rounded-2xl bg-white border border-neutral-100 shadow-sm" 
                    style={{ ...containerStyle, borderRadius: theme.cardRadius }}
                >
                    <div className="aspect-square rounded-xl bg-neutral-100 overflow-hidden relative">
                        {content.imageUrl ? (
                            <img src={content.imageUrl} alt={content.title} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center"><Utensils size={24} className="text-black" /></div>
                        )}
                        <button className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center text-orange-500">
                            <Plus size={16} />
                        </button>
                    </div>
                    <div className="px-1">
                        <InlineText value={content.title || 'Popular Item'} field="title" onSave={onInlineEdit} className="text-xs font-bold text-black truncate" style={textStyle} />
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] font-black text-orange-500">₹{content.price || '0'}</span>
                            <div className="flex items-center gap-0.5 text-[8px] text-black">
                                <Star size={8} className="fill-yellow-400 text-yellow-400" />
                                <span>{content.rating || '4.5'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            );

        case 'reorder_card':
            return (
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-neutral-100 flex items-center gap-3 w-full" style={containerStyle}>
                    <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center overflow-hidden">
                        {content.imageUrl ? <img src={content.imageUrl} className="w-full h-full object-cover" /> : <Clock size={20} className="text-black" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <InlineText value={content.title || 'Last Order'} field="title" onSave={onInlineEdit} className="text-xs font-bold text-black truncate" style={textStyle} />
                        <InlineText value={content.date || '2 days ago'} field="date" onSave={onInlineEdit} className="text-[10px] text-black" style={textStyle} />
                    </div>
                    <button className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center">
                        <Plus size={14} />
                    </button>
                </div>
            );

        case 'combo':
        case 'chef_special':
            const isCombo = type === 'combo';
            const isChef = type === 'chef_special';
            const primaryColor = theme.primaryColor || '#000';
            const secondaryColor = theme.secondaryColor || '#333';
            return (
                <div className="min-w-full rounded-2xl p-5 text-white shadow-xl relative overflow-hidden flex-shrink-0"
                    style={{ ...containerStyle, backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
                >
                    {content.imageUrl && (
                        <div className="absolute inset-0 opacity-20">
                            <img src={content.imageUrl} className="w-full h-full object-cover" alt="" />
                        </div>
                    )}
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
                    <div className="relative z-10">
                        <div className="flex gap-2">
                            {isCombo && <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Combo</span>}
                            <span className="bg-white/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                                {isChef ? "Chef's Choice" : "Special"}
                            </span>
                        </div>
                        <InlineText value={content.title || 'Special Item'} field="title" onSave={onInlineEdit} className="text-xl font-black mt-2 mb-1" style={textStyle} />
                        <InlineText value={content.description || 'Item description'} field="description" onSave={onInlineEdit} className="text-xs opacity-80 mb-3 line-clamp-1" style={textStyle} />
                        <div className="flex items-end justify-between mt-2">
                            <div className="flex items-center gap-1 text-2xl font-black">
                                <span>₹</span>
                                <InlineText value={content.price || '0'} field="price" onSave={onInlineEdit} className="inline-block" style={textStyle} />
                            </div>
                            <div className="bg-white/20 p-2 rounded-full"><ShoppingBag size={16} /></div>
                        </div>
                    </div>
                </div>
            );

        case 'button':
            return (
                <div 
                    className="px-6 py-3 font-bold text-sm shadow-sm transition-all text-center flex items-center justify-center cursor-pointer"
                    style={{
                        ...containerStyle,
                        backgroundColor: style.backgroundColor || theme.primaryColor || '#f97316',
                        color: style.color || '#fff',
                        borderRadius: formatStyleValue('borderRadius', style.borderRadius!) || theme.cardRadius || '12px',
                    }}
                >
                    {content.text || 'Click Here'}
                </div>
            );

        case 'status':
            return (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isHeader ? '' : 'bg-emerald-50 border border-emerald-100'}`} 
                     style={{
                        ...containerStyle,
                        backgroundColor: containerStyle.backgroundColor || (isHeader ? 'rgba(255,255,255,0.1)' : undefined),
                        backdropFilter: isHeader ? 'blur(8px)' : 'none'
                     }}>
                    <div className={`w-2 h-2 rounded-full ${content.isOpened ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                    <div className="flex flex-col">
                        <InlineText 
                            value={content.isOpened ? (content.openedText || 'Open') : (content.closedText || 'Closed')} 
                            field={content.isOpened ? "openedText" : "closedText"}
                            onSave={onInlineEdit}
                            className={`text-[10px] font-bold uppercase tracking-wider leading-tight ${isHeader ? '' : 'text-emerald-700'}`} 
                            style={{
                                ...textStyle,
                                color: textStyle.color || (isHeader ? 'white' : undefined)
                            }}
                        />
                        {content.showClosingTime && content.isOpened && (
                            <div className={`flex items-center gap-0.5 text-[8px] ${isHeader ? 'opacity-50' : 'text-emerald-600/50'}`}>
                                <span>Closes</span>
                                <InlineText value={content.closingTime || '22:00'} field="closingTime" onSave={onInlineEdit} className="inline-block" style={textStyle} />
                            </div>
                        )}
                    </div>
                </div>
            );

        default:
            return (
                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100" style={containerStyle}>
                    <InlineText value={content.text || content.title || 'Content'} field="text" onSave={onInlineEdit} className="text-sm text-black" style={textStyle} />
                </div>
            );
    }
}

/* ═══════════════ Promo Strip Section ═══════════════ */

function PromoStripSection({ section, theme, onAddElement, selectedElementId, hoveredElementId, onSelectElement, onDeleteElement, onDuplicateElement, onMoveElement, onInlineEdit, dispatch }: any) {
    return (
        <div style={{ padding: section.layout.padding || '8px 24px', background: section.layout.background }}>
            {section.elements.length > 0 ? (
                section.elements.map((el: BuilderElement, index: number) => (
                    <EditableElement key={el.id} element={el} section={section} isSelected={selectedElementId === el.id} isHovered={hoveredElementId === el.id} onSelect={() => onSelectElement(el.id, section.id)} onEdit={() => onSelectElement(el.id, section.id)} onDelete={() => onDeleteElement(section.id, el.id)} onDuplicate={() => onDuplicateElement(section.id, el)} onMoveUp={() => onMoveElement(section.id, index, 'up')} onMoveDown={() => onMoveElement(section.id, index, 'down')} onSchedule={() => {}} dispatch={dispatch}>
                        <RenderElement isWrapped={true} element={el} section={section} theme={theme} onInlineEdit={(f: string, v: string) => onInlineEdit(section.id, el.id, f, v)} />
                    </EditableElement>
                ))
            ) : (
                <EmptySlotPlaceholder type="promo" onClick={() => onAddElement(section.id, 'promo')} />
            )}
        </div>
    );
}

/* ═══════════════ Custom Section ═══════════════ */

function CustomSection({ section, theme, onAddElement, selectedElementId, hoveredElementId, onSelectElement, onDeleteElement, onDuplicateElement, onMoveElement, onInlineEdit, dispatch }: any) {
    const { columns, gap, padding, background, minHeight } = section.layout;
    
    return (
        <div style={{ padding: padding || '16px 24px', background: background, minHeight: minHeight || '100px' }}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    {section.title && <h2 className="text-sm font-bold" style={{ color: section.layout.titleColor || '#000000' }}>{section.title}</h2>}
                    {section.subtitle && <p className="text-[10px] font-medium" style={{ color: section.layout.subtitleColor || '#000000' }}>{section.subtitle}</p>}
                </div>
            </div>

            <div 
                className="grid" 
                style={{ 
                    gridTemplateColumns: `repeat(${columns || 1}, minmax(0, 1fr))`,
                    gap: `${gap || 16}px`
                }}
            >
                {section.elements.map((el: BuilderElement, index: number) => (
                    <EditableElement
                        key={el.id}
                        element={el}
                        section={section}
                        isSelected={selectedElementId === el.id}
                        isHovered={hoveredElementId === el.id}
                        onSelect={() => onSelectElement(el.id, section.id)}
                        onEdit={() => onSelectElement(el.id, section.id)}
                        onDelete={() => onDeleteElement(section.id, el.id)}
                        onDuplicate={() => onDuplicateElement(section.id, el)}
                        onMoveUp={() => onMoveElement(section.id, index, 'up')}
                        onMoveDown={() => onMoveElement(section.id, index, 'down')}
                        onMoveLeft={() => onMoveElement(section.id, index, 'left')}
                        onMoveRight={() => onMoveElement(section.id, index, 'right')}
                        onSchedule={() => {}}
                        dispatch={dispatch}
                    >
                        <RenderElement isWrapped={true} element={el} section={section} theme={theme} onInlineEdit={(f: string, v: string) => onInlineEdit(section.id, el.id, f, v)} />
                    </EditableElement>
                ))}
                
                {/* Add Element Controls */}
                <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { type: 'text', label: 'Text', icon: Type },
                            { type: 'image', label: 'Image', icon: ImageIcon },
                            { type: 'button', label: 'Button', icon: MousePointer2 },
                            { type: 'quick_action', label: 'Action', icon: LayoutGrid },
                        ].map(item => (
                            <button
                                key={item.type}
                                onClick={() => onAddElement(section.id, item.type)}
                                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-neutral-100 hover:border-violet-200 hover:bg-violet-50 transition-all text-left group"
                            >
                                <div className="w-6 h-6 rounded-lg bg-neutral-50 flex items-center justify-center group-hover:bg-white transition-colors">
                                    <item.icon size={12} className="text-black group-hover:text-violet-600" />
                                </div>
                                <span className="text-[11px] font-bold text-black group-hover:text-violet-700">{item.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════ Banner Slideshow Section ═══════════════ */

function BannerSlideshowSection({ section, theme, selectedElementId, hoveredElementId, onSelectElement, onAddElement, onDeleteElement, onDuplicateElement, onMoveElement, onInlineEdit, dispatch }: any) {
    const { layout, elements } = section;
    const sorted = [...elements].sort((a: any, b: any) => a.order - b.order);
    const [activeSlide, setActiveSlide] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const duration = (layout.slideshowDuration || 5) * 1000;

    useEffect(() => {
        if (sorted.length <= 1) return;
        timerRef.current = setInterval(() => {
            setActiveSlide(prev => (prev + 1) % sorted.length);
        }, duration);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [sorted.length, duration]);

    useEffect(() => {
        if (activeSlide >= sorted.length) setActiveSlide(0);
    }, [sorted.length]);

    return (
        <div style={{ padding: layout.padding || '16px 0px', background: layout.background }}>
            {(section.title || section.subtitle) && (
                <div className="flex items-center justify-between mb-4 px-6">
                    <div>
                        <h2 className="font-bold text-lg" style={{ fontFamily: 'inherit', color: layout.titleColor || '#000000' }}>{section.title}</h2>
                        {section.subtitle && <p className="text-xs mt-0.5" style={{ fontFamily: 'inherit', color: layout.subtitleColor || '#94a3b8' }}>{section.subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-black font-medium">{layout.slideshowDuration || 5}s</span>
                        <button className="text-xs font-semibold flex items-center gap-0.5" style={{ color: theme.primaryColor }}>
                            View All <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {/* Slideshow container */}
            <div 
                className="relative w-full overflow-hidden"
                style={{ 
                    aspectRatio: elements[0]?.style?.height ? 'auto' : (elements[0]?.style?.aspectRatio || '16/9'),
                    height: formatStyleValue('height', elements[0]?.style?.height),
                    background: 'transparent',
                    borderRadius: formatStyleValue('borderRadius', elements[0]?.style?.borderRadius) || '1.5rem'
                }}
            >
                <AnimatePresence initial={false}>
                    {sorted.map((el: BuilderElement, index: number) => index === activeSlide && (
                        <motion.div
                            key={el.id}
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ 
                                x: { type: "spring", stiffness: 300, damping: 30 },
                                opacity: { duration: 0.2 }
                            }}
                            className="absolute inset-0"
                        >
                            <EditableElement
                                element={el}
                                section={section}
                                isSelected={selectedElementId === el.id}
                                isHovered={hoveredElementId === el.id}
                                onSelect={() => onSelectElement(el.id, section.id)}
                                onEdit={() => onSelectElement(el.id, section.id)}
                                onDelete={() => onDeleteElement(section.id, el.id)}
                                onDuplicate={() => onDuplicateElement(section.id, el)}
                                onMoveUp={() => onMoveElement(section.id, index, 'up')}
                                onMoveDown={() => onMoveElement(section.id, index, 'down')}
                                onSchedule={() => {}}
                                dispatch={dispatch}
                            >
                                <RenderElement isWrapped={true} element={el} section={section} theme={theme} onInlineEdit={(field: string, value: string) => onInlineEdit(section.id, el.id, field, value)} />
                            </EditableElement>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* Dot indicators */}
                {sorted.length > 1 && (
                    <div className="absolute bottom-3 left-0 right-0 z-10 flex items-center justify-center gap-1.5">
                        {sorted.map((_: any, i: number) => (
                            <button
                                key={i}
                                onClick={(e) => { e.stopPropagation(); setActiveSlide(i); }}
                                className={`rounded-full transition-all ${i === activeSlide ? 'w-5 h-2' : 'w-2 h-2'}`}
                                style={{ backgroundColor: i === activeSlide ? theme.primaryColor : 'rgba(255, 255, 255, 0.6)' }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Add banner slot */}
            <div className="mt-3 px-6">
                <EmptySlotPlaceholder type="banner" onClick={() => onAddElement(section.id, 'banner')} />
            </div>
        </div>
    );
}

/* ═══════════════ Editable Footer ═══════════════ */

function FooterSection({ theme, section, selectedElementId, hoveredElementId, onSelectElement, onAddElement, onDeleteElement, onDuplicateElement, onMoveElement, onInlineEdit, dispatch }: any) {
    const hasElements = section.elements?.length > 0;
    const { layout } = section;

    return (
        <div className="px-6 py-8" style={{ background: layout.background || theme.footerBg || '#000000' }}>
            {hasElements ? (
                <div className="space-y-3">
                    {section.elements.map((el: BuilderElement, index: number) => (
                        <EditableElement
                            key={el.id}
                            element={el}
                            section={section}
                            isSelected={selectedElementId === el.id}
                            isHovered={hoveredElementId === el.id}
                            onSelect={() => onSelectElement(el.id, section.id)}
                            onEdit={() => onSelectElement(el.id, section.id)}
                            onDelete={() => onDeleteElement(section.id, el.id)}
                            onDuplicate={() => onDuplicateElement(section.id, el)}
                            onMoveUp={() => onMoveElement(section.id, index, 'up')}
                            onMoveDown={() => onMoveElement(section.id, index, 'down')}
                            onSchedule={() => {}}
                            dispatch={dispatch}
                        >
                            <RenderElement isWrapped={true} element={el} section={section} theme={theme} onInlineEdit={(f: string, v: string) => onInlineEdit(section.id, el.id, f, v)} />
                        </EditableElement>
                    ))}
                </div>
            ) : (
                <div className="text-center">
                    <p className="text-white/60 text-xs font-medium mb-3" style={{ fontFamily: 'inherit' }}>© 2026 Restaurant OS • Powered by Your SaaS</p>
                    <div className="flex items-center justify-center gap-4 mb-4">
                        {[Phone, MapPin].map((Icon, i) => (
                            <div key={i} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><Icon size={14} className="text-white/50" /></div>
                        ))}
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); onAddElement(section.id, 'footer_info'); }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/20 text-white/60 text-xs font-semibold hover:bg-white/10 transition-colors"
                    >
                        <Plus size={14} /> Add Footer Details
                    </button>
                </div>
            )}
        </div>
    );
}

/* ═══════════════ Inline Editable Text ═══════════════ */

function InlineText({ value, field, onSave, className = '', style = {} }: { value: string; field: string; onSave: (field: string, value: string) => void; className?: string; style?: React.CSSProperties }) {
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState(value);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => { setText(value); }, [value]);
    React.useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

    if (editing) {
        return (
            <input
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onBlur={() => { setEditing(false); onSave(field, text); }}
                onKeyDown={e => { if (e.key === 'Enter') { setEditing(false); onSave(field, text); } if (e.key === 'Escape') { setEditing(false); setText(value); } }}
                className={`${className} bg-transparent outline-none border-b-2 border-violet-500 w-full`}
                style={style}
                onClick={e => e.stopPropagation()}
            />
        );
    }

    return (
        <p
            className={`${className} cursor-text hover:bg-violet-50/50 rounded px-0.5 transition-colors`}
            style={style}
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            title="Double-click to edit"
        >
            {value || <span className="italic text-black">Click to edit</span>}
        </p>
    );
}

/* ═══════════════ Quick Add Button ═══════════════ */

function QuickAddButton({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="flex flex-col items-center justify-center gap-1.5 w-16 h-16 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group"
        >
            <Icon size={20} className="text-white/40 group-hover:text-white transition-colors" />
            <span className="text-[9px] font-bold text-white/40 group-hover:text-white uppercase tracking-wider">{label}</span>
        </button>
    );
}
