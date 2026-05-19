import { motion } from "framer-motion";
import { ShieldAlert, FileCheck, Users, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { ComplianceService, RestaurantLegal } from "../lib/services/compliance";

const ComplianceDashboard = () => {
    const [stats, setStats] = useState({
        expiredLicenses: 0,
        pendingVerifications: 0,
        filingDiscrepancies: 0,
    });
    const [alertItems, setAlertItems] = useState<any[]>([]);
    const [staffStats, setStaffStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const data = await ComplianceService.fetchAllComplianceData();
            const summary = await ComplianceService.fetchComplianceStats();
            const staff = await ComplianceService.fetchStaffComplianceStats();
            
            setStats(summary);
            setStaffStats(staff);
            
            // Generate dynamic alert items based on data
            const alerts = data
                .filter(item => {
                    const expiry = new Date(item.license_expiry_date);
                    const now = new Date();
                    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    return diffDays < 30 || item.status === 'flagged';
                })
                .map(item => ({
                    id: item.id,
                    restaurant: item.business_name,
                    issue: `${item.license_number ? 'License' : 'FSSAI'} expiring soon (${item.license_expiry_date})`,
                    severity: 'high'
                }));

            setAlertItems(alerts.length > 0 ? alerts : [
                { id: 'mock-1', restaurant: "Spice Garden", issue: "FSSAI License Expiring in 4 days", severity: "high" }
            ]);
        } catch (error) {
            console.error("Error loading compliance data:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin mb-4" />
                <p className="text-muted-foreground text-sm font-medium">Auditing platform compliance...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header section */}
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black mb-2 tracking-tight">Compliance Pulse</h2>
                    <p className="text-muted-foreground font-medium">Real-time monitoring of platform-wide legal standing.</p>
                </div>
                <div className="flex gap-4">
                    <button className="px-6 py-2 bg-muted rounded-xl hover:bg-neutral-200 dark:hover:bg-card transition-colors text-sm font-bold border border-border">
                        Download Audit Report
                    </button>
                    <button className="px-6 py-2 bg-orange-600 rounded-xl hover:bg-orange-500 transition-colors text-sm font-black text-white shadow-lg shadow-orange-600/20">
                        Initiate Global Audit
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { label: "Expired/Expiring Licenses", value: stats.expiredLicenses, icon: Calendar, color: "text-red-500", bg: "bg-red-500/10" },
                    { label: "Pending Staff Verifications", value: stats.pendingVerifications, icon: Users, color: "text-amber-500", bg: "bg-amber-500/10" },
                    { label: "Filing Discrepancies", value: stats.filingDiscrepancies, icon: ShieldAlert, color: "text-blue-500", bg: "bg-blue-500/10" },
                ].map((stat, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-card border border-border rounded-[2rem] p-8 hover:border-accent/40 transition-all group shadow-sm"
                    >
                        <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                            <stat.icon className={`w-6 h-6 ${stat.color}`} />
                        </div>
                        <p className="text-muted-foreground text-sm font-black uppercase tracking-widest mb-1">{stat.label}</p>
                        <h4 className="text-4xl font-black tracking-tighter">{stat.value}</h4>
                    </motion.div>
                ))}
            </div>

            {/* Critical Alerts Table */}
            <div className="bg-card border border-border rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="p-8 border-b border-border flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    <h3 className="font-black text-xl tracking-tight">Critical Compliance Alerts</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-muted/50 text-muted-foreground text-xs font-black uppercase tracking-widest border-b border-border">
                                <th className="px-8 py-5">Restaurant</th>
                                <th className="px-8 py-5">Concern</th>
                                <th className="px-8 py-5">Severity</th>
                                <th className="px-8 py-5">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {alertItems.map((item) => (
                                <tr key={item.id} className="group hover:bg-muted/30 transition-colors">
                                    <td className="px-8 py-6 font-black">{item.restaurant}</td>
                                    <td className="px-8 py-6 text-muted-foreground font-medium">{item.issue}</td>
                                    <td className="px-8 py-6 text-sm">
                                        <span className={`px-3 py-1 rounded-full font-black text-[10px] uppercase ${
                                            item.severity === 'high' ? 'bg-red-500/20 text-red-500' : 'bg-amber-500/20 text-amber-500'
                                        }`}>
                                            {item.severity}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <button className="text-sm font-bold text-orange-500 hover:text-orange-400 transition-colors">
                                            Notify Owner
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Staff Verification Tracker */}
                <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <FileCheck className="w-6 h-6 text-green-500" />
                            <h3 className="font-black text-xl tracking-tight">Staff Documentation</h3>
                        </div>
                        <span className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Last 24 hours</span>
                    </div>
                    <div className="space-y-6">
                        {staffStats.length === 0 ? (
                            <p className="text-sm text-neutral-500 text-center py-4">No staff documentation data available.</p>
                        ) : (
                            staffStats.map((item, i) => (
                                <div key={i}>
                                    <div className="flex justify-between text-sm mb-2 font-black">
                                        <span>{item.restaurant}</span>
                                        <span className="text-muted-foreground">{item.status}</span>
                                    </div>
                                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${item.percent}%` }}
                                            className={`h-full ${item.percent === 100 ? 'bg-green-500' : 'bg-orange-500'}`}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Audit Logs Preview */}
                <div className="bg-card border border-border rounded-[2.5rem] p-8 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-6 h-6 text-blue-500" />
                            <h3 className="font-black text-xl tracking-tight">Global Activity Stream</h3>
                        </div>
                        <button className="text-xs font-black text-muted-foreground hover:text-accent uppercase tracking-widest transition-colors">View All</button>
                    </div>
                    <div className="space-y-4">
                        {/* Mock Logs */}
                        {[
                            { user: "Admin (Spice Garden)", action: "Deleted Menu Item #54", time: "2m ago" },
                            { user: "Waiter 4 (Ocean Grill)", action: "Refunded Order #882", time: "15m ago" },
                            { user: "System", action: "Flagged Staff Member: Rahul K.", time: "1h ago" },
                        ].map((log, i) => (
                            <div key={i} className="flex gap-4 p-4 rounded-2xl bg-muted/50 border border-border/50">
                                <div className="w-1 h-full bg-accent rounded-full" />
                                <div className="flex-1">
                                    <p className="text-sm font-black">{log.user}</p>
                                    <p className="text-xs text-muted-foreground font-medium">{log.action}</p>
                                </div>
                                <span className="text-[10px] text-muted-foreground font-black uppercase">{log.time}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComplianceDashboard;
