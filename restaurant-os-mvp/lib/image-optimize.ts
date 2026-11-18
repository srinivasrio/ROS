/**
 * Downscale uploaded photos to max 1200px wide and convert to WebP.
 *
 * - VPS (Node.js): native `sharp`.
 * - Cloudflare Workers: the Images binding (`IMAGES` in wrangler.jsonc), because
 *   sharp is a native module and cannot run there.
 * - If neither is available, returns null and the caller keeps the original file.
 */
import { importNodeOnly, isCloudflareWorkers } from './runtime';

const MAX_WIDTH = 1200;
const QUALITY = 80;

export interface OptimizedImage {
    bytes: Uint8Array;
    contentType: string;
}

async function getImagesBinding(): Promise<any | null> {
    if (!isCloudflareWorkers()) return null;
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare');
        const { env } = await getCloudflareContext({ async: true });
        return (env as any).IMAGES ?? null;
    } catch {
        return null;
    }
}

export async function optimizeImage(input: Uint8Array, _contentType: string): Promise<OptimizedImage | null> {
    const images = await getImagesBinding();
    if (images) {
        const stream = new Blob([new Uint8Array(input)]).stream();
        const result = await images
            .input(stream)
            .transform({ width: MAX_WIDTH, fit: 'scale-down' })
            .output({ format: 'image/webp', quality: QUALITY });
        const bytes = new Uint8Array(await result.response().arrayBuffer());
        return { bytes, contentType: 'image/webp' };
    }

    const sharp = await importNodeOnly<any>('sharp');
    if (sharp) {
        const out: Uint8Array = await sharp(input)
            .rotate() // auto-orient based on EXIF
            .resize({ width: MAX_WIDTH, withoutEnlargement: true })
            .webp({ quality: QUALITY, effort: 4 })
            .toBuffer();
        return { bytes: out, contentType: 'image/webp' };
    }

    return null;
}
