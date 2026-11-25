import MarketingSignupClient from '@/components/auth/MarketingSignupClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up — Dine in One',
  description: 'Create your Dine in One owner account to get started with your restaurant management workspace.',
};

export const dynamic = 'force-dynamic';

export default function AuthSignupPage() {
  return <MarketingSignupClient />;
}
