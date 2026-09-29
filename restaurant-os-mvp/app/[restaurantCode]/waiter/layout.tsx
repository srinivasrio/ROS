import { Inter, Outfit } from 'next/font/google';

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter',
});

const outfit = Outfit({
    subsets: ['latin'],
    display: 'swap',
    weight: ['500', '600', '700', '800', '900'],
    variable: '--font-outfit',
});

export default function WaiterLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={`${inter.variable} ${outfit.variable} font-sans min-h-[100dvh] md:h-[100dvh] flex items-center justify-center p-0 md:py-6 overflow-hidden bg-[#E2E8F0]`}>
            <div aria-hidden className="pointer-events-none fixed inset-0">
                <div className="absolute -top-32 -left-24 size-[420px] rounded-full bg-w-brand/[0.06] blur-3xl" />
                <div className="absolute -bottom-40 -right-20 size-[460px] rounded-full bg-w-brand/[0.04] blur-3xl" />
            </div>

            <div className="relative flex w-full max-w-md flex-col h-[100dvh] md:h-[860px] bg-[#EEF2F6] text-slate-800 md:rounded-[2.5rem] md:border md:border-white/80 md:shadow-[0_32px_80px_-24px_rgba(15,23,42,0.25)] overflow-hidden">
                {children}
            </div>
        </div>
    );
}
