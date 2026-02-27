'use client';

import { useState, useEffect } from 'react';
import { LucidePlus, LucideEdit2, LucideTrash2, LucideSearch, LucideIndianRupee, LucideX, LucideGripVertical, LucideGripHorizontal } from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import { MenuService, Category, MenuItem, SubCategory } from '@/app/services/menu';
import ConfirmationModal from '@/app/components/ui/ConfirmationModal';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    horizontalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Sortable Components ---

function SortableCategoryRow({
    category,
    isSelected,
    count,
    onClick,
    onDelete
}: {
    category: Category;
    isSelected: boolean;
    count: number;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: category.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as const,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onClick} // Make entire row clickable
            className={`w-full relative flex items-center px-2 py-1.5 text-sm rounded-lg transition-all duration-200 font-medium group cursor-pointer ${isSelected
                ? 'text-white'
                : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
        >
            {isSelected && (
                <motion.div
                    layoutId="active-category"
                    className="absolute inset-0 bg-blue-600 rounded-lg shadow-md shadow-blue-600/20"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
            )}

            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className={`p-2 cursor-grab flex-shrink-0 mr-1 relative z-10 ${isSelected ? 'text-blue-200 hover:text-white' : 'text-neutral-300 hover:text-neutral-500'}`}
            >
                <LucideGripVertical size={16} />
            </div>

            {/* Content Area */}
            <div
                className="flex-1 flex justify-between items-center relative z-10"
            >
                <span className="truncate">{category.name}</span>
                <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                        {count}
                    </span>
                    <button
                        onClick={onDelete}
                        className={`p-1 rounded-md transition-opacity opacity-0 group-hover:opacity-100 ${isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-red-100 text-red-500'}`}
                        title="Delete Category"
                    >
                        <LucideTrash2 size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}

function SortableSubCategoryTab({
    subCategory,
    isSelected,
    onClick,
    onDelete
}: {
    subCategory: SubCategory;
    isSelected: boolean;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: subCategory.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as const,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onClick={onClick}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap border ${isSelected
                ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm'
                : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                }`}
        >
            <div {...attributes} {...listeners} className="cursor-grab text-neutral-300 hover:text-neutral-500 -ml-1">
                <LucideGripVertical size={14} />
            </div>
            <span>{subCategory.name}</span>
            {subCategory.name !== 'General' && (
                <button
                    onClick={onDelete}
                    className="p-1 text-neutral-400 hover:text-red-500 rounded-full hover:bg-red-50 transition-colors ml-1"
                    title="Delete Subcategory"
                >
                    <LucideTrash2 size={12} />
                </button>
            )}
        </div>
    );
}

function SortableMenuItemRow({
    item,
    onToggle,
    onEdit,
    onDelete
}: {
    item: MenuItem;
    onToggle: (id: number, status: boolean) => void;
    onEdit: (item: MenuItem) => void;
    onDelete: (id: number) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as const,
    };

    return (
        <tr ref={setNodeRef} style={style} className="hover:bg-neutral-50 transition-colors group bg-white">
            <td className="px-6 py-4 text-neutral-400 font-mono text-xs w-12">
                <div className="flex items-center gap-3">
                    <button
                        {...attributes}
                        {...listeners}
                        className="cursor-grab text-neutral-300 hover:text-neutral-500"
                    >
                        <LucideGripVertical size={16} />
                    </button>
                    #{item.id}
                </div>
            </td>
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="size-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 border border-gray-200">
                        {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <span className="text-xs">IMG</span>
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="font-bold text-neutral-900 text-base leading-tight">{item.name}</p>
                        <p className="text-xs text-neutral-500 mt-0.5 max-w-xs line-clamp-1">{item.description || 'No description'}</p>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 font-bold text-neutral-900">
                <div className="flex items-center">
                    <LucideIndianRupee size={12} className="mr-0.5" />
                    {item.price}
                </div>
            </td>
            <td className="px-6 py-4">
                {item.item_type === 'Veg' && (
                    <span className="inline-flex items-center px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-bold border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-600 mr-1.5"></span>
                        VEG
                    </span>
                )}
                {item.item_type === 'Non-Veg' && (
                    <span className="inline-flex items-center px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-bold border border-red-200">
                        <span className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-red-600 mr-1.5"></span>
                        NON-VEG
                    </span>
                )}
                {item.item_type === 'Egg' && (
                    <span className="inline-flex items-center px-2 py-1 rounded bg-yellow-50 text-yellow-700 text-xs font-bold border border-yellow-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-600 mr-1.5"></span>
                        EGG
                    </span>
                )}
                {/* Fallback for legacy data/null */}
                {!item.item_type && (
                    item.is_veg ? (
                        <span className="inline-flex items-center px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-bold border border-green-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-600 mr-1.5"></span>
                            VEG
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded bg-red-50 text-red-700 text-xs font-bold border border-red-200">
                            <span className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[6px] border-b-red-600 mr-1.5"></span>
                            NON-VEG
                        </span>
                    )
                )}
            </td>
            <td className="px-6 py-4">
                <button
                    onClick={() => onToggle(item.id, item.is_available)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${item.is_available ? 'bg-green-500' : 'bg-neutral-200'}`}
                >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${item.is_available ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="ml-2 text-xs font-medium text-neutral-500">{item.is_available ? 'In Stock' : 'Unavailable'}</span>
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                        title="Edit"
                    >
                        <LucideEdit2 size={18} />
                    </button>
                    <button
                        onClick={() => onDelete(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                        title="Delete"
                    >
                        <LucideTrash2 size={18} />
                    </button>
                </div>
            </td>
        </tr>
    );
}

// --- Main Component ---

export default function MenuManagement() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [items, setItems] = useState<MenuItem[]>([]);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | null>(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    const [showAddModal, setShowAddModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showSubCategoryModal, setShowSubCategoryModal] = useState(false);

    const [newCategoryName, setNewCategoryName] = useState('');
    const [newSubCategoryName, setNewSubCategoryName] = useState('');

    // DnD Sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);

    // Form State
    const [newItem, setNewItem] = useState({
        name: '',
        price: '',
        description: '',
        categoryId: '',
        subCategoryId: '',
        itemType: 'Veg', // Default
        preparationTime: '15',
        isAvailable: true
    });

    // Initial Data Fetch
    useEffect(() => {
        loadData();
    }, []);

    // Load subcategories when category changes
    useEffect(() => {
        if (selectedCategoryId) {
            loadSubCategories(selectedCategoryId);
        } else {
            setSubCategories([]);
            setSelectedSubCategoryId(null);
        }
    }, [selectedCategoryId]);

    const loadData = async () => {
        try {
            const [cats, menuItems] = await Promise.all([
                MenuService.fetchCategories(),
                MenuService.fetchMenuItems()
            ]);
            setCategories(cats);
            setItems(menuItems);
            if (cats.length > 0 && !selectedCategoryId) {
                setSelectedCategoryId(cats[0].id);
            }
        } catch (error) {
            console.error('Error loading menu data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSubCategories = async (categoryId: number) => {
        try {
            const subs = await MenuService.fetchSubCategories(categoryId);
            setSubCategories(subs);
            // Default to "All" (null)
            setSelectedSubCategoryId(null);
        } catch (error) {
            console.error('Error loading subcategories:', error);
        }
    };

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await MenuService.createCategory(newCategoryName);
            setShowCategoryModal(false);
            setNewCategoryName('');
            loadData();
        } catch (error) {
            console.error('Error adding category:', error);
            alert('Failed to add category');
        }
    };

    const handleAddSubCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCategoryId) return;

        try {
            await MenuService.createSubCategory(selectedCategoryId, newSubCategoryName);
            setShowSubCategoryModal(false);
            setNewSubCategoryName('');
            loadSubCategories(selectedCategoryId);
        } catch (error) {
            console.error('Error adding subcategory:', error);
            alert('Failed to add subcategory');
        }
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const itemPayload = {
                name: newItem.name,
                price: parseFloat(newItem.price),
                description: newItem.description,
                category_id: parseInt(newItem.categoryId),
                sub_category_id: newItem.subCategoryId ? parseInt(newItem.subCategoryId) : undefined,
                item_type: newItem.itemType as 'Veg' | 'Non-Veg' | 'Egg',
                // Fallback sync
                is_veg: newItem.itemType === 'Veg',
                is_available: newItem.isAvailable,
                preparation_time: parseInt(newItem.preparationTime) || 15,
            };

            if (isEditing && editingId) {
                await MenuService.updateMenuItem(editingId, itemPayload);
            } else {
                await MenuService.createMenuItem({
                    ...itemPayload,
                    category: undefined,
                    sub_category: undefined,
                });
            }

            setShowAddModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error('Error saving item:', error);
            alert('Failed to save item');
        }
    };

    const handleDeleteItem = (id: number) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Menu Item',
            message: 'Are you sure you want to delete this item? This action cannot be undone.',
            onConfirm: async () => {
                try {
                    await MenuService.deleteMenuItem(id);
                    setItems(items.filter(i => i.id !== id));
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    console.error('Error deleting item:', error);
                    alert('Failed to delete item');
                }
            }
        });
    };

    const handleDeleteSubCategory = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmModal({
            isOpen: true,
            title: 'Delete Subcategory',
            message: 'Are you sure? Items in this subcategory will become uncategorized within the main category.',
            onConfirm: async () => {
                try {
                    await MenuService.deleteSubCategory(id);
                    if (selectedCategoryId) loadSubCategories(selectedCategoryId);
                    // Reload items to update their references
                    loadData();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    console.error('Error deleting subcategory:', error);
                }
            }
        });
    };

    const handleEditItem = (item: MenuItem) => {
        setNewItem({
            name: item.name,
            price: item.price.toString(),
            description: item.description || '',
            categoryId: item.category_id.toString(),
            subCategoryId: item.sub_category_id?.toString() || '',
            itemType: item.item_type || (item.is_veg ? 'Veg' : 'Non-Veg'),
            preparationTime: (item.preparation_time || 15).toString(),
            isAvailable: item.is_available
        });
        setEditingId(item.id);
        setIsEditing(true);
        setShowAddModal(true);
    };

    const resetForm = () => {
        setNewItem({ name: '', price: '', description: '', categoryId: '', subCategoryId: '', itemType: 'Veg', preparationTime: '15', isAvailable: true });
        setIsEditing(false);
        setEditingId(null);
    };

    const openAddModal = () => {
        resetForm();
        setNewItem(prev => ({
            ...prev,
            categoryId: selectedCategoryId?.toString() || '',
            subCategoryId: selectedSubCategoryId?.toString() || ''
        }));
        setShowAddModal(true);
    };

    const toggleAvailability = async (id: number, currentStatus: boolean) => {
        // Optimistic update
        setItems(items.map(i => i.id === id ? { ...i, is_available: !currentStatus } : i));
        try {
            await MenuService.updateMenuItem(id, { is_available: !currentStatus });
        } catch (error) {
            console.error('Failed to update status', error);
            loadData(); // Revert on error
        }
    };

    // Filter items based on Category, Subcategory, and Search Query
    const filteredItems = items.filter((item) => {
        const matchesCategory = selectedCategoryId ? item.category_id === selectedCategoryId : true;

        const matchesSubCategory = searchQuery
            ? true
            : (selectedSubCategoryId ? item.sub_category_id === selectedSubCategoryId : true);

        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesCategory && matchesSubCategory && matchesSearch;
    });

    // Calculate category counts dynamically
    const categoryCounts = categories.reduce((acc, cat) => {
        acc[cat.id] = items.filter(i => i.category_id === cat.id).length;
        return acc;
    }, {} as Record<number, number>);

    const handleDeleteCategory = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();

        const count = categoryCounts[id] || 0;
        const message = count > 0
            ? `This category contains ${count} items. Deleting it will PERMANENTLY DELETE all ${count} items inside it. Are you sure you want to proceed?`
            : 'Are you sure you want to delete this category?';

        setConfirmModal({
            isOpen: true,
            title: count > 0 ? 'Delete Category & Items' : 'Delete Category',
            message: message,
            onConfirm: async () => {
                try {
                    await MenuService.deleteCategory(id);
                    const newCats = categories.filter(c => c.id !== id);
                    setCategories(newCats);
                    if (selectedCategoryId === id) {
                        setSelectedCategoryId(newCats.length > 0 ? newCats[0].id : null);
                    }
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    console.error('Error deleting category:', error);
                    alert('Failed to delete category');
                }
            }
        });
    };

    // --- Drag and Drop Handlers ---

    const handleDragEndCategory = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setCategories((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);

                // Persist new order
                const updates = newOrder.map((cat, index) => ({
                    ...cat,
                    sort_order: index
                }));
                MenuService.reorderCategories(updates).catch(console.error);

                return newOrder;
            });
        }
    };

    const handleDragEndSubCategory = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setSubCategories((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                const newOrder = arrayMove(items, oldIndex, newIndex);

                // Persist
                const updates = newOrder.map((sub, index) => ({
                    ...sub,
                    sort_order: index
                }));
                MenuService.reorderSubCategories(updates).catch(console.error);

                return newOrder;
            });
        }
    };

    const handleDragEndItem = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = filteredItems.findIndex(i => i.id === active.id);
            const newIndex = filteredItems.findIndex(i => i.id === over.id);
            const reorderedSubset = arrayMove(filteredItems, oldIndex, newIndex);

            const updates = reorderedSubset.map((item, index) => ({
                ...item,
                sort_order: index
            }));

            // Update Global State
            setItems(prevItems => {
                const updatedItems = prevItems.map(item => {
                    const newPos = updates.find(u => u.id === item.id);
                    if (newPos) {
                        return { ...item, sort_order: newPos.sort_order };
                    }
                    return item;
                });
                return updatedItems.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
            });

            MenuService.reorderMenuItems(updates).catch(console.error);
        }
    };

    return (
        <div className="flex h-full relative">
            {/* Categories Sidebar */}
            <div className="w-64 flex flex-col bg-white border-r border-neutral-200 overflow-hidden shrink-0">
                <div className="p-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
                    <h3 className="font-bold text-neutral-900">Categories</h3>
                    <button
                        onClick={() => setShowCategoryModal(true)}
                        className="p-1.5 hover:bg-neutral-200 rounded-md transition-colors text-blue-600"
                        title="Add Category"
                    >
                        <LucidePlus size={18} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
                    {loading ? (
                        <div className="text-center p-4 text-neutral-400 text-sm">Loading...</div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEndCategory}
                        >
                            <SortableContext
                                items={categories.map(c => c.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <LayoutGroup>
                                    <div className="space-y-0.5">
                                        {categories.map((cat) => (
                                            <SortableCategoryRow
                                                key={cat.id}
                                                category={cat}
                                                isSelected={selectedCategoryId === cat.id}
                                                count={categoryCounts[cat.id] || 0}
                                                onClick={() => setSelectedCategoryId(cat.id)}
                                                onDelete={(e) => handleDeleteCategory(cat.id, e)}
                                            />
                                        ))}
                                    </div>
                                </LayoutGroup>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
                {/* 1. Top Toolbar (Search & Add Item) */}
                <div className="p-6 border-b border-neutral-200 flex justify-between items-center bg-white">
                    <div className="relative">
                        <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-neutral-900 placeholder:text-neutral-400 transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={openAddModal}
                        className="flex items-center px-5 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-600/30 hover:-translate-y-0.5"
                    >
                        <LucidePlus size={18} className="mr-2" />
                        Add New Item
                    </button>
                </div>

                {/* 2. Subcategories Horizontal Bar */}
                {selectedCategoryId && (
                    <div className="px-6 py-3 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-3 overflow-x-auto no-scrollbar">
                        {/* All Button */}
                        <button
                            onClick={() => setSelectedSubCategoryId(null)}
                            className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap border ${selectedSubCategoryId === null
                                ? 'bg-neutral-800 text-white border-neutral-800 shadow-sm'
                                : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                                }`}
                        >
                            All
                        </button>

                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEndSubCategory}
                        >
                            <SortableContext
                                items={subCategories.map(s => s.id)}
                                strategy={horizontalListSortingStrategy}
                            >
                                {subCategories.map(sub => (
                                    <SortableSubCategoryTab
                                        key={sub.id}
                                        subCategory={sub}
                                        isSelected={selectedSubCategoryId === sub.id}
                                        onClick={() => setSelectedSubCategoryId(sub.id)}
                                        onDelete={(e) => handleDeleteSubCategory(sub.id, e)}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>

                        {/* Add Subcategory Button */}
                        <button
                            onClick={() => setShowSubCategoryModal(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-200 border-dashed"
                        >
                            <LucidePlus size={14} />
                            <span>New Subcategory</span>
                        </button>
                    </div>
                )}

                {/* 3. Items Table */}
                <div className="flex-1 overflow-y-auto">
                    {/* Disable sorting if searching or no subcategory context */}
                    {(searchQuery || filteredItems.length === 0) ? (
                        filteredItems.length === 0 ? (
                            <div className="text-center p-12 text-neutral-400">
                                <p>No items found.</p>
                                {selectedSubCategoryId && subCategories.length > 0 && <p className="text-xs mt-2">Try adding items to this subcategory.</p>}
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-neutral-50 text-neutral-900 font-bold border-b border-neutral-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 w-12">#</th>
                                        <th className="px-6 py-4">Item Details</th>
                                        <th className="px-6 py-4">Price</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Availability</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200 text-neutral-600">
                                    {filteredItems.map(item => (
                                        <tr key={item.id} className="hover:bg-neutral-50">
                                            <td className="px-6 py-4">#{item.id}</td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-neutral-900">{item.name}</p>
                                            </td>
                                            <td className="px-6 py-4">{item.price}</td>
                                            <td className="px-6 py-4">
                                                {item.item_type === 'Veg' && <span className="text-green-600 font-bold">VEG</span>}
                                                {item.item_type === 'Non-Veg' && <span className="text-red-600 font-bold">NON-VEG</span>}
                                                {item.item_type === 'Egg' && <span className="text-yellow-600 font-bold">EGG</span>}
                                                {!item.item_type && (item.is_veg ? 'Veg' : 'Non-Veg')}
                                            </td>
                                            <td className="px-6 py-4">{item.is_available ? 'In Stock' : 'Out'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleEditItem(item)}><LucideEdit2 size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEndItem}
                        >
                            <table className="w-full text-left text-sm">
                                <thead className="bg-neutral-50 text-neutral-900 font-bold border-b border-neutral-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 w-12">#</th>
                                        <th className="px-6 py-4">Item Details</th>
                                        <th className="px-6 py-4">Price</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Availability</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <SortableContext
                                    items={filteredItems.map(i => i.id)}
                                    strategy={verticalListSortingStrategy}
                                >
                                    <tbody className="divide-y divide-neutral-200 text-neutral-600">
                                        {filteredItems.map((item) => (
                                            <SortableMenuItemRow
                                                key={item.id}
                                                item={item}
                                                onToggle={toggleAvailability}
                                                onEdit={handleEditItem}
                                                onDelete={handleDeleteItem}
                                            />
                                        ))}
                                    </tbody>
                                </SortableContext>
                            </table>
                        </DndContext>
                    )}
                </div>
            </div>

            {/* Modals */}
            {/* Category Modal */}
            {showCategoryModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl transform transition-all scale-100">
                        <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-neutral-900">New Category</h2>
                            <button onClick={() => setShowCategoryModal(false)} className="text-neutral-400 hover:text-neutral-600 transition-colors">
                                <LucideX size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddCategory} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Category Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    placeholder="e.g., Desserts"
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5"
                                >
                                    Create Category
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SubCategory Modal */}
            {showSubCategoryModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl transform transition-all scale-100">
                        <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-neutral-900">New Subcategory</h2>
                            <button onClick={() => setShowSubCategoryModal(false)} className="text-neutral-400 hover:text-neutral-600 transition-colors">
                                <LucideX size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddSubCategory} className="p-6 space-y-4">
                            <div className="text-sm text-neutral-500">
                                Adding to: <span className="font-bold text-neutral-900">{categories.find(c => c.id === selectedCategoryId)?.name}</span>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Subcategory Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newSubCategoryName}
                                    onChange={(e) => setNewSubCategoryName(e.target.value)}
                                    className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    placeholder="e.g., Hot Drinks"
                                    autoFocus
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowSubCategoryModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5"
                                >
                                    Create Subcategory
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Item Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl transform transition-all scale-100">
                        <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-neutral-900">{isEditing ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
                            <button onClick={() => setShowAddModal(false)} className="text-neutral-400 hover:text-neutral-600 transition-colors">
                                <LucideX size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveItem} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Item Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newItem.name}
                                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                                    className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    placeholder="e.g., Butter Chicken"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">Price</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                                        <input
                                            type="number"
                                            required
                                            value={newItem.price}
                                            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                                            className="w-full pl-8 pr-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">Category</label>
                                    <select
                                        required
                                        value={newItem.categoryId}
                                        onChange={(e) => {
                                            const catId = e.target.value;
                                            setNewItem({ ...newItem, categoryId: catId, subCategoryId: '' });
                                            if (catId) loadSubCategories(parseInt(catId));
                                        }}
                                        className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                                {newItem.categoryId && (
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-neutral-700 mb-1">Subcategory</label>
                                        <select
                                            required
                                            value={newItem.subCategoryId}
                                            onChange={(e) => setNewItem({ ...newItem, subCategoryId: e.target.value })}
                                            className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        >
                                            <option value="">Select Subcategory</option>
                                            {subCategories.filter(s => s.category_id === parseInt(newItem.categoryId)).map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Description</label>
                                <textarea
                                    value={newItem.description}
                                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                    className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    rows={3}
                                    placeholder="Brief description of the item..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 mb-1">Preparation Time (mins)</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={newItem.preparationTime}
                                    onChange={(e) => setNewItem({ ...newItem, preparationTime: e.target.value })}
                                    className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    placeholder="15"
                                />
                            </div>
                            <div className="flex gap-6 items-center">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
                                    <div className="flex gap-4">
                                        {(['Veg', 'Non-Veg', 'Egg'] as const).map(type => (
                                            <label key={type} className="flex items-center cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="itemType"
                                                    value={type}
                                                    checked={newItem.itemType === type}
                                                    onChange={(e) => setNewItem({ ...newItem, itemType: e.target.value })}
                                                    className={`w-4 h-4 border-neutral-300 focus:ring-2 ${type === 'Veg' ? 'text-green-600 focus:ring-green-500' :
                                                        type === 'Non-Veg' ? 'text-red-600 focus:ring-red-500' :
                                                            'text-yellow-600 focus:ring-yellow-500'
                                                        }`}
                                                />
                                                <span className="ml-2 text-sm text-neutral-700">{type}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <label className="flex items-center cursor-pointer mt-5">
                                    <input
                                        type="checkbox"
                                        checked={newItem.isAvailable}
                                        onChange={(e) => setNewItem({ ...newItem, isAvailable: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-neutral-300 rounded"
                                    />
                                    <span className="ml-2 text-sm text-neutral-700">Available immediately</span>
                                </label>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5"
                                >
                                    {isEditing ? 'Save Changes' : 'Create Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
