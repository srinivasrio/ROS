
import { motion, AnimatePresence } from 'framer-motion';
import { LucideAlertTriangle, LucideCheckCircle2, LucideX } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isSuperDestructive?: boolean; // Red color
}

export default function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    isSuperDestructive = false
}: ConfirmationModalProps) {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal Card */}
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl relative z-10 overflow-hidden"
                >
                    {/* Decorative Elements */}
                    <div className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl opacity-20 pointer-events-none ${isSuperDestructive ? 'bg-red-500' : 'bg-orange-500'}`} />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gray-200 rounded-full blur-2xl opacity-20 pointer-events-none" />

                    <div className="flex flex-col items-center text-center space-y-4">
                        {/* Icon */}
                        <div className={`size-16 rounded-full flex items-center justify-center mb-2 ring-8 ${isSuperDestructive ? 'bg-red-50 text-red-500 ring-red-50/50' : 'bg-orange-50 text-orange-500 ring-orange-50/50'}`}>
                            {isSuperDestructive ? <LucideAlertTriangle size={32} /> : <LucideAlertTriangle size={32} />}
                        </div>

                        {/* Text */}
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-neutral-900">{title}</h3>
                            <p className="text-neutral-500 font-medium text-sm leading-relaxed">
                                {message}
                            </p>
                        </div>

                        {/* Buttons */}
                        <div className="grid grid-cols-2 gap-3 w-full pt-2">
                            <button
                                onClick={onClose}
                                className="w-full py-3.5 bg-gray-100 text-neutral-600 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={() => {
                                    onConfirm();
                                    onClose();
                                }}
                                className={`w-full py-3.5 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 text-sm ${isSuperDestructive
                                        ? 'bg-red-500 shadow-red-500/30 hover:bg-red-600'
                                        : 'bg-neutral-900 shadow-neutral-900/30 hover:bg-black'
                                    }`}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
