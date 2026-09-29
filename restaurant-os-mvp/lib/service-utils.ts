
import { GlassWater as LucideGlassWater, Receipt as LucideReceipt, Utensils as LucideUtensils, HandPlatter as LucideHandPlatter, Disc as LucideDisc, Soup as LucideSoup, Wind as LucideWind, Droplet as LucideDroplet, GripHorizontal as LucideGripHorizontal, Pipette as LucidePipette, Bell as LucideBell, CheckCircle as LucideCheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { resolveRestaurantId } from '@/services/utils.service';

// Hardcoded fallbacks for known service types
const HARDCODED_SERVICES: Record<string, { label: string; icon: any; image: string; color: string; bg: string; borderColor: string }> = {
    order_ready: { label: 'Order Ready', icon: LucideGlassWater, image: '/services/Waiter.webm', color: 'text-green-600', bg: 'bg-green-100', borderColor: 'border-green-200' },
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
    call_waiter: { label: 'Call Waiter', icon: LucideHandPlatter, image: '/services/Waiter.webm', color: 'text-orange-600', bg: 'bg-orange-100', borderColor: 'border-orange-200' },
    table_access_request: { label: 'Table Access Request', icon: LucideHandPlatter, image: '', color: 'text-indigo-600', bg: 'bg-indigo-50', borderColor: 'border-indigo-200' },
};

// Dynamic cache from service_options DB table, keyed by resolved restaurant UUID
let cachedDbServices: Record<string, Record<string, { label: string; image: string }>> = {};
let cacheLoaded: Record<string, boolean> = {};

export async function loadServiceOptionsCache(restaurantId: string) {
    if (!restaurantId) return;
    try {
        const resolvedId = await resolveRestaurantId(restaurantId);
        if (!resolvedId || cacheLoaded[resolvedId]) return;

        const supabase = createClient();
        const { data } = await supabase
            .from('service_options')
            .select('service_key, label, image_url')
            .eq('restaurant_id', resolvedId)
            .order('sort_order');
        if (data) {
            cachedDbServices[resolvedId] = {};
            for (const row of data) {
                cachedDbServices[resolvedId][row.service_key] = {
                    label: row.label,
                    image: row.image_url || '',
                };
            }
            cacheLoaded[resolvedId] = true;
        }
    } catch (e) {
        console.error(`Failed to load service options cache for restaurant ${restaurantId}:`, e);
    }
}

// Call this once at app start or when the waiter panel loads
export async function preloadServiceOptions(restaurantId: string) {
    if (!restaurantId) return;
    try {
        const resolvedId = await resolveRestaurantId(restaurantId);
        if (resolvedId && cacheLoaded[resolvedId]) {
            delete cacheLoaded[resolvedId];
        }
        await loadServiceOptionsCache(restaurantId);
    } catch (e) {
        console.error(`Failed to preload service options for restaurant ${restaurantId}:`, e);
    }
}

// Subscribe to changes to invalidate cache
export function subscribeServiceOptionsCache(restaurantId: string, onUpdate?: () => void) {
    if (!restaurantId) {
        console.error('[subscribeServiceOptionsCache] Must provide restaurantId to avoid global broadcasts.');
        return { unsubscribe: () => {} };
    }
    
    // Set up channel with setup resolver
    let channel: any = null;
    const supabase = createClient();

    resolveRestaurantId(restaurantId).then(resolvedId => {
        if (!resolvedId) return;

        channel = supabase
            .channel(`service-options-cache-${resolvedId}`)
            .on(
                'postgres_changes', 
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'service_options', 
                    filter: `restaurant_id=eq.${resolvedId}` 
                }, 
                () => {
                    if (cacheLoaded[resolvedId]) {
                        delete cacheLoaded[resolvedId];
                    }
                    loadServiceOptionsCache(resolvedId).then(() => onUpdate?.());
                }
            );
        channel.subscribe();
    });

    return { 
        unsubscribe: () => {
            if (channel) supabase.removeChannel(channel);
        } 
    };
}

export const getServiceRequestDetails = (type: string, restaurantId?: string) => {
    let resolvedId = restaurantId || '';
    
    // Attempt to read the cache (caller is responsible for preloading it)
    // 1. Check hardcoded first (preserves existing known icons)
    if (HARDCODED_SERVICES[type]) {
        // But prefer DB label/image if available (admin may have renamed)
        const dbEntry = resolvedId ? (cachedDbServices[resolvedId]?.[type] || Object.values(cachedDbServices)[0]?.[type]) : Object.values(cachedDbServices)[0]?.[type];
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
    const dbEntry = resolvedId ? (cachedDbServices[resolvedId]?.[type] || Object.values(cachedDbServices)[0]?.[type]) : Object.values(cachedDbServices)[0]?.[type];
    if (dbEntry) {
        return {
            label: dbEntry.label,
            icon: LucideHandPlatter,
            image: dbEntry.image || '/services/Waiter.webm',
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
        image: '/services/Waiter.webm',
        color: 'text-orange-600',
        bg: 'bg-orange-100',
        borderColor: 'border-orange-200',
    };
};

export interface RequesterMeta {
    requester_id: string | null;
    requester_name: string;
    requester_avatar: string | null;
    requester_mobile: string | null;
    custom_note: string | null;
}

export function parseRequesterMeta(notes?: string | null): RequesterMeta {
    if (!notes || !notes.trim()) {
        return {
            requester_id: null,
            requester_name: 'Fellow Waiter',
            requester_avatar: null,
            requester_mobile: null,
            custom_note: null,
        };
    }
    const trimmed = notes.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
            const data = JSON.parse(trimmed);
            return {
                requester_id: data.requester_id || null,
                requester_name: data.requester_name || 'Fellow Waiter',
                requester_avatar: data.requester_avatar || null,
                requester_mobile: data.requester_mobile || null,
                custom_note: data.custom_note || null,
            };
        } catch (_) {}
    }
    return {
        requester_id: null,
        requester_name: 'Fellow Waiter',
        requester_avatar: null,
        requester_mobile: null,
        custom_note: trimmed,
    };
}

export function cleanDisplayNote(notes?: string | null): string | null {
    if (!notes || !notes.trim()) return null;
    const trimmed = notes.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
            const parsed = JSON.parse(trimmed);
            return parsed.custom_note || parsed.note || null;
        } catch {
            return null;
        }
    }
    return trimmed;
}
