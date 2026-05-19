import { createClient } from '@/lib/supabase';

const supabase = createClient();

/**
 * Resolves a restaurant code (ID or slug) to the actual restaurant_id.
 * Used by services to handle human-readable URLs.
 */
export async function resolveRestaurantId(code: string): Promise<string> {
    if (!code) return code;
    
    const supabase = createClient();

    // 1. If it's a numeric ID or UUID, check if it exists in restaurants table first
    if (/^\d+$/.test(code) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code)) {
        const { data: exists } = await supabase
            .from('restaurants')
            .select('id')
            .eq('id', code)
            .maybeSingle();
        
        if (exists) return exists.id;
    }

    // 2. Try as Slug or ID in restaurant_profile
    const { data: profile } = await supabase
        .from('restaurant_profile')
        .select('restaurant_id')
        .or(`slug.eq.${code.toLowerCase()},restaurant_id.eq.${code}`)
        .maybeSingle();

    if (profile) {
        return profile.restaurant_id;
    }

    // 3. Last fallback: Check restaurants table by name or ID if not already checked
    const { data: fallback } = await supabase
        .from('restaurants')
        .select('id')
        .eq('id', code)
        .maybeSingle();

    return fallback?.id || code;
}
