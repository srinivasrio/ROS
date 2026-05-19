'use client';

import React from 'react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { toast } from 'sonner';

export const HEADER_FONTS = [
    { name: 'Inter', value: "'Inter', sans-serif" },
    { name: 'Outfit', value: "'Outfit', sans-serif" },
    { name: 'Playfair Display', value: "'Playfair Display', serif" },
    { name: 'Lexend', value: "'Lexend', sans-serif" },
    { name: 'Bebas Neue', value: "'Bebas Neue', sans-serif" },
    { name: 'Cormorant Garamond', value: "'Cormorant Garamond', serif" },
    { name: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
    { name: 'Fraunces', value: "'Fraunces', serif" },
    { name: 'Montserrat', value: "'Montserrat', sans-serif" }
];

export function RestaurantLogo({ profile, mode, onUpdate, sectionStyle, logoEl, className }: any) {
    const logoSize = parseInt(sectionStyle?.logo_size || '32');
    const restaurantName = profile?.name || 'Restaurant';

    const handleLogoUploadClick = () => {
        onUpdate('upload_logo', { elementId: logoEl?.id });
    };

    return (
        <div 
            className={cn(
                "relative group/logo flex items-center justify-center overflow-hidden transition-all duration-300",
                mode === 'admin' ? "cursor-pointer hover:ring-2 hover:ring-orange-500/50 rounded-xl" : "rounded-xl",
                className
            )}
            style={{ width: `${logoSize}px`, height: `${logoSize}px` }}
        >
            {profile?.logo_url ? (
                <img 
                    src={profile.logo_url} 
                    alt={restaurantName}
                    className="w-full h-full object-contain"
                />
            ) : (
                <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-black">
                    <LucideIcons.UtensilsCrossed size={logoSize * 0.5} />
                </div>
            )}

            {mode === 'admin' && (
                <div 
                    onClick={handleLogoUploadClick}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                >
                    <LucideIcons.Upload className="text-white" size={16} />
                </div>
            )}
        </div>
    );
}

export function MainHeader({ 
    profile, 
    mode = 'customer', 
    onUpdate, 
    section,
    sectionStyle,
    onSearchClick,
    children,
    showSearch = true,
    className,
    theme
}: any) {
    const layout = { ...(section?.layout || {}), ...(sectionStyle || {}) };
    const elements = section?.elements || [];
    
    // Find elements
    const logoEl = elements.find((el: any) => el.type === 'image' && el.content?.isLogo);
    const headingEl = elements.find((el: any) => el.type === 'heading');
    const subtitleEl = elements.find((el: any) => el.type === 'subtitle');

    const restaurantName = headingEl?.content?.text || profile?.name || 'Restaurant Name';
    const logoUrl = logoEl?.content?.url || profile?.logo_url;
    
    const logoSize = parseInt(layout.logo_size || '32');
    const headerFont = layout.header_font || "'Outfit', sans-serif";
    const headerFontSize = parseInt(layout.title_font_size || layout.titleFontSize || layout.header_font_size || '18');
    const headerAlignment = layout.header_alignment || 'left';
    
    const padding = layout.padding || '4px 16px';
    const margin = layout.margin || '0px';
    const borderRadius = layout.borderRadius || '0px';
    
    const shadowStyles: Record<string, string> = {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        none: 'none'
    };

    const handleAddElement = (type: string) => {
        if (!onUpdate || (!section?.id && !section?.section_type)) return;
        
        let defaultText = 'New Subtitle';
        if (type === 'heading') {
            defaultText = profile?.name || 'Restaurant Name';
        } else if (type === 'subtitle') {
            defaultText = section?.section_subtitle || 'Tagline here';
        }

        let element: any = {
            id: Math.random().toString(36).substring(7),
            type,
            content: type === 'image' ? { url: '', isLogo: true } : { text: defaultText }
        };

        onUpdate('add_element', { sectionId: section.id || section.section_type, element });
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} added successfully`);
    };

    const handleTextUpdate = (elementId: string, text: string) => {
        if (!onUpdate || (!section?.id && !section?.section_type)) return;
        onUpdate('update_element_content', { 
            sectionId: section.id || section.section_type,
            elementId: elementId,
            content: { text }
        });
    };

    return (
        <header 
            className={cn("relative group/header sticky top-0 z-[100] transition-all duration-300 overflow-hidden", className)}
            style={{ 
                backgroundColor: layout.section_bg_color || theme?.header_bg_color || layout.background || '#ffffff',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                padding: layout.padding || '4px 16px',
                margin: layout.margin || '0px',
                borderRadius: layout.border_radius || layout.borderRadius || '0px',
                boxShadow: shadowStyles[layout.shadow || layout.boxShadow || 'none'],
                borderBottom: layout.border_color || layout.borderColor ? `1px solid ${layout.border_color || layout.borderColor}` : (borderRadius === '0px' ? '1px solid #f5f5f5' : 'none'),
                opacity: (() => {
                    if (layout.opacity === undefined || layout.opacity === null || layout.opacity === '') return 1;
                    const parsed = parseFloat(layout.opacity);
                    if (isNaN(parsed)) return 1;
                    return parsed <= 1 ? parsed : parsed / 100;
                })(),
            } as React.CSSProperties}
        >
            {/* Background Image & Overlay */}
            {layout.backgroundImage && (
                <>
                    <div 
                        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                        style={{ backgroundImage: `url(${layout.backgroundImage})` }}
                    />
                    <div 
                        className="absolute inset-0 z-[1]"
                        style={{ 
                            backgroundColor: 'black',
                            opacity: (layout.overlayOpacity || 0) / 100 
                        }}
                    />
                </>
            )}

            <div className="relative z-10 max-w-2xl mx-auto h-full grid grid-cols-[auto_1fr_auto] gap-x-4 items-center">
                {/* Logo Section */}
                <div className="flex items-center">
                    {logoUrl || mode !== 'admin' ? (
                        <RestaurantLogo 
                            profile={{ ...profile, logo_url: logoUrl }}
                            mode={mode}
                            onUpdate={onUpdate}
                            sectionStyle={layout}
                            logoEl={logoEl}
                        />
                    ) : (
                        <button 
                            onClick={() => handleAddElement('image')}
                            className="w-12 h-12 border-2 border-dashed border-neutral-300 rounded-xl flex items-center justify-center text-black hover:border-orange-500 hover:text-orange-500 transition-colors"
                        >
                            <LucideIcons.Plus size={20} />
                        </button>
                    )}
                </div>

                {/* Text Content Section */}
                <div className="flex flex-col gap-0.5 overflow-hidden">
                    {headingEl ? (
                        <h1 
                            className={cn(
                                "font-black leading-tight tracking-tight truncate",
                                mode === 'admin' && "hover:ring-1 hover:ring-orange-500/30 rounded px-1 -mx-1"
                            )}
                            style={{ 
                                color: layout.title_color || layout.titleColor || '#000000',
                                fontSize: `${headerFontSize}px`,
                                fontFamily: headerFont,
                                textAlign: (headerAlignment === 'center' ? 'center' : headerAlignment === 'right' ? 'right' : 'left') as any
                            }}
                            contentEditable={mode === 'admin'}
                            onBlur={(e) => handleTextUpdate(headingEl.id, e.currentTarget.innerText)}
                            suppressContentEditableWarning
                        >
                            {headingEl.content?.text}
                        </h1>
                    ) : mode === 'admin' ? (
                        <button 
                            onClick={() => handleAddElement('heading')}
                            className="text-left text-sm font-medium text-black hover:text-orange-500 flex items-center gap-1"
                        >
                            <LucideIcons.Plus size={12} /> Add Title
                        </button>
                    ) : (
                        <h1 
                            className="font-black leading-tight tracking-tight truncate"
                            style={{ 
                                color: layout.titleColor || '#000000',
                                fontSize: `${headerFontSize}px`,
                                fontFamily: headerFont,
                                textAlign: (headerAlignment === 'center' ? 'center' : headerAlignment === 'right' ? 'right' : 'left') as any
                            }}
                        >
                            {section?.section_title || profile?.name || 'Restaurant Name'}
                        </h1>
                    )}

                    {subtitleEl ? (
                        <p 
                            className={cn(
                                "text-xs font-medium truncate",
                                mode === 'admin' && "hover:ring-1 hover:ring-orange-500/30 rounded px-1 -mx-1"
                            )}
                            style={{ color: layout.subtitleColor || '#000000' }}
                            contentEditable={mode === 'admin'}
                            onBlur={(e) => handleTextUpdate(subtitleEl.id, e.currentTarget.innerText)}
                            suppressContentEditableWarning
                        >
                            {subtitleEl.content?.text}
                        </p>
                    ) : (section?.section_subtitle || layout.subtitle || mode === 'admin') && (
                        mode === 'admin' && !section?.section_subtitle && !layout.subtitle ? (
                            <button 
                                onClick={() => handleAddElement('subtitle')}
                                className="text-left text-xs font-medium text-black hover:text-orange-500 flex items-center gap-1"
                            >
                                <LucideIcons.Plus size={10} /> Add Subtitle
                            </button>
                        ) : (
                            <p 
                                className="text-xs font-medium truncate"
                                style={{ color: layout.subtitle_color || layout.subtitleColor || '#000000' }}
                            >
                                {section?.section_subtitle || layout.subtitle || 'Tagline here'}
                            </p>
                        )
                    )}
                </div>

                {/* Actions Section */}
                <div className="flex items-center gap-2 shrink-0">
                    {children}
                    {showSearch && (
                        <button 
                            onClick={onSearchClick}
                            className="p-2 bg-white/10 backdrop-blur-md border border-white/10 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
                            style={{ 
                                color: layout.iconColor || layout.titleColor || '#000000',
                                backgroundColor: layout.badgeColor ? `${layout.badgeColor}20` : 'rgba(255,255,255,0.1)',
                                borderColor: layout.badgeColor ? `${layout.badgeColor}40` : 'rgba(255,255,255,0.1)'
                            }}
                        >
                            <LucideIcons.Search size={18} />
                        </button>
                    )}
                </div>
            </div>
        </header>
    );
}
