const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Resolve the signing secret lazily so importing this module remains safe for
 * typechecking and client/build tooling, while server execution fails closed
 * when the required secret is not configured.
 */
function getJwtSecret(): string {
    const rawSecret = typeof process !== 'undefined' ? process.env.JWT_SECRET : undefined;
    const secret = rawSecret ? rawSecret.trim() : '';

    if (!secret) {
        throw new Error('JWT_SECRET is required to sign or verify JWTs');
    }

    if (secret.length < MIN_JWT_SECRET_LENGTH) {
        throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long`);
    }

    return secret;
}

function base64UrlEncode(strOrBuf: string | Uint8Array | ArrayBuffer): string {
    if (typeof Buffer !== 'undefined') {
        const buf = typeof strOrBuf === 'string' ? Buffer.from(strOrBuf, 'utf8') : Buffer.from(strOrBuf as any);
        return buf.toString('base64url');
    }
    const str = typeof strOrBuf === 'string' ? strOrBuf : String.fromCharCode(...new Uint8Array(strOrBuf));
    const base64 = btoa(str);
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'base64url').toString('utf8');
    }
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return atob(base64);
}

function base64UrlToBytes(str: string): Uint8Array {
    if (typeof Buffer !== 'undefined') {
        return new Uint8Array(Buffer.from(str, 'base64url'));
    }
    const decoded = base64UrlDecode(str);
    return Uint8Array.from(decoded, c => c.charCodeAt(0));
}

/**
 * Signs a payload into a JWT token using HS256 (HMAC SHA-256).
 */
export async function signJwt(payload: any, expiresInSeconds: number = 3600 * 24): Promise<string> {
    const jwtSecret = getJwtSecret();
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const jwtPayload = { ...payload, exp };
    
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));
    
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(jwtSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    
    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    );
    
    const encodedSignature = base64UrlEncode(signature);
    
    return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/**
 * Verifies and decodes a JWT token using HS256.
 */
export async function verifyJwt(token: string): Promise<any | null> {
    const jwtSecret = getJwtSecret();

    try {
        if (!token || typeof token !== 'string') return null;

        const parts = token.split('.');
        if (parts.length !== 3) return null;
        
        const [encodedHeader, encodedPayload, encodedSignature] = parts;
        if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

        const header = JSON.parse(base64UrlDecode(encodedHeader));
        if (!header || header.alg !== 'HS256') {
            return null;
        }
        
        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(jwtSecret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify']
        );
        
        const signatureBytes = base64UrlToBytes(encodedSignature);
        
        const isValid = await crypto.subtle.verify(
            'HMAC',
            key,
            signatureBytes as any,
            new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
        );
        
        if (!isValid) return null;
        
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        if (!payload || typeof payload !== 'object') {
            return null;
        }
        
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return null; // Expired
        }
        
        return payload;
    } catch {
        return null;
    }
}
