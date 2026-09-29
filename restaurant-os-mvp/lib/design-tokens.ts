/**
 * Dine in One - Centralized Design Tokens
 * 
 * CORE PRINCIPLE: Restaurants customize CONTENT, not CORE DESIGN.
 * Every restaurant on the multi-tenant SaaS platform shares this exact visual system.
 */

export const DESIGN_TOKENS = {
  // Brand & Palette
  colors: {
    primary: '#EA580C',        // Warm Saffron / Orange-600
    primaryHover: '#C2410C',   // Deep Saffron / Orange-700
    primaryLight: '#FFF7ED',   // Warm Cream / Orange-50
    primaryMuted: '#FFEDD5',   // Orange-100
    secondary: '#0F172A',      // Slate-900
    secondaryHover: '#1E293B', // Slate-800
    accent: '#F59E0B',         // Warm Amber-500
    accentHover: '#D97706',    // Amber-600
    accentLight: '#FEF3C7',    // Amber-100

    // Canvas & Surfaces
    background: '#F8FAFC',     // Slate-50 Clean Canvas
    backgroundAlt: '#F1F5F9',  // Slate-100
    surface: '#FFFFFF',        // Pure Crisp White
    surfaceGlass: 'rgba(255, 255, 255, 0.88)',
    surfaceDarkGlass: 'rgba(15, 23, 42, 0.85)',

    // Typography
    textPrimary: '#0F172A',    // Slate-900 (High contrast)
    textSecondary: '#475569',  // Slate-600
    textMuted: '#94A3B8',      // Slate-400
    textInverted: '#FFFFFF',

    // Borders & Dividers
    borderSubtle: '#E2E8F0',   // Slate-200
    borderHover: '#CBD5E1',    // Slate-300
    borderFocus: '#EA580C',

    // Badges & Dietary
    veg: '#10B981',            // Emerald-500
    vegLight: '#ECFDF5',       // Emerald-50
    nonVeg: '#EF4444',         // Red-500
    nonVegLight: '#FEF2F2',    // Red-50
    special: '#F97316',        // Orange-500
    specialLight: '#FFF7ED',   // Orange-50
    combo: '#8B5CF6',          // Violet-500
    comboLight: '#F5F3FF',     // Violet-50
    offer: '#F59E0B',          // Amber-500
    offerLight: '#FFFBEB',     // Amber-50
  },

  // Typography
  typography: {
    fontDisplay: "var(--font-outfit, 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif)",
    fontBody: "var(--font-inter, 'Inter', -apple-system, BlinkMacSystemFont, sans-serif)",
  },

  // Shadows
  shadows: {
    soft: '0 2px 8px -2px rgba(15, 23, 42, 0.04), 0 8px 20px -4px rgba(15, 23, 42, 0.06)',
    card: '0 4px 16px -2px rgba(15, 23, 42, 0.05), 0 1px 3px rgba(15, 23, 42, 0.04)',
    hover: '0 16px 36px -8px rgba(15, 23, 42, 0.12), 0 4px 12px -2px rgba(15, 23, 42, 0.04)',
    glass: '0 8px 32px 0 rgba(15, 23, 42, 0.08)',
    bottomBar: '0 -4px 20px -2px rgba(15, 23, 42, 0.08)',
  },

  // Border Radius
  radii: {
    sm: '0.375rem', // 6px
    md: '0.5rem',   // 8px
    lg: '0.75rem',  // 12px
    xl: '1rem',     // 16px
    '2xl': '1.25rem', // 20px
    '3xl': '1.75rem', // 28px
    full: '9999px',
  },

  // Fixed Card & Container Specifications
  layout: {
    maxContentWidth: '1280px', // max-w-7xl
    standardWidth: '1152px',   // max-w-6xl
  },

  // Transitions
  transitions: {
    fast: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
    standard: 'all 250ms cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'all 400ms cubic-bezier(0.16, 1, 0.3, 1)',
  },
} as const;

/**
 * Common standard Tailwind classes mapped to design tokens
 * To ensure ZERO divergent styling across all restaurant homepages
 */
export const STYLES = {
  // Page container
  pageContainer: 'min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-orange-500 selection:text-white',
  contentContainer: 'w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8',

  // Section styling
  sectionContainer: 'py-6 sm:py-8 lg:py-10',
  sectionHeader: 'flex items-end justify-between mb-4 sm:mb-6',
  sectionTitle: 'text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 font-display',
  sectionSubtitle: 'text-xs sm:text-sm text-slate-500 mt-1 max-w-xl',
  sectionViewAll: 'text-xs sm:text-sm font-semibold text-orange-600 hover:text-orange-700 flex items-center gap-1 transition-colors group',

  // Card base styles
  cardBase: 'bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_12px_-2px_rgba(15,23,42,0.05)] hover:shadow-[0_12px_28px_-6px_rgba(15,23,42,0.1)] transition-all duration-300 overflow-hidden',
  cardGlass: 'bg-white/85 backdrop-blur-xl rounded-2xl border border-white/60 shadow-[0_8px_32px_0_rgba(15,23,42,0.08)]',

  // Buttons
  primaryButton: 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-orange-600 text-white hover:bg-orange-700 active:scale-[0.98] transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed',
  secondaryButton: 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-[0.98] transition-all duration-200',
  ghostButton: 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 transition-all duration-150',

  // Badges
  badgeVeg: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200',
  badgeNonVeg: 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200',
  badgeSpecial: 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200',
  badgeOffer: 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200',
  badgeCombo: 'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200',
} as const;
