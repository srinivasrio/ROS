'use client';

import { Search as LucideSearch, Mail as LucideMail, Phone as LucidePhone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CustomerService, Customer } from '@/app/services/customers';
import { formatCurrency } from '@/app/lib/utils';
import { getCached, setCache } from '@/app/lib/data-cache';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';

export default function Customers() {
    const { restaurantId } = useRestaurantId();
    const cachedCustomers = getCached<Customer[]>('customers-cache');
    const [customers, setCustomers] = useState<Customer[]>(cachedCustomers || []);
    const [loading, setLoading] = useState(!cachedCustomers);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (restaurantId) {
            loadCustomers();
        }
    }, [restaurantId]);

    const loadCustomers = async () => {
        if (!restaurantId) return;
        try {
            const data = await CustomerService.fetchCustomers(restaurantId);
            setCustomers(data);
            setCache('customers-cache', data);
        } catch (error) {
            console.error('Failed to load customers:', error);
        } finally {
            setLoading(false);
        }
    };



    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.mobile.includes(searchTerm)
    );

    return (
        <div className="p-8 flex flex-col h-screen space-y-7 overflow-hidden">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-black tracking-tight">Customer Database</h2>
                    <p className="text-sm font-medium text-black mt-1">View customer history, visit frequency, and loyalty insights.</p>
                </div>
                <div className="relative">
                    <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-black" size={16} />
                    <input
                        type="text"
                        placeholder="Search by name or mobile..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 pr-4 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64 placeholder:text-black transition-all shadow-sm"
                    />
                </div>
            </div>

            <div className="bg-white rounded-[2rem] border border-neutral-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="overflow-y-auto no-scrollbar flex-1">
                <table className="w-full text-left text-sm text-black">
                    <thead className="bg-neutral-50 text-black font-medium border-b border-neutral-200">
                        <tr>
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4">Contact Info</th>
                            <th className="px-6 py-4">Total Visits</th>
                            <th className="px-6 py-4">Total Spend</th>
                            <th className="px-6 py-4">Last Visit</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                        {loading ? (
                            <tr><td colSpan={6} className="px-6 py-10 text-center text-black">Loading customers...</td></tr>
                        ) : filteredCustomers.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-10 text-center text-black">No customers found.</td></tr>
                        ) : (
                            filteredCustomers.map((customer) => (
                                <tr key={customer.id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs mr-3">
                                                {customer.name.charAt(0)}
                                            </div>
                                            <span className="font-medium text-black">{customer.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 text-xs">
                                            <div className="flex items-center"><LucidePhone size={12} className="mr-1.5 opacity-50" /> {customer.mobile}</div>
                                            {customer.email && <div className="flex items-center"><LucideMail size={12} className="mr-1.5 opacity-50" /> {customer.email}</div>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{customer.total_visits}</td>
                                    <td className="px-6 py-4 font-medium text-black">{formatCurrency(customer.total_spend)}</td>
                                    <td className="px-6 py-4 text-black">
                                        {new Date(customer.last_visit).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline">View History</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </div>
            </div>
        </div>
    );
}
