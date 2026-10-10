import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Round monetary amounts by adding / ceiling to 2 decimal places.
 * Never reduces / rounds down fractional paise/cents.
 * Cleans 64-bit binary floating-point representation noise before ceiling.
 */
export function ceil2(num: number): number {
    const n = Number(num || 0);
    const clean = Math.round(n * 1e8) / 1e8;
    return Math.ceil(clean * 100) / 100;
}

export const round2 = ceil2;

export function formatCurrency(amount: number, forceDecimals = false) {
    const val = ceil2(amount);
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
        minimumFractionDigits: forceDecimals ? 2 : (Number.isInteger(val) ? 0 : 2),
    }).format(val);
}

export function getCategoryMenuItemImage(name: string) {
    if (!name) return '/menu/veg-biryani.png';
    const n = name.toLowerCase();

    // Priority Checks (Specific -> Generic)
    if (n.includes('hot & sour') || n.includes('hot and sour')) return '/menu/hot-and-sour-soup.jpeg';
    if (n.includes('manchow')) return '/menu/manchow-soup.jpeg';
    if (n.includes('sweet corn')) return n.includes('chicken') ? '/menu/sweet-corn-chicken-soup.jpeg' : '/menu/sweet-corn-veg-soup.jpeg';
    if (n.includes('lemon coriander')) return '/menu/lemon-coriander-soup.jpeg';
    if (n.includes('mushroom soup')) return '/menu/cream-of-mushroom-soup.jpeg';
    if (n.includes('soup')) return '/menu/tomato-basil-soup.png';

    // Biryani & Rice
    if (n.includes('chicken biryani')) return '/menu/chicken-biryani.jpeg';
    if (n.includes('mutton biryani')) return '/menu/mutton-biryani.jpeg';
    if (n.includes('egg biryani')) return '/menu/egg-biryani.jpeg';
    if (n.includes('prawn biryani')) return '/menu/prawn-biryani.jpeg';
    if (n.includes('mushroom biryani')) return '/menu/mushroom-biryani.jpeg';
    if (n.includes('biryani')) return '/menu/chicken-biryani.jpeg';
    if (n.includes('fried rice')) return n.includes('chicken') ? '/menu/chicken-fried-rice.jpeg' : '/menu/veg-fried-rice.jpeg';
    if (n.includes('ghee rice')) return '/menu/ghee-rice.jpeg';
    if (n.includes('curd rice')) return '/menu/curd-rice.jpeg';
    if (n.includes('jeera rice')) return '/menu/jeera-rice.jpeg';
    if (n.includes('pulao')) return '/menu/veg-pulao.jpeg';
    if (n.includes('rice')) return '/menu/jeera-rice.jpeg';

    // Starters / Kebabs / Appetizers
    if (n.includes('chicken 65')) return '/menu/chicken-65.jpeg';
    if (n.includes('chicken lollipop')) return '/menu/chicken-lollipop.jpeg';
    if (n.includes('tandoori chicken')) return '/menu/tandoori-chicken.jpeg';
    if (n.includes('chicken tikka')) return '/menu/chicken-tikka.jpeg';
    if (n.includes('chilli chicken')) return '/menu/chilli-chicken-dry.jpeg';
    if (n.includes('wings')) return '/menu/grilled-chicken-wings.jpeg';
    if (n.includes('fish fry') || n.includes('apollo fish')) return '/menu/fish-fry.jpeg';
    if (n.includes('prawn 65')) return '/menu/prawn-65.jpeg';
    if (n.includes('paneer tikka')) return '/menu/paneer-tikka.png';
    if (n.includes('chilli paneer')) return '/menu/chilli-paneer.jpeg';
    if (n.includes('gobi 65') || n.includes('gobi')) return '/menu/gobi-65.jpg';
    if (n.includes('mushroom 65')) return '/menu/mushroom-65.jpeg';
    if (n.includes('crispy corn') || n.includes('baby corn')) return '/menu/crispy-corn.jpeg';
    if (n.includes('spring roll')) return '/menu/veg-spring-rolls.jpeg';
    if (n.includes('kebab')) return '/menu/hara-bhara-kebab.jpeg';
    if (n.includes('platter') || n.includes('pakora')) return '/menu/veg-pakora-platter.jpeg';
    if (n.includes('non-veg starter') || n.includes('non veg starter')) return '/menu/chicken-lollipop.jpeg';
    if (n.includes('veg starter')) return '/menu/paneer-tikka.png';
    if (n === 'starters') return '/menu/paneer-tikka.png';

    // Curries & Gravies
    if (n.includes('butter chicken')) return '/menu/butter-chicken.png';
    if (n.includes('chicken tikka masala')) return '/menu/chicken-tikka-masala.jpeg';
    if (n.includes('kadai chicken')) return '/menu/kadai-chicken.jpeg';
    if (n.includes('chicken curry') || n.includes('chicken handi') || n.includes('chicken chettinad')) return '/menu/andhra-chicken-curry.jpeg';
    if (n.includes('mutton rogan josh')) return '/menu/mutton-rogan-josh.jpeg';
    if (n.includes('mutton curry')) return '/menu/mutton-curry.jpeg';
    if (n.includes('fish curry')) return '/menu/fish-curry.jpeg';
    if (n.includes('prawn masala')) return '/menu/prawn-masala.jpeg';
    if (n.includes('egg curry')) return '/menu/egg-curry.jpeg';
    if (n.includes('paneer butter masala')) return '/menu/paneer-butter-masala.png';
    if (n.includes('palak paneer')) return '/menu/palak-paneer.jpeg';
    if (n.includes('kadai paneer') || n.includes('matar paneer')) return '/menu/kadai-paneer.jpeg';
    if (n.includes('dal makhani')) return '/menu/dal-makhani.jpeg';
    if (n.includes('dal tadka') || n.includes('dal')) return '/menu/dal-tadka.jpeg';
    if (n.includes('malai kofta')) return '/menu/malai-kofta.jpeg';
    if (n.includes('chole')) return '/menu/chole-masala.jpeg';
    if (n.includes('korma')) return '/menu/veg-korma.jpeg';
    if (n.includes('kolhapuri')) return '/menu/veg-kolhapuri.jpeg';
    if (n.includes('aloo gobi')) return '/menu/aloo-gobi.jpeg';
    if (n.includes('non-veg curr')) return '/menu/mutton-rogan-josh.jpeg';
    if (n.includes('veg curr')) return '/menu/palak-paneer.jpeg';
    if (n === 'curries') return '/menu/palak-paneer.jpeg';

    // Breads
    if (n.includes('garlic naan')) return '/menu/garlic-naan.jpeg';
    if (n.includes('butter naan') || n.includes('naan')) return '/menu/butter-naan.jpeg';
    if (n.includes('roti') || n.includes('tandoori roti')) return '/menu/tandoori-roti.jpeg';
    if (n.includes('paratha')) return '/menu/lachha-paratha.jpeg';
    if (n.includes('kulcha')) return '/menu/kulcha.jpeg';
    if (n.includes('rumali')) return '/menu/rumali-roti.jpeg';
    if (n.includes('bread')) return '/menu/butter-naan.jpeg';

    // Chinese / Noodles
    if (n.includes('noodles') || n.includes('hakka') || n.includes('schezwan noodles')) return '/menu/chicken-hakka-noodles.jpeg';
    if (n.includes('manchurian')) return '/menu/chicken-manchurian-gravy.jpeg';
    if (n.includes('chinese')) return '/menu/chicken-manchurian-gravy.jpeg';

    // Desserts & Sweets
    if (n.includes('gulab jamun')) return '/menu/gulab-jamun.jpeg';
    if (n.includes('rasmalai')) return '/menu/rasmalai.jpeg';
    if (n.includes('halwa')) return '/menu/carrot-halwa.jpeg';
    if (n.includes('double ka meetha')) return '/menu/double-ka-meetha.jpeg';
    if (n.includes('brownie')) return '/menu/brownie-with-ice-cream.jpeg';
    if (n.includes('ice cream')) return '/menu/ice-cream-3-flavours.jpeg';
    if (n.includes('dessert') || n.includes('sweet')) return '/menu/rasmalai.jpeg';

    // Combos / Specials / Meals
    if (n.includes('combo') || n.includes('special') || n.includes('thali') || n.includes('feast') || n.includes('meal')) return '/menu/chicken-biryani.jpeg';

    return '/menu/veg-biryani.png';
}

