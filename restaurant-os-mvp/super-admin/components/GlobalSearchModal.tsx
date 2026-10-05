'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    UtensilsCrossed,
    Users,
    GitBranch,
    Receipt,
    Zap,
    Headset,
    ArrowRight,
    CornerDownLeft,
    X,
    Building2,
    Shield
} from 'lucide-react';

interface SearchResult {
    id: string;
    title: string;
    subtitle: string;
    category: 'restaurants' | 'owners' | 'branches' | 'invoices' | 'subscriptions' | 'tickets';
    url: string;
    badge?: string;
    badgeColor?: string;
}

interface GlobalSearchModalProps {
    open: boolean;
    onClose: () => void;
}

export default function GlobalSearchModal({ open, onClose }: GlobalSearchModalProps) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Focus input on open
    useEffect(() => {
        if (open) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    // Keyboard shortcut listeners (Cmd+K, Escape, Arrows, Enter)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                if (open) onClose();
                else onClose(); // parent handles open
            }
            if (!open) return;

            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
            } else if (e.key === 'Enter' && results[selectedIndex]) {
                e.preventDefault();
                handleSelect(results[selectedIndex]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, results, selectedIndex, onClose]);

    // Debounced Search API query
    useEffect(() => {
        if (!open) return;
        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data.results || []);
                    setSelectedIndex(0);
                } else {
                    // Fallback local results if API is still loading
                    fetchLocalFallback(query);
                }
            } catch {
                fetchLocalFallback(query);
            } finally {
                setLoading(false);
            }
        }, 150);

        return () => clearTimeout(timer);
    }, [query, open]);

    const fetchLocalFallback = (q: string) => {
        const fallbackList: SearchResult[] = [
            {
                id: 'rest-1',
                title: 'Spice Route Hospitality',
                subtitle: 'Nellore Main • Active • Pro Plan',
                category: 'restaurants',
                url: '/admin/restaurants',
                badge: 'Active',
                badgeColor: 'emerald'
            },
            {
                id: 'rest-2',
                title: 'Coastal Flavours Seafood',
                subtitle: 'Chennai Coast • Active • Enterprise Plan',
                category: 'restaurants',
                url: '/admin/restaurants',
                badge: 'Active',
                badgeColor: 'emerald'
            },
            {
                id: 'rest-3',
                title: 'Anjappar Chettinad Kitchen',
                subtitle: 'Hyderabad Hitech • Suspended',
                category: 'restaurants',
                url: '/admin/restaurants?tab=suspended',
                badge: 'Suspended',
                badgeColor: 'amber'
            },
            {
                id: 'owner-1',
                title: 'Ravi Kumar',
                subtitle: 'ravi@spiceroute.in • 2 Restaurants, 4 Branches',
                category: 'owners',
                url: '/admin/owners',
                badge: 'Owner',
                badgeColor: 'indigo'
            },
            {
                id: 'branch-1',
                title: 'Nellore Main Central Branch',
                subtitle: 'Spice Route Hospitality • Code: BR-NEL-01',
                category: 'branches',
                url: '/admin/branches',
                badge: 'Main Branch',
                badgeColor: 'cyan'
            },
            {
                id: 'inv-101',
                title: 'Invoice #INV-2026-0042',
                subtitle: 'Spice Route Hospitality • ₹4,719 • Paid',
                category: 'invoices',
                url: '/admin/billing',
                badge: 'Paid',
                badgeColor: 'emerald'
            },
            {
                id: 'sub-01',
                title: 'Growth Annual Tier',
                subtitle: 'Coastal Flavours Seafood • Next: 14 Oct 2026',
                category: 'subscriptions',
                url: '/admin/subscriptions',
                badge: 'Active',
                badgeColor: 'indigo'
            },
            {
                id: 'tick-1001',
                title: 'TICK-1001: Thermal printer sync failure',
                subtitle: 'Spice Route Hospitality • High Priority • Open',
                category: 'tickets',
                url: '/admin/support',
                badge: 'High Priority',
                badgeColor: 'red'
            }
        ];

        if (!q.trim()) {
            setResults(fallbackList);
        } else {
            const filtered = fallbackList.filter(
                (item) =>
                    item.title.toLowerCase().includes(q.toLowerCase()) ||
                    item.subtitle.toLowerCase().includes(q.toLowerCase()) ||
                    item.category.toLowerCase().includes(q.toLowerCase())
            );
            setResults(filtered);
        }
        setSelectedIndex(0);
    };

    const handleSelect = (result: SearchResult) => {
        onClose();
        router.push(result.url);
    };

    // Category Icon Helper
    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'restaurants':
                return <UtensilsCrossed size={15} className="text-indigo-600" />;
            case 'owners':
                return <Users size={15} className="text-violet-600" />;
            case 'branches':
                return <GitBranch size={15} className="text-cyan-600" />;
            case 'invoices':
                return <Receipt size={15} className="text-emerald-600" />;
            case 'subscriptions':
                return <Zap size={15} className="text-amber-600" />;
            case 'tickets':
                return <Headset size={15} className="text-rose-600" />;
            default:
                return <Building2 size={15} className="text-neutral-500" />;
        }
    };

    // Group results by category
    const grouped = results.reduce<Record<string, SearchResult[]>>((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {});

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-neutral-900/40 backdrop-blur-xs transition-opacity"
                    />

                    {/* Dialog Container */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -10 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-[#E4E7EC] overflow-hidden z-10 flex flex-col max-h-[80vh]"
                    >
                        {/* Search Input Bar */}
                        <div className="flex items-center px-4 py-3.5 border-b border-[#E4E7EC] gap-3">
                            <Search size={18} className="text-neutral-400 shrink-0" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search restaurants, owners, branches, invoices, tickets..."
                                className="w-full text-sm text-[#172033] placeholder-neutral-400 bg-transparent focus:outline-none font-medium"
                            />
                            {loading && (
                                <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin shrink-0" />
                            )}
                            <button
                                onClick={onClose}
                                className="p-1 text-neutral-400 hover:text-neutral-600 rounded-md transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Results Body */}
                        <div className="overflow-y-auto p-3 space-y-4 max-h-[60vh] custom-scrollbar">
                            {results.length === 0 ? (
                                <div className="py-12 text-center text-neutral-400">
                                    <Search size={32} className="mx-auto mb-2 opacity-30" />
                                    <p className="text-xs font-semibold">No platform records found matching &ldquo;{query}&rdquo;</p>
                                    <p className="text-[11px] text-neutral-400 mt-1">
                                        Try searching by restaurant name, owner email, branch code, or invoice #
                                    </p>
                                </div>
                            ) : (
                                Object.entries(grouped).map(([category, items]) => (
                                    <div key={category} className="space-y-1">
                                        <div className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center justify-between">
                                            <span>{category}</span>
                                            <span className="text-[9px] font-semibold text-neutral-400">
                                                {items.length} {items.length === 1 ? 'result' : 'results'}
                                            </span>
                                        </div>
                                        <div className="space-y-0.5">
                                            {items.map((item) => {
                                                const globalIndex = results.indexOf(item);
                                                const isSelected = globalIndex === selectedIndex;

                                                return (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => handleSelect(item)}
                                                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                                                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                                                            isSelected
                                                                ? 'bg-indigo-50/90 text-indigo-900 border border-indigo-100'
                                                                : 'hover:bg-neutral-50 text-[#172033]'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="p-2 rounded-lg bg-neutral-100 shrink-0">
                                                                {getCategoryIcon(item.category)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold leading-snug truncate">
                                                                    {item.title}
                                                                </p>
                                                                <p className="text-[11px] text-[#667085] truncate">
                                                                    {item.subtitle}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {item.badge && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-200">
                                                                    {item.badge}
                                                                </span>
                                                            )}
                                                            {isSelected && (
                                                                <CornerDownLeft size={13} className="text-indigo-600" />
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer Keyboard Hints */}
                        <div className="px-4 py-2 bg-[#F5F7FC] border-t border-[#E4E7EC] flex items-center justify-between text-[11px] text-neutral-400">
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 bg-white rounded border border-neutral-200 text-[10px] font-mono shadow-2xs">
                                        ↑
                                    </kbd>
                                    <kbd className="px-1.5 py-0.5 bg-white rounded border border-neutral-200 text-[10px] font-mono shadow-2xs">
                                        ↓
                                    </kbd>
                                    Navigate
                                </span>
                                <span className="flex items-center gap-1">
                                    <kbd className="px-1.5 py-0.5 bg-white rounded border border-neutral-200 text-[10px] font-mono shadow-2xs">
                                        ↵
                                    </kbd>
                                    Open
                                </span>
                            </div>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-white rounded border border-neutral-200 text-[10px] font-mono shadow-2xs">
                                    esc
                                </kbd>
                                Close
                            </span>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
