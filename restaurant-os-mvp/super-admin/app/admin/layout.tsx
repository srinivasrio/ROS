'use client';

import React, { useState, useEffect } from 'react';
import SuperAdminSidebar from '@/components/SuperAdminSidebar';
import SuperAdminHeader from '@/components/SuperAdminHeader';
import GlobalSearchModal from '@/components/GlobalSearchModal';

export default function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    // Keyboard shortcut for Cmd+K / Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen((prev) => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="min-h-screen bg-[#F5F7FC] text-[#172033] flex">
            {/* Left Collapsible & Mobile Sidebar */}
            <SuperAdminSidebar
                mobileOpen={mobileSidebarOpen}
                onCloseMobile={() => setMobileSidebarOpen(false)}
                collapsed={sidebarCollapsed}
                onToggleCollapsed={() => setSidebarCollapsed(!sidebarCollapsed)}
            />

            {/* Main Application Container */}
            <div
                className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
                    sidebarCollapsed ? 'md:pl-18' : 'md:pl-64'
                }`}
            >
                {/* Fixed Top Header */}
                <SuperAdminHeader
                    onOpenSearch={() => setSearchOpen(true)}
                />

                {/* Main Workspace Body */}
                <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto">
                    {children}
                </main>
            </div>

            {/* Global Search ⌘K Dialog */}
            <GlobalSearchModal
                open={searchOpen}
                onClose={() => setSearchOpen(false)}
            />
        </div>
    );
}
