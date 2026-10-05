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

const args = process.argv.slice(2);
let sql = '';

const fileIdx = args.indexOf('--file');
if (fileIdx !== -1 && args[fileIdx + 1]) {
    const filePath = path.resolve(process.cwd(), args[fileIdx + 1]);
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }
    sql = fs.readFileSync(filePath, 'utf8');
} else if (args.length > 0 && !args[0].startsWith('--')) {
    sql = args.join(' ');
}

if (!sql.trim()) {
    console.log("Usage:");
    console.log("  npm run db:sql \"SELECT count(*) FROM orders;\"");
    console.log("  npm run db:sql -- --file ./path/to/script.sql");
    process.exit(1);
}

const vps = createClient(VPS_URL, VPS_KEY, { auth: { persistSession: false } });
const cloud = createClient(CLOUD_URL, CLOUD_KEY, { auth: { persistSession: false } });

async function executeOnDb(name, client, query) {
    process.stdout.write(`Executing on ${name}... `);
    const start = Date.now();
    try {
        const { data, error } = await client.rpc('exec_migration_sql', { query });
        const elapsed = Date.now() - start;
        if (error) {
            console.log(`FAILED ❌ (${elapsed}ms)`);
            console.error(`  Error from ${name}:`, error.message);
            return { success: false, error: error.message };
        }
        console.log(`SUCCESS ✅ (${elapsed}ms)`);
        if (data) {
            console.log(`  Output from ${name}:`, data);
        }
        return { success: true, data };
    } catch (err) {
        console.log(`EXCEPTION ❌`);
        console.error(`  Exception from ${name}:`, err.message);
        return { success: false, error: err.message };
    }
}

async function run() {
    console.log("=================================================================");
    console.log("⚡  DUAL DATABASE SQL EXECUTOR (VPS + CLOUD)");
    console.log("=================================================================");
    console.log(`VPS:   ${VPS_URL}`);
    console.log(`Cloud: ${CLOUD_URL}`);
    console.log("-----------------------------------------------------------------");
    console.log("SQL Query:\n" + sql.trim());
    console.log("-----------------------------------------------------------------");

    const [vpsRes, cloudRes] = await Promise.all([
        executeOnDb("VPS Database", vps, sql),
        executeOnDb("Cloud Database", cloud, sql)
    ]);

    console.log("=================================================================");
    if (vpsRes.success && cloudRes.success) {
        console.log("🎉  SQL EXECUTED SUCCESSFULLY ON BOTH DATABASES!");
        process.exit(0);
    } else {
        console.error("⚠️   ONE OR MORE DATABASES FAILED TO EXECUTE SQL.");
        process.exit(1);
    }
}

run();
