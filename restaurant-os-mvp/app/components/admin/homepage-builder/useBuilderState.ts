'use client';

import { useReducer, useCallback, useRef, useEffect } from 'react';

// ─────────────────────────── Types ───────────────────────────

export type PreviewMode = 'desktop' | 'tablet' | 'mobile';
export type PublishStatus = 'draft' | 'published';

export interface ElementStyle {
    fontSize?: string;
    fontWeight?: string;
    color?: string;
    backgroundColor?: string;
    textAlign?: string;
    borderRadius?: string;
    padding?: string;
    margin?: string;
    width?: string;
    height?: string;
    minHeight?: string;
    maxHeight?: string;
    minWidth?: string;
    maxWidth?: string;
    objectFit?: string;
    aspectRatio?: string;
    position?: string;
    left?: string;
    top?: string;
    right?: string;
    bottom?: string;
    zIndex?: number | string;
    display?: string;
    flexDirection?: string;
    alignItems?: string;
    justifyContent?: string;
    gap?: string;
    opacity?: number | string;
    border?: string;
    boxShadow?: string;
}

export interface ElementSchedule {
    startDatetime?: string;
    endDatetime?: string;
    repeatType?: 'none' | 'daily' | 'weekly' | 'monthly';
    priority?: number;
}

export interface BuilderElement {
    id: string;
    type: 'banner' | 'category' | 'offer' | 'quick_action' | 'text' | 'image' | 'button' | 'combo' | 'promo' | 'chef_special' | 'heading' | 'subtitle' | 'footer_info' | 'status' | 'service' | 'table_info' | 'popular_item' | 'reorder_card';
    sectionId: string;
    content: Record<string, any>;
    style: ElementStyle;
    order: number;
    schedule?: ElementSchedule;
    visible: boolean;
}

export interface SectionLayout {
    columns: number;
    gap: number;
    padding: string;
    margin?: string;
    borderRadius?: string;
    background?: string;
    backgroundImage?: string;
    overlayOpacity?: number;
    minHeight?: string;
    opacity?: number;
    boxShadow?: string;
    borderColor?: string;
    
    // Text colors
    titleColor?: string;
    subtitleColor?: string;
    textColor?: string;
    
    // Element colors (icons, badges)
    iconColor?: string;
    badgeColor?: string;
    
    // Typography
    titleFontSize?: string;
    subtitleFontSize?: string;
    titleFontWeight?: string;
    subtitleFontWeight?: string;
    
    slideshowDuration?: number; // seconds between slides for hero_banners

    // Header-specific
    logo_size?: string;
    header_font?: string;
    header_alignment?: string;
}

export interface BuilderSection {
    id: string;
    type: string;
    section_type?: string; // snake_case alias from Supabase
    title: string;
    subtitle?: string;
    order: number;
    active: boolean;
    layout: SectionLayout;
    elements: BuilderElement[];
}

export interface ThemeConfig {
    primary_color: string;
    secondary_color: string;
    bg_color: string;
    button_color: string;
    card_radius: string;
    font_family: string;
    webpage_bg_color: string;
    header_bg_color: string;
}

export interface BuilderState {
    sections: BuilderSection[];
    theme: ThemeConfig;
    profile: any;
    data: any;
    selectedElementId: string | null;
    selectedSectionId: string | null;
    previewMode: PreviewMode;
    isDirty: boolean;
    publishStatus: PublishStatus;
    hoveredElementId: string | null;
    inlineEditingId: string | null;
}

// ─────────────────────────── Actions ───────────────────────────

