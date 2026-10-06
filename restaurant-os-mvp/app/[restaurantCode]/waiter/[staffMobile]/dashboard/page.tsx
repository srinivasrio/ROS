'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Store, X, MapPin, ChevronDown, LayoutGrid, Link2, Move, Pin, Trash2,
    Trees, Crown, Wine, Sun, Users, Check, RefreshCw, CheckCheck,
    UserCheck, Sparkles, ChefHat, Utensils,
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { OrderService, type Order } from '@/services/orders.service';
import { RestaurantService } from '@/services/restaurant.service';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import {
    AppButton, haptic, springSoft, useIsHydrated, tableOpenStore
} from '../../components/ui';
import { TableCard, type FloorTable } from '../../components/TableCard';
import { TableDetailsSheet } from '../../components/TableDetailsSheet';

const supabase = createClient();

type FilterKey = 'ALL' | 'PREPARING' | 'READY' | 'AVAILABLE';

const FILTER_META: Record<FilterKey, { label: string; color: string }> = {
    ALL: { label: 'All', color: '#FF6B35' },
    PREPARING: { label: 'Preparing', color: '#FFDE63' },
    READY: { label: 'Ready', color: '#8F87F1' },
    AVAILABLE: { label: 'Available', color: '#ABE7B2' },
};

interface AreaRow { id: string; name: string }

function areaIcon(name: string) {
    const n = name.toLowerCase();
    if (/outdoor|garden|terrace/.test(n)) return Trees;
    if (/vip|private|premium/.test(n)) return Crown;
    if (/bar|lounge/.test(n)) return Wine;
    if (/rooftop|top/.test(n)) return Sun;
    if (/family|hall/.test(n)) return Users;
    return MapPin;
}

// Persistent in-memory cache for instant tab switching without screen reload/skeleton flash
let cachedDashboard: {
    restaurantId: string;
    tables: FloorTable[];
    orders: Order[];
    areas: AreaRow[];
    restaurantName: string;
    restaurantLogo?: string | null;
    waiterRecord?: any;
} | null = null;

