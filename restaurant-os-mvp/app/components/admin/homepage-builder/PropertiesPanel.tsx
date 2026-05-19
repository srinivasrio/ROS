'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Type, Image as ImageIcon, Palette, LayoutGrid, Calendar, Eye,
    AlignLeft, AlignCenter, AlignRight, Bold, ChevronDown,
    Columns, Rows, Space, ArrowUpDown, Ratio, Upload,
    RectangleHorizontal, Square, RectangleVertical, Maximize2, Trash2
} from 'lucide-react';
import { BuilderElement, BuilderSection, ThemeConfig, ElementStyle, SectionLayout } from './useBuilderState';
import ImageUploader from './ImageUploader';

interface PropertiesPanelProps {
    selectedElement: { element: BuilderElement; section: BuilderSection } | null;
    selectedSection: BuilderSection | null;
    theme: ThemeConfig;
    dispatch: React.Dispatch<any>;
    onOpenDataBrowser?: () => void;
}

type PanelTab = 'element' | 'section' | 'theme';

export default function PropertiesPanel({ selectedElement, selectedSection, theme, dispatch, onOpenDataBrowser }: PropertiesPanelProps) {
    const [activeTab, setActiveTab] = useState<PanelTab>(selectedElement ? 'element' : selectedSection ? 'section' : 'theme');

    React.useEffect(() => {
        if (selectedElement) setActiveTab('element');
        else if (selectedSection) setActiveTab('section');
    }, [selectedElement, selectedSection]);

    const tabs: { id: PanelTab; label: string; icon: React.ElementType }[] = [
        { id: 'element', label: 'Element', icon: Type },
        { id: 'section', label: 'Section', icon: LayoutGrid },
        { id: 'theme', label: 'Theme', icon: Palette },
    ];

    return (
        <div className="h-full flex flex-col bg-white border-l border-neutral-200">
            {/* Tabs */}
            <div className="flex border-b border-neutral-100">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors relative ${
                            activeTab === tab.id ? 'text-violet-600' : 'text-black hover:text-black'
                        }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                        {activeTab === tab.id && <motion.div layoutId="prop-tab" className="absolute bottom-0 left-2 right-2 h-0.5 bg-violet-500 rounded-full" />}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-hide">
                {activeTab === 'element' && (selectedElement ? <ElementProperties element={selectedElement.element} section={selectedElement.section} dispatch={dispatch} theme={theme} onOpenDataBrowser={onOpenDataBrowser} /> : <EmptyState text="Select an element" />)}
                {activeTab === 'section' && (selectedSection ? <SectionProperties section={selectedSection} dispatch={dispatch} theme={theme} /> : <EmptyState text="Select a section" />)}
                {activeTab === 'theme' && <ThemeProperties theme={theme} dispatch={dispatch} />}
            </div>
        </div>
    );
}

/* ─── Element Properties ─── */

