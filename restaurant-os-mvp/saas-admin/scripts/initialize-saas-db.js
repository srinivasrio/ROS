import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SAAS_SUPABASE_URL;
const supabaseKey = process.env.SAAS_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey || supabaseKey.includes('...')) {
    console.error('❌ Error: NEXT_PUBLIC_SAAS_SUPABASE_URL and SAAS_SUPABASE_SERVICE_ROLE_KEY must be set in saas-admin/.env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function initialize() {
    console.log('🚀 Initializing SaaS Admin Database...');

    const migration = `
        -- 1. Restaurants Base Table
        CREATE TABLE IF NOT EXISTS public.restaurants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            owner_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            address TEXT,
            latitude DOUBLE PRECISION,
            longitude DOUBLE PRECISION,
            opening_date DATE,
            operating_hours JSONB DEFAULT '{}'::jsonb,
            subscription_plan TEXT DEFAULT 'Basic',
            status TEXT DEFAULT 'inactive',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- 2. Restaurant Legal & Compliance
        CREATE TABLE IF NOT EXISTS public.restaurant_legal (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            restaurant_ref UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
            business_name TEXT NOT NULL,
            business_type TEXT DEFAULT 'Partnership',
            gst_number TEXT,
            fssai_number TEXT,
            license_number TEXT,
            pan_number TEXT,
            shop_establishment_license TEXT,
            status TEXT DEFAULT 'pending',
            license_expiry_date DATE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- 3. Robust Fix: Add any potentially missing columns to existing tables
        DO $$ 
        BEGIN
            -- Restaurants Columns
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurants' AND column_name='opening_date') THEN
                ALTER TABLE public.restaurants ADD COLUMN opening_date DATE;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurants' AND column_name='operating_hours') THEN
                ALTER TABLE public.restaurants ADD COLUMN operating_hours JSONB DEFAULT '{}'::jsonb;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurants' AND column_name='subscription_plan') THEN
                ALTER TABLE public.restaurants ADD COLUMN subscription_plan TEXT DEFAULT 'Basic';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurants' AND column_name='email') THEN
                ALTER TABLE public.restaurants ADD COLUMN email TEXT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurants' AND column_name='phone') THEN
                ALTER TABLE public.restaurants ADD COLUMN phone TEXT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurants' AND column_name='owner_name') THEN
                ALTER TABLE public.restaurants ADD COLUMN owner_name TEXT;
            END IF;

            -- Legal Columns
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurant_legal' AND column_name='pan_number') THEN
                ALTER TABLE public.restaurant_legal ADD COLUMN pan_number TEXT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurant_legal' AND column_name='shop_establishment_license') THEN
                ALTER TABLE public.restaurant_legal ADD COLUMN shop_establishment_license TEXT;
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurant_legal' AND column_name='business_type') THEN
                ALTER TABLE public.restaurant_legal ADD COLUMN business_type TEXT DEFAULT 'Partnership';
            END IF;
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurant_legal' AND column_name='license_expiry_date') THEN
                ALTER TABLE public.restaurant_legal ADD COLUMN license_expiry_date DATE;
            END IF;
        END $$;

        ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.restaurant_legal ENABLE ROW LEVEL SECURITY;

        -- SaaS Admins can do everything
        DO $$ 
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'restaurants' AND policyname = 'Admins full access') THEN
                CREATE POLICY "Admins full access" ON public.restaurants FOR ALL TO authenticated USING (true);
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'restaurant_legal' AND policyname = 'Admins full access') THEN
                CREATE POLICY "Admins full access" ON public.restaurant_legal FOR ALL TO authenticated USING (true);
            END IF;
        END $$;
    `;

    const { error } = await supabase.rpc('admin_run_sql', { sql_query: migration });
    
    // If RPC doesn't exist (likely), we'll have to guide the user to run it in SQL Editor
    if (error) {
        console.log('\n⚠️  Could not run migration automatically (Service Role might lack SQL RPC).');
        console.log('Please copy-paste the following SQL into your Supabase SQL Editor for the SaaS project:\n');
        console.log(migration);
    } else {
        console.log('✅ SaaS Admin Database initialized successfully!');
    }
}

initialize();
