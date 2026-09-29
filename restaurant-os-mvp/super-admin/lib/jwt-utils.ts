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
export async function signJwt(payload: any, expiresInSeconds: number = 3600 * 24): Promise<string> {
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
    const signatureStr = String.fromCharCode(...signatureArray);
    const encodedSignature = base64UrlEncode(signatureStr);
    
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies and decodes a JWT token using HS256.
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
        
        const signatureBytes = Uint8Array.from(base64UrlDecode(encodedSignature), c => c.charCodeAt(0));
        
        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signatureBytes,
            new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
        );
        
        if (!isValid) return null;
        
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null; // Expired
        }
        
        return payload;
    } catch {
        return null;
    }
}