function ElementProperties({ element, section, dispatch, theme, onOpenDataBrowser }: { element: BuilderElement; section: any; dispatch: React.Dispatch<any>; theme: any; onOpenDataBrowser?: () => void }) {
    const updateContent = (key: string, value: any) => dispatch({ type: 'UPDATE_ELEMENT_CONTENT', sectionId: section.id || section.section_type, elementId: element.id, content: { [key]: value } });
    const updateStyle = (updates: Partial<ElementStyle>) => dispatch({ type: 'UPDATE_ELEMENT_STYLE', sectionId: section.id || section.section_type, elementId: element.id, style: updates });
    const removeElement = () => dispatch({ type: 'REMOVE_ELEMENT', sectionId: section.id || section.section_type, elementId: element.id });

    return (
        <>
            <PropGroup title="Content">
                {element.content.heading !== undefined && <PropInput label="Heading" value={element.content.heading} onChange={v => updateContent('heading', v)} />}
                {element.content.subheading !== undefined && <PropInput label="Subheading" value={element.content.subheading} onChange={v => updateContent('subheading', v)} />}
                {element.content.title !== undefined && <PropInput label="Title" value={element.content.title} onChange={v => updateContent('title', v)} />}
                {element.content.description !== undefined && <PropInput label="Description" value={element.content.description} onChange={v => updateContent('description', v)} />}
                {element.content.text !== undefined && <PropInput label="Text" value={element.content.text} onChange={v => updateContent('text', v)} />}
                {element.content.label !== undefined && <PropInput label="Label" value={element.content.label} onChange={v => updateContent('label', v)} />}
                {element.content.ctaText !== undefined && <PropInput label="CTA Text" value={element.content.ctaText} onChange={v => updateContent('ctaText', v)} />}
                {element.content.ctaAction !== undefined && <PropInput label="CTA Action" value={element.content.ctaAction} onChange={v => updateContent('ctaAction', v)} />}
                {element.content.couponCode !== undefined && <PropInput label="Coupon Code" value={element.content.couponCode} onChange={v => updateContent('couponCode', v)} />}
                {element.content.price !== undefined && <PropInput label="Price (₹)" value={element.content.price} onChange={v => updateContent('price', v)} />}
                {element.content.redirectTarget !== undefined && (
                    <div className="space-y-1.5">
                        <PropInput label="Redirect URL" value={element.content.redirectTarget} onChange={v => updateContent('redirectTarget', v)} />
                        <button 
                            onClick={onOpenDataBrowser}
                            className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors"
                        >
                            <LayoutGrid size={12} />
                            Link to Menu Item, Category or Service
                        </button>
                    </div>
                )}
                {/* Footer-specific fields */}
                {element.content.phone !== undefined && <PropInput label="Phone" value={element.content.phone} onChange={v => updateContent('phone', v)} />}
                {element.content.address !== undefined && <PropInput label="Address" value={element.content.address} onChange={v => updateContent('address', v)} />}
                {element.content.email !== undefined && <PropInput label="Email" value={element.content.email} onChange={v => updateContent('email', v)} />}
                {element.content.instagram !== undefined && <PropInput label="Instagram URL" value={element.content.instagram} onChange={v => updateContent('instagram', v)} />}
                {element.content.facebook !== undefined && <PropInput label="Facebook URL" value={element.content.facebook} onChange={v => updateContent('facebook', v)} />}
                {element.content.website !== undefined && <PropInput label="Website" value={element.content.website} onChange={v => updateContent('website', v)} />}
                {element.content.copyright !== undefined && <PropInput label="Copyright Text" value={element.content.copyright} onChange={v => updateContent('copyright', v)} />}

                {/* Table Info-specific fields */}
                {element.type === 'table_info' && (
                    <PropInput label="Prefix" value={element.content.prefix || ''} onChange={v => updateContent('prefix', v)} placeholder="e.g. Table" />
                )}

                {/* Status-specific fields */}
                {element.type === 'status' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                            <div>
                                <p className="text-[10px] font-bold text-black uppercase tracking-widest">Business Status</p>
                                <p className="text-xs font-semibold text-black">{element.content.isOpened ? 'Opened' : 'Closed'}</p>
                            </div>
                            <button
                                onClick={() => updateContent('isOpened', !element.content.isOpened)}
                                className={`w-12 h-6 rounded-full transition-colors relative ${element.content.isOpened ? 'bg-emerald-500' : 'bg-neutral-300'}`}
                            >
                                <motion.div
                                    animate={{ x: element.content.isOpened ? 26 : 2 }}
                                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                                />
                            </button>
                        </div>
                        <PropInput label="Opening Status Text" value={element.content.openedText || ''} onChange={v => updateContent('openedText', v)} placeholder="e.g. Open Now" />
                        <PropInput label="Closed Status Text" value={element.content.closedText || ''} onChange={v => updateContent('closedText', v)} placeholder="e.g. Closed" />
                        
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] font-bold text-black uppercase tracking-widest">Show Closing Time</label>
                                <input 
                                    type="checkbox" 
                                    checked={element.content.showClosingTime} 
                                    onChange={e => updateContent('showClosingTime', e.target.checked)}
                                    className="accent-violet-500"
                                />
                            </div>
                            {element.content.showClosingTime && (
                                <PropInput label="Closing Time" value={element.content.closingTime || ''} onChange={v => updateContent('closingTime', v)} type="time" />
                            )}
                        </div>
                    </div>
                )}
            </PropGroup>

            {/* ─── Image Upload (instead of URL input) ─── */}
            {['banner', 'category', 'offer', 'quick_action', 'service', 'combo', 'chef_special', 'image'].includes(element.type) && (
                <PropGroup title="Image">
                    <ImageUploader
                        currentUrl={element.content.imageUrl || ''}
                        onImageChange={url => updateContent('imageUrl', url)}
                        aspectRatio={element.type === 'banner' ? '16/9' : (element.style.aspectRatio || '16/9')}
                        compact
                    />
                    {element.type !== 'banner' && (
                        <>
                            <label className="text-[10px] font-bold text-black uppercase tracking-widest mt-3 block">Aspect Ratio</label>
                            <div className="grid grid-cols-4 gap-1.5 mt-1">
                                {['16/9', '4/3', '3/2', '1/1'].map(ratio => (
                                    <button key={ratio} onClick={() => updateStyle({ aspectRatio: ratio })}
                                        className={`text-[10px] font-bold py-1.5 rounded-lg border transition-colors ${element.style.aspectRatio === ratio ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-neutral-200 text-black hover:border-neutral-300'}`}
                                    >{ratio}</button>
                                ))}
                            </div>
                        </>
                    )}
                </PropGroup>
            )}

            {/* ─── Size & Layout ─── */}
            <PropGroup title="Size & Layout">
                <PropInput label="Width" value={element.style.width || ''} onChange={v => updateStyle({ width: v })} placeholder="auto, 100%, 200px" />
                <PropInput label="Height" value={element.style.height || ''} onChange={v => updateStyle({ height: v })} placeholder="auto, 100%, 150px" />
                <label className="text-[10px] font-bold text-black uppercase tracking-widest mt-2 block">Presets</label>
                <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {[
                        { label: 'Small', w: '120px', h: '80px', icon: Square },
                        { label: 'Medium', w: '100%', h: 'auto', icon: RectangleHorizontal },
                        { label: 'Full', w: '100%', h: '200px', icon: Maximize2 },
                    ].map(preset => (
                        <button
                            key={preset.label}
                            onClick={() => updateStyle({ width: preset.w, height: preset.h })}
                            className="flex flex-col items-center gap-1 py-2 rounded-lg border border-neutral-200 text-black hover:border-violet-300 hover:text-violet-600 transition-colors"
                        >
                            <preset.icon size={14} />
                            <span className="text-[9px] font-bold">{preset.label}</span>
                        </button>
                    ))}
                </div>
            </PropGroup>

            {/* ─── Typography (now functional) ─── */}
            <PropGroup title="Typography">
                <PropInput label="Font Size" value={element.style.fontSize || ''} onChange={v => updateStyle({ fontSize: v })} placeholder="e.g. 16px, 1.2rem" />
                <label className="text-[10px] font-bold text-black uppercase tracking-widest mt-2 block">Font Size Presets</label>
                <div className="grid grid-cols-5 gap-1 mt-1">
                    {[
                        { label: 'XS', value: '11px' },
                        { label: 'SM', value: '13px' },
                        { label: 'MD', value: '16px' },
                        { label: 'LG', value: '20px' },
                        { label: 'XL', value: '28px' },
                    ].map(size => (
                        <button key={size.label} onClick={() => updateStyle({ fontSize: size.value })}
                            className={`text-[9px] font-bold py-1.5 rounded-lg border transition-colors ${element.style.fontSize === size.value ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-neutral-200 text-black'}`}
                        >{size.label}</button>
                    ))}
                </div>

                <label className="text-[10px] font-bold text-black uppercase tracking-widest mt-3 block">Font Weight</label>
                <div className="flex gap-1.5 mt-1">
                    {[
                        { label: 'Light', value: '300' },
                        { label: 'Normal', value: '400' },
                        { label: 'Semi', value: '600' },
                        { label: 'Bold', value: '700' },
                        { label: 'Black', value: '900' },
                    ].map(w => (
                        <button key={w.value} onClick={() => updateStyle({ fontWeight: w.value })}
                            className={`flex-1 text-[9px] font-bold py-1.5 rounded-lg border transition-colors ${element.style.fontWeight === w.value ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-neutral-200 text-black'}`}
                        >{w.label}</button>
                    ))}
                </div>

                <label className="text-[10px] font-bold text-black uppercase tracking-widest mt-3 block">Text Align</label>
                <div className="flex gap-1.5 mt-1">
                    {[{ value: 'left', icon: AlignLeft }, { value: 'center', icon: AlignCenter }, { value: 'right', icon: AlignRight }].map(({ value, icon: Icon }) => (
                        <button key={value} onClick={() => updateStyle({ textAlign: value })}
                            className={`flex-1 py-1.5 rounded-lg border flex items-center justify-center transition-colors ${element.style.textAlign === value ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-neutral-200 text-black'}`}
                        ><Icon size={14} /></button>
                    ))}
                </div>
            </PropGroup>

            <PropGroup title="Colors">
                <div className="flex items-center gap-2">
                    <input type="color" value={element.style.color || '#000000'} onChange={e => updateStyle({ color: e.target.value })} className="w-8 h-8 rounded border-0 p-0 cursor-pointer" />
                    <span className="text-xs text-black font-medium">Text Color</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                    <input type="color" value={element.style.backgroundColor || '#ffffff'} onChange={e => updateStyle({ backgroundColor: e.target.value })} className="w-8 h-8 rounded border-0 p-0 cursor-pointer" />
                    <span className="text-xs text-black font-medium">Background</span>
                </div>
            </PropGroup>

            <PropGroup title="Spacing">
                <PropInput label="Padding" value={element.style.padding || ''} onChange={v => updateStyle({ padding: v })} placeholder="e.g. 16px" />
                <PropInput label="Margin" value={element.style.margin || ''} onChange={v => updateStyle({ margin: v })} placeholder="e.g. 8px" />
                <PropInput label="Border Radius" value={element.style.borderRadius || ''} onChange={v => updateStyle({ borderRadius: v })} placeholder="e.g. 12px" />
                <label className="text-[10px] font-bold text-black uppercase tracking-widest mt-2 block">Radius Presets</label>
                <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {[
                        { label: 'None', value: '0px' },
                        { label: 'SM', value: '8px' },
                        { label: 'MD', value: '16px' },
                        { label: 'Full', value: '9999px' },
                    ].map(r => (
                        <button key={r.label} onClick={() => updateStyle({ borderRadius: r.value })}
                            className={`text-[9px] font-bold py-1.5 rounded-lg border transition-colors ${element.style.borderRadius === r.value ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-neutral-200 text-black'}`}
                        >{r.label}</button>
                    ))}
                </div>
            </PropGroup>

            <PropGroup title="Schedule">
                <PropInput label="Start" value={element.schedule?.startDatetime || ''} onChange={v => dispatch({ type: 'UPDATE_ELEMENT', sectionId: section.id || section.section_type, elementId: element.id, updates: { schedule: { ...element.schedule, startDatetime: v } } })} type="datetime-local" />
                <PropInput label="End" value={element.schedule?.endDatetime || ''} onChange={v => dispatch({ type: 'UPDATE_ELEMENT', sectionId: section.id || section.section_type, elementId: element.id, updates: { schedule: { ...element.schedule, endDatetime: v } } })} type="datetime-local" />
            </PropGroup>

            {/* Delete Button */}
            <div className="pt-4 border-t border-neutral-100">
                <button
                    onClick={removeElement}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-50 text-red-600 text-xs font-bold border border-red-100 hover:bg-red-100 transition-colors"
                >
                    <Trash2 size={14} />
                    Delete Element
                </button>
            </div>
        </>
    );
}

