const { Client } = require('pg');
async function run() {
    const client = new Client({ connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
    await client.connect();
    const res = await client.query("SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname='save_menu_item_with_recipe'");
    console.log(res.rows[0].pg_get_functiondef);
    await client.end();
}
run();
