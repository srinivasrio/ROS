import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
    }).format(amount);
}

export function getCategoryMenuItemImage(name: string) {
    const n = name.toLowerCase();

    // Priority Checks (Specific -> Generic)
    if (n.includes('hot & sour')) return '/menu/hot-and-sour-soup.jpeg';
    if (n.includes('manchow')) return '/menu/manchow-soup.jpeg';
    if (n.includes('sweet corn')) return '/menu/sweet-corn-veg-soup.jpeg';
    if (n.includes('soup')) return '/menu/tomato-basil-soup.png';

    if (n.includes('non-veg starter')) return '/menu/chicken-lollipop.jpeg';
    if (n.includes('veg starter')) return '/menu/paneer-tikka.png';
    if (n === 'starters') return '/menu/paneer-tikka.png'; // New Consolidated

    if (n.includes('non-veg curr')) return '/menu/mutton-rogan-josh.jpeg'; // Red gravy
    if (n.includes('veg curr')) return '/menu/palak-paneer.jpeg'; // Green gravy
    if (n === 'curries') return '/menu/palak-paneer.jpeg'; // New Consolidated

    if (n.includes('biryani')) return '/menu/mutton-biryani.jpeg';
    if (n.includes('ghee rice')) return '/menu/ghee-rice.jpeg';
    if (n.includes('rice')) return '/menu/jeera-rice.jpeg';

    if (n.includes('chinese') || n.includes('noodles')) return '/menu/chicken-manchurian-gravy.jpeg';
    if (n.includes('bread') || n.includes('roti') || n.includes('naan')) return '/menu/tandoori-roti.jpeg';

    if (n.includes('dessert') || n.includes('sweet')) return '/menu/rasmalai.jpeg';
    if (n.includes('ice cream')) return '/menu/ice-cream-3-flavours.jpeg';
    if (n.includes('drink') || n.includes('beverage')) return '/menu/ice-cream-3-flavours.jpeg'; // Fallback for drinks if no specific image

    return '/menu/veg-biryani.png'; // Default fallback
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
