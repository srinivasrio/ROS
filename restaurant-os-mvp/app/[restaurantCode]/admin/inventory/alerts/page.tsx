'use client';

import { useState, useEffect } from 'react';
import { AlertCircle as LucideAlertCircle, CheckCircle2 as LucideCheckCircle2, TrendingDown as LucideTrendingDown, AlertTriangle as LucideAlertTriangle, PackageSearch as LucidePackageSearch, Sparkles as LucideSparkles } from 'lucide-react';
import { InventoryService, InventoryAlert } from '@/app/services/inventory.service';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';

export default function InventoryAlertsPage() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!restaurantLoading && restaurantId) {
            loadAlerts();
        }
    }, [restaurantId, restaurantLoading]);

    const loadAlerts = async () => {
        if (!restaurantId) return;
        setLoading(true);
        try {
            const data = await InventoryService.fetchActiveAlerts(restaurantId);
            setAlerts(data || []);
        } catch (error) {
            console.error('Failed to load alerts', error);
        } finally {
            setLoading(false);
        }
    }

    const handleMarkResolved = async (id: string) => {
        if (!restaurantId) return;
        try {
            await InventoryService.markAlertRead(id, restaurantId);
            setAlerts(alerts.filter(a => a.id !== id));
        } catch (error) {
            console.error('Failed to resolve alert', error);
        }
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'low_stock': return <LucideAlertTriangle className="text-amber-500" />;
            case 'shortage_predicted': return <LucidePackageSearch className="text-rose-500" />;
            case 'anomaly': return <LucideTrendingDown className="text-red-500" />;
            default: return <LucideAlertCircle className="text-blue-500" />;
        }
    }

    const getBgColor = (type: string) => {
        switch (type) {
            case 'low_stock': return 'bg-amber-50 border-amber-100';
            case 'shortage_predicted': return 'bg-rose-50 border-rose-100';
            case 'anomaly': return 'bg-red-50 border-red-100';
            default: return 'bg-blue-50 border-blue-100';
        }
    }

    if (loading) return <div>Loading...</div>;

    const smartAlerts = alerts.filter(a => a.alert_type === 'shortage_predicted');
    const systemAlerts = alerts.filter(a => a.alert_type !== 'shortage_predicted');

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-6 border border-neutral-200 shadow-sm rounded-2xl">
                <h2 className="text-xl font-bold text-black flex items-center gap-2">
                    <LucideAlertCircle className="text-blue-600" />
                    Alerts & Smart Suggestions
                </h2>
                <p className="text-black text-sm mt-1">Review active inventory alerts and smart purchase recommendations based on projected demand.</p>
            </div>

            {/* Smart Purchase Suggestions Section */}
            <div>
                <h3 className="text-lg font-bold text-black mb-4 flex items-center gap-2">
                    <LucideSparkles className="text-amber-500" size={20} />
                    Smart Purchase Suggestions
                </h3>
                {smartAlerts.length > 0 ? (
                    <div className="space-y-3">
                        {smartAlerts.map(alert => (
                            <div key={alert.id} className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5 flex items-start gap-4">
                                <div className="mt-1">
                                    <LucideSparkles className="text-amber-600" size={24} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-bold text-amber-900 mb-1">{alert.inventory_item?.name || 'Unknown Item'}</h4>
                                    <p className="text-amber-800 text-sm">{alert.message}</p>
                                    <p className="text-xs text-amber-700/70 mt-2 font-medium">Generated {new Date(alert.created_at).toLocaleString()}</p>
                                </div>
                                <button
                                    onClick={() => handleMarkResolved(alert.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-900 text-sm font-semibold rounded-lg transition-colors"
                                >
                                    <LucideCheckCircle2 size={16} /> Mark Processed
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center bg-white border border-neutral-200 border-dashed rounded-xl">
                        <LucideCheckCircle2 size={32} className="mx-auto text-emerald-500 mb-3" />
                        <h4 className="font-bold text-black">No predictions pending</h4>
                        <p className="text-sm text-black mt-1">System predicts sufficient stock for the next 7 days.</p>
                    </div>
                )}
            </div>

            {/* Standard Alerts Section */}
            <div>
                <h3 className="text-lg font-bold text-black mb-4">Critical System Alerts</h3>
                {systemAlerts.length > 0 ? (
                    <div className="space-y-3">
                        {systemAlerts.map(alert => (
                            <div key={alert.id} className={`border rounded-xl p-5 flex items-start gap-4 ${getBgColor(alert.alert_type)}`}>
                                <div className="mt-1">
                                    {getIcon(alert.alert_type)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-black">{alert.inventory_item?.name || 'System'}</h4>
                                        <span className="uppercase text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-white/50 text-black border border-neutral-200/50">
                                            {alert.alert_type.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <p className="text-black text-sm">{alert.message}</p>
                                    <p className="text-xs text-black mt-2 font-medium">{new Date(alert.created_at).toLocaleString()}</p>
                                </div>
                                <button
                                    onClick={() => handleMarkResolved(alert.id)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-200 hover:bg-neutral-50 text-black text-sm font-semibold rounded-lg shadow-sm transition-colors"
                                >
                                    <LucideCheckCircle2 size={16} /> Resolve
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-8 text-center bg-white border border-neutral-200 border-dashed rounded-xl">
                        <p className="text-sm text-black">No active system alerts.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
