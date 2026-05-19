'use client';

import { useState, useEffect } from 'react';
import { Calendar as LucideCalendar, Plus as LucidePlus, Trash2 as LucideTrash2, TrendingUp as LucideTrendingUp } from 'lucide-react';
import { FestivalService, Festival } from '@/app/services/festival.service';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';

export default function FestivalCalendarPage() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const [festivals, setFestivals] = useState<Festival[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    // Form State
    const [newFestival, setNewFestival] = useState({
        name: '',
        type: 'Holiday',
        start_date: '',
        end_date: '',
        impact_level: 15
    });

    useEffect(() => {
        if (!restaurantLoading && restaurantId) {
            loadFestivals();
        }
    }, [restaurantId, restaurantLoading]);

    const loadFestivals = async () => {
        if (!restaurantId) return;
        setLoading(true);
        try {
            const data = await FestivalService.fetchFestivals(restaurantId);
            setFestivals(data);
        } catch (error) {
            console.error('Failed to load festivals', error);
        } finally {
            setLoading(false);
        }
    }

    const handleAddFestival = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) return;
        try {
            await FestivalService.createFestival({
                name: newFestival.name,
                type: newFestival.type,
                start_date: newFestival.start_date,
                end_date: newFestival.end_date,
                impact_level: Number(newFestival.impact_level)
            }, restaurantId);
            setShowAddModal(false);
            setNewFestival({ name: '', type: 'Holiday', start_date: '', end_date: '', impact_level: 15 });
            loadFestivals();
        } catch (error) {
            console.error(error);
            alert('Failed to add festival');
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this festival?')) return;
        if (!restaurantId) return;
        try {
            await FestivalService.deleteFestival(id, restaurantId);
            setFestivals(festivals.filter(f => f.id !== id));
        } catch (error) {
            console.error(error);
            alert('Failed to delete');
        }
    }

    if (loading) return <div>Loading...</div>;

    const upcomingFestivals = festivals.filter(f => new Date(f.end_date) >= new Date());
    const pastFestivals = festivals.filter(f => new Date(f.end_date) < new Date());

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center bg-white p-6 border border-neutral-200 shadow-sm rounded-2xl">
                <div>
                    <h2 className="text-xl font-bold text-black flex items-center gap-2">
                        <LucideCalendar className="text-violet-600" />
                        Smart Festival Intelligence
                    </h2>
                    <p className="text-black text-sm mt-1">Configure local festivals to help the system accurately predict order spikes and adjust inventory minimums proactively.</p>
                </div>
                <button onClick={() => setShowAddModal(true)} className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-xl flex items-center gap-2 transition-colors">
                    <LucidePlus size={18} /> Add Event
                </button>
            </div>

            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 bg-neutral-50/80 border-b border-neutral-200">
                    <h3 className="font-semibold text-black">Scheduled Events</h3>
                </div>
                {upcomingFestivals.length > 0 ? (
                    <div className="divide-y divide-neutral-100">
                        {upcomingFestivals.map(fest => (
                            <div key={fest.id} className="p-5 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                                <div className="flex items-start gap-4">
                                    <div className="bg-violet-100 text-violet-700 w-12 h-12 rounded-xl flex flex-col items-center justify-center font-bold">
                                        <span className="text-xs uppercase opacity-70 leading-none mb-1">{new Date(fest.start_date).toLocaleString('default', { month: 'short' })}</span>
                                        <span className="text-lg leading-none">{new Date(fest.start_date).getDate()}</span>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-black text-lg">{fest.name}</h4>
                                        <p className="text-sm text-black">
                                            {fest.type} • Ends {new Date(fest.end_date).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 text-sm">
                                    <div className="text-right">
                                        <p className="text-black font-medium text-xs mb-1">Expected Demand Spike</p>
                                        <p className="font-bold text-emerald-600 flex items-center justify-end gap-1"><LucideTrendingUp size={14} /> +{fest.impact_level}%</p>
                                    </div>
                                    <button onClick={() => handleDelete(fest.id)} className="text-black hover:text-rose-600 p-2 ml-4 rounded-lg bg-white border border-transparent hover:border-rose-100 hover:bg-rose-50 transition-all">
                                        <LucideTrash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="p-12 text-center text-black">
                        <p>No upcoming events configured.</p>
                    </div>
                )}
            </div>

            {pastFestivals.length > 0 && (
                <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden opacity-70">
                    <div className="p-4 bg-neutral-50/80 border-b border-neutral-200">
                        <h3 className="font-semibold text-black">Past Events</h3>
                    </div>
                    <div className="divide-y divide-neutral-100">
                        {pastFestivals.map(fest => (
                            <div key={fest.id} className="px-5 py-3 flex items-center justify-between opacity-80 mix-blend-luminosity">
                                <span className="font-medium">{fest.name}</span>
                                <span className="text-sm text-black">{new Date(fest.start_date).toLocaleDateString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-violet-50 text-violet-900">
                            <h2 className="text-lg font-bold flex items-center gap-2"><LucideCalendar size={18} /> Add Event</h2>
                            <button onClick={() => setShowAddModal(false)} className="opacity-50 hover:opacity-100">&times;</button>
                        </div>
                        <form onSubmit={handleAddFestival} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-black mb-1">Event Name</label>
                                <input required type="text" value={newFestival.name} onChange={e => setNewFestival({ ...newFestival, name: e.target.value })} className="w-full border border-neutral-200 rounded-lg p-2.5 outline-none focus:border-violet-500" placeholder="e.g. Diwali, Valentine's Day" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Start Date</label>
                                    <input required type="date" value={newFestival.start_date} onChange={e => setNewFestival({ ...newFestival, start_date: e.target.value })} className="w-full border border-neutral-200 rounded-lg p-2.5 outline-none focus:border-violet-500 text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">End Date</label>
                                    <input required type="date" value={newFestival.end_date} onChange={e => setNewFestival({ ...newFestival, end_date: e.target.value })} className="w-full border border-neutral-200 rounded-lg p-2.5 outline-none focus:border-violet-500 text-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-black mb-1">Expected Demand Impact (%)</label>
                                <div className="text-xs text-black mb-2">How much volume increase do you expect? (System will pre-order X% more inventory).</div>
                                <div className="flex items-center gap-3">
                                    <input required type="range" min="0" max="100" value={newFestival.impact_level} onChange={e => setNewFestival({ ...newFestival, impact_level: parseInt(e.target.value) })} className="flex-1 accent-violet-600" />
                                    <span className="font-bold text-violet-700 w-12 text-right">+{newFestival.impact_level}%</span>
                                </div>
                            </div>
                            <div className="pt-4 flex justify-end gap-3 mt-6">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 text-sm font-semibold text-black hover:bg-neutral-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-5 py-2.5 text-sm font-semibold bg-violet-600 text-white rounded-lg hover:bg-violet-700">Save Event</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
