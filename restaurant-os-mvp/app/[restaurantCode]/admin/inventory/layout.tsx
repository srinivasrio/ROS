'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { LayoutDashboard as LucideLayoutDashboard, BookOpen as LucideBookOpen, Calendar as LucideCalendar, Bell as LucideBell } from 'lucide-react';
import FeatureLockedGate from '@/components/FeatureLockedGate';
import { useEntitlements } from '@/hooks/useEntitlements';

export default function InventoryLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const params = useParams();
    const restaurantCode = (params.restaurantCode || params.restaurantId) as string;
    const { loading, hasFeature, planName, isSuspended, isExpired } = useEntitlements(restaurantCode);

    if (!loading && !hasFeature('inventory')) {
        return (
            <FeatureLockedGate
                feature="inventory"
                restaurantCode={restaurantCode}
                currentPlanName={planName}
                isSuspended={isSuspended}
                isExpired={isExpired}
            />
        );
    }

    const tabs = [
        { href: `/${restaurantCode}/admin/inventory`, icon: LucideLayoutDashboard, label: 'Dashboard' },
        { href: `/${restaurantCode}/admin/inventory/recipes`, icon: LucideBookOpen, label: 'Recipe Mapping' },
        { href: `/${restaurantCode}/admin/inventory/calendar`, icon: LucideCalendar, label: 'Festival Calendar' },
        { href: `/${restaurantCode}/admin/inventory/alerts`, icon: LucideBell, label: 'Alerts & Suggestions' },
    ];

    return (
        <div className="h-full flex flex-col bg-neutral-50/50">
            <header className="px-8 pt-8 pb-4 bg-white border-b border-neutral-200">
                <h1 className="text-2xl font-bold text-black mb-6">Inventory Intelligence</h1>
                <nav className="flex gap-6 relative">
                    {tabs.map(tab => {
                        const isActive = pathname === tab.href;
                        const Icon = tab.icon;
                        return (
                            <Link
                                key={tab.href}
                                href={tab.href}
                                prefetch={false}
                                className={`flex items-center gap-2 pb-4 text-sm font-medium transition-colors relative ${isActive ? 'text-blue-600' : 'text-black hover:text-black'}`}
                            >
                                <Icon size={16} />
                                {tab.label}
                                {isActive && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </header>
            <main className="flex-1 overflow-auto p-8">
                {children}
            </main>
        </div>
    );
}
