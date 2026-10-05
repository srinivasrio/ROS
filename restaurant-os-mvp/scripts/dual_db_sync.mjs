#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

// Key domain tables in dependency order
const CORE_TABLES = [
    'restaurants',
    'branches',
    'restaurant_roles',
    'profiles',
    'categories',
    'menu_items',
    'tables',
    'customers',
    'coupons',
    'orders',
    'order_items',
    'kds_order_history',
    'payments',
    'order_status_events',
    'inventory_items',
    'suppliers',
    'platform_settings',
    'printer_configs'
];

const args = process.argv.slice(2);
const shouldSync = args.includes('--sync') || args.some(a => a.startsWith('--direction='));
let direction = 'bidirectional'; // 'vps-to-cloud', 'cloud-to-vps', 'bidirectional'

for (const a of args) {
    if (a.startsWith('--direction=')) {
        direction = a.split('=')[1];
    }
}

async function getCount(client, table) {
    try {
        const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });
        if (error) return { count: null, error: error.message };
        return { count: count || 0, error: null };
    } catch (e) {
        return { count: null, error: e.message };
    }
}

async function syncTable(table, srcClient, srcName, destClient, destName) {
    // Fetch all records from source
    const { data: srcRows, error: srcErr } = await srcClient.from(table).select('*');
    if (srcErr) {
        return { error: `Failed reading from ${srcName}: ${srcErr.message}` };
    }
    if (!srcRows || srcRows.length === 0) {
        return { synced: 0 };
    }

    // Upsert in chunks of 50
    const chunkSize = 50;
    let synced = 0;
    for (let i = 0; i < srcRows.length; i += chunkSize) {
        const chunk = srcRows.slice(i, i + chunkSize);
        const { error: destErr } = await destClient.from(table).upsert(chunk, { ignoreDuplicates: false });
        if (destErr) {
            return { error: `Failed writing chunk to ${destName}: ${destErr.message}` };
        }
        synced += chunk.length;
    }
    return { synced };
}

async function run() {
    console.log("=================================================================");
    console.log("🔄  DUAL DATABASE DATA SYNCHRONIZER (VPS <-> CLOUD)");
    console.log("=================================================================");
    console.log(`VPS:       ${VPS_URL}`);
    console.log(`Cloud:     ${CLOUD_URL}`);
    console.log(`Mode:      ${shouldSync ? `SYNC (${direction})` : 'CHECK / AUDIT (Use --sync to reconcile)'}`);
    console.log("=================================================================\n");

    const report = [];

    for (const table of CORE_TABLES) {
        const [vpsRes, cloudRes] = await Promise.all([
            getCount(vps, table),
            getCount(cloud, table)
        ]);

        const vpsCount = vpsRes.count;
        const cloudCount = cloudRes.count;
        const diff = (vpsCount !== null && cloudCount !== null) ? (vpsCount - cloudCount) : 'ERR';

        let status = 'IN SYNC';
        if (vpsRes.error || cloudRes.error) {
            status = 'TABLE ERROR';
        } else if (diff !== 0) {
            status = diff > 0 ? `VPS +${diff}` : `Cloud +${Math.abs(diff)}`;
        }

        report.push({
            table,
            vpsCount: vpsCount !== null ? vpsCount : 'ERR',
            cloudCount: cloudCount !== null ? cloudCount : 'ERR',
            diff,
            status
        });
    }

    // Print table report
    console.log(
        "Table Name".padEnd(24) +
        "VPS Rows".padEnd(14) +
        "Cloud Rows".padEnd(14) +
        "Status"
    );
    console.log("-".repeat(65));
    for (const r of report) {
        console.log(
            r.table.padEnd(24) +
            String(r.vpsCount).padEnd(14) +
            String(r.cloudCount).padEnd(14) +
            r.status
        );
    }
    console.log("-".repeat(65));

    // Perform Sync if requested
    if (shouldSync) {
        console.log("\nStarting data synchronization...");
        for (const r of report) {
            if (r.diff === 0 || r.status === 'TABLE ERROR') continue;

            console.log(`\nReconciling [${r.table}]...`);
            if (direction === 'vps-to-cloud' || (direction === 'bidirectional' && r.diff > 0)) {
                process.stdout.write(`  Syncing VPS -> Cloud... `);
                const res = await syncTable(r.table, vps, "VPS", cloud, "Cloud");
                if (res.error) console.log(`FAILED ❌: ${res.error}`);
                else console.log(`DONE ✅ (${res.synced} rows upserted)`);
            }

            if (direction === 'cloud-to-vps' || (direction === 'bidirectional' && r.diff < 0)) {
                process.stdout.write(`  Syncing Cloud -> VPS... `);
                const res = await syncTable(r.table, cloud, "Cloud", vps, "VPS");
                if (res.error) console.log(`FAILED ❌: ${res.error}`);
                else console.log(`DONE ✅ (${res.synced} rows upserted)`);
            }
        }
        console.log("\n✅ Synchronization pass completed!");
    } else {
        console.log("\n💡 Tip: To automatically reconcile differences, run:");
        console.log("   npm run db:sync -- --sync");
        console.log("   npm run db:sync -- --direction=vps-to-cloud");
        console.log("   npm run db:sync -- --direction=cloud-to-vps");
    }
    console.log("=================================================================");
}

run().catch(err => {
    console.error("Sync runner error:", err);
    process.exit(1);
});