export default function WaiterDashboard() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const router = useRouter();
    const params = useParams();
    const restaurantCode = (params?.restaurantCode as string) || '';
    const staffMobile = params?.staffMobile as string;

    const isHydrated = useIsHydrated();
    const hasCache = isHydrated && Boolean(cachedDashboard && (cachedDashboard.restaurantId === restaurantId || cachedDashboard.restaurantId === restaurantCode) && cachedDashboard.tables.length > 0);

    const [tables, setTables] = useState<FloorTable[]>(() => hasCache ? cachedDashboard!.tables : []);
    const [orders, setOrders] = useState<Order[]>(() => hasCache ? cachedDashboard!.orders : []);
    const [areas, setAreas] = useState<AreaRow[]>(() => hasCache ? cachedDashboard!.areas : []);
    const [loading, setLoading] = useState(!hasCache);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterKey>('ALL');
    const [areaFilter, setAreaFilter] = useState<string | null>(null);
    const [areasOpen, setAreasOpen] = useState(false);
    const [restaurantName, setRestaurantName] = useState(() => hasCache ? cachedDashboard!.restaurantName : '');
    const [restaurantLogo, setRestaurantLogo] = useState<string | null>(() => hasCache ? (cachedDashboard?.restaurantLogo || null) : null);

    const [selecting, setSelecting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]);
    const [mergeSheetOpen, setMergeSheetOpen] = useState(false);
    const [moveSheetOpen, setMoveSheetOpen] = useState(false);
    const [detailsTable, setDetailsTable] = useState<FloorTable | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        tableOpenStore.set(Boolean(detailsTable));
        return () => {
            tableOpenStore.set(false);
        };
    }, [detailsTable]);

    const [waiterRecord, setWaiterRecord] = useState<any>(() => {
        if (!hasCache) return null;
        return cachedDashboard?.waiterRecord || null;
    });
    const waiterRecordRef = useRef<any>(waiterRecord);
    useEffect(() => {
        waiterRecordRef.current = waiterRecord;
    }, [waiterRecord]);
    const reloadDebounceRef = useRef<NodeJS.Timeout | null>(null);
    const restaurantNameRef = useRef(restaurantName);
    useEffect(() => { restaurantNameRef.current = restaurantName; }, [restaurantName]);
    const restaurantLogoRef = useRef(restaurantLogo);
    useEffect(() => { restaurantLogoRef.current = restaurantLogo; }, [restaurantLogo]);
    const loadTablesRef = useRef<((background?: boolean) => Promise<void>) | null>(null);

    const [pendingCartCount, setPendingCartCount] = useState<number>(0);

    useEffect(() => {
        const checkPendingCart = () => {
            try {
                const restCode = (params?.restaurantCode as string) || '';
                const raw = sessionStorage.getItem(`waiter_browse_cart_${restaurantId}`) ||
                    (restCode ? sessionStorage.getItem(`waiter_browse_cart_${restCode}`) : null);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    const totalQty = Object.values(parsed.cart || {}).reduce((s: number, q: any) => s + Number(q || 0), 0);
                    setPendingCartCount(totalQty);
                } else {
                    setPendingCartCount(0);
                }
            } catch (_) {
                setPendingCartCount(0);
            }
        };
        checkPendingCart();
        window.addEventListener('focus', checkPendingCart);
        return () => window.removeEventListener('focus', checkPendingCart);
    }, [restaurantId, params?.restaurantCode, detailsTable]);

    /* ── Current waiter & live status synchronization ──────────────── */
    const syncWaiterStatus = useCallback(async () => {
        if (!restaurantId || !staffMobile) return;
        const cleanMobile = staffMobile.replace(/[^0-9]/g, '').slice(-10);

        try {
            // 1. Fetch live status from /api/waiter/status
            const statusUrl = `/api/waiter/status?mobile=${encodeURIComponent(cleanMobile)}&restaurantId=${encodeURIComponent(restaurantId)}`;
            const res = await fetch(statusUrl);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    setWaiterRecord((prev: any) => {
                        const updated = {
                            ...(prev || {}),
                            ...(data.waiter || {}),
                            is_online: Boolean(data.is_online),
                            availability_status: data.availability_status || (data.is_online ? 'available' : 'offline'),
                            status: data.account_status || prev?.status || 'active'
                        };
                        try {
                            if (cleanMobile) localStorage.setItem(`waiterSession_${cleanMobile}`, JSON.stringify(updated));
                            localStorage.setItem('waiterSession', JSON.stringify(updated));
                        } catch (_) {}
                        return updated;
                    });
                }
            }
        } catch (_) {}

        try {
            // 2. Fetch full staff record from OrderService
            const rec = await OrderService.getStaffByMobile(staffMobile, restaurantId);
            if (rec) {
                setWaiterRecord((prev: any) => {
                    const merged = {
                        ...(prev || {}),
                        ...rec,
                        is_online: rec.is_online !== undefined ? Boolean(rec.is_online) : (prev?.is_online ?? true),
                        availability_status: rec.availability_status || prev?.availability_status || (rec.is_online ? 'available' : 'offline'),
                        status: rec.status || prev?.status || 'active'
                    };
                    if (cachedDashboard) cachedDashboard.waiterRecord = merged;
                    try {
                        if (cleanMobile) localStorage.setItem(`waiterSession_${cleanMobile}`, JSON.stringify(merged));
                        localStorage.setItem('waiterSession', JSON.stringify(merged));
                    } catch (_) {}
                    return merged;
                });
            }
        } catch (e) {
            console.error('Error syncing staff record:', e);
        }
    }, [restaurantId, staffMobile]);

    useEffect(() => {
        try {
            const cleanMobile = staffMobile ? staffMobile.replace(/[^0-9]/g, '').slice(-10) : '';
            const cachedStaff = cleanMobile ? localStorage.getItem(`waiterSession_${cleanMobile}`) : null;
            let sessionCached = null;
            try { sessionCached = sessionStorage.getItem('waiterSession'); } catch (_) { }
            const defaultCached = localStorage.getItem('waiterSession');
            const candidate = cachedStaff || sessionCached || defaultCached;
            if (candidate) {
                const parsed = JSON.parse(candidate);
                const parsedMobile = (parsed?.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                if (parsed?.id && (!cleanMobile || !parsedMobile || parsedMobile === cleanMobile)) {
                    setWaiterRecord(parsed);
                    if (cachedDashboard) cachedDashboard.waiterRecord = parsed;
                }
            }
        } catch (_) { }

        syncWaiterStatus();

        // Re-sync on tab focus or when status is updated in profile
        const handleStatusRefresh = () => {
            syncWaiterStatus();
        };
        window.addEventListener('focus', handleStatusRefresh);
        window.addEventListener('storage', handleStatusRefresh);
        window.addEventListener('waiter-status-changed', handleStatusRefresh);

        return () => {
            window.removeEventListener('focus', handleStatusRefresh);
            window.removeEventListener('storage', handleStatusRefresh);
            window.removeEventListener('waiter-status-changed', handleStatusRefresh);
        };
    }, [restaurantId, staffMobile, syncWaiterStatus]);

    // Realtime subscription for live employee status updates (e.g. online/offline)
    useEffect(() => {
        if (!restaurantId) return;
        const cleanMobile = staffMobile ? staffMobile.replace(/[^0-9]/g, '').slice(-10) : '';
        const channel = supabase
            .channel(`waiter-status-live-${restaurantId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'employees',
                    filter: `restaurant_id=eq.${restaurantId}`
                },
                (payload) => {
                    const newRow = payload.new as any;
                    if (!newRow) return;
                    const rowMobile = String(newRow.mobile || '').replace(/[^0-9]/g, '').slice(-10);
                    const matchesId = waiterRecord?.id && String(newRow.id) === String(waiterRecord.id);
                    const matchesMobile = cleanMobile && rowMobile === cleanMobile;
                    if (matchesId || matchesMobile) {
                        setWaiterRecord((prev: any) => {
                            const updated = {
                                ...(prev || {}),
                                ...newRow,
                                is_online: Boolean(newRow.is_online),
                                availability_status: newRow.availability_status || (newRow.is_online ? 'available' : 'offline'),
                                status: newRow.status || prev?.status || 'active'
                            };
                            try {
                                if (cleanMobile) localStorage.setItem(`waiterSession_${cleanMobile}`, JSON.stringify(updated));
                                localStorage.setItem('waiterSession', JSON.stringify(updated));
                            } catch (_) {}
                            return updated;
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [restaurantId, staffMobile, waiterRecord?.id]);

    const isAccountActive = useMemo(() => {
        if (!waiterRecord) return true; // Default to true while pending/loading to prevent false warning flash
        const s = (waiterRecord.status || 'active').toLowerCase();
        return s !== 'inactive' && s !== 'deactivated' && s !== 'suspended';
    }, [waiterRecord]);

    const isOnline = useMemo(() => {
        if (!waiterRecord) return false;
        const avail = (waiterRecord.availability_status || '').toLowerCase();
        if (avail === 'offline' || avail === 'break') return false;
        if (waiterRecord.is_online === true || ['available', 'busy', 'online'].includes(avail)) return true;
        return Boolean(waiterRecord.is_online);
    }, [waiterRecord]);

    const [togglingOnline, setTogglingOnline] = useState(false);
    const handleQuickToggleOnline = async () => {
        if (!waiterRecord?.id || togglingOnline) return;
        setTogglingOnline(true);
        try {
            const newOnline = !isOnline;
            const newAvail = newOnline ? 'available' : 'offline';

            let apiSuccess = false;
            try {
                const res = await fetch('/api/waiter/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        isOnline: newOnline,
                        waiterId: waiterRecord.id,
                        mobile: staffMobile,
                        restaurantId: restaurantId
                    })
                });
                const resData = await res.json().catch(() => ({}));
                if (res.ok && resData.success) {
                    apiSuccess = true;
                } else if (!res.ok && resData.error) {
                    throw new Error(resData.error);
                }
            } catch (apiErr: any) {
                if (apiErr.message && !apiErr.message.includes('fetch') && !apiErr.message.includes('Failed to fetch')) {
                    throw apiErr;
                }
            }

            if (!apiSuccess) {
                const { error } = await supabase
                    .from('employees')
                    .update({
                        is_online: newOnline,
                        availability_status: newAvail,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', waiterRecord.id);

                if (error) throw error;
            }

            const updated = {
                ...waiterRecord,
                is_online: newOnline,
                availability_status: newAvail
            };
            setWaiterRecord(updated);
            try {
                const cleanMobile = staffMobile ? staffMobile.replace(/[^0-9]/g, '').slice(-10) : '';
                if (cleanMobile) localStorage.setItem(`waiterSession_${cleanMobile}`, JSON.stringify(updated));
                localStorage.setItem('waiterSession', JSON.stringify(updated));
                window.dispatchEvent(new CustomEvent('waiter-status-changed', { detail: { isOnline: newOnline, availability_status: newAvail } }));
            } catch (_) { }
            toast.success(newOnline ? 'You are now Online' : 'You are now Offline');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to update online status');
        } finally {
            setTogglingOnline(false);
        }
    };

    /* ── Data loading (RPC parity with Flutter) ──────────────── */
    const loadTables = useCallback(async (background = false) => {
        if (!restaurantId) return;
        if (!background) setRefreshing(true);
        try {
            const [rpcRes, activeOrders, areasRes]: [any, any, any] = await Promise.all([
                supabase.rpc('get_tables_by_restaurant', { p_restaurant_id: restaurantId }),
                OrderService.fetchActiveOrders(restaurantId),
                supabase.from('restaurant_areas').select('id, name').eq('restaurant_id', restaurantId)
            ]);

            let rows: any[] = Array.isArray(rpcRes?.data) ? rpcRes.data : [];
            if (rows.length === 0) {
                const direct = await OrderService.fetchTables(restaurantId);
                rows = Array.isArray(direct) ? (direct as any[]) : [];
            }
            setTables(rows);
            setOrders(activeOrders || []);
            const areaRows: any[] = Array.isArray(areasRes?.data) ? areasRes.data : [];
            if (!areasRes?.error && areaRows.length > 0) setAreas(areaRows);

            // Auto-dismiss or update TableDetailsSheet if currently open
            setDetailsTable((currentOpen) => {
                if (!currentOpen) return null;
                const fresh = rows.find((r) =>
                    String(r.id) === String(currentOpen.id) ||
                    (currentOpen.is_group && r.merged_group_id && r.merged_group_id === currentOpen.merged_group_id)
                );
                if (!fresh) return null;

                const isAvail = ['available', 'free', 'empty'].includes((fresh.status || '').toLowerCase());
                const role = (waiterRecordRef.current?.role || '').toLowerCase();
                const isAdmin = ['admin', 'manager', 'supervisor'].includes(role);
                const currentStaffId = waiterRecordRef.current?.id;
                const isMine = currentStaffId && fresh.assigned_waiter_id === currentStaffId;
                const coWaiters = Array.isArray(fresh.co_waiter_ids) ? fresh.co_waiter_ids : [];
                const isCo = currentStaffId && coWaiters.includes(currentStaffId);

                // Keep sheet open with fresh table data so any waiter can view & take orders
                return { ...currentOpen, ...fresh };
            });

            if (restaurantId) {
                cachedDashboard = {
                    restaurantId,
                    tables: rows,
                    orders: activeOrders || [],
                    areas: areaRows.length > 0 ? areaRows : (cachedDashboard?.areas || []),
                    restaurantName: restaurantNameRef.current || cachedDashboard?.restaurantName || '',
                    restaurantLogo: restaurantLogoRef.current || cachedDashboard?.restaurantLogo || null
                };
            }
        } catch (e) {
            console.error('Failed to load tables:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [restaurantId]);

    useEffect(() => {
        loadTablesRef.current = loadTables;
    }, [loadTables]);

    const debouncedReload = useCallback(() => {
        if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
        reloadDebounceRef.current = setTimeout(() => {
            loadTablesRef.current?.(true);
        }, 250);
    }, []);

    const handleTableCleared = useCallback((targetId: string | number) => {
        setTables((prev) =>
            prev.map((t) => {
                const isMatch = String(t.id) === String(targetId) ||
                    (t.is_group && t.merged_group_id === String(targetId)) ||
                    (t.merged_group_id && String(t.merged_group_id) === String(targetId));
                if (!isMatch) return t;
                return {
                    ...t,
                    status: 'available',
                    assigned_waiter_id: null,
                    assigned_waiter_name: null,
                    assigned_waiter_avatar: null,
                    co_waiter_ids: [],
                    co_waiter_names: null,
                    customer_present_at: null,
                    last_activity_at: null,
                    alert_status: null,
                    readyCount: 0,
                    active_order_total: null,
                    active_item_count: null,
                };
            })
        );
    }, []);

    /* eslint-disable react-hooks/exhaustive-deps */
    useEffect(() => {
        if (!restaurantLoading && restaurantId) {
            loadTables();

            // Controlled sync on tab visibility or network reconnection (P0 fix WT-01)
            const handleSyncOnVisible = () => {
                if (document.visibilityState === 'visible') {
                    debouncedReload();
                }
            };
            document.addEventListener('visibilitychange', handleSyncOnVisible);
            window.addEventListener('online', handleSyncOnVisible);

            const subTables = OrderService.subscribeToTables(restaurantId, debouncedReload);
            const subOrders = OrderService.subscribeToOrders(restaurantId, debouncedReload);
            const subItems = OrderService.subscribeToOrderItems(restaurantId, debouncedReload);
            const subMerge = OrderService.subscribeToMergeGroups(restaurantId, debouncedReload);

            return () => {
                document.removeEventListener('visibilitychange', handleSyncOnVisible);
                window.removeEventListener('online', handleSyncOnVisible);
                if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
                subTables.unsubscribe();
                subOrders.unsubscribe();
                subItems.unsubscribe();
                subMerge.unsubscribe();
            };
        }
    }, [restaurantId, restaurantLoading, debouncedReload]);
    /* eslint-enable react-hooks/exhaustive-deps */

    /* Restaurant name & logo */
    useEffect(() => {
        const targetId = restaurantId || restaurantCode;
        if (!targetId) return;
        let active = true;

        RestaurantService.getRestaurantInfo(targetId)
            .then((info) => {
                if (!active) return;
                if (info?.name) {
                    setRestaurantName(info.name);
                    if (cachedDashboard) cachedDashboard.restaurantName = info.name;
                }
                if (info?.logo_url) {
                    setRestaurantLogo(info.logo_url);
                    if (cachedDashboard) cachedDashboard.restaurantLogo = info.logo_url;
                }
            })
            .catch((err) => {
                console.error('Failed to load restaurant info for waiter dashboard:', err);
            });

        return () => {
            active = false;
        };
    }, [restaurantId, restaurantCode]);

    /* ── Consolidation (merged groups → single entries + order amounts) ──────── */
    const floor: FloorTable[] = useMemo(() => {
        const out: FloorTable[] = [];
        const seenGroups = new Set<string>();
        const readyByTable = new Map<number | string, number>();
        const readyByGroup = new Map<string, number>();
        const prepByTable = new Map<number | string, number>();
        const prepByGroup = new Map<string, number>();
        const totalByTable = new Map<number | string, number>();
        const totalByGroup = new Map<string, number>();
        const itemCountByTable = new Map<number | string, number>();
        const itemCountByGroup = new Map<string, number>();

        orders.forEach((o) => {
            const ordStatus = (o.status || '').toLowerCase();
            const isOrderPrep = ['preparing', 'cooking', 'placed'].includes(ordStatus);
            const ordTotal = Number(o.total_amount ?? 0);
            const ordItemsCount = Array.isArray(o.items) ? o.items.length : 0;

            if (o.merge_group_id) {
                const gid = String(o.merge_group_id);
                totalByGroup.set(gid, (totalByGroup.get(gid) || 0) + ordTotal);
                itemCountByGroup.set(gid, (itemCountByGroup.get(gid) || 0) + ordItemsCount);
            } else if (o.table_id != null) {
                totalByTable.set(o.table_id, (totalByTable.get(o.table_id) || 0) + ordTotal);
                itemCountByTable.set(o.table_id, (itemCountByTable.get(o.table_id) || 0) + ordItemsCount);
            }

            (o.items || []).forEach((i: any) => {
                const itemStatus = (i.status || '').toLowerCase();
                if (itemStatus === 'ready') {
                    if (o.merge_group_id) {
                        readyByGroup.set(String(o.merge_group_id), (readyByGroup.get(String(o.merge_group_id)) || 0) + 1);
                    } else if (o.table_id != null) {
                        readyByTable.set(o.table_id, (readyByTable.get(o.table_id) || 0) + 1);
                    }
                } else if (['preparing', 'cooking', 'placed'].includes(itemStatus) || isOrderPrep) {
                    if (o.merge_group_id) {
                        prepByGroup.set(String(o.merge_group_id), (prepByGroup.get(String(o.merge_group_id)) || 0) + 1);
                    } else if (o.table_id != null) {
                        prepByTable.set(o.table_id, (prepByTable.get(o.table_id) || 0) + 1);
                    }
                }
            });
            if ((!o.items || o.items.length === 0) && isOrderPrep) {
                if (o.merge_group_id) {
                    prepByGroup.set(String(o.merge_group_id), (prepByGroup.get(String(o.merge_group_id)) || 0) + 1);
                } else if (o.table_id != null) {
                    prepByTable.set(o.table_id, (prepByTable.get(o.table_id) || 0) + 1);
                }
            }
        });

        const isAdmin = waiterRecord?.role && ['admin', 'supervisor', 'restaurant_admin'].includes(waiterRecord.role);

        const waiterId = waiterRecord?.id ? String(waiterRecord.id).toLowerCase() : '';
        const waiterEmpId = waiterRecord?.employee_id ? String(waiterRecord.employee_id).toLowerCase() : '';
        const waiterMobile = waiterRecord?.mobile ? String(waiterRecord.mobile).trim() : '';

        tables.forEach((t: any) => {
            const assignedId = t.assigned_waiter_id ? String(t.assigned_waiter_id).toLowerCase() : '';
            const isMine = !!(waiterId && assignedId && (assignedId === waiterId || (waiterEmpId && assignedId === waiterEmpId) || (waiterMobile && assignedId === waiterMobile)));
            const coWaiters: string[] = Array.isArray(t.co_waiter_ids) ? t.co_waiter_ids.map((x: any) => String(x).toLowerCase()) : [];
            const isCo = !!(waiterId && (coWaiters.includes(waiterId) || (waiterEmpId && coWaiters.includes(waiterEmpId))));
            const canManage = !!isAdmin || isMine || isCo || !t.assigned_waiter_id;

            if (t.is_merged && t.merged_group_id) {
                if (seenGroups.has(t.merged_group_id)) return;
                seenGroups.add(t.merged_group_id);
                const members = tables.filter((x: any) => x.merged_group_id === t.merged_group_id);
                const priority = ['need_bill', 'dirty', 'occupied', 'on_hold', 'reserved', 'available'];
                const groupStatus = members
                    .map((m) => (m.status || '').toLowerCase())
                    .sort((a, b) => priority.indexOf(a) - priority.indexOf(b))[0] || 'available';
                const matchOrder = orders.find((o: any) => o.merge_group_id === t.merged_group_id && !o.is_completed);
                out.push({
                    ...t,
                    is_group: true,
                    capacity: members.reduce((s, m) => s + (m.capacity || 0), 0),
                    status: groupStatus,
                    member_tables: members,
                    assigned_waiter_id: t.assigned_waiter_id || matchOrder?.waiter_id || null,
                    assigned_waiter_name: t.assigned_waiter_name || matchOrder?.waiter_name || null,
                    assigned_waiter_avatar: t.assigned_waiter_avatar || matchOrder?.waiter_avatar || null,
                    readyCount: canManage ? (readyByGroup.get(String(t.merged_group_id)) || 0) : 0,
                    preparingCount: canManage ? (prepByGroup.get(String(t.merged_group_id)) || 0) : 0,
                    active_order_total: totalByGroup.get(String(t.merged_group_id)) || null,
                    active_item_count: itemCountByGroup.get(String(t.merged_group_id)) || null,
                });
            } else {
                const matchOrder = orders.find((o: any) => o.table_id === t.id && !o.is_completed);
                out.push({
                    ...t,
                    is_group: false,
                    assigned_waiter_id: t.assigned_waiter_id || matchOrder?.waiter_id || null,
                    assigned_waiter_name: t.assigned_waiter_name || matchOrder?.waiter_name || null,
                    assigned_waiter_avatar: t.assigned_waiter_avatar || matchOrder?.waiter_avatar || null,
                    readyCount: canManage ? (readyByTable.get(t.id) || 0) : 0,
                    preparingCount: canManage ? (prepByTable.get(t.id) || 0) : 0,
                    active_order_total: totalByTable.get(t.id) || null,
                    active_item_count: itemCountByTable.get(t.id) || null,
                });
            }
        });

        /* Pinned first (Flutter parity) */
        return out.sort((a, b) => Number(b.is_pinned || false) - Number(a.is_pinned || false));
    }, [tables, orders, waiterRecord]);

    const isAssignedToMe = useCallback((t: FloorTable) => {
        if (!waiterRecord?.id) return false;
        const waiterId = String(waiterRecord.id).toLowerCase();
        const waiterEmpId = waiterRecord.employee_id ? String(waiterRecord.employee_id).toLowerCase() : '';
        const waiterMobile = waiterRecord.mobile ? String(waiterRecord.mobile).trim() : '';

        const assignedId = t.assigned_waiter_id ? String(t.assigned_waiter_id).toLowerCase() : '';
        const isMine = !!(assignedId && (assignedId === waiterId || (waiterEmpId && assignedId === waiterEmpId) || (waiterMobile && assignedId === waiterMobile)));
        const coWaiters = Array.isArray(t.co_waiter_ids) ? t.co_waiter_ids.map((id: any) => String(id).toLowerCase()) : [];
        const isCo = coWaiters.includes(waiterId) || (waiterEmpId ? coWaiters.includes(waiterEmpId) : false);
        return isMine || isCo;
    }, [waiterRecord]);

    const { allTables, myTables, otherTables, availableTables, readyTables, preparingTables } = useMemo(() => {
        const areaFiltered = areaFilter
            ? floor.filter((t) => t.area_id === areaFilter || t.area_name === areaFilter || t.is_group)
            : floor;

        const my: FloorTable[] = [];
        const other: FloorTable[] = [];
        const avail: FloorTable[] = [];
        const ready: FloorTable[] = [];
        const prep: FloorTable[] = [];

        areaFiltered.forEach((t) => {
            const s = (t.status || '').toLowerCase();
            const isAvail = ['available', 'free', 'empty'].includes(s) && (!t.active_order_total || t.active_order_total === 0);
            const isMine = isAssignedToMe(t);

            if (isAvail) {
                avail.push(t);
            } else {
                if (isMine) {
                    my.push(t);
                } else {
                    other.push(t);
                }

                if (t.readyCount && t.readyCount > 0) {
                    ready.push(t);
                } else if (['preparing', 'cooking', 'placed'].includes(s) || (t.preparingCount && t.preparingCount > 0)) {
                    prep.push(t);
                }
            }
        });

        return {
            allTables: areaFiltered,
            myTables: my,
            otherTables: other,
            availableTables: avail,
            readyTables: ready,
            preparingTables: prep,
        };
    }, [floor, areaFilter, isAssignedToMe]);

    const counts = useMemo(() => {
        return {
            ALL: allTables.length,
            READY: readyTables.length,
            PREPARING: preparingTables.length,
            AVAILABLE: availableTables.length,
        };
    }, [allTables.length, readyTables.length, preparingTables.length, availableTables.length]);

    const visibleTables = useMemo(() => {
        switch (filter) {
            case 'READY': return readyTables;
            case 'PREPARING': return preparingTables;
            case 'AVAILABLE': return availableTables;
            default: return allTables;
        }
    }, [filter, readyTables, preparingTables, availableTables, allTables]);

    /* ── Selection actions ───────────────────────────────────── */
    const toggleSelect = (t: FloorTable) => {
        setSelectedIds((prev) => (prev.includes(t.id) ? prev.filter((id) => id !== t.id) : [...prev, t.id]));
    };

    const exitSelection = () => {
        setSelecting(false);
        setSelectedIds([]);
    };

    const selectedTables = floor.filter((t) => selectedIds.includes(t.id));

    const doMerge = async (tableIds: (number | string)[]) => {
        setBusy(true);
        try {
            await OrderService.mergeTables(tableIds.map(Number), restaurantId!);
            toast.success('Tables merged successfully');
            setMergeSheetOpen(false);
            exitSelection();
            loadTables(true);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to merge tables');
        } finally {
            setBusy(false);
        }
    };

    const doMoveArea = async (areaId: string | null) => {
        setBusy(true);
        try {
            await supabase.from('tables').update({ area_id: areaId }).in('id', selectedIds as any[]).eq('restaurant_id', restaurantId!);
            toast.success(`Moved tables to ${areas.find((a) => a.id === areaId)?.name || 'area'}`);
            setMoveSheetOpen(false);
            exitSelection();
            loadTables(true);
        } catch (e) {
            toast.error('Failed to move tables');
        } finally {
            setBusy(false);
        }
    };

    const doPin = async () => {
        const anyUnpinned = selectedTables.some((t) => !t.is_pinned);
        try {
            await supabase.from('tables').update({ is_pinned: anyUnpinned }).in('id', selectedIds as any[]).eq('restaurant_id', restaurantId!);
            toast.success('Pinned selected tables to the top');
            exitSelection();
            loadTables(true);
        } catch (e) {
            toast.error('Failed to update pin status');
        }
    };

    const doDelete = async () => {
        setBusy(true);
        try {
            await supabase.from('tables').delete().in('id', selectedIds as any[]).eq('restaurant_id', restaurantId!);
            toast.success('Deleted table(s) successfully');
            exitSelection();
            loadTables(true);
        } catch (e) {
            toast.error('Failed to delete tables');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            className="min-h-full pb-28 relative overflow-x-hidden"
            style={{ backgroundColor: '#EEF2F6' }}
            onClick={() => areasOpen && setAreasOpen(false)}
        >
            {/* ── App bar (Clean Compact Neumorphic Header) ─────────────────────── */}
            <header
                className="sticky top-0 z-30 flex items-center px-4 h-14 gap-2.5"
                style={{
                    backgroundColor: '#EEF2F6',
                    boxShadow: '0 4px 14px rgba(166, 180, 200, 0.22)',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.7)',
                }}
            >
                {selecting ? (
                    <>
                        <button
                            onClick={exitSelection}
                            aria-label="Exit selection"
                            className="size-9 -ml-1 rounded-xl flex items-center justify-center text-w-brand active:scale-95 transition-transform"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '2.5px 2.5px 6px rgba(166, 180, 200, 0.4), -2.5px -2.5px 6px rgba(255, 255, 255, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.7)',
                            }}
                        >
                            <X size={19} />
                        </button>
                        <h1 className="flex-1 text-center text-sm font-black text-w-brand tracking-tight truncate px-1">
                            {selectedIds.length} Table{selectedIds.length !== 1 ? 's' : ''} Selected
                        </h1>
                        <button
                            onClick={() => setSelectedIds(visibleTables.map((t) => t.id))}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-w-brand active:scale-95 transition-transform"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '2px 2px 5px rgba(166, 180, 200, 0.35), -2px -2px 5px rgba(255, 255, 255, 0.9)',
                                border: '1px solid rgba(255, 255, 255, 0.7)',
                            }}
                        >
                            Select All
                        </button>
                    </>
                ) : (
                    <>
                        <span
                            className="size-9 -ml-1 rounded-xl flex items-center justify-center text-w-brand shrink-0 overflow-hidden"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '2.5px 2.5px 6px rgba(166, 180, 200, 0.4), -2.5px -2.5px 6px rgba(255, 255, 255, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.7)',
                            }}
                        >
                            {restaurantLogo ? (
                                <img
                                    src={restaurantLogo}
                                    alt={restaurantName || 'Restaurant logo'}
                                    className="w-full h-full object-cover rounded-xl"
                                />
                            ) : (
                                <Store size={19} />
                            )}
                        </span>

                        <h1 suppressHydrationWarning className="flex-1 text-center text-[17px] font-black text-slate-800 tracking-tight truncate px-1.5 min-h-[24px] flex items-center justify-center">
                            {restaurantName || (
                                <span className="inline-block w-24 h-4 rounded bg-slate-300/60 animate-pulse" />
                            )}
                        </h1>

                        {/* Areas dropdown */}
                        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => { haptic.selection(); setAreasOpen(!areasOpen); }}
                                className={`inline-flex items-center gap-1.5 px-3 h-[32px] rounded-xl text-xs font-bold transition-all active:scale-95 ${areaFilter || areasOpen
                                        ? 'text-w-brand'
                                        : 'text-slate-700'
                                    }`}
                                style={{
                                    backgroundColor: '#EEF2F6',
                                    boxShadow: areaFilter || areasOpen
                                        ? 'inset 2px 2px 4px rgba(166, 180, 200, 0.45), inset -2px -2px 4px rgba(255, 255, 255, 0.95)'
                                        : '2.5px 2.5px 6px rgba(166, 180, 200, 0.38), -2.5px -2.5px 6px rgba(255, 255, 255, 0.95)',
                                    border: areaFilter || areasOpen ? '1px solid rgba(255, 107, 53, 0.4)' : '1px solid rgba(255, 255, 255, 0.7)',
                                }}
                            >
                                <MapPin size={13} className={areaFilter || areasOpen ? 'text-w-brand' : 'text-slate-500'} />
                                <span suppressHydrationWarning className="truncate max-w-[80px]">
                                    {areaFilter ? areas.find((a) => a.id === areaFilter)?.name || 'Areas' : 'Areas'}
                                </span>
                                <motion.span animate={{ rotate: areasOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                    <ChevronDown size={13} className="text-slate-400" />
                                </motion.span>
                            </button>

                            <AnimatePresence>
                                {areasOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                                        transition={{ duration: 0.18 }}
                                        className="absolute right-0 top-10 w-60 max-h-[400px] overflow-y-auto rounded-[22px] z-40 p-2.5"
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: '8px 8px 24px rgba(166, 180, 200, 0.5), -8px -8px 24px rgba(255, 255, 255, 0.95)',
                                            border: '1px solid rgba(255, 255, 255, 0.8)',
                                        }}
                                    >
                                        <div className="flex items-center justify-between px-2 py-1.5">
                                            <span className="inline-flex items-center gap-1.5 text-[14px] font-black text-slate-800">
                                                <MapPin size={14} className="text-w-brand" /> Areas
                                            </span>
                                            {areaFilter && (
                                                <button onClick={() => { setAreaFilter(null); setAreasOpen(false); }} className="text-xs font-bold text-w-brand">
                                                    Clear
                                                </button>
                                            )}
                                        </div>
                                        <AreaTile
                                            icon={LayoutGrid}
                                            label="All Areas"
                                            active={!areaFilter}
                                            onClick={() => { setAreaFilter(null); setAreasOpen(false); }}
                                            index={0}
                                        />
                                        {areas.map((a, i) => (
                                            <AreaTile
                                                key={a.id}
                                                icon={areaIcon(a.name)}
                                                label={a.name}
                                                active={areaFilter === a.id}
                                                onClick={() => { setAreaFilter(a.id); setAreasOpen(false); }}
                                                index={i + 1}
                                            />
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </>
                )}
            </header>

            {/* Account Inactive Alert */}
            {isHydrated && waiterRecord && !isAccountActive && (
                <div
                    className="mx-4 mt-2.5 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: 'inset 2px 2px 5px rgba(239, 68, 68, 0.2), inset -2px -2px 5px rgba(255, 255, 255, 0.9)',
                        border: '1px solid rgba(254, 202, 202, 0.8)',
                    }}
                >
                    <p className="font-semibold text-red-900">
                        Your account is <strong className="font-black">Inactive</strong> (Deactivated by Administrator). You cannot go online or receive orders.
                    </p>
                </div>
            )}

            {/* Offline Guidance Alert */}
            {isHydrated && waiterRecord && isAccountActive && !isOnline && (
                <div
                    className="mx-4 mt-2.5 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: 'inset 2px 2px 5px rgba(245, 158, 11, 0.2), inset -2px -2px 5px rgba(255, 255, 255, 0.9)',
                        border: '1px solid rgba(253, 230, 138, 0.8)',
                    }}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="size-2 rounded-full bg-amber-500 shrink-0 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
                        <p className="font-semibold text-amber-900 truncate">
                            You are <strong className="font-black">Offline</strong>. Turn online to take tables.
                        </p>
                    </div>
                    <button
                        onClick={handleQuickToggleOnline}
                        disabled={togglingOnline}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shrink-0 shadow-[2px_2px_6px_rgba(217,119,6,0.35)] active:scale-95 transition-all cursor-pointer"
                    >
                        Go Online
                    </button>
                </div>
            )}

            {/* ── Status filter chips (Neumorphic Pills) ─────────────────────────── */}
            <div
                className="px-4 py-2.5"
                style={{
                    backgroundColor: '#EEF2F6',
                    borderBottom: '1px solid rgba(203, 213, 225, 0.5)',
                }}
            >
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar items-center">
                    {(Object.keys(FILTER_META) as FilterKey[]).map((key) => {
                        const active = filter === key;
                        const m = FILTER_META[key];
                        const isLight = key === 'PREPARING' || key === 'AVAILABLE';
                        return (
                            <button
                                key={key}
                                onClick={() => { haptic.selection(); setFilter(key); }}
                                className={`shrink-0 inline-flex items-center gap-1.5 h-[34px] px-3.5 rounded-full text-[12px] transition-all active:scale-95 select-none ${active ? 'font-black' : 'font-bold text-slate-700'
                                    }`}
                                style={{
                                    backgroundColor: active ? m.color : '#EEF2F6',
                                    color: active ? (isLight ? '#0F172A' : '#FFFFFF') : '#334155',
                                    boxShadow: active
                                        ? `0 3px 10px ${m.color}66, inset 0 1px 1px rgba(255, 255, 255, 0.45)`
                                        : '3px 3px 7px rgba(166, 180, 200, 0.35), -3px -3px 7px rgba(255, 255, 255, 0.95)',
                                    border: active ? '1.5px solid rgba(0, 0, 0, 0.15)' : '1px solid rgba(255, 255, 255, 0.7)',
                                }}
                            >
                                <span
                                    className="size-2 rounded-full shrink-0"
                                    style={{
                                        backgroundColor: active ? (isLight ? '#0F172A' : '#FFFFFF') : m.color,
                                        boxShadow: active ? 'none' : `0 0 6px ${m.color}`,
                                    }}
                                />
                                <span>{m.label}</span>
                                <span
                                    suppressHydrationWarning
                                    className="w-num px-1.5 py-0.2 rounded-full text-[10.5px] font-black"
                                    style={{
                                        backgroundColor: active
                                            ? (isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.25)')
                                            : 'rgba(203, 213, 225, 0.55)',
                                        color: active ? (isLight ? '#0F172A' : '#FFFFFF') : '#475569',
                                        boxShadow: active ? 'none' : 'inset 1px 1px 2px rgba(166, 180, 200, 0.25)',
                                    }}
                                >
                                    {counts[key]}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── Main Content (Responsive Two-Column Neumorphic Grid) ─────────────────────────────────── */}
            <main className="px-4 pt-3.5 pb-8 overflow-x-hidden">
                {loading && tables.length === 0 ? (
                    <NeumorphicSkeletonGrid count={6} />
                ) : filter === 'ALL' ? (
                    allTables.length === 0 ? (
                        <NeumorphicEmptyState
                            icon={<LayoutGrid size={22} />}
                            title="No Tables Found"
                            body="No tables found in this restaurant or selected area."
                        />
                    ) : (
                        <div className="space-y-6">
                            {/* ── Section 1: My Tables ── */}
                            <section aria-labelledby="section-my-tables">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <span
                                            className="size-8 rounded-xl flex items-center justify-center text-w-brand shrink-0"
                                            style={{
                                                backgroundColor: '#EEF2F6',
                                                boxShadow: '2.5px 2.5px 6px rgba(166, 180, 200, 0.35), -2.5px -2.5px 6px rgba(255, 255, 255, 0.95)',
                                                border: '1px solid rgba(255, 255, 255, 0.7)',
                                            }}
                                        >
                                            <UserCheck size={16} />
                                        </span>
                                        <div>
                                            <h2 id="section-my-tables" className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                                                My Tables
                                                <span
                                                    className="px-2 py-0.2 rounded-full text-[10.5px] font-black"
                                                    style={{
                                                        backgroundColor: '#8CA9FF',
                                                        color: '#0F172A',
                                                        boxShadow: '0 1px 3px rgba(140, 169, 255, 0.4)',
                                                    }}
                                                >
                                                    {myTables.length}
                                                </span>
                                            </h2>
                                            <p className="text-[11px] text-slate-500 font-medium">Tables currently assigned to you</p>
                                        </div>
                                    </div>
                                </div>

                                {myTables.length === 0 ? (
                                    <div
                                        className="rounded-[22px] p-5 text-center flex flex-col items-center"
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: 'inset 2.5px 2.5px 6px rgba(166, 180, 200, 0.3), inset -2.5px -2.5px 6px rgba(255, 255, 255, 0.9)',
                                            border: '1px solid rgba(255, 255, 255, 0.6)',
                                        }}
                                    >
                                        <div
                                            className="size-10 rounded-xl flex items-center justify-center text-w-brand mb-2"
                                            style={{
                                                backgroundColor: '#EEF2F6',
                                                boxShadow: '2.5px 2.5px 6px rgba(166, 180, 200, 0.35), -2.5px -2.5px 6px rgba(255, 255, 255, 0.95)',
                                            }}
                                        >
                                            <UserCheck size={18} />
                                        </div>
                                        <p className="text-xs font-bold text-slate-800">No tables assigned to you</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5 max-w-[240px]">
                                            Seat guests or take an order from the available tables below.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3.5">
                                        {myTables.map((t) => (
                                            <TableCard
                                                key={`${t.id}-${t.merged_group_id || ''}`}
                                                table={t}
                                                selecting={selecting}
                                                selected={selectedIds.includes(t.id)}
                                                onTap={() => {
                                                    if (selecting) {
                                                        toggleSelect(t);
                                                    } else {
                                                        haptic.light();
                                                        setDetailsTable(t);
                                                    }
                                                }}
                                                onLongPress={() => {
                                                    if (!selecting) {
                                                        setSelecting(true);
                                                        setSelectedIds([t.id]);
                                                    } else {
                                                        toggleSelect(t);
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>

                            {/* ── Section 2: Other Waiters' Tables ── */}
                            {otherTables.length > 0 && (
                                <section aria-labelledby="section-other-tables">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2.5">
                                            <span
                                                className="size-8 rounded-xl flex items-center justify-center text-blue-600 shrink-0"
                                                style={{
                                                    backgroundColor: '#EEF2F6',
                                                    boxShadow: '2.5px 2.5px 6px rgba(166, 180, 200, 0.35), -2.5px -2.5px 6px rgba(255, 255, 255, 0.95)',
                                                    border: '1px solid rgba(255, 255, 255, 0.7)',
                                                }}
                                            >
                                                <Users size={16} />
                                            </span>
                                            <div>
                                                <h2 id="section-other-tables" className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                                                    Other Waiters' Tables
                                                    <span
                                                        className="px-2 py-0.2 rounded-full text-[10.5px] font-black"
                                                        style={{
                                                            backgroundColor: '#8CA9FF',
                                                            color: '#0F172A',
                                                            boxShadow: '0 1px 3px rgba(140, 169, 255, 0.4)',
                                                        }}
                                                    >
                                                        {otherTables.length}
                                                    </span>
                                                </h2>
                                                <p className="text-[11px] text-slate-500 font-medium">Assigned to other waiters • Tap to request access</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3.5">
                                        {otherTables.map((t) => (
                                            <TableCard
                                                key={`${t.id}-${t.merged_group_id || ''}`}
                                                table={t}
                                                selecting={selecting}
                                                selected={selectedIds.includes(t.id)}
                                                onTap={() => {
                                                    if (selecting) {
                                                        toggleSelect(t);
                                                    } else {
                                                        haptic.light();
                                                        setDetailsTable(t);
                                                    }
                                                }}
                                                onLongPress={() => {
                                                    if (!selecting) {
                                                        setSelecting(true);
                                                        setSelectedIds([t.id]);
                                                    } else {
                                                        toggleSelect(t);
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* ── Section 3: Available Tables ── */}
                            <section aria-labelledby="section-available-tables">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h2 id="section-available-tables" className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                                            Available Tables
                                            <span
                                                className="px-2 py-0.2 rounded-full text-[10.5px] font-black"
                                                style={{
                                                    backgroundColor: '#ABE7B2',
                                                    color: '#064E3B',
                                                    boxShadow: '0 1px 3px rgba(171, 231, 178, 0.4)',
                                                }}
                                            >
                                                {availableTables.length}
                                            </span>
                                        </h2>
                                        <p className="text-[11px] text-slate-500 font-medium">Ready for seating & new orders</p>
                                    </div>
                                </div>

                                {availableTables.length === 0 ? (
                                    <div
                                        className="rounded-[22px] p-5 text-center flex flex-col items-center"
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: 'inset 2.5px 2.5px 6px rgba(166, 180, 200, 0.3), inset -2.5px -2.5px 6px rgba(255, 255, 255, 0.9)',
                                            border: '1px solid rgba(255, 255, 255, 0.6)',
                                        }}
                                    >
                                        <div
                                            className="size-10 rounded-xl flex items-center justify-center text-emerald-600 mb-2"
                                            style={{
                                                backgroundColor: '#EEF2F6',
                                                boxShadow: '2.5px 2.5px 6px rgba(166, 180, 200, 0.35), -2.5px -2.5px 6px rgba(255, 255, 255, 0.95)',
                                            }}
                                        >
                                            <Sparkles size={18} />
                                        </div>
                                        <p className="text-xs font-bold text-slate-800">No available tables</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">All tables are currently in service or occupied.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3.5">
                                        {availableTables.map((t) => (
                                            <TableCard
                                                key={`${t.id}-${t.merged_group_id || ''}`}
                                                table={t}
                                                selecting={selecting}
                                                selected={selectedIds.includes(t.id)}
                                                onTap={() => {
                                                    if (selecting) {
                                                        toggleSelect(t);
                                                    } else {
                                                        haptic.light();
                                                        setDetailsTable(t);
                                                    }
                                                }}
                                                onLongPress={() => {
                                                    if (!selecting) {
                                                        setSelecting(true);
                                                        setSelectedIds([t.id]);
                                                    } else {
                                                        toggleSelect(t);
                                                    }
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </section>
                        </div>
                    )
                ) : filter === 'READY' ? (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <span
                                    className="size-8 rounded-xl flex items-center justify-center text-purple-600 shrink-0"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: '2.5px 2.5px 6px rgba(166, 180, 200, 0.35), -2.5px -2.5px 6px rgba(255, 255, 255, 0.95)',
                                        border: '1px solid rgba(255, 255, 255, 0.7)',
                                    }}
                                >
                                    <ChefHat size={16} />
                                </span>
                                <div>
                                    <h2 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                                        Ready to Serve
                                        <span
                                            className="px-2 py-0.2 rounded-full text-[10.5px] font-black"
                                            style={{
                                                backgroundColor: '#8F87F1',
                                                color: '#FFFFFF',
                                                boxShadow: '0 1px 3px rgba(143, 135, 241, 0.4)',
                                            }}
                                        >
                                            {readyTables.length}
                                        </span>
                                    </h2>
                                    <p className="text-[11px] text-slate-500 font-medium">Your tables waiting for food pickup</p>
                                </div>
                            </div>
                        </div>

                        {readyTables.length === 0 ? (
                            <NeumorphicEmptyState
                                icon={<ChefHat size={22} />}
                                title="No Ready Orders"
                                body="None of your assigned tables currently have orders ready for pickup."
                            />
                        ) : (
                            <div className="grid grid-cols-2 gap-3.5">
                                {readyTables.map((t) => (
                                    <TableCard
                                        key={`${t.id}-${t.merged_group_id || ''}`}
                                        table={t}
                                        selecting={selecting}
                                        selected={selectedIds.includes(t.id)}
                                        onTap={() => {
                                            if (selecting) {
                                                toggleSelect(t);
                                            } else {
                                                haptic.light();
                                                setDetailsTable(t);
                                            }
                                        }}
                                        onLongPress={() => {
                                            if (!selecting) {
                                                setSelecting(true);
                                                setSelectedIds([t.id]);
                                            } else {
                                                toggleSelect(t);
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : filter === 'PREPARING' ? (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2.5">
                                <span
                                    className="size-8 rounded-xl flex items-center justify-center text-amber-600 shrink-0"
                                    style={{
                                        backgroundColor: '#EEF2F6',
                                        boxShadow: '2.5px 2.5px 6px rgba(166, 180, 200, 0.35), -2.5px -2.5px 6px rgba(255, 255, 255, 0.95)',
                                        border: '1px solid rgba(255, 255, 255, 0.7)',
                                    }}
                                >
                                    <Utensils size={16} />
                                </span>
                                <div>
                                    <h2 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                                        Preparing in Kitchen
                                        <span
                                            className="px-2 py-0.2 rounded-full text-[10.5px] font-black"
                                            style={{
                                                backgroundColor: '#FFDE63',
                                                color: '#1E293B',
                                                boxShadow: '0 1px 3px rgba(255, 222, 99, 0.4)',
                                            }}
                                        >
                                            {preparingTables.length}
                                        </span>
                                    </h2>
                                    <p className="text-[11px] text-slate-500 font-medium">Your tables with food currently cooking</p>
                                </div>
                            </div>
                        </div>

                        {preparingTables.length === 0 ? (
                            <NeumorphicEmptyState
                                icon={<Utensils size={22} />}
                                title="No Preparing Orders"
                                body="None of your assigned tables currently have orders being prepared."
                            />
                        ) : (
                            <div className="grid grid-cols-2 gap-3.5">
                                {preparingTables.map((t) => (
                                    <TableCard
                                        key={`${t.id}-${t.merged_group_id || ''}`}
                                        table={t}
                                        selecting={selecting}
                                        selected={selectedIds.includes(t.id)}
                                        onTap={() => {
                                            if (selecting) {
                                                toggleSelect(t);
                                            } else {
                                                haptic.light();
                                                setDetailsTable(t);
                                            }
                                        }}
                                        onLongPress={() => {
                                            if (!selecting) {
                                                setSelecting(true);
                                                setSelectedIds([t.id]);
                                            } else {
                                                toggleSelect(t);
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h2 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                                    Available Tables
                                    <span
                                        className="px-2 py-0.2 rounded-full text-emerald-700 text-[10.5px] font-black"
                                        style={{
                                            backgroundColor: '#EEF2F6',
                                            boxShadow: 'inset 1.5px 1.5px 3px rgba(166, 180, 200, 0.35), inset -1.5px -1.5px 3px rgba(255, 255, 255, 0.9)',
                                        }}
                                    >
                                        {availableTables.length}
                                    </span>
                                </h2>
                                <p className="text-[11px] text-slate-500 font-medium">All floor tables ready for new guest seating</p>
                            </div>
                        </div>

                        {availableTables.length === 0 ? (
                            <NeumorphicEmptyState
                                icon={<LayoutGrid size={22} />}
                                title="No Available Tables"
                                body="All floor tables are currently in service or occupied."
                            />
                        ) : (
                            <div className="grid grid-cols-2 gap-3.5">
                                {availableTables.map((t) => (
                                    <TableCard
                                        key={`${t.id}-${t.merged_group_id || ''}`}
                                        table={t}
                                        selecting={selecting}
                                        selected={selectedIds.includes(t.id)}
                                        onTap={() => {
                                            if (selecting) {
                                                toggleSelect(t);
                                            } else {
                                                haptic.light();
                                                setDetailsTable(t);
                                            }
                                        }}
                                        onLongPress={() => {
                                            if (!selecting) {
                                                setSelecting(true);
                                                setSelectedIds([t.id]);
                                            } else {
                                                toggleSelect(t);
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ── Floating selection action bar (Tactile Neumorphic) ───────────────── */}
            <AnimatePresence>
                {selecting && (
                    <motion.div
                        initial={{ y: 90, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 90, opacity: 0 }}
                        transition={springSoft}
                        className="fixed bottom-[76px] left-4 right-4 max-w-[calc(28rem-2rem)] mx-auto z-40"
                    >
                        <div
                            className="rounded-[24px] p-2 grid grid-cols-4 gap-2"
                            style={{
                                backgroundColor: '#EEF2F6',
                                boxShadow: '6px 6px 18px rgba(166, 180, 200, 0.5), -6px -6px 18px rgba(255, 255, 255, 0.95)',
                                border: '1px solid rgba(255, 255, 255, 0.8)',
                            }}
                        >
                            <SelectAction icon={<Link2 size={17} className="text-w-brand" />} label="Merge" onClick={() => { if (selectedIds.length < 2) { toast.error('Select at least 2 tables to merge'); return; } setMergeSheetOpen(true); }} />
                            <SelectAction icon={<Move size={17} className="text-[#0284C7]" />} label="Move Area" onClick={() => setMoveSheetOpen(true)} />
                            <SelectAction icon={<Pin size={17} className="text-[#D97706]" />} label="Pin" onClick={doPin} />
                            <SelectAction icon={<Trash2 size={17} className="text-w-alert" />} label="Delete" onClick={doDelete} loading={busy} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating indicator when waiter has draft items from menu browse */}
            <AnimatePresence>
                {pendingCartCount > 0 && !detailsTable && (
                    <motion.div
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 50, opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="fixed bottom-[68px] left-0 right-0 max-w-md mx-auto z-40 px-3.5"
                    >
                        <div className="bg-neutral-900 text-white rounded-2xl p-3 shadow-2xl flex items-center justify-between gap-3 border border-orange-500/50">
                            <div className="flex items-center gap-3">
                                <span className="size-9 rounded-xl bg-orange-500 flex items-center justify-center text-white font-black text-xs shadow-md shadow-orange-500/30">
                                    {pendingCartCount}
                                </span>
                                <div>
                                    <p className="text-xs font-black text-white">Cart items pending</p>
                                    <p className="text-[10px] text-gray-400 font-semibold">Tap any table below to order</p>
                                </div>
                            </div>
                            <button
                                onClick={() => router.push(`/${params?.restaurantCode || restaurantId}/waiter/${staffMobile}/menu/browse`)}
                                className="px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-black shadow active:scale-95 transition-all shrink-0"
                            >
                                View Cart
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Sheets (Preserved) ──────────────────────────────────────── */}
            <AnimatePresence>
                {detailsTable && (restaurantId || (params?.restaurantCode as string)) && (
                    <TableDetailsSheet
                        table={detailsTable}
                        restaurantId={restaurantId || (params?.restaurantCode as string) || ''}
                        currentWaiter={waiterRecord ? { id: waiterRecord.id, role: waiterRecord.role, name: waiterRecord.name, mobile: waiterRecord.mobile || staffMobile } : { id: '', mobile: staffMobile, name: 'Staff', role: 'waiter' }}
                        onClose={() => setDetailsTable(null)}
                        onChanged={() => loadTables(true)}
                        onCleared={handleTableCleared}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {mergeSheetOpen && (
                    <MergeSheet
                        tables={floor.filter((t) => !t.is_group)}
                        selectedIds={selectedIds}
                        busy={busy}
                        onToggle={(id) => toggleSelect({ id } as FloorTable)}
                        onConfirm={() => doMerge(selectedIds)}
                        onClose={() => setMergeSheetOpen(false)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {moveSheetOpen && (
                    <MoveAreaSheet
                        areas={areas}
                        count={selectedIds.length}
                        busy={busy}
                        onPick={(id) => doMoveArea(id)}
                        onClose={() => setMoveSheetOpen(false)}
                    />
                )}
            </AnimatePresence>

            {/* Background refresh indicator */}
            <AnimatePresence>
                {refreshing && !loading && (
                    <div className="fixed top-14 left-0 right-0 h-[2px] z-40 overflow-hidden">
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: '100%' }}
                            transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                            className="w-2/5 h-full rounded-full bg-w-brand"
                        />
                    </div>
                )}
            </AnimatePresence>

            {/* Pull-to-refresh fallback button (web) */}
            {!selecting && (
                <button
                    onClick={() => { haptic.light(); loadTables(); }}
                    aria-label="Refresh tables"
                    className="fixed bottom-[76px] right-4 z-30 size-11 rounded-full flex items-center justify-center text-slate-600 active:scale-90 transition-transform"
                    style={{
                        backgroundColor: '#EEF2F6',
                        boxShadow: '3.5px 3.5px 9px rgba(166, 180, 200, 0.45), -3.5px -3.5px 9px rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(255, 255, 255, 0.8)',
                    }}
                >
                    <RefreshCw size={17} className={refreshing ? 'animate-spin text-w-brand' : ''} />
                </button>
            )}
        </div>
    );
}

function AreaTile({ icon: Icon, label, active, onClick, index }: { icon: any; label: string; active: boolean; onClick: () => void; index: number }) {
    return (
        <motion.button
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.03, duration: 0.18 }}
            onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-bold transition-all active:scale-[0.98] ${active
                    ? 'text-w-brand'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
            style={{
                backgroundColor: '#EEF2F6',
                boxShadow: active
                    ? 'inset 2px 2px 4px rgba(166, 180, 200, 0.4), inset -2px -2px 4px rgba(255, 255, 255, 0.9)'
                    : 'none',
            }}
        >
            <Icon size={15} className={active ? 'text-w-brand' : 'text-slate-400'} />
            <span className="flex-1 truncate">{label}</span>
            {active && <Check size={14} className="text-w-brand" />}
        </motion.button>
    );
}

function SelectAction({ icon, label, onClick, loading }: { icon: React.ReactNode; label: string; onClick: () => void; loading?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            className="flex flex-col items-center gap-1 py-1.5 rounded-xl transition-all active:scale-95 disabled:opacity-50"
            style={{
                backgroundColor: '#EEF2F6',
                boxShadow: '2.5px 2.5px 5px rgba(166, 180, 200, 0.35), -2.5px -2.5px 5px rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.6)',
            }}
        >
            <span className="size-8 rounded-lg flex items-center justify-center">{icon}</span>
            <span className="text-[10.5px] font-extrabold text-slate-700">{loading ? '…' : label}</span>
        </button>
    );
}

function NeumorphicEmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
    return (
        <div
            className="rounded-[24px] p-6 text-center flex flex-col items-center"
            style={{
                backgroundColor: '#EEF2F6',
                boxShadow: 'inset 3px 3px 8px rgba(166, 180, 200, 0.35), inset -3px -3px 8px rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(255, 255, 255, 0.6)',
            }}
        >
            <div
                className="size-12 rounded-2xl flex items-center justify-center text-slate-400 mb-3"
                style={{
                    backgroundColor: '#EEF2F6',
                    boxShadow: '3px 3px 7px rgba(166, 180, 200, 0.4), -3px -3px 7px rgba(255, 255, 255, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.8)',
                }}
            >
                {icon}
            </div>
            <h3 className="text-sm font-black text-slate-800 tracking-tight">{title}</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-[240px] leading-relaxed">{body}</p>
        </div>
    );
}

function NeumorphicSkeletonGrid({ count = 6 }: { count?: number }) {
    return (
        <div className="grid grid-cols-2 gap-3.5" aria-hidden>
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-[22px] p-3.5 flex flex-col justify-between"
                    style={{
                        backgroundColor: '#EEF2F6',
                        aspectRatio: '1 / 1.05',
                        boxShadow: '4px 4px 10px rgba(166, 180, 200, 0.35), -4px -4px 10px rgba(255, 255, 255, 0.9)',
                        border: '1.5px solid #000000',
                    }}
                >
                    <div className="flex justify-between items-center">
                        <div className="h-4 w-10 rounded-full bg-slate-300/50 animate-pulse" />
                        <div className="h-5 w-12 rounded-md bg-slate-300/50 animate-pulse" />
                    </div>
                    <div className="flex flex-col items-center justify-center my-auto">
                        <div className="h-4 w-20 rounded-full bg-slate-300/40 animate-pulse" />
                    </div>
                    <div className="h-6 w-full rounded-xl bg-slate-300/40 animate-pulse" />
                </div>
            ))}
        </div>
    );
}

/* ── Merge sheet ─────────────────────────────────────────────── */
function MergeSheet({
    tables, selectedIds, busy, onToggle, onConfirm, onClose,
}: {
    tables: FloorTable[];
    selectedIds: (number | string)[];
    busy: boolean;
    onToggle: (id: number | string) => void;
    onConfirm: () => void;
    onClose: () => void;
}) {
    const chosen = tables.filter((t) => selectedIds.includes(t.id));
    const seats = chosen.reduce((s, t) => s + (t.capacity || 0), 0);
    const valid = chosen.length >= 2;
    const previewName = chosen.length > 0
        ? `Table ${chosen.map((t) => t.table_number).sort((a, b) => Number(a) - Number(b)).join('+')}`
        : '—';

    return (
        <Sheet onClose={onClose}>
            <div className="p-5 pb-3 flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-w-brand-soft flex items-center justify-center">
                    <Link2 size={20} className="text-w-brand" />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-extrabold text-w-ink tracking-tight">Merge Tables</h3>
                    <p className="text-xs text-w-ink-soft">Combine multiple tables into a single dining group</p>
                </div>
                <button onClick={onClose} aria-label="Close" className="size-9 rounded-full bg-[#F1F5F9] flex items-center justify-center text-w-ink-soft">
                    <X size={17} />
                </button>
            </div>

            <div className="px-5">
                <div className={`rounded-2xl border p-3.5 mb-3 ${valid ? 'bg-w-brand-soft border-w-brand/40' : 'bg-w-canvas border-w-border'}`}>
                    <div className="flex items-center justify-between">
                        <p className="font-display text-base font-black text-w-ink">{previewName}</p>
                        {valid && <span className="px-2 py-0.5 rounded-full bg-w-brand text-white text-[10px] font-black">Ready</span>}
                    </div>
                    <p className="text-xs text-w-ink-soft mt-0.5">{chosen.length} tables selected • {seats} total seats</p>
                </div>
            </div>

            <div className="px-5 pb-4 overflow-y-auto flex-1 space-y-2">
                {tables.map((t) => {
                    const checked = selectedIds.includes(t.id);
                    const alreadyMerged = !!t.merged_group_id;
                    return (
                        <button
                            key={t.id}
                            disabled={alreadyMerged}
                            onClick={() => onToggle(t.id)}
                            className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-colors ${checked ? 'bg-w-brand-softer border-w-brand' : 'border-w-border bg-white'
                                } ${alreadyMerged ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <span className={`size-6 rounded-full border-2 shrink-0 flex items-center justify-center ${checked ? 'bg-w-brand border-w-brand' : 'border-w-border-strong'}`}>
                                {checked && <Check size={13} strokeWidth={3.5} className="text-white" />}
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="flex items-center gap-2">
                                    <span className="text-sm font-extrabold text-w-ink">Table {t.table_number}</span>
                                    {t.area_name && <span className="px-1.5 py-px rounded bg-[#F1F5F9] text-[10px] font-semibold text-w-ink-soft">{t.area_name}</span>}
                                    {alreadyMerged && <span className="px-1.5 py-px rounded bg-w-alert-soft text-w-alert-deep text-[10px] font-bold">Already Merged</span>}
                                </span>
                                <span className="block text-[11px] text-w-ink-soft mt-0.5">{t.capacity} Seats • {(t.status || '').toUpperCase()}</span>
                            </span>
                            <span className="w-num text-xs font-bold text-w-ink-soft shrink-0">{t.capacity}</span>
                        </button>
                    );
                })}
            </div>

            <div className="sticky bottom-0 bg-[#F1F5F9] border-t border-w-border p-4">
                <AppButton className="w-full" disabled={!valid || busy} loading={busy} onClick={onConfirm}>
                    {valid ? `Merge ${chosen.length} Tables (${seats} Seats)` : 'Select at least 2 tables to merge'}
                </AppButton>
            </div>
        </Sheet>
    );
}

/* ── Move-area sheet ─────────────────────────────────────────── */
function MoveAreaSheet({
    areas, count, busy, onPick, onClose,
}: {
    areas: AreaRow[];
    count: number;
    busy: boolean;
    onPick: (areaId: string | null) => void;
    onClose: () => void;
}) {
    return (
        <Sheet onClose={onClose}>
            <div className="p-5 pb-3">
                <h3 className="text-lg font-extrabold text-w-ink tracking-tight">Move to Area</h3>
                <p className="text-xs text-w-ink-soft mt-0.5">Select the destination area for {count} table{count !== 1 ? 's' : ''}</p>
            </div>
            <div className="px-5 pb-4 overflow-y-auto flex-1 space-y-2">
                {areas.map((a) => {
                    const Icon = areaIcon(a.name);
                    return (
                        <button
                            key={a.id}
                            disabled={busy}
                            onClick={() => onPick(a.id)}
                            className="w-full flex items-center gap-3 p-3.5 rounded-2xl border border-w-border bg-white text-left active:bg-w-canvas transition-colors"
                        >
                            <span className="size-10 rounded-xl bg-w-brand-soft flex items-center justify-center">
                                <Icon size={18} className="text-w-brand" />
                            </span>
                            <span className="flex-1 text-sm font-bold text-w-ink">{a.name}</span>
                            <CheckCheck size={16} className="text-transparent" />
                        </button>
                    );
                })}
            </div>
        </Sheet>
    );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-[85] flex items-end justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={springSoft}
                className="relative w-full max-w-md bg-white rounded-t-3xl flex flex-col max-h-[85%]"
            >
                {children}
            </motion.div>
        </div>
    );
}
