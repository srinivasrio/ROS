import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: 'super-admin/.env.local' });
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    dotenv.config({ path: '.env.local' });
}

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = 'jmcsygpphwdubnanwjwz';
const REGION = 'ap-south-1';

const connectionString = `postgresql://postgres.${PROJECT_REF}:${SERVICE_KEY}@aws-0-${REGION}.pooler.supabase.com:6543/postgres`;

const { Client } = pg;
const client = new Client({ connectionString });

async function audit() {
    try {
        await client.connect();
        console.log('Connected to DB successfully.\n');

        // 1. Find all tables related to homepage or banners or customization
        const tablesRes = await client.query(`
            SELECT tablename, rowsecurity 
            FROM pg_tables 
            WHERE schemaname = 'public' 
              AND (
                tablename LIKE '%homepage%' 
                OR tablename LIKE '%banner%' 
                OR tablename LIKE '%theme%' 
                OR tablename LIKE '%quick_action%'
                OR tablename LIKE '%category_button%'
                OR tablename LIKE '%restaurant_profile%'
                OR tablename LIKE '%offer%'
                OR tablename LIKE '%special%'
                OR tablename LIKE '%section_style%'
              )
            ORDER BY tablename;
        `);
        console.log('--- Matching Tables & RLS Status ---');
        console.table(tablesRes.rows);

        // 2. Fetch all policies for these tables
        const tableNames = tablesRes.rows.map(r => r.tablename);
        const policiesRes = await client.query(`
            SELECT 
                schemaname,
                tablename,
                policyname,
                permissive,
                roles,
                cmd,
                qual,
                with_check
            FROM pg_policies
            WHERE schemaname = 'public'
              AND tablename = ANY($1)
            ORDER BY tablename, cmd, policyname;
        `, [tableNames]);

        console.log('\n--- Existing Policies ---');
        for (const p of policiesRes.rows) {
            console.log(`Table: [${p.tablename}] | Policy: "${p.policyname}" | CMD: ${p.cmd} | Roles: [${p.roles}]`);
            console.log(`  USING: ${p.qual}`);
            console.log(`  WITH CHECK: ${p.with_check}`);
            console.log('----------------------------------------------------');
        }

    } catch (err) {
        console.error('Audit failed:', err);
    } finally {
        await client.end();
    }
}

audit();
