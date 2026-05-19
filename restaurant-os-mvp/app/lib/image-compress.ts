/**
 * Image compression utility for menu item uploads.
 * Uses browser Canvas API to resize images to 800px max width,
 * convert to WebP format, and compress to ~70-80% quality.
 * Final output is capped at ~300KB through iterative quality reduction.
 */

const MAX_WIDTH = 800;
const MAX_HEIGHT = 800;
const INITIAL_QUALITY = 0.80;
const MIN_QUALITY = 0.50;
const TARGET_SIZE_BYTES = 300 * 1024; // 300KB
const MAX_INPUT_SIZE = 2 * 1024 * 1024; // 2MB

export interface CompressResult {
    file: File;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    width: number;
    height: number;
}

/**
 * Validates image file before compression.
 * Rejects files larger than 2MB and non-image types.
 */
export function validateImageFile(file: File): string | null {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    if (!allowedTypes.includes(file.type)) {
        return 'Invalid file type. Please upload JPEG, PNG, WebP, or GIF.';
    }

    if (file.size > MAX_INPUT_SIZE) {
        return `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum allowed is 2MB.`;
    }

    return null; // Valid
}

/**
 * Loads a File into an HTMLImageElement.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error('Failed to load image'));

        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Compresses an image file: resizes to max 800px, converts to WebP,
 * and iteratively reduces quality to stay under 300KB.
 */
export async function compressImage(file: File): Promise<CompressResult> {
    const originalSize = file.size;

    // If already small enough and WebP, skip compression
    if (file.size <= TARGET_SIZE_BYTES && file.type === 'image/webp') {
        return {
            file,
            originalSize,
            compressedSize: file.size,
            compressionRatio: 1,
            width: 0,
            height: 0,
        };
    }

    const img = await loadImage(file);

    // Calculate new dimensions (maintain aspect ratio)
    let { width, height } = img;

    if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }

    // Draw onto canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // Use high-quality downscaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Iteratively compress to WebP until under target size
    let quality = INITIAL_QUALITY;
    let blob: Blob | null = null;

    while (quality >= MIN_QUALITY) {
        blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/webp', quality);
        });

        if (blob && blob.size <= TARGET_SIZE_BYTES) break;
        quality -= 0.05;
    }

    if (!blob) {
        // Fallback: just use last attempt
        blob = await new Promise<Blob | null>((resolve) => {
            canvas.toBlob(resolve, 'image/webp', MIN_QUALITY);
        });
    }

    if (!blob) throw new Error('Image compression failed');

    // Create a File from the blob
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const compressedFile = new File([blob], `${baseName}.webp`, {
        type: 'image/webp',
        lastModified: Date.now(),
    });

    return {
        file: compressedFile,
        originalSize,
        compressedSize: compressedFile.size,
        compressionRatio: Number((originalSize / compressedFile.size).toFixed(2)),
        width,
        height,
    };
}
