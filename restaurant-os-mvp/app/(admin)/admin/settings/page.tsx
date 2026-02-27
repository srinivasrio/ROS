'use client';

import { LucideSave, LucideUpload } from 'lucide-react';

export default function Settings() {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h2 className="text-2xl font-bold text-neutral-900">Restaurant Settings</h2>
                <p className="text-neutral-500">Manage profile, business hours, and taxes.</p>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden p-8 space-y-8">

                {/* Profile Section */}
                <section className="space-y-4">
                    <h3 className="text-lg font-semibold text-neutral-900 pb-2 border-b border-neutral-100">Restaurant Profile</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-700">Restaurant Name</label>
                            <input type="text" defaultValue="Minerva" className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-700">Phone Number</label>
                            <input type="text" defaultValue="+91 98765 43210" className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="col-span-1 md:col-span-2 space-y-2">
                            <label className="text-sm font-medium text-neutral-700">Address</label>
                            <textarea defaultValue="123, Food Street, Jubilee Hills, Hyderabad." className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none" />
                        </div>
                    </div>
                </section>

                {/* Taxes Section */}
                <section className="space-y-4">
                    <h3 className="text-lg font-semibold text-neutral-900 pb-2 border-b border-neutral-100">Taxes & Charges</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-700">GST (%)</label>
                            <input type="number" defaultValue="5" className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-700">Service Charge (%)</label>
                            <input type="number" defaultValue="0" className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-neutral-700">Currency</label>
                            <select className="w-full px-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white">
                                <option value="INR">INR (₹)</option>
                                <option value="USD">USD</option>
                            </select>
                        </div>
                    </div>
                </section>

                {/* Actions */}
                <div className="pt-6 border-t border-neutral-100 flex justify-end">
                    <button className="flex items-center px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                        <LucideSave size={18} className="mr-2" />
                        Save Changes
                    </button>
                </div>

            </div>
        </div>
    );
}
