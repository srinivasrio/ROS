
import { GlassWater as LucideGlassWater, Receipt as LucideReceipt, Utensils as LucideUtensils, HandPlatter as LucideHandPlatter, Disc as LucideDisc, Soup as LucideSoup, Wind as LucideWind, Droplet as LucideDroplet, GripHorizontal as LucideGripHorizontal, Pipette as LucidePipette, Bell as LucideBell, CheckCircle as LucideCheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase';

// Hardcoded fallbacks for known service types
const HARDCODED_SERVICES: Record<string, { label: string; icon: any; image: string; color: string; bg: string; borderColor: string }> = {
    order_ready: { label: 'Order Ready', icon: LucideGlassWater, image: '/services/Waiter.png', color: 'text-green-600', bg: 'bg-green-100', borderColor: 'border-green-200' },
    bill_requested: { label: 'Bill Requested', icon: LucideReceipt, image: '/services/Bill.png', color: 'text-purple-600', bg: 'bg-purple-100', borderColor: 'border-purple-200' },
    water_requested: { label: 'Water', icon: LucideGlassWater, image: '/services/Water.png', color: 'text-blue-600', bg: 'bg-blue-100', borderColor: 'border-blue-200' },
    cutlery_requested: { label: 'Cutlery', icon: LucideUtensils, image: '/services/Cutlery.webp', color: 'text-emerald-600', bg: 'bg-emerald-100', borderColor: 'border-emerald-200' },
    glass_requested: { label: 'Extra Glass', icon: LucideGlassWater, image: '/services/Glass.jpg', color: 'text-sky-600', bg: 'bg-sky-100', borderColor: 'border-sky-200' },
    straw_requested: { label: 'Straw', icon: LucidePipette, image: '/services/Straw.png', color: 'text-yellow-600', bg: 'bg-yellow-100', borderColor: 'border-yellow-200' },
    plate_requested: { label: 'Extra Plate', icon: LucideDisc, image: '/services/Plate.png', color: 'text-zinc-600', bg: 'bg-zinc-100', borderColor: 'border-zinc-200' },
    bowl_requested: { label: 'Finger Bowl', icon: LucideSoup, image: '/services/Finger bowl.jpg', color: 'text-teal-600', bg: 'bg-teal-100', borderColor: 'border-teal-200' },
    salt_requested: { label: 'Salt', icon: LucideGripHorizontal, image: '/services/Salt.jpg', color: 'text-stone-600', bg: 'bg-stone-100', borderColor: 'border-stone-200' },
    pepper_requested: { label: 'Pepper', icon: LucideWind, image: '/services/Pepper.jpg', color: 'text-stone-600', bg: 'bg-stone-100', borderColor: 'border-stone-200' },
    sauce_requested: { label: 'Ketchup', icon: LucideDroplet, image: '/services/Ketchup.jpg', color: 'text-red-600', bg: 'bg-red-100', borderColor: 'border-red-200' },
    call_waiter: { label: 'Call Waiter', icon: LucideHandPlatter, image: '/services/Waiter.png', color: 'text-orange-600', bg: 'bg-orange-100', borderColor: 'border-orange-200' },
};

// Dynamic cache from service_options DB table
let cachedDbServices: Record<string, { label: string; image: string }> = {};
let cacheLoaded = false;

async function loadServiceOptionsCache() {
    if (cacheLoaded) return;
    try {
        const supabase = createClient();
        const { data } = await supabase
            .from('service_options')
            .select('service_key, label, image_url')
            .order('sort_order');
        if (data) {
            cachedDbServices = {};
            for (const row of data) {
                cachedDbServices[row.service_key] = {
                    label: row.label,
                    image: row.image_url || '',
                };
            }
            cacheLoaded = true;
        }
    } catch (e) {
        console.error('Failed to load service options cache:', e);
    }
}

// Call this once at app start or when the waiter panel loads
export async function preloadServiceOptions() {
    cacheLoaded = false;
    await loadServiceOptionsCache();
}

// Subscribe to changes to invalidate cache
export function subscribeServiceOptionsCache(onUpdate?: () => void) {
    const supabase = createClient();
    return supabase
        .channel('service-options-cache')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'service_options' }, () => {
            cacheLoaded = false;
            loadServiceOptionsCache().then(() => onUpdate?.());
        })
        .subscribe();
}

export const getServiceRequestDetails = (type: string) => {
    // 1. Check hardcoded first (preserves existing known icons)
    if (HARDCODED_SERVICES[type]) {
        // But prefer DB label/image if available (admin may have renamed)
        const dbEntry = cachedDbServices[type];
        const hardcoded = HARDCODED_SERVICES[type];
        if (dbEntry) {
            return {
                ...hardcoded,
                label: dbEntry.label,
                image: dbEntry.image || hardcoded.image,
            };
        }
        return hardcoded;
    }

    // 2. Check DB cache for dynamically-added services
    const dbEntry = cachedDbServices[type];
    if (dbEntry) {
        return {
            label: dbEntry.label,
            icon: LucideHandPlatter,
            image: dbEntry.image || '/services/Waiter.png',
            color: 'text-blue-600',
            bg: 'bg-blue-100',
            borderColor: 'border-blue-200',
        };
    }

    // 3. Final fallback — format the type into a readable label
    const fallbackLabel = type
        .replace(/_requested$/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

    return {
        label: fallbackLabel || 'Service Request',
        icon: LucideHandPlatter,
        image: '/services/Waiter.png',
        color: 'text-orange-600',
        bg: 'bg-orange-100',
        borderColor: 'border-orange-200',
    };
};
