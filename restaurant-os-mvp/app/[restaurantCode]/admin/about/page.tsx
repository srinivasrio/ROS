'use client';

import { useState, useEffect } from 'react';
import { RestaurantService, MetaInfo, RestaurantInfo } from '@/app/services/restaurant.service';
import { toast } from 'sonner';
import { Settings2 as LucideSettings2, Plus as LucidePlus, Trash2 as LucideTrash2, Check as LucideCheck, Info as LucideInfo, Edit2 as LucideEdit2, X as LucideX } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { getCached, setCache } from '@/app/lib/data-cache';

const formatLabel = (key: string) => key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export default function AdminAboutPage() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const cached = getCached<any>(`about-${restaurantId}`);
    const [metaInfo, setMetaInfo] = useState<MetaInfo | null>(cached?.metaInfo || null);
    const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(cached?.restaurantInfo || null);
    const [loading, setLoading] = useState(!cached);
    const [saving, setSaving] = useState(false);
    const [savingInfo, setSavingInfo] = useState(false);
    const [newCuisine, setNewCuisine] = useState('');

    // Custom Categories State
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryItem, setNewCategoryItem] = useState('');
    const [activeCategoryIndex, setActiveCategoryIndex] = useState<number | null>(null);

    // Inline Edit State
    const [editState, setEditState] = useState<{ id: string; val: string } | null>(null);

    const startEdit = (id: string, initialVal: string) => setEditState({ id, val: initialVal });
    const cancelEdit = () => setEditState(null);

    // Dynamic field adding state
    const [newFields, setNewFields] = useState<Record<string, string>>({
        facilities: '',
        services: '',
        payment_methods: '',
        policies: ''
    });

    useEffect(() => {
        const loadData = async () => {
            if (!restaurantId || restaurantLoading) return;
            try {
                const [metaData, infoData] = await Promise.all([
                    RestaurantService.getMetaInfo(restaurantId),
                    RestaurantService.getRestaurantInfo(restaurantId),
                ]);
                setMetaInfo(metaData);
                setRestaurantInfo(infoData);
                setCache(`about-${restaurantId}`, { metaInfo: metaData, restaurantInfo: infoData });
            } catch (error) {
                console.error("Failed to load restaurant data:", error);
                toast.error("Failed to load restaurant profile");
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [restaurantId, restaurantLoading]);

    const handleSaveInfo = async () => {
        if (!restaurantId || !restaurantInfo) return;
        setSavingInfo(true);
        try {
            await RestaurantService.updateRestaurantInfo(restaurantId, restaurantInfo);
            toast.success('Restaurant information saved!');
        } catch (error) {
            console.error('Failed to save restaurant info:', error);
            toast.error('Failed to save restaurant information');
        }
        setSavingInfo(false);
    };

    const handleSave = async (updatedMeta: MetaInfo) => {
        if (!restaurantId) return;
        setSaving(true);
        try {
            await RestaurantService.updateMetaInfo(restaurantId, updatedMeta);
            setMetaInfo(updatedMeta);
            toast.success("Profile updated strictly");
        } catch (error) {
            console.error("Failed to save:", error);
            toast.error("Failed to save profile");
        } finally {
            setSaving(false);
        }
    };

    const toggleNestedValue = (section: keyof MetaInfo, key: string) => {
        if (!metaInfo) return;
        const updated = {
            ...metaInfo,
            [section]: {
                ...(metaInfo[section] as any),
                [key]: !(metaInfo[section] as any)[key]
            }
        };
        handleSave(updated);
    };

    const addToggleField = (section: keyof MetaInfo) => {
        if (!metaInfo) return;
        const fieldName = newFields[section as string]?.trim();
        if (!fieldName) return;

        // Convert to snake_case for the object key
        const key = fieldName.toLowerCase().replace(/\s+/g, '_');

        // Don't add if already exists
        if (key in (metaInfo[section] as any)) return;

        const updated = {
            ...metaInfo,
            [section]: {
                ...(metaInfo[section] as any),
                [key]: true // default to active when adding a new field
            }
        };

        setNewFields(prev => ({ ...prev, [section]: '' }));
        handleSave(updated as MetaInfo);
    };

    const editToggleField = (section: keyof MetaInfo, oldKey: string, newName: string) => {
        if (!metaInfo || !newName.trim()) return;
        const newKey = newName.trim().toLowerCase().replace(/\s+/g, '_');
        if (!newKey || newKey === oldKey) {
            cancelEdit();
            return;
        }

        if (newKey in (metaInfo[section] as any)) {
            toast.error("Name already exists");
            return;
        }

        const newSection = { ...(metaInfo[section] as Record<string, boolean>) };
        const value = newSection[oldKey];
        delete newSection[oldKey];
        newSection[newKey] = value;

        const updated = { ...metaInfo, [section]: newSection };
        handleSave(updated as MetaInfo);
        cancelEdit();
    };

    const removeToggleField = (section: keyof MetaInfo, key: string) => {
        if (!metaInfo) return;
        const newSection = { ...(metaInfo[section] as Record<string, boolean>) };
        delete newSection[key];
        const updated = { ...metaInfo, [section]: newSection };
        handleSave(updated as MetaInfo);
    };

    const addCuisine = () => {
        if (!metaInfo || !newCuisine.trim()) return;
        const cu = newCuisine.trim().toLowerCase();
        if (metaInfo.cuisine.includes(cu)) return;

        const updated = {
            ...metaInfo,
            cuisine: [...metaInfo.cuisine, cu]
        };
        setNewCuisine('');
        handleSave(updated);
    };

    const removeCuisine = (c: string) => {
        if (!metaInfo) return;
        const updated = {
            ...metaInfo,
            cuisine: metaInfo.cuisine.filter(item => item !== c)
        };
        handleSave(updated);
    };

    const addCustomCategory = () => {
        if (!metaInfo || !newCategoryName.trim()) return;
        const updated = {
            ...metaInfo,
            custom_categories: [
                ...metaInfo.custom_categories,
                { name: newCategoryName.trim(), items: {} }
            ]
        };
        setNewCategoryName('');
        handleSave(updated);
    };

    const removeCustomCategory = (index: number) => {
        if (!metaInfo) return;
        const updatedCats = [...metaInfo.custom_categories];
        updatedCats.splice(index, 1);
        const updated = { ...metaInfo, custom_categories: updatedCats };
        handleSave(updated);
    };

    const addCustomCategoryItem = (catIndex: number) => {
        if (!metaInfo || !newCategoryItem.trim() || catIndex === null) return;

        const key = newCategoryItem.trim().toLowerCase().replace(/\s+/g, '_');
        const updatedCats = [...metaInfo.custom_categories];

        if (!(key in updatedCats[catIndex].items)) {
            updatedCats[catIndex].items = {
                ...updatedCats[catIndex].items,
                [key]: true
            };
            const updated = { ...metaInfo, custom_categories: updatedCats };
            handleSave(updated);
        }
        setNewCategoryItem('');
    };

    const toggleCustomCategoryItem = (catIndex: number, itemKey: string) => {
        if (!metaInfo) return;
        const updatedCats = [...metaInfo.custom_categories];
        updatedCats[catIndex].items = {
            ...updatedCats[catIndex].items,
            [itemKey]: !updatedCats[catIndex].items[itemKey]
        };
        const updated = { ...metaInfo, custom_categories: updatedCats };
        handleSave(updated);
    };

    const removeCustomCategoryItem = (catIndex: number, itemKey: string) => {
        if (!metaInfo) return;
        const updatedCats = [...metaInfo.custom_categories];
        const newItems = { ...updatedCats[catIndex].items };
        delete newItems[itemKey];
        updatedCats[catIndex].items = newItems;
        const updated = { ...metaInfo, custom_categories: updatedCats };
        handleSave(updated);
    };

    const editCustomCategoryName = (catIndex: number, newName: string) => {
        if (!metaInfo || !newName.trim()) return;
        const updatedCats = [...metaInfo.custom_categories];
        updatedCats[catIndex].name = newName.trim();
        handleSave({ ...metaInfo, custom_categories: updatedCats });
        cancelEdit();
    };

    const editCustomCategoryItem = (catIndex: number, oldKey: string, newName: string) => {
        if (!metaInfo || !newName.trim()) return;
        const newKey = newName.trim().toLowerCase().replace(/\s+/g, '_');
        if (!newKey || newKey === oldKey) {
            cancelEdit();
            return;
        }

        const updatedCats = [...metaInfo.custom_categories];
        const items = { ...updatedCats[catIndex].items };

        if (newKey in items) {
            toast.error("Item already exists");
            return;
        }

        const value = items[oldKey];
        delete items[oldKey];
        items[newKey] = value;
        updatedCats[catIndex].items = items;

        handleSave({ ...metaInfo, custom_categories: updatedCats });
        cancelEdit();
    };

    if (loading || !metaInfo) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="size-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
            </div>
        );
    }

    const renderToggleSection = (title: string, sectionKey: 'facilities' | 'services' | 'payment_methods' | 'policies', description: string) => (
        <div key={sectionKey} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="mb-4">
                <h3 className="text-lg font-black text-black">{title}</h3>
                <p className="text-xs text-black font-medium mt-1">{description}</p>
            </div>

            {/* Add New Field UI */}
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={newFields[sectionKey] || ''}
                    onChange={(e) => setNewFields(prev => ({ ...prev, [sectionKey]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addToggleField(sectionKey)}
                    placeholder={`New ${title.toLowerCase()}...`}
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5"
                />
                <button
                    onClick={() => addToggleField(sectionKey)}
                    disabled={!(newFields[sectionKey] || '').trim() || saving}
                    className="px-4 py-2 bg-neutral-100 text-black rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-200 disabled:opacity-50 text-sm"
                >
                    <LucidePlus size={16} /> Add
                </button>
            </div>

            <div className="space-y-3">
                {Object.keys(metaInfo[sectionKey]).map((key) => {
                    const isActive = (metaInfo[sectionKey] as any)[key];
                    const editId = `${sectionKey}-${key}`;
                    const isEditing = editState?.id === editId;

                    return (
                        <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
                            {isEditing ? (
                                <div className="flex items-center gap-2 flex-1 mr-4">
                                    <input
                                        type="text"
                                        autoFocus
                                        value={editState.val}
                                        onChange={(e) => setEditState({ ...editState, val: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') editToggleField(sectionKey, key, editState.val);
                                            if (e.key === 'Escape') cancelEdit();
                                        }}
                                        className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
                                    />
                                    <button onClick={() => editToggleField(sectionKey, key, editState.val)} className="p-1 text-green-600 hover:bg-green-50 rounded-md">
                                        <LucideCheck size={16} />
                                    </button>
                                    <button onClick={cancelEdit} className="p-1 text-black hover:bg-neutral-100 rounded-md">
                                        <LucideX size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <button onClick={() => removeToggleField(sectionKey, key)} className="text-black hover:text-red-500 transition-colors" title="Delete">
                                        <LucideTrash2 size={16} />
                                    </button>
                                    <button onClick={() => startEdit(editId, formatLabel(key))} className="text-black hover:text-blue-500 transition-colors" title="Edit">
                                        <LucideEdit2 size={16} />
                                    </button>
                                    <span className="text-sm font-bold text-black">{formatLabel(key)}</span>
                                </div>
                            )}

                            {!isEditing && (
                                <button
                                    onClick={() => toggleNestedValue(sectionKey, key)}
                                    disabled={saving}
                                    className={cn(
                                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none",
                                        isActive ? 'bg-black' : 'bg-neutral-200'
                                    )}
                                >
                                    <span className={cn(
                                        "inline-block size-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                                        isActive ? 'translate-x-6' : 'translate-x-1'
                                    )} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="p-8 flex flex-col h-screen space-y-7 overflow-hidden">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-black tracking-tight">Restaurant Profile</h2>
                    <p className="text-sm font-medium text-black mt-1">Manage public info, specialties, facilities, and house policies.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSaveInfo}
                        disabled={savingInfo}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 gap-2 disabled:opacity-50"
                    >
                        {savingInfo ? <div className="size-3 animate-spin border-2 border-white/30 border-t-white rounded-full" /> : <LucideCheck size={16} />}
                        Save Profille
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 pb-8 space-y-8 text-black">
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                    <LucideInfo className="text-blue-500 shrink-0 mt-0.5" size={20} />
                    <p className="text-sm text-blue-900 font-medium">
                        This information defines your restaurant's public profile and capabilities.
                        <strong> This data is used to inform customers about your venue's facilities and policies on the menu and info pages.</strong>
                    </p>
                </div>

                {/* Restaurant Information Section */}
                {restaurantInfo && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-lg font-black text-black">Restaurant Information</h3>
                                <p className="text-xs text-black font-medium mt-1">Basic details about your restaurant displayed to customers on the menu and info pages.</p>
                            </div>
                            <button
                                onClick={handleSaveInfo}
                                disabled={savingInfo}
                                className="px-4 py-2 bg-black text-white rounded-xl text-sm font-semibold hover:bg-neutral-800 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {savingInfo ? (
                                    <div className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                                ) : (
                                    <LucideCheck size={16} />
                                )}
                                Save Info
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Name */}
                            <div>
                                <label className="block text-xs font-semibold text-black mb-1">Restaurant Name *</label>
                                <input
                                    value={restaurantInfo.name}
                                    onChange={e => setRestaurantInfo({ ...restaurantInfo, name: e.target.value })}
                                    placeholder="e.g., The Grand Kitchen"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            {/* Tagline */}
                            <div>
                                <label className="block text-xs font-semibold text-black mb-1">Tagline</label>
                                <input
                                    value={restaurantInfo.tagline}
                                    onChange={e => setRestaurantInfo({ ...restaurantInfo, tagline: e.target.value })}
                                    placeholder="e.g., Taste the Tradition"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            {/* Description */}
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-black mb-1">Description</label>
                                <textarea
                                    value={restaurantInfo.description}
                                    onChange={e => setRestaurantInfo({ ...restaurantInfo, description: e.target.value })}
                                    placeholder="Brief description of your restaurant..."
                                    rows={2}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none"
                                />
                            </div>
                            {/* Phone */}
                            <div>
                                <label className="block text-xs font-semibold text-black mb-1">Phone</label>
                                <input
                                    value={restaurantInfo.phone || ''}
                                    onChange={e => setRestaurantInfo({ ...restaurantInfo, phone: e.target.value })}
                                    placeholder="+91 98765 43210"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            {/* Email */}
                            <div>
                                <label className="block text-xs font-semibold text-black mb-1">Email</label>
                                <input
                                    value={restaurantInfo.email || ''}
                                    onChange={e => setRestaurantInfo({ ...restaurantInfo, email: e.target.value })}
                                    placeholder="contact@restaurant.com"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                            {/* Website */}
                            <div>
                                <label className="block text-xs font-semibold text-black mb-1">Website</label>
                                <input
                                    value={restaurantInfo.website || ''}
                                    onChange={e => setRestaurantInfo({ ...restaurantInfo, website: e.target.value })}
                                    placeholder="https://yourrestaurant.com"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Address */}
                        <div className="mt-4">
                            <label className="block text-xs font-semibold text-black mb-2">Address</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input
                                    value={restaurantInfo.address.street}
                                    onChange={e => setRestaurantInfo({ ...restaurantInfo, address: { ...restaurantInfo.address, street: e.target.value } })}
                                    placeholder="Street / Area"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <input
                                    value={restaurantInfo.address.city}
                                    onChange={e => setRestaurantInfo({ ...restaurantInfo, address: { ...restaurantInfo.address, city: e.target.value } })}
                                    placeholder="City"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <input
                                    value={restaurantInfo.address.state}
                                    onChange={e => setRestaurantInfo({ ...restaurantInfo, address: { ...restaurantInfo.address, state: e.target.value } })}
                                    placeholder="State"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <input
                                    value={restaurantInfo.address.pincode}
                                    onChange={e => setRestaurantInfo({ ...restaurantInfo, address: { ...restaurantInfo.address, pincode: e.target.value } })}
                                    placeholder="Pincode"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        {/* Timings */}
                        <div className="mt-4">
                            <label className="block text-xs font-semibold text-black mb-2">Operating Hours</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] text-black mb-1">Opening Time</label>
                                    <input
                                        type="time"
                                        value={restaurantInfo.timings.opening_time}
                                        onChange={e => setRestaurantInfo({ ...restaurantInfo, timings: { ...restaurantInfo.timings, opening_time: e.target.value } })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-black mb-1">Closing Time</label>
                                    <input
                                        type="time"
                                        value={restaurantInfo.timings.closing_time}
                                        onChange={e => setRestaurantInfo({ ...restaurantInfo, timings: { ...restaurantInfo.timings, closing_time: e.target.value } })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-black mb-1">Days Open</label>
                                    <input
                                        value={restaurantInfo.timings.days_open}
                                        onChange={e => setRestaurantInfo({ ...restaurantInfo, timings: { ...restaurantInfo.timings, days_open: e.target.value } })}
                                        placeholder="Monday - Sunday"
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Social Links */}
                        <div className="mt-4">
                            <label className="block text-xs font-semibold text-black mb-2">Social Links</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <input
                                    value={restaurantInfo.social.instagram || ''}
                                    onChange={e => setRestaurantInfo({ ...restaurantInfo, social: { ...restaurantInfo.social, instagram: e.target.value } })}
                                    placeholder="Instagram URL"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <input
                                    value={restaurantInfo.social.facebook || ''}
                                    onChange={e => setRestaurantInfo({ ...restaurantInfo, social: { ...restaurantInfo.social, facebook: e.target.value } })}
                                    placeholder="Facebook URL"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                                <input
                                    value={restaurantInfo.social.google_maps || ''}
                                    onChange={e => setRestaurantInfo({ ...restaurantInfo, social: { ...restaurantInfo.social, google_maps: e.target.value } })}
                                    placeholder="Google Maps Link"
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
                    {renderToggleSection("Facilities", "facilities", "Physical amenities available at your venue.")}
                    {renderToggleSection("Services", "services", "Operations and service formats you offer.")}
                    {renderToggleSection("Policies", "policies", "House rules and venue regulations.")}
                    {renderToggleSection("Payment Methods", "payment_methods", "Accepted modes of customer payment.")}

                    {/* Cuisine Section */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 md:col-span-2">
                        <div className="mb-4">
                            <h3 className="text-lg font-black text-black">Cuisine</h3>
                            <p className="text-xs text-black font-medium mt-1">Cuisines and food styles your restaurant specializes in.</p>
                        </div>

                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={newCuisine}
                                onChange={(e) => setNewCuisine(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addCuisine()}
                                placeholder="e.g. Italian, North Indian, Chinese"
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5"
                            />
                            <button
                                onClick={addCuisine}
                                disabled={!newCuisine.trim() || saving}
                                className="px-4 py-2.5 bg-black text-white rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 disabled:opacity-50"
                            >
                                <LucidePlus size={16} /> Add
                            </button>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {metaInfo.cuisine.length === 0 && <p className="text-sm text-black italic">No cuisines added yet.</p>}
                            {metaInfo.cuisine.map((c) => (
                                <div key={c} className="flex items-center gap-2 bg-neutral-100 text-black px-3 py-1.5 rounded-lg text-sm font-bold capitalize">
                                    {c}
                                    <button onClick={() => removeCuisine(c)} className="text-black hover:text-red-500 transition-colors">
                                        <LucideTrash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Strictly Typed Custom Categories */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 md:col-span-2">
                        <div className="mb-6">
                            <h3 className="text-lg font-black text-black">Custom Categories</h3>
                            <p className="text-xs text-black font-medium mt-1">Add highly specific informational lists (e.g., "Special Diets", "Ambience Vibes").</p>
                        </div>

                        <div className="flex gap-2 mb-6">
                            <input
                                type="text"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="New category name..."
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5"
                            />
                            <button
                                onClick={addCustomCategory}
                                disabled={!newCategoryName.trim() || saving}
                                className="px-4 py-2.5 border-2 border-dashed border-neutral-300 text-black rounded-xl font-bold flex items-center gap-2 hover:border-black hover:text-black transition-colors"
                            >
                                <LucidePlus size={16} /> Create
                            </button>
                        </div>

                        <div className="space-y-4">
                            {metaInfo.custom_categories.map((cat, catIndex) => (
                                <div key={catIndex} className="p-4 rounded-xl border border-gray-200 bg-gray-50/30">
                                    <div className="flex items-center justify-between mb-4">
                                        {editState?.id === `cat-${catIndex}` ? (
                                            <div className="flex items-center gap-2 flex-1 mr-4">
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={editState.val}
                                                    onChange={(e) => setEditState({ ...editState, val: e.target.value })}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') editCustomCategoryName(catIndex, editState.val);
                                                        if (e.key === 'Escape') cancelEdit();
                                                    }}
                                                    className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-black/20"
                                                />
                                                <button onClick={() => editCustomCategoryName(catIndex, editState.val)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md">
                                                    <LucideCheck size={16} />
                                                </button>
                                                <button onClick={cancelEdit} className="p-1.5 text-black hover:bg-neutral-100 rounded-md">
                                                    <LucideX size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-black text-lg">{cat.name}</h4>
                                                <button onClick={() => startEdit(`cat-${catIndex}`, cat.name)} className="text-black hover:text-blue-500 ml-2 transition-colors" title="Edit Category Name">
                                                    <LucideEdit2 size={16} />
                                                </button>
                                            </div>
                                        )}

                                        {editState?.id !== `cat-${catIndex}` && (
                                            <button onClick={() => removeCustomCategory(catIndex)} className="text-black hover:text-red-500 p-1" title="Delete Category">
                                                <LucideTrash2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3 mb-4">
                                        {Object.entries(cat.items).map(([itemKey, isActive]) => {
                                            const editId = `catItem-${catIndex}-${itemKey}`;
                                            const isEditing = editState?.id === editId;

                                            return (
                                                <div key={itemKey} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                                    {isEditing ? (
                                                        <div className="flex items-center gap-2 flex-1 mr-4">
                                                            <input
                                                                type="text"
                                                                autoFocus
                                                                value={editState.val}
                                                                onChange={(e) => setEditState({ ...editState, val: e.target.value })}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') editCustomCategoryItem(catIndex, itemKey, editState.val);
                                                                    if (e.key === 'Escape') cancelEdit();
                                                                }}
                                                                className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/20"
                                                            />
                                                            <button onClick={() => editCustomCategoryItem(catIndex, itemKey, editState.val)} className="p-1 text-green-600 hover:bg-green-50 rounded-md">
                                                                <LucideCheck size={16} />
                                                            </button>
                                                            <button onClick={cancelEdit} className="p-1 text-black hover:bg-neutral-100 rounded-md">
                                                                <LucideX size={16} />
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <button onClick={() => removeCustomCategoryItem(catIndex, itemKey)} className="text-black hover:text-red-500 transition-colors" title="Delete Feature">
                                                                <LucideTrash2 size={16} />
                                                            </button>
                                                            <button onClick={() => startEdit(editId, formatLabel(itemKey))} className="text-black hover:text-blue-500 transition-colors" title="Edit Feature">
                                                                <LucideEdit2 size={16} />
                                                            </button>
                                                            <span className="text-sm font-bold text-black">{formatLabel(itemKey)}</span>
                                                        </div>
                                                    )}

                                                    {!isEditing && (
                                                        <button
                                                            onClick={() => toggleCustomCategoryItem(catIndex, itemKey)}
                                                            disabled={saving}
                                                            className={cn(
                                                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none",
                                                                isActive ? 'bg-black' : 'bg-neutral-200'
                                                            )}
                                                        >
                                                            <span className={cn(
                                                                "inline-block size-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm",
                                                                isActive ? 'translate-x-6' : 'translate-x-1'
                                                            )} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={activeCategoryIndex === catIndex ? newCategoryItem : ''}
                                            onChange={(e) => {
                                                setActiveCategoryIndex(catIndex);
                                                setNewCategoryItem(e.target.value);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    addCustomCategoryItem(catIndex);
                                                }
                                            }}
                                            placeholder="Add valid item..."
                                            className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-black"
                                        />
                                        <button
                                            onClick={() => addCustomCategoryItem(catIndex)}
                                            disabled={activeCategoryIndex !== catIndex || !newCategoryItem.trim() || saving}
                                            className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-black disabled:opacity-50"
                                        >
                                            <LucidePlus size={16} /> Add Item
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
