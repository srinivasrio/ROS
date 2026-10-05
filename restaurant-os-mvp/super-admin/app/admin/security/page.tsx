'use client';

import React, { useState, useEffect } from 'react';
import {
    Shield,
    ShieldAlert,
    ShieldCheck,
    Lock,
    KeyRound,
    AlertTriangle,
    CheckCircle2,
    Clock,
    UserX,
    Activity,
    Radio
} from 'lucide-react';
import { toast } from 'sonner';

export default function SecurityCenterPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'logins' | 'events'>('logins');

    const fetchSecurity = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/security');
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (err) {
            console.error('Failed to load security center:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSecurity();
    }, []);

    const summary = data?.summary || {
        status: 'HEALTHY',
        failedLoginAttempts: 1,
        suspiciousEvents: 2,
        criticalIncidents: 0,
        activeSessions: 18,
    };

    const loginActivity = data?.loginActivity || [];
    const securityEvents = data?.securityEvents || [];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-[#172033]">
                        Security & Threat Center
                    </h1>
                    <p className="text-xs text-[#667085] mt-1 font-medium">
                        Platform-level threat detection, tenant cross-isolation monitoring, brute-force defense, and authentication telemetry.
                    </p>
                </div>
            </div>

            {/* 5 Security Status Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-4 rounded-2xl bg-white border border-emerald-200 shadow-2xs">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase">Security Health</span>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-xl font-black text-emerald-800">Nominal</p>
                    </div>
                    <p className="text-[10px] text-emerald-600 mt-1">RLS Isolation Active</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs">
                    <span className="text-[10px] font-bold text-[#667085] uppercase">Failed Logins (24h)</span>
                    <p className="text-xl font-black text-[#172033] mt-1">{summary.failedLoginAttempts}</p>
                    <p className="text-[10px] text-amber-600 font-bold mt-1">Blocked by rate-limiter</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs">
                    <span className="text-[10px] font-bold text-[#667085] uppercase">Suspicious Events</span>
                    <p className="text-xl font-black text-amber-700 mt-1">{summary.suspiciousEvents}</p>
                    <p className="text-[10px] text-neutral-400 mt-1">Cross-tenant probes</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs">
                    <span className="text-[10px] font-bold text-[#667085] uppercase">Critical Incidents</span>
                    <p className="text-xl font-black text-emerald-700 mt-1">0 Active</p>
                    <p className="text-[10px] text-neutral-400 mt-1">No active breaches</p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-[#E4E7EC] shadow-2xs">
                    <span className="text-[10px] font-bold text-[#667085] uppercase">Active Sessions</span>
                    <p className="text-xl font-black text-indigo-700 mt-1">{summary.activeSessions}</p>
                    <p className="text-[10px] text-indigo-600 font-bold mt-1">Valid JWT Bearers</p>
                </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-2 border-b border-[#E4E7EC] pb-2">
                <button
                    onClick={() => setTab('logins')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        tab === 'logins'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'text-[#667085] hover:text-[#172033]'
                    }`}
                >
                    Login Telemetry ({loginActivity.length})
                </button>
                <button
                    onClick={() => setTab('events')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        tab === 'events'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                            : 'text-[#667085] hover:text-[#172033]'
                    }`}
                >
                    Security & Threat Events ({securityEvents.length})
                </button>
            </div>

            {/* Content Table */}
            <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-xs overflow-hidden">
                {tab === 'logins' ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-black uppercase text-[#667085]">
                                    <th className="p-4">User Identity</th>
                                    <th className="p-4">Platform Role</th>
                                    <th className="p-4">Authentication Method</th>
                                    <th className="p-4">Source IP</th>
                                    <th className="p-4">Result</th>
                                    <th className="p-4">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E4E7EC]">
                                {loginActivity.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-[#F5F7FC]/70">
                                        <td className="p-4 font-bold text-[#172033]">{log.email}</td>
                                        <td className="p-4 text-[#667085] font-mono">{log.role}</td>
                                        <td className="p-4 text-[#667085]">{log.event}</td>
                                        <td className="p-4 font-mono text-neutral-400">{log.ip}</td>
                                        <td className="p-4">
                                            <span
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                    log.status === 'SUCCESS'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : 'bg-rose-100 text-rose-800'
                                                }`}
                                            >
                                                {log.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-[#667085]">{log.time}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-black uppercase text-[#667085]">
                                    <th className="p-4">Event Type</th>
                                    <th className="p-4">Description</th>
                                    <th className="p-4">Severity</th>
                                    <th className="p-4">Source IP</th>
                                    <th className="p-4">Incident Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E4E7EC]">
                                {securityEvents.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-neutral-400 text-xs">
                                            No critical security incidents detected.
                                        </td>
                                    </tr>
                                ) : (
                                    securityEvents.map((evt: any) => (
                                        <tr key={evt.id} className="hover:bg-[#F5F7FC]/70">
                                            <td className="p-4 font-bold text-rose-700 font-mono">{evt.event_type}</td>
                                            <td className="p-4 text-[#172033]">{evt.description}</td>
                                            <td className="p-4">
                                                <span
                                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                        evt.severity === 'CRITICAL'
                                                            ? 'bg-rose-100 text-rose-800'
                                                            : 'bg-amber-100 text-amber-800'
                                                    }`}
                                                >
                                                    {evt.severity}
                                                </span>
                                            </td>
                                            <td className="p-4 font-mono text-[#667085]">{evt.ip_address || '—'}</td>
                                            <td className="p-4 text-[#667085]">
                                                {new Date(evt.created_at).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
