'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { Plus as LucidePlus, Image as LucideImage, ToggleLeft as LucideToggleLeft, ToggleRight as LucideToggleRight, HandHelping as LucideHandHelping, Edit2 as LucideEdit2, Trash2 as LucideTrash2, X as LucideX, Camera as LucideCamera } from 'lucide-react';
import { motion } from 'framer-motion';
import { HomepageBuilderService, HomepageService } from '@/app/services/homepage-builder.service';
import { UserService } from '@/app/services/users';
import { MenuService } from '@/app/services/menu';
import { compressImage, validateImageFile } from '@/app/lib/image-compress';
import ConfirmationModal from '@/app/components/ui/ConfirmationModal';
import { getCached, setCache } from '@/app/lib/data-cache';

const colorPresets = [
    { name: 'Orange', color: '#f97316', gradient: 'from-orange-400/20 to-orange-600/20', border: 'border-orange-200/50', text: 'text-orange-900' },
    { name: 'Violet', color: '#8b5cf6', gradient: 'from-violet-400/20 to-violet-600/20', border: 'border-violet-200/50', text: 'text-violet-900' },
    { name: 'Blue', color: '#3b82f6', gradient: 'from-blue-400/20 to-blue-600/20', border: 'border-blue-200/50', text: 'text-blue-900' },
    { name: 'Emerald', color: '#10b981', gradient: 'from-emerald-400/20 to-emerald-600/20', border: 'border-emerald-200/50', text: 'text-emerald-900' },
    { name: 'Sky', color: '#0ea5e9', gradient: 'from-sky-400/20 to-sky-600/20', border: 'border-sky-200/50', text: 'text-sky-900' },
    { name: 'Yellow', color: '#eab308', gradient: 'from-yellow-400/20 to-yellow-600/20', border: 'border-yellow-200/50', text: 'text-yellow-900' },
    { name: 'Red', color: '#ef4444', gradient: 'from-red-400/20 to-red-600/20', border: 'border-red-200/50', text: 'text-red-900' },
    { name: 'Teal', color: '#14b8a6', gradient: 'from-teal-400/20 to-teal-600/20', border: 'border-teal-200/50', text: 'text-teal-900' },
    { name: 'Stone', color: '#78716c', gradient: 'from-stone-400/20 to-stone-600/20', border: 'border-stone-200/50', text: 'text-black' },
    { name: 'Zinc', color: '#71717a', gradient: 'from-zinc-400/20 to-zinc-600/20', border: 'border-zinc-200/50', text: 'text-black' },
];

function getColorForGradient(gradient?: string): string {
    if (!gradient) return '#3b82f6';
    const preset = colorPresets.find(p => p.gradient === gradient);
    return preset?.color || '#3b82f6';
}

