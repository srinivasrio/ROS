'use client';

import React, { useState, useEffect } from 'react';
import {
    Headset,
    Search,
    Clock,
    CheckCircle2,
    AlertCircle,
    User,
    Building2,
    GitBranch,
    Send,
    MessageSquare,
    X,
    Filter,
    Shield,
    Sparkles
} from 'lucide-react';
import { toast } from 'sonner';

export default function SupportCenterPage() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusTab, setStatusTab] = useState<'ALL' | 'OPEN' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED'>('ALL');
    const [search, setSearch] = useState('');

    // Detail Modal
    const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
    const [newNote, setNewNote] = useState('');
    const [noteLoading, setNoteLoading] = useState(false);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/support');
            if (res.ok) {
                const data = await res.json();
                setTickets(data.tickets || []);
            }
        } catch (err) {
            console.error('Failed to load tickets:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, []);

    const handleUpdateStatus = async (ticketId: string, newStatus: string) => {
        try {
            const res = await fetch('/api/admin/support', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticketId, status: newStatus }),
            });
            if (res.ok) {
                toast.success(`Ticket marked as ${newStatus}`);
                fetchTickets();
                if (selectedTicket) {
                    setSelectedTicket({ ...selectedTicket, status: newStatus });
                }
            }
        } catch (err: any) {
            toast.error(err.message || 'Update failed');
        }
    };

    const handleAddNote = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newNote.trim() || !selectedTicket) return;
        setNoteLoading(true);
        try {
            const res = await fetch('/api/admin/support', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ticketId: selectedTicket.ticket_id,
                    internalNote: newNote.trim(),
                }),
            });
            if (res.ok) {
                toast.success('Internal note appended to audit record');
                const updatedNotes = Array.isArray(selectedTicket.internal_notes) ? selectedTicket.internal_notes : [];
                setSelectedTicket({
                    ...selectedTicket,
                    internal_notes: [
                        ...updatedNotes,
                        { note: newNote.trim(), actor: 'Founder', timestamp: new Date().toISOString() },
                    ],
                });
                setNewNote('');
                fetchTickets();
            }
        } catch (err: any) {
            toast.error(err.message || 'Note failed');
        } finally {
            setNoteLoading(false);
        }
    };

    const filteredTickets = tickets.filter((t) => {
        const matchesSearch =
            !search ||
            t.ticket_id?.toLowerCase().includes(search.toLowerCase()) ||
            t.subject?.toLowerCase().includes(search.toLowerCase()) ||
            t.restaurant_name?.toLowerCase().includes(search.toLowerCase());

        const matchesStatus =
            statusTab === 'ALL' || t.status === statusTab;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-[#172033]">
                        Founder Support & Incident Desk
                    </h1>
                    <p className="text-xs text-[#667085] mt-1 font-medium">
                        Direct platform escalation queue for restaurant owners, POS operational tickets, and technical triage.
                    </p>
                </div>
            </div>

            {/* Status Tabs */}
            <div className="flex items-center gap-2 border-b border-[#E4E7EC] pb-2 overflow-x-auto">
                {[
                    { id: 'ALL', label: 'All Tickets', count: tickets.length },
                    { id: 'OPEN', label: 'Open Incidents', count: tickets.filter((t) => t.status === 'OPEN').length },
                    { id: 'IN_PROGRESS', label: 'In Progress', count: tickets.filter((t) => t.status === 'IN_PROGRESS').length },
                    { id: 'WAITING', label: 'Waiting on Restaurant', count: tickets.filter((t) => t.status === 'WAITING').length },
                    { id: 'RESOLVED', label: 'Resolved', count: tickets.filter((t) => t.status === 'RESOLVED').length },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setStatusTab(tab.id as any)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                            statusTab === tab.id
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'text-[#667085] hover:text-[#172033] hover:bg-white'
                        }`}
                    >
                        <span>{tab.label}</span>
                        <span
                            className={`px-1.5 py-0.2 rounded-md text-[10px] ${
                                statusTab === tab.id ? 'bg-indigo-200/60 text-indigo-900' : 'bg-neutral-100 text-neutral-600'
                            }`}
                        >
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-2xl border border-[#E4E7EC] shadow-2xs max-w-md">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={15} />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search tickets by ID, issue description, or restaurant..."
                        className="w-full pl-10 pr-4 py-2 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl text-xs text-[#172033] placeholder-neutral-400 focus:outline-none focus:border-indigo-600 focus:bg-white font-medium"
                    />
                </div>
            </div>

            {/* Tickets Table */}
            <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-[#F5F7FC] border-b border-[#E4E7EC] text-[11px] font-black uppercase tracking-wider text-[#667085]">
                                <th className="p-4">Ticket ID</th>
                                <th className="p-4">Restaurant & Branch</th>
                                <th className="p-4">Subject & Description</th>
                                <th className="p-4">Priority</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Created</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E4E7EC]">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                                        <div className="inline-block h-6 w-6 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin mb-2" />
                                        <p className="font-semibold text-xs">Loading support tickets...</p>
                                    </td>
                                </tr>
                            ) : filteredTickets.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-neutral-400">
                                        <Headset size={32} className="mx-auto mb-2 opacity-30" />
                                        <p className="font-bold text-xs text-[#172033]">All clear! No tickets in this view.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredTickets.map((t) => (
                                    <tr key={t.id} className="hover:bg-[#F5F7FC]/70 transition-colors">
                                        {/* Ticket ID */}
                                        <td className="p-4 font-mono font-bold text-indigo-700">
                                            {t.ticket_id}
                                        </td>

                                        {/* Restaurant */}
                                        <td className="p-4">
                                            <p className="font-bold text-[#172033]">{t.restaurant_name}</p>
                                            <p className="text-[11px] text-[#667085]">{t.branch_name || 'All Outlets'}</p>
                                        </td>

                                        {/* Subject */}
                                        <td className="p-4 max-w-sm">
                                            <p className="font-bold text-[#172033] truncate">{t.subject}</p>
                                            <p className="text-[11px] text-[#667085] truncate mt-0.5">{t.description}</p>
                                        </td>

                                        {/* Priority */}
                                        <td className="p-4">
                                            <span
                                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                    t.priority === 'CRITICAL' || t.priority === 'HIGH'
                                                        ? 'bg-rose-100 text-rose-800'
                                                        : t.priority === 'MEDIUM'
                                                        ? 'bg-amber-100 text-amber-800'
                                                        : 'bg-neutral-100 text-neutral-700'
                                                }`}
                                            >
                                                {t.priority}
                                            </span>
                                        </td>

                                        {/* Status */}
                                        <td className="p-4">
                                            <span
                                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                    t.status === 'OPEN'
                                                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                                        : t.status === 'IN_PROGRESS'
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                }`}
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                                {t.status}
                                            </span>
                                        </td>

                                        {/* Date */}
                                        <td className="p-4 text-[#667085] text-[11px]">
                                            {new Date(t.created_at).toLocaleDateString('en-IN', {
                                                day: 'numeric',
                                                month: 'short',
                                            })}
                                        </td>

                                        {/* Actions */}
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => setSelectedTicket(t)}
                                                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer border border-indigo-100"
                                            >
                                                Inspect & Reply
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* TICKET DETAIL & INTERNAL NOTES MODAL */}
            {selectedTicket && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full border border-[#E4E7EC] shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between pb-3 border-b border-[#E4E7EC]">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                                        {selectedTicket.ticket_id}
                                    </span>
                                    <h3 className="text-base font-extrabold text-[#172033] truncate">
                                        {selectedTicket.subject}
                                    </h3>
                                </div>
                                <p className="text-xs text-[#667085] mt-1">
                                    {selectedTicket.restaurant_name} • {selectedTicket.branch_name || 'Main Branch'}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedTicket(null)}
                                className="p-1 text-neutral-400 hover:text-neutral-600 cursor-pointer"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar text-xs">
                            {/* Context Card */}
                            <div className="p-4 rounded-2xl bg-[#F5F7FC] border border-[#E4E7EC] space-y-2">
                                <span className="font-bold text-[#667085] uppercase text-[10px]">Issue Description:</span>
                                <p className="text-[#172033] leading-relaxed font-medium">
                                    {selectedTicket.description}
                                </p>
                                <div className="pt-2 flex items-center gap-4 text-[11px] text-[#667085]">
                                    <span>Caller: <strong>{selectedTicket.user_email}</strong></span>
                                    <span>Priority: <strong>{selectedTicket.priority}</strong></span>
                                </div>
                            </div>

                            {/* Status Change Bar */}
                            <div className="flex items-center justify-between p-3 rounded-2xl bg-white border border-[#E4E7EC]">
                                <span className="font-bold text-[#172033]">Current Status:</span>
                                <div className="flex items-center gap-2">
                                    {['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED'].map((st) => (
                                        <button
                                            key={st}
                                            onClick={() => handleUpdateStatus(selectedTicket.ticket_id, st)}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                                                selectedTicket.status === st
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                                            }`}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Internal Notes History */}
                            <div className="space-y-2">
                                <span className="font-bold text-[#667085] uppercase text-[10px]">
                                    Founder Notes & Incident History:
                                </span>
                                {Array.isArray(selectedTicket.internal_notes) && selectedTicket.internal_notes.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedTicket.internal_notes.map((note: any, i: number) => (
                                            <div key={i} className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/60 text-xs">
                                                <p className="text-amber-950 font-medium">{note.note}</p>
                                                <p className="text-[10px] text-amber-700 mt-1 font-bold">
                                                    By {note.actor} • {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-neutral-400 italic text-[11px]">No internal notes yet.</p>
                                )}
                            </div>
                        </div>

                        {/* Add Internal Note Input */}
                        <form onSubmit={handleAddNote} className="pt-2 border-t border-[#E4E7EC] flex gap-2">
                            <input
                                type="text"
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                                placeholder="Add confidential founder note or dispatch update..."
                                className="flex-1 text-xs p-2.5 bg-[#F5F7FC] border border-[#E4E7EC] rounded-xl focus:outline-none focus:border-indigo-600"
                            />
                            <button
                                type="submit"
                                disabled={noteLoading}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                                <Send size={13} />
                                <span>Note</span>
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
