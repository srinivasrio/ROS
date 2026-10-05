import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { supabaseAdmin } from '../lib/supabase-admin';
import { r2Client } from '../lib/r2';
import zlib from 'zlib';

const s3Client = r2Client;
const BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'dineinone-assets';

// Deterministic list of tables to backup/restore (excluding backups/secrets tables themselves)
const TABLES_TO_BACKUP = [
    'restaurants', 'restaurant_profile', 'restaurant_legal', 'branches',
    'roles', 'restaurant_users', 'employee_branch_access', 'subscriptions', 'payments', 'invoices', 'invoice_items',
    'terms_acceptances', 'restaurant_deletion_requests', 'restaurant_registration_requests', 'email_otp_verifications',
    'plans', 'support_tickets', 'security_events', 'notifications', 'platform_settings',
    'auth', 'employees', 'audit_logs', 'users', 'customers',
    'categories', 'sub_categories', 'menu_items', 'menu_recipe_mapping', 'today_specials', 'today_special_items',
    'tables', 'table_merge_groups',
    'orders', 'order_items', 'order_status_history',
    'offers', 'service_requests', 'service_options',
    'inventory_items', 'inventory_categories', 'inventory_consumption_log', 'inventory_adjustment_log', 'inventory_alerts', 'suppliers',
    'activity_logs', 'ai_snapshot',
    'homepage_sections', 'restaurant_theme',
    'homepage_categories', 'homepage_services', 'homepage_specials', 'section_style_settings', 'homepage_banners',
    'waiter_workloads', 'waiter_assignments', 'service_assignments', 'attendance', 'payroll_runs', 'payroll_items',
    'delivery_boys', 'delivery_settings', 'delivery_assignments', 'delivery_zones', 'customer_addresses',
    'user_otps', 'waiter_shifts', 'login_audit_logs', 'dine_sessions', 'staff_tasks', 'staff_assignment_config'
];

const BACKUP_PAGE_SIZE = 1000;

async function exportTable(table: string): Promise<any[]> {
    const rows: any[] = [];
    let offset = 0;

    while (true) {
        const { data, error } = await supabaseAdmin
            .from(table)
            .select('*')
            .range(offset, offset + BACKUP_PAGE_SIZE - 1);

        if (error) {
            throw new Error(`Failed to export table ${table} at offset ${offset}: ${error.message}`);
        }

        const page = data || [];
        rows.push(...page);
        if (page.length < BACKUP_PAGE_SIZE) break;
        offset += BACKUP_PAGE_SIZE;
    }

    return rows;
}

export class BackupService {
    /**
     * Create a backup of the database
     */
    static async createSnapshot(triggerType: 'daily' | 'weekly' | 'monthly' | 'manual' = 'manual'): Promise<{ success: boolean; filename?: string; error?: string }> {
        const tempId = crypto.randomUUID();
        const filename = `backup_${triggerType}_${Date.now()}_${tempId.substring(0, 8)}.json.gz`;
        
        try {
            console.log(`[BackupService] Starting database backup. Trigger: ${triggerType}, Filename: ${filename}`);
            
            const backupData: Record<string, any[]> = {};
            
            // 1. Export all table rows in bounded pages. A single Supabase
            // select can be capped by the API row limit and produce an
            // incomplete backup while still returning success.
            for (const table of TABLES_TO_BACKUP) {
                backupData[table] = await exportTable(table);
            }
            
            // 2. Compress payload
            const jsonString = JSON.stringify(backupData);
            const compressedBuffer = zlib.gzipSync(Buffer.from(jsonString));
            const fileSize = compressedBuffer.length;
            
            // 3. Upload to Cloudflare R2
            const key = `backups/${filename}`;
            await s3Client.send(new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: compressedBuffer,
                ContentType: 'application/gzip'
            }));
            
            // 4. Log backup success in DB
            await supabaseAdmin.from('db_backups').insert({
                filename,
                file_size: fileSize,
                trigger_type: triggerType,
                status: 'success'
            });
            
            console.log(`[BackupService] Backup completed successfully. Size: ${fileSize} bytes`);
            return { success: true, filename };
        } catch (err: any) {
            console.error('[BackupService] Backup process failed:', err);
            
            // Log backup failure in DB
            await supabaseAdmin.from('db_backups').insert({
                filename,
                file_size: 0,
                trigger_type: triggerType,
                status: 'failed',
                error_message: err.message || 'Unknown error'
            });
            
            return { success: false, error: err.message || 'Backup failed' };
        }
    }

    /**
     * Restore database from a backup filename
     */
    static async restoreSnapshot(backupId: string, filename: string): Promise<{ success: boolean; error?: string }> {
        try {
            console.log(`[BackupService] Starting database restore. Backup ID: ${backupId}, Filename: ${filename}`);
            
            // 1. Update backup status to restoring
            await supabaseAdmin
                .from('db_backups')
                .update({ restore_status: 'restoring' })
                .eq('id', backupId);

            // 2. Fetch the backup from R2
            const key = `backups/${filename}`;
            const r2Response = await s3Client.send(new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key
            }));

            // Convert readable stream to Buffer
            const streamToBuffer = (stream: any): Promise<Buffer> =>
                new Promise((resolve, reject) => {
                    const chunks: any[] = [];
                    stream.on('data', (chunk: any) => chunks.push(chunk));
                    stream.on('error', reject);
                    stream.on('end', () => resolve(Buffer.concat(chunks)));
                });

            const compressedBuffer = await streamToBuffer(r2Response.Body);
            
            // 3. Decompress the gzip buffer
            const decompressedJson = zlib.gunzipSync(compressedBuffer).toString('utf-8');
            const backupData = JSON.parse(decompressedJson);

            // 4. Call PostgreSQL RPC function to overwrite database tables in a single transaction
            const { error: rpcError } = await supabaseAdmin.rpc('restore_backup_data', {
                backup_payload: backupData
            });

            if (rpcError) {
                throw new Error(`Database restore RPC failed: ${rpcError.message}`);
            }

            // 5. Update backup status to success
            await supabaseAdmin
                .from('db_backups')
                .update({ 
                    restore_status: 'success', 
                    restored_at: new Date().toISOString() 
                })
                .eq('id', backupId);

            console.log('[BackupService] Database restore completed successfully');
            return { success: true };
        } catch (err: any) {
            console.error('[BackupService] Restore process failed:', err);
            
            // Update backup status to failed
            await supabaseAdmin
                .from('db_backups')
                .update({ 
                    restore_status: 'failed',
                    error_message: `Restore failed: ${err.message || 'Unknown error'}`
                })
                .eq('id', backupId);
                
            return { success: false, error: err.message || 'Restore failed' };
        }
    }
}
