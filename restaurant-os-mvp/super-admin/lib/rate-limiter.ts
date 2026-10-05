import { supabaseAdmin } from './supabase-admin';

export interface RateLimitResult {
    success: boolean;
    lockedUntil?: Date;
    resetTime?: Date;
}

export const RateLimiter = {
    /**
     * Checks if a key has exceeded its request limit.
     * key: string - IP address, user UUID, or email
     * limit: number - max number of requests allowed in the window
     * windowSeconds: number - window size in seconds
     */
    async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
        try {
            const now = new Date();
            
            // 1. Fetch current rate limit details
            const { data: record, error: fetchErr } = await supabaseAdmin
                .from('rate_limits')
                .select('*')
                .eq('key', key)
                .maybeSingle();

            if (fetchErr) {
                console.error('[Rate Limiter] Fetch error:', fetchErr);
                // Authentication-related limits must fail closed. A database
                // outage must not turn into an unlimited password/OTP attempt
                // window.
                return { success: false };
            }

            if (record) {
                // Check if currently locked
                if (record.locked_until && new Date(record.locked_until) > now) {
                    return { 
                        success: false, 
                        lockedUntil: new Date(record.locked_until),
                        resetTime: new Date(record.locked_until)
                    };
                }

                const windowStart = new Date(record.window_start);
                const secondsPassed = (now.getTime() - windowStart.getTime()) / 1000;

                if (secondsPassed >= windowSeconds) {
                    // Window has expired. Reset window start and request count
                    const { error: resetErr } = await supabaseAdmin
                        .from('rate_limits')
                        .update({
                            request_count: 1,
                            window_start: now.toISOString(),
                            locked_until: null
                        })
                        .eq('id', record.id);

                    if (resetErr) console.error('[Rate Limiter] Reset error:', resetErr);
                    return { success: true };
                }

                const nextCount = record.request_count + 1;

                if (nextCount > limit) {
                    // Lock out for 5 minutes
                    const lockDurationMinutes = 5;
                    const lockedUntilTime = new Date(now.getTime() + lockDurationMinutes * 60 * 1000);
                    
                    const { error: lockErr } = await supabaseAdmin
                        .from('rate_limits')
                        .update({
                            request_count: nextCount,
                            locked_until: lockedUntilTime.toISOString()
                        })
                        .eq('id', record.id);

                    if (lockErr) console.error('[Rate Limiter] Lock update error:', lockErr);

                    return { 
                        success: false, 
                        lockedUntil: lockedUntilTime,
                        resetTime: lockedUntilTime
                    };
                }

                // Increment request count
                const { error: incErr } = await supabaseAdmin
                    .from('rate_limits')
                    .update({
                        request_count: nextCount
                    })
                    .eq('id', record.id);

                if (incErr) console.error('[Rate Limiter] Increment error:', incErr);
                return { success: true };
            } else {
                // Create a new rate limit record
                const { error: insertErr } = await supabaseAdmin
                    .from('rate_limits')
                    .insert({
                        key,
                        request_count: 1,
                        window_start: now.toISOString(),
                        locked_until: null
                    });

                if (insertErr) {
                    // Handle race condition where record is inserted by concurrent request
                    if (insertErr.code === '23505') { // Unique key constraint violation
                        // Retry check
                        return this.check(key, limit, windowSeconds);
                    }
                    console.error('[Rate Limiter] Insert error:', insertErr);
                }

                return { success: true };
            }
            } catch (err) {
                console.error('[Rate Limiter] Error executing limit check:', err);
            // Fail closed when the limiter cannot establish the current
            // attempt count. Callers already handle success=false as 429.
            return { success: false };
        }
    }
};