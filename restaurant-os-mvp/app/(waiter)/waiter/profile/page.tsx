'use client';

import Link from 'next/link';
import { LucideUser, LucideSettings, LucideHistory, LucideHelpCircle, LucideLogOut, LucideChevronRight, LucideUtensils, LucideWallet } from 'lucide-react';

export default function WaiterProfile() {
    return (
        <div className="flex flex-col min-h-screen bg-neutral-50/50 pb-6">
            {/* Header - Compact & Clean */}
            <header className="flex items-center justify-between px-6 h-14 bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-black/5">
                <h2 className="text-lg font-bold text-neutral-800 tracking-tight">My Profile</h2>
                <button className="p-2 -mr-2 text-neutral-400 hover:text-neutral-600 transition-colors">
                    <LucideSettings size={20} />
                </button>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-5 overflow-y-auto custom-scrollbar">

                {/* Identity Card - Professional & Compact */}
                <div className="bg-white p-5 rounded-2xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-black/5 flex items-center justify-between mb-6 relative overflow-hidden">
                    <div className="flex flex-col relative z-10">
                        <h1 className="text-xl font-bold text-neutral-900 tracking-tight mb-0.5">Rahul Verma</h1>
                        <p className="text-sm font-medium text-neutral-400 mb-3">ID: #1234</p>

                        <div className="flex items-center gap-3">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold border border-green-100">
                                <span className="size-1.5 rounded-full bg-green-500 animate-pulse" />
                                Online
                            </div>
                            <div className="inline-flex items-center px-2.5 py-1 bg-neutral-50 text-neutral-600 rounded-full text-xs font-bold border border-neutral-100">
                                Lunch Shift
                            </div>
                        </div>
                    </div>

                    {/* Avatar - Top Right as requested */}
                    <div className="relative shrink-0">
                        <div className="size-20 rounded-full bg-gradient-to-br from-orange-100 to-orange-50 border-4 border-white shadow-sm flex items-center justify-center">
                            <span className="text-2xl font-bold text-orange-600">RV</span>
                        </div>
                        {/* Decorative background element */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-orange-500/5 size-24 rounded-full blur-xl -z-10" />
                    </div>
                </div>

                {/* Stats Grid */}
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider px-2 mb-3">Today's Performance</p>
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center justify-center text-center gap-2">
                        <div className="size-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 mb-1">
                            <LucideUtensils size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-neutral-900 leading-none">24</p>
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mt-1">Orders Served</p>
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-black/5 shadow-sm flex flex-col items-center justify-center text-center gap-2">
                        <div className="size-10 rounded-full bg-green-50 flex items-center justify-center text-green-600 mb-1">
                            <LucideWallet size={20} />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-neutral-900 leading-none">₹450</p>
                            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mt-1">Tips Earned</p>
                        </div>
                    </div>
                </div>

                {/* Menu Actions */}
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider px-2 mb-3">Account</p>
                <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden mb-8">
                    <button className="w-full flex items-center justify-between p-4 bg-white hover:bg-neutral-50 active:bg-neutral-100 transition-colors border-b border-neutral-100 last:border-0 group">
                        <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-neutral-50 flex items-center justify-center text-neutral-500 group-hover:text-neutral-700 group-hover:bg-neutral-100 transition-colors">
                                <LucideHistory size={18} />
                            </div>
                            <span className="text-sm font-semibold text-neutral-700">Shift History</span>
                        </div>
                        <LucideChevronRight size={16} className="text-neutral-300 group-hover:text-neutral-400 transition-colors" />
                    </button>
                    <button className="w-full flex items-center justify-between p-4 bg-white hover:bg-neutral-50 active:bg-neutral-100 transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="size-8 rounded-lg bg-neutral-50 flex items-center justify-center text-neutral-500 group-hover:text-neutral-700 group-hover:bg-neutral-100 transition-colors">
                                <LucideHelpCircle size={18} />
                            </div>
                            <span className="text-sm font-semibold text-neutral-700">Help & Support</span>
                        </div>
                        <LucideChevronRight size={16} className="text-neutral-300 group-hover:text-neutral-400 transition-colors" />
                    </button>
                </div>

                {/* Bottom Actions */}
                <div className="px-2 mb-6">
                    <Link
                        href="/login/waiter"
                        className="w-full flex items-center justify-center gap-2 h-12 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold active:scale-[0.98] transition-all border border-red-100 shadow-sm shadow-red-100/50"
                    >
                        <LucideLogOut size={18} />
                        Log Out
                    </Link>
                    <div className="flex items-center justify-center gap-2 mt-6 opacity-40 grayscale">
                        {/* Simple Logo Placeholder if needed, or just text */}
                        <p className="text-[10px] font-medium text-neutral-400">Restaurant OS • v1.0.2</p>
                    </div>
                </div>

            </main>
        </div>
    );
}
