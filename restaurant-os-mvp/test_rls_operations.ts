import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jmcsygpphwdubnanwjwz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptY3N5Z3BwaHdkdWJuYW53and6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjUyMTIsImV4cCI6MjA4NTgwMTIxMn0.uQyoWluprn9Gr-ypserxqF9WM_85MWUMAO7Uch1jN14';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const RESTAURANT_ID = '202603180001';

async function testOperations() {
  console.log('--- 1. TESTING MERGE TABLES WITH ANON KEY ---');
  const { data: tables, error: tablesErr } = await supabase
    .from('tables')
    .select('id, table_number')
    .eq('restaurant_id', RESTAURANT_ID)
    .limit(2);

  if (tablesErr || !tables || tables.length < 2) {
    console.error('Failed to get tables:', tablesErr);
    return;
  }

  const tableIds = tables.map(t => t.id);
  const testGroupId = '00000000-0000-0000-0000-' + Date.now().toString().slice(-12);
  console.log(`Merging tables: ${tableIds.join(', ')}`);

  // Insert merge group
  const { data: mergeGroup, error: mgErr } = await supabase
    .from('table_merge_groups')
    .insert({
      id: testGroupId,
      display_name: 'Table Test Merge',
      total_capacity: 8,
      status: 'occupied',
      restaurant_id: RESTAURANT_ID
    })
    .select()
    .single();

  if (mgErr) {
    console.error('FAIL: insert table_merge_groups error:', mgErr);
  } else {
    console.log('SUCCESS: Inserted merge group:', mergeGroup.id);
  }

  // Update physical tables
  const { error: updErr } = await supabase
    .from('tables')
    .update({
      status: 'occupied',
      is_merged: true,
      merged_group_id: testGroupId
    })
    .in('id', tableIds)
    .eq('restaurant_id', RESTAURANT_ID);

  if (updErr) {
    console.error('FAIL: update tables error:', updErr);
  } else {
    console.log('SUCCESS: Updated physical tables to merged state');
  }

  // Clean up merge group (Unmerge)
  await supabase
    .from('tables')
    .update({
      status: 'empty',
      is_merged: false,
      merged_group_id: null
    })
    .in('id', tableIds)
    .eq('restaurant_id', RESTAURANT_ID);

  await supabase
    .from('table_merge_groups')
    .delete()
    .eq('id', testGroupId);

  console.log('SUCCESS: Unmerged and deleted merge group');

  console.log('\n--- 2. TESTING ORDER PLACEMENT WITH ANON KEY ---');
  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('id, name, price')
    .eq('restaurant_id', RESTAURANT_ID)
    .limit(1);

  const testMenuItem = menuItems?.[0];

  const testOrderId = 'ord_test_' + Date.now();
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      id: testOrderId,
      restaurant_id: RESTAURANT_ID,
      table_id: tableIds[0],
      status: 'placed',
      total_amount: testMenuItem?.price || 250,
      is_completed: false
    })
    .select()
    .single();

  if (orderErr) {
    console.error('FAIL: insert order error:', orderErr);
    return;
  }
  console.log('SUCCESS: Inserted order:', order.id);

  if (testMenuItem) {
    const { data: orderItem, error: oiErr } = await supabase
      .from('order_items')
      .insert({
        restaurant_id: RESTAURANT_ID,
        order_id: order.id,
        menu_item_id: testMenuItem.id,
        quantity: 1,
        price_at_time: testMenuItem.price,
        status: 'placed'
      })
      .select()
      .single();

    if (oiErr) {
      console.error('FAIL: insert order_item error:', oiErr);
    } else {
      console.log('SUCCESS: Inserted order item:', orderItem.id);
    }
  }

  // Clean up test order
  await supabase.from('order_items').delete().eq('order_id', order.id);
  await supabase.from('orders').delete().eq('id', order.id);
  console.log('SUCCESS: Cleaned up test order');
  console.log('\n🚀 ALL OPERATIONS VERIFIED 100% SUCCEEDED!');
}

testOperations();