/* ─── Section Properties ─── */

function SectionProperties({ section, dispatch, theme }: { section: BuilderSection; dispatch: React.Dispatch<any>; theme: any }) {
    const updateLayout = (updates: Partial<SectionLayout>) => dispatch({ type: 'UPDATE_SECTION_LAYOUT', sectionId: section.id, layout: updates });
    const updateSection = (updates: Partial<BuilderSection>) => dispatch({ type: 'UPDATE_SECTION', sectionId: section.id, updates });
    const isHeader = section.type === 'header';

    return (
        <>
            {isHeader && (
                <PropGroup title="Header Settings">
                    <div className="space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-black uppercase tracking-widest block mb-2">Logo Size (px)</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min={32}
                                    max={120}
                                    step={4}
                                    value={parseInt(section.layout.logo_size || '48')}
                                    onChange={e => updateLayout({ logo_size: e.target.value })}
                                    className="flex-1 accent-violet-500"
                                />
                                <span className="text-xs font-bold text-black w-8 text-right">{section.layout.logo_size || 48}px</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-black uppercase tracking-widest block mb-2">Header Font</label>
                            <select 
                                value={section.layout.header_font || "'Outfit', sans-serif"}
                                onChange={e => updateLayout({ header_font: e.target.value })}
                                className="w-full bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2 text-xs font-semibold text-black outline-none focus:ring-2 focus:ring-violet-500/20 transition-all"
                            >
                                <option value="'Inter', sans-serif">Inter</option>
                                <option value="'Outfit', sans-serif">Outfit</option>
                                <option value="'Playfair Display', serif">Playfair Display</option>
                                <option value="'Lexend', sans-serif">Lexend</option>
                                <option value="'Bebas Neue', sans-serif">Bebas Neue</option>
                                <option value="'Cormorant Garamond', serif">Cormorant Garamond</option>
                                <option value="'Space Grotesk', sans-serif">Space Grotesk</option>
                                <option value="'Fraunces', serif">Fraunces</option>
                                <option value="'Montserrat', sans-serif">Montserrat</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-black uppercase tracking-widest block mb-2">Alignment</label>
                            <div className="flex bg-neutral-50 p-1 rounded-xl border border-neutral-100">
                                {[
                                    { id: 'left', icon: AlignLeft },
                                    { id: 'center', icon: AlignCenter },
                                    { id: 'right', icon: AlignRight },
                                ].map(align => (
                                    <button
                                        key={align.id}
                                        onClick={() => updateLayout({ header_alignment: align.id })}
                                        className={`flex-1 flex items-center justify-center py-2 rounded-lg transition-all ${
                                            (section.layout.header_alignment || 'left') === align.id
                                                ? 'bg-white text-violet-600 shadow-sm'
                                                : 'text-black hover:text-black'
                                        }`}
                                    >
                                        <align.icon size={16} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </PropGroup>
            )}

            <PropGroup title="Section Info">
                <PropInput label="Title" value={section.title} onChange={v => updateSection({ title: v })} />
                <PropInput label="Subtitle" value={section.subtitle || ''} onChange={v => updateSection({ subtitle: v })} />
            </PropGroup>

            <PropGroup title="Colors & Theme">
                <div className="grid grid-cols-2 gap-4">
                    <ColorRow 
                        label="Background" 
                        value={section.layout.background || (isHeader ? theme.headerBg || '#ffffff' : '#ffffff')} 
                        onChange={v => updateLayout({ background: v })} 
                    />
                    <ColorRow 
                        label="Border" 
                        value={section.layout.borderColor || '#000000'} 
                        onChange={v => updateLayout({ borderColor: v })} 
                    />
                    <ColorRow 
                        label="Title" 
                        value={section.layout.titleColor || '#000000'} 
                        onChange={v => updateLayout({ titleColor: v })} 
                    />
                    <ColorRow 
                        label="Subtitle" 
                        value={section.layout.subtitleColor || '#000000'} 
                        onChange={v => updateLayout({ subtitleColor: v })} 
                    />
                    <ColorRow 
                        label="Text" 
                        value={section.layout.textColor || '#000000'} 
                        onChange={v => updateLayout({ textColor: v })} 
                    />
                    <ColorRow 
                        label="Icon/Action" 
                        value={section.layout.iconColor || theme.primaryColor} 
                        onChange={v => updateLayout({ iconColor: v })} 
                    />
                    <ColorRow 
                        label="Badge/Alert" 
                        value={section.layout.badgeColor || '#ef4444'} 
                        onChange={v => updateLayout({ badgeColor: v })} 
                    />
                </div>
            </PropGroup>

            <PropGroup title="Background Image">
                <ImageUploader
                    currentUrl={section.layout.backgroundImage || ''}
                    onImageChange={url => updateLayout({ backgroundImage: url })}
                    aspectRatio="16/9"
                    compact
                />
                {section.layout.backgroundImage && (
                    <div className="mt-4 space-y-2">
                        <label className="text-[10px] font-bold text-black uppercase tracking-widest block">Overlay Opacity</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={section.layout.overlayOpacity ?? 40}
                                onChange={e => updateLayout({ overlayOpacity: parseInt(e.target.value) })}
                                className="flex-1 accent-violet-500"
                            />
                            <span className="text-xs font-bold text-black w-8 text-right">{section.layout.overlayOpacity ?? 40}%</span>
                        </div>
                    </div>
                )}
            </PropGroup>

            {!isHeader && (
                <PropGroup title="Grid Layout">
                    <PropInput label="Columns" value={(section.layout.columns ?? 1).toString()} onChange={v => updateLayout({ columns: parseInt(v) || 1 })} type="number" />
                    <label className="text-[10px] font-bold text-black uppercase tracking-widest mt-2 block">Column Presets</label>
                    <div className="grid grid-cols-4 gap-1.5 mt-1">
                        {[1, 2, 3, 4].map(c => (
                            <button key={c} onClick={() => updateLayout({ columns: c })}
                                className={`text-[10px] font-bold py-1.5 rounded-lg border transition-colors ${section.layout.columns === c ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-neutral-200 text-black'}`}
                            >{c} col</button>
                        ))}
                    </div>
                    <PropInput label="Gap (px)" value={(section.layout.gap ?? 16).toString()} onChange={v => updateLayout({ gap: parseInt(v) || 0 })} type="number" />
                </PropGroup>
            )}

            <PropGroup title="Structure & Layout">
                <div className="grid grid-cols-2 gap-3">
                    <PropInput label="Padding" value={section.layout.padding || ''} onChange={v => updateLayout({ padding: v })} placeholder="e.g. 24px" />
                    <PropInput label="Margin" value={section.layout.margin || ''} onChange={v => updateLayout({ margin: v })} placeholder="e.g. 0px" />
                    <PropInput label="Radius" value={section.layout.borderRadius || ''} onChange={v => updateLayout({ borderRadius: v })} placeholder="e.g. 0px" />
                    <PropInput label="Min Height" value={section.layout.minHeight || ''} onChange={v => updateLayout({ minHeight: v })} placeholder="e.g. 200px" />
                </div>
                
                <div className="mt-4 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-black uppercase tracking-widest block mb-2">Shadow Style</label>
                        <div className="grid grid-cols-4 gap-1.5">
                            {['none', 'sm', 'md', 'lg'].map(s => (
                                <button key={s} onClick={() => updateLayout({ boxShadow: s === 'none' ? 'none' : s })}
                                    className={`text-[10px] font-bold py-1.5 rounded-lg border transition-colors ${section.layout.boxShadow === s ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-neutral-200 text-black'}`}
                                >{s.toUpperCase()}</button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-bold text-black uppercase tracking-widest block mb-2">Section Opacity</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={section.layout.opacity ?? 100}
                                onChange={e => updateLayout({ opacity: parseInt(e.target.value) })}
                                className="flex-1 accent-violet-500"
                            />
                            <span className="text-xs font-bold text-black w-8 text-right">{section.layout.opacity ?? 100}%</span>
                        </div>
                    </div>
                </div>
            </PropGroup>

            <PropGroup title="Typography">
                <div className="space-y-4">
                    <div>
                        <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-2">Title Style</p>
                        <div className="grid grid-cols-2 gap-2">
                            <PropInput label="Size" value={section.layout.titleFontSize || ''} onChange={v => updateLayout({ titleFontSize: v })} placeholder="e.g. 24px" />
                            <PropInput label="Weight" value={section.layout.titleFontWeight || ''} onChange={v => updateLayout({ titleFontWeight: v })} placeholder="e.g. 700" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-black uppercase tracking-widest mb-2">Subtitle Style</p>
                        <div className="grid grid-cols-2 gap-2">
                            <PropInput label="Size" value={section.layout.subtitleFontSize || ''} onChange={v => updateLayout({ subtitleFontSize: v })} placeholder="e.g. 14px" />
                            <PropInput label="Weight" value={section.layout.subtitleFontWeight || ''} onChange={v => updateLayout({ subtitleFontWeight: v })} placeholder="e.g. 400" />
                        </div>
                    </div>
                </div>
            </PropGroup>

            {/* Slideshow settings for hero_banners */}
            {section.type === 'hero_banners' && (
                <PropGroup title="Banner Slideshow">
                    <label className="text-[10px] font-bold text-black uppercase tracking-widest block">Slide Duration (seconds)</label>
                    <div className="flex items-center gap-3 mt-1.5">
                        <input
                            type="range"
                            min={1}
                            max={15}
                            step={1}
                            value={section.layout.slideshowDuration || 5}
                            onChange={e => updateLayout({ slideshowDuration: parseInt(e.target.value) })}
                            className="flex-1 accent-violet-500"
                        />
                        <span className="text-sm font-bold text-black w-8 text-right">{section.layout.slideshowDuration || 5}s</span>
                    </div>
                </PropGroup>
            )}
        </>
    );
}

/* ─── Theme Properties ─── */

function ThemeProperties({ theme, dispatch }: { theme: any; dispatch: React.Dispatch<any> }) {
    const update = (updates: Record<string, any>) => dispatch({ type: 'UPDATE_THEME', updates });
    const FONTS = ['Inter', 'Roboto', 'Outfit', 'Poppins', 'DM Sans', 'Nunito', 'Sora'];

    return (
        <>
            <PropGroup title="Brand Colors">
                <ColorRow label="Primary" value={theme.primaryColor} onChange={v => update({ primary_color: v })} />
                <ColorRow label="Secondary" value={theme.secondaryColor} onChange={v => update({ secondary_color: v })} />
                <ColorRow label="Background" value={theme.backgroundColor} onChange={v => update({ bg_color: v })} />
                <ColorRow label="Buttons" value={theme.buttonColor} onChange={v => update({ button_color: v })} />
            </PropGroup>
            <PropGroup title="Typography">
                <label className="text-[10px] font-bold text-black uppercase tracking-widest mb-1 block">Font Family</label>
                <div className="grid grid-cols-2 gap-1.5">
                    {FONTS.map(f => (
                        <button key={f} onClick={() => update({ font_family: f })}
                            className={`text-xs font-medium py-2 rounded-lg border transition-colors ${theme.fontFamily === f ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-neutral-200 text-black hover:border-neutral-300'}`}
                            style={{ fontFamily: f }}
                        >{f}</button>
                    ))}
                </div>
                <p className="text-[9px] text-black mt-2">Font applies to all text in the homepage preview</p>
            </PropGroup>
            <PropGroup title="Header & Footer">
                <ColorRow label="Header BG" value={theme.headerBgColor || '#000000'} onChange={v => update({ header_bg_color: v })} />
                <ColorRow label="Webpage BG" value={theme.webpageBgColor || '#ffffff'} onChange={v => update({ webpage_bg_color: v })} />
            </PropGroup>
            <PropGroup title="Shape">
                <PropInput label="Card Radius" value={theme.cardRadius} onChange={v => update({ card_radius: v })} placeholder="e.g. 16px" />
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                    {[
                        { label: 'Sharp', value: '0px' },
                        { label: 'Soft', value: '8px' },
                        { label: 'Round', value: '16px' },
                        { label: 'Pill', value: '24px' },
                    ].map(r => (
                        <button key={r.label} onClick={() => update({ card_radius: r.value })}
                            className={`text-[9px] font-bold py-1.5 rounded-lg border transition-colors ${theme.cardRadius === r.value ? 'bg-violet-50 border-violet-300 text-violet-700' : 'border-neutral-200 text-black'}`}
                        >{r.label}</button>
                    ))}
                </div>
            </PropGroup>
        </>
    );
}

/* ─── Reusable Sub-components ─── */

function PropGroup({ title, children }: { title: string; children: React.ReactNode }) {
    const [open, setOpen] = useState(true);
    return (
        <div className="border border-neutral-100 rounded-xl overflow-hidden">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2.5 bg-neutral-50 hover:bg-neutral-100 transition-colors">
                <span className="text-[10px] font-bold text-black uppercase tracking-widest">{title}</span>
                <ChevronDown size={14} className={`text-black transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
                {open && <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden"><div className="p-3 space-y-2.5">{children}</div></motion.div>}
            </AnimatePresence>
        </div>
    );
}

function PropInput({ label, value, onChange, type = 'text', placeholder = '' }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return (
        <div>
            <label className="text-[10px] font-bold text-black uppercase tracking-widest mb-1 block">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400/30 transition-all bg-white"
            />
        </div>
    );
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex items-center gap-2">
            <input type="color" value={value} onChange={e => onChange(e.target.value)} className="w-8 h-8 rounded-lg border-0 p-0 cursor-pointer shrink-0" />
            <div className="flex-1">
                <span className="text-[10px] font-bold text-black uppercase tracking-widest block">{label}</span>
                <input type="text" value={value} onChange={e => onChange(e.target.value)} className="text-xs text-black font-mono w-full border-0 p-0 outline-none bg-transparent" />
            </div>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3"><Eye size={20} className="text-black" /></div>
            <p className="text-sm font-medium text-black">{text}</p>
            <p className="text-xs text-black mt-1">Click on the preview to select</p>
        </div>
    );
}
