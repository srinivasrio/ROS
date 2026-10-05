'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    Truck, Settings, Users, Plus, RefreshCw, 
    CheckCircle2, Clock, MapPin, Phone, User, ChevronRight,
    Bike, Car, AlertCircle, XCircle, ArrowLeft,
    Loader2, Search, X, Trash2
} from 'lucide-react';

import RestaurantLocationPicker from '@/components/admin/RestaurantLocationPicker';
import DeliveryZonesManager from '@/components/admin/DeliveryZonesManager';
import FeatureLockedGate from '@/components/FeatureLockedGate';
import { useEntitlements } from '@/hooks/useEntitlements';

type Tab = 'boys' | 'zones' | 'settings';

interface DeliveryBoy {
    id: string;
    employee_id: string;
    status: string;
    vehicle_type?: string;
    vehicle_number?: string;
    name: string;
    mobile: string;
    email?: string;
    avatar_url?: string;
    emp_employee_id?: string;
    is_online?: boolean;
}

interface DeliverySettings {
    enabled: boolean;
    delivery_fee: number;
    minimum_order_amount: number;
    max_delivery_radius_km?: number;
    delivery_order_radius?: number;
    estimated_delivery_minutes: number;
    latitude?: number | null;
    longitude?: number | null;
    address?: string;
    dine_in_takeaway_order_radius?: number;
    dine_in_order_radius?: number;
    takeaway_order_radius?: number;
    dine_in_enabled?: boolean;
    takeaway_enabled?: boolean;
    delivery_enabled?: boolean;
}

interface Employee {
    id: string;
    name: string;
    mobile: string;
    role: string;
    employee_id?: string;
}

const BOY_STATUS_CONFIG: Record<string, { label: string; dot: string }> = {
    'active': { label: 'Available', dot: 'bg-emerald-500' },
    'on_delivery': { label: 'On Delivery', dot: 'bg-amber-500' },
    'inactive': { label: 'Inactive', dot: 'bg-neutral-400' },
    'offline': { label: 'Offline', dot: 'bg-red-400' },
};