export default function AdminServicesPage() {
    const cachedServices = getCached<HomepageService[]>('services-cache');
    const [services, setServices] = useState<HomepageService[]>(cachedServices || []);
    const [loading, setLoading] = useState(!cachedServices);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [restaurantId, setRestaurantId] = useState<string | null>(null);

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageUploading, setImageUploading] = useState(false);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        service_title: '',
        service_subtitle: '',
        service_icon: '',
        countable: false,
        gradient: 'from-orange-400/20 to-orange-600/20',
        border_class: 'border-orange-200/50',
        text_class: 'text-orange-900',
    });

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        isAlert: boolean;
        isSuperDestructive: boolean;
        confirmText: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', isAlert: false, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });

    const loadData = async (resId?: string) => {
        const targetResId = resId || restaurantId;
        if (!targetResId) return;
        
        try {
            const data = await HomepageBuilderService.getServices(targetResId);
            setServices(data);
            setCache('services-cache', data);
        } catch (err) {
            console.error('Failed to load services:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            const profile = await UserService.getCurrentProfile();
            if (profile?.restaurant_id) {
                setRestaurantId(profile.restaurant_id);
                // Initialize defaults if none exist
                await HomepageBuilderService.initializeDefaultServices(profile.restaurant_id);
                loadData(profile.restaurant_id);
            } else {
                setLoading(false);
            }
        };
        init();
    }, []);

    const resetForm = () => {
        setForm({
            service_title: '',
            service_subtitle: '',
            service_icon: '',
            countable: false,
            gradient: 'from-orange-400/20 to-orange-600/20',
            border_class: 'border-orange-200/50',
            text_class: 'text-orange-900',
        });
        setImageFile(null);
        setImagePreview(null);
        setIsEditing(false);
        setEditingId(null);
    };

    const generateServiceKey = (title: string): string => {
        return title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '_requested';
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            let imageUrl: string | undefined;
            if (imageFile) {
                setImageUploading(true);
                try {
                    const compressed = await compressImage(imageFile);
                    imageUrl = await MenuService.uploadMenuImage(compressed.file);
                } catch (err) {
                    console.error('Image upload failed:', err);
                } finally {
                    setImageUploading(false);
                }
            }

            const payload: HomepageService = {
                restaurant_id: restaurantId!,
                service_title: form.service_title,
                service_subtitle: form.service_subtitle,
                service_icon: form.service_icon,
                countable: form.countable,
                gradient: form.gradient,
                border_class: form.border_class,
                text_class: form.text_class,
                service_key: isEditing ? services.find(s => s.id === editingId)?.service_key || generateServiceKey(form.service_title) : generateServiceKey(form.service_title),
            };

            if (editingId) payload.id = editingId;
            payload.service_image = imageUrl || imagePreview || '';

            await HomepageBuilderService.saveService(payload);

            setShowModal(false);
            resetForm();
            loadData();
        } catch (err: any) {
            console.error('Error saving service:', err);
            setConfirmModal({ isOpen: true, title: 'Error', message: err.message || 'Failed to save service', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
        }
    };

    const handleEdit = (service: HomepageService) => {
        setForm({
            service_title: service.service_title,
            service_subtitle: service.service_subtitle || '',
            service_icon: service.service_icon || '',
            countable: !!service.countable,
            gradient: service.gradient || 'from-orange-400/20 to-orange-600/20',
            border_class: service.border_class || 'border-orange-200/50',
            text_class: service.text_class || 'text-orange-900',
        });
        setImagePreview(service.service_image || null);
        setImageFile(null);
        setEditingId(service.id || null);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleDelete = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Service',
            message: 'Are you sure you want to delete this service? This cannot be undone.',
            isAlert: false,
            isSuperDestructive: true,
            confirmText: 'Delete',
            onConfirm: async () => {
                try {
                    await HomepageBuilderService.deleteService(id);
                    loadData();
                } catch (err) {
                    console.error('Error deleting:', err);
                }
            }
        });
    };

    const toggleActive = async (service: HomepageService) => {
        try {
            await HomepageBuilderService.saveService({ ...service, active: !service.active });
            loadData();
        } catch (err) {
            console.error('Error toggling:', err);
        }
    };

    const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const validationError = validateImageFile(file);
        if (validationError) {
            setConfirmModal({ isOpen: true, title: 'Invalid Image', message: validationError, isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
            return;
        }
        try {
            const result = await compressImage(file);
            setImageFile(result.file);
            setImagePreview(URL.createObjectURL(result.file));
        } catch {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    const selectedColor = getColorForGradient(form.gradient);

    return (
        <div className="h-full flex flex-col">
            <div className="p-8 flex flex-col h-screen space-y-7 overflow-hidden">
                <div className="flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-2xl font-black text-black tracking-tight">Service Options</h2>
                        <p className="text-sm font-medium text-black mt-1">Configure quick service request buttons for customers (e.g. Call Waiter, Water, Bill).</p>
                    </div>
                    <button
                        onClick={() => { setIsEditing(false); resetForm(); setShowModal(true); }}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 gap-2"
                    >
                        <LucidePlus size={16} />
                        Add Service Option
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 pb-8">
                    {services.length === 0 ? (
                        <div className="text-center py-20 text-black">
                            <LucideHandHelping size={48} className="mx-auto mb-4 opacity-30" />
                            <p className="text-lg font-medium">No service options yet</p>
                            <p className="text-sm">Click &quot;Add Service&quot; to create your first one.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {services.map((service) => {
                                const cardColor = getColorForGradient(service.gradient);
                                return (
                                    <motion.div
                                        key={service.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className={`relative group bg-white rounded-2xl border ${service.active ? 'border-neutral-200' : 'border-dashed border-neutral-300 opacity-60'} shadow-sm hover:shadow-md transition-all overflow-hidden`}
                                    >
                                        <div
                                            className="relative h-32 flex items-center justify-center"
                                            style={{ background: `linear-gradient(135deg, ${cardColor}20, ${cardColor}30)` }}
                                        >
                                            {service.service_image ? (
                                                <img 
                                                    src={service.service_image} 
                                                    alt={service.service_title} 
                                                    className="h-full w-full object-contain p-4" 
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = 'none';
                                                        const fallback = (e.target as HTMLImageElement).nextElementSibling;
                                                        if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                                    }}
                                                />
                                            ) : null}
                                            <div 
                                                className="flex items-center justify-center"
                                                style={{ display: service.service_image ? 'none' : 'flex' }}
                                            >
                                                {service.service_icon && (LucideIcons as any)[service.service_icon] ? (
                                                    React.createElement((LucideIcons as any)[service.service_icon], {
                                                        size: 40,
                                                        style: { color: cardColor }
                                                    })
                                                ) : (
                                                    <LucideImage size={40} className="text-black" />
                                                )}
                                            </div>
                                            {!service.active && (
                                                <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">HIDDEN</div>
                                            )}
                                        </div>

                                        <div className="p-4">
                                            <h3 className="font-bold text-sm" style={{ color: cardColor }}>{service.service_title}</h3>
                                            <p className="text-xs text-black uppercase tracking-wider mt-0.5">{service.service_subtitle}</p>
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${service.countable ? 'bg-blue-50 text-blue-600' : 'bg-neutral-100 text-black'}`}>
                                                    {service.countable ? 'Countable' : 'Single'}
                                                </span>
                                                <span
                                                    className="size-3 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: cardColor }}
                                                    title={colorPresets.find(p => p.gradient === service.gradient)?.name || 'Custom'}
                                                />
                                            </div>
                                        </div>

                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => toggleActive(service)}
                                                className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white transition-colors"
                                                title={service.active ? 'Hide from customers' : 'Show to customers'}
                                            >
                                                {service.active ? <LucideToggleRight size={14} className="text-green-600" /> : <LucideToggleLeft size={14} className="text-black" />}
                                            </button>
                                            <button
                                                onClick={() => handleEdit(service)}
                                                className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white transition-colors"
                                                title="Edit"
                                            >
                                                <LucideEdit2 size={14} className="text-blue-600" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(service.id!)}
                                                className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg shadow-sm hover:bg-white transition-colors"
                                                title="Delete"
                                            >
                                                <LucideTrash2 size={14} className="text-red-500" />
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {showModal && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
                            <div className="p-6 border-b border-neutral-100 flex justify-between items-center shrink-0">
                                <h2 className="text-xl font-bold text-black">{isEditing ? 'Edit Service' : 'New Service'}</h2>
                                <button onClick={() => { setShowModal(false); resetForm(); }} className="text-black hover:text-black transition-colors">
                                    <LucideX size={24} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                                <div>
                                    <label className="block text-sm font-medium text-black mb-2">Service Image</label>
                                    <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleImageSelect} />
                                    <div className="flex items-center gap-4">
                                        <div
                                            onClick={() => imageInputRef.current?.click()}
                                            className="relative size-20 rounded-xl border-2 border-dashed border-neutral-300 hover:border-blue-400 flex items-center justify-center cursor-pointer transition-all overflow-hidden group bg-neutral-50 hover:bg-blue-50"
                                        >
                                            {imagePreview ? (
                                                <>
                                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <LucideCamera size={18} className="text-white" />
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center gap-1 text-black group-hover:text-blue-500 transition-colors">
                                                    <LucideImage size={20} />
                                                    <span className="text-[9px] font-medium">Add Photo</span>
                                                </div>
                                            )}
                                        </div>
                                        {imagePreview && (
                                            <div className="flex flex-col gap-1">
                                                <button type="button" onClick={() => imageInputRef.current?.click()} className="text-xs font-medium text-blue-600 hover:text-blue-700">Change</button>
                                                <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); }} className="text-xs font-medium text-red-500 hover:text-red-600">Remove</button>
                                            </div>
                                        )}
                                    </div>
                                    {imageUploading && <p className="text-xs text-blue-500 mt-1 animate-pulse">Uploading...</p>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Service Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.service_title}
                                        onChange={(e) => setForm({ ...form, service_title: e.target.value })}
                                        className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                        placeholder="e.g., Call Waiter"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Sub Label</label>
                                    <input
                                        type="text"
                                        value={form.service_subtitle}
                                        onChange={(e) => setForm({ ...form, service_subtitle: e.target.value })}
                                        className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                        placeholder="e.g., General Help"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-black mb-1 flex items-center gap-2">
                                        Icon Name (Lucide)
                                        <a href="https://lucide.dev/icons" target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline">Browse</a>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={form.service_icon}
                                            onChange={(e) => setForm({ ...form, service_icon: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                            placeholder="e.g. HandPlatter, Droplets"
                                        />
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-black">
                                            {form.service_icon && (LucideIcons as any)[form.service_icon] ? (
                                                React.createElement((LucideIcons as any)[form.service_icon], { size: 18 })
                                            ) : (
                                                <LucidePlus size={18} />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-black mb-2">Color Theme</label>
                                    <div className="flex flex-wrap gap-2.5">
                                        {colorPresets.map((preset) => {
                                            const isSelected = form.gradient === preset.gradient;
                                            return (
                                                <button
                                                    key={preset.name}
                                                    type="button"
                                                    onClick={() => setForm({ ...form, gradient: preset.gradient, border_class: preset.border, text_class: preset.text })}
                                                    className={`size-9 rounded-full transition-all duration-200 ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 scale-110' : 'hover:scale-110'}`}
                                                    style={{ backgroundColor: preset.color }}
                                                    title={preset.name}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="mt-3 p-3 rounded-lg flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${selectedColor}20, ${selectedColor}30)` }}>
                                        <div className="size-8 rounded-lg" style={{ backgroundColor: selectedColor + '30' }} />
                                        <span className="text-sm font-semibold" style={{ color: selectedColor }}>{form.service_title || 'Preview'}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                                    <div>
                                        <p className="text-sm font-medium text-black">Countable</p>
                                        <p className="text-[10px] text-black">Customer can select quantity (1-10)</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setForm(prev => ({ ...prev, countable: !prev.countable }))}
                                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 ${form.countable ? 'bg-blue-600' : 'bg-neutral-300'}`}
                                    >
                                        <span className={`inline-block size-5 rounded-full bg-white transition-transform duration-200 shadow-sm ${form.countable ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 text-sm font-medium text-black bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={imageUploading} className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 disabled:opacity-50">
                                        {imageUploading ? 'Uploading...' : (isEditing ? 'Save Changes' : 'Create Service')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                <ConfirmationModal
                    isOpen={confirmModal.isOpen}
                    onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    isAlert={confirmModal.isAlert}
                    isSuperDestructive={confirmModal.isSuperDestructive}
                    confirmText={confirmModal.confirmText}
                />
            </div>
        </div>
    );
}