type BuilderAction =
    | { type: 'SET_SECTIONS'; sections: BuilderSection[] }
    | { type: 'SET_THEME'; theme: ThemeConfig }
    | { type: 'SELECT_ELEMENT'; elementId: string | null; sectionId?: string | null }
    | { type: 'SELECT_SECTION'; sectionId: string | null }
    | { type: 'HOVER_ELEMENT'; elementId: string | null }
    | { type: 'SET_INLINE_EDITING'; elementId: string | null }
    | { type: 'SET_PREVIEW_MODE'; mode: PreviewMode }
    | { type: 'UPDATE_ELEMENT'; sectionId: string; elementId: string; updates: Partial<BuilderElement> }
    | { type: 'UPDATE_ELEMENT_CONTENT'; sectionId: string; elementId: string; content: Record<string, any> }
    | { type: 'UPDATE_ELEMENT_STYLE'; sectionId: string; elementId: string; style: Partial<ElementStyle> }
    | { type: 'ADD_ELEMENT'; sectionId: string; element: BuilderElement }
    | { type: 'REMOVE_ELEMENT'; sectionId: string; elementId: string }
    | { type: 'MOVE_ELEMENT'; sectionId: string; fromIndex: number; toIndex: number }
    | { type: 'UPDATE_SECTION'; sectionId: string; updates: Partial<BuilderSection> }
    | { type: 'UPDATE_SECTION_LAYOUT'; sectionId: string; layout: Partial<SectionLayout> }
    | { type: 'TOGGLE_SECTION_ACTIVE'; sectionId: string }
    | { type: 'UPDATE_THEME'; updates: Partial<ThemeConfig> }
    | { type: 'SET_DIRTY'; isDirty: boolean }
    | { type: 'SET_PUBLISH_STATUS'; status: PublishStatus }
    | { type: 'UPDATE_PROFILE'; profile: any }
    | { type: 'SET_HOMEPAGE_DATA'; data: any }
    | { type: 'UPDATE_SECTION_DATA'; section: string; payload: any }
    | { type: 'REMOVE_SECTION_ITEM'; section: string; id: string }
    | { type: 'UPDATE_SECTION_STYLE'; section_name: string; style: Record<string, string> }
    | { type: 'RESTORE_STATE'; state: BuilderState };

