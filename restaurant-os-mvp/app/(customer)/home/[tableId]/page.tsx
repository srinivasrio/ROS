'use client';

import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Utensils, Clock, MapPin, Star, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function CustomerHome() {
    const params = useParams();
    const router = useRouter();
    const tableId = params.tableId as string;

    const offers = [
        { id: 1, title: 'Happy Hour', desc: '50% off on all drinks', color: 'bg-orange-500' },
        { id: 2, title: 'Family Pack', desc: 'Biryani + Starter + Coke @ 999', color: 'bg-blue-600' },
        { id: 3, title: 'Chef Special', desc: 'Try our new Paneer Tikka', color: 'bg-green-600' },
    ];

    const backgroundImages = [
        'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?q=80&w=1000&auto=format&fit=crop', // Chef
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1000&auto=format&fit=crop', // Ambiance
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=1000&auto=format&fit=crop'  // Food
    ];

    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentImageIndex((prev) => (prev + 1) % backgroundImages.length);
        }, 5000);
        return () => clearInterval(timer);
    }, []);

    return (
        <main className="flex-1 overflow-y-auto bg-gray-50 pb-28">
            {/* Hero Slideshow */}
            <div className="relative h-72 bg-neutral-900 text-white flex flex-col justify-end p-6 overflow-hidden">
                {backgroundImages.map((img, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: index === currentImageIndex ? 0.6 : 0 }}
                        transition={{ duration: 1 }}
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url('${img}')` }}
                    />
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>

                <div className="relative z-10">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 mb-3"
                    >
                        <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-white/10">
                            Table {tableId}
                        </span>
                        <span className="bg-green-500/20 text-green-300 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-green-500/20 flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-green-400 animate-pulse" /> Open
                        </span>
                    </motion.div>

                    <h1 className="text-5xl font-black leading-none mb-2 tracking-tight">
                        Welcome to <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-200">
                            Minerva
                        </span>
                    </h1>
                    <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                        <MapPin size={14} className="text-orange-500" />
                        <p>Nellore</p>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-px bg-white/5 border-b border-gray-100">
                <div className="bg-white p-4 flex items-center justify-center gap-3">
                    <div className="p-2.5 bg-orange-50 text-orange-600 rounded-full">
                        <Clock size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Kitchen Closes</p>
                        <p className="text-sm font-black text-gray-900">11:00 PM</p>
                    </div>
                </div>
                <div className="bg-white p-4 flex items-center justify-center gap-3">
                    <div className="p-2.5 bg-green-50 text-green-600 rounded-full">
                        <Star size={18} strokeWidth={2.5} />
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Rating</p>
                        <p className="text-sm font-black text-gray-900">4.8/5.0</p>
                    </div>
                </div>
            </div>

            {/* Explore Section (Redesigned) */}
            <div className="p-6">
                <h3 className="font-black text-xl text-gray-900 mb-4 tracking-tight">Explore</h3>
                <div className="grid grid-cols-2 gap-4">
                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push(`/menu/${tableId}`)}
                        className="group relative h-48 rounded-3xl overflow-hidden shadow-xl shadow-orange-500/10"
                    >
                        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=640')] bg-cover bg-center transition-transform duration-700 group-hover:scale-110"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 p-5 w-full">
                            <span className="text-white font-bold text-lg leading-none">Browse <br /> Menu</span>
                        </div>
                    </motion.button>

                    <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push(`/service/${tableId}`)}
                        className="group relative h-48 rounded-3xl overflow-hidden shadow-xl shadow-blue-500/10"
                    >
                        <div className="absolute inset-0 bg-[url('/images/waiter-call.png')] bg-cover bg-center transition-transform duration-700 group-hover:scale-110"></div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                        <div className="absolute bottom-0 left-0 p-5 w-full">
                            <span className="text-white font-bold text-lg leading-none">Call <br /> Waiter</span>
                        </div>
                    </motion.button>
                </div>
            </div>

            {/* Offers Slider */}
            <div className="pl-6 pb-6">
                <div className="flex items-center justify-between pr-6 mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Today's Offers</h2>
                    <span className="text-xs font-bold text-orange-600 uppercase tracking-wide">View All</span>
                </div>

                <div className="flex gap-4 overflow-x-auto no-scrollbar pr-6 pb-4">
                    {offers.map(offer => (
                        <motion.div
                            key={offer.id}
                            whileTap={{ scale: 0.95 }}
                            className={`min-w-[260px] h-36 ${offer.color} rounded-2xl p-5 text-white shadow-lg relative overflow-hidden flex-shrink-0`}
                        >
                            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                            <div className="relative z-10 h-full flex flex-col justify-between">
                                <div>
                                    <span className="bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Limited Time</span>
                                    <h3 className="text-xl font-black mt-2 leading-tight">{offer.title}</h3>
                                </div>
                                <div className="flex items-end justify-between">
                                    <p className="text-xs font-medium opacity-90 line-clamp-1">{offer.desc}</p>
                                    <div className="bg-white/20 p-1.5 rounded-full backdrop-blur-sm">
                                        <ChevronRight size={14} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            <div className="px-6 text-center pb-8 opacity-50">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="size-1.5 rounded-full bg-green-500" />
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Operational</p>
                </div>
                <p className="text-[10px] text-gray-400">Powered by RestaurantOS</p>
            </div>
        </main>
    );
}
