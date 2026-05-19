'use client';

import { useState, useEffect } from 'react';
import { Save as LucideSave, Building as LucideBuilding, FileText as LucideFileText, CreditCard as LucideCreditCard, Award as LucideAward } from 'lucide-react';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { RegistrationService } from '@/app/services/registration';
import { getCached, setCache } from '@/app/lib/data-cache';

export default function Settings() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const cached = getCached<any>(`settings-${restaurantId}`);
    const [registrationDetails, setRegistrationDetails] = useState<any>(cached || null);
    const [loading, setLoading] = useState(!cached);

    useEffect(() => {
        if (!restaurantLoading && restaurantId) {
            RegistrationService.getRegistrationDetails(restaurantId).then(data => {
                setRegistrationDetails(data);
                setCache(`settings-${restaurantId}`, data);
                setLoading(false);
            }).catch(err => {
                console.error("Failed to load registration details", err);
                setLoading(false);
            });
        }
    }, [restaurantId, restaurantLoading]);

    return (
        <div className="p-8 flex flex-col h-screen space-y-7 overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-2xl font-black text-black tracking-tight">Restaurant Settings</h2>
                <p className="text-sm font-medium text-black mt-1">Manage profile, business hours, and operational settings.</p>
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
                    <h3 className="text-lg font-semibold text-black pb-2 border-b border-neutral-100">Taxes & Charges</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-black">GST (%)</label>
                            <input type="number" defaultValue="5" className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-black">Service Charge (%)</label>
                            <input type="number" defaultValue="0" className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-black">Currency</label>
                            <select className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                <option value="INR">INR (₹)</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Actions */}
                <div className="pt-8 border-t border-neutral-100 flex justify-end">
                    <button className="flex items-center px-6 py-3 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 gap-2">
                        <LucideSave size={16} />
                        Save Changes
                    </button>
                </div>

            </div>
        </div>
    );
}