export default function AdminDeliveryPage() {
    const params = useParams();
    const restaurantCode = params.restaurantCode as string;
    const { loading: entLoading, hasFeature, planName, isSuspended, isExpired } = useEntitlements(restaurantCode);

    const [tab, setTab] = useState<Tab>('boys');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Data
    const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
    const [settings, setSettings] = useState<DeliverySettings>({
        enabled: false,
        delivery_fee: 0,
        minimum_order_amount: 0,
        estimated_delivery_minutes: 30,
    });
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [deliveryZones, setDeliveryZones] = useState<any[]>([]);

    // UI State
    const [showAddBoy, setShowAddBoy] = useState(false);
    const [vehicleType, setVehicleType] = useState('bike');
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [searchBoy, setSearchBoy] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // ── Data Fetching ──
    const fetchAll = useCallback(async () => {
        if (!restaurantCode || !hasFeature('delivery')) return;
        if (isMountedRef.current) setLoading(true);
        try {
            const [settingsRes, boysRes, employeesRes, zonesRes] = await Promise.all([
                fetch(`/api/delivery/settings?restaurantId=${restaurantCode}`),
                fetch(`/api/delivery/boys?restaurantId=${restaurantCode}`),
                fetch(`/api/admin/employees?restaurantId=${restaurantCode}`),
                fetch(`/api/delivery/zones?restaurantId=${restaurantCode}`),
            ]);

            if (settingsRes.ok && isMountedRef.current) {
                const d = await settingsRes.json();
                if (d.settings && isMountedRef.current) setSettings(d.settings);
            }
            if (boysRes.ok && isMountedRef.current) {
                const d = await boysRes.json();
                if (d.deliveryBoys && isMountedRef.current) setDeliveryBoys(d.deliveryBoys);
            }
            if (employeesRes.ok && isMountedRef.current) {
                const d = await employeesRes.json();
                if (d.employees && isMountedRef.current) setEmployees(d.employees);
            }
            if (zonesRes.ok && isMountedRef.current) {
                const d = await zonesRes.json();
                if (d.zones && isMountedRef.current) setDeliveryZones(d.zones);
            }
        } catch (err) {
            console.error('[Delivery] Fetch error:', err);
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [restaurantCode, hasFeature]);

    useEffect(() => {
        if (!entLoading && hasFeature('delivery')) {
            fetchAll();
        }
    }, [entLoading, hasFeature, fetchAll]);

    // ── Add Delivery Boy ──
    const handleAddDeliveryBoy = async (employeeId: string) => {
        setError('');
        try {
            const query = new URLSearchParams({ restaurantId: restaurantCode }).toString();
            const res = await fetch(`/api/delivery/boys?${query}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-restaurant-id': restaurantCode,
                },
                body: JSON.stringify({
                    action: 'create',
                    restaurantId: restaurantCode,
                    employeeId,
                    vehicle_type: vehicleType,
                    vehicle_number: vehicleNumber,
                }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error);
            setSuccess('Delivery boy added!');
            setShowAddBoy(false);
            setVehicleType('bike');
            setVehicleNumber('');
            fetchAll();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.message);
        }
    };

    // ── Update Delivery Boy ──
    const handleUpdateBoy = async (boyId: string, updates: any) => {
        setError('');
        try {
            const query = new URLSearchParams({ restaurantId: restaurantCode }).toString();
            const res = await fetch(`/api/delivery/boys?${query}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-restaurant-id': restaurantCode,
                },
                body: JSON.stringify({ action: 'update', restaurantId: restaurantCode, deliveryBoyId: boyId, ...updates }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error);
            fetchAll();
        } catch (err: any) {
            setError(err.message);
        }
    };

    // ── Delete Delivery Boy ──
    const handleDeleteBoy = async (boyId: string) => {
        if (!confirm('Remove this delivery boy? This cannot be undone.')) return;
        setError('');
        try {
            const query = new URLSearchParams({ restaurantId: restaurantCode }).toString();
            const res = await fetch(`/api/delivery/boys?${query}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-restaurant-id': restaurantCode,
                },
                body: JSON.stringify({ action: 'delete', restaurantId: restaurantCode, deliveryBoyId: boyId }),
            });
            const d = await res.json();
            if (!res.ok) throw new Error(d.error);
            setSuccess('Delivery boy removed');
            fetchAll();
            setTimeout(() => setSuccess(''), 3000);
        } catch (err: any) {
            setError(err.message);
        }
    };

    // Filter unregistered employees for add-delivery-boy modal
    const registeredEmployeeIds = new Set(deliveryBoys.map(b => b.employee_id));
    const availableEmployees = employees.filter(e =>
        !registeredEmployeeIds.has(e.id) &&
        e.name?.toLowerCase().includes(searchBoy.toLowerCase())
    );

    const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
        { key: 'boys', label: 'Delivery Boys', icon: Users, count: deliveryBoys.length },
        { key: 'zones', label: 'Delivery Zones', icon: MapPin, count: deliveryZones.length },
        { key: 'settings', label: 'Settings', icon: Settings },
    ];

    if (!entLoading && !hasFeature('delivery')) {
        return (
            <FeatureLockedGate
                feature="delivery"
                restaurantCode={restaurantCode}
                currentPlanName={planName}
                isSuspended={isSuspended}
                isExpired={isExpired}
            />
        );
    }

    return (
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-4">
                    <Link
                        href={`/${restaurantCode}/admin/orders`}
                        className="px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 hover:bg-neutral-50 dark:hover:bg-zinc-700 text-neutral-700 dark:text-neutral-200 transition-colors flex items-center gap-1.5 text-xs font-bold shadow-xs cursor-pointer"
                        title="Back to Live Orders"
                    >
                        <ArrowLeft size={16} />
                        <span>Live Orders</span>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                                <Truck size={20} className="text-white" />
                            </div>
                            Manage Delivery
                        </h1>
                        <p className="text-sm text-neutral-500 mt-1">Configure delivery boys, delivery zones, and dispatch settings</p>
                    </div>
                </div>
                <button
                    onClick={() => fetchAll()}
                    className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 hover:bg-neutral-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer self-start sm:self-auto"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Alerts */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center gap-2"
                    >
                        <AlertCircle size={16} /> {error}
                        <button onClick={() => setError('')} className="ml-auto cursor-pointer"><X size={14} /></button>
                    </motion.div>
                )}
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="mb-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm flex items-center gap-2"
                    >
                        <CheckCircle2 size={16} /> {success}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Tab Navigation & Restaurant Location Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div className="flex gap-1 p-1 bg-neutral-100 dark:bg-zinc-800/60 rounded-2xl w-fit">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                                tab === t.key
                                    ? 'bg-white dark:bg-zinc-700 text-neutral-900 dark:text-white shadow-sm'
                                    : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                            }`}
                        >
                            <t.icon size={16} />
                            {t.label}
                            {t.count !== undefined && (
                                <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    tab === t.key ? 'bg-orange-100 text-orange-600' : 'bg-neutral-200 dark:bg-zinc-700 text-neutral-500'
                                }`}>
                                    {t.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Quick Kitchen Origin Status Pill - Points strictly to Settings */}
                <div
                    onClick={() => setTab('settings')}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200/80 dark:border-zinc-800 shadow-xs cursor-pointer hover:border-orange-300 dark:hover:border-orange-800 transition-all text-xs self-start sm:self-auto"
                    title="Click to manage restaurant dispatch origin & settings"
                >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        settings.latitude != null && settings.longitude != null ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                    }`} />
                    <span className="font-bold text-neutral-700 dark:text-neutral-300 truncate max-w-[200px]">
                        {settings.latitude != null && settings.longitude != null
                            ? `📍 Kitchen: ${settings.latitude.toFixed(4)}, ${settings.longitude.toFixed(4)}`
                            : '⚠️ Kitchen Location Not Set'}
                    </span>
                    <span className="text-[10px] text-orange-600 dark:text-orange-400 font-bold shrink-0">
                        {settings.latitude != null ? 'Edit in Settings →' : 'Set in Settings →'}
                    </span>
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════ */}
            {/* DELIVERY BOYS TAB */}
            {/* ════════════════════════════════════════════════════════════ */}
            {tab === 'boys' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-neutral-500">
                            {deliveryBoys.length} delivery {deliveryBoys.length === 1 ? 'boy' : 'boys'} registered
                        </p>
                        <button
                            onClick={() => setShowAddBoy(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 text-white text-sm font-bold shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all cursor-pointer"
                        >
                            <Plus size={16} /> Add Delivery Boy
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 size={24} className="animate-spin text-neutral-400" />
                        </div>
                    ) : deliveryBoys.length === 0 ? (
                        <div className="text-center py-20 text-neutral-400">
                            <Users size={48} className="mx-auto mb-4 opacity-40" />
                            <p className="text-lg font-semibold">No delivery boys registered</p>
                            <p className="text-sm mt-1">Add staff members as delivery boys to get started</p>
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {deliveryBoys.map(boy => {
                                const bs = BOY_STATUS_CONFIG[boy.status] || BOY_STATUS_CONFIG['offline'];
                                return (
                                    <motion.div
                                        key={boy.id}
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-neutral-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-11 h-11 rounded-xl bg-neutral-100 dark:bg-zinc-800 flex items-center justify-center text-lg font-black text-neutral-600 dark:text-neutral-300">
                                                    {boy.avatar_url ? (
                                                        <img src={boy.avatar_url} className="w-full h-full rounded-xl object-cover" alt="" />
                                                    ) : (
                                                        boy.name?.charAt(0)?.toUpperCase() || '?'
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-neutral-800 dark:text-neutral-200">{boy.name}</p>
                                                    <p className="text-xs text-neutral-500">{boy.mobile}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className={`w-2 h-2 rounded-full ${bs.dot}`} />
                                                <span className="text-[10px] font-bold text-neutral-500">{bs.label}</span>
                                            </div>
                                        </div>

                                        {(boy.vehicle_type || boy.vehicle_number) && (
                                            <div className="mt-3 flex items-center gap-2 text-xs text-neutral-500">
                                                {boy.vehicle_type === 'bike' ? <Bike size={14} /> : <Car size={14} />}
                                                <span>{boy.vehicle_type}{boy.vehicle_number ? ` • ${boy.vehicle_number}` : ''}</span>
                                            </div>
                                        )}

                                        <div className="mt-4 flex gap-2">
                                            <button
                                                onClick={() => handleUpdateBoy(boy.id, { status: boy.status === 'active' ? 'inactive' : 'active' })}
                                                className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 hover:bg-neutral-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                                            >
                                                {boy.status === 'active' ? 'Deactivate' : 'Activate'}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteBoy(boy.id)}
                                                className="px-3 py-2 rounded-lg text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 hover:bg-red-100 transition-colors cursor-pointer"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* DELIVERY ZONES TAB (POSTGIS POLYGONS) */}
            {/* ════════════════════════════════════════════════════════════ */}
            {tab === 'zones' && (
                <div className="space-y-6">
                    <DeliveryZonesManager 
                        restaurantCode={restaurantCode} 
                        onGoToSettings={() => setTab('settings')}
                    />
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* SETTINGS TAB (OFFICIAL PLACE FOR RESTAURANT LOCATION) */}
            {/* ════════════════════════════════════════════════════════════ */}
            {tab === 'settings' && (
                <div className="max-w-4xl space-y-6">
                    <RestaurantLocationPicker
                        restaurantCode={restaurantCode}
                        initialSettings={settings}
                        onSaved={(updated) => {
                            setSettings(updated);
                            fetchAll();
                        }}
                        onGoToZones={() => setTab('zones')}
                    />
                </div>
            )}

            {/* ════════════════════════════════════════════════════════════ */}
            {/* ADD DELIVERY BOY MODAL */}
            {/* ════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {showAddBoy && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
                        onClick={() => setShowAddBoy(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl"
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-black text-neutral-800 dark:text-white mb-4">Add Delivery Boy</h3>

                            {/* Vehicle info */}
                            <div className="space-y-3 mb-4">
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 mb-1.5 block">Vehicle Type</label>
                                    <div className="flex gap-2">
                                        {['bike', 'car', 'bicycle', 'other'].map(v => (
                                            <button
                                                key={v}
                                                onClick={() => setVehicleType(v)}
                                                className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                                                    vehicleType === v
                                                        ? 'bg-orange-500 text-white'
                                                        : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-neutral-400'
                                                }`}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 mb-1.5 block">Vehicle Number (optional)</label>
                                    <input
                                        type="text"
                                        value={vehicleNumber}
                                        onChange={e => setVehicleNumber(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                        placeholder="e.g. KA-01-AB-1234"
                                    />
                                </div>
                            </div>

                            {/* Search employees */}
                            <div className="relative mb-3">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                <input
                                    type="text"
                                    value={searchBoy}
                                    onChange={e => setSearchBoy(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-neutral-50 dark:bg-zinc-800 border border-neutral-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                    placeholder="Search staff by name..."
                                />
                            </div>

                            <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 mb-2">
                                Select an employee ({availableEmployees.length} available)
                            </p>

                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {availableEmployees.length === 0 ? (
                                    <p className="text-sm text-neutral-400 text-center py-8">No available employees found</p>
                                ) : (
                                    availableEmployees.map(emp => (
                                        <button
                                            key={emp.id}
                                            onClick={() => handleAddDeliveryBoy(emp.id)}
                                            className="w-full flex items-center gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-zinc-800 hover:bg-orange-50 dark:hover:bg-zinc-700 border border-neutral-200 dark:border-zinc-700 transition-all cursor-pointer text-left"
                                        >
                                            <div className="w-9 h-9 rounded-lg bg-neutral-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-bold">
                                                {emp.name?.charAt(0)?.toUpperCase() || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 truncate">{emp.name}</p>
                                                <p className="text-xs text-neutral-500">{emp.mobile} • {emp.role}</p>
                                            </div>
                                            <ChevronRight size={14} className="text-neutral-400" />
                                        </button>
                                    ))
                                )}
                            </div>

                            <button
                                onClick={() => setShowAddBoy(false)}
                                className="mt-4 w-full py-2.5 rounded-xl bg-neutral-100 dark:bg-zinc-800 text-sm font-semibold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
