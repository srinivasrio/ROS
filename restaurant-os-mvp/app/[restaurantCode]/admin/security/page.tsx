'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
    Shield, 
    AlertTriangle, 
    Key, 
    Laptop, 
    Globe, 
    Clock, 
    Mail, 
    Trash2, 
    LogOut, 
    CheckCircle, 
    Lock, 
    RefreshCw, 
    Eye, 
    EyeOff,
    UserCheck,
    UserX
} from 'lucide-react';

import { getCached, setCache, hasFreshCache } from '@/lib/data-cache';
import { requestManager } from '@/lib/cache/request-manager';
import { SyncIndicator } from '@/components/admin/SyncIndicator';
import { SafeEmailBody } from '@/components/admin/SafeEmailBody';

interface MetricCardProps {
    title: string;
    value: number;
    icon: any;
    color: string;
    description: string;
}

function MetricCard({ title, value, icon: Icon, color, description }: MetricCardProps) {
    return (
        <div className="bg-white/5 dark:bg-zinc-900/50 backdrop-blur-md border border-neutral-200/50 dark:border-zinc-800/50 rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:border-orange-500/20 shadow-sm">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm font-bold text-neutral-500 dark:text-zinc-400 tracking-wide uppercase">{title}</p>
                    <h3 className="text-3xl font-black mt-1 text-neutral-900 dark:text-white tracking-tight">{value}</h3>
                </div>
                <div className={`p-3 rounded-xl ${color} bg-opacity-10 text-opacity-100 flex items-center justify-center`}>
                    <Icon size={20} />
                </div>
            </div>
            <p className="text-xs font-semibold text-neutral-400 dark:text-zinc-500">{description}</p>
        </div>
    );
}

