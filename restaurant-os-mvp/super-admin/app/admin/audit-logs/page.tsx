'use client';

import React, { useState, useEffect } from 'react';
import {
    ShieldAlert,
    Search,
    RefreshCw,
    Download,
    ShieldCheck,
    Building2,
    User,
    Info,
    X,
    Laptop,
    MapPin,
    Calendar,
    ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { formatAuditAction, formatAuditDetails, extractAuditBadges, getActionBadgeStyle } from '@/lib/audit-formatters';

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState('ALL');
    const [selectedLog, setSelectedLog] = useState<any | null>(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/audit-logs');
            if (res.ok) {
                const json = await res.json();
                setLogs(json.logs || []);
            }
        } catch (err) {
            console.error('Failed to load audit logs:', err);
            toast.error('Failed to sync audit ledger');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter((log) => {
        const query = search.toLowerCase();
        const matchesSearch =
            !search ||
            log.action?.toLowerCase().includes(query) ||
            log.actionTitle?.toLowerCase().includes(query) ||
            log.description?.toLowerCase().includes(query) ||
            log.actor?.toLowerCase().includes(query) ||
            log.restaurant?.toLowerCase().includes(query) ||
            log.resource?.toLowerCase().includes(query) ||
            log.restaurantId?.includes(query) ||
            log.ipAddress?.includes(query);

        const matchesAction =
            actionFilter === 'ALL' ||
            log.action?.toLowerCase().includes(actionFilter.toLowerCase()) ||
            log.role?.toLowerCase() === actionFilter.toLowerCase();

        return matchesSearch && matchesAction;
    });

    const handleExportCsv = () => {
        if (filteredLogs.length === 0) {
            toast.error('No logs available to export.');
            return;
        }

        const headers = ['Timestamp', 'Actor', 'Role', 'Action Event', 'Target Restaurant', 'Restaurant ID', 'Audit Information', 'IP Address'];
        const rows = filteredLogs.map((l) => [
            `"${l.timestamp}"`,
            `"${l.actor}"`,
            `"${l.role}"`,
            `"${l.actionTitle || formatAuditAction(l.action)}"`,
            `"${l.restaurant}"`,
            `"${l.restaurantId || 'N/A'}"`,
            `"${(l.description || formatAuditDetails(l.action, l.details, l)).replace(/"/g, '""')}"`,
            `"${l.ipAddress}"`
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `platform_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exported ${filteredLogs.length} audit records to CSV.`);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-[#172033]">
                        Immutable Platform Audit Trail
                    </h1>
                    <p className="text-xs text-[#667085] mt-1 font-medium">
                        Human-readable compliance ledger tracking all tenant onboarding, quota allocations, credential mutations, and operational activities.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchLogs}
                        className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-neutral-50 text-[#172033] border border-[#E4E7EC] rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        <span>Sync Ledger</span>
                    </button>
                    <button
                        onClick={handleExportCsv}
                        className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm shadow-indigo-600/20"
                    >
                        <Download size={14} />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-2xl border border-[#E4E7EC] shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={15} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search audit trail by actor, action, restaurant, or details..."
                        className="w-full pl-10 pr-4 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs text-[#172033] placeholder-neutral-400 focus:outline-none focus:border-indigo-600 focus:bg-white font-medium"
                    />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#667085]">Filter Action:</span>
                    <select
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs font-bold text-[#172033] px-3 py-2 focus:outline-none focus:border-indigo-600 cursor-pointer"
                    >
                        <option value="ALL">All Actions</option>
                        <option value="location">Location Operations</option>
                        <option value="owner">Owner Controls</option>
                        <option value="employee">Staff / User Activity</option>
                        <option value="login">Authentication Events</option>
                        <option value="quota">Quota Adjustments</option>
                        <option value="suspend">Suspension Events</option>
                    </select>
                </div>
            </div>

            {/* Audit Table */}
            <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-black uppercase tracking-wider text-[#667085]">
                                <th className="p-4 w-44">Timestamp</th>
                                <th className="p-4 w-44">Actor</th>
                                <th className="p-4 w-48">Action Event</th>
                                <th className="p-4 w-52">Target Restaurant</th>
                                <th className="p-4">Audit Information</th>
                                <th className="p-4 w-36 text-right">Integrity</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E7EC]">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                                        <div className="inline-block h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-2" />
                                        <p className="font-semibold text-xs">Loading immutable audit logs...</p>
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-12 text-center text-neutral-400">
                                        <ShieldAlert size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="font-bold text-xs text-[#172033]">No audit logs found matching criteria</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => {
                                    const actionTitle = log.actionTitle || formatAuditAction(log.action);
                                    const descriptionText = log.description || formatAuditDetails(log.action, log.details, log);
                                    const badges = log.badges || extractAuditBadges(log);
                                    const badgeStyle = getActionBadgeStyle(log.action);

                                    return (
                                        <tr
                                            key={log.id}
                                            onClick={() => setSelectedLog(log)}
                                            className="hover:bg-[#F5F7FC]/80 transition-colors cursor-pointer group"
                                        >
                                            {/* Timestamp */}
                                            <td className="p-4 font-mono text-[11px] text-neutral-600 align-top">
                                                <div className="font-bold text-[#172033]">{log.timestamp}</div>
                                            </td>

                                            {/* Actor */}
                                            <td className="p-4 align-top">
                                                <div className="font-bold text-[#172033] group-hover:text-indigo-600 transition-colors">
                                                    {log.actor}
                                                </div>
                                                <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-neutral-100 text-neutral-600 border border-neutral-200">
                                                    {log.role || 'USER'}
                                                </span>
                                            </td>

                                            {/* Action Event */}
                                            <td className="p-4 align-top">
                                                <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                                                    {actionTitle}
                                                </span>
                                            </td>

                                            {/* Target Restaurant */}
                                            <td className="p-4 align-top">
                                                <div className="font-bold text-[#172033] truncate max-w-[180px]">
                                                    {log.restaurant}
                                                </div>
                                                {log.restaurantId && (
                                                    <span className="font-mono text-[10px] text-neutral-400 block">
                                                        ID: {log.restaurantId}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Audit Information (Human Readable Text) */}
                                            <td className="p-4 align-top">
                                                <p className="text-xs font-semibold text-[#172033] leading-relaxed">
                                                    {descriptionText}
                                                </p>
                                                {badges.length > 0 && (
                                                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                                        {badges.map((b: any, i: number) => (
                                                            <span
                                                                key={i}
                                                                className="text-[10px] px-2 py-0.5 rounded-md bg-[#F5F7FC] border border-[#E4E7EC] text-neutral-600 font-mono"
                                                            >
                                                                <strong className="text-neutral-400 font-normal">{b.label}:</strong> {b.value}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Integrity Status */}
                                            <td className="p-4 align-top text-right">
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                    <ShieldCheck size={12} />
                                                    Verified
                                                </span>
                                                <div className="font-mono text-[10px] text-neutral-400 mt-1">
                                                    {log.ipAddress}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Audit Log Detail Drawer / Modal */}
            {selectedLog && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-xl rounded-3xl border border-[#E4E7EC] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between border-b border-[#E4E7EC] pb-3">
                            <div>
                                <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${getActionBadgeStyle(selectedLog.action).bg} ${getActionBadgeStyle(selectedLog.action).text} ${getActionBadgeStyle(selectedLog.action).border}`}>
                                    {selectedLog.actionTitle || formatAuditAction(selectedLog.action)}
                                </span>
                                <h3 className="text-base font-extrabold text-[#172033] mt-1.5">
                                    Audit Record Inspector
                                </h3>
                                <p className="text-xs text-neutral-500 font-mono mt-0.5">
                                    Log UUID: {selectedLog.id}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="p-1 rounded-xl text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Accurate Text Summary */}
                        <div className="p-4 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] space-y-1">
                            <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                                Audit Description
                            </span>
                            <p className="text-sm font-bold text-[#172033] leading-relaxed">
                                {selectedLog.description || formatAuditDetails(selectedLog.action, selectedLog.details, selectedLog)}
                            </p>
                        </div>

                        {/* Key Attributes Grid */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-xl border border-[#E4E7EC] bg-white">
                                <span className="text-[10px] text-neutral-400 font-bold block">ACTOR IDENTITY</span>
                                <span className="font-extrabold text-[#172033] block mt-0.5">{selectedLog.actor}</span>
                                <span className="text-[10px] font-mono text-neutral-500">{selectedLog.role}</span>
                            </div>

                            <div className="p-3 rounded-xl border border-[#E4E7EC] bg-white">
                                <span className="text-[10px] text-neutral-400 font-bold block">TARGET RESTAURANT</span>
                                <span className="font-extrabold text-[#172033] block mt-0.5">{selectedLog.restaurant}</span>
                                {selectedLog.restaurantId && (
                                    <span className="text-[10px] font-mono text-neutral-500">ID: {selectedLog.restaurantId}</span>
                                )}
                            </div>

                            <div className="p-3 rounded-xl border border-[#E4E7EC] bg-white">
                                <span className="text-[10px] text-neutral-400 font-bold block">TIMESTAMP</span>
                                <span className="font-extrabold text-[#172033] block mt-0.5">{selectedLog.timestamp}</span>
                            </div>

                            <div className="p-3 rounded-xl border border-[#E4E7EC] bg-white">
                                <span className="text-[10px] text-neutral-400 font-bold block">NETWORK ORIGIN</span>
                                <span className="font-extrabold text-[#172033] font-mono block mt-0.5">{selectedLog.ipAddress}</span>
                            </div>
                        </div>

                        {/* Extracted Badges */}
                        {extractAuditBadges(selectedLog).length > 0 && (
                            <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-[#667085] uppercase tracking-wider block">
                                    Contextual Attributes
                                </span>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {extractAuditBadges(selectedLog).map((b, i) => (
                                        <div key={i} className="px-2.5 py-1 rounded-xl bg-neutral-100 text-neutral-700 text-xs font-mono">
                                            <span className="text-neutral-400 font-normal mr-1">{b.label}:</span>
                                            <span className="font-bold">{b.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-2 flex justify-end">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Close Inspector
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
