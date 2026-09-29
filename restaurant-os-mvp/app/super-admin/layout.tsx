import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ['latin'],
    weight: ['400', '500', '600', '700', '800'],
    variable: '--font-plus-jakarta',
});

export const metadata: Metadata = {
    title: 'Super Admin | Dine In One Platform',
    description: 'Multi-Tenant Restaurant Onboarding, Compliance Verification & Platform Activation',
};

export default function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div 
            className={`min-h-screen text-slate-800 antialiased ${plusJakartaSans.className}`}
            style={{
                backgroundColor: '#f8fafc',
            }}
        >
            {children}
        </div>
    );
}

