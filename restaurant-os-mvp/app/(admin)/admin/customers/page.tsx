'use client';

import { LucideSearch, LucideMail, LucidePhone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CustomerService, Customer } from '@/app/services/customers';
import { formatCurrency } from '@/app/lib/utils';

export default function Customers() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        try {
            const data = await CustomerService.fetchCustomers();
            setCustomers(data);
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
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-neutral-900">Customers</h2>
                    <p className="text-neutral-500">Manage customer database and view history.</p>
                </div>
                <div className="relative">
                    <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <input
                        type="text"
                        placeholder="Search by name or mobile..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm text-neutral-600">
                    <thead className="bg-neutral-50 text-neutral-900 font-medium border-b border-neutral-200">
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
                            <tr><td colSpan={6} className="px-6 py-10 text-center text-neutral-400">Loading customers...</td></tr>
                        ) : filteredCustomers.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-10 text-center text-neutral-400">No customers found.</td></tr>
                        ) : (
                            filteredCustomers.map((customer) => (
                                <tr key={customer.id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs mr-3">
                                                {customer.name.charAt(0)}
                                            </div>
                                            <span className="font-medium text-neutral-900">{customer.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 text-xs">
                                            <div className="flex items-center"><LucidePhone size={12} className="mr-1.5 opacity-50" /> {customer.mobile}</div>
                                            {customer.email && <div className="flex items-center"><LucideMail size={12} className="mr-1.5 opacity-50" /> {customer.email}</div>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{customer.total_visits}</td>
                                    <td className="px-6 py-4 font-medium text-neutral-900">{formatCurrency(customer.total_spend)}</td>
                                    <td className="px-6 py-4 text-neutral-500">
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
    );
}
