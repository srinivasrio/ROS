import MarketingLoginClient from '@/components/auth/MarketingLoginClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log In — Dine in One',
  description: 'Sign in to access your Dine in One restaurant dashboard and live panels.',
};

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return <MarketingLoginClient />;
}
