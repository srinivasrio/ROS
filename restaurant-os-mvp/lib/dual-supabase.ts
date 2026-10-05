import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a Dual-Writing Supabase Client Proxy.
 * 
 * - All READ operations (.select()) execute ONLY on the Primary database for zero latency overhead.
 * - All WRITE operations (.insert(), .update(), .upsert(), .delete(), and .rpc() mutations) execute on
 *   the Primary database first, and are automatically mirrored to the Secondary database.
 * - If the Secondary database write encounters an issue, a non-fatal warning is logged so the
 *   primary user flow is never disrupted.
 */
export function createDualSupabaseClient<T = any>(
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
                    const primaryQuery = primary.from(tableName as any);
                    let secondaryQuery: any = null;
                    try {
                        secondaryQuery = secondary.from(tableName as any);
                    } catch (_) {}

                    let isWriteOperation = false;

                    function wrapBuilder(pBuilder: any, sBuilder: any): any {
                        return new Proxy(pBuilder, {
                            get(bTarget, bProp, bReceiver) {
                                // Intercept promise resolution (when awaited or .then is called)
                                if (bProp === 'then') {
                                    return function (onFulfilled?: any, onRejected?: any) {
                                        return bTarget.then(async (primaryResult: any) => {
                                            // Mirror write operations to secondary database if primary succeeded
                                            if (isWriteOperation && sBuilder && !primaryResult?.error) {
                                                try {
                                                    // Mirror mutation to secondary
                                                    const secPromise = sBuilder.then ? sBuilder : Promise.resolve(sBuilder);
                                                    const secResult = await secPromise;
                                                    if (secResult?.error) {
                                                        console.warn(
                                                            `[Dual-DB Mirror] Notice on ${tableName}: Secondary DB reported:`,
                                                            secResult.error.message || secResult.error
                                                        );
                                                    }
                                                } catch (secErr: any) {
                                                    console.warn(
                                                        `[Dual-DB Mirror] Exception on ${tableName}:`,
                                                        secErr?.message || secErr
                                                    );
                                                }
                                            }

                                            return onFulfilled ? onFulfilled(primaryResult) : primaryResult;
                                        }, onRejected);
                                    };
                                }

                                const originalMethod = bTarget[bProp];
                                if (typeof originalMethod !== 'function') {
                                    return Reflect.get(bTarget, bProp, bReceiver);
                                }

                                return function (...args: any[]) {
                                    // Detect mutation methods
                                    if (['insert', 'update', 'upsert', 'delete'].includes(String(bProp))) {
                                        isWriteOperation = true;
                                    }

                                    const nextPrimary = originalMethod.apply(bTarget, args);
                                    let nextSecondary = sBuilder;
                                    if (sBuilder && typeof sBuilder[bProp] === 'function') {
                                        try {
                                            nextSecondary = sBuilder[bProp].apply(sBuilder, args);
                                        } catch (_) {}
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
                return function (fnName: string, args?: any, options?: any) {
                    const primaryRpc = primary.rpc(fnName as any, args, options);
                    let secondaryRpc: any = null;
                    try {
                        secondaryRpc = secondary.rpc(fnName as any, args, options);
                    } catch (_) {}

                    return new Proxy(primaryRpc, {
                        get(rTarget, rProp, rReceiver) {
                            if (rProp === 'then') {
                                return function (onFulfilled?: any, onRejected?: any) {
                                    return rTarget.then(async (primaryResult: any) => {
                                        if (secondaryRpc && !primaryResult?.error) {
                                            try {
                                                const secResult = await secondaryRpc;
                                                if (secResult?.error) {
                                                    console.warn(
                                                        `[Dual-DB Mirror] RPC ${fnName} warning on Secondary DB:`,
                                                        secResult.error.message || secResult.error
                                                    );
                                                }
                                            } catch (err: any) {
                                                console.warn(`[Dual-DB Mirror] RPC ${fnName} exception:`, err?.message || err);
                                            }
                                        }
                                        return onFulfilled ? onFulfilled(primaryResult) : primaryResult;
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
                            const pAdmin = primaryAuth.admin;
                            const sAdmin = secondaryAuth?.admin;

                            return new Proxy(pAdmin, {
                                get(admTarget, admProp, admReceiver) {
                                    const origAdmFn = (admTarget as any)[admProp];
                                    if (typeof origAdmFn !== 'function') {
                                        return Reflect.get(admTarget, admProp, admReceiver);
                                    }

                                    return async function (...args: any[]) {
                                        const primaryRes = await origAdmFn.apply(admTarget, args);
                                        // If this is a user creation/update/deletion, mirror it
                                        if (
                                            sAdmin &&
                                            !primaryRes?.error &&
                                            ['createUser', 'deleteUser', 'updateUserById'].includes(String(admProp))
                                        ) {
                                            try {
                                                const secFn = (sAdmin as any)[admProp];
                                                if (typeof secFn === 'function') {
                                                    await secFn.apply(sAdmin, args);
                                                }
                                            } catch (authErr: any) {
                                                console.warn(
                                                    `[Dual-DB Mirror] Auth Admin ${String(admProp)} warning:`,
                                                    authErr?.message || authErr
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
