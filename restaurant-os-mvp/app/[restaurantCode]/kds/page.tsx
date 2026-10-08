'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import OrderKanbanBoard from '@/components/admin/OrderKanbanBoard';
import { useRestaurant } from '@/context/RestaurantContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ChefHat, 
    Settings, 
    Maximize2, 
    Minimize2, 
    Wifi, 
    WifiOff, 
    Volume2, 
    VolumeX, 
    Clock, 
    Calendar, 
    User, 
    LogOut, 
    X, 
    Sliders,
    Sparkles,
    Shield
} from 'lucide-react';
import { RestaurantService } from '@/services/restaurant.service';
import { getCached, setCache } from '@/lib/data-cache';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { toast } from 'sonner';

export default function KitchenDashboard() {
    const params = useParams();
    const router = useRouter();
    const restaurantCode = (params?.restaurantCode as string) || '';
    const { restaurantName, branchName, user } = useRestaurant();

    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [logoError, setLogoError] = useState<boolean>(false);
    const [fetchedName, setFetchedName] = useState<string>('');
    const [time, setTime] = useState<string>('');
    const [dateStr, setDateStr] = useState<string>('');
    const [isOnline, setIsOnline] = useState<boolean>(true);
    const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
    const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
    const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');
    const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
    const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
    const [mounted, setMounted] = useState<boolean>(false);

    // Fetch restaurant brand information and logo
    useEffect(() => {
        if (!restaurantCode) return;
        let active = true;

        const brandKey = `brand-${restaurantCode}`;
        const cached = getCached<{ name?: string; logoUrl?: string | null }>(brandKey);
        if (cached) {
            if (cached.name) setFetchedName(cached.name);
            if (cached.logoUrl !== undefined) {
                setLogoUrl(cached.logoUrl);
                setLogoError(false);
            }
        }

        RestaurantService.getRestaurantInfo(restaurantCode)
            .then(info => {
                if (!active) return;
                const name = info?.name || restaurantName || '';
                const logo = info?.logo_url || null;
                if (name) setFetchedName(name);
                if (logo) {
                    setLogoUrl(logo);
                    setLogoError(false);
                }
                setCache(brandKey, {
                    name,
                    logoUrl: logo
                });
            })
            .catch(() => {
                fetch(`/api/restaurant/${restaurantCode}/plan`)
                    .then(res => res.json())
                    .then(data => {
                        if (!active) return;
                        if (data.name) setFetchedName(data.name);
                        if (data.logoUrl) {
                            setLogoUrl(data.logoUrl);
                            setLogoError(false);
                        }
                    })
                    .catch(() => {});
            });

        return () => { active = false; };
    }, [restaurantCode, restaurantName]);

    // Live clock & date updater
    useEffect(() => {
        setMounted(true);
        const updateClock = () => {
            const now = new Date();
            setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
            setDateStr(now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
        };

        updateClock();
        const timer = setInterval(updateClock, 1000);
        return () => clearInterval(timer);
    }, []);

    // Network connection status
    useEffect(() => {
        setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

        const handleOnline = () => {
            setIsOnline(true);
            toast.success('Kitchen connection restored');
        };
        const handleOffline = () => {
            setIsOnline(false);
            toast.error('Kitchen offline — check network');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        const handleFullscreenChange = () => {
            if (typeof document !== 'undefined') {
                const doc = document as any;
                const isFs = Boolean(
                    doc.fullscreenElement ||
                    doc.webkitFullscreenElement ||
                    doc.webkitCurrentFullScreenElement ||
                    doc.mozFullScreenElement ||
                    doc.msFullscreenElement ||
                    doc.webkitIsFullScreen
                );
                setIsFullscreen(isFs);
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, []);

    const toggleFullscreen = () => {
        if (typeof document === 'undefined') return;

        try {
            const doc = document as any;
            const docEl = document.documentElement as any;

            const isFs = Boolean(
                doc.fullscreenElement ||
                doc.webkitFullscreenElement ||
                doc.webkitCurrentFullScreenElement ||
                doc.mozFullScreenElement ||
                doc.msFullscreenElement ||
                doc.webkitIsFullScreen
            );

            if (!isFs) {
                const requestFn =
                    docEl.requestFullscreen?.bind(docEl) ||
                    docEl.webkitRequestFullscreen?.bind(docEl) ||
                    docEl.webkitRequestFullScreen?.bind(docEl) ||
                    docEl.mozRequestFullScreen?.bind(docEl) ||
                    docEl.msRequestFullscreen?.bind(docEl);

                if (requestFn) {
                    const result = requestFn();
                    if (result && typeof result.then === 'function') {
                        result
                            .then(() => setIsFullscreen(true))
                            .catch((err: any) => {
                                console.warn('Fullscreen request rejected:', err);
                                toast.error('Full screen could not be activated by browser.');
                            });
                    } else {
                        setIsFullscreen(true);
                    }
                } else {
                    toast.info('Full screen is not supported on this browser. In Safari, use "Add to Home Screen".');
                }
            } else {
                const exitFn =
                    doc.exitFullscreen?.bind(doc) ||
                    doc.webkitExitFullscreen?.bind(doc) ||
                    doc.webkitCancelFullScreen?.bind(doc) ||
                    doc.mozCancelFullScreen?.bind(doc) ||
                    doc.msExitFullscreen?.bind(doc);

                if (exitFn) {
                    const result = exitFn();
                    if (result && typeof result.then === 'function') {
                        result
                            .then(() => setIsFullscreen(false))
                            .catch((err: any) => {
                                console.warn('Exit fullscreen rejected:', err);
                            });
                    } else {
                        setIsFullscreen(false);
                    }
                }
            }
        } catch (err: any) {
            console.warn('Fullscreen toggle failed:', err);
            toast.error('Fullscreen request blocked by browser.');
        }
    };

    const handleTestSound = () => {
        try {
            const audio = new Audio('/sounds/alert.mp3');
            audio.play().then(() => {
                toast.success('Sound alert test successful');
            }).catch(() => {
                toast.error('Browser blocked audio playback. Interact with page first.');
            });
        } catch {
            toast.error('Audio could not be played');
        }
    };

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
            toast.success('Kitchen session closed');
            window.location.href = '/login/kds';
        } catch {
            window.location.href = '/login/kds';
        }
    };

    const chefDisplayName = typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : 'Head Chef';
    const chefRole = typeof user?.role === 'string' && user.role.trim() ? user.role.toUpperCase() : 'KITCHEN DISPLAY';
    const displayName = String(fetchedName || restaurantName || '').trim();

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-slate-100/80 text-neutral-900 font-sans select-none">
            {/* Top Bar Header (Light Theme) */}
            <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-4 md:px-6 shrink-0 z-20 shadow-xs shadow-black/5">
                {/* Brand & Kitchen Identifier */}
                <div className="flex items-center gap-3 md:gap-4 min-w-0">
                    <div className="size-10 rounded-xl overflow-hidden flex items-center justify-center bg-white border border-neutral-200/80 shadow-xs shrink-0 relative">
                        {logoUrl && !logoError ? (
                            <img 
                                src={logoUrl} 
                                alt={displayName || 'Restaurant Logo'} 
                                className="size-full object-cover"
                                onError={() => setLogoError(true)}
                            />
                        ) : (
                            <div className="size-full bg-gradient-to-br from-orange-500 via-amber-500 to-rose-600 flex items-center justify-center text-white shadow-inner">
                                {displayName ? (
                                    <span suppressHydrationWarning className="text-base font-black uppercase tracking-tight">
                                        {displayName.slice(0, 1)}
                                    </span>
                                ) : (
                                    <ChefHat className="text-white size-5" />
                                )}
                            </div>
                        )}
                    </div>

                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 suppressHydrationWarning className="text-sm md:text-base font-black tracking-tight text-neutral-900 uppercase truncate">
                                {displayName}
                            </h1>
                            {branchName && (
                                <span suppressHydrationWarning className="px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 text-neutral-700 font-black text-[10px] uppercase tracking-wider hidden sm:inline-block">
                                    {branchName}
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] font-bold tracking-wider uppercase text-neutral-400 truncate">
                            Kitchen Display System
                        </p>
                    </div>

                    {/* Online / Offline Status Dot */}
                    <div 
                        className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-extrabold ${
                            isOnline 
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                : 'bg-rose-50 border-rose-200 text-rose-700 animate-pulse'
                        }`}
                        title={isOnline ? 'Realtime sync active' : 'Offline — attempting reconnection'}
                    >
                        <span className={`size-2 rounded-full ${isOnline ? 'bg-emerald-500 kds-connection-dot' : 'bg-rose-500'}`} />
                        <span suppressHydrationWarning>{isOnline ? 'LIVE SYNC' : 'OFFLINE'}</span>
                    </div>
                </div>

                {/* Center: Live Clock & Date */}
                <div className="flex items-center gap-2 shrink-0">
                    <div className="bg-neutral-50 border border-neutral-200 px-3 md:px-4 py-1.5 rounded-xl shadow-2xs flex items-center gap-2.5">
                        <div className="hidden sm:flex items-center gap-1 text-neutral-500 text-xs font-semibold">
                            <Calendar size={13} className="text-neutral-400" />
                            <span suppressHydrationWarning>{dateStr}</span>
                        </div>
                        <span className="hidden sm:inline-block text-neutral-300">|</span>
                        <div className="flex items-center gap-1.5">
                            <Clock size={13} className="text-orange-500" />
                            <p suppressHydrationWarning className="text-xs md:text-sm font-black font-mono text-orange-600 tracking-wider">
                                {time || '—'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right Side: Tools & Chef Profile */}
                <div className="flex items-center gap-2 md:gap-3 shrink-0">
                    {/* Fullscreen Toggle */}
                    <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="p-2 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700 hover:text-neutral-900 transition-all active:scale-95 shadow-2xs"
                        title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                        aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
                    >
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>

                    {/* Exit Kitchen Station Button */}
                    <button
                        type="button"
                        onClick={() => setShowExitConfirm(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200/80 text-rose-700 hover:text-rose-800 text-xs font-bold transition-all active:scale-95 shadow-2xs"
                        title="Exit Kitchen Mode"
                    >
                        <LogOut size={14} />
                        <span className="hidden sm:inline">Exit</span>
                    </button>

                    {/* Chef Profile Badge & Settings Trigger */}
                    <button
                        type="button"
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-xl bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-900 transition-all active:scale-95 shadow-2xs"
                    >
                        <div suppressHydrationWarning className="size-7 rounded-lg bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center font-black text-xs">
                            {chefDisplayName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="text-left hidden xl:block">
                            <p suppressHydrationWarning className="text-xs font-black text-neutral-900 leading-tight truncate max-w-[120px]">
                                {chefDisplayName}
                            </p>
                            <p suppressHydrationWarning className="text-[9px] font-bold text-orange-600 tracking-wider uppercase">
                                {chefRole}
                            </p>
                        </div>
                        <Settings size={15} className="text-neutral-400 ml-1" />
                    </button>
                </div>
            </header>

            {/* Kanban Board Component */}
            <div className="flex-1 h-full overflow-hidden bg-slate-100/70">
                <OrderKanbanBoard density={density} />
            </div>

            {/* Chef Settings Slide-Out Drawer (Light Theme) */}
            <AnimatePresence>
                {isSettingsOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsSettingsOpen(false)}
                            className="fixed inset-0 kds-backdrop z-40"
                        />

                        {/* Slide-over panel */}
                        <motion.aside
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                            className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white border-l border-neutral-200 z-50 flex flex-col shadow-2xl text-neutral-900"
                        >
                            {/* Drawer Header */}
                            <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Sliders className="size-4 text-orange-500" />
                                    <h2 className="text-sm font-black uppercase tracking-wider text-neutral-900">
                                        Kitchen Controls
                                    </h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsSettingsOpen(false)}
                                    className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 hover:text-neutral-900 transition-colors"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Drawer Content */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                                {/* Profile Card */}
                                <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <div className="size-11 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-orange-500/20">
                                            {chefDisplayName.slice(0, 1).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="font-black text-neutral-900 text-sm truncate">
                                                {chefDisplayName}
                                            </h3>
                                            <p className="text-[11px] font-bold text-orange-600 uppercase tracking-wider">
                                                {chefRole}
                                            </p>
                                            <p className="text-[10px] text-neutral-500 truncate">
                                                {user?.email || `Branch: ${branchName || 'Primary'}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Audio Controls */}
                                <div className="space-y-3">
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
                                        Sound & Alerts
                                    </h4>

                                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Volume2 size={16} className="text-orange-600" />
                                                <div>
                                                    <p className="text-xs font-bold text-neutral-900">Audio Alerts</p>
                                                    <p className="text-[10px] text-neutral-500">Play chime when new orders arrive</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSoundEnabled(!soundEnabled)}
                                                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
                                                    soundEnabled ? 'bg-orange-500' : 'bg-neutral-300'
                                                }`}
                                            >
                                                <div 
                                                    className={`size-5 rounded-full bg-white shadow-xs transition-transform transform ${
                                                        soundEnabled ? 'translate-x-5' : 'translate-x-0'
                                                    }`} 
                                                />
                                            </button>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleTestSound}
                                            className="w-full py-2 px-3 rounded-lg bg-white hover:bg-neutral-100 border border-neutral-200 text-xs font-bold text-neutral-800 transition-colors flex items-center justify-center gap-2 shadow-2xs"
                                        >
                                            <Sparkles size={14} className="text-orange-500" />
                                            <span>Test Alert Chime</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Display & Screen Controls */}
                                <div className="space-y-3">
                                    <h4 className="text-[11px] font-black uppercase tracking-wider text-neutral-400">
                                        Screen & Display
                                    </h4>

                                    <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs font-bold text-neutral-900">Full Screen Mode</p>
                                                <p className="text-[10px] text-neutral-500">Expand KDS across your display</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={toggleFullscreen}
                                                className="py-1.5 px-3 rounded-lg bg-white hover:bg-neutral-100 border border-neutral-200 text-xs font-bold text-neutral-800 transition-colors flex items-center gap-1.5 shadow-2xs"
                                            >
                                                {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                                                <span>{isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Drawer Footer with Logout */}
                            <div className="p-4 border-t border-neutral-100 bg-neutral-50/50">
                                <button
                                    type="button"
                                    disabled={isLoggingOut}
                                    onClick={() => {
                                        setIsSettingsOpen(false);
                                        setShowExitConfirm(true);
                                    }}
                                    className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-2xs active:scale-98"
                                >
                                    <LogOut size={15} />
                                    <span>{isLoggingOut ? 'Logging Out...' : 'Exit Kitchen Mode'}</span>
                                </button>
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* Exit Kitchen Confirmation Modal */}
            <ConfirmationModal
                isOpen={showExitConfirm}
                onClose={() => setShowExitConfirm(false)}
                onConfirm={handleLogout}
                title="Exit Kitchen Mode?"
                message="Are you sure you want to exit? Active live order monitoring and real-time alerts for this kitchen display will be closed."
                confirmText={isLoggingOut ? 'Exiting...' : 'Exit Kitchen'}
                cancelText="Stay in Kitchen"
                isSuperDestructive={true}
            />
        </div>
    );
}

