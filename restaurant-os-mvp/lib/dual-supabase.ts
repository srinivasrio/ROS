import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Registers background mirror promises with Cloudflare Workers `ctx.waitUntil`
 * when running in an OpenNext/workerd isolate so writes complete after response return.
 */
function runBackgroundMirror(task: Promise<void>): void {
    if (typeof window === 'undefined' && typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !== 'undefined') {
        import('@opennextjs/cloudflare')
            .then(({ getCloudflareContext }) => getCloudflareContext({ async: true }))
            .then((context) => {
                const ctx = context?.ctx as { waitUntil?: (p: Promise<unknown>) => void } | undefined;
                if (ctx && typeof ctx.waitUntil === 'function') {
                    ctx.waitUntil(task);
                }
            })
            .catch(() => {
                // Non-Workers runtime or context unavailable; task runs as standard microtask
            });
    }
}

/**
 * Creates a Dual-Writing Supabase Client Proxy.
 * 
 * - All READ operations (.select()) execute ONLY on the Primary database for zero latency overhead.
 * - All WRITE operations (.insert(), .update(), .upsert(), .delete(), and .rpc() mutations) execute on
 *   the Primary database first, and are automatically mirrored to the Secondary database.
 * - If the Secondary database write encounters an issue, a non-fatal warning is logged so the
 *   primary user flow is never disrupted.
 */
interface DualResult {
    error?: { message?: string } | unknown;
}

interface DynamicBuilder extends PromiseLike<unknown> {
    [key: string | symbol]: unknown;
}

function getErrorMessage(err: unknown): unknown {
    if (err && typeof err === 'object' && 'message' in err) {
        return (err as { message?: unknown }).message ?? err;
    }
    return err;
}

