'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
    AlertTriangle as LucideAlertTriangle, 
    Trash2 as LucideTrash2, 
    X as LucideX,
    User as LucideUser,
    Shield as LucideShield,
    Phone as LucidePhone
} from 'lucide-react';

interface DeleteStaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    staffName: string;
    staffRole?: string;
    staffPhone?: string;
    employeeId?: string | null;
    isPermanent?: boolean;
    isLoading?: boolean;
}

export default function DeleteStaffModal({
    isOpen,
    onClose,
    onConfirm,
    staffName,
    staffRole,
    staffPhone,
    employeeId,
    isPermanent = false,
    isLoading = false
}: DeleteStaffModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop Blur */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => !isLoading && onClose()}
                    className="absolute inset-0 bg-black/65 backdrop-blur-md"
                />

                {/* Modal Container */}
                <motion.div
                    initial={{ scale: 0.92, opacity: 0, y: 16 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.92, opacity: 0, y: 16 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl relative z-10 overflow-hidden border border-neutral-100"
                >
                    {/* Top Ambient Glow */}
                    <div className={`absolute -top-12 -right-12 w-36 h-36 rounded-full blur-3xl opacity-25 pointer-events-none ${isPermanent ? 'bg-red-600' : 'bg-amber-500'}`} />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-slate-200 rounded-full blur-2xl opacity-30 pointer-events-none" />

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                        <LucideX size={18} />
                    </button>

                    <div className="flex flex-col items-center text-center">
                        {/* Header Warning Icon */}
                        <div className={`size-16 rounded-2xl flex items-center justify-center mb-4 ring-8 shadow-md ${
                            isPermanent 
                                ? 'bg-red-50 text-red-600 ring-red-50/70 border border-red-200' 
                                : 'bg-amber-50 text-amber-600 ring-amber-50/70 border border-amber-200'
                        }`}>
                            {isPermanent ? <LucideTrash2 size={28} /> : <LucideAlertTriangle size={28} />}
                        </div>

                        {/* Title & Description */}
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">
                            {isPermanent ? 'Permanently Delete Staff?' : 'Delete Staff Member?'}
                        </h3>
                        <p className="text-slate-500 font-medium text-xs mt-1.5 max-w-xs leading-relaxed">
                            {isPermanent 
                                ? 'This action is irreversible. All login credentials, attendance records, and workload assignments will be permanently erased.'
                                : 'This staff member will be removed from active duty and moved to the archive directory.'}
                        </p>

                        {/* Staff Profile Preview Card */}
                        <div className="w-full bg-slate-50/90 rounded-2xl p-4 my-5 border border-slate-200/80 text-left flex items-center gap-3.5 shadow-xs">
                            <div className="size-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                                {staffName ? staffName.charAt(0).toUpperCase() : 'S'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-900 truncate">{staffName}</h4>
                                    {staffRole && (
                                        <span className="px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-700 text-[10px] font-extrabold uppercase tracking-wide">
                                            {staffRole}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-[11px] font-medium text-slate-500">
                                    {employeeId && (
                                        <span className="font-mono text-slate-600 font-bold">ID: {employeeId}</span>
                                    )}
                                    {staffPhone && (
                                        <span className="flex items-center gap-1 font-mono text-slate-600">
                                            <LucidePhone size={10} />
                                            {staffPhone}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions Button Row */}
                        <div className="grid grid-cols-2 gap-3 w-full">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isLoading}
                                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all text-xs active:scale-95 disabled:opacity-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={onConfirm}
                                disabled={isLoading}
                                className={`w-full py-3 text-white font-extrabold rounded-xl transition-all text-xs shadow-md active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${
                                    isPermanent 
                                        ? 'bg-red-600 hover:bg-red-700 shadow-red-600/25' 
                                        : 'bg-red-500 hover:bg-red-600 shadow-red-500/25'
                                } disabled:opacity-50`}
                            >
                                {isLoading ? (
                                    <span className="flex items-center gap-1.5">
                                        <span className="size-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                        Deleting...
                                    </span>
                                ) : (
                                    <>
                                        <LucideTrash2 size={14} />
                                        {isPermanent ? 'Delete Forever' : 'Delete Staff'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
