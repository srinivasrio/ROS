'use client';

import { usePathname } from 'next/navigation';
import { User, Settings, LogOut, Heart, MapPin, Bell } from 'lucide-react';
import { motion } from 'framer-motion';

export function PersistentProfile({ restaurantId, tableNumber }: { restaurantId: string, tableNumber: string }) {
    const pathname = usePathname();
    const isVisible = pathname.includes('/customer/profile/');

    return (
        <div style={{ display: isVisible ? 'block' : 'none' }} className="min-h-screen bg-gray-50 pb-32">
            <header className="bg-white p-6 pt-safe-top border-b border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="size-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                        <User size={32} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-black">Guest User</h1>
                        <p className="text-sm text-black font-medium">Table {tableNumber}</p>
                    </div>
                </div>
            </header>

            <main className="p-4 space-y-4">
                <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
                    <h2 className="text-xs font-bold text-black uppercase tracking-widest mb-4 px-2">Account</h2>
                    <div className="space-y-1">
                        <ProfileItem icon={Heart} label="Favorites" />
                        <ProfileItem icon={MapPin} label="Saved Addresses" />
                        <ProfileItem icon={Bell} label="Notifications" />
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100">
                    <h2 className="text-xs font-bold text-black uppercase tracking-widest mb-4 px-2">Settings</h2>
                    <div className="space-y-1">
                        <ProfileItem icon={Settings} label="Preferences" />
                        <ProfileItem icon={LogOut} label="Sign Out" color="text-red-500" />
                    </div>
                </div>
            </main>
        </div>
    );
}

function ProfileItem({ icon: Icon, label, color = "text-black" }: { icon: any, label: string, color?: string }) {
    return (
        <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-2xl transition-colors">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl bg-gray-50 ${color}`}>
                    <Icon size={20} />
                </div>
                <span className={`font-bold text-sm ${color}`}>{label}</span>
            </div>
            <div className="text-black">→</div>
        </button>
    );
}
