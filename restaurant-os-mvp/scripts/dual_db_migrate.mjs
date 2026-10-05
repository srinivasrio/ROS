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

const VPS_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://72.61.250.231:8010';
const VPS_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CLOUD_URL = process.env.SECONDARY_SUPABASE_URL || 'https://jmcsygpphwdubnanwjwz.supabase.co';
const CLOUD_KEY = process.env.SECONDARY_SUPABASE_SERVICE_ROLE_KEY;

if (!VPS_KEY || !CLOUD_KEY) {
    console.error("ERROR: Missing SUPABASE_SERVICE_ROLE_KEY or SECONDARY_SUPABASE_SERVICE_ROLE_KEY in environment.");
    process.exit(1);
}

const vps = createClient(VPS_URL, VPS_KEY, { auth: { persistSession: false } });
const cloud = createClient(CLOUD_URL, CLOUD_KEY, { auth: { persistSession: false } });

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
    console.log("🚀  DUAL DATABASE MIGRATION RUNNER (VPS + CLOUD)");
    console.log("=================================================================");
    console.log(`VPS Target:   ${VPS_URL}`);
    console.log(`Cloud Target: ${CLOUD_URL}`);
    console.log("");

    console.log("1. Initializing migration logs on both databases...");
    await initMigrationLog(vps, "VPS Database");
    await initMigrationLog(cloud, "Cloud Database");

    const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
    if (!fs.existsSync(migrationsDir)) {
        console.error("Migrations directory not found at:", migrationsDir);
        process.exit(1);
    }

    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();

    const isBaselineCmd = process.argv.includes('--baseline');

    let vpsApplied = new Set(await getAppliedMigrations(vps));
    let cloudApplied = new Set(await getAppliedMigrations(cloud));

    console.log(`Found ${files.length} total migration files in repository.`);
    console.log(`VPS has ${vpsApplied.size} recorded migrations.`);
    console.log(`Cloud has ${cloudApplied.size} recorded migrations.`);

    // If explicit --baseline or if any existing repo migration was never recorded in a newly initialized DB:
    if (isBaselineCmd) {
        console.log("\n[--baseline] Recording all existing repo migrations as applied on both DBs...");
        await recordMigrationsBulk(vps, files);
        await recordMigrationsBulk(cloud, files);
        console.log("✅ Baseline established for all existing files.");
        process.exit(0);
    }

    // Find pending migrations
    const pending = files.filter(f => !vpsApplied.has(f) || !cloudApplied.has(f));

    if (pending.length === 0) {
        console.log("\n✅ Both databases are completely UP TO DATE! No pending migrations.");
        console.log("=================================================================");
        process.exit(0);
    }

    console.log(`\nFound ${pending.length} pending migration(s) to execute:`);
    for (const file of pending) {
        console.log(`  - ${file}`);
    }

    for (const file of pending) {
        console.log(`\nExecuting: ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        // Apply on VPS
        if (!vpsApplied.has(file)) {
            process.stdout.write("  -> Applying to VPS Supabase... ");
            const { error: vpsErr } = await vps.rpc('exec_migration_sql', { query: sql });
            if (vpsErr) {
                console.log("FAILED ❌");
                console.error("VPS Error:", vpsErr.message);
                process.exit(1);
            }
            await recordMigration(vps, file);
            console.log("DONE ✅");
        } else {
            console.log("  -> VPS already has this migration.");
        }

        // Apply on Cloud
        if (!cloudApplied.has(file)) {
            process.stdout.write("  -> Applying to Cloud Supabase... ");
            const { error: cloudErr } = await cloud.rpc('exec_migration_sql', { query: sql });
            if (cloudErr) {
                console.log("FAILED ❌");
                console.error("Cloud Error:", cloudErr.message);
                process.exit(1);
            }
            await recordMigration(cloud, file);
            console.log("DONE ✅");
        } else {
            console.log("  -> Cloud already has this migration.");
        }
    }

    console.log("\n=================================================================");
    console.log("🎉  ALL PENDING MIGRATIONS APPLIED TO BOTH DATABASES SUCCESSFULLY!");
    console.log("=================================================================");
}

run().catch(err => {
    console.error("Migration runner failed:", err);
    process.exit(1);
});
