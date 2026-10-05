'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AdminUpgradeModal, { UpgradeModalFeature } from '@/components/admin/AdminUpgradeModal';

interface AdminUpgradeModalContextType {
    openUpgradeModal: (feature: UpgradeModalFeature) => void;
    closeUpgradeModal: () => void;
    isUpgradeModalOpen: boolean;
    currentFeature: UpgradeModalFeature;
}

const AdminUpgradeModalContext = createContext<AdminUpgradeModalContextType | null>(null);

export function AdminUpgradeModalProvider({
    children,
    restaurantCode,
    currentPlanName,
}: {
    children: React.ReactNode;
    restaurantCode?: string;
    currentPlanName?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [feature, setFeature] = useState<UpgradeModalFeature>('delivery');

    const openUpgradeModal = useCallback((targetFeature: UpgradeModalFeature) => {
        setFeature(targetFeature);
        setIsOpen(true);
    }, []);

    const closeUpgradeModal = useCallback(() => {
        setIsOpen(false);
    }, []);

    // Also listen for custom events so non-React or deeply nested handlers can trigger cleanly
    useEffect(() => {
        const handleCustomOpen = (e: any) => {
            if (e?.detail?.feature) {
                openUpgradeModal(e.detail.feature);
            } else {
                openUpgradeModal('delivery');
            }
        };

        window.addEventListener('admin:open-upgrade-modal', handleCustomOpen);
        return () => {
            window.removeEventListener('admin:open-upgrade-modal', handleCustomOpen);
        };
    }, [openUpgradeModal]);

    return (
        <AdminUpgradeModalContext.Provider
            value={{
                openUpgradeModal,
                closeUpgradeModal,
                isUpgradeModalOpen: isOpen,
                currentFeature: feature,
            }}
        >
            {children}
            <AdminUpgradeModal
                isOpen={isOpen}
                onClose={closeUpgradeModal}
                feature={feature}
                restaurantCode={restaurantCode}
                currentPlanName={currentPlanName}
            />
        </AdminUpgradeModalContext.Provider>
    );
}

export function useAdminUpgradeModal() {
    const context = useContext(AdminUpgradeModalContext);
    if (!context) {
        // Fallback for components rendered outside the provider that can dispatch the event
        return {
            openUpgradeModal: (feature: UpgradeModalFeature) => {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('admin:open-upgrade-modal', { detail: { feature } }));
                }
            },
            closeUpgradeModal: () => {},
            isUpgradeModalOpen: false,
            currentFeature: 'delivery' as UpgradeModalFeature,
        };
    }
    return context;
}
