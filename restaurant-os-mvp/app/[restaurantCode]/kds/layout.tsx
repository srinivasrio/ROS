import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'KDS — Kitchen Display System',
    description: 'Real-time kitchen order execution and ticket workflow system',
};

export default function KitchenLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={`${inter.className} min-h-screen bg-slate-50 text-neutral-900 antialiased`}>
            {children}
            {/* Material Icons fallback */}
            <link href="https://fonts.googleapis.com/css2?family=Material+Icons+Outlined&display=swap" rel="stylesheet" />
        </div>
    );
}


