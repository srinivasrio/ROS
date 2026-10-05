import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifySuperAdmin } from '@/lib/superadmin-guard';
import { seedRestaurantDefaults } from '@/lib/restaurant-defaults';
import crypto from 'crypto';

export async function GET(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get('status');
        const search = searchParams.get('search')?.toLowerCase();

        // 1. Query restaurants
        let restQuery = supabaseAdmin
            .from('restaurants')
            .select('*')
            .order('created_at', { ascending: false });

        if (statusFilter && statusFilter !== 'ALL') {
            restQuery = restQuery.ilike('status', statusFilter);
        }

        const { data: restaurants, error: restError } = await restQuery;

        if (restError) {
            console.error('Super Admin fetch restaurants error:', restError);
            return NextResponse.json({ error: restError.message }, { status: 500 });
        }

        const restList = restaurants || [];
        const restIds = restList.map((r) => r.id);

        // 2. Query legal, profile, branches, and employees for counts in parallel
        const [legalRes, profileRes, branchesRes, employeesRes] = await Promise.all([
            supabaseAdmin.from('restaurant_legal').select('*').in('restaurant_ref', restIds),
            supabaseAdmin.from('restaurant_profile').select('*').in('restaurant_id', restIds),
            supabaseAdmin.from('branches').select('id, restaurant_id').is('deleted_at', null).in('restaurant_id', restIds),
            supabaseAdmin.from('employees').select('id, restaurant_id').eq('is_deleted', false).in('restaurant_id', restIds),
        ]);

        const legalMap = new Map();
        (legalRes.data || []).forEach((l) => legalMap.set(l.restaurant_ref, l));

        const profileMap = new Map();
        (profileRes.data || []).forEach((p) => profileMap.set(p.restaurant_id, p));

        // Group branch counts
        const branchCountMap = new Map<string, number>();
        (branchesRes.data || []).forEach((b) => {
            branchCountMap.set(b.restaurant_id, (branchCountMap.get(b.restaurant_id) || 0) + 1);
        });

        // Group employee counts
        const employeeCountMap = new Map<string, number>();
        (employeesRes.data || []).forEach((e) => {
            if (e.restaurant_id) {
                employeeCountMap.set(e.restaurant_id, (employeeCountMap.get(e.restaurant_id) || 0) + 1);
            }
        });

        // 3. Merge data
        let formatted = restList.map((r: any) => {
            const legal = legalMap.get(r.id);
            const profile = profileMap.get(r.id);

            return {
                id: r.id,
                name: r.name,
                ownerName: r.owner_name,
                ownerId: r.owner_id,
                phone: r.phone,
                email: r.email,
                address: r.address,
                status: (r.status || 'PENDING').toUpperCase(),
                subscriptionPlan: r.subscription_plan || null,
                businessType: profile?.business_type || legal?.business_type || 'Restaurant',
                businessConstitution: legal?.business_constitution || null,
                gstNumber: legal?.gst_number || null,
                fssaiNumber: legal?.fssai_number || null,
                panNumber: legal?.pan_number || null,
                shopLicense: legal?.shop_establishment_license || null,
                openingDate: r.opening_date,
                createdAt: r.created_at,
                deletedAt: r.deleted_at,
                slug: profile?.slug,
                branchCount: branchCountMap.get(r.id) || 0,
                employeeCount: employeeCountMap.get(r.id) || 0,
            };
        });

        if (search) {
            formatted = formatted.filter((r: any) =>
                (r.name && r.name.toLowerCase().includes(search)) ||
                (r.id && r.id.toLowerCase().includes(search)) ||
                (r.ownerName && r.ownerName.toLowerCase().includes(search)) ||
                (r.phone && r.phone.includes(search)) ||
                (r.email && r.email.toLowerCase().includes(search))
            );
        }

        return NextResponse.json({ success: true, restaurants: formatted });
    } catch (err: any) {
        console.error('Super admin restaurants API error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const auth = await verifySuperAdmin();
        if (!auth.authorized) {
            return NextResponse.json({ error: auth.error }, { status: 403 });
        }

        const body = await request.json();
        const {
            name,
            legalName,
            ownerName,
            phone,
            email,
            address,
            businessType = 'Restaurant',
            businessConstitution,
            gstNumber,
            fssaiNumber,
            panNumber,
            shopLicense,
            subscriptionPlan = 'growth',
            status = 'ACTIVE',
            // Step 2 Owner fields
            ownerMode = 'new',
            ownerEmail,
            ownerPhone,
            existingOwnerId,
            // Step 3 Branch fields
            branchName = 'Main Central Branch',
            branchCode,
            branchPhone,
            branchEmail,
            branchAddress,
            // Step 4 Subscription fields
            subscriptionType = 'trial',
            startDate,
            endDate,
        } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Restaurant name is required' }, { status: 400 });
        }

        const cleanName = name.trim();
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const slug = cleanName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') + '-' + randomDigits;

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const restaurantId = `REST-${dateStr}-${randomDigits}`;

        // 1. Resolve Owner Account
        let resolvedOwnerId: string | null = null;
        let resolvedOwnerName = ownerName ? ownerName.trim() : 'Owner';
        let resolvedOwnerEmail = (ownerEmail || email || '').toLowerCase().trim();
        let resolvedOwnerPhone = ownerPhone || phone || '';

        if (ownerMode === 'existing' && existingOwnerId) {
            resolvedOwnerId = existingOwnerId;
            // Lookup existing owner name
            const { data: existingUser } = await supabaseAdmin
                .from('dine_users')
                .select('name, email, phone')
                .eq('id', existingOwnerId)
                .maybeSingle();

            if (existingUser) {
                resolvedOwnerName = existingUser.name || resolvedOwnerName;
                resolvedOwnerEmail = existingUser.email || resolvedOwnerEmail;
                resolvedOwnerPhone = existingUser.phone || resolvedOwnerPhone;
            }
        } else {
            // Create New Owner Account with UUID
            resolvedOwnerId = crypto.randomUUID();

            // Insert into dine_users
            await supabaseAdmin.from('dine_users').insert({
                id: resolvedOwnerId,
                name: resolvedOwnerName,
                email: resolvedOwnerEmail,
                phone: resolvedOwnerPhone,
                role: 'OWNER',
                status: 'active',
                restaurant_id: restaurantId,
                created_at: new Date().toISOString(),
            });

            // Insert into employees
            await supabaseAdmin.from('employees').insert({
                id: resolvedOwnerId,
                name: resolvedOwnerName,
                email: resolvedOwnerEmail,
                mobile: resolvedOwnerPhone,
                role: 'owner',
                status: 'active',
                approval_status: 'approved',
                monthly_salary: 0,
                restaurant_id: restaurantId,
                is_deleted: false,
                session_version: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });

            // Insert into auth with temporary activation hash (no plain text passwords)
            const tempActivationSecret = crypto.randomBytes(32).toString('hex');
            await supabaseAdmin.from('auth').insert({
                user_id: resolvedOwnerId,
                password_hash: `activation:${tempActivationSecret}`,
                mfa_enabled: false,
                failed_attempts: 0,
            });
        }

        // 2. Insert into restaurants
        const restRecord = {
            id: restaurantId,
            name: cleanName,
            legal_name: legalName ? legalName.trim() : cleanName,
            owner_name: resolvedOwnerName,
            owner_id: resolvedOwnerId,
            phone: phone ? phone.trim() : '',
            email: email ? email.trim() : '',
            address: address || '',
            status: status ? status.toLowerCase() : 'active',
            subscription_plan: subscriptionPlan || 'growth',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const { error: restError } = await supabaseAdmin
            .from('restaurants')
            .insert(restRecord);

        if (restError) {
            console.error('Super Admin create restaurant error:', restError);
            return NextResponse.json({ error: 'Failed to create restaurant: ' + restError.message }, { status: 500 });
        }

        // 3. Link Owner in restaurant_users
        if (resolvedOwnerId) {
            await supabaseAdmin.from('restaurant_users').upsert({
                restaurant_id: restaurantId,
                user_id: resolvedOwnerId,
                role: 'OWNER',
                status: 'active',
                updated_at: new Date().toISOString(),
            });
        }

        // 4. Insert into restaurant_profile
        await supabaseAdmin
            .from('restaurant_profile')
            .insert({
                restaurant_id: restaurantId,
                name: cleanName,
                business_type: businessType,
                address: address || '',
                phone: phone || '',
                email: email || '',
                slug: slug,
                restaurant_info: {
                    name: cleanName,
                    phone: phone || '',
                    email: email || '',
                    address: address || '',
                },
            });

        // 5. Insert into restaurant_legal
        await supabaseAdmin
            .from('restaurant_legal')
            .insert({
                restaurant_ref: restaurantId,
                business_name: legalName || cleanName,
                business_type: businessType,
                business_constitution: businessConstitution || null,
                gst_number: gstNumber || null,
                fssai_number: fssaiNumber || null,
                pan_number: panNumber || null,
                shop_establishment_license: shopLicense || null,
                status: 'active',
            });

        // 6. Create Initial Branch
        const branchId = branchCode && branchCode.trim()
            ? branchCode.trim()
            : `BR-${restaurantId.slice(-6)}-${randomDigits}`;

        await supabaseAdmin
            .from('branches')
            .insert({
                id: branchId,
                restaurant_id: restaurantId,
                name: branchName ? branchName.trim() : 'Main Branch',
                code: branchId,
                address: branchAddress || address || '',
                phone: branchPhone || phone || '',
                email: branchEmail || email || '',
                is_main_branch: true,
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            });

        // 7. Grant Owner Branch Access
        if (resolvedOwnerId) {
            await supabaseAdmin.from('employee_branch_access').insert({
                employee_id: resolvedOwnerId,
                branch_id: branchId,
                created_at: new Date().toISOString(),
            });
        }

        // 8. Create Subscription Record in Supabase
        const isTrial = subscriptionType === 'trial';
        const trialDays = 14;
        const now = new Date();
        const trialEnd = endDate ? new Date(endDate) : new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

        await supabaseAdmin.from('subscriptions').insert({
            restaurant_id: restaurantId,
            plan_name: subscriptionPlan.toLowerCase(),
            plan_type: isTrial ? 'free_trial' : 'monthly',
            status: isTrial ? 'trialing' : 'active',
            trial_starts_at: isTrial ? now.toISOString() : null,
            trial_ends_at: isTrial ? trialEnd.toISOString() : null,
            current_period_start: !isTrial ? now.toISOString() : null,
            current_period_end: !isTrial ? trialEnd.toISOString() : null,
            amount: subscriptionPlan === 'enterprise' ? 8999 : subscriptionPlan === 'starter' ? 1499 : 3999,
            currency: 'INR',
            max_branches: subscriptionPlan === 'enterprise' ? 99 : subscriptionPlan === 'growth' ? 10 : 3,
            max_employees: subscriptionPlan === 'enterprise' ? 200 : subscriptionPlan === 'growth' ? 50 : 20,
            created_at: now.toISOString(),
            updated_at: now.toISOString(),
        });

        // 9. Seed Default Configuration (Theme, Sections, Services)
        await seedRestaurantDefaults(restaurantId, {
            name: cleanName,
            phone: phone || '',
            email: email || '',
            address: address || '',
            businessType,
            slug,
        });

        // 10. Audit Log
        await supabaseAdmin.from('audit_logs').insert({
            restaurant_id: restaurantId,
            user_id: auth.user.userId,
            action: 'super_admin_create_restaurant',
            details: {
                name: cleanName,
                owner_id: resolvedOwnerId,
                owner_name: resolvedOwnerName,
                branch_id: branchId,
                plan: subscriptionPlan,
                status: restRecord.status,
                timestamp: new Date().toISOString(),
            },
        });

        return NextResponse.json(
            {
                success: true,
                restaurant: {
                    ...restRecord,
                    slug,
                    branchId,
                    ownerId: resolvedOwnerId,
                },
            },
            { status: 201 }
        );
    } catch (err: any) {
        console.error('Super admin create restaurant error:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
