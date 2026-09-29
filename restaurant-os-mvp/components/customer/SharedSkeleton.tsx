'use client';

import { motion } from 'framer-motion';

interface SharedSkeletonProps {
    type?: 'card' | 'list' | 'grid' | 'menu' | 'home';
    count?: number;
}

export const SharedSkeleton = ({ type = 'card', count = 3 }: SharedSkeletonProps) => {
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    };

    if (type === 'menu') {
        return (
            <div className="min-h-screen bg-white">
                {/* Header Skeleton */}
                <div className="h-16 bg-gray-50 border-b border-gray-100 flex items-center px-6 gap-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                    <div className="flex-1 h-8 bg-gray-200 rounded-xl animate-pulse" />
                    <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
                </div>
                
                {/* Categories Skeleton */}
                <div className="py-6 px-6 flex gap-6 overflow-hidden">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex flex-col items-center gap-2 shrink-0">
                            <div className="w-16 h-16 bg-gray-100 rounded-full animate-pulse border-2 border-gray-50" />
                            <div className="h-3 bg-gray-100 rounded-full w-12 animate-pulse" />
                        </div>
                    ))}
                </div>

                {/* Search & Filters Skeleton */}
                <div className="px-6 space-y-4">
                    <div className="h-12 bg-gray-100 rounded-2xl animate-pulse" />
                    <div className="flex gap-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-10 w-24 bg-gray-50 rounded-xl animate-pulse" />
                        ))}
                    </div>
                </div>

                {/* Items List Skeleton */}
                <div className="px-6 py-8 space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white rounded-2xl p-4 border border-gray-50 flex gap-4">
                            <div className="w-20 h-20 bg-gray-100 rounded-xl animate-pulse" />
                            <div className="flex-1 space-y-3">
                                <div className="h-4 bg-gray-100 rounded-full w-3/4 animate-pulse" />
                                <div className="h-3 bg-gray-100 rounded-full w-1/2 animate-pulse" />
                                <div className="h-6 bg-gray-100 rounded-full w-20 animate-pulse" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (type === 'home') {
        return (
            <div className="min-h-screen bg-white">
                {/* Profile Header Skeleton */}
                <div className="px-6 pt-12 pb-6 space-y-2">
                    <div className="h-4 bg-gray-200 rounded-full w-24 animate-pulse" />
                    <div className="h-8 bg-gray-200 rounded-full w-48 animate-pulse" />
                </div>

                {/* Banner Skeleton */}
                <div className="px-6 mb-8">
                    <div className="w-full h-48 bg-gray-100 rounded-3xl animate-pulse" />
                </div>

                {/* Categories Skeleton */}
                <div className="px-6 mb-8 space-y-4">
                    <div className="flex justify-between items-center">
                        <div className="h-4 bg-gray-100 rounded-full w-20 animate-pulse" />
                        <div className="h-3 bg-gray-100 rounded-full w-12 animate-pulse" />
                    </div>
                    <div className="flex gap-6 overflow-hidden">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex flex-col items-center gap-2">
                                <div className="w-16 h-16 bg-gray-100 rounded-full animate-pulse" />
                                <div className="h-3 bg-gray-100 rounded-full w-12 animate-pulse" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Vertical Sections Skeleton */}
                <div className="px-6 space-y-10">
                    {[1, 2].map(section => (
                        <div key={section} className="space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="h-4 bg-gray-100 rounded-full w-32 animate-pulse" />
                                <div className="h-3 bg-gray-100 rounded-full w-16 animate-pulse" />
                            </div>
                            <div className="flex gap-4 overflow-hidden">
                                {[1, 2].map(card => (
                                    <div key={card} className="w-72 bg-gray-50 rounded-3xl p-4 border border-gray-50 flex gap-4">
                                        <div className="w-20 h-20 bg-gray-100 rounded-2xl animate-pulse" />
                                        <div className="flex-1 space-y-2">
                                            <div className="h-3 bg-gray-100 rounded-full w-full animate-pulse" />
                                            <div className="h-3 bg-gray-100 rounded-full w-2/3 animate-pulse" />
                                            <div className="h-5 bg-gray-100 rounded-full w-16 animate-pulse mt-4" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <motion.div 
            variants={container}
            initial="hidden"
            animate="show"
            className="w-full space-y-4"
        >
            {[...Array(count)].map((_, i) => (
                <motion.div 
                    key={i} 
                    variants={item}
                    className="bg-white rounded-2xl p-4 border border-gray-100 flex gap-4"
                >
                    <div className="w-24 h-24 bg-gray-100 rounded-xl animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-3 py-1">
                        <div className="h-4 bg-gray-100 rounded-full w-3/4 animate-pulse" />
                        <div className="h-3 bg-gray-100 rounded-full w-1/2 animate-pulse" />
                        <div className="flex justify-between items-center pt-2">
                            <div className="h-6 bg-gray-100 rounded-full w-20 animate-pulse" />
                            <div className="h-8 bg-gray-100 rounded-full w-24 animate-pulse" />
                        </div>
                    </div>
                </motion.div>
            ))}
        </motion.div>
    );
};
