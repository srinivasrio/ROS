const JWT_SECRET = process.env.JWT_SECRET || 'dine-in-one-jwt-secret-key-at-least-32-chars-2026';

function base64UrlEncode(str: string): string {
    const base64 = btoa(str);
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return atob(base64);
}

/**
 * Signs a payload into a JWT token using HS256 (HMAC SHA-256).
 */
export async function signJwt(payload: any, expiresInSeconds: number = 3600 * 8): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const jwtPayload = { ...payload, exp };
    
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
    
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(JWT_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );
    
    const signatureArray = Array.from(new Uint8Array(signature));
    const signatureStr = signatureArray.map(b => String.fromCharCode(b)).join('');
    const encodedSignature = base64UrlEncode(signatureStr);
    
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies and decodes a JWT token. Returns the decoded payload or null if invalid/expired.
 */
export async function verifyJwt(token: string): Promise<any | null> {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const [encodedHeader, encodedPayload, encodedSignature] = parts;
        
        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(JWT_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );
        
        const sigStr = base64UrlDecode(encodedSignature);
        const sigBytes = new Uint8Array(sigStr.split('').map(c => c.charCodeAt(0)));
        
        const valid = await crypto.subtle.verify(
            'HMAC',
            key,
            sigBytes,
            new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
        );
        
        if (!valid) return null;
        
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        
        // Expiry check
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            console.log('JWT Token expired');
            return null;
        }
        
        return payload;
    } catch (error) {
        console.error('JWT verification failed:', error);
        return null;
    }
}

/**
 * Returns a safe cookie name for a restaurant-scoped auth token.
 */
