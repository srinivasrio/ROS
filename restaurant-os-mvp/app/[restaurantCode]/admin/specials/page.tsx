'use client';

import { useState, useEffect, useRef } from 'react';
import { SpecialsService, TodaySpecial, CreateSpecialInput } from '@/app/services/specials.service';
import { MenuService, MenuItem, Category } from '@/app/services/menu';
import { Plus as LucidePlus, Trash2 as LucideTrash2, Edit as LucideEdit, Star as LucideStar, X as LucideX, Check as LucideCheck, Search as LucideSearch, Calendar as LucideCalendar, Tag as LucideTag, Package as LucidePackage, ToggleLeft as LucideToggleLeft, ToggleRight as LucideToggleRight, Sparkles as LucideSparkles, ChevronDown as LucideChevronDown, Filter as LucideFilter, Upload as LucideUpload, Loader2 as LucideLoader2, Image as LucideImage } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { getCached, setCache } from '@/app/lib/data-cache';
import { compressImage, validateImageFile } from '@/app/lib/image-compress';


export default function AdminSpecialsPage() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const cached = getCached<any>(`specials-${restaurantId}`);
    const [specials, setSpecials] = useState<TodaySpecial[]>(cached?.specials || []);
    const [menuItems, setMenuItems] = useState<MenuItem[]>(cached?.menuItems || []);
    const [categories, setCategories] = useState<Category[]>(cached?.categories || []);
    const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
    const [dietFilter, setDietFilter] = useState<'all' | 'veg' | 'nonveg'>('all');
    const [loading, setLoading] = useState(!cached);
    const [showModal, setShowModal] = useState(false);
    const [editingSpecial, setEditingSpecial] = useState<TodaySpecial | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [specialPrice, setSpecialPrice] = useState('');
    const [isCombo, setIsCombo] = useState(false);
    const [validTo, setValidTo] = useState('');
    const [selectedItems, setSelectedItems] = useState<Array<{ menu_item_id: number; quantity: number; name: string; price: number }>>([]);
    const [itemSearch, setItemSearch] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showItemDropdown, setShowItemDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowItemDropdown(false);
            }
        }
        if (showItemDropdown) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showItemDropdown]);

    useEffect(() => {
        if (!restaurantLoading && restaurantId) {
            loadData();
        }
    }, [restaurantId, restaurantLoading]);

    async function loadData() {
        if (!restaurantId) return;
        try {
            const [specialsData, menuData] = await Promise.all([
                SpecialsService.fetchAllSpecials(restaurantId),
                MenuService.fetchMenuItems(restaurantId),
            ]);
            
            // For the item selector, we only want available items
            const availableItems = menuData.filter(m => m.is_available);
            setMenuItems(availableItems);
            setSpecials(specialsData);

            // Extract categories directly from menu items to guarantee ID match
            // Use ALL menu items (even unavailable) to ensure categories exist if needed
            const catMap = new Map<number, string>();
            menuData.forEach(item => {
                if (item.category_id && item.category) {
                    const catName = (item.category as any).name || '';
                    if (catName && !catMap.has(item.category_id)) {
                        catMap.set(item.category_id, catName);
                    }
                }
            });
            const derivedCategories = Array.from(catMap.entries()).map(([id, name]) => ({
                id,
                name,
                slug: name.toLowerCase().replace(/ /g, '-'),
            }));
            setCategories(derivedCategories as Category[]);

            // Cache for instant display on next visit
            setCache(`specials-${restaurantId}`, {
                specials: specialsData,
                menuItems: availableItems,
                categories: derivedCategories
            });

            console.log('[SPECIALS] Loaded', specialsData.length, 'specials,', availableItems.length, 'available menu items');
        } catch (err) {
            console.error('Failed to load specials data:', err);
            toast.error('Failed to load data. Please refresh.');
        }
        setLoading(false);
    }

    function openCreateModal() {
        setEditingSpecial(null);
        setTitle('');
        setDescription('');
        setSpecialPrice('');
        setIsCombo(false);
        setValidTo('');
        setSelectedItems([]);
        setImageUrl('');
        setShowModal(true);
    }

    function openEditModal(special: TodaySpecial) {
        setEditingSpecial(special);
        setTitle(special.title);
        setDescription(special.description || '');
        setSpecialPrice(special.special_price?.toString() || '');
        setIsCombo(special.is_combo);
        setValidTo(special.valid_to ? new Date(special.valid_to).toISOString().slice(0, 16) : '');
        setSelectedItems(
            (special.items || []).map(si => ({
                menu_item_id: si.menu_item_id,
                quantity: si.quantity,
                name: si.menu_item?.name || 'Unknown',
                price: si.menu_item?.price || 0,
            }))
        );
        setImageUrl(special.image_url || '');
        setShowModal(true);
    }

    function addItemToSpecial(item: MenuItem) {
        if (selectedItems.find(s => s.menu_item_id === item.id)) {
            toast.error('Item already added');
            return;
        }
        setSelectedItems(prev => [...prev, {
            menu_item_id: item.id,
            quantity: 1,
            name: item.name,
            price: item.price,
        }]);
        setItemSearch('');
        setShowItemDropdown(false);
    }

    function removeItemFromSpecial(menuItemId: number) {
        setSelectedItems(prev => prev.filter(s => s.menu_item_id !== menuItemId));
    }

    function updateItemQuantity(menuItemId: number, qty: number) {
        if (qty < 1) return;
        setSelectedItems(prev => prev.map(s =>
            s.menu_item_id === menuItemId ? { ...s, quantity: qty } : s
        ));
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validationError = validateImageFile(file);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setIsUploading(true);
        try {
            const compressed = await compressImage(file);
            const uploadedUrl = await MenuService.uploadMenuImage(compressed.file);
            setImageUrl(uploadedUrl);
            toast.success('Image uploaded successfully');
        } catch (error) {
            console.error('Upload failed:', error);
            toast.error('Failed to upload image');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    async function handleSave() {
        if (!title.trim()) {
            toast.error('Title is required');
            return;
        }
        if (selectedItems.length === 0) {
            toast.error('Add at least one menu item');
            return;
        }
        if (!restaurantId) return;

        const input: CreateSpecialInput = {
            restaurant_id: restaurantId,
            title: title.trim(),
            description: description.trim() || undefined,
            special_price: specialPrice ? parseFloat(specialPrice) : undefined,
            is_combo: isCombo,
            valid_to: validTo ? new Date(validTo).toISOString() : undefined,
            items: selectedItems.map(s => ({ menu_item_id: s.menu_item_id, quantity: s.quantity })),
            image_url: imageUrl.trim() || undefined,
        };

        if (editingSpecial) {
            const success = await SpecialsService.updateSpecial(editingSpecial.id, restaurantId, {
                title: input.title,
                description: input.description,
                special_price: input.special_price,
                is_combo: input.is_combo,
                valid_to: input.valid_to,
                image_url: input.image_url,
            } as any);
            if (success) {
                await SpecialsService.updateSpecialItems(editingSpecial.id, restaurantId, input.items);
                toast.success('Special updated successfully');
            } else {
                toast.error('Failed to update special');
            }
        } else {
            const result = await SpecialsService.createSpecial(restaurantId, input);
            if (result) {
                toast.success('Special created successfully');
            } else {
                toast.error('Failed to create special');
            }
        }

        setShowModal(false);
        loadData();
    }

    async function handleToggle(special: TodaySpecial) {
        if (!restaurantId) return;
        const success = await SpecialsService.toggleSpecialActive(special.id, restaurantId, !special.is_active);
        if (success) {
            toast.success(special.is_active ? 'Special deactivated' : 'Special activated');
            loadData();
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this special?')) return;
        if (!restaurantId) return;
        const success = await SpecialsService.deleteSpecial(id, restaurantId);
        if (success) {
            toast.success('Special deleted');
            loadData();
        }
    }

    function getOriginalTotal(): number {
        return selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }

    function getSpecialStatus(special: TodaySpecial): 'Active' | 'Disabled' | 'Expired' {
        if (!special.is_active) return 'Disabled';
        if (special.valid_to && new Date(special.valid_to) < new Date()) return 'Expired';
        return 'Active';
    }

    const filteredMenuItems = menuItems.filter(item => {
        const matchesSearch = !itemSearch || item.name.toLowerCase().includes(itemSearch.toLowerCase());
        const matchesCategory = selectedCategory === null || item.category_id === selectedCategory;
        const notAlreadyAdded = !selectedItems.find(s => s.menu_item_id === item.id);
        const matchesDiet = dietFilter === 'all' ||
            (dietFilter === 'veg' && item.item_type === 'Veg') ||
            (dietFilter === 'nonveg' && (item.item_type === 'Non-Veg' || item.item_type === 'Egg'));
        return matchesSearch && matchesCategory && notAlreadyAdded && matchesDiet;
    }).slice(0, 20);

    return (
        <div className="p-8 flex flex-col h-screen space-y-7 overflow-hidden">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-black tracking-tight">Today's Specials</h2>
                    <p className="text-sm font-medium text-black mt-1">Create and manage daily special offers, combos, and spotlight items.</p>
                </div>
                <button
                    onClick={openCreateModal}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 gap-2"
                >
                    <LucidePlus size={16} />
                    Create New Special
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 pb-8">

            {/* Specials List */}
            {loading ? (
                <div className="text-center py-20 text-black">Loading specials...</div>
            ) : specials.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"
                >
                    <LucideSparkles className="w-12 h-12 text-black mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-black mb-2">No Specials Yet</h3>
                    <p className="text-sm text-black mb-6">Create your first special to showcase to customers</p>
                    <button
                        onClick={openCreateModal}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                        Create First Special
                    </button>
                </motion.div>
            ) : (
                <div className="space-y-4">
                    {specials.map((special) => {
                        const status = getSpecialStatus(special);
                        return (
                            <motion.div
                                key={special.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className={`bg-white rounded-2xl border p-4 transition-all ${status === 'Active' ? 'border-green-200 shadow-sm' :
                                    status === 'Expired' ? 'border-red-200 opacity-60' :
                                        'border-gray-200 opacity-70'
                                    }`}
                            >
                                <div className="flex items-start gap-4">
                                    {special.image_url ? (
                                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100">
                                            <img src={special.image_url} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    ) : special.items?.[0]?.menu_item?.image_url ? (
                                        <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border border-gray-100 bg-gray-50 flex items-center justify-center">
                                            <img src={special.items[0].menu_item.image_url} alt="" className="w-full h-full object-cover" />
                                        </div>
                                    ) : (
                                        <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                                            <LucidePackage className="w-6 h-6 text-black" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-bold text-black">{special.title}</h3>
                                            {special.is_combo && (
                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold uppercase rounded-md">
                                                    Combo
                                                </span>
                                            )}
                                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md ${status === 'Active' ? 'bg-green-100 text-green-700' :
                                                status === 'Expired' ? 'bg-red-100 text-red-700' :
                                                    'bg-gray-100 text-black'
                                                }`}>
                                                {status}
                                            </span>
                                        </div>
                                        {special.description && (
                                            <p className="text-sm text-black mb-3">{special.description}</p>
                                        )}

                                        {/* Items */}
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {(special.items || []).map((si, idx) => (
                                                <span key={`${special.id}-${si.menu_item_id || idx}`} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-50 border border-gray-100 rounded-lg text-xs text-black">
                                                    <LucidePackage className="w-3 h-3" />
                                                    {si.menu_item?.name || 'Unknown'} {si.quantity > 1 ? `×${si.quantity}` : ''}
                                                </span>
                                            ))}
                                        </div>

                                        {/* Price */}
                                        <div className="flex items-center gap-3">
                                            {special.special_price ? (
                                                <>
                                                    <span className="text-xl font-black text-green-600">₹{special.special_price}</span>
                                                    <span className="text-sm text-black line-through">
                                                        ₹{(special.items || []).reduce((sum, si) => sum + (si.menu_item?.price || 0) * (si.quantity || 1), 0)}
                                                    </span>
                                                </>
                                            ) : (
                                                <span className="text-xl font-black text-black">
                                                    ₹{(special.items || []).reduce((sum, si) => sum + (si.menu_item?.price || 0) * (si.quantity || 1), 0)}
                                                </span>
                                            )}
                                            {special.valid_to && (
                                                <span className="text-xs text-black flex items-center gap-1">
                                                    <LucideCalendar className="w-3 h-3" />
                                                    Until {new Date(special.valid_to).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={() => handleToggle(special)}
                                            className={`p-2 rounded-lg transition-colors ${special.is_active
                                                ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                                : 'bg-gray-50 text-black hover:bg-gray-100'
                                                }`}
                                            title={special.is_active ? 'Deactivate' : 'Activate'}
                                        >
                                            {special.is_active ? <LucideToggleRight className="w-5 h-5" /> : <LucideToggleLeft className="w-5 h-5" />}
                                        </button>
                                        <button
                                            onClick={() => openEditModal(special)}
                                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                        >
                                            <LucideEdit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(special.id)}
                                            className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                        >
                                            <LucideTrash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>

            {/* ─── Create / Edit Modal ─── */}
            <AnimatePresence>
                {showModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                        onClick={() => setShowModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-black">
                                    {editingSpecial ? 'Edit Special' : 'Create New Special'}
                                </h2>
                                <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                                    <LucideX className="w-5 h-5 text-black" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-5">
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-semibold text-black mb-1.5">Title *</label>
                                    <input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g., Lunch Combo, Chef's Special"
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-semibold text-black mb-1.5">Description</label>
                                    <textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Quick description for customers"
                                        rows={2}
                                    />
                                </div>

                                {/* Image URL / Upload */}
                                <div>
                                    <label className="block text-sm font-semibold text-black mb-1.5">Special Image</label>
                                    <div className="flex gap-2 mb-2">
                                        <div className="flex-1">
                                            <input
                                                value={imageUrl}
                                                onChange={(e) => setImageUrl(e.target.value)}
                                                placeholder="Paste image URL (optional)"
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="px-4 py-2 bg-white border border-gray-200 text-black rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2 font-bold text-sm disabled:opacity-50"
                                        >
                                            {isUploading ? (
                                                <LucideLoader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <LucideUpload className="w-4 h-4" />
                                            )}
                                            Upload
                                        </button>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleImageUpload}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                    </div>
                                    {imageUrl && (
                                        <div className="relative inline-block mt-1">
                                            <img src={imageUrl} alt="Preview" className="w-24 h-24 object-cover rounded-xl border border-gray-200 shadow-sm" />
                                            <button
                                                onClick={() => setImageUrl('')}
                                                className="absolute -top-1.5 -right-1.5 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"
                                            >
                                                <LucideX className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Combo Toggle + Price */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-black mb-1.5">Type</label>
                                        <button
                                            onClick={() => setIsCombo(!isCombo)}
                                            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${isCombo
                                                ? 'bg-purple-50 border-purple-200 text-purple-700'
                                                : 'bg-gray-50 border-gray-200 text-black'
                                                }`}
                                        >
                                            <LucidePackage className="w-4 h-4" />
                                            {isCombo ? 'Combo' : 'Single Special'}
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-black mb-1.5">
                                            Special Price <span className="text-black font-normal">(optional)</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black text-sm">₹</span>
                                            <input
                                                type="number"
                                                value={specialPrice}
                                                onChange={(e) => setSpecialPrice(e.target.value)}
                                                placeholder="Override price"
                                                className="w-full pl-7 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Valid Until */}
                                <div>
                                    <label className="block text-sm font-semibold text-black mb-1.5">
                                        Valid Until <span className="text-black font-normal">(auto-expires)</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={validTo}
                                        onChange={(e) => setValidTo(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                    />
                                </div>

                                {/* Menu Items Selector */}
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-sm font-semibold text-black">
                                            Menu Items * <span className="text-black font-normal">({selectedItems.length} selected)</span>
                                        </label>
                                        {/* Search */}
                                        <div className="relative w-44">
                                            <LucideSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-black" />
                                            <input
                                                value={itemSearch}
                                                onChange={(e) => setItemSearch(e.target.value)}
                                                placeholder="Search..."
                                                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Category Tabs + Diet Filter Row */}
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex flex-wrap gap-1.5 flex-1">
                                            <button
                                                onClick={() => setSelectedCategory(null)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedCategory === null
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                    : 'bg-gray-50 text-black border-gray-200 hover:bg-gray-100'
                                                    }`}
                                            >
                                                All
                                            </button>
                                            {categories.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setSelectedCategory(cat.id === selectedCategory ? null : cat.id)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedCategory === cat.id
                                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                        : 'bg-gray-50 text-black border-gray-200 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    {cat.name}
                                                </button>
                                            ))}
                                        </div>
                                        {/* Diet Filter */}
                                        <div className="flex gap-1 flex-shrink-0">
                                            <button
                                                onClick={() => setDietFilter('all')}
                                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${dietFilter === 'all'
                                                    ? 'bg-gray-800 text-white border-gray-800'
                                                    : 'bg-gray-50 text-black border-gray-200 hover:bg-gray-100'
                                                    }`}
                                            >
                                                All
                                            </button>
                                            <button
                                                onClick={() => setDietFilter('veg')}
                                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1 ${dietFilter === 'veg'
                                                    ? 'bg-green-600 text-white border-green-600'
                                                    : 'bg-gray-50 text-black border-gray-200 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 border border-green-600" style={dietFilter === 'veg' ? { borderColor: 'white', backgroundColor: 'white' } : {}} /> Veg
                                            </button>
                                            <button
                                                onClick={() => setDietFilter('nonveg')}
                                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1 ${dietFilter === 'nonveg'
                                                    ? 'bg-red-600 text-white border-red-600'
                                                    : 'bg-gray-50 text-black border-gray-200 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 border border-red-600" style={dietFilter === 'nonveg' ? { borderColor: 'white', backgroundColor: 'white' } : {}} /> Non-Veg
                                            </button>
                                        </div>
                                    </div>

                                    {/* Inline Item List — always visible */}
                                    <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden mb-3">
                                        <div className="max-h-52 overflow-y-auto divide-y divide-gray-100">
                                            {filteredMenuItems.length === 0 ? (
                                                <div className="p-4 text-sm text-black text-center">
                                                    No items found{selectedCategory !== null ? ' in this category' : ''}
                                                </div>
                                            ) : (
                                                filteredMenuItems.map(item => (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => addItemToSpecial(item)}
                                                        className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between transition-colors group"
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            {item.image_url ? (
                                                                <img
                                                                    src={item.image_url}
                                                                    alt={item.name}
                                                                    className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
                                                                />
                                                            ) : (
                                                                <div className={`w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold ${item.item_type === 'Veg' ? 'bg-green-400' :
                                                                    item.item_type === 'Egg' ? 'bg-yellow-400' : 'bg-red-400'
                                                                    }`}>
                                                                    {item.name.charAt(0)}
                                                                </div>
                                                            )}
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className={`w-2 h-2 rounded-sm flex-shrink-0 border ${item.item_type === 'Veg' ? 'bg-green-500 border-green-600' :
                                                                        item.item_type === 'Egg' ? 'bg-yellow-500 border-yellow-600' : 'bg-red-500 border-red-600'
                                                                        }`} />
                                                                    <span className="text-sm font-medium text-black truncate">{item.name}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-shrink-0">
                                                            <span className="text-xs font-semibold text-black">₹{item.price}</span>
                                                            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <LucidePlus className="w-3.5 h-3.5" />
                                                            </span>
                                                        </div>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                        {filteredMenuItems.length > 0 && (
                                            <div className="px-4 py-1.5 bg-gray-100/80 border-t border-gray-200 text-[10px] text-black text-center">
                                                Showing {filteredMenuItems.length} items • Click to add
                                            </div>
                                        )}
                                    </div>

                                    {/* Selected Items */}
                                    {selectedItems.length > 0 && (
                                        <div className="space-y-2">
                                            <div className="text-xs font-semibold text-black uppercase tracking-wider">Added Items</div>
                                            {selectedItems.map((item, idx) => (
                                                <div key={item.menu_item_id || idx} className="flex items-center justify-between px-3 py-2 bg-blue-50/50 border border-blue-100 rounded-xl">
                                                    <span className="text-sm font-medium text-black flex-1">{item.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-black">₹{item.price}</span>
                                                        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                                                            <button
                                                                onClick={() => updateItemQuantity(item.menu_item_id, item.quantity - 1)}
                                                                className="px-2 py-0.5 text-xs hover:bg-gray-100"
                                                            >−</button>
                                                            <span className="px-2 py-0.5 text-xs font-medium bg-white">{item.quantity}</span>
                                                            <button
                                                                onClick={() => updateItemQuantity(item.menu_item_id, item.quantity + 1)}
                                                                className="px-2 py-0.5 text-xs hover:bg-gray-100"
                                                            >+</button>
                                                        </div>
                                                        <button onClick={() => removeItemFromSpecial(item.menu_item_id)} className="p-1 hover:bg-red-100 rounded-md">
                                                            <LucideX className="w-3.5 h-3.5 text-red-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Price Summary */}
                                            <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-sm">
                                                <span className="text-black">Original Total:</span>
                                                <span className="font-semibold text-black">₹{getOriginalTotal()}</span>
                                            </div>
                                            {specialPrice && (
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-green-600 font-medium">Special Price:</span>
                                                    <span className="font-bold text-green-600">₹{specialPrice} <span className="text-xs text-black">(Save ₹{getOriginalTotal() - parseFloat(specialPrice)})</span></span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="px-5 py-2.5 text-sm text-black hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium shadow-lg shadow-blue-600/20"
                                >
                                    <LucideCheck className="w-4 h-4" />
                                    {editingSpecial ? 'Update Special' : 'Create Special'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
