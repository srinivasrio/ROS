import { Work_Sans } from 'next/font/google';
import Link from 'next/link';
import BottomNav from './waiter/components/BottomNav';

import WaiterAlertSystem from './waiter/components/WaiterAlertSystem';

const workSans = Work_Sans({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-work-sans',
});

export default function WaiterLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className={`${workSans.variable} font-sans bg-neutral-100 min-h-screen flex justify-center`}>
            <div className="relative flex w-full max-w-md flex-col bg-white shadow-2xl overflow-hidden h-screen bg-white text-charcoal">

                {/* Global Alert System */}
                <WaiterAlertSystem />

                {/* Main Content Area */}
                <div className="flex-1 overflow-y-auto relative no-scrollbar">
                    {children}
                </div>

                {/* Bottom Navigation */}
                <BottomNav />
            </div>

            {/* Material Icons Import (Using Google Fonts for exact match with user request) */}
            <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
            <style>{`
        .material-icons-outlined {
            font-family: 'Material Symbols Outlined';
            font-weight: normal;
            font-style: normal;
            font-size: 24px;
            line-height: 1;
            letter-spacing: normal;
            text-transform: none;
            display: inline-block;
            white-space: nowrap;
            word-wrap: normal;
            direction: ltr;
            -webkit-font-feature-settings: 'liga';
            -webkit-font-smoothing: antialiased;
        }
        .font-variation-settings-fill {
            font-variation-settings: 'FILL' 1;
        }
      `}</style>
        </div>
    );
}