// ─────────────────────────── Reducer ───────────────────────────

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
    switch (action.type) {
        case 'SET_SECTIONS':
            return { ...state, sections: action.sections };

        case 'SET_THEME':
            return { ...state, theme: action.theme };

        case 'SELECT_ELEMENT':
            return {
                ...state,
                selectedElementId: action.elementId,
                selectedSectionId: action.sectionId ?? state.selectedSectionId,
                inlineEditingId: null,
            };

        case 'SELECT_SECTION':
            return { ...state, selectedSectionId: action.sectionId, selectedElementId: null, inlineEditingId: null };

        case 'HOVER_ELEMENT':
            return { ...state, hoveredElementId: action.elementId };

        case 'SET_INLINE_EDITING':
            return { ...state, inlineEditingId: action.elementId };

        case 'SET_PREVIEW_MODE':
            return { ...state, previewMode: action.mode };

        case 'UPDATE_ELEMENT': {
            const newData = { ...state.data } as any;
            const sections = state.sections.map(s => {
                const match = s.id === action.sectionId || s.section_type === action.sectionId;
                if (!match) return s;
                
                const elements = s.elements || [];
                const newElements = elements.map(el =>
                    el.id === action.elementId ? { ...el, ...action.updates } : el
                );

                // Sync with state.data
                const sectionTypeMapInv: Record<string, string> = {
                    'hero_banners': 'banners',
                    'categories': 'categories',
                    'services': 'services',
                    'offers': 'offers',
                    'specials': 'specials',
                    'combos': 'combos'
                };
                const dataKey = sectionTypeMapInv[s.section_type || ''] || sectionTypeMapInv[s.type || ''];
                if (dataKey && newData[dataKey]) {
                    newData[dataKey] = newData[dataKey].map((item: any) => {
                        if (item.id === action.elementId) {
                            const updates: any = {};
                            if (action.updates.content) Object.assign(updates, action.updates.content);
                            if (action.updates.visible !== undefined) updates.active = action.updates.visible;
                            if (action.updates.order !== undefined) updates.order_index = action.updates.order;
                            return { ...item, ...updates };
                        }
                        return item;
                    });
                }

                return { ...s, elements: newElements };
            });
            return { ...state, sections, data: newData, isDirty: true };
        }

        case 'UPDATE_ELEMENT_CONTENT': {
            const newData = { ...state.data } as any;
            const sections = state.sections.map(s => {
                const match = s.id === action.sectionId || s.section_type === action.sectionId;
                if (!match) return s;
                
                const elements = s.elements || [];
                const newElements = elements.map(el =>
                    el.id === action.elementId
                        ? { ...el, content: { ...el.content, ...action.content } }
                        : el
                );

                // Sync with state.data
                const sectionTypeMapInv: Record<string, string> = {
                    'hero_banners': 'banners',
                    'categories': 'categories',
                    'services': 'services',
                    'offers': 'offers',
                    'specials': 'specials',
                    'combos': 'combos'
                };
                const dataKey = sectionTypeMapInv[s.section_type || ''] || sectionTypeMapInv[s.type || ''];
                if (dataKey && newData[dataKey]) {
                    newData[dataKey] = newData[dataKey].map((item: any) => 
                        item.id === action.elementId ? { ...item, ...action.content } : item
                    );
                }

                return { ...s, elements: newElements };
            });
            return { ...state, sections, data: newData, isDirty: true };
        }

        case 'UPDATE_ELEMENT_STYLE': {
            const sections = state.sections.map(s => {
                if (s.id !== action.sectionId && s.section_type !== action.sectionId) return s;
                const elements = s.elements || [];
                return {
                    ...s,
                    elements: elements.map(el =>
                        el.id === action.elementId
                            ? { ...el, style: { ...el.style, ...action.style } }
                            : el
                    ),
                };
            });
            return { ...state, sections, isDirty: true };
        }

        case 'ADD_ELEMENT': {
            const newData = { ...state.data } as any;
            const sections = state.sections.map(s => {
                const match = s.id === action.sectionId || s.section_type === action.sectionId;
                if (!match) return s;
                
                const elements = s.elements || [];
                const newId = action.element.id || generateId();
                const newElement = { ...action.element, id: newId };

                // Sync with state.data
                const sectionTypeMapInv: Record<string, string> = {
                    'hero_banners': 'banners',
                    'categories': 'categories',
                    'services': 'services',
                    'offers': 'offers',
                    'specials': 'specials',
                    'combos': 'combos'
                };
                const dataKey = sectionTypeMapInv[s.section_type || ''] || sectionTypeMapInv[s.type || ''];
                if (dataKey && newData[dataKey]) {
                    const newItem = {
                        id: newId,
                        ...(newElement.content || {}),
                        active: newElement.visible !== false,
                        order_index: newElement.order || 0
                    };
                    newData[dataKey] = [...(newData[dataKey] || []), newItem];
                }

                return { ...s, elements: [...elements, newElement] };
            });
            return { ...state, sections, data: newData, isDirty: true };
        }

        case 'REMOVE_ELEMENT': {
            const newData = { ...state.data } as any;
            const sections = state.sections.map(s => {
                const match = s.id === action.sectionId || s.section_type === action.sectionId;
                if (!match) return s;

                // Sync with state.data
                const sectionTypeMapInv: Record<string, string> = {
                    'hero_banners': 'banners',
                    'categories': 'categories',
                    'services': 'services',
                    'offers': 'offers',
                    'specials': 'specials',
                    'combos': 'combos'
                };
                const dataKey = sectionTypeMapInv[s.section_type || ''] || sectionTypeMapInv[s.type || ''];
                if (dataKey && newData[dataKey]) {
                    newData[dataKey] = newData[dataKey].filter((item: any) => item.id !== action.elementId);
                }

                const elements = s.elements || [];
                return { ...s, elements: elements.filter(el => el.id !== action.elementId) };
            });
            return {
                ...state,
                sections,
                data: newData,
                isDirty: true,
                selectedElementId: state.selectedElementId === action.elementId ? null : state.selectedElementId,
            };
        }

        case 'MOVE_ELEMENT': {
            const sections = state.sections.map(s => {
                if (s.id !== action.sectionId) return s;
                const elements = [...(s.elements || [])];
                const [moved] = elements.splice(action.fromIndex, 1);
                elements.splice(action.toIndex, 0, moved);
                return { ...s, elements: elements.map((el, i) => ({ ...el, order: i })) };
            });
            return { ...state, sections, isDirty: true };
        }


        case 'UPDATE_SECTION': {
            const sections = state.sections.map(s =>
                s.id === action.sectionId ? { ...s, ...action.updates } : s
            );
            return { ...state, sections, isDirty: true };
        }

        case 'UPDATE_SECTION_LAYOUT': {
            const sections = state.sections.map(s =>
                (s.id === action.sectionId || s.section_type === action.sectionId) ? { ...s, layout: { ...s.layout, ...action.layout } } : s
            );
            return { ...state, sections, isDirty: true };
        }

        case 'TOGGLE_SECTION_ACTIVE': {
            const sections = state.sections.map(s =>
                (s.id === action.sectionId || s.section_type === action.sectionId) ? { ...s, active: !s.active } : s
            );
            return { ...state, sections, isDirty: true };
        }

        case 'UPDATE_THEME':
            return { ...state, theme: { ...state.theme, ...action.updates }, isDirty: true };

        case 'SET_DIRTY':
            return { ...state, isDirty: action.isDirty };

        case 'SET_PUBLISH_STATUS':
            return { ...state, publishStatus: action.status };

        case 'UPDATE_PROFILE':
            return { ...state, profile: { ...state.profile, ...action.profile }, isDirty: true };

        case 'SET_HOMEPAGE_DATA':
            return { ...state, data: action.data };

        case 'UPDATE_SECTION_DATA': {
            const newData = { ...state.data } as any;
            const newSections = [...state.sections];
            const sectionKey = action.section;
            
            // Map data key to section_type
            const sectionTypeMap: Record<string, string> = {
                'banners': 'hero_banners',
                'categories': 'categories',
                'services': 'services',
                'offers': 'offers',
                'specials': 'specials',
                'combos': 'combos'
            };
            const targetSectionType = sectionTypeMap[sectionKey];

            // 1. Update state.data
            if (action.payload && action.payload.id && action.payload.data) {
                const currentArray = newData[sectionKey] || [];
                const updates = action.payload.data;
                
                // Handle special case: moving between specials and combos
                if (updates.special_type && (sectionKey === 'specials' || sectionKey === 'combos')) {
                    const item = currentArray.find((i: any) => i.id === action.payload.id);
                    if (item && item.special_type !== updates.special_type) {
                        const targetSection = updates.special_type === 'single' ? 'specials' : 'combos';
                        const sourceSection = sectionKey;
                        
                        if (targetSection !== sourceSection) {
                            newData[sourceSection] = currentArray.filter((i: any) => i.id !== action.payload.id);
                            const targetArray = newData[targetSection] || [];
                            newData[targetSection] = [...targetArray, { ...item, ...updates }];
                            
                            // For sections too
                            const sourceSecIdx = newSections.findIndex(s => s.section_type === sectionTypeMap[sourceSection]);
                            const targetSecIdx = newSections.findIndex(s => s.section_type === sectionTypeMap[targetSection]);
                            
                            if (sourceSecIdx !== -1) {
                                newSections[sourceSecIdx] = {
                                    ...newSections[sourceSecIdx],
                                    elements: (newSections[sourceSecIdx].elements || []).filter((el: any) => el.id !== action.payload.id)
                                };
                            }
                            if (targetSecIdx !== -1) {
                                const newEl: BuilderElement = {
                                    id: action.payload.id,
                                    type: 'item' as any, // 'item' is not in the union but used internally?
                                    sectionId: newSections[targetSecIdx].id,
                                    content: { ...item, ...updates },
                                    style: {},
                                    order: (newSections[targetSecIdx].elements || []).length,
                                    visible: true
                                };
                                newSections[targetSecIdx] = {
                                    ...newSections[targetSecIdx],
                                    elements: [...(newSections[targetSecIdx].elements || []), newEl]
                                };
                            }

                            return { ...state, data: newData, sections: newSections, isDirty: true };
                        }
                    }
                }

                newData[sectionKey] = currentArray.map((item: any) => 
                    item.id === action.payload.id ? { ...item, ...action.payload.data } : item
                );
            } else {
                newData[sectionKey] = action.payload;
            }

            // 2. Sync with state.sections
            if (targetSectionType) {
                const sectionIdx = newSections.findIndex(s => s.section_type === targetSectionType || (s as any).type === targetSectionType);
                if (sectionIdx !== -1) {
                    const section = { ...newSections[sectionIdx] };
                    
                    if (action.payload && action.payload.id && action.payload.data) {
                        if (section.elements && Array.isArray(section.elements)) {
                            section.elements = section.elements.map((el: any) => {
                                if (el.id === action.payload.id) {
                                    return {
                                        ...el,
                                        content: { ...(el.content || {}), ...action.payload.data }
                                    };
                                }
                                return el;
                            });
                        }
                    } else if (Array.isArray(action.payload)) {
                        section.elements = action.payload.map((item: any, idx: number) => ({
                            id: item.id || generateId(),
                            type: (targetSectionType === 'hero_banners' ? 'banner' : 'item') as any,
                            sectionId: section.id,
                            content: { ...item },
                            style: {},
                            order: idx,
                            visible: true
                        }));
                    }
                    newSections[sectionIdx] = section;
                }
            }

            return { ...state, data: newData, sections: newSections, isDirty: true };
        }

        case 'REMOVE_SECTION_ITEM': {
            const newData = { ...state.data } as any;
            const newSections = [...state.sections];
            const sectionKey = action.section;
            
            const sectionTypeMap: Record<string, string> = {
                'banners': 'hero_banners',
                'categories': 'categories',
                'services': 'services',
                'offers': 'offers',
                'specials': 'specials',
                'combos': 'combos'
            };
            const targetSectionType = sectionTypeMap[sectionKey];

            if (Array.isArray(newData[sectionKey])) {
                newData[sectionKey] = newData[sectionKey].filter((item: any) => item.id !== action.id);
            }

            if (targetSectionType) {
                const sectionIdx = newSections.findIndex(s => s.section_type === targetSectionType || (s as any).type === targetSectionType);
                if (sectionIdx !== -1) {
                    const section = { ...newSections[sectionIdx] };
                    if (section.elements && Array.isArray(section.elements)) {
                        section.elements = section.elements.filter((el: any) => el.id !== action.id);
                    }
                    newSections[sectionIdx] = section;
                }
            }

            return { ...state, data: newData, sections: newSections, isDirty: true };
        }

        case 'RESTORE_STATE':
            return { ...action.state, hoveredElementId: null, inlineEditingId: null };

        case 'UPDATE_SECTION_STYLE': {
            const newData = { ...state.data } as any;
            if (!newData.sectionStyles) newData.sectionStyles = {};
            newData.sectionStyles = {
                ...newData.sectionStyles,
                [action.section_name]: action.style === null ? {} : {
                    ...(newData.sectionStyles[action.section_name] || {}),
                    ...action.style
                }
            };
            return { ...state, data: newData, isDirty: true };
        }

        default:
            return state;
    }
}

