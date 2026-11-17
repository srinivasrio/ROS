/**
 * Runtime helpers so the same code runs on the VPS (Node.js / PM2)
 * and on Cloudflare Workers (OpenNext).
 */

/** True when running inside Cloudflare Workers (workerd). */
export function isCloudflareWorkers(): boolean {
    return typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers';
}

/**
 * Load a native Node.js package (argon2, sharp, ...) only when running on Node.
 * Returns null on Cloudflare Workers or if the package is not installed.
 *
 * The specifier is passed as a variable and marked webpackIgnore so neither
 * Next's webpack build nor OpenNext's esbuild step tries to bundle the
 * native binary into the Worker.
 */
export async function importNodeOnly<T = any>(moduleName: string): Promise<T | null> {
    if (isCloudflareWorkers()) return null;
    try {
        const mod = await import(/* webpackIgnore: true */ moduleName);
        return ((mod as any).default ?? mod) as T;
    } catch {
        return null;
    }
}
