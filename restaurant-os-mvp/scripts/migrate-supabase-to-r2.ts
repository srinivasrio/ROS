import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables from .env.local first, before importing r2
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NEXT_PUBLIC_R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

// Initialize Supabase admin client to bypass RLS policies
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false
    }
});

// Setup logging to a file in the workspace
const logDir = path.resolve(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}
const logFilePath = path.join(logDir, `migration-${Date.now()}.log`);
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

function log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] [${level}] ${message}`;
    console.log(formatted);
    logStream.write(formatted + '\n');
}

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d') || args.length === 0; // default to dry-run if no arguments or explicit flag
const executeMigration = args.includes('--execute') || args.includes('-e');

if (isDryRun && !executeMigration) {
    log('ℹ️ Running in DRY RUN mode. No files will be uploaded, no DB updates will be made, and no files will be deleted.', 'INFO');
} else {
    log('⚠️ Running in EXECUTE mode. Changes will be made to R2, Supabase database, and Supabase storage.', 'WARN');
}

// Helper to determine the R2 folder type based on bucket and context
function getR2FolderType(bucketName: string, tableName: string): string {
    if (bucketName === 'homepage-banners' || tableName === 'homepage_banners') {
        return 'banners';
    }
    if (bucketName === 'menu-items' || bucketName === 'menu-images' || tableName === 'menu_items' || tableName === 'categories' || tableName === 'service_options' || tableName === 'today_specials' || tableName === 'homepage_specials' || tableName === 'homepage_categories') {
        return 'menu';
    }
    // Fallbacks
    return 'menu';
}

// Helper to wait
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper for fetching with retry
async function fetchWithRetry(url: string, retries = 3, delay = 1000): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await fetch(url, { method: 'HEAD' });
            return res;
        } catch (e) {
            if (i === retries - 1) throw e;
            log(`Retrying URL check (${i + 1}/${retries}) for ${url}...`, 'WARN');
            await sleep(delay * Math.pow(2, i));
        }
    }
    throw new Error(`Failed to fetch ${url} after ${retries} retries`);
}

// Type definitions for migration jobs
interface MigrationJob {
    id: string | number;
    tableName: string;
    restaurantId: string;
    supabaseUrl: string;
    bucketName: string;
    supabasePath: string;
    r2Key: string;
    // Callback to update the specific record in database with new URL
    updateDb: (newUrl: string) => Promise<any>;
}

// Map to cache already uploaded files to avoid duplicate uploads
const uploadedFilesCache = new Map<string, string>(); // supabaseUrl -> R2 URL

async function run() {
    try {
        const { uploadToR2 } = await import('../lib/r2');
        const jobs: MigrationJob[] = [];

        // 1. Fetch categories
        log('Scanning categories table...', 'INFO');
        const { data: categories, error: catErr } = await supabase.from('categories').select('id, image_url, restaurant_id');
        if (catErr) throw catErr;
        
        for (const cat of (categories || [])) {
            if (cat.image_url && cat.image_url.includes('supabase.co/storage')) {
                const parsed = parseSupabaseUrl(cat.image_url);
                if (parsed) {
                    const r2Type = getR2FolderType(parsed.bucket, 'categories');
                    const r2Key = `restaurants/${cat.restaurant_id}/${r2Type}/${path.basename(parsed.path)}`;
                    jobs.push({
                        id: cat.id,
                        tableName: 'categories',
                        restaurantId: cat.restaurant_id,
                        supabaseUrl: cat.image_url,
                        bucketName: parsed.bucket,
                        supabasePath: parsed.path,
                        r2Key,
                        updateDb: async (newUrl) => {
                            return supabase.from('categories').update({ image_url: newUrl }).eq('id', cat.id);
                        }
                    });
                }
            }
        }

        // 2. Fetch menu_items
        log('Scanning menu_items table...', 'INFO');
        const { data: menuItems, error: itemErr } = await supabase.from('menu_items').select('id, image_url, restaurant_id');
        if (itemErr) throw itemErr;

        for (const item of (menuItems || [])) {
            if (item.image_url && item.image_url.includes('supabase.co/storage')) {
                const parsed = parseSupabaseUrl(item.image_url);
                if (parsed) {
                    const r2Type = getR2FolderType(parsed.bucket, 'menu_items');
                    const r2Key = `restaurants/${item.restaurant_id}/${r2Type}/${path.basename(parsed.path)}`;
                    jobs.push({
                        id: item.id,
                        tableName: 'menu_items',
                        restaurantId: item.restaurant_id,
                        supabaseUrl: item.image_url,
                        bucketName: parsed.bucket,
                        supabasePath: parsed.path,
                        r2Key,
                        updateDb: async (newUrl) => {
                            return supabase.from('menu_items').update({ image_url: newUrl }).eq('id', item.id);
                        }
                    });
                }
            }
        }

        // 3. Fetch homepage_banners
        log('Scanning homepage_banners table...', 'INFO');
        const { data: banners, error: bannerErr } = await supabase.from('homepage_banners').select('id, image_url, restaurant_id');
        if (bannerErr) throw bannerErr;

        for (const b of (banners || [])) {
            if (b.image_url && b.image_url.includes('supabase.co/storage')) {
                const parsed = parseSupabaseUrl(b.image_url);
                if (parsed) {
                    const r2Type = getR2FolderType(parsed.bucket, 'homepage_banners');
                    const r2Key = `restaurants/${b.restaurant_id}/${r2Type}/${path.basename(parsed.path)}`;
                    jobs.push({
                        id: b.id,
                        tableName: 'homepage_banners',
                        restaurantId: b.restaurant_id,
                        supabaseUrl: b.image_url,
                        bucketName: parsed.bucket,
                        supabasePath: parsed.path,
                        r2Key,
                        updateDb: async (newUrl) => {
                            return supabase.from('homepage_banners').update({ image_url: newUrl }).eq('id', b.id);
                        }
                    });
                }
            }
        }

        // 4. Fetch service_options
        log('Scanning service_options table...', 'INFO');
        const { data: serviceOptions, error: serviceErr } = await supabase.from('service_options').select('id, image_url, restaurant_id');
        if (serviceErr) throw serviceErr;

        for (const opt of (serviceOptions || [])) {
            if (opt.image_url && opt.image_url.includes('supabase.co/storage')) {
                const parsed = parseSupabaseUrl(opt.image_url);
                if (parsed) {
                    const r2Type = getR2FolderType(parsed.bucket, 'service_options');
                    const r2Key = `restaurants/${opt.restaurant_id}/${r2Type}/${path.basename(parsed.path)}`;
                    jobs.push({
                        id: opt.id,
                        tableName: 'service_options',
                        restaurantId: opt.restaurant_id,
                        supabaseUrl: opt.image_url,
                        bucketName: parsed.bucket,
                        supabasePath: parsed.path,
                        r2Key,
                        updateDb: async (newUrl) => {
                            return supabase.from('service_options').update({ image_url: newUrl }).eq('id', opt.id);
                        }
                    });
                }
            }
        }

        // 5. Fetch restaurant_profile
        log('Scanning restaurant_profile table...', 'INFO');
        const { data: profiles, error: profileErr } = await supabase.from('restaurant_profile').select('restaurant_id, restaurant_info');
        if (profileErr) throw profileErr;

        for (const prof of (profiles || [])) {
            const logoUrl = prof.restaurant_info?.logo_url;
            if (logoUrl && logoUrl.includes('supabase.co/storage')) {
                const parsed = parseSupabaseUrl(logoUrl);
                if (parsed) {
                    const r2Type = 'menu'; // Use public menu folder for restaurant logo
                    const r2Key = `restaurants/${prof.restaurant_id}/${r2Type}/${path.basename(parsed.path)}`;
                    jobs.push({
                        id: prof.restaurant_id,
                        tableName: 'restaurant_profile',
                        restaurantId: prof.restaurant_id,
                        supabaseUrl: logoUrl,
                        bucketName: parsed.bucket,
                        supabasePath: parsed.path,
                        r2Key,
                        updateDb: async (newUrl) => {
                            const updatedInfo = { ...prof.restaurant_info, logo_url: newUrl };
                            return supabase.from('restaurant_profile').update({ restaurant_info: updatedInfo }).eq('restaurant_id', prof.restaurant_id);
                        }
                    });
                }
            }
        }

        // 6. Fetch today_specials
        log('Scanning today_specials table...', 'INFO');
        const { data: todaySpecials, error: todayErr } = await supabase.from('today_specials').select('id, image_url, restaurant_id');
        if (todayErr) throw todayErr;

        for (const spec of (todaySpecials || [])) {
            if (spec.image_url && spec.image_url.includes('supabase.co/storage')) {
                const parsed = parseSupabaseUrl(spec.image_url);
                if (parsed) {
                    const r2Type = getR2FolderType(parsed.bucket, 'today_specials');
                    const r2Key = `restaurants/${spec.restaurant_id}/${r2Type}/${path.basename(parsed.path)}`;
                    jobs.push({
                        id: spec.id,
                        tableName: 'today_specials',
                        restaurantId: spec.restaurant_id,
                        supabaseUrl: spec.image_url,
                        bucketName: parsed.bucket,
                        supabasePath: parsed.path,
                        r2Key,
                        updateDb: async (newUrl) => {
                            return supabase.from('today_specials').update({ image_url: newUrl }).eq('id', spec.id);
                        }
                    });
                }
            }
        }

        // 7. Fetch homepage_specials
        log('Scanning homepage_specials table...', 'INFO');
        const { data: homeSpecials, error: homeSpecErr } = await supabase.from('homepage_specials').select('id, image_url, restaurant_id');
        if (homeSpecErr) throw homeSpecErr;

        for (const spec of (homeSpecials || [])) {
            if (spec.image_url && spec.image_url.includes('supabase.co/storage')) {
                const parsed = parseSupabaseUrl(spec.image_url);
                if (parsed) {
                    const r2Type = getR2FolderType(parsed.bucket, 'homepage_specials');
                    const r2Key = `restaurants/${spec.restaurant_id}/${r2Type}/${path.basename(parsed.path)}`;
                    jobs.push({
                        id: spec.id,
                        tableName: 'homepage_specials',
                        restaurantId: spec.restaurant_id,
                        supabaseUrl: spec.image_url,
                        bucketName: parsed.bucket,
                        supabasePath: parsed.path,
                        r2Key,
                        updateDb: async (newUrl) => {
                            return supabase.from('homepage_specials').update({ image_url: newUrl }).eq('id', spec.id);
                        }
                    });
                }
            }
        }

        // 8. Fetch homepage_categories
        log('Scanning homepage_categories table...', 'INFO');
        const { data: homeCats, error: homeCatErr } = await supabase.from('homepage_categories').select('id, image_url, restaurant_id');
        if (homeCatErr) throw homeCatErr;

        for (const cat of (homeCats || [])) {
            if (cat.image_url && cat.image_url.includes('supabase.co/storage')) {
                const parsed = parseSupabaseUrl(cat.image_url);
                if (parsed) {
                    const r2Type = getR2FolderType(parsed.bucket, 'homepage_categories');
                    const r2Key = `restaurants/${cat.restaurant_id}/${r2Type}/${path.basename(parsed.path)}`;
                    jobs.push({
                        id: cat.id,
                        tableName: 'homepage_categories',
                        restaurantId: cat.restaurant_id,
                        supabaseUrl: cat.image_url,
                        bucketName: parsed.bucket,
                        supabasePath: parsed.path,
                        r2Key,
                        updateDb: async (newUrl) => {
                            return supabase.from('homepage_categories').update({ image_url: newUrl }).eq('id', cat.id);
                        }
                    });
                }
            }
        }

        log(`Scan complete. Found ${jobs.length} files to migrate.`, 'INFO');

        if (jobs.length === 0) {
            log('No files to migrate.', 'INFO');
            return;
        }

        // Batch processing migration
        const batchSize = 5;
        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < jobs.length; i += batchSize) {
            const batch = jobs.slice(i, i + batchSize);
            log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(jobs.length / batchSize)} (size: ${batch.length})...`, 'INFO');

            const batchPromises = batch.map(async (job) => {
                try {
                    log(`[${job.tableName}] Starting migration for record ID ${job.id} (URL: ${job.supabaseUrl})`, 'INFO');

                    // Check if file is cached
                    let targetUrl = uploadedFilesCache.get(job.supabaseUrl);

                    if (isDryRun && !executeMigration) {
                        log(`[DRY RUN] Would fetch from Supabase Storage: Bucket: ${job.bucketName}, Path: ${job.supabasePath}`, 'INFO');
                        log(`[DRY RUN] Would upload to Cloudflare R2: Key: ${job.r2Key}`, 'INFO');
                        log(`[DRY RUN] Would update database URL to: ${NEXT_PUBLIC_R2_PUBLIC_URL}/${job.r2Key}`, 'INFO');
                        log(`[DRY RUN] Would verify R2 URL and delete original file from Supabase Storage`, 'INFO');
                        successCount++;
                        return;
                    }

                    if (!NEXT_PUBLIC_R2_PUBLIC_URL) {
                        throw new Error('NEXT_PUBLIC_R2_PUBLIC_URL is not configured in environment variables');
                    }

                    // 1. Fetch file from Supabase storage (with retry)
                    let fileBuffer: Buffer | null = null;
                    let contentType = 'application/octet-stream';

                    if (!targetUrl) {
                        log(`Fetching file from Supabase Storage bucket "${job.bucketName}" at "${job.supabasePath}"...`, 'INFO');
                        let downloadSuccess = false;
                        let downloadErr: any = null;

                        for (let r = 0; r < 3; r++) {
                            try {
                                const { data: fileData, error: dlErr } = await supabase.storage
                                    .from(job.bucketName)
                                    .download(job.supabasePath);

                                if (dlErr) throw dlErr;

                                if (fileData) {
                                    const arrayBuf = await fileData.arrayBuffer();
                                    fileBuffer = Buffer.from(arrayBuf);
                                    contentType = fileData.type || 'application/octet-stream';
                                    downloadSuccess = true;
                                    break;
                                }
                            } catch (e: any) {
                                downloadErr = e;
                                log(`Download attempt ${r + 1} failed: ${e.message || e}. Retrying...`, 'WARN');
                                await sleep(1000 * Math.pow(2, r));
                            }
                        }

                        if (!downloadSuccess || !fileBuffer) {
                            throw new Error(`Failed to download file from Supabase: ${downloadErr?.message || 'Unknown error'}`);
                        }

                        // 2. Upload file to Cloudflare R2 (with retry)
                        log(`Uploading file to R2 at key "${job.r2Key}"...`, 'INFO');
                        let uploadSuccess = false;
                        let uploadErr: any = null;

                        for (let r = 0; r < 3; r++) {
                            try {
                                await uploadToR2(job.r2Key, fileBuffer, contentType);
                                uploadSuccess = true;
                                break;
                            } catch (e: any) {
                                uploadErr = e;
                                log(`R2 upload attempt ${r + 1} failed: ${e.message || e}. Retrying...`, 'WARN');
                                await sleep(1000 * Math.pow(2, r));
                            }
                        }

                        if (!uploadSuccess) {
                            throw new Error(`Failed to upload file to R2: ${uploadErr?.message || 'Unknown error'}`);
                        }

                        targetUrl = `${NEXT_PUBLIC_R2_PUBLIC_URL}/${job.r2Key}`;
                        uploadedFilesCache.set(job.supabaseUrl, targetUrl);
                    } else {
                        log(`Reusing already uploaded R2 file for identical URL: ${targetUrl}`, 'INFO');
                        skippedCount++;
                    }

                    // 3. Update database URL
                    log(`Updating database record...`, 'INFO');
                    const { error: updateErr } = await job.updateDb(targetUrl);
                    if (updateErr) {
                        throw new Error(`Database update failed: ${updateErr.message}`);
                    }

                    // 4. Verify R2 URL returns 200 OK
                    log(`Verifying R2 CDN URL (${targetUrl})...`, 'INFO');
                    try {
                        const verifyRes = await fetchWithRetry(targetUrl);
                        if (!verifyRes.ok) {
                            throw new Error(`Verification HTTP status is ${verifyRes.status}`);
                        }
                        log(`Verification succeeded for ${targetUrl}`, 'INFO');
                    } catch (verifyErr: any) {
                        // Rollback DB URL to Supabase URL in case verification fails
                        log(`Verification failed for ${targetUrl}: ${verifyErr.message || verifyErr}. Rolling back DB record.`, 'ERROR');
                        await job.updateDb(job.supabaseUrl);
                        throw verifyErr;
                    }

                    // 5. Delete original file from Supabase storage
                    log(`Deleting original file from Supabase bucket "${job.bucketName}" at "${job.supabasePath}"...`, 'INFO');
                    const { error: removeErr } = await supabase.storage
                        .from(job.bucketName)
                        .remove([job.supabasePath]);

                    if (removeErr) {
                        log(`Failed to delete Supabase source file: ${removeErr.message}. DB record was successfully migrated to R2.`, 'WARN');
                    } else {
                        log(`Deleted Supabase source file successfully.`, 'INFO');
                    }

                    log(`✅ Successfully migrated: ${job.supabaseUrl} -> ${targetUrl}`, 'INFO');
                    successCount++;

                } catch (e: any) {
                    log(`❌ Failed to migrate record ID ${job.id} in ${job.tableName}: ${e.message || e}`, 'ERROR');
                    failCount++;
                }
            });

            await Promise.all(batchPromises);
            await sleep(500); // Small pause between batches
        }

        log('\n--- Migration Summary ---', 'INFO');
        log(`Total files scanned: ${jobs.length}`, 'INFO');
        log(`Successfully migrated: ${successCount}`, 'INFO');
        log(`Failed migrations: ${failCount}`, 'INFO');
        log(`Skipped (duplicates): ${skippedCount}`, 'INFO');
        log(`Log written to: ${logFilePath}`, 'INFO');

    } catch (err: any) {
        log(`Fatal error running migration: ${err.message || err}`, 'ERROR');
    } finally {
        logStream.end();
    }
}

// Helper to parse Supabase storage URL
// Format: https://[project-id].supabase.co/storage/v1/object/public/[bucket]/[path]
function parseSupabaseUrl(url: string): { bucket: string; path: string } | null {
    try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split('/');
        
        // Parts should be: ["", "storage", "v1", "object", "public", "[bucket]", "[path...]"]
        const objectIdx = pathParts.indexOf('object');
        if (objectIdx === -1 || pathParts[objectIdx + 1] !== 'public') {
            return null;
        }

        const bucket = pathParts[objectIdx + 2];
        const path = pathParts.slice(objectIdx + 3).join('/');

        if (!bucket || !path) return null;

        return { bucket, path };
    } catch {
        return null;
    }
}

run();