// ─────────────────────────── Default State ───────────────────────────

const defaultTheme: ThemeConfig = {
    primary_color: '#f97316',
    secondary_color: '#ef4444',
    bg_color: '#ffffff',
    button_color: '#111827',
    card_radius: '16px',
    font_family: 'Inter',
    webpage_bg_color: '#ffffff',
    header_bg_color: '#ffffff',
};

const initialState: BuilderState = {
    sections: [],
    theme: defaultTheme,
    profile: {},
    data: {
        banners: [],
        categories: [],
        services: [],
        specials: [],
        combos: [],
        offers: [],
        popularItems: [],
        recentOrders: []
    },
    selectedElementId: null,
    selectedSectionId: null,
    previewMode: 'mobile',
    isDirty: false,
    publishStatus: 'draft',
    hoveredElementId: null,
    inlineEditingId: null,
};

// ─────────────────────────── Helpers ───────────────────────────

export function generateId(): string {
    // Generate a UUID-v4 compatible ID for Supabase compatibility
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older environments
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export function createDefaultElement(
    type: BuilderElement['type'],
    sectionId: string,
    order: number
): BuilderElement {
    const id = generateId();
    const base: BuilderElement = {
        id,
        type,
        sectionId,
        content: {},
        style: {},
        order,
        visible: true,
    };

    switch (type) {
        case 'banner':
            return { ...base, content: { imageUrl: '', heading: 'New Banner', subheading: 'Your message here', ctaText: 'Order Now', ctaAction: 'menu' } };
        case 'category':
            return { ...base, content: { imageUrl: '', title: 'Category', redirectTarget: '/menu' }, style: { aspectRatio: '1/1' } };
        case 'offer':
            return { ...base, content: { imageUrl: '', title: 'Special Offer', description: 'Limited time deal', couponCode: '', expiryDate: '' } };
        case 'quick_action':
            return { ...base, content: { icon: 'Utensils', label: 'Action', redirectTarget: '', imageUrl: '' } };
        case 'text':
            return { ...base, content: { text: 'Edit this text' }, style: { fontSize: '16px' } };
        case 'heading':
            return { ...base, content: { text: 'Section Heading' }, style: { fontSize: '28px', fontWeight: '800' } };
        case 'subtitle':
            return { ...base, content: { text: 'Section subtitle goes here' }, style: { fontSize: '14px', color: '#6b7280' } };
        case 'image':
            return { ...base, content: { imageUrl: '', alt: 'Image' }, style: { aspectRatio: '16/9' } };
        case 'button':
            return { ...base, content: { label: 'Click Me', action: '', redirectTarget: '' }, style: { borderRadius: '12px', padding: '12px 24px' } };
        case 'combo':
            return { ...base, content: { title: 'Combo Deal', description: 'Save more with combos', imageUrl: '', price: '', originalPrice: '', items: [] } };
        case 'promo':
            return { ...base, content: { text: 'Free delivery on orders above ₹499!', backgroundColor: '#f97316', textColor: '#ffffff' } };
        case 'chef_special':
            return { ...base, content: { title: "Chef's Special", description: 'Handpicked by our chef', imageUrl: '', price: '' } };
        case 'footer_info':
            return { ...base, content: { phone: '', address: '', email: '', instagram: '', facebook: '', website: '', copyright: '© 2026 Your Restaurant' } };
        case 'status':
            return { ...base, content: { isOpened: true, closingTime: '22:00', openedText: 'Open Now', closedText: 'Closed', showClosingTime: true } };
        case 'service':
            return { ...base, content: { title: 'Dine In', description: 'Enjoy your meal here', icon: 'Utensils', redirectTarget: '/book', imageUrl: '' } };
        default:
            return base;
    }
}

export function createDefaultSection(type: string, order: number): BuilderSection {
    const id = generateId();
    const sectionDefaults: Record<string, Partial<BuilderSection>> = {
        header: { 
            title: 'Header', 
            layout: { columns: 1, gap: 12, padding: '16px 24px' },
        },
        hero_banners: { title: 'Hero Banners', layout: { columns: 1, gap: 16, padding: '0' }, },
        categories: { title: 'Categories', layout: { columns: 4, gap: 16, padding: '16px 24px' } },
        services: { title: 'Services', layout: { columns: 2, gap: 16, padding: '16px 24px' } },
        specials: { title: "Today's Specials", layout: { columns: 2, gap: 16, padding: '16px 24px' } },
        combos: { title: 'Combo Offers', layout: { columns: 2, gap: 16, padding: '16px 24px' } },
        offers: { title: 'Coupons & Offers', layout: { columns: 1, gap: 16, padding: '16px 24px' } },
        popular: { title: 'Popular Items', layout: { columns: 2, gap: 16, padding: '16px 24px' } },
        reorder: { title: 'Reorder Section', layout: { columns: 1, gap: 16, padding: '16px 24px' } },
        footer: { title: 'Footer', layout: { columns: 1, gap: 0, padding: '24px' } },
    };

    const defaults = sectionDefaults[type] || { title: type, layout: { columns: 1, gap: 16, padding: '16px 24px' } };

    return {
        id,
        type,
        title: defaults.title || type,
        order,
        active: true,
        layout: defaults.layout || { columns: 1, gap: 16, padding: '16px 24px' },
        elements: (defaults.elements || []).map(el => ({ ...el, sectionId: id })),
    };
}

// ─────────────────────────── Hook ───────────────────────────

export function useBuilderState() {
    const [state, dispatch] = useReducer(builderReducer, initialState);

    // Undo / Redo history
    const historyRef = useRef<BuilderState[]>([]);
    const historyIndexRef = useRef(-1);
    const skipHistoryRef = useRef(false);

    // Push current state to history on dirty changes
    useEffect(() => {
        if (state.isDirty && !skipHistoryRef.current) {
            const maxHistory = 50;
            // Truncate forward history when new action occurs
            historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
            historyRef.current.push(JSON.parse(JSON.stringify(state)));
            if (historyRef.current.length > maxHistory) {
                historyRef.current.shift();
            }
            historyIndexRef.current = historyRef.current.length - 1;
        }
        skipHistoryRef.current = false;
    }, [state.sections, state.theme]);

    const undo = useCallback(() => {
        if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
            skipHistoryRef.current = true;
            dispatch({ type: 'RESTORE_STATE', state: historyRef.current[historyIndexRef.current] });
        }
    }, []);

    const redo = useCallback(() => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current++;
            skipHistoryRef.current = true;
            dispatch({ type: 'RESTORE_STATE', state: historyRef.current[historyIndexRef.current] });
        }
    }, []);

    const canUndo = historyIndexRef.current > 0;
    const canRedo = historyIndexRef.current < historyRef.current.length - 1;

    // Helper to find the element + section
    const getSelectedElement = useCallback((): { element: BuilderElement; section: BuilderSection } | null => {
        if (!state.selectedElementId) return null;
        for (const section of state.sections) {
            const element = section.elements.find(el => el.id === state.selectedElementId);
            if (element) return { element, section };
        }
        return null;
    }, [state.selectedElementId, state.sections]);

    const getSelectedSection = useCallback((): BuilderSection | null => {
        if (!state.selectedSectionId) return null;
        return state.sections.find(s => s.id === state.selectedSectionId) || null;
    }, [state.selectedSectionId, state.sections]);

    return {
        state,
        dispatch,
        undo,
        redo,
        canUndo,
        canRedo,
        getSelectedElement,
        getSelectedSection,
    };
}
