"use client";

import { useEffect, useState } from "react";
import { 
    Users as LucideUsers, 
    CheckCircle, 
    XCircle, 
    Clock, 
    ChevronRight, 
    LayoutDashboard,
    Globe,
    Building2,
    ShieldCheck,
    Search,
    MapPin,
    FileText,
    Phone,
    Mail,
    Calendar,
    X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { UserService, UserProfile } from "../lib/services/users";
import { toast, Toaster } from "sonner";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import ComplianceDashboard from "../components/ComplianceDashboard";
import ThemeToggle from "../components/ThemeToggle";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

const SuperAdminDashboard = () => {
    const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
    const [approvedUsers, setApprovedUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeModule, setActiveModule] = useState<'restaurants' | 'compliance' | 'analytics' | 'billing'>('restaurants');
    const [restaurantTab, setRestaurantTab] = useState<'pending' | 'approved'>('pending');
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const [pending, approved] = await Promise.all([
                UserService.fetchPendingUsers(),
                UserService.fetchApprovedUsers()
            ]);
            setPendingUsers(pending);
            setApprovedUsers(approved);
        } catch (error) {
            console.error("Error loading users:", error);
            toast.error("Failed to load restaurant data");
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (userId: string, restaurantName: string) => {
        try {
            await UserService.approveUser(userId, restaurantName);
            toast.success("Restaurant approved successfully");
            setSelectedUser(null);
            loadUsers();
        } catch (error) {
            toast.error("Approval failed");
        }
    };

    const handleReject = async (userId: string) => {
        if (!confirm("Are you sure you want to delete this registration?")) return;
        try {
            await UserService.deleteUser(userId);
            toast.success("Registration deleted");
            loadUsers();
        } catch (error) {
            toast.error("Deletion failed");
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div className="flex min-h-screen bg-background text-foreground transition-colors duration-300">
            <Toaster richColors position="top-right" />
            
            {/* Sidebar */}
            <aside className="w-64 border-r border-border bg-sidebar p-6 hidden md:block">
                <div className="flex items-center gap-3 mb-10 px-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-coral-500 to-amber-500 flex items-center justify-center shadow-lg shadow-coral-500/20">
                        <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-tight">Dine In One</h1>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold tracking-tighter">SaaS Manager</p>
                    </div>
                </div>

                <nav className="space-y-2">
                    <button 
                        onClick={() => setActiveModule('restaurants')}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                            activeModule === 'restaurants' ? "bg-muted text-foreground border border-border" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <LayoutDashboard className="w-5 h-5 opacity-70" />
                        <span className="font-medium">Restaurants</span>
                    </button>
                    <button 
                        onClick={() => setActiveModule('compliance')}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                            activeModule === 'compliance' ? "bg-muted text-foreground border border-border" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <ShieldCheck className="w-5 h-5 opacity-70" />
                        <span className="font-medium">Compliance</span>
                    </button>
                    <button 
                        onClick={() => setActiveModule('analytics')}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                            activeModule === 'analytics' ? "bg-muted text-foreground border border-border" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <Globe className="w-5 h-5 opacity-70" />
                        <span className="font-medium">SaaS Analytics</span>
                    </button>
                    <button 
                        onClick={() => setActiveModule('billing')}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                            activeModule === 'billing' ? "bg-muted text-foreground border border-border" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <Building2 className="w-5 h-5 opacity-70" />
                        <span className="font-medium">Billing & Plans</span>
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 overflow-y-auto bg-background">
                <header className="h-20 border-b border-border bg-card/50 backdrop-blur-xl flex items-center justify-between px-8 sticky top-0 z-10 transition-colors">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black">
                            {activeModule === 'restaurants' ? 'Restaurant Management' : 
                             activeModule === 'compliance' ? 'Compliance Center' : 
                             activeModule === 'analytics' ? 'Global Analytics' : 'Billing & Operations'}
                        </h2>
                        <div className="h-6 w-px bg-border" />
                        <p className="text-muted-foreground text-sm font-medium">
                            {activeModule === 'restaurants' ? 'Reviewing global registrations' : 
                             activeModule === 'compliance' ? 'Audit and legal tracking' : 
                             'Monitoring platform health'}
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {activeModule === 'restaurants' && (
                            <div className="flex items-center gap-3 bg-muted p-1 rounded-xl border border-border">
                                <button 
                                    onClick={() => setRestaurantTab('pending')}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                                        restaurantTab === 'pending' ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Clock className="w-4 h-4" />
                                    Pending
                                    {pendingUsers.length > 0 && (
                                        <span className="bg-coral-500 text-white text-[10px] px-1.5 rounded-full">
                                            {pendingUsers.length}
                                        </span>
                                    )}
                                </button>
                                <button 
                                    onClick={() => setRestaurantTab('approved')}
                                    className={cn(
                                        "px-4 py-1.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                                        restaurantTab === 'approved' ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Approved
                                </button>
                            </div>
                        )}
                        <ThemeToggle />
                    </div>
                </header>

                <div className="p-8">
                    <AnimatePresence mode="wait">
                        {activeModule === 'compliance' ? (
                            <ComplianceDashboard key="compliance" />
                        ) : activeModule === 'restaurants' ? (
                            loading ? (
                                <motion.div 
                                    key="loader"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center h-64"
                                >
                                    <div className="w-8 h-8 border-2 border-coral-500/20 border-t-coral-500 rounded-full animate-spin mb-4" />
                                    <p className="text-white/40 text-sm">Syncing platform data...</p>
                                </motion.div>
                            ) : (
                                <motion.div 
                                    key={restaurantTab}
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="grid gap-4"
                                >
                                    {restaurantTab === 'pending' ? (
                                        pendingUsers.length === 0 ? (
                                            <div className="bg-card border border-dashed border-border rounded-[2.5rem] p-12 text-center shadow-sm">
                                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4 border border-border">
                                                    <CheckCircle className="w-8 h-8 text-muted-foreground/50" />
                                                </div>
                                                <h3 className="text-lg font-black text-foreground">All Caught Up!</h3>
                                                <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-2">No pending restaurant registrations at the moment.</p>
                                            </div>
                                        ) : (
                                            pendingUsers.map(user => (
                                                <motion.div 
                                                    key={user.id} 
                                                    variants={itemVariants}
                                                    className="group bg-card border border-border hover:border-accent/40 p-5 rounded-[2rem] flex items-center justify-between gap-4 transition-all hover:shadow-lg hover:shadow-accent/5 backdrop-blur-sm"
                                                >
                                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                                        <div className="w-12 h-12 shrink-0 rounded-2xl bg-coral-500/10 flex items-center justify-center border border-coral-500/20 group-hover:scale-110 transition-transform">
                                                            <Building2 className="w-6 h-6 text-coral-500" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="font-black text-base tracking-tight truncate">{user.restaurant_name || user.business_details?.name || "Untitled Restaurant"}</h4>
                                                                {!user.business_details && (
                                                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">Partial Data</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                                <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium truncate">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] shrink-0" />
                                                                    {user.email}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium shrink-0">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                                                    {new Date(user.created_at).toLocaleDateString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex gap-2 shrink-0">
                                                        <button 
                                                            onClick={() => setSelectedUser(user)}
                                                            className="px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-sm font-bold border border-transparent hover:border-border whitespace-nowrap"
                                                        >
                                                            Review Info
                                                        </button>
                                                        <button 
                                                            onClick={() => handleApprove(user.id, user.restaurant_name || '')}
                                                            className="px-4 py-2 rounded-xl bg-coral-500 text-white hover:bg-coral-600 transition-all text-sm font-black shadow-lg shadow-coral-500/30 flex items-center gap-2 whitespace-nowrap"
                                                        >
                                                            <CheckCircle className="w-4 h-4" />
                                                            Approve
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))
                                        )
                                    ) : (
                                        approvedUsers.length === 0 ? (
                                             <div className="bg-card border border-dashed border-border rounded-[2.5rem] p-12 text-center">
                                                <p className="text-muted-foreground">No approved partners yet.</p>
                                            </div>
                                        ) : (
                                            approvedUsers.map(user => (
                                                <motion.div 
                                                    key={user.id} 
                                                    variants={itemVariants}
                                                    className="bg-card border border-border p-5 rounded-[2rem] flex items-center justify-between hover:shadow-md transition-all group"
                                                >
                                                    <div className="flex items-center gap-5">
                                                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:rotate-6 transition-transform">
                                                            <Building2 className="w-7 h-7 text-emerald-500" />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-black text-lg tracking-tight">{user.restaurant_name}</h4>
                                                            <p className="text-sm text-muted-foreground font-medium">{user.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Status</p>
                                                            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-xs font-black border border-emerald-500/20">
                                                                Active Partner
                                                            </span>
                                                        </div>
                                                        <button onClick={() => handleReject(user.id)} className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all border border-border shadow-sm">
                                                            <XCircle className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </motion.div>
                                            ))
                                        )
                                    )}
                                </motion.div>
                            )
                        ) : (
                            <div className="flex flex-col items-center justify-center h-96 text-center text-white/20">
                                <LayoutDashboard className="w-12 h-12 mb-4" />
                                <h3 className="text-xl font-bold">Module Under Development</h3>
                                <p className="text-sm max-w-xs mt-2">The {activeModule} module is currently being optimized for global scale.</p>
                            </div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            {/* Application Detail Modal */}
            <AnimatePresence>
                {selectedUser && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="bg-card border border-border w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden"
                        >
                            <div className="p-8 border-b border-border flex justify-between items-center bg-muted/30">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-coral-500/10 flex items-center justify-center border border-coral-500/20">
                                        <Building2 className="w-6 h-6 text-coral-500" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black">{selectedUser.restaurant_name}</h3>
                                        <p className="text-sm text-muted-foreground uppercase tracking-widest font-black text-[10px]">Registration Application</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedUser(null)}
                                    className="w-10 h-10 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-8 grid grid-cols-2 gap-8 max-h-[60vh] overflow-y-auto">
                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Building2 className="w-3 h-3" /> Business Info
                                        </h4>
                                        <div className="space-y-4">
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Owner Name</p>
                                                <p className="font-bold text-sm">{selectedUser.business_details?.owner_name || selectedUser.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Type</p>
                                                <p className="font-bold text-sm">{selectedUser.legal_details?.business_type || 'N/A'}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Mail className="w-4 h-4 text-muted-foreground" />
                                                <p className="text-sm font-medium">{selectedUser.email}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-4 h-4 text-muted-foreground" />
                                                <p className="text-sm font-medium">{selectedUser.business_details?.phone || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <ShieldCheck className="w-3 h-3" /> Compliance Details
                                        </h4>
                                        <div className="space-y-3">
                                            <div className="p-3 rounded-xl bg-muted/50 border border-border">
                                                <p className="text-[10px] text-muted-foreground uppercase font-black">GSTIN</p>
                                                <p className="font-mono text-sm font-bold">{selectedUser.legal_details?.gst_number || 'PENDING'}</p>
                                            </div>
                                            <div className="p-3 rounded-xl bg-muted/50 border border-border">
                                                <p className="text-[10px] text-muted-foreground uppercase font-black">FSSAI License</p>
                                                <p className="font-mono text-sm font-bold">{selectedUser.legal_details?.fssai_number || 'PENDING'}</p>
                                            </div>
                                            <div className="p-3 rounded-xl bg-muted/50 border border-border">
                                                <p className="text-[10px] text-muted-foreground uppercase font-black">PAN (Business)</p>
                                                <p className="font-mono text-sm font-bold">{selectedUser.legal_details?.pan_number || 'PENDING'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <MapPin className="w-3 h-3" /> Location
                                        </h4>
                                        <p className="text-sm font-medium leading-relaxed bg-muted/30 p-4 rounded-2xl border border-border">
                                            {selectedUser.business_details?.address || 'No address provided'}
                                        </p>
                                        <div className="mt-2 text-[10px] text-muted-foreground flex gap-3 font-bold uppercase">
                                            <span>Lat: {selectedUser.business_details?.latitude || '0.0'}</span>
                                            <span>Long: {selectedUser.business_details?.longitude || '0.0'}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Clock className="w-3 h-3" /> Operations
                                        </h4>
                                        <div className="flex flex-col gap-4">
                                            <div className="flex gap-4">
                                                <div className="flex-1 p-3 rounded-xl bg-muted/50 border border-border">
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">Opening Date</p>
                                                    <p className="text-sm font-bold">{selectedUser.business_details?.opening_date || 'N/A'}</p>
                                                </div>
                                                <div className="flex-1 p-3 rounded-xl bg-muted/50 border border-border">
                                                    <p className="text-[10px] text-muted-foreground uppercase font-black">Plan</p>
                                                    <span className="text-[10px] font-black uppercase text-coral-500 bg-coral-500/10 px-2 py-0.5 rounded-full inline-block mt-1">
                                                        {selectedUser.business_details?.subscription_plan || 'PRO'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-muted/50 border border-border">
                                                <p className="text-[10px] text-muted-foreground uppercase font-black">Operating Hours</p>
                                                <p className="text-sm font-bold">
                                                    {typeof selectedUser.business_details?.operating_hours === 'object' && selectedUser.business_details.operating_hours?.open
                                                        ? `${selectedUser.business_details.operating_hours.open} - ${selectedUser.business_details.operating_hours.close}`
                                                        : selectedUser.business_details?.operating_hours || 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-8 border-t border-border bg-muted/20 flex gap-4">
                                <button 
                                    onClick={() => handleReject(selectedUser.id)}
                                    className="flex-1 py-3 rounded-2xl text-rose-500 hover:bg-rose-500/10 transition-all font-black border border-transparent hover:border-rose-500/20"
                                >
                                    Reject Application
                                </button>
                                <button 
                                    onClick={() => handleApprove(selectedUser.id, selectedUser.restaurant_name || '')}
                                    className="flex-[2] py-3 rounded-2xl bg-coral-500 text-white hover:bg-coral-600 transition-all font-black shadow-xl shadow-coral-500/30 flex items-center justify-center gap-2"
                                >
                                    <CheckCircle className="w-5 h-5" />
                                    Approve & Onboard
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SuperAdminDashboard;
