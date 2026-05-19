'use client';

import { useState } from 'react';
import { Delete as LucideDelete, ChevronRight as LucideChevronRight, User as LucideUser, Lock as LucideLock, Loader2 as LucideLoader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { StaffService } from '@/app/services/staff';

export default function WaiterLogin() {
    const params = useParams();
    const restaurantCode = params.restaurantCode as string;
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleNumClick = (num: string) => {
        if (pin.length < 6) {
            setPin(prev => prev + num);
            setError('');
        }
    };

    const handleDelete = () => {
        setPin(prev => prev.slice(0, -1));
        setError('');
    };

    const handleLogin = async () => {
        if (pin.length === 0) return;
        setLoading(true);
        setError('');

        try {
            // Fetch staff using the restaurant code (mapped to restaurant_id in service)
            const allStaff = await StaffService.fetchStaff(restaurantCode);

            // Allow admin to login as waiter for testing if needed, or explicitly only waiters
            const user = allStaff.find(s => (s.role === 'waiter' || s.role === 'admin' || s.role === 'manager') && s.pin === pin && s.status === 'active');

            if (user) {
                // Persist session (Still used for identity in cleaner UI, but hidden from URL)
                localStorage.setItem('waiterSession', JSON.stringify({
                    id: user.id,
                    name: user.name,
                    role: user.role,
                    restaurantId: restaurantCode
                }));
                
                // Redirect to staff-identity route
                router.push(`/${restaurantCode}/waiter/${user.mobile}/dashboard`);
            } else {
                setError('Invalid PIN or inactive account. Please try again.');
                setPin('');
            }
        } catch (err) {
            console.error('Login error', err);
            setError('Failed to authenticate. Please check connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-sm flex flex-col items-center">

                <div className="mb-10 text-center">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-900/20">
                        <LucideUser className="text-white" size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Waiter Login</h1>
                    <p className="text-black text-sm mt-2">Enter your assigned PIN Number</p>
                </div>

                {/* PIN Display */}
                <div className="mb-10 w-full">
                    <div className={`h-16 bg-neutral-800 rounded-2xl flex items-center justify-center text-3xl font-mono tracking-widest border-2 transition-all duration-200 ${error ? 'border-red-500 text-red-500' : 'border-neutral-700 text-white focus-within:border-blue-500'
                        }`}>
                        {pin ? pin.split('').map(() => '•').join(' ') : <span className="text-black text-xl font-sans opacity-50">Enter PIN</span>}
                    </div>
                    {error && <p className="text-red-500 text-xs text-center mt-3 font-medium animate-pulse">{error}</p>}
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-4 w-full mb-8">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                            key={num}
                            onClick={() => handleNumClick(num.toString())}
                            className="h-16 rounded-2xl bg-neutral-800 text-white text-2xl font-medium hover:bg-neutral-700 active:bg-neutral-600 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-blue-500/50"
                        >
                            {num}
                        </button>
                    ))}
                    <div className="h-16"></div> {/* Empty slot for alignment */}
                    <button
                        onClick={() => handleNumClick('0')}
                        className="h-16 rounded-2xl bg-neutral-800 text-white text-2xl font-medium hover:bg-neutral-700 active:bg-neutral-600 active:scale-95 transition-all outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                        0
                    </button>
                    <button
                        onClick={handleDelete}
                        className="h-16 rounded-2xl bg-neutral-800/50 text-black flex items-center justify-center hover:bg-neutral-700 hover:text-white active:scale-95 transition-all"
                    >
                        <LucideDelete size={28} />
                    </button>
                </div>

                {/* Login Button */}
                <button
                    onClick={handleLogin}
                    disabled={pin.length === 0 || loading}
                    className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center transition-all ${pin.length > 0 && !loading
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 active:scale-95'
                        : 'bg-neutral-800 text-black cursor-not-allowed'
                        }`}
                >
                    {loading ? <LucideLoader2 className="animate-spin" size={24} /> : (
                        <>
                            Login
                            <LucideChevronRight className="ml-2" size={20} />
                        </>
                    )}
                </button>

            </div>
        </div>
    );
}
