import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: 'super-admin/.env.local' });

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = 'jmcsygpphwdubnanwjwz';
const REGION = 'ap-south-1';

// Use connection pooler
const connectionString = `postgresql://postgres.${PROJECT_REF}:${SERVICE_KEY}@aws-0-${REGION}.pooler.supabase.com:6543/postgres`;

const { Client } = pg;
const client = new Client({ connectionString });

const MIGRATION_SQL = `
-- 1. Add Super Admin registration and MFA columns to employees table
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS super_admin_setup_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS registration_token TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS registration_token_expires_at TIMESTAMPTZ;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS login_verification_token TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS login_verification_token_expires_at TIMESTAMPTZ;

-- 2. Add Super Admin specific columns to auth table
ALTER TABLE public.auth ADD COLUMN IF NOT EXISTS login_email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.auth ADD COLUMN IF NOT EXISTS last_login_verification_sent_at TIMESTAMPTZ;

-- 3. Create index for Super Admin lookup
CREATE INDEX IF NOT EXISTS idx_employees_super_admin ON public.employees (email) WHERE role ILIKE 'SUPER_ADMIN%';

-- 4. Create a bootstrap control table to prevent unauthorized Super Admin registration
CREATE TABLE IF NOT EXISTS public.super_admin_bootstrap (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES public.employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert a single bootstrap record (only one allowed)
INSERT INTO public.super_admin_bootstrap (completed) VALUES (false)
ON CONFLICT DO NOTHING;

-- 5. Enable RLS on bootstrap table
ALTER TABLE public.super_admin_bootstrap ENABLE ROW LEVEL SECURITY;

-- Only service_role can manage bootstrap state
DROP POLICY IF EXISTS "Bootstrap Service Role Only" ON public.super_admin_bootstrap;
CREATE POLICY "Bootstrap Service Role Only" ON public.super_admin_bootstrap
FOR ALL TO service_role USING (true) WITH CHECK (true);
`;

async function run() {
    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected!');
        
        console.log('Running migration...');
        await client.query(MIGRATION_SQL);
        console.log('Migration applied successfully!');
        
        // Verify
        const boot = await client.query('SELECT * FROM public.super_admin_bootstrap');
        console.log('Bootstrap table:', boot.rows);
        
        const cols = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'employees' 
            AND column_name IN ('super_admin_setup_completed', 'email_verified_at', 'registration_token', 'registration_token_expires_at', 'login_verification_token', 'login_verification_token_expires_at')
        `);
        console.log('Employee columns:', cols.rows.map(r => r.column_name));
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

run();
