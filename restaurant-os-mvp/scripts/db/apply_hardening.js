const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function run() {
    const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
    try {
        await client.connect();
        console.log("Connected to PostgreSQL.");
        const sqlPath = path.join(__dirname, '../../supabase/migrations/20260627000000_security_hardening.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log("Reading migration SQL from " + sqlPath + " ...");
        await client.query(sql);
        console.log("Migration executed successfully!");
    } catch (e) {
        console.error("Migration failed:", e);
        process.exit(1);
    } finally {
        await client.end();
    }
}
run();
