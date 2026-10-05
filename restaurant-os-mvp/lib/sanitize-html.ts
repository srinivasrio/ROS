import DOMPurify from 'dompurify';

export const ALLOWED_EMAIL_TAGS = [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'b', 'i', 'strong', 'em', 'small',
    'span', 'div', 'br', 'hr',
    'ul', 'ol', 'li',
    'code', 'pre',
    'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
];

export const ALLOWED_EMAIL_ATTR = ['href', 'title', 'target', 'rel', 'class'];

export const FORBIDDEN_TAGS = [
    'script', 'iframe', 'object', 'embed', 'form', 'input', 'button',
    'svg', 'math', 'style', 'link', 'base', 'meta', 'applet'
];

export const FORBIDDEN_ATTR = [
    'onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
    'onchange', 'onsubmit', 'action', 'formaction', 'xlink:href'
];

/**
 * Configure DOMPurify hooks once if in browser
 */
let isHookConfigured = false;
function ensureDomPurifyHooks() {
    if (typeof window !== 'undefined' && DOMPurify && typeof DOMPurify.addHook === 'function' && !isHookConfigured) {
        DOMPurify.addHook('afterSanitizeAttributes', (node) => {
            if (node.tagName === 'A') {
                node.setAttribute('target', '_blank');
                node.setAttribute('rel', 'noopener noreferrer nofollow');
            }
        });
        isHookConfigured = true;
    }
}

/**
 * Server-side / Node fallback HTML sanitizer.
 * Guarantees zero script/iframe/event-handler execution during SSR and Node test environments.
 */
export function sanitizeHtmlServer(dirty: string): string {
    if (!dirty || typeof dirty !== 'string') return '';

    // 1. Remove dangerous executable containers and their contents
    let clean = dirty
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<iframe\b[^>]*\/?>/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/<object\b[^>]*\/?>/gi, '')
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
        .replace(/<embed\b[^>]*\/?>/gi, '')
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
        .replace(/<svg\b[^>]*\/?>/gi, '')
        .replace(/<math\b[^<]*(?:(?!<\/math>)<[^<]*)*<\/math>/gi, '')
        .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');

    const allowedTagsSet = new Set(ALLOWED_EMAIL_TAGS);

    // 2. Match each HTML tag and sanitize attributes
    clean = clean.replace(/<\/?([a-z0-9-]+)([^>]*)>/gi, (match, tagName, attrs) => {
        const lowerTag = tagName.toLowerCase();
        if (!allowedTagsSet.has(lowerTag)) {
            return ''; // Strip disallowed tags
        }

        if (match.startsWith('</')) {
            return `</${lowerTag}>`;
        }

        let safeAttrs = '';
        if (lowerTag === 'a') {
            const hrefMatch = attrs.match(/\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
            const rawHref = hrefMatch ? (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? '') : '';
            const trimmedHref = rawHref.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, '');

            // Only allow http, https, mailto, or relative URLs; strictly reject javascript: or data:
            const isSafeUrl = /^(?:https?:\/\/|mailto:|\/|#)/i.test(trimmedHref) && !/^(?:javascript|data|vbscript):/i.test(trimmedHref);

            if (isSafeUrl) {
                const escapedHref = trimmedHref.replace(/"/g, '&quot;');
                safeAttrs += ` href="${escapedHref}" target="_blank" rel="noopener noreferrer nofollow"`;
            }
        }

        const titleMatch = attrs.match(/\btitle\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        if (titleMatch) {
            const rawTitle = (titleMatch[1] ?? titleMatch[2] ?? titleMatch[3] ?? '').replace(/"/g, '&quot;');
            safeAttrs += ` title="${rawTitle}"`;
        }

        const classMatch = attrs.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
        if (classMatch) {
            const rawClass = (classMatch[1] ?? classMatch[2] ?? classMatch[3] ?? '');
            if (/^[a-zA-Z0-9\s_-]+$/.test(rawClass)) {
                safeAttrs += ` class="${rawClass}"`;
            }
        }

        const isSelfClosing = match.endsWith('/>') || lowerTag === 'br' || lowerTag === 'hr';
        return `<${lowerTag}${safeAttrs}${isSelfClosing ? ' />' : '>'}`;
    });

    return clean;
}

/**
 * Sanitizes email HTML body using trusted DOMPurify in the browser,
 * with graceful server-side fallback for SSR and tests.
 */
export function sanitizeEmailHtml(rawHtml: string): string {
    if (!rawHtml || typeof rawHtml !== 'string') return '';

    if (typeof window !== 'undefined' && DOMPurify && typeof DOMPurify.sanitize === 'function') {
        ensureDomPurifyHooks();
        return DOMPurify.sanitize(rawHtml, {
            ALLOWED_TAGS: ALLOWED_EMAIL_TAGS,
            ALLOWED_ATTR: ALLOWED_EMAIL_ATTR,
            ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
            FORBID_TAGS: FORBIDDEN_TAGS,
            FORBID_ATTR: FORBIDDEN_ATTR,
            ALLOW_DATA_ATTR: false,
            RETURN_TRUSTED_TYPE: false
        });
    }

    return sanitizeHtmlServer(rawHtml);
}

/**
 * Converts HTML body to clean, safe readable plain text.
 */
export function stripHtmlToText(html: string): string {
    if (!html || typeof html !== 'string') return '';
    return html
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/h[1-6]>/gi, '\n\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