export function createDualSupabaseClient<T = Record<string, never>>(
    primary: SupabaseClient<T>,
    secondary?: SupabaseClient<T> | null
): SupabaseClient<T> {
    if (!secondary || process.env.ENABLE_DUAL_DB_WRITE === 'false') {
        return primary;
    }

    return new Proxy(primary, {
        get(target, prop, receiver) {
            // Intercept .from(tableName)
            if (prop === 'from') {
                return function (tableName: string) {
                    const primaryQuery = primary.from(tableName as never) as unknown as DynamicBuilder;
                    let secondaryQuery: DynamicBuilder | null = null;
                    try {
                        secondaryQuery = secondary.from(tableName as never) as unknown as DynamicBuilder;
                    } catch {
                        secondaryQuery = null;
                    }

                    let isWriteOperation = false;

                    function wrapBuilder(pBuilder: DynamicBuilder, sBuilder: DynamicBuilder | null): DynamicBuilder {
                        return new Proxy(pBuilder, {
                            get(bTarget, bProp, bReceiver) {
                                // Intercept promise resolution (when awaited or .then is called)
                                if (bProp === 'then') {
                                    return function (
                                        onFulfilled?: ((value: unknown) => unknown) | null,
                                        onRejected?: ((reason: unknown) => unknown) | null
                                    ) {
                                        return bTarget.then((rawResult: unknown) => {
                                            const primaryResult = rawResult as DualResult | null | undefined;
                                            // Asynchronously mirror write operations to secondary database without blocking user latency
                                            if (isWriteOperation && sBuilder && !primaryResult?.error) {
                                                const mirrorTask = Promise.resolve().then(async () => {
                                                    try {
                                                        const secPromise = typeof sBuilder.then === 'function' ? sBuilder : Promise.resolve(sBuilder);
                                                        const secResult = (await secPromise) as DualResult | null | undefined;
                                                        if (secResult?.error) {
                                                            console.warn(
                                                                `[Dual-DB Mirror] Notice on ${tableName}: Secondary DB reported:`,
                                                                getErrorMessage(secResult.error)
                                                            );
                                                        }
                                                    } catch (secErr: unknown) {
                                                        console.warn(
                                                            `[Dual-DB Mirror] Exception on ${tableName}:`,
                                                            getErrorMessage(secErr)
                                                        );
                                                    }
                                                });
                                                runBackgroundMirror(mirrorTask);
                                            }

                                            // If read operation failed on primary with a fetch/network error, fallback to secondary
                                            if (!isWriteOperation && primaryResult?.error && sBuilder) {
                                                const msg = String(getErrorMessage(primaryResult.error) || '');
                                                if (msg.includes('fetch') || msg.includes('network') || msg.includes('Failed to fetch')) {
                                                    return sBuilder.then(onFulfilled, onRejected);
                                                }
                                            }

                                            return onFulfilled ? onFulfilled(rawResult) : rawResult;
                                        }, (primaryErr: unknown) => {
                                            if (!isWriteOperation && sBuilder) {
                                                return sBuilder.then(onFulfilled, onRejected);
                                            }
                                            if (onRejected) return onRejected(primaryErr);
                                            throw primaryErr;
                                        });
                                    };
                                }

                                const originalMethod = bTarget[bProp];
                                if (typeof originalMethod !== 'function') {
                                    return Reflect.get(bTarget, bProp, bReceiver);
                                }

                                return function (...args: unknown[]) {
                                    // Detect mutation methods
                                    if (['insert', 'update', 'upsert', 'delete'].includes(String(bProp))) {
                                        isWriteOperation = true;
                                    }

                                    const nextPrimary = (originalMethod as (...a: unknown[]) => DynamicBuilder).apply(bTarget, args);
                                    let nextSecondary: DynamicBuilder | null = null;
                                    if (sBuilder) {
                                        const secMethod = sBuilder[bProp];
                                        if (typeof secMethod === 'function') {
                                            try {
                                                nextSecondary = (secMethod as (...a: unknown[]) => DynamicBuilder).apply(sBuilder, args);
                                            } catch {
                                                // Prevent catastrophic unfiltered query execution on secondary DB
                                                nextSecondary = null;
                                            }
                                        } else {
                                            nextSecondary = null;
                                        }
                                    }

                                    return wrapBuilder(nextPrimary, nextSecondary);
                                };
                            }
                        });
                    }

                    return wrapBuilder(primaryQuery, secondaryQuery);
                };
            }

            // Intercept .rpc(fn, args)
            if (prop === 'rpc') {
                return function (fnName: string, args?: Record<string, unknown>, options?: Record<string, unknown>) {
                    const primaryRpc = primary.rpc(fnName as never, args as never, options as never) as unknown as DynamicBuilder;
                    let secondaryRpc: DynamicBuilder | null = null;
                    try {
                        secondaryRpc = secondary.rpc(fnName as never, args as never, options as never) as unknown as DynamicBuilder;
                    } catch {
                        secondaryRpc = null;
                    }

                    return new Proxy(primaryRpc, {
                        get(rTarget, rProp, rReceiver) {
                            if (rProp === 'then') {
                                return function (
                                    onFulfilled?: ((value: unknown) => unknown) | null,
                                    onRejected?: ((reason: unknown) => unknown) | null
                                ) {
                                    return rTarget.then((rawResult: unknown) => {
                                        const primaryResult = rawResult as DualResult | null | undefined;
                                        if (secondaryRpc && !primaryResult?.error) {
                                            const mirrorTask = Promise.resolve().then(async () => {
                                                try {
                                                    const secResult = (await secondaryRpc) as DualResult | null | undefined;
                                                    if (secResult?.error) {
                                                        console.warn(
                                                            `[Dual-DB Mirror] RPC ${fnName} warning on Secondary DB:`,
                                                            getErrorMessage(secResult.error)
                                                        );
                                                    }
                                                } catch (err: unknown) {
                                                    console.warn(`[Dual-DB Mirror] RPC ${fnName} exception:`, getErrorMessage(err));
                                                }
                                            });
                                            runBackgroundMirror(mirrorTask);
                                        }
                                        return onFulfilled ? onFulfilled(rawResult) : rawResult;
                                    }, onRejected);
                                };
                            }
                            return Reflect.get(rTarget, rProp, rReceiver);
                        }
                    });
                };
            }

            // Intercept .auth.admin user management mutations
            if (prop === 'auth') {
                const primaryAuth = primary.auth;
                const secondaryAuth = secondary?.auth;

                return new Proxy(primaryAuth, {
                    get(aTarget, aProp, aReceiver) {
                        if (aProp === 'admin' && primaryAuth.admin) {
                            const pAdmin = primaryAuth.admin as unknown as Record<string | symbol, unknown>;
                            const sAdmin = secondaryAuth?.admin as unknown as Record<string | symbol, unknown> | undefined;

                            return new Proxy(primaryAuth.admin, {
                                get(admTarget, admProp, admReceiver) {
                                    const origAdmFn = pAdmin[admProp];
                                    if (typeof origAdmFn !== 'function') {
                                        return Reflect.get(admTarget, admProp, admReceiver);
                                    }

                                    return async function (...args: unknown[]) {
                                        const primaryRes = (await (origAdmFn as (...a: unknown[]) => Promise<DualResult | undefined>).apply(
                                            admTarget,
                                            args
                                        ));
                                        // If this is a user creation/update/deletion, mirror it
                                        if (
                                            sAdmin &&
                                            !primaryRes?.error &&
                                            ['createUser', 'deleteUser', 'updateUserById'].includes(String(admProp))
                                        ) {
                                            try {
                                                const secFn = sAdmin[admProp];
                                                if (typeof secFn === 'function') {
                                                    await (secFn as (...a: unknown[]) => Promise<unknown>).apply(sAdmin, args);
                                                }
                                            } catch (authErr: unknown) {
                                                console.warn(
                                                    `[Dual-DB Mirror] Auth Admin ${String(admProp)} warning:`,
                                                    getErrorMessage(authErr)
                                                );
                                            }
                                        }
                                        return primaryRes;
                                    };
                                }
                            });
                        }
                        return Reflect.get(aTarget, aProp, aReceiver);
                    }
                });
            }

            return Reflect.get(target, prop, receiver);
        }
    });
}