export default function SecurityCenterPage() {
    const params = useParams();
    const router = useRouter();
    const restaurantCode = params.restaurantCode as string;

    const cacheKey = `security-${restaurantCode}`;
    const cached = getCached<any>(cacheKey);

    const [loading, setLoading] = useState(!cached);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [metrics, setMetrics] = useState<any>(cached?.metrics || null);
    const [recentAudits, setRecentAudits] = useState<any[]>(cached?.recentAudits || []);
    const [recentEmails, setRecentEmails] = useState<any[]>(cached?.recentEmails || []);
    const [securityAlerts, setSecurityAlerts] = useState<any[]>(cached?.securityAlerts || []);
    const [sessions, setSessions] = useState<any[]>(cached?.sessions || []);
    
    // Password state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setPwError] = useState('');
    const [pwSuccess, setPwSuccess] = useState('');

    // Fetch Dashboard Data
    const fetchData = useCallback(async (force = false) => {
        if (!restaurantCode) return;
        const currentCached = getCached<any>(cacheKey);
        if (currentCached && !metrics) {
            setMetrics(currentCached.metrics);
            setRecentAudits(currentCached.recentAudits);
            setRecentEmails(currentCached.recentEmails);
            setSecurityAlerts(currentCached.securityAlerts);
            setSessions(currentCached.sessions);
            setLoading(false);
        }

        if (!force && hasFreshCache(cacheKey)) {
            setLoading(false);
            return;
        }

        if (!metrics && !currentCached) {
            setLoading(true);
        } else {
            setIsSyncing(true);
        }

        try {
            const data = await requestManager.coalesce(cacheKey, async () => {
                const [dashRes, sessRes] = await Promise.all([
                    fetch(`/api/auth/security/dashboard`),
                    fetch(`/api/auth/sessions`)
                ]);

                let newMetrics = metrics;
                let newAudits = recentAudits;
                let newEmails = recentEmails;
                let newAlerts = securityAlerts;
                let newSessions = sessions;

                if (dashRes.ok) {
                    const dashData = await dashRes.json();
                    newMetrics = dashData.metrics;
                    newAudits = dashData.recentAudits;
                    newEmails = dashData.recentEmails;
                    newAlerts = dashData.securityAlerts;
                }
                if (sessRes.ok) {
                    const sessData = await sessRes.json();
                    newSessions = sessData.sessions || [];
                }

                return {
                    metrics: newMetrics,
                    recentAudits: newAudits,
                    recentEmails: newEmails,
                    securityAlerts: newAlerts,
                    sessions: newSessions
                };
            }, 3);

            if (data) {
                setMetrics(data.metrics);
                setRecentAudits(data.recentAudits);
                setRecentEmails(data.recentEmails);
                setSecurityAlerts(data.securityAlerts);
                setSessions(data.sessions);
                setCache(cacheKey, data, { ttlMs: 15 * 60 * 1000 });
                setLastSync(new Date());
            }
        } catch (err) {
            console.error('Error fetching security data:', err);
        } finally {
            setLoading(false);
            setIsSyncing(false);
        }
    }, [restaurantCode, cacheKey, metrics]);

    useEffect(() => {
        fetchData();
    }, [restaurantCode, fetchData]);

    // Handle session termination
    const handleTerminateSession = async (sessionId: string) => {
        if (!confirm('Are you sure you want to revoke this session?')) return;
        try {
            const res = await fetch(`/api/auth/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'terminate', sessionId })
            });

            const data = await res.json();
            if (data.success) {
                if (data.loggedOutCurrent) {
                    window.location.href = '/login';
                } else {
                    fetchData();
                }
            } else {
                alert(data.error || 'Failed to terminate session');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to terminate session');
        }
    };

    // Terminate all sessions
    const handleTerminateAllSessions = async () => {
        if (!confirm('WARNING: This will log you out and terminate all active sessions for your account. Continue?')) return;
        try {
            const res = await fetch(`/api/auth/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'terminate-all' })
            });

            const data = await res.json();
            if (data.success) {
                window.location.href = '/login';
            } else {
                alert(data.error || 'Failed to terminate sessions');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to terminate sessions');
        }
    };

    // Handle Password Change
    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwError('');
        setPwSuccess('');

        if (newPassword !== confirmPassword) {
            setPwError('New passwords do not match');
            return;
        }

        // Basic complexity check
        if (newPassword.length < 12) {
            setPwError('Password must be at least 12 characters');
            return;
        }

        setPwLoading(true);
        try {
            const res = await fetch(`/api/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setPwSuccess('Password changed successfully! Logging out other sessions...');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setTimeout(() => {
                    fetchData();
                }, 1500);
            } else {
                setPwError(data.error || 'Failed to update password');
            }
        } catch (err) {
            console.error(err);
            setPwError('An error occurred. Please try again.');
        } finally {
            setPwLoading(false);
        }
    };

    if (loading && !metrics) {
        return (
            <div className="flex items-center justify-center min-h-[80vh]">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="animate-spin text-orange-500" size={32} />
                    <p className="text-sm font-semibold text-neutral-500">Loading security logs...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 pb-16">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-neutral-200/50 dark:border-zinc-800/50 pb-6">
                <div>
                    <h1 className="text-3xl font-black text-neutral-900 dark:text-white flex items-center gap-3">
                        <Shield className="text-orange-500" strokeWidth={2.5} size={32} />
                        Security Center
                    </h1>
                    <p className="text-neutral-500 dark:text-zinc-400 font-semibold text-sm mt-1">
                        Monitor active login sessions, security events, policy updates, and email alert audits.
                    </p>
                </div>
                <SyncIndicator isSyncing={isSyncing} lastSync={lastSync} onRefresh={() => fetchData(true)} />
            </div>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard 
                    title="Failed Logins" 
                    value={metrics?.failedLogins || 0} 
                    icon={AlertTriangle} 
                    color="bg-red-500/10 text-red-500"
                    description="Failed logins in the last 30 days"
                />
                <MetricCard 
                    title="Locked Accounts" 
                    value={metrics?.lockedAccounts || 0} 
                    icon={Lock} 
                    color="bg-amber-500/10 text-amber-500"
                    description="Accounts locked due to 5+ failed attempts"
                />
                <MetricCard 
                    title="Suspended Users" 
                    value={metrics?.suspendedUsers || 0} 
                    icon={UserX} 
                    color="bg-rose-500/10 text-rose-500"
                    description="Currently suspended employee accounts"
                />
                <MetricCard 
                    title="MFA Reset Requests" 
                    value={metrics?.mfaResetRequests || 0} 
                    icon={Key} 
                    color="bg-blue-500/10 text-blue-500"
                    description="Employees awaiting TOTP setup"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Sessions Management */}
                <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-zinc-900/40 border border-neutral-200/60 dark:border-zinc-850 rounded-2xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2">
                                    <Laptop className="text-orange-500" size={20} />
                                    Active Login Sessions
                                </h2>
                                <p className="text-xs font-semibold text-neutral-450 dark:text-zinc-500">
                                    Manage devices and browsers currently logged into your account.
                                </p>
                            </div>
                            <button 
                                onClick={handleTerminateAllSessions}
                                className="px-4 py-2 bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white transition-all rounded-xl text-xs font-bold border border-red-600/20"
                            >
                                Logout All Sessions
                            </button>
                        </div>

                        <div className="space-y-4">
                            {sessions.map((sess) => (
                                <div 
                                    key={sess.id}
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                                        sess.isCurrent 
                                            ? 'bg-orange-500/5 border-orange-500/20' 
                                            : 'bg-white dark:bg-zinc-950/20 border-neutral-200/50 dark:border-zinc-800/40 hover:border-neutral-300 dark:hover:border-zinc-800'
                                    }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl ${sess.isCurrent ? 'bg-orange-500/10 text-orange-500' : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-500 dark:text-zinc-400'}`}>
                                            <Laptop size={20} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-sm text-neutral-850 dark:text-slate-100 uppercase">
                                                    {sess.device} • {sess.browser}
                                                </span>
                                                {sess.isCurrent && (
                                                    <span className="px-2 py-0.5 text-[10px] bg-orange-500 text-white rounded font-black uppercase tracking-wider">
                                                        Current
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-neutral-400 dark:text-zinc-500 mt-0.5">
                                                <span className="flex items-center gap-1">
                                                    <Globe size={12} /> {sess.ipAddress}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} /> Logged in: {new Date(sess.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    Active: {new Date(sess.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleTerminateSession(sess.id)}
                                        className="p-2 text-neutral-400 hover:text-red-500 hover:bg-neutral-150 dark:hover:bg-zinc-850 rounded-xl transition-all"
                                        title="Revoke session"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Recent Security Alerts Log */}
                    <div className="bg-white dark:bg-zinc-900/40 border border-neutral-200/60 dark:border-zinc-850 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2 mb-2">
                            <AlertTriangle className="text-amber-500" size={20} />
                            Security Monitoring Anomaly Alerts
                        </h2>
                        <p className="text-xs font-semibold text-neutral-450 dark:text-zinc-500 mb-6">
                            Recent system-detected suspicious events or multi-tenant authorization bypass attempts.
                        </p>

                        <div className="max-h-[360px] overflow-y-auto space-y-3 premium-scrollbar pr-1">
                            {securityAlerts.length === 0 ? (
                                <div className="text-center py-8 text-neutral-450 dark:text-zinc-500 text-xs font-semibold">
                                    No suspicious security alerts have been generated.
                                </div>
                            ) : (
                                securityAlerts.map((alert) => (
                                    <div 
                                        key={alert.id}
                                        className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-950/10 border border-amber-500/20 dark:border-amber-950/30 flex items-start gap-3"
                                    >
                                        <AlertTriangle className="text-amber-500 mt-0.5 flex-shrink-0" size={16} />
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <span className="font-bold text-xs text-amber-500 uppercase tracking-wider">{alert.type.replace(/_/g, ' ')}</span>
                                                <span className="text-[10px] text-neutral-400 dark:text-zinc-500 font-bold">{new Date(alert.created_at).toLocaleString()}</span>
                                            </div>
                                            <p className="text-sm font-semibold text-neutral-800 dark:text-zinc-300 mt-1">{alert.message}</p>
                                            {alert.details && (
                                                <pre className="mt-2 p-2 bg-neutral-900/90 rounded text-[10px] text-zinc-400 overflow-x-auto font-mono">
                                                    {JSON.stringify(alert.details, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Password Policy & Change password */}
                <div className="space-y-8">
                    <div className="bg-white dark:bg-zinc-900/40 border border-neutral-200/60 dark:border-zinc-850 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2 mb-2">
                            <Key className="text-orange-500" size={20} />
                            Change Password
                        </h2>
                        <p className="text-xs font-semibold text-neutral-450 dark:text-zinc-500 mb-6">
                            Must be 12+ chars, uppercase, lowercase, digit, and special character. Previous 5 passwords cannot be reused.
                        </p>

                        <form onSubmit={handleChangePassword} className="space-y-4">
                            {pwError && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs font-semibold">
                                    {pwError}
                                </div>
                            )}
                            {pwSuccess && (
                                <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl text-xs font-semibold flex items-center gap-2">
                                    <CheckCircle size={16} />
                                    {pwSuccess}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">Current Password</label>
                                <div className="relative">
                                    <input 
                                        type={showCurrent ? 'text' : 'password'}
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        className="w-full bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/40 transition-colors"
                                        required
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowCurrent(!showCurrent)}
                                        className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-200"
                                    >
                                        {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">New Password</label>
                                <div className="relative">
                                    <input 
                                        type={showNew ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        className="w-full bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/40 transition-colors"
                                        required
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowNew(!showNew)}
                                        className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-200"
                                    >
                                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-neutral-500 dark:text-zinc-400 uppercase mb-1.5">Confirm New Password</label>
                                <div className="relative">
                                    <input 
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full bg-neutral-50 dark:bg-zinc-950 border border-neutral-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-500/40 transition-colors"
                                        required
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowConfirm(!showConfirm)}
                                        className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-zinc-200"
                                    >
                                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={pwLoading}
                                className="w-full py-3 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white rounded-xl text-sm font-bold shadow-md shadow-orange-500/10 transition-all flex items-center justify-center gap-2"
                            >
                                {pwLoading ? <RefreshCw className="animate-spin" size={16} /> : <Key size={16} />}
                                Update Password
                            </button>
                        </form>
                    </div>

                    {/* Email Log Card (Mock Email Auditing) */}
                    <div className="bg-white dark:bg-zinc-900/40 border border-neutral-200/60 dark:border-zinc-850 rounded-2xl p-6 shadow-sm">
                        <h2 className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2 mb-2">
                            <Mail className="text-orange-500" size={20} />
                            Security Alert Emails
                        </h2>
                        <p className="text-xs font-semibold text-neutral-450 dark:text-zinc-500 mb-6">
                            Sent security alerts and verification tokens audit log (mocked inbox).
                        </p>

                        <div className="max-h-[300px] overflow-y-auto space-y-3 premium-scrollbar pr-1">
                            {recentEmails.length === 0 ? (
                                <div className="text-center py-8 text-neutral-450 dark:text-zinc-500 text-xs font-semibold">
                                    No security notifications sent yet.
                                </div>
                            ) : (
                                recentEmails.map((email) => (
                                    <div 
                                        key={email.id}
                                        className="p-3 bg-neutral-50 dark:bg-zinc-950/30 border border-neutral-200/50 dark:border-zinc-800/40 rounded-xl space-y-1.5"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-bold text-xs text-neutral-600 dark:text-zinc-400 truncate max-w-[150px]">To: {email.to_email}</span>
                                            <span className="text-[9px] text-neutral-400 dark:text-zinc-500 font-bold">{new Date(email.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="font-extrabold text-xs text-neutral-900 dark:text-white">{email.subject}</div>
                                        <SafeEmailBody content={email.body} />
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Audit Log Card */}
            <div className="bg-white dark:bg-zinc-900/40 border border-neutral-200/60 dark:border-zinc-850 rounded-2xl p-6 shadow-sm">
                <h2 className="text-lg font-black text-neutral-900 dark:text-white flex items-center gap-2 mb-2">
                    <Shield className="text-orange-500" size={20} />
                    Recent Security Audit Events
                </h2>
                <p className="text-xs font-semibold text-neutral-450 dark:text-zinc-500 mb-6">
                    A comprehensive immutable security trail of login methods, resets, and code updates.
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-neutral-200 dark:border-zinc-800 text-xs font-bold text-neutral-400 dark:text-zinc-500 uppercase tracking-wider">
                                <th className="pb-3 pl-4">Time</th>
                                <th className="pb-3">Action</th>
                                <th className="pb-3">IP Address</th>
                                <th className="pb-3">Browser/Device</th>
                                <th className="pb-3 pr-4">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200/50 dark:divide-zinc-800/40">
                            {recentAudits.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-xs font-semibold text-neutral-450 dark:text-zinc-500">
                                        No recent audit events logged.
                                    </td>
                                </tr>
                            ) : (
                                recentAudits.map((log) => (
                                    <tr key={log.id} className="text-xs font-semibold text-neutral-750 dark:text-zinc-300 hover:bg-neutral-50/50 dark:hover:bg-zinc-900/10">
                                        <td className="py-3 pl-4 text-neutral-450 dark:text-zinc-500">{new Date(log.created_at).toLocaleString()}</td>
                                        <td className="py-3">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                                log.action.includes('failed') || log.action.includes('suspend') || log.action.includes('trigger')
                                                    ? 'bg-red-500/10 text-red-500'
                                                    : 'bg-green-500/10 text-green-500'
                                            }`}>
                                                {log.action.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="py-3 font-mono">{log.ip_address || 'unknown'}</td>
                                        <td className="py-3">{log.browser || 'unknown'} / {log.device || 'unknown'}</td>
                                        <td className="py-3 pr-4 truncate max-w-xs" title={JSON.stringify(log.details)}>
                                            {JSON.stringify(log.details)}
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
