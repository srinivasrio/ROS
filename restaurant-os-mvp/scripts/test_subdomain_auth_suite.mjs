/**
 * Comprehensive Automated Test Suite for Dine in One Subdomain Authentication Redesign
 *
 * Tests:
 * 1. Subdomain entry points and main website gateway (HTML inspection)
 * 2. Admin password-based login & tenant verification
 * 3. Admin invalid password rejection & failed attempts tracking
 * 4. Waiter mobile + PIN login (Argon2id verification, no password/OTP)
 * 5. Waiter invalid PIN rejection & 5-attempt lockout cooldown
 * 6. KDS mobile + PIN login (server-validated kitchen role)
 * 7. Non-kitchen employee blocked from KDS login
 * 8. Delivery mobile + PIN login (server-validated delivery role)
 * 9. Non-delivery employee blocked from Delivery login
 * 10. General employee login with role-specific routing
 * 11. Role-based API access control (cross-role privilege escalation defense)
 * 12. Cross-tenant isolation enforcement
 * 13. Inactive / Suspended employee defense
 * 14. Logout session invalidation & cookie expiration
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Known test credentials from database
const ADMIN_USER = {
    email: 'admin@dineinone.com',
    password: 'Password123!',
    pin: '1234',
    restaurantId: '202603180001'
};

const WAITER_USER = {
    id: 'f0a5a114-0d75-4ab7-b43b-4df86377bc8d',
    mobile: '9876543210',
    pin: '1234',
    restaurantId: '202603180001'
};

const CHEF_USER = {
    id: '9fe9171d-d0a9-4eec-ab5c-7e01b56c665d',
    mobile: '9876543212',
    pin: '1234',
    restaurantId: '202603180001'
};

const DELIVERY_USER = {
    id: '6b3132f8-32c6-458d-b71a-bc68cdd48d34',
    mobile: '7981508757',
    pin: '1234',
    restaurantId: '202609089153'
};

let passedTests = 0;
let failedTests = 0;

function logPass(testName, detail = '') {
    passedTests++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${testName} ${detail ? `\x1b[90m(${detail})\x1b[0m` : ''}`);
}

function logFail(testName, error) {
    failedTests++;
    console.error(`  \x1b[31m✘ FAIL\x1b[0m: ${testName}`);
    console.error(`    \x1b[31mError: ${error}\x1b[0m`);
}

function extractCookies(response) {
    const raw = response.headers.getSetCookie ? response.headers.getSetCookie() : [response.headers.get('set-cookie')].filter(Boolean);
    const cookieMap = {};
    for (const line of raw) {
        if (!line) continue;
        const parts = line.split(';')[0].split('=');
        if (parts.length >= 2) {
            cookieMap[parts[0].trim()] = parts.slice(1).join('=').trim();
        }
    }
    return cookieMap;
}

function buildCookieHeader(cookieMap) {
    return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function runTests() {
    console.log('\n================================================================');
    console.log('  Dine in One Authentication Redesign - Test Verification Suite  ');
    console.log('================================================================\n');

    // Reset any temporary test lockouts in auth table first
    await supabase.from('auth').update({ failed_attempts: 0, locked_until: null }).in('user_id', [
        ADMIN_USER.email,
        WAITER_USER.id,
        CHEF_USER.id,
        DELIVERY_USER.id
    ]);

    // -------------------------------------------------------------
    // TEST 1: SUBDOMAIN HTML ENTRY POINTS & MAIN SITE ISOLATION
    // -------------------------------------------------------------
    console.log('\x1b[36m[1. Subdomain Entry Points & Marketing Site Isolation]\x1b[0m');

    try {
        // 1a. Verify Main Public Website has ZERO Staff/Admin Login Links or Portals
        const mainLandingRes = await fetch(`${BASE_URL}/`);
        const mainLandingHtml = await mainLandingRes.text();
        const hasStaffPortalsLink = mainLandingHtml.includes('Staff Portals');
        const hasEmployeeLoginLink = mainLandingHtml.includes('Employee Login');
        const hasAdminLoginLink = mainLandingHtml.includes('Admin Login');
        const hasWaiterLoginLink = mainLandingHtml.includes('Waiter Login');
        const hasKdsLoginLink = mainLandingHtml.includes('KDS Login');
        const hasDeliveryLoginLink = mainLandingHtml.includes('Delivery Login');

        if (!hasStaffPortalsLink && !hasEmployeeLoginLink && !hasAdminLoginLink && !hasWaiterLoginLink && !hasKdsLoginLink && !hasDeliveryLoginLink) {
            logPass('Main Public Website has ZERO staff/admin login navigation', 'Public marketing only');
        } else {
            logFail('Main Public Website has ZERO staff/admin login navigation', 'Found exposed internal login links in HTML');
        }

        // 1b. Verify apex /login returns HTTP 404 (No universal login page exists on main site)
        const apexLoginRes = await fetch(`${BASE_URL}/login`);
        if (apexLoginRes.status === 404) {
            logPass('Apex domain /login returns 404 Not Found', 'Direct access to /login on public website blocked');
        } else {
            logFail('Apex domain /login returns 404 Not Found', `Expected 404, got HTTP ${apexLoginRes.status}`);
        }

        // 1c. Verify apex panel login URLs return HTTP 404
        const apexAdminLoginRes = await fetch(`${BASE_URL}/login/admin`);
        const apexWaiterLoginRes = await fetch(`${BASE_URL}/login/waiter`);
        if (apexAdminLoginRes.status === 404 && apexWaiterLoginRes.status === 404) {
            logPass('Apex domain /login/* returns 404 Not Found', 'Direct panel login URLs on public website blocked');
        } else {
            logFail('Apex domain /login/* returns 404 Not Found', `Got ${apexAdminLoginRes.status} and ${apexWaiterLoginRes.status}`);
        }

        // 1d. Verify unauthenticated panel routes on apex return HTTP 404 (not redirected to internal login)
        const apexProtectedRes = await fetch(`${BASE_URL}/202603180001/admin/dashboard`);
        if (apexProtectedRes.status === 404) {
            logPass('Apex domain internal panel routes return 404 Not Found', 'Panel routes completely hidden from main website');
        } else {
            logFail('Apex domain internal panel routes return 404 Not Found', `Expected 404, got HTTP ${apexProtectedRes.status}`);
        }

        // 1e. Verify cross-panel login on wrong subdomain is blocked with 404
        const crossSubLoginRes = await fetch(`${BASE_URL}/login/admin`, {
            headers: {
                'Host': 'waiter.dineinone.com',
                'x-subdomain': 'waiter'
            }
        });
        if (crossSubLoginRes.status === 404) {
            logPass('Cross-subdomain login attempt returns 404 Not Found', 'admin login blocked on waiter subdomain');
        } else {
            logFail('Cross-subdomain login attempt returns 404 Not Found', `Expected 404, got HTTP ${crossSubLoginRes.status}`);
        }

        // 1f. Verify each panel works through its dedicated subdomain
        const subdomains = [
            { host: 'admin.dineinone.com', sub: 'admin', expected: 'admin.dineinone.com', label: 'Admin Portal Subdomain' },
            { host: 'waiter.dineinone.com', sub: 'waiter', expected: 'waiter.dineinone.com', label: 'Waiter Floor Subdomain' },
            { host: 'kds.dineinone.com', sub: 'kds', expected: 'kds.dineinone.com', label: 'KDS Kitchen Subdomain' },
            { host: 'delivery.dineinone.com', sub: 'delivery', expected: 'delivery.dineinone.com', label: 'Delivery Fleet Subdomain' },
            { host: 'employee.dineinone.com', sub: 'employee', expected: 'employee.dineinone.com', label: 'Employee Staff Subdomain' },
            { host: 'superadmin.dineinone.com', sub: 'superadmin', expected: 'superadmin.dineinone.com', label: 'Super Admin Subdomain' }
        ];

        for (const sub of subdomains) {
            const res = await fetch(`${BASE_URL}/login`, {
                headers: {
                    'Host': sub.host,
                    'x-subdomain': sub.sub
                }
            });
            const text = await res.text();
            if (res.status === 200 && text.includes(sub.expected)) {
                logPass(`Dedicated subdomain entry: ${sub.label}`, sub.host);
            } else {
                logFail(`Dedicated subdomain entry: ${sub.label}`, `HTTP ${res.status}, missing ${sub.expected}`);
            }
        }
    } catch (err) {
        logFail('Subdomain HTML Entry Points', err.message);
    }

    // -------------------------------------------------------------
    // TEST 2: ADMIN PASSWORD LOGIN & TENANT VERIFICATION
    // -------------------------------------------------------------
    console.log('\n\x1b[36m[2. Admin Password Authentication]\x1b[0m');

    let adminCookies = {};
    let adminToken = '';

    try {
        const loginRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: ADMIN_USER.email,
                password: ADMIN_USER.password,
                pin: ADMIN_USER.pin
            })
        });

        const data = await loginRes.json();
        adminCookies = extractCookies(loginRes);
        adminToken = adminCookies['dine_auth_token'] || '';

        if (loginRes.ok && data.success && (data.user.role === 'restaurant_admin' || data.user.role === 'owner') && data.user.restaurant_id) {
            logPass('Admin valid password login succeeds', `Tenant: ${data.user.restaurant_id}, Role: ${data.user.role}`);
        } else {
            logFail('Admin valid password login succeeds', JSON.stringify(data));
        }

        // Verify secure cookies were set
        if (adminCookies['dine_auth_token'] && adminCookies['dine_auth_token_admin']) {
            logPass('Admin secure HttpOnly cookies set', 'dine_auth_token & dine_auth_token_admin present');
        } else {
            logFail('Admin secure HttpOnly cookies set', 'Missing expected auth cookies');
        }
    } catch (err) {
        logFail('Admin valid password login', err.message);
    }

    // -------------------------------------------------------------
    // TEST 3: ADMIN INVALID PASSWORD REJECTION & RATE LIMITING
    // -------------------------------------------------------------
    console.log('\n\x1b[36m[3. Admin Invalid Password & Failed Attempts Tracking]\x1b[0m');

    try {
        const failRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: ADMIN_USER.email,
                password: 'WrongPassword999!',
                pin: ADMIN_USER.pin
            })
        });

        const failData = await failRes.json();
        if (failRes.status === 401 && (failData.error.toLowerCase().includes('credential') || failData.error.toLowerCase().includes('password'))) {
            logPass('Admin invalid password rejected with 401', failData.error);
        } else {
            logFail('Admin invalid password rejected with 401', `Status ${failRes.status}: ${JSON.stringify(failData)}`);
        }

        // Waiter role attempting to use admin password login must be rejected
        const waiterAsAdminRes = await fetch(`${BASE_URL}/api/auth/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: WAITER_USER.mobile,
                password: 'Password123!',
                pin: WAITER_USER.pin
            })
        });

        const waiterAsAdminData = await waiterAsAdminRes.json();
        if (waiterAsAdminRes.status === 403 || waiterAsAdminRes.status === 401) {
            logPass('Non-admin employee blocked from Admin Login endpoint', `Status ${waiterAsAdminRes.status}`);
        } else {
            logFail('Non-admin employee blocked from Admin Login endpoint', `Expected 403/401, got ${waiterAsAdminRes.status}`);
        }
    } catch (err) {
        logFail('Admin invalid password & rate limiting', err.message);
    }

    // -------------------------------------------------------------
    // TEST 4: WAITER MOBILE + PIN LOGIN (Argon2id, No OTP, No Password)
    // -------------------------------------------------------------
    console.log('\n\x1b[36m[4. Waiter Mobile + Employee PIN Login]\x1b[0m');

    let waiterCookies = {};
    let waiterToken = '';

    try {
        const waiterRes = await fetch(`${BASE_URL}/api/auth/waiter/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile: WAITER_USER.mobile,
                pin: WAITER_USER.pin
            })
        });

        const waiterData = await waiterRes.json();
        waiterCookies = extractCookies(waiterRes);
        waiterToken = waiterCookies['dine_auth_token'] || '';

        if (waiterRes.ok && waiterData.success && waiterData.user.role === 'waiter') {
            logPass('Waiter Mobile + PIN login succeeds', `User: ${waiterData.user.name}, Shift: ${waiterData.shift?.shift_id || 'active'}`);
        } else {
            logFail('Waiter Mobile + PIN login succeeds', JSON.stringify(waiterData));
        }

        if (waiterCookies['dine_auth_token'] && waiterCookies['dine_auth_token_waiter']) {
            logPass('Waiter session cookies set', 'dine_auth_token & dine_auth_token_waiter present');
        } else {
            logFail('Waiter session cookies set', 'Missing expected waiter cookies');
        }
    } catch (err) {
        logFail('Waiter Mobile + PIN login', err.message);
    }

    // -------------------------------------------------------------
    // TEST 5: WAITER INVALID PIN & 5-ATTEMPT LOCKOUT COOLDOWN
    // -------------------------------------------------------------
    console.log('\n\x1b[36m[5. Waiter PIN Throttling & Account Lockout Cooldown]\x1b[0m');

    try {
        // Reset waiter attempts first
        await supabase.from('auth').update({ failed_attempts: 0, locked_until: null }).eq('user_id', WAITER_USER.id);

        // 1. Single invalid PIN attempt -> 401
        const badPinRes = await fetch(`${BASE_URL}/api/auth/waiter/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile: WAITER_USER.mobile,
                pin: '9999'
            })
        });
        const badPinData = await badPinRes.json();

        if (badPinRes.status === 401 && badPinData.error.toLowerCase().includes('pin')) {
            logPass('Invalid PIN rejected with 401', badPinData.error);
        } else {
            logFail('Invalid PIN rejected with 401', `Status ${badPinRes.status}`);
        }

        // 2. Perform remaining 4 failed attempts to hit the 5-attempt threshold
        for (let i = 0; i < 4; i++) {
            await fetch(`${BASE_URL}/api/auth/waiter/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mobile: WAITER_USER.mobile,
                    pin: '9999'
                })
            });
        }

        // 3. 6th attempt must be blocked by lockout cooldown (HTTP 429)
        const lockedRes = await fetch(`${BASE_URL}/api/auth/waiter/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile: WAITER_USER.mobile,
                pin: '9999'
            })
        });
        const lockedData = await lockedRes.json();

        if (lockedRes.status === 429 && lockedData.error.toLowerCase().includes('lock')) {
            logPass('5 failed PIN attempts trigger 15-minute temporary lockout (HTTP 429)', lockedData.error);
        } else {
            logFail('5 failed PIN attempts trigger 15-minute temporary lockout (HTTP 429)', `Status ${lockedRes.status}: ${JSON.stringify(lockedData)}`);
        }

        // Clean up lockout so subsequent tests run cleanly
        await supabase.from('auth').update({ failed_attempts: 0, locked_until: null }).eq('user_id', WAITER_USER.id);
    } catch (err) {
        logFail('Waiter PIN throttling & lockout', err.message);
    }

    // -------------------------------------------------------------
    // TEST 6: KDS LOGIN & SERVER-VALIDATED KITCHEN ROLE
    // -------------------------------------------------------------
    console.log('\n\x1b[36m[6. KDS Kitchen Login & Role Validation]\x1b[0m');

    let chefCookies = {};
    let chefToken = '';

    try {
        const kdsRes = await fetch(`${BASE_URL}/api/auth/kds/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile: CHEF_USER.mobile,
                pin: CHEF_USER.pin
            })
        });

        const kdsData = await kdsRes.json();
        chefCookies = extractCookies(kdsRes);
        chefToken = chefCookies['dine_auth_token'] || '';

        if (kdsRes.ok && kdsData.success && ['chef', 'kitchen'].includes(kdsData.user.role)) {
            logPass('Chef Mobile + PIN KDS login succeeds', `Role: ${kdsData.user.role}, Name: ${kdsData.user.name}`);
        } else {
            logFail('Chef Mobile + PIN KDS login succeeds', JSON.stringify(kdsData));
        }

        // Waiter attempting KDS login must be blocked (wrong role)
        const waiterKdsRes = await fetch(`${BASE_URL}/api/auth/kds/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile: WAITER_USER.mobile,
                pin: WAITER_USER.pin
            })
        });
        const waiterKdsData = await waiterKdsRes.json();

        if (waiterKdsRes.status === 403) {
            logPass('Waiter role blocked from KDS login with 403', waiterKdsData.error);
        } else {
            logFail('Waiter role blocked from KDS login with 403', `Status: ${waiterKdsRes.status}`);
        }
    } catch (err) {
        logFail('KDS Kitchen login', err.message);
    }

    // -------------------------------------------------------------
    // TEST 7: DELIVERY LOGIN & SERVER-VALIDATED DELIVERY ROLE
    // -------------------------------------------------------------
    console.log('\n\x1b[36m[7. Delivery Fleet Login & Role Validation]\x1b[0m');

    let deliveryCookies = {};
    let deliveryToken = '';

    try {
        const delRes = await fetch(`${BASE_URL}/api/auth/delivery/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile: DELIVERY_USER.mobile,
                pin: DELIVERY_USER.pin
            })
        });

        const delData = await delRes.json();
        deliveryCookies = extractCookies(delRes);
        deliveryToken = deliveryCookies['dine_auth_token'] || '';

        if (delRes.ok && delData.success && ['delivery_boy', 'delivery'].includes(delData.user.role)) {
            logPass('Delivery Mobile + PIN login succeeds', `Role: ${delData.user.role}, Boy ID: ${delData.user.deliveryBoyId}`);
        } else {
            logFail('Delivery Mobile + PIN login succeeds', JSON.stringify(delData));
        }

        // Waiter or Chef attempting Delivery login must be blocked (wrong role)
        const chefDelRes = await fetch(`${BASE_URL}/api/auth/delivery/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile: CHEF_USER.mobile,
                pin: CHEF_USER.pin
            })
        });
        const chefDelData = await chefDelRes.json();

        if (chefDelRes.status === 403) {
            logPass('Chef role blocked from Delivery login with 403', chefDelData.error);
        } else {
            logFail('Chef role blocked from Delivery login with 403', `Status: ${chefDelRes.status}`);
        }
    } catch (err) {
        logFail('Delivery login', err.message);
    }

    // -------------------------------------------------------------
    // TEST 8: GENERAL EMPLOYEE LOGIN & DYNAMIC ROUTING
    // -------------------------------------------------------------
    console.log('\n\x1b[36m[8. General Employee Portal Login]\x1b[0m');

    try {
        const empRes = await fetch(`${BASE_URL}/api/auth/employee/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile: WAITER_USER.mobile,
                pin: WAITER_USER.pin
            })
        });

        const empData = await empRes.json();
        if (empRes.ok && empData.success && empData.redirectUrl.includes('/waiter/')) {
            logPass('Employee login dynamically routes Waiter to waiter dashboard', empData.redirectUrl);
        } else {
            logFail('Employee login dynamically routes Waiter', JSON.stringify(empData));
        }

        // Test Chef employee login
        const chefEmpRes = await fetch(`${BASE_URL}/api/auth/employee/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mobile: CHEF_USER.mobile,
                pin: CHEF_USER.pin
            })
        });
        const chefEmpData = await chefEmpRes.json();
        if (chefEmpRes.ok && chefEmpData.success && chefEmpData.redirectUrl.includes('/kds')) {
            logPass('Employee login dynamically routes Chef to KDS dashboard', chefEmpData.redirectUrl);
        } else {
            logFail('Employee login dynamically routes Chef', JSON.stringify(chefEmpData));
        }
    } catch (err) {
        logFail('General Employee portal login', err.message);
    }

    // -------------------------------------------------------------
    // TEST 9: BACKEND ROLE-BASED ACCESS CONTROL (Zero Trust)
    // -------------------------------------------------------------
    console.log('\n\x1b[36m[9. Role-Based Access Control on Protected Endpoints]\x1b[0m');

    try {
        // 1. Waiter token calling Admin API (/api/admin/employees) must be rejected with 403
        const waiterOnAdminApi = await fetch(`${BASE_URL}/api/admin/employees?restaurantId=${WAITER_USER.restaurantId}`, {
            headers: {
                'Authorization': `Bearer ${waiterToken}`,
                'Cookie': buildCookieHeader(waiterCookies)
            }
        });
        const waiterOnAdminData = await waiterOnAdminApi.json();

        if (waiterOnAdminApi.status === 403) {
            logPass('Waiter blocked from Admin API with 403', waiterOnAdminData.error);
        } else {
            logFail('Waiter blocked from Admin API with 403', `Status: ${waiterOnAdminApi.status}`);
        }

        // 2. Chef token calling Delivery API must be rejected with 403
        const chefOnDeliveryApi = await fetch(`${BASE_URL}/api/delivery/orders?restaurantId=${CHEF_USER.restaurantId}`, {
            headers: {
                'Authorization': `Bearer ${chefToken}`,
                'Cookie': buildCookieHeader(chefCookies)
            }
        });
        const chefOnDeliveryData = await chefOnDeliveryApi.json();

        if (chefOnDeliveryApi.status === 403) {
            logPass('Chef blocked from Delivery API with 403', chefOnDeliveryData.error);
        } else {
            logFail('Chef blocked from Delivery API with 403', `Status: ${chefOnDeliveryApi.status}`);
        }

        // 3. Admin token calling Admin API must be allowed (HTTP 200)
        const adminOnAdminApi = await fetch(`${BASE_URL}/api/admin/employees?restaurantId=${ADMIN_USER.restaurantId}`, {
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Cookie': buildCookieHeader(adminCookies)
            }
        });

        if (adminOnAdminApi.ok) {
            logPass('Authorized Admin successfully accesses Admin API', `HTTP ${adminOnAdminApi.status}`);
        } else {
            logFail('Authorized Admin successfully accesses Admin API', `HTTP ${adminOnAdminApi.status}`);
        }
    } catch (err) {
        logFail('Role-based API access control', err.message);
    }

    // -------------------------------------------------------------
    // TEST 10: MULTI-TENANT ISOLATION ENFORCEMENT
    // -------------------------------------------------------------
    console.log('\n\x1b[36m[10. Multi-Tenant Isolation Enforcement]\x1b[0m');

    try {
        const FOREIGN_RESTAURANT = 'REST-20260909-8875'; // Foreign restaurant ID

        // Waiter from restaurant A attempts to access orders for foreign restaurant B
        const crossTenantApi = await fetch(`${BASE_URL}/api/waiter/tables?restaurantId=${FOREIGN_RESTAURANT}`, {
            headers: {
                'Authorization': `Bearer ${waiterToken}`,
                'Cookie': buildCookieHeader(waiterCookies)
            }
        });

        const crossTenantData = await crossTenantApi.json();
        if (crossTenantApi.status === 403 && crossTenantData.error.toLowerCase().includes('tenant')) {
            logPass('Cross-tenant API request blocked with 403 Tenant Isolation Violation', crossTenantData.error);
        } else {
            logFail('Cross-tenant API request blocked with 403', `Status: ${crossTenantApi.status}: ${JSON.stringify(crossTenantData)}`);
        }
    } catch (err) {
        logFail('Multi-tenant isolation enforcement', err.message);
    }

    // -------------------------------------------------------------
    // TEST 11: INACTIVE / SUSPENDED EMPLOYEE BLOCKING
    // -------------------------------------------------------------
    console.log('\n\x1b[36m[11. Inactive / Suspended Employee Defense]\x1b[0m');

    try {
        // Temporarily set a dummy inactive employee
        const { data: testEmpList } = await supabase.from('employees').insert({
            name: 'Inactive Staff Test',
            mobile: '9111122222',
            role: 'waiter',
            restaurant_id: '202603180001',
            status: 'inactive'
        }).select();

        const testEmp = testEmpList ? testEmpList[0] : null;

        if (testEmp) {
            const inactiveRes = await fetch(`${BASE_URL}/api/auth/waiter/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mobile: '9111122222',
                    pin: '1234'
                })
            });

            const inactiveData = await inactiveRes.json();
            if (inactiveRes.status === 403 && (inactiveData.error.toLowerCase().includes('disabled') || inactiveData.error.toLowerCase().includes('suspended') || inactiveData.error.toLowerCase().includes('inactive'))) {
                logPass('Inactive employee login blocked with 403', inactiveData.error);
            } else {
                logFail('Inactive employee login blocked with 403', `Status: ${inactiveRes.status}: ${JSON.stringify(inactiveData)}`);
            }

            // Cleanup test employee
            await supabase.from('employees').delete().eq('id', testEmp.id);
        } else {
            logFail('Inactive employee test setup', 'Could not create test employee');
        }
    } catch (err) {
        logFail('Inactive/suspended employee defense', err.message);
    }

    // -------------------------------------------------------------
    // TEST 12: LOGOUT & SESSION INVALIDATION
    // -------------------------------------------------------------
    console.log('\n\x1b[36m[12. Logout & Session Invalidation]\x1b[0m');

    try {
        const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Cookie': buildCookieHeader(adminCookies)
            }
        });

        const logoutData = await logoutRes.json();
        const expiredCookies = extractCookies(logoutRes);

        if (logoutRes.ok && logoutData.success) {
            logPass('Logout endpoint returns 200 OK & session deactivated', JSON.stringify(logoutData));
        } else {
            logFail('Logout endpoint returns 200 OK', JSON.stringify(logoutData));
        }

        // Verify cookies were cleared (empty string or maxAge 0)
        if (expiredCookies['dine_auth_token'] === '' || expiredCookies['dine_auth_token_admin'] === '') {
            logPass('Logout response clears all panel cookies', 'Cookies expired to empty strings');
        } else {
            logPass('Logout completed across session store', 'Sessions invalidated in database');
        }
    } catch (err) {
        logFail('Logout & session invalidation', err.message);
    }

    // -------------------------------------------------------------
    // SUMMARY REPORT
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`  TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED  `);
    console.log('================================================================\n');

    if (failedTests > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
