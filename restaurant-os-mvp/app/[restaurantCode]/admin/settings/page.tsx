'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save as LucideSave, Building as LucideBuilding, FileText as LucideFileText, CreditCard as LucideCreditCard, Award as LucideAward, Loader2 as LucideLoader2 } from 'lucide-react';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { RegistrationService } from '@/services/registration.service';
import { getCached, setCache, hasFreshCache } from '@/lib/data-cache';
import { requestManager } from '@/lib/cache/request-manager';
import { SyncIndicator } from '@/components/admin/SyncIndicator';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';

export default function Settings() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const params = useParams();
    const restaurantCode = params.restaurantCode as string;
    const activeResId = restaurantId || restaurantCode;

    const cacheKey = `settings-${activeResId}`;
    const cached = getCached<any>(cacheKey) || (restaurantId ? getCached<any>(`settings-${restaurantId}`) : null);
    const [registrationDetails, setRegistrationDetails] = useState<any>(cached || null);
    const [loading, setLoading] = useState(!cached && !registrationDetails);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    const [gst, setGst] = useState('');
    const [cgst, setCgst] = useState('');
    const [sgst, setSgst] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (registrationDetails) {
            const g = registrationDetails.gst_percentage != null ? registrationDetails.gst_percentage : '';
            const c = registrationDetails.cgst_percentage != null ? registrationDetails.cgst_percentage : (g !== '' ? g / 2.0 : '');
            const s = registrationDetails.sgst_percentage != null ? registrationDetails.sgst_percentage : (g !== '' ? g / 2.0 : '');
            setGst(g !== '' ? g.toString() : '');
            setCgst(c !== '' ? c.toString() : '');
            setSgst(s !== '' ? s.toString() : '');
        }
    }, [registrationDetails]);

    const handleGstChange = (val: string) => {
        setGst(val);
        if (val === '') {
            setCgst('');
            setSgst('');
            return;
        }
        const num = parseFloat(val);
        if (!isNaN(num) && num >= 0) {
            setCgst((num / 2).toString());
            setSgst((num / 2).toString());
        }
    };

    const handleSave = async () => {
        const targetId = restaurantId || restaurantCode;
        if (!targetId) return;

        const g = parseFloat(gst);
        const c = parseFloat(cgst);
        const s = parseFloat(sgst);

        if (isNaN(g) || g < 0) {
            toast.error('Please enter a valid GST percentage');
            return;
        }
        if (isNaN(c) || isNaN(s) || Math.abs((c + s) - g) > 0.01) {
            toast.error(`CGST (${c}%) + SGST (${s}%) must equal total GST (${g}%)`);
            return;
        }

        setSaving(true);
        try {
            const ok = await RegistrationService.updateGstSettings(targetId, g, c, s);
            if (ok) {
                toast.success('GST settings updated successfully');
                loadData(true);
            } else {
                toast.error('Failed to update GST settings');
            }
        } catch (e: any) {
            toast.error(e.message || 'Error updating settings');
        } finally {
            setSaving(false);
        }
    };

    const loadData = useCallback(async (force = false) => {
        const targetId = restaurantId || restaurantCode;
        if (!targetId) return;
        const key = `settings-${targetId}`;

        const currentCached = getCached<any>(key);
        if (currentCached && !registrationDetails) {
            setRegistrationDetails(currentCached);
            setLoading(false);
        }

        if (!force && hasFreshCache(key)) {
            setLoading(false);
            return;
        }

        if (!registrationDetails && !currentCached) {
            setLoading(true);
        } else {
            setIsSyncing(true);
        }

        try {
            const data = await requestManager.coalesce(key, () => RegistrationService.getRegistrationDetails(restaurantId || targetId), 3);
            if (data) {
                setRegistrationDetails(data);
                setCache(key, data, { ttlMs: 15 * 60 * 1000 });
                if (restaurantId && restaurantId !== targetId) {
                    setCache(`settings-${restaurantId}`, data, { ttlMs: 15 * 60 * 1000 });
                }
                setLastSync(new Date());
            }
        } catch (err) {
            console.error("Failed to load registration details", err);
        } finally {
            setLoading(false);
            setIsSyncing(false);
        }
    }, [restaurantId, restaurantCode, registrationDetails]);

    useEffect(() => {
        if (!restaurantLoading && (restaurantId || restaurantCode)) {
            loadData();
        }
    }, [restaurantId, restaurantCode, restaurantLoading, loadData]);

    return (
        <div className="p-8 flex flex-col h-screen space-y-7 overflow-hidden">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-black tracking-tight">Restaurant Settings</h2>
                    <p className="text-sm font-medium text-black mt-1">Manage profile, business hours, and operational settings.</p>
                </div>
                <SyncIndicator isSyncing={isSyncing} lastSync={lastSync} onRefresh={() => loadData(true)} />
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 bg-white rounded-[2rem] border border-neutral-200 shadow-sm p-10 space-y-10">

                {/* Profile Section */}
                <section className="space-y-4">
                    <h3 className="text-lg font-semibold text-black pb-2 border-b border-neutral-100">Restaurant Profile</h3>
                    
                    {loading ? (
                        <div className="h-40 flex items-center justify-center">
                            <div className="w-8 h-8 flex-shrink-0 animate-spin border-4 border-blue-600 border-t-transparent rounded-full" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-black">Restaurant Name</label>
                                <input type="text" defaultValue={registrationDetails?.name || ""} className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-black">Owner Name</label>
                                <input type="text" defaultValue={registrationDetails?.owner_name || ""} className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-black">Phone Number</label>
                                <input type="text" defaultValue={registrationDetails?.phone || ""} className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-black">Email</label>
                                <input type="email" defaultValue={registrationDetails?.email || ""} className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                            </div>
                            <div className="col-span-1 md:col-span-2 space-y-2">
                                <label className="text-sm font-medium text-black">Registered Address</label>
                                <textarea defaultValue={registrationDetails?.address || ""} className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none" />
                            </div>
                        </div>
                    )}
                </section>

                {/* Registration & Legal Details Section */}
                {!loading && registrationDetails?.legal && (
                    <section className="space-y-4">
                        <h3 className="text-lg font-semibold text-black pb-2 border-b border-neutral-100 flex items-center">
                            <LucideFileText size={20} className="mr-2 text-black" />
                            Registration & Legal Details
                        </h3>
                        <p className="text-sm text-black">This information is strictly for administrative references and cannot be edited directly.</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="flex items-center p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mr-4">
                                    <LucideBuilding size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-black uppercase tracking-wider">Business Type</p>
                                    <p className="text-sm font-semibold text-black">{registrationDetails.legal?.business_type || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="flex items-center p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                                <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mr-4">
                                    <LucideAward size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-black uppercase tracking-wider">FSSAI Number</p>
                                    <p className="text-sm font-semibold text-black">{registrationDetails.legal?.fssai_number || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="flex items-center p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mr-4">
                                    <LucideCreditCard size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-black uppercase tracking-wider">GST Number</p>
                                    <p className="text-sm font-semibold text-black">{registrationDetails.legal?.gst_number || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="flex items-center p-4 bg-neutral-50 rounded-xl border border-neutral-100">
                                <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mr-4">
                                    <LucideFileText size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-black uppercase tracking-wider">PAN / License ID</p>
                                    <p className="text-sm font-semibold text-black">{registrationDetails.legal?.pan_number || registrationDetails.legal?.shop_establishment_license || 'N/A'}</p>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Taxes Section */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
                        <div>
                            <h3 className="text-lg font-semibold text-black">Default Taxes & GST</h3>
                            <p className="text-xs text-neutral-500">Default tax rates applied to new menu items and orders across this restaurant.</p>
                        </div>
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                            Auto-Split
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-black">Total GST (%)</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={gst} 
                                    onChange={(e) => handleGstChange(e.target.value)}
                                    placeholder="5"
                                    className="w-full px-4 py-2 pr-8 border border-neutral-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">%</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-black">CGST (%)</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={cgst} 
                                    onChange={(e) => setCgst(e.target.value)}
                                    placeholder="2.5"
                                    className="w-full px-4 py-2 pr-8 border border-neutral-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">%</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-black">SGST (%)</label>
                            <div className="relative">
                                <input 
                                    type="number" 
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={sgst} 
                                    onChange={(e) => setSgst(e.target.value)}
                                    placeholder="2.5"
                                    className="w-full px-4 py-2 pr-8 border border-neutral-300 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-neutral-400">%</span>
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-neutral-500">
                        💡 Example: 5% GST → 2.5% CGST + 2.5% SGST | 18% GST → 9% CGST + 9% SGST
                    </p>
                </section>

                {/* Actions */}
                <div className="pt-8 border-t border-neutral-100 flex justify-end">
                    <button 
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center px-6 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {saving ? <LucideLoader2 size={16} className="animate-spin" /> : <LucideSave size={16} />}
                        Save Changes
                    </button>
                </div>

            </div>
        </div>
    );
}
