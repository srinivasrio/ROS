'use client';

import { useEffect, useState } from 'react';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { StaffTaskService, StaffTask } from '@/app/services/staff_tasks';
import { OrderService } from '@/app/services/orders';
import { Check, Clock, AlertTriangle, User, LogOut, Coffee, Briefcase } from 'lucide-react';
import { formatTimeElapsed } from '@/app/lib/utils';
import { supabase } from '@/lib/supabase';

export default function UniversalStaffDashboard() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const [staff, setStaff] = useState<any>(null);
    const [tasks, setTasks] = useState<StaffTask[]>([]);
    const [loading, setLoading] = useState(true);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !restaurantId) return;

            try {
                // Fetch staff record
                const staffRecord = await OrderService.getWaiterRecord(restaurantId, user.id);
                setStaff(staffRecord);

                // Fetch initial tasks
                const initialTasks = await StaffTaskService.fetchMyTasks(staffRecord.id, restaurantId);
                setTasks(initialTasks);

                // Subscribe to tasks
                const subscription = StaffTaskService.subscribeToMyTasks(staffRecord.id, restaurantId, (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setTasks(prev => [payload.new as StaffTask, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        setTasks(prev => prev.map(t => t.id === payload.new.id ? payload.new as StaffTask : t)
                            .filter(t => t.status !== 'completed' && t.status !== 'cancelled'));
                    }
                });

                return () => subscription.unsubscribe();
            } catch (err) {
                console.error('Failed to init dashboard:', err);
            } finally {
                setLoading(false);
            }
        };

        if (!restaurantLoading) init();
    }, [restaurantId, restaurantLoading]);

    const handleComplete = async (taskId: string) => {
        try {
            await StaffTaskService.updateTaskStatus(taskId, 'completed');
        } catch (err) {
            console.error('Failed to complete task:', err);
        }
    };

    const handleUpdateStatus = async (status: string) => {
        if (!staff) return;
        try {
            await OrderService.updateWaiterStatus(staff.id, status as any);
            setStaff({ ...staff, availability_status: status });
        } catch (err) {
            console.error('Failed to update status:', err);
        }
    };

    if (loading) return <div className="p-8 text-center text-black">Loading Dashboard...</div>;
    if (!staff) return <div className="p-8 text-center text-red-500">Staff record not found. Please contact admin.</div>;

    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col">
            {/* Header */}
            <header className="bg-white border-b border-neutral-200 px-6 py-4 flex justify-between items-center sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-neutral-900 rounded-full flex items-center justify-center text-white font-bold">
                        {staff.name[0]}
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-black tracking-tight">{staff.name}</h1>
                        <p className="text-xs font-bold text-black uppercase tracking-widest">{staff.role}</p>
                    </div>
                </div>

                {/* Status Toggles */}
                <div className="flex items-center bg-neutral-100 p-1 rounded-xl border border-neutral-200">
                    <StatusButton 
                        active={staff.availability_status === 'available'} 
                        onClick={() => handleUpdateStatus('available')}
                        icon={<Check size={16} />}
                        label="Active"
                        color="green"
                    />
                    <StatusButton 
                        active={staff.availability_status === 'busy'} 
                        onClick={() => handleUpdateStatus('busy')}
                        icon={<Briefcase size={16} />}
                        label="Busy"
                        color="orange"
                    />
                    <StatusButton 
                        active={staff.availability_status === 'break'} 
                        onClick={() => handleUpdateStatus('break')}
                        icon={<Coffee size={16} />}
                        label="Break"
                        color="neutral"
                    />
                </div>
            </header>

            {/* Main Content */}
            <main className="p-6 flex-1 max-w-4xl mx-auto w-full">
                <div className="mb-8">
                    <h2 className="text-2xl font-black text-black tracking-tight flex items-center gap-2">
                        My Tasks
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-sm font-bold">{tasks.length}</span>
                    </h2>
                    <p className="text-sm text-black mt-1">Automatically assigned based on your availability.</p>
                </div>

                <div className="space-y-4">
                    {tasks.length === 0 ? (
                        <div className="bg-white border-2 border-dashed border-neutral-200 rounded-2xl p-12 text-center">
                            <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Check className="text-black" size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-black">All Clear!</h3>
                            <p className="text-black">No active tasks assigned to you right now.</p>
                        </div>
                    ) : (
                        tasks.map(task => (
                            <TaskCard 
                                key={task.id} 
                                task={task} 
                                onComplete={() => handleComplete(task.id)} 
                            />
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}

function StatusButton({ active, onClick, icon, label, color }: any) {
    const colors: any = {
        green: active ? 'bg-green-500 text-white shadow-lg' : 'text-black hover:bg-white',
        orange: active ? 'bg-orange-500 text-white shadow-lg' : 'text-black hover:bg-white',
        neutral: active ? 'bg-neutral-800 text-white shadow-lg' : 'text-black hover:bg-white'
    };

    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${colors[color]}`}
        >
            {icon}
            {label}
        </button>
    );
}

function TaskCard({ task, onComplete }: { task: StaffTask, onComplete: () => void }) {
    const isUrgent = task.priority === 'urgent' || task.priority === 'high';

    return (
        <div className={`bg-white rounded-2xl border ${isUrgent ? 'border-red-200' : 'border-neutral-200'} shadow-sm p-6 hover:shadow-md transition-all`}>
            <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full ${
                            task.task_type === 'order' ? 'bg-blue-100 text-blue-700' : 
                            task.task_type === 'cleaning' ? 'bg-purple-100 text-purple-700' :
                            'bg-neutral-100 text-black'
                        }`}>
                            {task.task_type}
                        </span>
                        {isUrgent && (
                            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                <AlertTriangle size={10} /> Urgent
                            </span>
                        )}
                    </div>
                    <h3 className="text-xl font-black text-black tracking-tight mb-1">
                        Task #{task.task_ref_id.slice(-4).toUpperCase()}
                    </h3>
                    <p className="text-sm text-black flex items-center gap-2">
                        <Clock size={14} /> Assigned {formatTimeElapsed(task.created_at)}
                    </p>
                    {task.metadata?.details && (
                        <p className="mt-3 text-sm font-medium text-black bg-neutral-50 p-3 rounded-lg border border-neutral-100">
                            {task.metadata.details}
                        </p>
                    )}
                </div>

                <button
                    onClick={onComplete}
                    className="bg-neutral-900 text-white p-4 rounded-2xl hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-200 flex flex-col items-center justify-center gap-1 min-w-[100px]"
                >
                    <Check size={24} strokeWidth={3} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Complete</span>
                </button>
            </div>
        </div>
    );
}
