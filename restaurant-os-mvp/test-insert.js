const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config({ path: '.env.local' });

function base64UrlEncode(str) {
    const base64 = Buffer.from(str).toString('base64');
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function base64UrlEncodeBuffer(buf) {
    const base64 = buf.toString('base64');
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
const payload = JSON.stringify({ restaurant_id: '202603180001', exp: 9999999999 });

const encodedHeader = base64UrlEncode(header);
const encodedPayload = base64UrlEncode(payload);

const tokenData = `${encodedHeader}.${encodedPayload}`;
const signature = crypto.createHmac('sha256', 'dine-in-one-jwt-secret-key-at-least-32-chars-2026').update(tokenData).digest();
const jwt = `${tokenData}.${base64UrlEncodeBuffer(signature)}`;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: {
        headers: {
            'x-dine-token': jwt
        }
    }
});

async function run() {
    console.log("Fetching areas...");
    const { data: areas, error: areaErr } = await supabase.from('restaurant_areas').select('*').eq('restaurant_id', '202603180001');
    if (areaErr) {
        console.error("Area Error:", areaErr);
        return;
    }
    console.log("Areas:", areas);
    
    let areaId = areas && areas.length > 0 ? areas[0].id : null;
    
    console.log("Inserting table with area_id:", areaId);
    const { data, error } = await supabase.from('tables').insert({
        table_number: 'TEST',
        capacity: 4,
        status: 'free',
        is_merged: false,
        restaurant_id: '202603180001',
        area_id: areaId
    }).select().single();
    
    if (error) {
        console.error("Insert Error:", error);
    } else {
        console.log("Inserted:", data);
        await supabase.from('tables').delete().eq('id', data.id);
    }
}
run();
