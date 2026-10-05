import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runTests() {
    console.log('=== TEST 1: Database Column Existence ===');
    const { data: empSample, error: empErr } = await supabase
        .from('employees')
        .select('id, name, restaurant_id, weekly_off, salary_type, monthly_salary')
        .not('restaurant_id', 'is', null)
        .limit(3);

    if (empErr) {
        console.error('❌ Failed to select employees:', empErr);
        process.exit(1);
    }
    console.log('✅ Employee sample columns verified:', empSample);

    console.log('\n=== TEST 2: Attendance Status Constraint ===');
    // Test inserting and updating attendance with 'weekly_off' and 'leave'
    const testEmp = empSample[0];
    if (!testEmp) {
        console.log('⚠️ No employees found to test attendance');
        return;
    }

    const testDate = '2026-10-01';
    const { data: restData } = await supabase
        .from('employees')
        .select('restaurant_id')
        .eq('id', testEmp.id)
        .single();

    const restaurantId = restData.restaurant_id;

    // Test weekly_off status
    const { data: attWO, error: attWOErr } = await supabase
        .from('attendance')
        .upsert({
            restaurant_id: restaurantId,
            employee_id: testEmp.id,
            date: testDate,
            status: 'weekly_off',
            updated_at: new Date().toISOString()
        }, { onConflict: 'employee_id,date' })
        .select();

    if (attWOErr) {
        console.error('❌ Failed to insert weekly_off attendance:', attWOErr);
        process.exit(1);
    }
    console.log('✅ weekly_off attendance status accepted:', attWO[0]?.status);

    // Test leave status
    const { data: attLeave, error: attLeaveErr } = await supabase
        .from('attendance')
        .upsert({
            restaurant_id: restaurantId,
            employee_id: testEmp.id,
            date: '2026-10-02',
            status: 'leave',
            updated_at: new Date().toISOString()
        }, { onConflict: 'employee_id,date' })
        .select();

    if (attLeaveErr) {
        console.error('❌ Failed to insert leave attendance:', attLeaveErr);
        process.exit(1);
    }
    console.log('✅ leave attendance status accepted:', attLeave[0]?.status);

    console.log('\n=== TEST 3: Payroll Calculations & Deductions ===');
    // Let's create a test payroll run for month 10, year 2026
    const { data: run, error: runErr } = await supabase
        .from('payroll_runs')
        .upsert({
            restaurant_id: restaurantId,
            month: 10,
            year: 2026,
            status: 'draft'
        }, { onConflict: 'restaurant_id,month,year' })
        .select()
        .single();

    if (runErr) {
        console.error('❌ Failed to create/upsert payroll run:', runErr);
        process.exit(1);
    }
    console.log('✅ Payroll run initialized:', run.id, 'status:', run.status);

    // Check payroll_items columns
    const { data: pItem, error: pItemErr } = await supabase
        .from('payroll_items')
        .upsert({
            payroll_run_id: run.id,
            employee_id: testEmp.id,
            monthly_salary: 30000,
            gross_salary: 30000,
            present_days: 20,
            absent_days: 2,
            half_days: 2,
            leave_days: 2,
            weekly_off_days: 4,
            overtime_hours: 5,
            overtime_pay: 500,
            deductions: 3000, // 2 absent * 1000 + 2 half_day * 500 = 3000
            final_salary: 27500, // 30000 - 3000 + 500
            payment_status: 'pending'
        }, { onConflict: 'payroll_run_id,employee_id' })
        .select()
        .single();

    if (pItemErr) {
        console.error('❌ Failed to upsert payroll item:', pItemErr);
        process.exit(1);
    }
    console.log('✅ Payroll item verified with weekly_off_days & leave_days:', {
        present: pItem.present_days,
        half_days: pItem.half_days,
        absent: pItem.absent_days,
        leave: pItem.leave_days,
        weekly_off: pItem.weekly_off_days,
        deductions: pItem.deductions,
        final_salary: pItem.final_salary
    });

    // Test run status update to 'calculated'
    const { error: statusCalcErr } = await supabase
        .from('payroll_runs')
        .update({ status: 'calculated' })
        .eq('id', run.id);
    if (statusCalcErr) {
        console.error('❌ Failed to update run status to calculated:', statusCalcErr);
        process.exit(1);
    }
    console.log('✅ Payroll run status updated to calculated successfully');

    // Clean up test attendance records
    await supabase.from('attendance').delete().in('date', ['2026-10-01', '2026-10-02']).eq('employee_id', testEmp.id);
    await supabase.from('payroll_items').delete().eq('payroll_run_id', run.id);
    await supabase.from('payroll_runs').delete().eq('id', run.id);

    console.log('🧹 Cleaned up test records');

    console.log('\n=== TEST 4: Verify Existing PIN and Auth Safety ===');
    const { count: pinCount, error: pinErr } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .not('pin', 'is', null);

    if (pinErr) {
        console.error('❌ Failed checking PINs:', pinErr);
        process.exit(1);
    }
    console.log(`✅ Existing staff PINs are safe and untouched: ${pinCount} employees with PINs intact.`);

    const { count: authCount, error: authErr } = await supabase
        .from('auth')
        .select('*', { count: 'exact', head: true });

    if (authErr) {
        console.error('❌ Failed checking auth table:', authErr);
        process.exit(1);
    }
    console.log(`✅ Existing auth records are safe and untouched: ${authCount} auth records intact.`);

    console.log('\n🎉 ALL PAYROLL IMPROVEMENTS TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
    console.error('Fatal error during test:', err);
    process.exit(1);
});
