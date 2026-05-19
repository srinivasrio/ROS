import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 as LucideCheckCircle2, Receipt as LucideReceipt } from 'lucide-react';

interface BillRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function BillRequestModal({ isOpen, onClose }: BillRequestModalProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    >
                        {/* Modal Card */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
                            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl flex flex-col items-center text-center space-y-4 relative overflow-hidden"
                        >
                            {/* Decorative Background Blob */}
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-100 rounded-full blur-2xl opacity-50 pointer-events-none" />
                            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-100 rounded-full blur-2xl opacity-50 pointer-events-none" />

                            {/* Icon */}
                            <div className="size-20 bg-green-50 rounded-full flex items-center justify-center text-green-500 mb-2 ring-8 ring-green-50/50">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.1 }}
                                >
                                    <LucideCheckCircle2 size={40} strokeWidth={3} />
                                </motion.div>
                            </div>

                            {/* Content */}
                            <div className="space-y-2 z-10">
                                <h3 className="text-xl font-black text-black tracking-tight">Bill Requested!</h3>
                                <p className="text-black font-medium text-sm leading-relaxed">
                                    Your waiter has been notified and will trigger the payment process shortly.
                                </p>
                            </div>

                            {/* Button */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={onClose}
                                className="w-full py-3.5 bg-neutral-900 text-white font-bold rounded-xl shadow-lg shadow-neutral-900/20 hover:bg-black transition-all text-sm mt-2"
                            >
                                Okay, Got it
                            </motion.button>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
