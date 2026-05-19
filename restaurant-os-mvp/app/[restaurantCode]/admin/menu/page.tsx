'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus as LucidePlus, Edit2 as LucideEdit2, Trash2 as LucideTrash2, Search as LucideSearch, IndianRupee as LucideIndianRupee, X as LucideX, GripVertical as LucideGripVertical, GripHorizontal as LucideGripHorizontal, AlertTriangle as LucideAlertTriangle, Camera as LucideCamera, Image as LucideImage } from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import { MenuService, Category, MenuItem, SubCategory } from '@/app/services/menu';
import { InventoryService, InventoryItem, InventoryCategory } from '@/app/services/inventory.service';
import { RecipeService } from '@/app/services/recipe.service';
import { compressImage, validateImageFile, CompressResult } from '@/app/lib/image-compress';
import ConfirmationModal from '@/app/components/ui/ConfirmationModal';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';
import { useRestaurant } from '@/app/context/RestaurantContext';
import { getCached, setCache } from '@/app/lib/data-cache';
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

const getSubUnits = (baseUnit: string) => {
    if (!baseUnit) return [];
    const lowerUnit = baseUnit.toLowerCase();
    if (lowerUnit === 'kg' || lowerUnit === 'kilogram') return ['kg', 'g', 'mg'];
    if (lowerUnit === 'g' || lowerUnit === 'gram') return ['g', 'mg'];
    if (lowerUnit === 'l' || lowerUnit === 'liter' || lowerUnit === 'litre') return ['L', 'ml'];
    return [baseUnit];
};

const convertToBaseUnit = (amount: number, fromUnit: string, baseUnit: string) => {
    const lowerFrom = fromUnit.toLowerCase();
    const lowerBase = baseUnit.toLowerCase();
    if (lowerFrom === lowerBase) return amount;
    if ((lowerBase === 'kg' || lowerBase === 'kilogram')) {
        if (lowerFrom === 'g') return amount / 1000;
        if (lowerFrom === 'mg') return amount / 1000000;
    }
    if ((lowerBase === 'g' || lowerBase === 'gram')) {
        if (lowerFrom === 'mg') return amount / 1000;
    }
    if ((lowerBase === 'l' || lowerBase === 'liter' || lowerBase === 'litre')) {
        if (lowerFrom === 'ml') return amount / 1000;
    }
    return amount;
};

const DietaryIcon = ({ type }: { type?: string | boolean }) => {
    const t = type === 'Veg' || type === true ? 'Veg' : type === 'Non-Veg' ? 'Non-Veg' : type === 'Egg' ? 'Egg' : 'Other';
    if (t === 'Other') return <span className="w-4 h-4 rounded-sm border border-neutral-300 bg-neutral-100 flex-shrink-0"></span>;
    const colorMap = { 'Veg': 'text-emerald-600 border-emerald-600', 'Non-Veg': 'text-rose-600 border-rose-600', 'Egg': 'text-amber-500 border-amber-500' };
    return (
        <span className={`w-3.5 h-3.5 flex items-center justify-center border-2 rounded-sm flex-shrink-0 ${colorMap[t]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${t === 'Veg' ? 'bg-emerald-600' : t === 'Non-Veg' ? 'bg-rose-600' : 'bg-amber-500'}`}></span>
        </span>
    );
};

// --- Sortable Components ---

