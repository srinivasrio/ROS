-- Migration: Enforce uniqueness constraints for restaurant ownership and identity
-- Purpose: Prevent duplicate owner-restaurant associations and duplicate restaurant emails

-- 1. Unique constraint on restaurant_users(user_id, restaurant_id)
-- This prevents the same user from being linked to the same restaurant twice.
-- Before adding, clean up any remaining duplicates.
DO $$
BEGIN
    -- Remove any duplicate restaurant_users rows, keeping the earliest created_at
    DELETE FROM restaurant_users
    WHERE id IN (
        SELECT id FROM (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY user_id, restaurant_id ORDER BY created_at ASC) AS rn
            FROM restaurant_users
        ) t
        WHERE t.rn > 1
    );

    -- Add the unique constraint if it doesn't already exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'restaurant_users_user_restaurant_unique'
    ) THEN
        ALTER TABLE restaurant_users
        ADD CONSTRAINT restaurant_users_user_restaurant_unique
        UNIQUE (user_id, restaurant_id);
    END IF;
END
$$;

-- 2. Unique partial index on restaurants(email) where email IS NOT NULL
-- This prevents multiple restaurants from using the same email address.
-- Before adding, check for and resolve any duplicates.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE indexname = 'restaurants_email_unique_idx'
    ) THEN
        CREATE UNIQUE INDEX restaurants_email_unique_idx
        ON restaurants (email)
        WHERE email IS NOT NULL AND email != '';
    END IF;
END
$$;
