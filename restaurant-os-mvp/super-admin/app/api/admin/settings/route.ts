import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';

export async function GET(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { data: settings } = await supabaseAdmin
            .from('platform_settings')
            .select('*');

        const map: Record<string, any> = {};
        (settings || []).forEach((s) => {
            map[s.key] = s.value;
        });

        const profileVal = map['dine_in_one_profile'] || map['profile'] || {};
        const billingVal = map['billing_defaults'] || map['billing'] || {};
        const subVal = map['subscription_policies'] || map['subscriptions'] || {};
        const retentionVal = map['data_retention'] || map['dataRetention'] || {};

        return NextResponse.json({
            success: true,
            settings: {
                profile: {
                    businessName: profileVal.brand_name || profileVal.businessName || 'Dine in One',
                    legalName: profileVal.company_name || profileVal.legalName || 'Dine in One Technologies Pvt Ltd',
                    founder: profileVal.founder || 'Srinivas Kumar',
                    email: profileVal.support_email || profileVal.email || 'founder@dineinone.com',
                    phone: profileVal.hotline || profileVal.phone || '+91 95158 16084',
                    address: profileVal.headquarters || profileVal.address || 'Hitec City, Hyderabad, Telangana 500081',
                },
                billing: {
                    invoicePrefix: billingVal.invoice_prefix || billingVal.invoicePrefix || 'DIO-2026-',
                    gstRate: billingVal.gst_rate_percent || billingVal.gstRate || 18,
                    hsnCode: billingVal.hsnCode || '998314',
                    currency: billingVal.currency || 'INR',
                },
                subscriptions: {
                    trialDurationDays: subVal.default_trial_days || subVal.trialDurationDays || 14,
                    gracePeriodDays: subVal.grace_period_days || 7,
                    starterMonthly: subVal.starterMonthly || 1499,
                    growthMonthly: subVal.growthMonthly || 3999,
                    enterpriseMonthly: subVal.enterpriseMonthly || 8999,
                },
                dataRetention: {
                    softDeleteRetentionDays: retentionVal.restaurant_deletion_retention_days || retentionVal.softDeleteRetentionDays || 90,
                    auditLogRetentionYears: retentionVal.audit_log_retention_days ? Math.round(retentionVal.audit_log_retention_days / 365) : 7,
                    invoiceRetentionYears: retentionVal.invoiceRetentionYears || 10,
                },
            },
        });
    } catch (err: any) {
        console.error('Super Admin settings error:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const body = await request.json();
        const { key, value } = body;

        if (!key) {
            return NextResponse.json({ error: 'Settings key is required' }, { status: 400 });
        }

        const keyMapping: Record<string, string> = {
            profile: 'dine_in_one_profile',
            billing: 'billing_defaults',
            subscriptions: 'subscription_policies',
            dataRetention: 'data_retention'
        };

        const targetKey = keyMapping[key] || key;

        await supabaseAdmin
            .from('platform_settings')
            .upsert({
                key: targetKey,
                value,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'key' });

        // Also update standard key if mapped
        if (targetKey !== key) {
            await supabaseAdmin
                .from('platform_settings')
                .upsert({
                    key,
                    value,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'key' });
        }

        // Audit log
        await supabaseAdmin.from('audit_logs').insert({
            user_id: auth.user.userId,
            action: `super_admin_update_platform_settings_${key}`,
            details: { key, targetKey, timestamp: new Date().toISOString() },
        });

        return NextResponse.json({ success: true, message: 'Platform settings saved successfully.' });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
