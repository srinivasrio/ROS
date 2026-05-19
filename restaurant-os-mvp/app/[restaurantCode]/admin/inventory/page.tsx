'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingDown as LucideTrendingDown, AlertTriangle as LucideAlertTriangle, PackageSearch as LucidePackageSearch, Package as LucidePackage, Plus as LucidePlus, Edit2 as LucideEdit2, Trash2 as LucideTrash2, X as LucideX, Truck as LucideTruck, Search as LucideSearch } from 'lucide-react';
import { InventoryService, InventoryItem, InventoryCategory } from '@/app/services/inventory.service';
import { SupplierService, Supplier } from '@/app/services/supplier.service';
import ConfirmationModal from '@/app/components/ui/ConfirmationModal';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { getCached, setCache } from '@/app/lib/data-cache';

import { LoadingState } from '@/components/ui/LoadingState';

export default function InventoryDashboard() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const cacheKey = `inventory-${restaurantId}`;
    const cached = getCached<any>(cacheKey);
    const [stats, setStats] = useState(cached?.stats || { totalValue: 0, lowStockCount: 0, predictedShortageCount: 0, wastagePercent: 0 });
    const [items, setItems] = useState<InventoryItem[]>(cached?.items || []);
    const [categories, setCategories] = useState<InventoryCategory[]>(cached?.categories || []);
    const [suppliers, setSuppliers] = useState<Supplier[]>(cached?.suppliers || []);
    const [loading, setLoading] = useState(!cached);
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('All');

    const [showAddModal, setShowAddModal] = useState(false);
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [editItemId, setEditItemId] = useState<string | null>(null);
    const [newItem, setNewItem] = useState({ name: '', category_id: '', item_type: 'Veg', unit: 'kg', min_threshold: 5, cost_per_unit: 100, current_stock: 0 });

    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');

    const [modalConfig, setModalConfig] = useState({
        isOpen: false,
        title: '',
        message: '',
        isAlert: false,
        isSuperDestructive: false,
        confirmText: 'Confirm',
        onConfirm: () => { }
    });
    const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

    useEffect(() => {
        if (!restaurantLoading && restaurantId) {
            loadData();
        }
    }, [restaurantId, restaurantLoading]);

    const loadData = async () => {
        if (!restaurantId) return;
        try {
            const [s, i, c, sup] = await Promise.all([
                InventoryService.fetchDashboardStats(restaurantId),
                InventoryService.fetchItems(restaurantId),
                InventoryService.fetchCategories(restaurantId),
                SupplierService.fetchSuppliers(restaurantId)
            ]);
            setStats(s);
            setItems(i);
            setCategories(c);
            setSuppliers(sup);
            setCache(cacheKey, { stats: s, items: i, categories: c, suppliers: sup });
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <LoadingState message="Scanning your inventory..." fullScreen />;

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) return;
        try {
            const itemData = {
                name: newItem.name,
                category_id: newItem.category_id,
                item_type: newItem.item_type,
                unit: newItem.unit,
                min_threshold: Number(newItem.min_threshold),
                cost_per_unit: Number(newItem.cost_per_unit),
                current_stock: Number(newItem.current_stock)
            };

            if (editItemId) {
                await InventoryService.updateItem(editItemId, restaurantId, itemData);
                // Note: We update stock directly here instead of using adjustStock for simplicity in the edit form
            } else {
                await InventoryService.createItem(itemData, restaurantId);
            }
            setShowAddModal(false);
            setEditItemId(null);
            setNewItem({ name: '', category_id: '', item_type: 'Veg', unit: 'kg', min_threshold: 5, cost_per_unit: 100, current_stock: 0 });
            loadData();
        } catch (e) {
            setModalConfig({
                isOpen: true,
                title: 'Error Saving Item',
                message: 'Failed to save item. Please try again.',
                isAlert: true,
                isSuperDestructive: false,
                confirmText: 'OK',
                onConfirm: () => { }
            });
        }
    }

    const openEditModal = (item: InventoryItem) => {
        setEditItemId(item.id);
        setNewItem({
            name: item.name,
            category_id: item.category_id || '',
            item_type: item.item_type || 'Veg',
            unit: item.unit,
            min_threshold: item.min_threshold,
            cost_per_unit: item.cost_per_unit,
            current_stock: item.current_stock
        });
        setShowAddModal(true);
    };

    const handleAdjustStock = async (id: string, newStock: number) => {
        if (!restaurantId) return;
        try {
            await InventoryService.adjustStock(id, newStock, restaurantId, 'manual');
            loadData();
        } catch (e) {
            setModalConfig({
                isOpen: true,
                title: 'Error Adjusting Stock',
                message: 'Failed to adjust stock. Please try again.',
                isAlert: true,
                isSuperDestructive: false,
                confirmText: 'OK',
                onConfirm: () => { }
            });
        }
    }

    const handleSaveCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!restaurantId) return;
        try {
            if (editingCategoryId) {
                await InventoryService.updateCategory(editingCategoryId, restaurantId, editingCategoryName);
            } else {
                await InventoryService.createCategory(newCategoryName, restaurantId);
            }
            setNewCategoryName('');
            setEditingCategoryId(null);
            setEditingCategoryName('');
            loadData();
        } catch (e: any) {
            const isConflict = e?.code === '23505' || e?.status === 409;
            setModalConfig({
                isOpen: true,
                title: isConflict ? 'Category Already Exists' : 'Error Saving Category',
                message: isConflict 
                    ? `A category named "${editingCategoryId ? editingCategoryName : newCategoryName}" already exists in your inventory.`
                    : 'Failed to save category. Please try again.',
                isAlert: true,
                isSuperDestructive: false,
                confirmText: 'OK',
                onConfirm: () => { }
            });
        }
    };

    const handleDeleteCategory = (id: string, name: string) => {
        setModalConfig({
            isOpen: true,
            title: 'Delete Category',
            message: `Are you sure you want to delete ${name}? Items using this category will become Unassigned.`,
            isAlert: false,
            isSuperDestructive: true,
            confirmText: 'Delete Category',
            onConfirm: async () => {
                if (!restaurantId) return;
                try {
                    await InventoryService.deleteCategory(id, restaurantId);
                    loadData();
                } catch (e) {
                    setModalConfig({
                        isOpen: true,
                        title: 'Error Deleting Category',
                        message: 'Failed to delete category. Ensure no items are depending on it or they have been updated.',
                        isAlert: true,
                        isSuperDestructive: false,
                        confirmText: 'OK',
                        onConfirm: () => { }
                    });
                }
            }
        });
    };

    if (loading) return <div>Loading...</div>;

    const statCards = [
        { label: 'Total Value on Hand', value: `₹${stats.totalValue.toLocaleString()}`, icon: LucidePackage, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Low Stock Items', value: stats.lowStockCount, icon: LucideAlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Predicted Shortages (7d)', value: stats.predictedShortageCount, icon: LucidePackageSearch, color: 'text-rose-600', bg: 'bg-rose-50' },
        { label: 'Estimated Wastage', value: `${stats.wastagePercent}%`, icon: LucideTrendingDown, color: 'text-black', bg: 'bg-neutral-100' },
    ];

    return (
        <div className="p-8 flex flex-col h-screen space-y-7 overflow-hidden">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-black tracking-tight">Inventory Management</h2>
                    <p className="text-sm font-medium text-black mt-1">Track and manage raw materials, stock levels, and suppliers.</p>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowSupplierModal(true)}
                        className="px-4 py-2 bg-white border border-neutral-200 text-black text-xs font-bold rounded-lg hover:bg-neutral-50 transition-all shadow-sm flex items-center gap-2"
                    >
                        <LucideTruck size={16} />
                        Suppliers
                    </button>
                    <button 
                        onClick={() => setShowCategoryModal(true)}
                        className="px-4 py-2 bg-white border border-neutral-200 text-black text-xs font-bold rounded-lg hover:bg-neutral-50 transition-all shadow-sm flex items-center gap-2"
                    >
                        <LucidePackageSearch size={16} />
                        Categories
                    </button>
                    <button 
                        onClick={() => { setEditItemId(null); setNewItem({ name: '', category_id: '', item_type: 'Veg', unit: 'kg', min_threshold: 5, cost_per_unit: 100, current_stock: 0 }); setShowAddModal(true); }}
                        className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                    >
                        <LucidePlus size={16} />
                        Add New Item
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
                {statCards.map((c, i) => (
                    <motion.div 
                        key={c.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="bg-white p-6 rounded-[2rem] border border-neutral-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow"
                    >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${c.bg} ${c.color} shrink-0`}>
                            <c.icon size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-black mb-1">{c.label}</p>
                            <p className="text-2xl font-black text-black tracking-tight">{c.value}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Inventory List */}
            <div className="bg-white rounded-[2.5rem] border border-neutral-200 shadow-sm overflow-hidden">
                <div className="p-8 border-b border-neutral-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-50/30">
                    <div className="relative flex-1 max-w-md">
                        <LucideSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
                        <input 
                            type="text" 
                            placeholder="Search raw materials..." 
                            className="w-full bg-white border border-neutral-200 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all font-medium text-sm"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowSupplierModal(true)} className="flex items-center gap-2 bg-white text-black border border-neutral-200 px-6 py-3 rounded-2xl text-sm font-bold hover:bg-neutral-50 transition-colors">
                            <LucideTruck className="w-4 h-4" />
                            Suppliers
                        </button>
                        <button onClick={() => setShowCategoryModal(true)} className="flex items-center gap-2 bg-white text-black border border-neutral-200 px-6 py-3 rounded-2xl text-sm font-bold hover:bg-neutral-50 transition-colors">
                            <LucidePackageSearch className="w-4 h-4" />
                            Categories
                        </button>
                        <button onClick={() => {
                            setEditItemId(null);
                            setNewItem({ name: '', category_id: '', item_type: 'Veg', unit: 'kg', min_threshold: 5, cost_per_unit: 100, current_stock: 0 });
                            setShowAddModal(true);
                        }} className="flex items-center gap-2 bg-neutral-900 text-white px-6 py-3 rounded-2xl text-sm font-black hover:bg-neutral-800 transition-colors shadow-lg shadow-neutral-900/10">
                            <LucidePlus className="w-5 h-5" />
                            Add Material
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-neutral-50 text-xs font-semibold text-black uppercase tracking-wider">
                                <th className="p-4 border-b">Item Name</th>
                                <th className="p-4 border-b">Current Stock</th>
                                <th className="p-4 border-b">Unit Cost</th>
                                <th className="p-4 border-b">Total Value</th>
                                <th className="p-4 border-b">Status</th>
                                <th className="p-4 border-b text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {items.filter(item => selectedCategoryFilter === 'All' || item.category_id === selectedCategoryFilter).map(item => {
                                const isLow = item.current_stock <= item.min_threshold;
                                const categoryName = categories.find(c => c.id === item.category_id)?.name || item.category || 'Unassigned';
                                return (
                                    <tr key={item.id} className="hover:bg-neutral-50/50">
                                        <td className="p-4">
                                            <p className="font-semibold text-black">{item.name}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">{categoryName}</span>
                                                <span className="text-xs text-black">Min: {item.min_threshold} {item.unit}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className="font-bold">{item.current_stock}</span> <span className="text-black text-sm">{item.unit}</span>
                                        </td>
                                        <td className="p-4 text-black">₹{item.cost_per_unit}</td>
                                        <td className="p-4 font-medium text-black">₹{(item.current_stock * item.cost_per_unit).toLocaleString()}</td>
                                        <td className="p-4">
                                            {isLow ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Low Stock
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Okay
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button
                                                onClick={() => openEditModal(item)}
                                                className="px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            {items.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-black">No raw materials added yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Item Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold">{editItemId ? 'Edit Raw Material' : 'Add Raw Material'}</h2>
                            <button onClick={() => setShowAddModal(false)} className="text-black hover:text-black">&times;</button>
                        </div>
                        <form onSubmit={handleAddItem} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-black mb-1">Item Name</label>
                                <input required type="text" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} className="w-full border border-neutral-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="e.g. Tomato, Chicken Breast" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Category</label>
                                    <select required value={newItem.category_id} onChange={e => setNewItem({ ...newItem, category_id: e.target.value })} className="w-full border border-neutral-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                                        <option value="" disabled>Select category</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <button 
                                        type="button" 
                                        onClick={() => { setShowAddModal(false); setShowCategoryModal(true); }}
                                        className="text-[10px] text-blue-600 font-bold mt-1 hover:underline"
                                    >
                                        + Manage Categories
                                    </button>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Dietary Type</label>
                                    <select value={newItem.item_type} onChange={e => setNewItem({ ...newItem, item_type: e.target.value })} className="w-full border border-neutral-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
                                        <option value="Veg">Veg</option>
                                        <option value="Non-Veg">Non-Veg</option>
                                        <option value="Egg">Egg</option>
                                        <option value="Other">Other (e.g. Packaging)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Unit</label>
                                    <select
                                        required
                                        value={newItem.unit}
                                        onChange={e => setNewItem({ ...newItem, unit: e.target.value })}
                                        className="w-full border border-neutral-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="" disabled>Select unit</option>
                                        <option value="kg">kg</option>
                                        <option value="gram">gram</option>
                                        <option value="mg">mg</option>
                                        <option value="L">Liter (L)</option>
                                        <option value="ml">ml</option>
                                        <option value="pieces">pieces</option>
                                        <option value="packets">packets</option>
                                        <option value="boxes">boxes</option>
                                        <option value="dozen">dozen</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Cost per {newItem.unit || 'Unit'} (₹)</label>
                                    <input required type="number" step="0.01" value={newItem.cost_per_unit} onChange={e => setNewItem({ ...newItem, cost_per_unit: Number(e.target.value) })} className="w-full border border-neutral-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-black mb-1">Min Threshold Alert</label>
                                <input required type="number" step="0.1" value={newItem.min_threshold} onChange={e => setNewItem({ ...newItem, min_threshold: Number(e.target.value) })} className="w-full border border-neutral-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-black mb-1">{editItemId ? 'Current Stock' : 'Initial Stock'}</label>
                                <input required type="number" step="0.01" value={newItem.current_stock} onChange={e => setNewItem({ ...newItem, current_stock: Number(e.target.value) })} className="w-full border border-neutral-200 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setShowAddModal(false)} className="px-5 py-2.5 text-sm font-semibold text-black hover:bg-neutral-100 rounded-lg">Cancel</button>
                                <button type="submit" className="px-5 py-2.5 text-sm font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800">Save Item</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                title={modalConfig.title}
                message={modalConfig.message}
                isAlert={modalConfig.isAlert}
                isSuperDestructive={modalConfig.isSuperDestructive}
                confirmText={modalConfig.confirmText}
                onConfirm={modalConfig.onConfirm}
            />

            {/* Category Management Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-white sticky top-0 z-10 gap-4">
                            <h2 className="text-lg font-bold text-black whitespace-nowrap">Manage Categories</h2>
                            <div className="flex items-center gap-3 w-full justify-end">
                                {!editingCategoryId && (
                                    <form onSubmit={handleSaveCategory} className="flex gap-2 w-full max-w-[260px]">
                                        <input
                                            required
                                            value={newCategoryName}
                                            onChange={e => setNewCategoryName(e.target.value)}
                                            placeholder="New Category..."
                                            className="w-full border border-neutral-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                                        />
                                        <button type="submit" className="bg-neutral-900 text-white px-3 py-1.5 flex items-center gap-1 rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors shrink-0">
                                            <LucidePlus size={16} /> Add
                                        </button>
                                    </form>
                                )}
                                <button onClick={() => {
                                    setShowCategoryModal(false);
                                    setEditingCategoryId(null);
                                }} className="text-black hover:text-black transition-colors shrink-0 ml-1">
                                    <LucideX size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {/* Category List */}
                            <div className="space-y-3 mb-8">
                                <h3 className="text-sm font-semibold text-black uppercase tracking-wider mb-2">Existing Categories</h3>
                                {categories.length === 0 ? (
                                    <p className="text-sm text-black">No categories found.</p>
                                ) : (
                                    categories.map(cat => (
                                        <div key={cat.id} className="flex justify-between items-center p-3 bg-neutral-50 border border-neutral-200 rounded-lg group hover:border-neutral-300 transition-colors">
                                            {editingCategoryId === cat.id ? (
                                                <form onSubmit={handleSaveCategory} className="flex-1 flex gap-2">
                                                    <input
                                                        autoFocus
                                                        value={editingCategoryName}
                                                        onChange={e => setEditingCategoryName(e.target.value)}
                                                        className="flex-1 px-2 py-1 text-sm border border-blue-500 rounded outline-none"
                                                    />
                                                    <button type="submit" className="text-xs bg-blue-600 text-white px-3 py-1 rounded font-medium">Save</button>
                                                    <button type="button" onClick={() => setEditingCategoryId(null)} className="text-xs text-black hover:text-black font-medium">Cancel</button>
                                                </form>
                                            ) : (
                                                <>
                                                    <span className="font-medium text-black text-sm">{cat.name}</span>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => {
                                                                setEditingCategoryId(cat.id);
                                                                setEditingCategoryName(cat.name);
                                                            }}
                                                            className="p-1.5 text-black hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        >
                                                            <LucideEdit2 size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteCategory(cat.id, cat.name)}
                                                            className="p-1.5 text-black hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        >
                                                            <LucideTrash2 size={14} />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Supplier Management Modal */}
            {showSupplierModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="px-8 py-6 border-b border-neutral-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <h2 className="text-xl font-black">Manage Suppliers</h2>
                            <button onClick={() => setShowSupplierModal(false)} className="p-2 hover:bg-neutral-50 rounded-xl transition-colors">
                                <LucideX size={20} />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto flex-1 space-y-6">
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-black font-medium">{suppliers.length} active suppliers partnered.</p>
                                <button className="bg-neutral-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-neutral-800 transition-colors">
                                    + Add Supplier
                                </button>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                {suppliers.length === 0 ? (
                                    <div className="text-center py-12 border-2 border-dashed border-neutral-100 rounded-3xl">
                                        <LucideTruck className="w-8 h-8 text-black mx-auto mb-3" />
                                        <p className="text-sm text-black font-medium">No suppliers logged in your directory yet.</p>
                                    </div>
                                ) : (
                                    suppliers.map(sup => (
                                        <div key={sup.id} className="p-4 bg-neutral-50 border border-neutral-200 rounded-2xl flex justify-between items-center group hover:border-orange-500/20 transition-colors">
                                            <div>
                                                <p className="font-bold">{sup.name}</p>
                                                <p className="text-xs text-black">{sup.contact_person} • {sup.phone}</p>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-neutral-200">
                                                    <LucideEdit2 size={14} />
                                                </button>
                                                <button className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors border border-transparent hover:border-red-200">
                                                    <LucideTrash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
