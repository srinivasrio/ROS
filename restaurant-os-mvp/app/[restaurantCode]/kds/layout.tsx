import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Kitchen Display System | Restaurant OS',
    description: 'High-performance kitchen order management',
};

export default function KitchenLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={`${inter.className} min-h-screen bg-neutral-900 text-white`}>
            {/* Minimal Chrome for KDS */}
            {children}

            {/* Material Icons */}
            <link href="https://fonts.googleapis.com/css2?family=Material+Icons+Outlined&display=swap" rel="stylesheet" />
        </div>
    );
}