function SortableCategoryRow({
    category,
    isSelected,
    count,
    onClick,
    onDelete,
    onImageUpload
}: {
    category: Category;
    isSelected: boolean;
    count: number;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
    onImageUpload: (categoryId: number) => void;
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
            onClick={onClick}
            className={`w-full relative flex items-center px-2 py-2 text-sm rounded-lg transition-all duration-200 font-medium group cursor-pointer ${isSelected
                ? 'text-white'
                : 'text-black hover:bg-neutral-50 hover:text-black'
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
                className={`flex-shrink-0 cursor-grab relative z-10 mr-1.5 ${isSelected ? 'text-blue-200 hover:text-white' : 'text-black hover:text-black'}`}
            >
                <LucideGripVertical size={14} />
            </div>

            {/* Image Thumbnail */}
            <div
                onClick={(e) => { e.stopPropagation(); onImageUpload(category.id); }}
                className={`size-7 rounded-md overflow-hidden flex-shrink-0 mr-2 relative z-10 cursor-pointer group/img ${category.image_url ? '' : `border border-dashed ${isSelected ? 'border-white/40' : 'border-neutral-300'} flex items-center justify-center`}`}
            >
                {category.image_url ? (
                    <>
                        <img src={category.image_url} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                            <LucideCamera size={10} className="text-white" />
                        </div>
                    </>
                ) : (
                    <LucideCamera size={10} className={`${isSelected ? 'text-white/50' : 'text-black'}`} />
                )}
            </div>

            {/* Name */}
            <span className="flex-1 truncate relative z-10 text-[13px]">{category.name}</span>

            {/* Right Side: Count + Delete */}
            <div className="flex items-center gap-1.5 flex-shrink-0 relative z-10 ml-2">
                <span className={`text-[11px] font-semibold tabular-nums min-w-[24px] text-center px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-neutral-100 text-black'}`}>
                    {count}
                </span>
                <button
                    onClick={onDelete}
                    className={`p-1 rounded-md transition-opacity opacity-0 group-hover:opacity-100 ${isSelected ? 'hover:bg-white/20 text-white' : 'hover:bg-red-100 text-red-500'}`}
                    title="Delete Category"
                >
                    <LucideTrash2 size={13} />
                </button>
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
                : 'bg-white text-black border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
                }`}
        >
            <div {...attributes} {...listeners} className="cursor-grab text-black hover:text-black -ml-1">
                <LucideGripVertical size={14} />
            </div>
            <span>{subCategory.name}</span>
            {subCategory.name !== 'General' && (
                <button
                    onClick={onDelete}
                    className="p-1 text-black hover:text-red-500 rounded-full hover:bg-red-50 transition-colors ml-1"
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
            <td className="px-6 py-4 text-black font-mono text-xs w-12">
                <div className="flex items-center gap-3">
                    <button
                        {...attributes}
                        {...listeners}
                        className="cursor-grab text-black hover:text-black"
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
                            <div className="w-full h-full flex items-center justify-center text-black">
                                <span className="text-xs">IMG</span>
                            </div>
                        )}
                    </div>
                    <div>
                        <p className="font-bold text-black text-base leading-tight">{item.name}</p>
                        <p className="text-xs text-black mt-0.5 max-w-xs line-clamp-1">{item.description || 'No description'}</p>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 font-bold text-black">
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
                <span className="ml-2 text-xs font-medium text-black">{item.is_available ? 'In Stock' : 'Unavailable'}</span>
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
    // Initial Data Fetch
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const { businessType, featureFlags } = useRestaurant();
    const cached = getCached<any>(`menu-${restaurantId}`);
    const [categories, setCategories] = useState<Category[]>(cached?.categories || []);
    const [items, setItems] = useState<MenuItem[]>(cached?.items || []);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(cached?.selectedCategoryId || null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | null>(null);

    const [loading, setLoading] = useState(!cached);

    // Active Tab for Restaurant+Bar (Food vs Liquor)
    const [activeMenuTab, setActiveMenuTab] = useState<'food' | 'alcohol'>(
        businessType === 'bar' ? 'alcohol' : 'food'
    );

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
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        isAlert?: boolean;
        isSuperDestructive?: boolean;
        confirmText?: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    // Dropdown state for ingredients in Modal
    const [openIngredientDropIndex, setOpenIngredientDropIndex] = useState<number | null>(null);

    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [isVegMode, setIsVegMode] = useState(false); // Global Veg Mode
    const [searchQuery, setSearchQuery] = useState('');
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [inventoryCategories, setInventoryCategories] = useState<InventoryCategory[]>([]);

    // Image upload state
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [imageUploading, setImageUploading] = useState(false);
    const [imageCompressing, setImageCompressing] = useState(false);
    const [compressionStats, setCompressionStats] = useState<CompressResult | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const categoryImageInputRef = useRef<HTMLInputElement>(null);

    // Category image state
    const [categoryImageFile, setCategoryImageFile] = useState<File | null>(null);
    const [categoryImagePreview, setCategoryImagePreview] = useState<string | null>(null);
    const [uploadingCategoryId, setUploadingCategoryId] = useState<number | null>(null);

    // Form State
    const [newItem, setNewItem] = useState({
        name: '',
        price: '',
        description: '',
        categoryId: '',
        subCategoryId: '',
        itemType: 'Veg', // Default
        preparationTime: '15',
        taxPercent: '0',
        isAvailable: true,
        isPopular: false,
        active: true,
        rating: 4.5,
        menuItemType: 'food' as 'food' | 'alcohol',
        priceVariants: [] as Array<{ name: string; price: string }>,
        stockMl: '',
        ingredients: [] as Array<{ inventory_item_id: string; quantity_required: string; unit?: string }>
    });

    useEffect(() => {
        if (!restaurantLoading) {
            loadData();
        }
    }, [restaurantId, restaurantLoading]);

    // Load subcategories when category changes
    useEffect(() => {
        if (categories.length > 0) {
            const filtered = categories.filter(cat => {
                if (businessType === 'restaurant') return cat.category_type === 'food';
                if (businessType === 'bar') return cat.category_type === 'alcohol';
                return cat.category_type === activeMenuTab;
            });
            if (filtered.length > 0) {
                // If current selected category is not in the filtered list, select the first one
                if (!filtered.find(c => c.id === selectedCategoryId)) {
                    setSelectedCategoryId(filtered[0].id);
                }
            } else {
                setSelectedCategoryId(null);
            }
        }
    }, [activeMenuTab, businessType, categories]);

    useEffect(() => {
        if (selectedCategoryId) {
            loadSubCategories(selectedCategoryId);
        } else {
            setSubCategories([]);
            setSelectedSubCategoryId(null);
        }
    }, [selectedCategoryId]);

    const loadData = async () => {
        if (!restaurantId) return;
        try {
            const [cats, menuItems, invItems, invCats] = await Promise.all([
                MenuService.fetchCategories(restaurantId),
                MenuService.fetchMenuItems(restaurantId),
                InventoryService.fetchItems(restaurantId),
                InventoryService.fetchCategories(restaurantId)
            ]);
            setCategories(cats);
            setItems(menuItems);
            setInventoryItems(invItems);
            setInventoryCategories(invCats);
            if (cats.length > 0 && !selectedCategoryId) {
                setSelectedCategoryId(cats[0].id);
            }
            // Cache for instant display on next visit
            setCache(`menu-${restaurantId}`, {
                categories: cats,
                items: menuItems,
                selectedCategoryId: selectedCategoryId || (cats.length > 0 ? cats[0].id : null)
            });
        } catch (error) {
            console.error('Error loading menu data:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadSubCategories = async (categoryId: number) => {
        if (!restaurantId) return;
        try {
            const subs = await MenuService.fetchSubCategories(categoryId, restaurantId);
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
            let catImageUrl: string | undefined;
            if (categoryImageFile) {
                try {
                    const compressed = await compressImage(categoryImageFile);
                    catImageUrl = await MenuService.uploadMenuImage(compressed.file);
                } catch (imgErr) {
                    console.error('Category image upload failed:', imgErr);
                }
            }
            await MenuService.createCategory(newCategoryName, restaurantId!, catImageUrl, activeMenuTab);
            setShowCategoryModal(false);
            setNewCategoryName('');
            setCategoryImageFile(null);
            setCategoryImagePreview(null);
            loadData();
        } catch (error: any) {
            console.error('Error adding category:', error);
            const errMsg = error?.message || error?.details || JSON.stringify(error) || 'Unknown error';
            setConfirmModal({ isOpen: true, title: 'Error', message: `Failed to add category: ${errMsg}`, isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
        }
    };

    const handleCategoryImageUpload = (categoryId: number) => {
        setUploadingCategoryId(categoryId);
        categoryImageInputRef.current?.click();
    };

    const processCategoryImageUpload = async (file: File) => {
        if (!uploadingCategoryId) return;
        const validationError = validateImageFile(file);
        if (validationError) {
            setConfirmModal({ isOpen: true, title: 'Invalid Image', message: validationError, isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
            return;
        }
        try {
            const compressed = await compressImage(file);
            const imageUrl = await MenuService.uploadMenuImage(compressed.file, uploadingCategoryId);
            await MenuService.updateCategoryImage(uploadingCategoryId, restaurantId!, imageUrl);
            loadData();
        } catch (err) {
            console.error('Category image upload failed:', err);
            setConfirmModal({ isOpen: true, title: 'Error', message: 'Failed to upload category image', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
        } finally {
            setUploadingCategoryId(null);
        }
    };

    const handleAddSubCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCategoryId) return;

        try {
            await MenuService.createSubCategory(selectedCategoryId, newSubCategoryName, restaurantId!);
            setShowSubCategoryModal(false);
            setNewSubCategoryName('');
            loadSubCategories(selectedCategoryId);
        } catch (error) {
            console.error('Error adding subcategory:', error);
            setConfirmModal({ isOpen: true, title: 'Error', message: 'Failed to add subcategory', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
        }
    };

    const handleSaveItem = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Upload image if a new file was selected
            let uploadedImageUrl: string | undefined;
            if (imageFile) {
                setImageUploading(true);
                try {
                    uploadedImageUrl = await MenuService.uploadMenuImage(imageFile, editingId || undefined);
                } catch (uploadErr) {
                    console.error('Image upload failed:', uploadErr);
                    setConfirmModal({ isOpen: true, title: 'Warning', message: 'Image upload failed, but the item will be saved without image.', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
                } finally {
                    setImageUploading(false);
                }
            }

            const itemPayload: Record<string, any> = {
                name: newItem.name,
                price: parseFloat(newItem.price) || 0,
                description: newItem.description,
                category_id: parseInt(newItem.categoryId),
                sub_category_id: newItem.subCategoryId ? parseInt(newItem.subCategoryId) : undefined,
                item_type: newItem.itemType as 'Veg' | 'Non-Veg' | 'Egg',
                is_veg: newItem.itemType === 'Veg',
                is_available: newItem.isAvailable,
                is_popular: newItem.isPopular,
                active: newItem.active,
                rating: newItem.rating,
                preparation_time: parseInt(newItem.preparationTime) || 15,
                tax_percent: parseFloat(newItem.taxPercent) || 0,
                restaurant_id: restaurantId,
                menu_item_type: newItem.menuItemType,
                price_variants: newItem.menuItemType === 'alcohol' ? newItem.priceVariants.map(v => ({ name: v.name, price: parseFloat(v.price) })) : null,
                stock_ml: newItem.menuItemType === 'alcohol' ? parseFloat(newItem.stockMl) : null,
                image_url: uploadedImageUrl || (isEditing ? items.find(i => i.id === editingId)?.image_url : undefined)
            };

            const parsedIngredients = newItem.ingredients.map(ing => {
                const invItem = inventoryItems.find(i => i.id === ing.inventory_item_id);
                const quantity = parseFloat(ing.quantity_required) || 0;
                let convertedQty = quantity;
                if (invItem && ing.unit) {
                    convertedQty = convertToBaseUnit(quantity, ing.unit, invItem.unit);
                }

                return {
                    inventory_item_id: ing.inventory_item_id,
                    quantity_required: convertedQty,
                    unit: invItem?.unit || ing.unit
                };
            }).filter(ing => ing.quantity_required > 0 && ing.inventory_item_id);

            await MenuService.saveItemWithRecipe(
                { ...itemPayload, id: isEditing && editingId ? editingId : undefined },
                parsedIngredients
            );

            setShowAddModal(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error('Error saving item:', error);
            setConfirmModal({ isOpen: true, title: 'Error', message: 'Failed to save item', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
        }
    };

    const handleDeleteItem = (id: number) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Menu Item',
            message: 'Are you sure you want to delete this item? This action cannot be undone.',
            onConfirm: async () => {
                try {
                    await MenuService.deleteMenuItem(id, restaurantId!);
                    setItems(items.filter(i => i.id !== id));
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    console.error('Error deleting item:', error);
                    setConfirmModal({ isOpen: true, title: 'Error', message: 'Failed to delete item', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
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
                    await MenuService.deleteSubCategory(id, restaurantId!);
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

    const handleEditItem = async (item: MenuItem) => {
        // Fetch existing recipe mappings
        try {
            const mappings = await RecipeService.fetchMappingsForMenuItem(item.id, restaurantId!);
            setNewItem({
                name: item.name,
                price: item.price.toString(),
                description: item.description || '',
                categoryId: item.category_id.toString(),
                subCategoryId: item.sub_category_id?.toString() || '',
                itemType: item.item_type || (item.is_veg ? 'Veg' : 'Non-Veg'),
                preparationTime: (item.preparation_time || 15).toString(),
                taxPercent: (item.tax_percent || 0).toString(),
                isAvailable: item.is_available,
                isPopular: item.is_popular || false,
                active: item.active !== undefined ? item.active : true,
                rating: item.rating || 4.5,
                menuItemType: item.menu_item_type || 'food',
                priceVariants: (item.price_variants || []).map(v => ({ name: v.name, price: v.price.toString() })),
                stockMl: item.stock_ml?.toString() || '',
                ingredients: mappings.map(m => ({
                    inventory_item_id: m.inventory_item_id,
                    quantity_required: m.quantity_required.toString(),
                    unit: m.inventory_item?.unit || ''
                }))
            });
            // Load existing image
            setImagePreview(item.image_url || null);
            setImageFile(null);
            setEditingId(item.id);
            setIsEditing(true);
            setShowAddModal(true);
        } catch (err) {
            console.error("Failed to load recipe mapping for item", err);
            setConfirmModal({ isOpen: true, title: 'Error', message: 'Failed to load recipe mapping', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
        }
    };

    const resetForm = () => {
        setNewItem({
            name: '', price: '', description: '', categoryId: '', subCategoryId: '',
            itemType: 'Veg', preparationTime: '15', taxPercent: '0', 
            isAvailable: true, isPopular: false, active: true, rating: 4.5,
            menuItemType: 'food', priceVariants: [], stockMl: '',
            ingredients: []
        });
        setImageFile(null);
        setImagePreview(null);
        setCompressionStats(null);
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
            await MenuService.updateMenuItem(id, restaurantId!, { is_available: !currentStatus });
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

        const fallbackType = item.item_type || (item.is_veg ? 'Veg' : 'Non-Veg');
        const vegModeMatch = isVegMode ? fallbackType === 'Veg' : true;

        return matchesCategory && matchesSubCategory && matchesSearch && vegModeMatch;
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
                    await MenuService.deleteCategory(id, restaurantId!);
                    const newCats = categories.filter(c => c.id !== id);
                    setCategories(newCats);
                    if (selectedCategoryId === id) {
                        setSelectedCategoryId(newCats.length > 0 ? newCats[0].id : null);
                    }
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                } catch (error) {
                    console.error('Error deleting category:', error);
                    setConfirmModal({ isOpen: true, title: 'Error', message: 'Failed to delete category', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
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
                MenuService.reorderCategories(updates, restaurantId!).catch(console.error);

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
                MenuService.reorderSubCategories(updates, restaurantId!).catch(console.error);

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

            MenuService.reorderMenuItems(updates, restaurantId!).catch(console.error);
        }
    };

    return (
        <div className="flex h-screen relative bg-white overflow-hidden">
            {/* Categories Sidebar */}
            <div className="w-64 flex flex-col bg-white border-r border-neutral-200 overflow-hidden shrink-0">
                <div className="p-5 border-b border-neutral-200 flex flex-col gap-4 bg-neutral-50/50">
                    {businessType === 'restaurant_bar' && (
                        <div className="flex bg-neutral-200/50 p-1 rounded-xl">
                            <button
                                onClick={() => setActiveMenuTab('food')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeMenuTab === 'food' ? 'bg-white text-blue-600 shadow-sm' : 'text-black hover:text-black'}`}
                            >
                                Food
                            </button>
                            <button
                                onClick={() => setActiveMenuTab('alcohol')}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeMenuTab === 'alcohol' ? 'bg-white text-blue-600 shadow-sm' : 'text-black hover:text-black'}`}
                            >
                                Liquor
                            </button>
                        </div>
                    )}
                    <div className="flex justify-between items-center">
                        <h3 className="text-xs font-black uppercase tracking-widest text-black">
                            {businessType === 'restaurant_bar' ? (activeMenuTab === 'food' ? 'Food Categories' : 'Liquor Categories') : 'Categories'}
                        </h3>
                        <button
                            onClick={() => setShowCategoryModal(true)}
                            className="p-1.5 hover:bg-neutral-200 rounded-lg transition-colors text-blue-600"
                            title="Add Category"
                        >
                            <LucidePlus size={16} />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
                    {loading ? (
                        <div className="text-center p-4 text-black text-sm">Loading...</div>
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
                                        {categories
                                            .filter(cat => {
                                                if (businessType === 'restaurant') return cat.category_type === 'food';
                                                if (businessType === 'bar') return cat.category_type === 'alcohol';
                                                return cat.category_type === activeMenuTab;
                                            })
                                            .map((cat) => (
                                                <SortableCategoryRow
                                                    key={cat.id}
                                                    category={cat}
                                                    isSelected={selectedCategoryId === cat.id}
                                                    count={categoryCounts[cat.id] || 0}
                                                    onClick={() => setSelectedCategoryId(cat.id)}
                                                    onDelete={(e) => handleDeleteCategory(cat.id, e)}
                                                    onImageUpload={handleCategoryImageUpload}
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
                        <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-black" size={20} />
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder:text-black transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-200">
                            <span className={`text-[11px] font-bold uppercase tracking-wider transition-colors ${isVegMode ? 'text-green-600' : 'text-black'}`}>Veg Mode</span>
                            <button
                                onClick={() => setIsVegMode(!isVegMode)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 ${isVegMode ? 'bg-green-500' : 'bg-neutral-300'}`}
                            >
                                <span className={`inline-block size-4 transform rounded-full bg-white transition-transform duration-300 shadow-sm ${isVegMode ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                        <button
                            onClick={openAddModal}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 hover:-translate-y-0.5"
                        >
                            <LucidePlus size={16} className="mr-1.5" />
                            Add Item
                        </button>
                    </div>
                </div>

                {/* 2. Subcategories Horizontal Bar */}
                {selectedCategoryId && (
                    <div className="px-6 py-3 border-b border-neutral-100 bg-neutral-50/50 flex items-center gap-3 overflow-x-auto no-scrollbar">
                        {/* All Button */}
                        <button
                            onClick={() => setSelectedSubCategoryId(null)}
                            className={`flex items-center px-4 py-2 rounded-full text-sm font-medium transition-all cursor-pointer whitespace-nowrap border ${selectedSubCategoryId === null
                                ? 'bg-neutral-800 text-white border-neutral-800 shadow-sm'
                                : 'bg-white text-black border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50'
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
                            <div className="text-center p-12 text-black">
                                <p>No items found.</p>
                                {selectedSubCategoryId && subCategories.length > 0 && <p className="text-xs mt-2">Try adding items to this subcategory.</p>}
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm">
                                <thead className="bg-neutral-50 text-black font-bold border-b border-neutral-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-6 py-4 w-12">#</th>
                                        <th className="px-6 py-4">Item Details</th>
                                        <th className="px-6 py-4">Price</th>
                                        <th className="px-6 py-4">Type</th>
                                        <th className="px-6 py-4">Availability</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200 text-black">
                                    {filteredItems.map(item => (
                                        <tr key={item.id} className="hover:bg-neutral-50">
                                            <td className="px-6 py-4">#{item.id}</td>
                                            <td className="px-6 py-4">
                                                <p className="font-bold text-black">{item.name}</p>
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
                                <thead className="bg-neutral-50 text-black font-bold border-b border-neutral-200 sticky top-0 z-10">
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
                                    <tbody className="divide-y divide-neutral-200 text-black">
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
            {/* Hidden category image input */}
            <input
                ref={categoryImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processCategoryImageUpload(file);
                    e.target.value = '';
                }}
            />

            {showCategoryModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl transform transition-all scale-100">
                        <div className="p-6 border-b border-neutral-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-black">New Category</h2>
                            <button onClick={() => { setShowCategoryModal(false); setCategoryImageFile(null); setCategoryImagePreview(null); }} className="text-black hover:text-black transition-colors">
                                <LucideX size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddCategory} className="p-6 space-y-4">
                            {/* Category Image */}
                            <div>
                                <label className="block text-sm font-medium text-black mb-2">Category Image</label>
                                <div
                                    onClick={() => {
                                        const input = document.createElement('input');
                                        input.type = 'file';
                                        input.accept = 'image/jpeg,image/png,image/webp,image/gif';
                                        input.onchange = async (ev) => {
                                            const file = (ev.target as HTMLInputElement).files?.[0];
                                            if (file) {
                                                const validationError = validateImageFile(file);
                                                if (validationError) {
                                                    setConfirmModal({ isOpen: true, title: 'Invalid Image', message: validationError, isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
                                                    return;
                                                }
                                                try {
                                                    const result = await compressImage(file);
                                                    setCategoryImageFile(result.file);
                                                    setCategoryImagePreview(URL.createObjectURL(result.file));
                                                } catch {
                                                    setCategoryImageFile(file);
                                                    setCategoryImagePreview(URL.createObjectURL(file));
                                                }
                                            }
                                        };
                                        input.click();
                                    }}
                                    className="relative size-20 rounded-xl border-2 border-dashed border-neutral-300 hover:border-orange-400 flex items-center justify-center cursor-pointer transition-all overflow-hidden group bg-neutral-50 hover:bg-orange-50"
                                >
                                    {categoryImagePreview ? (
                                        <>
                                            <img src={categoryImagePreview} alt="Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <LucideCamera size={18} className="text-white" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1 text-black group-hover:text-orange-500 transition-colors">
                                            <LucideImage size={20} />
                                            <span className="text-[9px] font-medium">Add Photo</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-black mb-1">Category Name</label>
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
                                    className="px-4 py-2 text-sm font-medium text-black bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
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
                            <h2 className="text-xl font-bold text-black">New Subcategory</h2>
                            <button onClick={() => setShowSubCategoryModal(false)} className="text-black hover:text-black transition-colors">
                                <LucideX size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddSubCategory} className="p-6 space-y-4">
                            <div className="text-sm text-black">
                                Adding to: <span className="font-bold text-black">{categories.find(c => c.id === selectedCategoryId)?.name}</span>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-black mb-1">Subcategory Name</label>
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
                                    className="px-4 py-2 text-sm font-medium text-black bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
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
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl transform transition-all scale-100 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-neutral-100 flex justify-between items-center shrink-0">
                            <h2 className="text-xl font-bold text-black">{isEditing ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
                            <button onClick={() => setShowAddModal(false)} className="text-black hover:text-black transition-colors">
                                <LucideX size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveItem} className="p-6 space-y-4 overflow-y-auto">
                            {/* Image Upload Section */}
                            <div>
                                <label className="block text-sm font-medium text-black mb-2">Item Image</label>
                                <input
                                    ref={imageInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    className="hidden"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        // Validate file
                                        const validationError = validateImageFile(file);
                                        if (validationError) {
                                            setConfirmModal({ isOpen: true, title: 'Invalid Image', message: validationError, isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
                                            return;
                                        }

                                        // Compress the image
                                        setImageCompressing(true);
                                        try {
                                            const result = await compressImage(file);
                                            setImageFile(result.file);
                                            setImagePreview(URL.createObjectURL(result.file));
                                            setCompressionStats(result);
                                        } catch (err) {
                                            console.error('Compression failed, using original:', err);
                                            setImageFile(file);
                                            setImagePreview(URL.createObjectURL(file));
                                            setCompressionStats(null);
                                        } finally {
                                            setImageCompressing(false);
                                        }
                                    }}
                                />
                                <div className="flex items-center gap-4">
                                    <div
                                        onClick={() => imageInputRef.current?.click()}
                                        className="relative size-24 rounded-xl border-2 border-dashed border-neutral-300 hover:border-orange-400 flex items-center justify-center cursor-pointer transition-all overflow-hidden group bg-neutral-50 hover:bg-orange-50"
                                    >
                                        {imagePreview ? (
                                            <>
                                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <LucideCamera size={20} className="text-white" />
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center gap-1 text-black group-hover:text-orange-500 transition-colors">
                                                <LucideImage size={24} />
                                                <span className="text-[10px] font-medium">Add Photo</span>
                                            </div>
                                        )}
                                    </div>
                                    {imagePreview && (
                                        <div className="flex flex-col gap-2">
                                            <button
                                                type="button"
                                                onClick={() => imageInputRef.current?.click()}
                                                className="text-xs font-medium text-blue-600 hover:text-blue-700"
                                            >
                                                Change Image
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setImageFile(null); setImagePreview(null); }}
                                                className="text-xs font-medium text-red-500 hover:text-red-600"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {imageUploading && (
                                    <p className="text-xs text-orange-500 mt-2 animate-pulse">Uploading image...</p>
                                )}
                                {imageCompressing && (
                                    <p className="text-xs text-blue-500 mt-2 animate-pulse">Compressing image...</p>
                                )}
                                {compressionStats && !imageCompressing && compressionStats.compressionRatio > 1 && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 border border-green-200 text-[10px] font-bold text-green-700">
                                            ✓ {(compressionStats.originalSize / 1024).toFixed(0)}KB → {(compressionStats.compressedSize / 1024).toFixed(0)}KB
                                            <span className="text-green-500">({compressionStats.compressionRatio}x smaller)</span>
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Item Type Toggle (Only for Restaurant+Bar) */}
                            {businessType === 'restaurant_bar' && (
                                <div className="flex bg-neutral-100 p-1 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={() => setNewItem({ ...newItem, menuItemType: 'food', categoryId: '', subCategoryId: '' })}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${newItem.menuItemType === 'food' ? 'bg-white text-blue-600 shadow-sm' : 'text-black'}`}
                                    >
                                        Food Item
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewItem({ ...newItem, menuItemType: 'alcohol', categoryId: '', subCategoryId: '' })}
                                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${newItem.menuItemType === 'alcohol' ? 'bg-white text-blue-600 shadow-sm' : 'text-black'}`}
                                    >
                                        Liquor / Bar
                                    </button>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-black mb-1">Item Name</label>
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
                                {newItem.menuItemType === 'food' ? (
                                    <div>
                                        <label className="block text-sm font-medium text-black mb-1">Price</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black">₹</span>
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
                                ) : (
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-black mb-2">Peg / Volume Pricing</label>
                                        <div className="space-y-3">
                                            {newItem.priceVariants.map((variant, vIdx) => (
                                                <div key={vIdx} className="flex gap-2 items-center">
                                                    <input
                                                        type="text"
                                                        placeholder="e.g., 30ml, 60ml, Bottle"
                                                        value={variant.name}
                                                        onChange={(e) => {
                                                            const newVariants = [...newItem.priceVariants];
                                                            newVariants[vIdx].name = e.target.value;
                                                            setNewItem({ ...newItem, priceVariants: newVariants });
                                                        }}
                                                        className="flex-1 px-3 py-1.5 text-sm border border-neutral-200 rounded-lg outline-none focus:border-blue-500"
                                                    />
                                                    <div className="relative w-32">
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-black text-xs">₹</span>
                                                        <input
                                                            type="number"
                                                            placeholder="Price"
                                                            value={variant.price}
                                                            onChange={(e) => {
                                                                const newVariants = [...newItem.priceVariants];
                                                                newVariants[vIdx].price = e.target.value;
                                                                setNewItem({ ...newItem, priceVariants: newVariants });
                                                            }}
                                                            className="w-full pl-6 pr-3 py-1.5 text-sm border border-neutral-200 rounded-lg outline-none focus:border-blue-500"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newVariants = newItem.priceVariants.filter((_, i) => i !== vIdx);
                                                            setNewItem({ ...newItem, priceVariants: newVariants });
                                                        }}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                                    >
                                                        <LucideTrash2 size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => setNewItem({ ...newItem, priceVariants: [...newItem.priceVariants, { name: '', price: '' }] })}
                                                className="text-xs text-blue-600 font-bold flex items-center gap-1 hover:text-blue-700"
                                            >
                                                <LucidePlus size={14} /> Add Variant (Peg/Bottle)
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Tax / GST (%)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={newItem.taxPercent}
                                            onChange={(e) => setNewItem({ ...newItem, taxPercent: e.target.value })}
                                            className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                            placeholder="5"
                                        />
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-black">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Category</label>
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
                                        {categories
                                            .filter(c => {
                                                // Only show categories matching the item type being added
                                                return c.category_type === newItem.menuItemType;
                                            })
                                            .map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                    </select>
                                </div>
                                {newItem.categoryId && (
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-black mb-1">Subcategory</label>
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
                                <label className="block text-sm font-medium text-black mb-1">Description</label>
                                <textarea
                                    value={newItem.description}
                                    onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                    className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    rows={3}
                                    placeholder="Brief description of the item..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Preparation Time (mins)</label>
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
                                {newItem.menuItemType === 'alcohol' && (
                                    <div>
                                        <label className="block text-sm font-medium text-black mb-1">Stock in ML (Total)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={newItem.stockMl}
                                                onChange={(e) => setNewItem({ ...newItem, stockMl: e.target.value })}
                                                className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                placeholder="750"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-black text-xs">ml</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-x-6 gap-y-3 items-center">
                                <div>
                                    <label className="block text-sm font-medium text-black mb-1">Type</label>
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
                                                <span className="ml-2 text-sm text-black">{type}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-x-6 gap-y-3 pt-5">
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newItem.isAvailable}
                                            onChange={(e) => setNewItem({ ...newItem, isAvailable: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-neutral-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-black">In Stock</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newItem.isPopular}
                                            onChange={(e) => setNewItem({ ...newItem, isPopular: e.target.checked })}
                                            className="w-4 h-4 text-orange-500 focus:ring-orange-500 border-neutral-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-black">Popular</span>
                                    </label>
                                    <label className="flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newItem.active}
                                            onChange={(e) => setNewItem({ ...newItem, active: e.target.checked })}
                                            className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 border-neutral-300 rounded"
                                        />
                                        <span className="ml-2 text-sm text-black">Active</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium text-black">Rating:</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="5"
                                            value={newItem.rating}
                                            onChange={(e) => setNewItem({ ...newItem, rating: parseFloat(e.target.value) || 0 })}
                                            className="w-16 px-2 py-1 border border-neutral-200 rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* RECIPE MAPPING CONFIGURATION */}
                            <div className="border-t border-neutral-200 pt-4 mt-4">
                                <h3 className="text-sm font-bold text-black mb-3">Ingredients & Recipe Configuration</h3>

                                {(() => {
                                    const cost = newItem.ingredients.reduce((sum, ing) => {
                                        const invItem = inventoryItems.find(i => i.id === ing.inventory_item_id);
                                        const quantity = parseFloat(ing.quantity_required) || 0;
                                        let convertedQty = quantity;
                                        if (invItem && ing.unit) {
                                            convertedQty = convertToBaseUnit(quantity, ing.unit, invItem.unit);
                                        }
                                        return sum + ((invItem?.cost_per_unit || 0) * convertedQty);
                                    }, 0);
                                    const price = parseFloat(newItem.price) || 0;
                                    const margin = price > 0 ? (((price - cost) / price) * 100).toFixed(1) : '0.0';

                                    return (
                                        <div className="mb-4 flex gap-4 p-3 bg-neutral-50 rounded-lg border border-neutral-100">
                                            <div><span className="text-xs text-black">Food Cost:</span> <span className="font-medium">₹{cost.toFixed(2)}</span></div>
                                            <div><span className="text-xs text-black">Profit Margin:</span> <span className={`font-medium ${parseFloat(margin) < 30 ? 'text-red-500' : 'text-green-600'}`}>{margin}%</span></div>
                                            {parseFloat(margin) < 30 && price > 0 && <div className="text-xs text-red-500 flex items-center ml-auto"><LucideAlertTriangle size={14} className="mr-1" /> Low Margin</div>}
                                        </div>
                                    );
                                })()}

                                {newItem.ingredients.map((ing, index) => (
                                    <div key={index} className="flex gap-2 items-center mb-2">
                                        <div className="relative flex-1">
                                            <button
                                                type="button"
                                                onClick={() => setOpenIngredientDropIndex(openIngredientDropIndex === index ? null : index)}
                                                className="w-full flex items-center justify-between px-3 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-blue-500 bg-white"
                                            >
                                                {ing.inventory_item_id ? (
                                                    <span className="flex items-center gap-2 truncate">
                                                        <DietaryIcon type={inventoryItems.find(i => i.id === ing.inventory_item_id)?.item_type} />
                                                        {inventoryItems.find(i => i.id === ing.inventory_item_id)?.name}
                                                    </span>
                                                ) : (
                                                    <span className="text-black">Select Ingredient</span>
                                                )}
                                                <svg className={`shrink-0 w-4 h-4 text-black transition-transform ${openIngredientDropIndex === index ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                            </button>

                                            {openIngredientDropIndex === index && (
                                                <div className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto left-0 right-0">
                                                    {(() => {
                                                        const grouped = inventoryItems.reduce((acc, item) => {
                                                            const cat = inventoryCategories.find(c => c.id === item.category_id)?.name || item.category || 'Uncategorized';
                                                            if (!acc[cat]) acc[cat] = [];
                                                            acc[cat].push(item);
                                                            return acc;
                                                        }, {} as Record<string, InventoryItem[]>);

                                                        if (inventoryItems.length === 0) {
                                                            return <div className="p-3 text-sm text-black text-center">No ingredients found</div>;
                                                        }

                                                        return Object.entries(grouped).map(([cat, items]) => (
                                                            <div key={cat}>
                                                                <div className="px-3 py-1.5 text-xs font-bold text-black bg-neutral-50 border-y border-neutral-100 uppercase tracking-wider sticky top-0">{cat}</div>
                                                                {items.map(inv => (
                                                                    <button
                                                                        key={inv.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const newIngs = [...newItem.ingredients];
                                                                            newIngs[index].inventory_item_id = inv.id;
                                                                            newIngs[index].unit = inv.unit;
                                                                            setNewItem({ ...newItem, ingredients: newIngs });
                                                                            setOpenIngredientDropIndex(null);
                                                                        }}
                                                                        className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-blue-50 transition-colors ${ing.inventory_item_id === inv.id ? 'bg-blue-50/50' : ''}`}
                                                                    >
                                                                        <DietaryIcon type={inv.item_type} />
                                                                        <span className="truncate">{inv.name}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="w-28 relative">
                                            <input
                                                type="number"
                                                placeholder="Qty"
                                                step="0.01"
                                                value={ing.quantity_required}
                                                onChange={(e) => {
                                                    const newIngs = [...newItem.ingredients];
                                                    newIngs[index].quantity_required = e.target.value;
                                                    setNewItem({ ...newItem, ingredients: newIngs });
                                                }}
                                                className="w-full pl-2 pr-12 py-2 text-sm border border-neutral-200 rounded-lg outline-none focus:border-blue-500"
                                            />
                                            {ing.inventory_item_id && (
                                                <select
                                                    value={ing.unit || inventoryItems.find(i => i.id === ing.inventory_item_id)?.unit || ''}
                                                    onChange={e => {
                                                        const newIngs = [...newItem.ingredients];
                                                        newIngs[index].unit = e.target.value;
                                                        setNewItem({ ...newItem, ingredients: newIngs });
                                                    }}
                                                    className="absolute right-1 top-1 bottom-1 bg-transparent text-xs text-black border-none focus:ring-0 outline-none cursor-pointer pr-4 appearance-none hover:bg-neutral-50 rounded"
                                                    style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', backgroundSize: '8px auto', paddingRight: '16px', paddingLeft: '4px' }}
                                                >
                                                    {getSubUnits(inventoryItems.find(i => i.id === ing.inventory_item_id)?.unit || '').map(u => (
                                                        <option key={u} value={u}>{u}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                        <button type="button" onClick={() => {
                                            const newIngs = newItem.ingredients.filter((_, i) => i !== index);
                                            setNewItem({ ...newItem, ingredients: newIngs });
                                        }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                            <LucideTrash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => setNewItem({ ...newItem, ingredients: [...newItem.ingredients, { inventory_item_id: '', quantity_required: '', unit: '' }] })} className="mt-2 text-sm flex items-center text-blue-600 hover:text-blue-700 transition-colors">
                                    <LucidePlus size={16} className="mr-1" /> Add Ingredient
                                </button>
                            </div>
                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-black bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors"
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
                isAlert={confirmModal.isAlert}
                isSuperDestructive={confirmModal.isSuperDestructive}
                confirmText={confirmModal.confirmText}
                onConfirm={confirmModal.onConfirm}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
