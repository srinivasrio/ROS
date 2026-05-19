/**
 * BannerService – Clean, database-first CRUD for homepage_banners.
 * Uploads images to the `homepage-banners` storage bucket.
 * This service bypasses the old HomepageBuilderService banner logic entirely.
 */

import { supabase } from '@/lib/supabase';
import { resolveRestaurantId } from './utils';
import { compressImage, validateImageFile } from '@/app/lib/image-compress';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Banner {
    id: string;
    restaurant_id: string;
    image_url: string;
    heading: string | null;
    subheading: string | null;
    cta_text: string | null;
    redirect_type: string | null;
    redirect_target: string | null;
    display_order: number;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export type BannerInsert = Omit<Banner, 'id' | 'created_at' | 'updated_at'>;
export type BannerUpdate = Partial<Omit<Banner, 'id' | 'restaurant_id' | 'created_at' | 'updated_at'>>;

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

const STORAGE_BUCKET = 'homepage-banners';

/** Upload a File/Blob to the homepage-banners bucket and return the public URL. */
async function uploadBannerImage(restaurantId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${restaurantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type || 'image/jpeg',
        });

    if (uploadError) {
        console.error('[BannerService] Storage upload error:', {
            message: uploadError.message,
            fileName,
        });
        throw new Error(`Image upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(fileName);

    return urlData.publicUrl;
}

/** Attempt to delete an image from storage. Non-blocking – logs on failure. */
async function deleteBannerImage(imageUrl: string): Promise<void> {
    try {
        // Extract the path after the bucket name in the URL
        const marker = `/object/public/${STORAGE_BUCKET}/`;
        const idx = imageUrl.indexOf(marker);
        if (idx === -1) return;
        const filePath = imageUrl.slice(idx + marker.length);
        const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
        if (error) console.warn('[BannerService] Storage delete warning:', error.message);
    } catch (e) {
        console.warn('[BannerService] Storage delete exception:', e);
    }
}

// ---------------------------------------------------------------------------
// BannerService
// ---------------------------------------------------------------------------

export const BannerService = {

    // ─── Read ───────────────────────────────────────────────────────────────

    /**
     * Fetch all banners for a restaurant (active only for customers, all for admin).
     * Always reads from DB – no cache – to ensure fresh data.
     */
    async getBanners(restaurantIdOrCode: string, activeOnly = true): Promise<Banner[]> {
        const rid = await resolveRestaurantId(restaurantIdOrCode);
        if (!rid) throw new Error('[BannerService] Invalid restaurant ID');

        let query = supabase
            .from('homepage_banners')
            .select('id, restaurant_id, image_url, heading, subheading, cta_text, redirect_type, redirect_target, display_order, active, created_at, updated_at')
            .eq('restaurant_id', rid)
            .order('display_order', { ascending: true });

        if (activeOnly) {
            query = query.eq('active', true);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[BannerService] getBanners error:', {
                message: error.message || 'No error message',
                details: error.details || 'No details',
                hint: error.hint || 'No hint',
                code: error.code || 'No error code',
                rid,
            });
            throw error;
        }

        return (data || []) as Banner[];
    },

    // ─── Create ─────────────────────────────────────────────────────────────

    /**
     * Upload an image file and create a new banner record in one shot.
     * Returns the newly created Banner.
     */
    async createBannerFromFile(
        restaurantIdOrCode: string,
        file: File,
        meta: Partial<BannerInsert> = {}
    ): Promise<Banner> {
        // Validate file
        const validationError = validateImageFile(file);
        if (validationError) throw new Error(validationError);

        const rid = await resolveRestaurantId(restaurantIdOrCode);
        if (!rid) throw new Error('[BannerService] Invalid restaurant ID');

        // Compress + upload
        let uploadFile = file;
        try {
            const compressed = await compressImage(file);
            uploadFile = compressed.file;
        } catch {
            // Fall back to original file if compression fails
        }

        const imageUrl = await uploadBannerImage(rid, uploadFile);
        console.log('[BannerService] Uploaded image URL:', imageUrl);

        // Get current max display_order to append at end
        const { data: existing } = await supabase
            .from('homepage_banners')
            .select('display_order')
            .eq('restaurant_id', rid)
            .order('display_order', { ascending: false })
            .limit(1);

        const nextOrder = existing && existing.length > 0 ? (existing[0].display_order + 1) : 0;

        const payload: BannerInsert = {
            restaurant_id: rid,
            image_url: imageUrl,
            heading: meta.heading ?? null,
            subheading: meta.subheading ?? null,
            cta_text: meta.cta_text ?? null,
            redirect_type: meta.redirect_type ?? 'none',
            redirect_target: meta.redirect_target ?? null,
            display_order: meta.display_order ?? nextOrder,
            active: meta.active ?? true,
        };
        console.log('[BannerService] Inserting banner payload:', JSON.stringify(payload, null, 2));

        const { data, error } = await supabase
            .from('homepage_banners')
            .insert(payload)
            .select()
            .maybeSingle();

        if (error) {
            console.error('[BannerService] createBannerFromFile DB insert error:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                payload,
            });
            // Clean up uploaded image on DB failure
            await deleteBannerImage(imageUrl);
            throw error;
        }

        return data as Banner;
    },

    // ─── Update ─────────────────────────────────────────────────────────────

    /** Update banner metadata (heading, subheading, etc.) by ID. */
    async updateBanner(id: string, updates: BannerUpdate): Promise<Banner> {
        if (!id) throw new Error('[BannerService] Banner ID is required');

        const { data, error } = await supabase
            .from('homepage_banners')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) {
            console.error('[BannerService] updateBanner error:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                id,
                updates,
            });
            throw error;
        }

        return data as Banner;
    },

    /** Replace the image of an existing banner: uploads new image, updates record, optionally deletes old image. */
    async replaceBannerImage(
        bannerId: string,
        restaurantIdOrCode: string,
        file: File,
        oldImageUrl?: string
    ): Promise<Banner> {
        const validationError = validateImageFile(file);
        if (validationError) throw new Error(validationError);

        const rid = await resolveRestaurantId(restaurantIdOrCode);
        if (!rid) throw new Error('[BannerService] Invalid restaurant ID');

        let uploadFile = file;
        try {
            const compressed = await compressImage(file);
            uploadFile = compressed.file;
        } catch {
            // Fall back to original
        }

        const newImageUrl = await uploadBannerImage(rid, uploadFile);

        const updated = await this.updateBanner(bannerId, { image_url: newImageUrl });

        // Non-blocking cleanup of old image
        if (oldImageUrl && oldImageUrl.includes(STORAGE_BUCKET)) {
            deleteBannerImage(oldImageUrl);
        }

        return updated;
    },

    /** Reorder banners by updating their display_order fields. */
    async reorderBanners(bannerIds: string[]): Promise<void> {
        const updates = bannerIds.map((id, idx) => ({
            id,
            display_order: idx,
            updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
            .from('homepage_banners')
            .upsert(updates, { onConflict: 'id' });

        if (error) {
            console.error('[BannerService] reorderBanners error:', error.message);
            throw error;
        }
    },

    // ─── Delete ─────────────────────────────────────────────────────────────

    /** Delete a banner record from DB and optionally remove its storage image. */
    async deleteBanner(id: string, deleteImage = true): Promise<void> {
        if (!id) throw new Error('[BannerService] Banner ID is required');

        // Fetch image URL before deleting so we can clean up storage
        let imageUrl: string | null = null;
        if (deleteImage) {
            const { data } = await supabase
                .from('homepage_banners')
                .select('image_url')
                .eq('id', id)
                .maybeSingle();
            imageUrl = data?.image_url ?? null;
        }

        const { error } = await supabase
            .from('homepage_banners')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[BannerService] deleteBanner error:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                id,
            });
            throw error;
        }

        // Non-blocking image cleanup
        if (imageUrl && imageUrl.includes(STORAGE_BUCKET)) {
            deleteBannerImage(imageUrl);
        }
    },

    // ─── Bulk save from builder state (reconcile) ────────────────────────────

    /**
     * Full reconcile: given the current banner list (from builder state),
     * sync them to the DB. Inserts new ones (no id), updates existing ones (valid UUID),
     * and deletes orphaned DB records.
     */
    async reconcileBanners(restaurantIdOrCode: string, stateBanners: any[]): Promise<void> {
        const rid = await resolveRestaurantId(restaurantIdOrCode);
        if (!rid) return;

        // Fetch current DB state
        const { data: dbBanners, error: fetchErr } = await supabase
            .from('homepage_banners')
            .select('id, image_url')
            .eq('restaurant_id', rid);

        if (fetchErr) {
            console.warn('[BannerService] reconcileBanners fetch warning:', fetchErr.message);
        }

        const dbIds = new Set((dbBanners || []).map((b: any) => b.id));
        const stateIds = new Set(stateBanners.map((b: any) => b.id).filter(Boolean));

        // Delete orphaned DB records
        for (const dbBanner of (dbBanners || [])) {
            if (!stateIds.has(dbBanner.id)) {
                try {
                    await this.deleteBanner(dbBanner.id, true);
                } catch (e) {
                    console.warn(`[BannerService] reconcile delete failed for ${dbBanner.id}:`, e);
                }
            }
        }

        // Upsert state banners
        for (let i = 0; i < stateBanners.length; i++) {
            const b = stateBanners[i];
            const payload: any = {
                restaurant_id: rid,
                image_url: b.image_url || b.imageUrl || '',
                heading: b.heading || b.title || null,
                subheading: b.subheading || b.description || null,
                cta_text: b.cta_text || null,
                redirect_type: b.redirect_type || 'none',
                redirect_target: b.redirect_target || b.link || null,
                display_order: b.display_order ?? b.order_index ?? i,
                active: b.active !== false,
                updated_at: new Date().toISOString(),
            };

            // Determine if update or insert
            const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (b.id && UUID_RE.test(b.id) && dbIds.has(b.id)) {
                // Update
                const { error } = await supabase
                    .from('homepage_banners')
                    .update(payload)
                    .eq('id', b.id);
                if (error) console.warn(`[BannerService] reconcile update failed for ${b.id}:`, error.message);
            } else if (payload.image_url) {
                // Insert (only if has image)
                const { error } = await supabase
                    .from('homepage_banners')
                    .insert({ ...payload })
                    .select()
                    .maybeSingle();
                if (error) console.warn('[BannerService] reconcile insert failed:', error.message, payload);
            }
        }
    },

    // ─── Real-time ───────────────────────────────────────────────────────────

    /** Subscribe to real-time banner changes for a restaurant. Returns unsubscribe fn. */
    subscribeToChanges(
        restaurantId: string,
        onUpdate: (payload: any) => void
    ): () => void {
        const channel = supabase
            .channel(`homepage_banners:${restaurantId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'homepage_banners',
                    filter: `restaurant_id=eq.${restaurantId}`,
                },
                onUpdate
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },
};
