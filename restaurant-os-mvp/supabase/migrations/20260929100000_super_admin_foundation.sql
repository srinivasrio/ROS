-- Migration: Super Admin Foundation & Platform Command Center
-- Date: 2026-09-29
-- Description: Creates schema for Super Admin command center: plans, support tickets, security events, notifications, platform settings.
-- NON-DESTRUCTIVE: All changes are additive.

-- 1. PLANS
CREATE TABLE IF NOT EXISTS public.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    tagline TEXT,
    price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0,
    price_annual NUMERIC(10, 2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    max_branches INTEGER DEFAULT 1,
    max_employees INTEGER DEFAULT 10,
    max_orders_per_month INTEGER,
    features JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_popular BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default plans
INSERT INTO public.plans (name, slug, tagline, price_monthly, price_annual, max_branches, max_employees, features, is_popular) VALUES
    ('Starter Trial', 'starter-trial', '14-day full access trial for new restaurants', 0, 0, 3, 20, '["Up to 3 Branches", "Multi-Branch Owner Panel", "Real-Time POS & KDS", "QR Digital Ordering", "Basic Reports"]'::jsonb, false),
    ('Growth', 'growth', 'For growing multi-outlet restaurant chains', 4999, 49990, 5, 50, '["Up to 5 Branches", "Unlimited Staff Floating", "Multi-Branch Reporting & Analytics", "Priority Support", "GST Invoicing", "Inventory & Table Matrix"]'::jsonb, true),
    ('Enterprise', 'enterprise', 'Complete digital infrastructure for large hospitality groups', 9999, 99990, 25, 250, '["Up to 25 Branches", "Dedicated Account Manager", "Custom Role Permissions", "Full API Access", "Custom Domain Support", "99.9% Uptime SLA"]'::jsonb, false)
ON CONFLICT (slug) DO NOTHING;

-- 2. SUPPORT TICKETS
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number TEXT NOT NULL UNIQUE,
    restaurant_id TEXT REFERENCES public.restaurants(id) ON DELETE SET NULL,
    branch_id TEXT,
    user_id UUID,
    user_name TEXT,
    user_email TEXT,
    user_phone TEXT,
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
    category TEXT DEFAULT 'general' CHECK (category IN ('general', 'billing', 'hardware', 'pos', 'kds', 'branch', 'account')),
    assigned_to UUID,
    assigned_name TEXT,
    internal_notes TEXT,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_restaurant ON public.support_tickets(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);

-- Seed sample support tickets
INSERT INTO public.support_tickets (ticket_number, restaurant_id, subject, description, priority, status, category, user_name, user_email) VALUES
    ('TICK-1001', '202603180001', 'Thermal Printer USB Integration in Airport Branch', 'Need assistance configuring ESC/POS thermal printer with Airport Terminal branch KDS screen.', 'high', 'in_progress', 'hardware', 'Ravi Kumar', 'admin@dineinone.com'),
    ('TICK-1002', '202603180001', 'GST Invoice Prefix Customization', 'Requesting custom invoice series prefix (SR-2026-) for legal accounting compliance.', 'medium', 'open', 'billing', 'Ravi Kumar', 'admin@dineinone.com'),
    ('TICK-1003', '202609089153', 'Staff Floating Assignment Sync Query', 'Staff member assigned to Branch 2 still seeing default table floor layout.', 'low', 'waiting', 'branch', 'Chef Gordon', 'chef@dineinone.com')
ON CONFLICT (ticket_number) DO NOTHING;

-- 3. SECURITY EVENTS
CREATE TABLE IF NOT EXISTS public.security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    actor_id UUID,
    actor_email TEXT,
    actor_role TEXT,
    restaurant_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    endpoint TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_by UUID,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON public.security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_restaurant ON public.security_events(restaurant_id);

-- Seed sample security events
INSERT INTO public.security_events (event_type, severity, actor_email, restaurant_id, ip_address, details, is_resolved) VALUES
    ('failed_login_burst', 'medium', 'unknown_staff@mall.com', '202603180001', '103.21.244.12', '{"attempts": 4, "panel": "waiter", "action": "pin_verification"}'::jsonb, true),
    ('cross_tenant_attempt_blocked', 'high', 'hacker@outside.org', '202603180001', '185.220.101.5', '{"blocked_reason": "Tenant isolation defense active", "endpoint": "/api/owner/orders"}'::jsonb, true),
    ('rate_limit_throttle', 'low', 'bot@scanner.net', NULL, '45.154.255.89', '{"requests_per_sec": 45, "status": "throttled"}'::jsonb, false);

-- 4. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'system',
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
    restaurant_id TEXT,
    restaurant_name TEXT,
    target_role TEXT DEFAULT 'SUPER_ADMIN',
    action_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

-- Seed sample notifications
INSERT INTO public.notifications (title, message, type, priority, restaurant_id, restaurant_name, action_url) VALUES
    ('New Branch Added', 'Spice Route Hospitality configured a new branch: Airport Terminal T2', 'new_branch', 'normal', '202603180001', 'Spice Route Hospitality', '/admin/branches'),
    ('Subscription Trial Active', '14-Day Free Trial initiated for Spice Route Hospitality', 'new_subscription', 'normal', '202603180001', 'Spice Route Hospitality', '/admin/subscriptions'),
    ('High Priority Ticket Filed', 'TICK-1001: Thermal Printer USB Integration requested', 'support_ticket', 'high', '202603180001', 'Spice Route Hospitality', '/admin/support')
ON CONFLICT DO NOTHING;

-- 5. PLATFORM SETTINGS
CREATE TABLE IF NOT EXISTS public.platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'general',
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID
);

-- Seed default platform settings
INSERT INTO public.platform_settings (key, category, value, description) VALUES
    ('dine_in_one_profile', 'profile', '{"brand_name": "Dine in One", "company_name": "Dine in One Technologies Pvt Ltd", "founder": "Platform Founder", "support_email": "founder@dineinone.com", "billing_email": "billing@dineinone.com", "hotline": "+91 98765 00000", "website": "https://dineinone.com", "headquarters": "Hitech City, Hyderabad, Telangana, India"}'::jsonb, 'Master corporate and founder profile'),
    ('subscription_policies', 'subscriptions', '{"default_trial_days": 14, "grace_period_days": 7, "auto_suspend_unpaid_days": 14, "allow_custom_plans": true}'::jsonb, 'Platform-wide subscription and trial policies'),
    ('billing_defaults', 'billing', '{"invoice_prefix": "DIO-2026-", "gst_rate_percent": 18, "currency": "INR", "currency_symbol": "₹", "payment_gateways": ["Razorpay", "UPI", "Stripe"]}'::jsonb, 'Global invoicing and GST settings'),
    ('data_retention', 'governance', '{"restaurant_deletion_retention_days": 30, "audit_log_retention_days": 365, "security_log_retention_days": 730, "allow_immediate_purge": false}'::jsonb, 'Data retention and compliance lifecycles'),
    ('notification_channels', 'notifications', '{"email_alerts": true, "sms_critical_alerts": true, "slack_webhook_active": false}'::jsonb, 'Super Admin alerting channels')
ON CONFLICT (key) DO NOTHING;

-- 6. RLS Policies
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans Public Read" ON public.plans FOR SELECT USING (true);
CREATE POLICY "Plans Service Role Write" ON public.plans FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Support Tickets Super Admin Access" ON public.support_tickets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Security Events Super Admin Access" ON public.security_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Notifications Super Admin Access" ON public.notifications FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Platform Settings Super Admin Access" ON public.platform_settings FOR ALL USING (auth.role() = 'service_role');