export function formatTimeElapsed(createdAt: string): string {
    let timeStr = createdAt;
    if (timeStr && !timeStr.endsWith('Z') && !timeStr.includes('+')) {
        timeStr += 'Z';
    }

    const startTime = new Date(timeStr).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - startTime);

    const hrs = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);

    const pad = (num: number) => num.toString().padStart(2, '0');

    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    // 1. Try modern navigator.clipboard if available (works on localhost and HTTPS)
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fall through to fallback
        }
    }

    // 2. Fallback for non-secure contexts (e.g. mobile accessing via local network IP over HTTP)
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '0';
        textArea.style.left = '0';
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = '0';
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        textArea.style.opacity = '0';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, text.length);

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
    } catch (err) {
        console.warn('Clipboard copy fallback failed:', err);
        return false;
    }
}

/**
 * Safely formats an address into a displayable string.
 * Handles strings, stringified JSON, and objects with keys {city, state, street, pincode}.
 * Prevents React child object rendering errors.
 */
export function formatAddress(addr: any): string {
    if (!addr) return '';
    if (typeof addr === 'string') {
        const trimmed = addr.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                return formatAddress(parsed);
            } catch {
                return trimmed;
            }
        }
        return trimmed;
    }
    if (typeof addr === 'object' && addr !== null) {
        const parts = [addr.street, addr.city, addr.state, addr.pincode]
            .filter(p => typeof p === 'string' && p.trim().length > 0)
            .map(p => p.trim());
        if (parts.length > 0) return parts.join(', ');
        const otherParts = Object.values(addr)
            .filter(p => typeof p === 'string' && (p as string).trim().length > 0)
            .map((p: any) => p.trim());
        return otherParts.join(', ');
    }
    return String(addr);
}

/**
 * Normalizes table number strings for consistent matching across routes, tokens, and DB.
 * Handles 'Table 5', 'table 05', '5', 'T-5', etc.
 */
export function normalizeTableNumber(val?: string | number | null): string {
    if (val === null || val === undefined) return '';
    const str = String(val).trim().toLowerCase().replace(/^table\s*/i, '').trim();
    if (/^\d+$/.test(str)) {
        return String(parseInt(str, 10));
    }
    return str;
}
