'use client';

import React, { useEffect, useState } from 'react';
import { OwnerProvider, useOwner } from '@/context/OwnerContext';
import OwnerSidebar from '@/components/owner/OwnerSidebar';
import OwnerTopBar from '@/components/owner/OwnerTopBar';

function OwnerLayoutInner({ children }: { children: React.ReactNode }) {
    const { setRestaurant, setBranches, sidebarCollapsed } = useOwner();
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        async function loadOwnerData() {
            try {
                // Fetch restaurant and branches from the API
                const res = await fetch('/api/owner/init');
                if (res.ok) {
                    const data = await res.json();
                    if (data.restaurant) {
                        setRestaurant({
                            id: data.restaurant.id,
                            name: data.restaurant.name,
                            logoUrl: data.restaurant.logo_url,
                            plan: data.primaryEntitlement?.planName || data.subscription?.plan_name || 'Standard',
                            planSlug: data.primaryEntitlement?.planSlug || 'standard',
                            maxBranches: data.branchLimits?.maxAllowed || data.restaurant.max_branches || 1,
                            branchCount: data.branchLimits?.currentCount || (data.branches || []).length,
                            remainingBranches: data.branchLimits?.remainingSlots || 0,
                            hasOwnerPanel: data.hasOwnerPanel ?? true,
                            hasMultiRestaurant: data.hasMultiRestaurant ?? false,
                        });
                    } else {
                        setRestaurant(null);
                    }
                    if (data.branches) {
                        setBranches(data.branches);
                    } else {
                        setBranches([]);
                    }
                }
            } catch (err) {
                console.error('[OwnerLayout] Init failed:', err);
            } finally {
                setInitialized(true);
            }
        }

        loadOwnerData();
    }, []);

    if (!initialized) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#FAFAFC] dark:bg-zinc-950">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 mx-auto flex items-center justify-center shadow-lg shadow-indigo-500/20 animate-pulse">
                        <span className="text-white font-black text-lg">D</span>
                    </div>
                    <div className="space-y-2">
                        <div className="w-32 h-2 bg-neutral-200 dark:bg-zinc-800 rounded-full mx-auto animate-pulse" />
                        <div className="w-20 h-2 bg-neutral-100 dark:bg-zinc-800/60 rounded-full mx-auto animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#FAFAFC] dark:bg-zinc-950 font-sans text-black dark:text-white overflow-hidden">
            {/* Sidebar */}
            <OwnerSidebar />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <OwnerTopBar />

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth bg-[#FAFAFC] dark:bg-zinc-950 premium-scrollbar">
                    {/* Background Decorative Gradients */}
                    <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-indigo-200/15 dark:bg-indigo-900/8 blur-[130px] rounded-full -mr-64 -mt-64 z-0 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-violet-200/15 dark:bg-violet-900/8 blur-[110px] rounded-full -ml-32 -mb-32 z-0 pointer-events-none" />
                    <div className="absolute top-1/2 left-1/3 w-[300px] h-[300px] bg-purple-200/10 dark:bg-purple-900/5 blur-[90px] rounded-full z-0 pointer-events-none" />

                    <div className="relative z-10 min-h-full">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
    return (
        <OwnerProvider>
            <OwnerLayoutInner>{children}</OwnerLayoutInner>
        </OwnerProvider>
    );
}
