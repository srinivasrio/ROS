#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Auto-load .env.local if needed
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && fs.existsSync('.env.local')) {
    const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
        const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (m) {
            let v = (m[2] || '').trim();
            if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
            if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
            process.env[m[1]] = v;
        }
    }
}

const PRIMARY_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_PRIMARY_SUPABASE_URL;
const PRIMARY_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SECONDARY_URL = process.env.SECONDARY_SUPABASE_URL;
const SECONDARY_KEY = process.env.SECONDARY_SUPABASE_SERVICE_ROLE_KEY;
const HAS_SECONDARY = Boolean(SECONDARY_URL && SECONDARY_KEY && SECONDARY_URL !== PRIMARY_URL);

if (!PRIMARY_URL || !PRIMARY_KEY) {
    console.error("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
    process.exit(1);
}

const primaryClient = createClient(PRIMARY_URL, PRIMARY_KEY, { auth: { persistSession: false } });
const secondaryClient = HAS_SECONDARY ? createClient(SECONDARY_URL, SECONDARY_KEY, { auth: { persistSession: false } }) : null;

async function initMigrationLog(client, dbName) {
    const createTableSql = `
    CREATE TABLE IF NOT EXISTS public._dual_migrations_log (
        id serial primary key,
        filename text unique not null,
        applied_at timestamptz default now()
    );
    `;
    const { error } = await client.rpc('exec_migration_sql', { query: createTableSql });
    if (error) {
        console.error(`Failed initializing _dual_migrations_log on ${dbName}:`, error.message);
        throw error;
    }
}

async function getAppliedMigrations(client) {
    const { data, error } = await client.from('_dual_migrations_log').select('filename');
    if (error) return [];
    return data.map(r => r.filename);
}

async function recordMigration(client, filename) {
    const { error } = await client.from('_dual_migrations_log').upsert({ filename }, { onConflict: 'filename' });
    if (error) {
        console.warn("Failed recording migration in log:", error.message);
    }
}

async function recordMigrationsBulk(client, filenames) {
    if (!filenames.length) return;
    const records = filenames.map(f => ({ filename: f }));
    const { error } = await client.from('_dual_migrations_log').upsert(records, { onConflict: 'filename' });
    if (error) {
        console.warn("Failed recording migrations in log:", error.message);
    }
}

async function run() {
    console.log("=================================================================");
    console.log("🚀  SUPABASE MIGRATION RUNNER");
    console.log("=================================================================");
    console.log(`Primary Target:   ${PRIMARY_URL}`);
    if (HAS_SECONDARY) {
        console.log(`Secondary Target: ${SECONDARY_URL}`);
    }
    console.log("");

    console.log("1. Initializing migration logs...");
    await initMigrationLog(primaryClient, "Primary Supabase");
    if (secondaryClient) {
        await initMigrationLog(secondaryClient, "Secondary Supabase");
    }

    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
    if (!fs.existsSync(migrationsDir)) {
        console.error("Migrations directory not found at:", migrationsDir);
        process.exit(1);
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    const isBaselineCmd = process.argv.includes('--baseline');

    const primaryApplied = new Set(await getAppliedMigrations(primaryClient));
    const secondaryApplied = secondaryClient ? new Set(await getAppliedMigrations(secondaryClient)) : new Set();

    console.log(`Found ${files.length} total migration files in repository.`);
    console.log(`Primary has ${primaryApplied.size} recorded migrations.`);
    if (secondaryClient) {
        console.log(`Secondary has ${secondaryApplied.size} recorded migrations.`);
    }

    // If explicit --baseline or if any existing repo migration was never recorded in a newly initialized DB:
    if (isBaselineCmd) {
        console.log("\n[--baseline] Recording all existing repo migrations as applied...");
        await recordMigrationsBulk(primaryClient, files);
        if (secondaryClient) await recordMigrationsBulk(secondaryClient, files);
        console.log("✅ Baseline established for all existing files.");
        process.exit(0);
    }

    // Find pending migrations
    const pending = files.filter(f => !primaryApplied.has(f) || (secondaryClient && !secondaryApplied.has(f)));

    if (pending.length === 0) {
        console.log("\n✅ Database is completely UP TO DATE! No pending migrations.");
        console.log("=================================================================");
        process.exit(0);
    }

    console.log(`\nFound ${pending.length} pending migration(s) to execute:`);
    for (const file of pending) {
        console.log(`  - ${file}`);
    }

    for (const file of pending) {
        console.log(`\nExecuting: ${file}...`);
        const rawSql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        // PL/pgSQL EXECUTE (inside exec_migration_sql) forbids explicit BEGIN;/COMMIT;; each RPC call is already atomic.
        const sql = rawSql.replace(/^\s*(BEGIN|COMMIT)\s*;\s*$/gim, '');

        // Apply on Primary
        if (!primaryApplied.has(file)) {
            process.stdout.write("  -> Applying to Primary Supabase... ");
            const { error: primaryErr } = await primaryClient.rpc('exec_migration_sql', { query: sql });
            if (primaryErr) {
                console.log("FAILED ❌");
                console.error("Primary Error:", primaryErr.message);
                process.exit(1);
            }
            await recordMigration(primaryClient, file);
            console.log("DONE ✅");
        } else {
            console.log("  -> Primary already has this migration.");
        }

        // Apply on Secondary (if configured)
        if (secondaryClient) {
            if (!secondaryApplied.has(file)) {
                process.stdout.write("  -> Applying to Secondary Supabase... ");
                const { error: secErr } = await secondaryClient.rpc('exec_migration_sql', { query: sql });
                if (secErr) {
                    console.log("FAILED ❌");
                    console.error("Secondary Error:", secErr.message);
                    process.exit(1);
                }
                await recordMigration(secondaryClient, file);
                console.log("DONE ✅");
            } else {
                console.log("  -> Secondary already has this migration.");
            }
        }
    }

    console.log("\n=================================================================");
    console.log("🎉  ALL PENDING MIGRATIONS APPLIED SUCCESSFULLY!");
    console.log("=================================================================");
}

run().catch(err => {
    console.error("Migration runner failed:", err);
    process.exit(1);
});