export function getRestaurantTokenName(restaurantId: string): string {
    const clean = String(restaurantId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `dine_auth_token_${clean}`;
}

/**
 * Returns a safe cookie name for a restaurant-scoped customer auth token.
 */
export function getCustomerTokenName(restaurantId: string): string {
    const clean = String(restaurantId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return `dine_customer_token_${clean}`;
}

/**
 * Extracts the customer auth token for a given restaurant from a cookies object or header.
 */
export function extractCustomerTokenForRestaurant(
    cookiesObj: { get: (name: string) => { value: string } | undefined; getAll?: () => Array<{ name: string; value: string }> },
    restaurantId?: string | null
): string | null {
    if (!cookiesObj) return null;
    if (restaurantId) {
        const clean = String(restaurantId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const scoped = cookiesObj.get(`dine_customer_token_${clean}`)?.value ||
                       cookiesObj.get(`dine_customer_token_${clean.toLowerCase()}`)?.value;
        if (scoped) return scoped;
    }
    return cookiesObj.get('dine_customer_token')?.value || null;
}

export const ADMIN_ROLES = ['restaurant_admin', 'admin', 'owner', 'restaurant_owner', 'manager', 'super_admin', 'superadmin'];

function safeDecodePayload(token: string): any | null {
    try {
        const parts = token.split('.');
        if (parts.length === 3) {
            return JSON.parse(base64UrlDecode(parts[1]));
        }
    } catch (_) {}
    return null;
}

/**
 * Extracts the appropriate auth token for a given restaurant from a cookies object
 * (supports NextRequest.cookies or cookies() from next/headers).
 * Checks restaurant-scoped cookies first, then scans other dine_auth_token_* cookies,
 * and finally falls back to the default dine_auth_token cookie.
 * Supports targetPanel to avoid cross-role cookie collisions (e.g. waiter vs admin in multi-tab).
 */
export function extractTokenForRestaurant(
    cookiesObj: { get: (name: string) => { value: string } | undefined; getAll?: () => Array<{ name: string; value: string }> },
    targetRestaurantCode?: string | null,
    targetStaffIdentifier?: string | null,
    targetPanel?: string | null
): string | null {
    if (!cookiesObj) return null;

    const normalizedPanel = (targetPanel || '').toLowerCase().trim();
    const isAdminPanel = normalizedPanel === 'admin';
    const isWaiterPanel = normalizedPanel === 'waiter';
    const isDeliveryPanel = normalizedPanel === 'delivery';

    // 1. Dedicated role/panel scoped cookies (highest priority to avoid collision)
    if (targetRestaurantCode) {
        const cleanRid = String(targetRestaurantCode).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        
        if (isAdminPanel) {
            const adminScoped = cookiesObj.get(`dine_auth_token_${cleanRid}_admin`)?.value
                || cookiesObj.get(`dine_auth_token_${cleanRid.toLowerCase()}_admin`)?.value
                || cookiesObj.get(`dine_auth_token_admin`)?.value;
            if (adminScoped) return adminScoped;
        }

        if (isDeliveryPanel) {
            if (targetStaffIdentifier) {
                const fullStaff = targetStaffIdentifier.replace(/[^0-9a-zA-Z_-]/g, '_');
                const cleanStaff = targetStaffIdentifier.replace(/[^0-9a-zA-Z_-]/g, '').slice(-10);
                const staffRidToken = cookiesObj.get(`dine_auth_token_${cleanRid}_${fullStaff}`)?.value
                    || cookiesObj.get(`dine_auth_token_${cleanRid}_${targetStaffIdentifier}`)?.value
                    || (cleanStaff.length >= 10 ? cookiesObj.get(`dine_auth_token_${cleanRid}_${cleanStaff}`)?.value : null)
                    || cookiesObj.get(`dine_auth_token_staff_${fullStaff}`)?.value
                    || cookiesObj.get(`dine_auth_token_staff_${targetStaffIdentifier}`)?.value
                    || (cleanStaff.length >= 10 ? cookiesObj.get(`dine_auth_token_staff_${cleanStaff}`)?.value : null);
                if (staffRidToken) return staffRidToken;
            }
            const deliveryScoped = cookiesObj.get(`dine_auth_token_${cleanRid}_delivery`)?.value || cookiesObj.get(`dine_auth_token_delivery`)?.value;
            if (deliveryScoped) return deliveryScoped;
        }

        if (isWaiterPanel) {
            if (targetStaffIdentifier) {
                const cleanStaff = targetStaffIdentifier.replace(/[^0-9a-zA-Z_-]/g, '').slice(-10);
                const staffRidToken = cookiesObj.get(`dine_auth_token_${cleanRid}_${cleanStaff}`)?.value;
                if (staffRidToken) return staffRidToken;
                const staffToken = cookiesObj.get(`dine_auth_token_staff_${cleanStaff}`)?.value;
                if (staffToken) return staffToken;
            }
            const waiterScoped = cookiesObj.get(`dine_auth_token_${cleanRid}_waiter`)?.value || cookiesObj.get(`dine_auth_token_waiter`)?.value;
            if (waiterScoped) return waiterScoped;
        }
    }

    // 2. If staff identifier is provided, check staff-scoped cookies
    if (targetStaffIdentifier) {
        const fullStaff = targetStaffIdentifier.replace(/[^0-9a-zA-Z_-]/g, '_');
        const cleanStaff = targetStaffIdentifier.replace(/[^0-9a-zA-Z_-]/g, '').slice(-10);
        if (targetRestaurantCode) {
            const cleanRid = String(targetRestaurantCode).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
            const staffRidToken = cookiesObj.get(`dine_auth_token_${cleanRid}_${fullStaff}`)?.value
                || cookiesObj.get(`dine_auth_token_${cleanRid}_${targetStaffIdentifier}`)?.value
                || (cleanStaff.length >= 10 ? cookiesObj.get(`dine_auth_token_${cleanRid}_${cleanStaff}`)?.value : null);
            if (staffRidToken) return staffRidToken;
        }
        const staffToken = cookiesObj.get(`dine_auth_token_staff_${fullStaff}`)?.value
            || cookiesObj.get(`dine_auth_token_staff_${targetStaffIdentifier}`)?.value
            || (cleanStaff.length >= 10 ? cookiesObj.get(`dine_auth_token_staff_${cleanStaff}`)?.value : null);
        if (staffToken) return staffToken;
    }

    if (targetRestaurantCode) {
        const clean = String(targetRestaurantCode).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const scoped = cookiesObj.get(`dine_auth_token_${clean}`)?.value;

        // If scoped exists, check if targetStaffIdentifier was given:
        if (scoped && targetStaffIdentifier) {
            const payload = safeDecodePayload(scoped);
            if (payload) {
                const cleanStaff = targetStaffIdentifier.replace(/[^0-9a-zA-Z_-]/g, '').slice(-10);
                const pMobile = (payload.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                const pEmp = (payload.employee_id || payload.employeeId || '').toLowerCase();
                const pDeliveryBoyId = (payload.deliveryBoyId || '').toLowerCase();
                const pUserId = (payload.userId || '').toLowerCase();
                const targetLower = targetStaffIdentifier.toLowerCase();
                if ((cleanStaff.length >= 10 && pMobile === cleanStaff) || 
                    pEmp === targetLower || 
                    pDeliveryBoyId === targetLower || 
                    pUserId === targetLower) {
                    return scoped;
                }
            }
        } else if (scoped && !targetStaffIdentifier) {
            const payload = safeDecodePayload(scoped);
            const roleLower = String(payload?.role || '').toLowerCase();
            if (isAdminPanel) {
                if (payload && ADMIN_ROLES.includes(roleLower)) {
                    return scoped;
                }
            } else if (isDeliveryPanel) {
                if (payload && (roleLower === 'delivery_boy' || ADMIN_ROLES.includes(roleLower))) {
                    return scoped;
                }
            } else if (isWaiterPanel) {
                if (payload && ['waiter', 'supervisor', ...ADMIN_ROLES].includes(roleLower)) {
                    return scoped;
                }
            } else {
                return scoped;
            }
        }

        const lower = clean.toLowerCase();
        if (lower !== clean && !targetStaffIdentifier) {
            const scopedLower = cookiesObj.get(`dine_auth_token_${lower}`)?.value;
            if (scopedLower) {
                const payload = safeDecodePayload(scopedLower);
                const roleLower = String(payload?.role || '').toLowerCase();
                if (isAdminPanel) {
                    if (payload && ADMIN_ROLES.includes(roleLower)) {
                        return scopedLower;
                    }
                } else if (isDeliveryPanel) {
                    if (payload && (roleLower === 'delivery_boy' || ADMIN_ROLES.includes(roleLower))) {
                        return scopedLower;
                    }
                } else if (isWaiterPanel) {
                    if (payload && ['waiter', 'supervisor', ...ADMIN_ROLES].includes(roleLower)) {
                        return scopedLower;
                    }
                } else {
                    return scopedLower;
                }
            }
        }

        // Check all cookies for matching restaurantId AND panel/role
        if (cookiesObj.getAll) {
            try {
                const all = cookiesObj.getAll();
                
                // First pass: match BOTH restaurant AND staff
                if (targetStaffIdentifier) {
                    const cleanStaff = targetStaffIdentifier.replace(/[^0-9a-zA-Z_-]/g, '').slice(-10);
                    const targetLower = targetStaffIdentifier.toLowerCase();
                    for (const c of all) {
                        if (c.name.startsWith('dine_auth_token') && c.value) {
                            const payload = safeDecodePayload(c.value);
                            if (payload) {
                                const pRid = payload.restaurantId || payload.restaurant_id;
                                const pMobile = (payload.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                                const pEmp = (payload.employee_id || payload.employeeId || '').toLowerCase();
                                const pDeliveryBoyId = (payload.deliveryBoyId || '').toLowerCase();
                                const pUserId = (payload.userId || '').toLowerCase();
                                const ridMatch = !pRid || pRid === targetRestaurantCode || String(pRid).toLowerCase() === targetRestaurantCode.toLowerCase();
                                const staffMatch = (cleanStaff.length >= 10 && pMobile === cleanStaff) || 
                                                   pEmp === targetLower || 
                                                   pDeliveryBoyId === targetLower || 
                                                   pUserId === targetLower;
                                if (ridMatch && staffMatch) {
                                    return c.value;
                                }
                            }
                        }
                    }
                }

                // If Delivery panel, search for cookies holding delivery_boy role
                if (isDeliveryPanel) {
                    const sorted = [...all].sort((a, b) => (b.name.includes('_delivery') ? 1 : 0) - (a.name.includes('_delivery') ? 1 : 0));
                    for (const c of sorted) {
                        if (c.name.startsWith('dine_auth_token') && c.value) {
                            const payload = safeDecodePayload(c.value);
                            if (payload) {
                                const roleLower = String(payload.role || '').toLowerCase();
                                if (roleLower === 'delivery_boy' || ADMIN_ROLES.includes(roleLower)) {
                                    const pRid = payload.restaurantId || payload.restaurant_id;
                                    const ridMatch = !pRid || pRid === targetRestaurantCode || String(pRid).toLowerCase() === targetRestaurantCode.toLowerCase();
                                    if (ridMatch) {
                                        return c.value;
                                    }
                                }
                            }
                        }
                    }
                }

                // If Admin panel, specifically search for cookies holding an Admin role
                if (isAdminPanel) {
                    for (const c of all) {
                        if (c.name.startsWith('dine_auth_token') && c.value) {
                            const payload = safeDecodePayload(c.value);
                            if (payload) {
                                const roleLower = String(payload.role || '').toLowerCase();
                                if (ADMIN_ROLES.includes(roleLower)) {
                                    const pRid = payload.restaurantId || payload.restaurant_id;
                                    const ridMatch = !pRid || pRid === targetRestaurantCode || String(pRid).toLowerCase() === targetRestaurantCode.toLowerCase();
                                    if (ridMatch) {
                                        return c.value;
                                    }
                                }
                            }
                        }
                    }
                }

                // Second pass: match restaurant only
                for (const c of all) {
                    if (c.name.startsWith('dine_auth_token_') && c.value) {
                        const payload = safeDecodePayload(c.value);
                        if (payload) {
                            const pRid = payload.restaurantId || payload.restaurant_id;
                            if (pRid && (pRid === targetRestaurantCode || String(pRid).toLowerCase() === targetRestaurantCode.toLowerCase())) {
                                const roleLower = String(payload.role || '').toLowerCase();
                                if (isAdminPanel) {
                                    if (ADMIN_ROLES.includes(roleLower)) {
                                        return c.value;
                                    }
                                } else if (isDeliveryPanel) {
                                    if (roleLower === 'delivery_boy' || ADMIN_ROLES.includes(roleLower)) {
                                        return c.value;
                                    }
                                } else if (isWaiterPanel) {
                                    if (['waiter', 'supervisor', ...ADMIN_ROLES].includes(roleLower)) {
                                        return c.value;
                                    }
                                } else {
                                    return c.value;
                                }
                            }
                        }
                    }
                }
            } catch (_) {}
        }

        // If scoped was found earlier and role matches, return it
        if (scoped) {
            const payload = safeDecodePayload(scoped);
            const roleLower = String(payload?.role || '').toLowerCase();
            if (isDeliveryPanel) {
                if (payload && (roleLower === 'delivery_boy' || ADMIN_ROLES.includes(roleLower))) {
                    return scoped;
                }
            } else if (isAdminPanel) {
                if (payload && ADMIN_ROLES.includes(roleLower)) {
                    return scoped;
                }
            } else if (isWaiterPanel) {
                if (payload && ['waiter', 'supervisor', ...ADMIN_ROLES].includes(roleLower)) {
                    return scoped;
                }
            } else {
                return scoped;
            }
        }

        // Fall back to defaultToken ONLY if it matches the panel requirement
        const defaultToken = cookiesObj.get('dine_auth_token')?.value;
        if (defaultToken) {
            const payload = safeDecodePayload(defaultToken);
            const roleLower = String(payload?.role || '').toLowerCase();
            if (isDeliveryPanel) {
                if (payload && (roleLower === 'delivery_boy' || ADMIN_ROLES.includes(roleLower))) {
                    return defaultToken;
                }
            } else if (isAdminPanel) {
                if (payload && ADMIN_ROLES.includes(roleLower)) {
                    return defaultToken;
                }
            } else if (isWaiterPanel) {
                if (payload && ['waiter', 'supervisor', ...ADMIN_ROLES].includes(roleLower)) {
                    return defaultToken;
                }
            } else {
                return defaultToken;
            }
        }

        // Dedicated panel-scoped fallback when restaurantId was provided but no scoped token matched
        if (isDeliveryPanel) {
            const deliveryDefault = cookiesObj.get('dine_auth_token_delivery')?.value;
            if (deliveryDefault) return deliveryDefault;
            if (cookiesObj.getAll) {
                try {
                    const all = cookiesObj.getAll();
                    const sorted = [...all].sort((a, b) => (b.name.includes('_delivery') ? 1 : 0) - (a.name.includes('_delivery') ? 1 : 0));
                    for (const c of sorted) {
                        if (c.name.startsWith('dine_auth_token') && c.value) {
                            const payload = safeDecodePayload(c.value);
                            if (payload && (String(payload.role || '').toLowerCase() === 'delivery_boy' || ADMIN_ROLES.includes(String(payload.role || '').toLowerCase()))) {
                                return c.value;
                            }
                        }
                    }
                } catch (_) {}
            }
        } else if (isAdminPanel) {
            const adminDefault = cookiesObj.get('dine_auth_token_admin')?.value;
            if (adminDefault) return adminDefault;
        } else if (isWaiterPanel) {
            const waiterDefault = cookiesObj.get('dine_auth_token_waiter')?.value;
            if (waiterDefault) return waiterDefault;
        }

        return null;
    }

    // Default fallback when NO specific restaurant was targeted (e.g. root or un-scoped route)
    if (isAdminPanel) {
        const adminDefault = cookiesObj.get('dine_auth_token_admin')?.value;
        if (adminDefault) return adminDefault;
        if (cookiesObj.getAll) {
            try {
                const all = cookiesObj.getAll();
                for (const c of all) {
                    if (c.name.startsWith('dine_auth_token') && c.value) {
                        const payload = safeDecodePayload(c.value);
                        if (payload && ADMIN_ROLES.includes(String(payload.role || '').toLowerCase())) {
                            return c.value;
                        }
                    }
                }
            } catch (_) {}
        }
    }

    if (isDeliveryPanel) {
        const deliveryDefault = cookiesObj.get('dine_auth_token_delivery')?.value;
        if (deliveryDefault) return deliveryDefault;
        if (cookiesObj.getAll) {
            try {
                const all = cookiesObj.getAll();
                const sorted = [...all].sort((a, b) => (b.name.includes('_delivery') ? 1 : 0) - (a.name.includes('_delivery') ? 1 : 0));
                for (const c of sorted) {
                    if (c.name.startsWith('dine_auth_token') && c.value) {
                        const payload = safeDecodePayload(c.value);
                        if (payload) {
                            const roleLower = String(payload.role || '').toLowerCase();
                            if (roleLower === 'delivery_boy' || ADMIN_ROLES.includes(roleLower)) {
                                return c.value;
                            }
                        }
                    }
                }
            } catch (_) {}
        }
    }

    if (isWaiterPanel) {
        const waiterDefault = cookiesObj.get('dine_auth_token_waiter')?.value;
        if (waiterDefault) return waiterDefault;
        if (cookiesObj.getAll) {
            try {
                const all = cookiesObj.getAll();
                for (const c of all) {
                    if (c.name.startsWith('dine_auth_token') && c.value) {
                        const payload = safeDecodePayload(c.value);
                        if (payload && ['waiter', 'supervisor', ...ADMIN_ROLES].includes(String(payload.role || '').toLowerCase())) {
                            return c.value;
                        }
                    }
                }
            } catch (_) {}
        }
    }

    const defaultToken = cookiesObj.get('dine_auth_token')?.value;
    if (defaultToken) return defaultToken;

    return null;
}

export type RequestCookiesLike = {
    get: (name: string) => { value: string } | undefined;
    getAll?: () => Array<{ name: string; value: string }>;
};

export type RequestWithAuthLike = {
    headers: { get: (name: string) => string | null };
    cookies: RequestCookiesLike;
};

/**
 * Extracts and verifies an Admin user token from an incoming request.
 * Prioritizes admin-scoped cookies, ignores non-admin cookies (such as delivery_boy or waiter),
 * and verifies that the decoded role is in ADMIN_ROLES.
 */
export async function getAdminUserFromRequest(
    request: RequestWithAuthLike,
    targetRestaurantId?: string | null
): Promise<any | null> {
    if (!request) return null;

    // 1. Check Authorization header
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        const payload = await verifyJwt(token);
        if (payload) {
            const role = String(payload.role || '').toLowerCase().trim();
            if (ADMIN_ROLES.includes(role)) {
                return payload;
            }
        }
    }

    if (!request.cookies) return null;

    // 2. If targetRestaurantId provided, check admin-scoped cookies directly first
    if (targetRestaurantId) {
        const cleanRid = String(targetRestaurantId).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const adminScopedNames = [
            `dine_auth_token_${cleanRid}_admin`,
            `dine_auth_token_${cleanRid.toLowerCase()}_admin`,
            `dine_auth_token_admin`,
        ];

        for (const name of adminScopedNames) {
            const val = request.cookies.get(name)?.value;
            if (val) {
                const payload = await verifyJwt(val);
                if (payload) {
                    const role = String(payload.role || '').toLowerCase().trim();
                    if (ADMIN_ROLES.includes(role)) {
                        return payload;
                    }
                }
            }
        }

        // Also try extractTokenForRestaurant targeting 'admin' panel
        const token = extractTokenForRestaurant(request.cookies, targetRestaurantId, null, 'admin');
        if (token) {
            const payload = await verifyJwt(token);
            if (payload) {
                const role = String(payload.role || '').toLowerCase().trim();
                if (ADMIN_ROLES.includes(role)) {
                    return payload;
                }
            }
        }
    }

    // 3. Fallback: check general admin cookie
    const generalAdmin = request.cookies.get('dine_auth_token_admin')?.value;
    if (generalAdmin) {
        const payload = await verifyJwt(generalAdmin);
        if (payload) {
            const role = String(payload.role || '').toLowerCase().trim();
            if (ADMIN_ROLES.includes(role)) {
                return payload;
            }
        }
    }

    // 4. Scan all cookies, prioritizing admin-named cookies and ONLY verifying tokens with admin roles
    if (request.cookies.getAll) {
        try {
            const allCookies = request.cookies.getAll();

            // Prioritize cookies with '_admin' in their name
            const sortedCookies = [...allCookies].sort((a, b) => {
                const aAdmin = a.name.includes('_admin') ? 1 : 0;
                const bAdmin = b.name.includes('_admin') ? 1 : 0;
                return bAdmin - aAdmin;
            });

            let fallbackAdminPayload: any = null;

            for (const c of sortedCookies) {
                if (c.name.startsWith('dine_auth_token') && c.value) {
                    // Fast non-crypto inspection to filter out non-admin roles (e.g. delivery_boy, waiter)
                    const decoded = safeDecodePayload(c.value);
                    if (!decoded) continue;

                    const role = String(decoded.role || '').toLowerCase().trim();
                    if (!ADMIN_ROLES.includes(role)) {
                        // CRITICAL: NEVER return a delivery boy, waiter, or other non-admin token when admin is requested!
                        continue;
                    }

                    // Valid admin role detected in payload, verify cryptographic signature and expiration
                    const payload = await verifyJwt(c.value);
                    if (!payload) continue;

                    const verifiedRole = String(payload.role || '').toLowerCase().trim();
                    if (!ADMIN_ROLES.includes(verifiedRole)) continue;

                    // If targetRestaurantId was provided, check if this admin token belongs to this restaurant
                    if (targetRestaurantId) {
                        const targetClean = String(targetRestaurantId).trim().toLowerCase();
                        const pRid = String(payload.restaurantId || payload.restaurant_id || '').trim().toLowerCase();

                        // Superadmins can access any restaurant
                        const isSuper = verifiedRole === 'super_admin' || verifiedRole === 'superadmin';
                        if (isSuper || pRid === targetClean) {
                            return payload;
                        }

                        // Store as candidate in case of code-vs-id mapping
                        if (!fallbackAdminPayload) {
                            fallbackAdminPayload = payload;
                        }
                    } else {
                        // No specific restaurant targeted, return first valid admin token
                        return payload;
                    }
                }
            }

            if (fallbackAdminPayload) {
                return fallbackAdminPayload;
            }
        } catch (_) {}
    }

    return null;
}

/**
 * Extracts and verifies either an Admin or Delivery Boy user token from an incoming request.
 * Prioritizes Admin tokens if both exist in the browser (e.g. an admin testing the delivery features).
 */
export async function getDeliveryOrAdminUserFromRequest(
    request: RequestWithAuthLike,
    targetRestaurantId?: string | null
): Promise<{ user: any; isAdmin: boolean; isDeliveryBoy: boolean } | null> {
    if (!request) return null;

    // 1. Try finding an Admin user first. If admin is logged in, treat request with admin privileges.
    const adminUser = await getAdminUserFromRequest(request, targetRestaurantId);
    if (adminUser) {
        return { user: adminUser, isAdmin: true, isDeliveryBoy: false };
    }

    // 2. If no admin token found, look for Delivery Boy
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        const payload = await verifyJwt(token);
        if (payload) {
            const role = String(payload.role || '').toLowerCase().trim();
            if (role === 'delivery_boy') {
                return { user: payload, isAdmin: false, isDeliveryBoy: true };
            }
        }
    }

    if (!request.cookies) return null;

    // Check delivery-scoped cookies
    if (targetRestaurantId) {
        const cleanRid = String(targetRestaurantId).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const deliveryScopedNames = [
            `dine_auth_token_${cleanRid}_delivery`,
            `dine_auth_token_${cleanRid.toLowerCase()}_delivery`,
            `dine_auth_token_delivery`,
        ];

        for (const name of deliveryScopedNames) {
            const val = request.cookies.get(name)?.value;
            if (val) {
                const payload = await verifyJwt(val);
                if (payload) {
                    const role = String(payload.role || '').toLowerCase().trim();
                    if (role === 'delivery_boy') {
                        return { user: payload, isAdmin: false, isDeliveryBoy: true };
                    }
                }
            }
        }

        const token = extractTokenForRestaurant(request.cookies, targetRestaurantId, null, 'delivery');
        if (token) {
            const payload = await verifyJwt(token);
            if (payload) {
                const role = String(payload.role || '').toLowerCase().trim();
                if (role === 'delivery_boy') {
                    return { user: payload, isAdmin: false, isDeliveryBoy: true };
                }
            }
        }
    }

    const generalDelivery = request.cookies.get('dine_auth_token_delivery')?.value;
    if (generalDelivery) {
        const payload = await verifyJwt(generalDelivery);
        if (payload) {
            const role = String(payload.role || '').toLowerCase().trim();
            if (role === 'delivery_boy') {
                return { user: payload, isAdmin: false, isDeliveryBoy: true };
            }
        }
    }

    // Scan all cookies for role 'delivery_boy'
    if (request.cookies.getAll) {
        try {
            const allCookies = request.cookies.getAll();
            const sortedCookies = [...allCookies].sort((a, b) => {
                const aDel = a.name.includes('_delivery') ? 1 : 0;
                const bDel = b.name.includes('_delivery') ? 1 : 0;
                return bDel - aDel;
            });

            for (const c of sortedCookies) {
                if (c.name.startsWith('dine_auth_token') && c.value) {
                    const decoded = safeDecodePayload(c.value);
                    if (!decoded) continue;
                    const role = String(decoded.role || '').toLowerCase().trim();
                    if (role === 'delivery_boy') {
                        const payload = await verifyJwt(c.value);
                        if (payload) {
                            return { user: payload, isAdmin: false, isDeliveryBoy: true };
                        }
                    }
                }
            }
        } catch (_) {}
    }

    return null;
}
