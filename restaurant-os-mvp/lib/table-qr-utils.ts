/**
 * Table QR parsing and validation utilities
 * Enforces strict multi-tenant restaurant table isolation for customer ordering
 */

export interface ParsedTableQr {
    raw: string;
    restaurantCode: string | null;
    table: string | null;
}

export interface TableVerifyResponse {
    valid: boolean;
    reason?: 'different_restaurant' | 'table_not_found' | 'invalid_format' | 'table_cleaning' | 'server_error';
    message?: string;
    tableId?: number | string;
    tableNumber?: string;
    isMerged?: boolean;
    visitedRestaurant?: {
        id: string;
        code: string;
        name: string;
    };
    scannedRestaurant?: {
        id: string;
        code: string;
        name: string;
    };
    scannedTable?: string;
}

/**
 * Extracts restaurant code and table number from any QR string
 * Supports:
 * 1. Full URLs: https://domain.com/[restCode]/customer/table/[tableNo]
 * 2. URL params: https://domain.com/[restCode]?table=[tableNo]
 * 3. Subdomain URLs: https://[restCode].dineinone.com/customer/table/[tableNo]
 * 4. JSON: {"restaurantId": "...", "tableNumber": "..."}
 * 5. Delimited text: REST-1234:T-3
 * 6. Plain table number: "3" or "T-3"
 */
export function parseTableQrCode(qrString: string): ParsedTableQr {
    const raw = (qrString || '').trim();
    if (!raw) {
        return { raw: '', restaurantCode: null, table: null };
    }

    // 1. JSON Payload Format
    if (raw.startsWith('{') && raw.endsWith('}')) {
        try {
            const parsed = JSON.parse(raw);
            const restaurantCode = parsed.restaurantId || 
                                   parsed.restaurantCode || 
                                   parsed.restaurant_id || 
                                   parsed.restaurant || 
                                   null;
            const table = parsed.tableNumber || 
                          parsed.table_number || 
                          parsed.table || 
                          parsed.tableId || 
                          parsed.table_id || 
                          null;
            return {
                raw,
                restaurantCode: restaurantCode ? String(restaurantCode).trim() : null,
                table: table ? String(table).trim() : null,
            };
        } catch (_) {
            // Ignore parse errors and fall through
        }
    }

    // 2. URL Format
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('//')) {
        try {
            const fullUrl = raw.startsWith('//') ? `https:${raw}` : raw;
            const url = new URL(fullUrl);

            // Extract table from search parameters
            let table = url.searchParams.get('table') || 
                        url.searchParams.get('tableNumber') || 
                        url.searchParams.get('table_number') || 
                        url.searchParams.get('t') || 
                        null;

            // Extract restaurant code from search parameters
            let restaurantCode = url.searchParams.get('restaurant') || 
                                 url.searchParams.get('restaurantId') || 
                                 url.searchParams.get('restaurantCode') || 
                                 null;

            // Extract from subdomain if applicable (e.g. rest123.dineinone.com)
            const hostParts = url.hostname.split('.');
            if (hostParts.length >= 3) {
                const sub = hostParts[0].toLowerCase();
                const systemSubdomains = ['admin', 'waiter', 'kds', 'delivery', 'employee', 'superadmin', 'www', 'app', 'localhost'];
                if (!systemSubdomains.includes(sub) && !restaurantCode) {
                    restaurantCode = sub;
                }
            }

            // Extract from pathname segments
            const segments = url.pathname.split('/').filter(Boolean);
            if (segments.length > 0) {
                const first = segments[0];
                const ignoredFirstSegments = ['customer', 'api', 'login', 'admin', 'waiter', 'kds', 'delivery', 'employee', 'super-admin'];
                if (!ignoredFirstSegments.includes(first.toLowerCase()) && !restaurantCode) {
                    restaurantCode = first;
                }

                // Look for table in path: e.g. .../table/5 or .../welcome/5 or .../home/5
                const tableIdx = segments.findIndex(s => ['table', 'welcome', 'home', 'menu'].includes(s.toLowerCase()));
                if (tableIdx !== -1 && segments.length > tableIdx + 1 && !table) {
                    table = segments[tableIdx + 1];
                }
            }

            return {
                raw,
                restaurantCode: restaurantCode ? String(restaurantCode).trim() : null,
                table: table ? decodeURIComponent(String(table).trim()) : null,
            };
        } catch (_) {
            // Ignore URL parse error
        }
    }

    // 3. Delimited Format (e.g., REST-1234:5 or 202603180001/3)
    if (raw.includes(':') || (raw.includes('/') && !raw.startsWith('/'))) {
        const separator = raw.includes(':') ? ':' : '/';
        const parts = raw.split(separator).map(p => p.trim());
        if (parts.length === 2 && parts[0] && parts[1]) {
            return {
                raw,
                restaurantCode: parts[0],
                table: parts[1],
            };
        }
    }

    // 4. Raw plain table representation
    return {
        raw,
        restaurantCode: null,
        table: raw,
    };
}

/**
 * Checks if a table number or QR code format is fundamentally invalid
 */
export function isCleanTableString(table: string | null | undefined): boolean {
    if (!table) return false;
    const str = String(table).trim();
    return Boolean(
        str &&
        str !== '{}' &&
        str !== 'undefined' &&
        str !== 'null' &&
        str !== '[object Object]' &&
        str !== 'NaN' &&
        str !== 'takeaway' &&
        str !== 'delivery'
    );
}
