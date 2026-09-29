const crypto = require('crypto');
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

const encodedSignature = base64UrlEncodeBuffer(signature);
const jwt = `${tokenData}.${encodedSignature}`;

console.log("JWT:", jwt);
