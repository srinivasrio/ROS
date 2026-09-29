const { Client } = require('pg');
async function run() {
    const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
    try {
        await client.connect();
        const res = await client.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='save_menu_item_with_recipe'");
        console.log("=== SQL DEFINITION ===");
        if (res.rows.length > 0) {
            console.log(res.rows[0].pg_get_functiondef);
        } else {
            console.log("Function not found!");
        }
    } catch (e) { console.error(e); } finally { await client.end(); }
}
run();
