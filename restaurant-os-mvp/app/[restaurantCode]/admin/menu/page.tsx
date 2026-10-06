'use client';

import { useState, useEffect, useRef } from 'react';
import { 
    Plus as LucidePlus, 
    Edit2 as LucideEdit2, 
    Trash2 as LucideTrash2, 
    Search as LucideSearch, 
    IndianRupee as LucideIndianRupee, 
    X as LucideX, 
    GripVertical as LucideGripVertical, 
    GripHorizontal as LucideGripHorizontal, 
    AlertTriangle as LucideAlertTriangle, 
    Camera as LucideCamera, 
    Image as LucideImage, 
    Flame as LucideFlame,
    Sparkles as LucideSparkles,
    Tag as LucideTag,
    Package as LucidePackage,
    Calendar as LucideCalendar,
    Percent as LucidePercent,
    ToggleLeft as LucideToggleLeft,
    ToggleRight as LucideToggleRight,
    Loader2 as LucideLoader2,
    Upload as LucideUpload,
    Layers as LucideLayers
} from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import { toast } from 'sonner';
import { MenuService, Category, MenuItem, SubCategory } from '@/services/menu.service';
import { SpecialsService, TodaySpecial, CreateSpecialInput } from '@/services/specials.service';
import { RestaurantService } from '@/services/restaurant.service';
import { InventoryService, InventoryItem, InventoryCategory } from '@/services/inventory.service';
import { RecipeService } from '@/services/recipe.service';
import { compressImage, validateImageFile, CompressResult } from '@/lib/image-compress';
import ConfirmationModal from '@/components/ui/ConfirmationModal';
import { useRestaurantId } from '@/hooks/useRestaurantId';
import { useRestaurant } from '@/context/RestaurantContext';
import { getCached, setCache, clearCache, hasFreshCache, adminCacheManager } from '@/lib/data-cache';
import { useParams } from 'next/navigation';
import { SyncIndicator } from '@/components/admin/SyncIndicator';
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
        transform: CSS.Translate.toString(transform),
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
                <div
                    className="absolute inset-0 bg-blue-600 rounded-lg shadow-md shadow-blue-600/20 transition-all duration-150"
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
        transform: CSS.Translate.toString(transform),
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
        transform: CSS.Translate.toString(transform),
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
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-black text-base leading-tight">{item.name}</p>
                            {item.is_today_special && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase">
                                    <LucideFlame size={10} className="text-amber-600 fill-amber-500" />
                                    Special
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-black mt-0.5 max-w-xs line-clamp-1">{item.description || 'No description'}</p>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 font-bold text-black">
                {item.is_today_special && item.special_price != null ? (
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-emerald-600 font-black flex items-center">
                                <LucideIndianRupee size={12} className="mr-0.5" />
                                {item.special_price}
                            </span>
                            <span className="text-slate-400 line-through text-xs font-semibold flex items-center">
                                <LucideIndianRupee size={10} className="mr-0.2" />
                                {item.price}
                            </span>
                        </div>
                        {item.special_expiry_datetime && (
                            <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
                                Exp: {new Date(item.special_expiry_datetime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center">
                        <LucideIndianRupee size={12} className="mr-0.5" />
                        {item.price}
                    </div>
                )}
                <div className="text-[11px] font-semibold text-slate-500 mt-1">
                    GST {item.gst_percentage ?? item.tax_percent ?? 5}%
                    <span className="text-[10px] text-slate-400 font-normal block">
                        (CGST {item.cgst_percentage ?? (((item.gst_percentage ?? item.tax_percent ?? 5)) / 2)}% + SGST {item.sgst_percentage ?? (((item.gst_percentage ?? item.tax_percent ?? 5)) / 2)}%)
                    </span>
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
    const params = useParams();
    const urlRestaurantCode = (params?.restaurantCode as string) || '';
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const { businessType, featureFlags } = useRestaurant();
    const activeResId = restaurantId || urlRestaurantCode;
    const cacheKey = `menu-${activeResId}`;
    const cached = getCached<any>(cacheKey) || (urlRestaurantCode ? getCached<any>(`menu-${urlRestaurantCode}`) : null);
    const [categories, setCategories] = useState<Category[]>(cached?.categories || []);
    const [items, setItems] = useState<MenuItem[]>(cached?.items || []);
    const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
    const [specials, setSpecials] = useState<TodaySpecial[]>(cached?.specials || []);

    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(cached?.selectedCategoryId || null);
    const [selectedSubCategoryId, setSelectedSubCategoryId] = useState<number | null>(null);
    const [selectedSpecialView, setSelectedSpecialView] = useState<'combos' | 'specials' | null>(null);
    const [specialStatusFilter, setSpecialStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    // Special / Combo Modal State
    const [showSpecialModal, setShowSpecialModal] = useState(false);
    const [specialModalType, setSpecialModalType] = useState<'combo' | 'special'>('combo');
    const [editingSpecial, setEditingSpecial] = useState<TodaySpecial | null>(null);
    const [specialFormTitle, setSpecialFormTitle] = useState('');
    const [specialFormDesc, setSpecialFormDesc] = useState('');
    const [specialFormPrice, setSpecialFormPrice] = useState('');
    const [specialFormValidTo, setSpecialFormValidTo] = useState('');
    const [specialFormImageUrl, setSpecialFormImageUrl] = useState('');
    const [specialFormItems, setSpecialFormItems] = useState<Array<{ menu_item_id: number; quantity: number; name: string; price: number }>>([]);
    const [specialItemSearch, setSpecialItemSearch] = useState('');
    const [showSpecialItemDropdown, setShowSpecialItemDropdown] = useState(false);
    const [isSavingSpecial, setIsSavingSpecial] = useState(false);
    const [isUploadingSpecialImage, setIsUploadingSpecialImage] = useState(false);
    const specialImageInputRef = useRef<HTMLInputElement>(null);

    // Special category images state
    const [specialCategoryImages, setSpecialCategoryImages] = useState<{ combos?: string; specials?: string }>({});
    const [uploadingSpecialCatType, setUploadingSpecialCatType] = useState<'combos' | 'specials' | null>(null);
    const specialCatImageInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(!cached && items.length === 0);
    const [isRevalidating, setIsRevalidating] = useState(false);

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

    const [restaurantGst, setRestaurantGst] = useState<{ gst: number; cgst: number; sgst: number }>({ gst: 5, cgst: 2.5, sgst: 2.5 });

    // Form State
    const [newItem, setNewItem] = useState({
        name: '',
        price: '',
        description: '',
        categoryId: '',
        subCategoryId: '',
        itemType: 'Veg', // Default
        preparationTime: '15',
        taxPercent: '5',
        gstPercentage: '5',
        cgstPercentage: '2.5',
        sgstPercentage: '2.5',
        isAvailable: true,
        isPopular: false,
        active: true,
        rating: 4.5,
        menuItemType: 'food' as 'food' | 'alcohol',
        priceVariants: [] as Array<{ name: string; price: string }>,
        stockMl: '',
        ingredients: [] as Array<{ inventory_item_id: string; quantity_required: string; unit?: string }>,
        is_today_special: false,
        special_price: '',
        special_expiry_datetime: ''
    });

    useEffect(() => {
        if (!restaurantLoading) {
            loadData(false);
        }
    }, [restaurantId, restaurantLoading]);

    const displayCategories = categories.filter(cat => {
        if (businessType === 'restaurant') return cat.category_type === 'food';
        if (businessType === 'bar') return cat.category_type === 'alcohol';
        return cat.category_type === activeMenuTab;
    });

    // Sync selected category when category list changes
    useEffect(() => {
        if (selectedSpecialView) return;
        if (displayCategories.length > 0) {
            if (!selectedCategoryId || !displayCategories.some(c => c.id === selectedCategoryId)) {
                setSelectedCategoryId(displayCategories[0].id);
            }
        } else {
            setSelectedCategoryId(null);
        }
    }, [categories, activeMenuTab, businessType, selectedSpecialView]);

    useEffect(() => {
        if (selectedCategoryId) {
            loadSubCategories(selectedCategoryId);
        } else {
            setSubCategories([]);
            setSelectedSubCategoryId(null);
        }
    }, [selectedCategoryId]);

    const loadData = async (force = false) => {
        const targetResId = restaurantId || urlRestaurantCode;
        if (!targetResId) return;
        const menuCacheKey = `menu-${targetResId}`;

        if (!force && hasFreshCache(menuCacheKey)) {
            const cachedData = getCached<any>(menuCacheKey);
            if (cachedData) {
                if (cachedData.categories) setCategories(cachedData.categories);
                if (cachedData.items) setItems(cachedData.items);
                if (cachedData.specials) setSpecials(cachedData.specials);
                if (cachedData.specialCategoryImages) setSpecialCategoryImages(cachedData.specialCategoryImages);
                if (cachedData.selectedCategoryId && !selectedCategoryId && !selectedSpecialView) {
                    setSelectedCategoryId(cachedData.selectedCategoryId);
                }
                setLoading(false);
                return;
            }
        }

        setIsRevalidating(true);
        try {
            const [cats, menuItems, invItems, invCats, gstConfig, allSpecials, specialCatImgs] = await Promise.all([
                MenuService.fetchCategories(targetResId),
                MenuService.fetchMenuItems(targetResId),
                InventoryService.fetchItems(targetResId),
                InventoryService.fetchCategories(targetResId),
                RestaurantService.getGstSettings(targetResId),
                SpecialsService.fetchAllSpecials(targetResId),
                SpecialsService.getSpecialCategoryImages(targetResId)
            ]);
            setCategories(cats);
            setItems(menuItems);
            setInventoryItems(invItems);
            setInventoryCategories(invCats);
            setSpecials(allSpecials || []);
            if (specialCatImgs) {
                setSpecialCategoryImages(specialCatImgs);
            }
            if (gstConfig) {
                setRestaurantGst({
                    gst: gstConfig.gst_percentage,
                    cgst: gstConfig.cgst_percentage,
                    sgst: gstConfig.sgst_percentage
                });
            }
            if (cats.length > 0 && !selectedCategoryId && !selectedSpecialView) {
                setSelectedCategoryId(cats[0].id);
            }
            // Cache for instant display on next visit
            const payload = {
                categories: cats,
                items: menuItems,
                inventoryItems: invItems,
                inventoryCategories: invCats,
                specials: allSpecials || [],
                specialCategoryImages: specialCatImgs || {},
                selectedCategoryId: selectedCategoryId || (cats.length > 0 ? cats[0].id : null)
            };
            setCache(menuCacheKey, payload);
            if (restaurantId && urlRestaurantCode && restaurantId !== urlRestaurantCode) {
                setCache(`menu-${restaurantId}`, payload);
                setCache(`menu-${urlRestaurantCode}`, payload);
            }
        } catch (error) {
            console.error('Error loading menu data:', error);
        } finally {
            setLoading(false);
            setIsRevalidating(false);
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
                    catImageUrl = await MenuService.uploadMenuImage(compressed.file, undefined, restaurantId || undefined);
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
            const errMsg = error?.message || error?.details || error?.hint || (error instanceof Error ? error.message : (typeof error === 'object' && Object.keys(error).length > 0 ? JSON.stringify(error) : String(error))) || 'Unknown error';
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
            const imageUrl = await MenuService.uploadMenuImage(compressed.file, uploadingCategoryId, restaurantId || undefined);
            await MenuService.updateCategoryImage(uploadingCategoryId, restaurantId!, imageUrl);
            loadData();
        } catch (err) {
            console.error('Category image upload failed:', err);
            setConfirmModal({ isOpen: true, title: 'Error', message: 'Failed to upload category image', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
        } finally {
            setUploadingCategoryId(null);
        }
    };

    const triggerSpecialCategoryUpload = (type: 'combos' | 'specials') => {
        setUploadingSpecialCatType(type);
        specialCatImageInputRef.current?.click();
    };

    const processSpecialCategoryImageUpload = async (file: File) => {
        if (!uploadingSpecialCatType) return;
        const type = uploadingSpecialCatType;
        const validationError = validateImageFile(file);
        if (validationError) {
            setConfirmModal({
                isOpen: true,
                title: 'Invalid Image',
                message: validationError,
                isAlert: true,
                isSuperDestructive: false,
                confirmText: 'OK',
                onConfirm: () => { }
            });
            return;
        }

        try {
            toast.loading(`Uploading ${type === 'combos' ? 'Combos & Offers' : "Today's Specials"} category image...`, { id: 'special-cat-upload' });
            const compressed = await compressImage(file);
            const imageUrl = await MenuService.uploadMenuImage(compressed.file, undefined, restaurantId || undefined);
            const success = await SpecialsService.updateSpecialCategoryImage(restaurantId!, type, imageUrl);
            if (success) {
                setSpecialCategoryImages(prev => ({ ...prev, [type]: imageUrl }));
                toast.success(`${type === 'combos' ? 'Combos & Offers' : "Today's Specials"} category image updated!`, { id: 'special-cat-upload' });
                loadData(true);
            } else {
                throw new Error('Failed to update category image in database');
            }
        } catch (err: any) {
            console.error('Special category image upload failed:', err);
            toast.error(`Failed to upload ${type} category image: ${err?.message || 'Unknown error'}`, { id: 'special-cat-upload' });
        } finally {
            setUploadingSpecialCatType(null);
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

        if (!newItem.name.trim()) {
            setConfirmModal({ isOpen: true, title: 'Validation Error', message: 'Item name is required', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
            return;
        }
        if (!newItem.categoryId) {
            setConfirmModal({ isOpen: true, title: 'Validation Error', message: 'Please select a category for this item', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
            return;
        }
        if (!restaurantId) {
            setConfirmModal({ isOpen: true, title: 'Error', message: 'Restaurant ID not found', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
            return;
        }

        try {
            // Upload image if a new file was selected
            let uploadedImageUrl: string | undefined;
            if (imageFile) {
                setImageUploading(true);
                try {
                    uploadedImageUrl = await MenuService.uploadMenuImage(imageFile, editingId || undefined, restaurantId || undefined);
                } catch (uploadErr) {
                    console.error('Image upload failed:', uploadErr);
                    setConfirmModal({ isOpen: true, title: 'Warning', message: 'Image upload failed, but the item will be saved without image.', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
                } finally {
                    setImageUploading(false);
                }
            }

            const parsedCatId = parseInt(newItem.categoryId);
            const parsedSubCatId = newItem.subCategoryId ? parseInt(newItem.subCategoryId) : undefined;

            const itemPayload: Record<string, any> = {
                name: newItem.name.trim(),
                price: parseFloat(newItem.price) || 0,
                description: newItem.description?.trim() || null,
                category_id: parsedCatId,
                sub_category_id: parsedSubCatId && !isNaN(parsedSubCatId) ? parsedSubCatId : null,
                item_type: newItem.itemType as 'Veg' | 'Non-Veg' | 'Egg',
                is_veg: newItem.itemType === 'Veg',
                is_available: newItem.isAvailable,
                is_popular: newItem.isPopular,
                active: newItem.active,
                rating: newItem.rating,
                preparation_time: parseInt(newItem.preparationTime) || 15,
                tax_percent: parseFloat(newItem.gstPercentage) || 0,
                gst_percentage: parseFloat(newItem.gstPercentage) || 0,
                cgst_percentage: parseFloat(newItem.cgstPercentage) || 0,
                sgst_percentage: parseFloat(newItem.sgstPercentage) || 0,
                restaurant_id: restaurantId,
                menu_item_type: newItem.menuItemType,
                price_variants: newItem.menuItemType === 'alcohol' ? newItem.priceVariants.map(v => ({ name: v.name, price: parseFloat(v.price) })) : null,
                stock_ml: newItem.menuItemType === 'alcohol' && newItem.stockMl ? parseFloat(newItem.stockMl) : null,
                image_url: uploadedImageUrl || (isEditing ? items.find(i => i.id === editingId)?.image_url : undefined),
                is_today_special: newItem.is_today_special,
                special_price: newItem.is_today_special && newItem.special_price ? parseFloat(newItem.special_price) : null,
                special_expiry_datetime: newItem.is_today_special && newItem.special_expiry_datetime ? new Date(newItem.special_expiry_datetime).toISOString() : null
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
        } catch (error: any) {
            console.error('Error saving item:', error?.message || error?.details || error);
            const errMsg = error?.message || error?.details || error?.hint || (typeof error === 'object' ? JSON.stringify(error) : String(error));
            setConfirmModal({ 
                isOpen: true, 
                title: 'Error Saving Item', 
                message: errMsg || 'Failed to save item. Please check all fields and try again.', 
                isAlert: true, 
                isSuperDestructive: false, 
                confirmText: 'OK', 
                onConfirm: () => { } 
            });
        }
    };

    const handleDeleteItem = (id: number) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Menu Item',
            message: 'Are you sure you want to delete this item? This action cannot be undone.',
            onConfirm: async () => {
                const previousItems = items;
                // Optimistic UI update: instantly remove from screen and close modal
                setItems(prev => prev.filter(i => i.id !== id));
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                if (restaurantId) clearCache(`menu-${restaurantId}`);

                try {
                    await MenuService.deleteMenuItem(id, restaurantId!);
                } catch (error) {
                    console.error('Error deleting item:', error);
                    // Revert on error
                    setItems(previousItems);
                    if (restaurantId) clearCache(`menu-${restaurantId}`);
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
                const previousSubCats = subCategories;
                const previousItems = items;
                // Optimistic update
                setSubCategories(prev => prev.filter(s => s.id !== id));
                setItems(prev => prev.map(item => item.sub_category_id === id ? { ...item, sub_category_id: undefined } : item));
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                if (restaurantId) clearCache(`menu-${restaurantId}`);

                try {
                    await MenuService.deleteSubCategory(id, restaurantId!);
                } catch (error) {
                    console.error('Error deleting subcategory:', error);
                    setSubCategories(previousSubCats);
                    setItems(previousItems);
                    if (restaurantId) clearCache(`menu-${restaurantId}`);
                    setConfirmModal({ isOpen: true, title: 'Error', message: 'Failed to delete subcategory', isAlert: true, isSuperDestructive: false, confirmText: 'OK', onConfirm: () => { } });
                }
            }
        });
    };

    const formatToDatetimeLocal = (dateString?: string | null) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const tzoffset = date.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
        return localISOTime;
    };

    const handleEditItem = async (item: MenuItem) => {
        // Fetch existing recipe mappings
        try {
            const mappings = await RecipeService.fetchMappingsForMenuItem(item.id, restaurantId!);
            const itemGst = item.gst_percentage != null ? item.gst_percentage : (item.tax_percent != null ? item.tax_percent : restaurantGst.gst);
            const itemCgst = item.cgst_percentage != null ? item.cgst_percentage : (itemGst / 2);
            const itemSgst = item.sgst_percentage != null ? item.sgst_percentage : (itemGst / 2);

            setNewItem({
                name: item.name,
                price: item.price.toString(),
                description: item.description || '',
                categoryId: item.category_id.toString(),
                subCategoryId: item.sub_category_id?.toString() || '',
                itemType: item.item_type || (item.is_veg ? 'Veg' : 'Non-Veg'),
                preparationTime: (item.preparation_time || 15).toString(),
                taxPercent: itemGst.toString(),
                gstPercentage: itemGst.toString(),
                cgstPercentage: itemCgst.toString(),
                sgstPercentage: itemSgst.toString(),
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
                })),
                is_today_special: !!item.is_today_special,
                special_price: item.special_price?.toString() || '',
                special_expiry_datetime: formatToDatetimeLocal(item.special_expiry_datetime)
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
            itemType: 'Veg', preparationTime: '15', 
            taxPercent: restaurantGst.gst.toString(),
            gstPercentage: restaurantGst.gst.toString(),
            cgstPercentage: restaurantGst.cgst.toString(),
            sgstPercentage: restaurantGst.sgst.toString(),
            isAvailable: true, isPopular: false, active: true, rating: 4.5,
            menuItemType: 'food', priceVariants: [], stockMl: '',
            ingredients: [],
            is_today_special: false,
            special_price: '',
            special_expiry_datetime: ''
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

    // Combos & Specials Derivations
    const combosList = specials.filter(s => s.is_combo || s.special_type === 'combo');
    const specialsList = specials.filter(s => !s.is_combo && s.special_type !== 'combo');
    const standaloneMenuItemSpecials = items.filter(i => 
        i.is_today_special && !specialsList.some(s => s.items?.some(it => it.menu_item_id === i.id))
    );
    const totalSpecialsCount = specialsList.length + standaloneMenuItemSpecials.length;

    const comboDisplayImage = specialCategoryImages.combos || combosList.find(c => Boolean(c.image_url))?.image_url || '/menu/tandoori-chicken.jpeg';
    const specialsDisplayImage = specialCategoryImages.specials || specialsList.find(s => Boolean(s.image_url))?.image_url || standaloneMenuItemSpecials.find(s => Boolean(s.image_url))?.image_url || '/menu/chicken-tikka.jpeg';

    // Filter combos based on search and status
    const filteredCombos = combosList.filter((combo) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
            combo.title.toLowerCase().includes(q) ||
            (combo.description?.toLowerCase().includes(q) || false) ||
            (combo.items?.some(it => it.menu_item?.name.toLowerCase().includes(q)) || false);

        const matchesStatus = specialStatusFilter === 'all'
            ? true
            : specialStatusFilter === 'active'
                ? combo.is_active
                : !combo.is_active;

        return matchesSearch && matchesStatus;
    });

    // Filter specials based on search and status
    const filteredSpecials = specialsList.filter((sp) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
            sp.title.toLowerCase().includes(q) ||
            (sp.description?.toLowerCase().includes(q) || false) ||
            (sp.items?.some(it => it.menu_item?.name.toLowerCase().includes(q)) || false);

        const matchesStatus = specialStatusFilter === 'all'
            ? true
            : specialStatusFilter === 'active'
                ? sp.is_active
                : !sp.is_active;

        return matchesSearch && matchesStatus;
    });

    const filteredStandaloneSpecials = standaloneMenuItemSpecials.filter((item) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
            item.name.toLowerCase().includes(q) ||
            (item.description?.toLowerCase().includes(q) || false);

        const matchesStatus = specialStatusFilter === 'all'
            ? true
            : specialStatusFilter === 'active'
                ? item.is_available
                : !item.is_available;

        return matchesSearch && matchesStatus;
    });

    // Calculations for Modal
    const specialOriginalTotal = specialFormItems.reduce((sum, it) => sum + (it.price * it.quantity), 0);
    const parsedSpecialPrice = parseFloat(specialFormPrice) || 0;
    const specialSavings = specialOriginalTotal > parsedSpecialPrice ? (specialOriginalTotal - parsedSpecialPrice) : 0;
    const specialDiscountPercent = specialOriginalTotal > 0 && specialSavings > 0
        ? Math.round((specialSavings / specialOriginalTotal) * 100)
        : 0;

    // Handlers for Specials and Combos
    const handleToggleSpecial = async (special: TodaySpecial) => {
        const targetResId = restaurantId || urlRestaurantCode;
        if (!targetResId) return;
        const nextActive = !special.is_active;
        // Optimistic UI update
        setSpecials(prev => prev.map(s => s.id === special.id ? { ...s, is_active: nextActive } : s));
        try {
            const success = await SpecialsService.toggleSpecialActive(special.id, targetResId, nextActive);
            if (success) {
                toast.success(nextActive ? 'Special activated' : 'Special deactivated');
            } else {
                setSpecials(prev => prev.map(s => s.id === special.id ? { ...s, is_active: !nextActive } : s));
                toast.error('Failed to update status');
            }
        } catch (err) {
            setSpecials(prev => prev.map(s => s.id === special.id ? { ...s, is_active: !nextActive } : s));
            toast.error('Failed to update status');
        }
    };

    const handleDeleteSpecial = (special: TodaySpecial) => {
        const targetResId = restaurantId || urlRestaurantCode;
        if (!targetResId) return;
        const isCombo = special.is_combo || special.special_type === 'combo';
        setConfirmModal({
            isOpen: true,
            title: isCombo ? 'Delete Combo Offer' : "Delete Today's Special",
            message: `Are you sure you want to delete "${special.title}"? This cannot be undone.`,
            isSuperDestructive: true,
            confirmText: 'Delete',
            onConfirm: async () => {
                setSpecials(prev => prev.filter(s => s.id !== special.id));
                const success = await SpecialsService.deleteSpecial(special.id, targetResId);
                if (success) {
                    toast.success(isCombo ? 'Combo deleted' : 'Special deleted');
                    loadData(true);
                } else {
                    toast.error('Failed to delete');
                    loadData(true);
                }
            }
        });
    };

    const handleRemoveStandaloneSpecial = (item: MenuItem) => {
        const targetResId = restaurantId || urlRestaurantCode;
        if (!targetResId) return;
        setConfirmModal({
            isOpen: true,
            title: "Remove from Today's Specials",
            message: `Are you sure you want to remove "${item.name}" from Today's Specials?`,
            confirmText: 'Remove',
            onConfirm: async () => {
                try {
                    await MenuService.updateMenuItem(item.id, targetResId, {
                        is_today_special: false,
                        special_price: null,
                        special_expiry_datetime: null
                    });
                    toast.success('Removed from specials');
                    loadData(true);
                } catch (err) {
                    toast.error('Failed to remove from specials');
                }
            }
        });
    };

    const openCreateSpecialModal = (type: 'combo' | 'special') => {
        setSpecialModalType(type);
        setEditingSpecial(null);
        setSpecialFormTitle('');
        setSpecialFormDesc('');
        setSpecialFormPrice('');
        setSpecialFormValidTo('');
        setSpecialFormImageUrl('');
        setSpecialFormItems([]);
        setSpecialItemSearch('');
        setShowSpecialItemDropdown(false);
        setShowSpecialModal(true);
    };

    const openEditSpecialModal = (special: TodaySpecial) => {
        const isCombo = special.is_combo || special.special_type === 'combo';
        setSpecialModalType(isCombo ? 'combo' : 'special');
        setEditingSpecial(special);
        setSpecialFormTitle(special.title);
        setSpecialFormDesc(special.description || '');
        setSpecialFormPrice(special.special_price != null ? special.special_price.toString() : '');
        setSpecialFormValidTo(special.valid_to ? new Date(special.valid_to).toISOString().slice(0, 16) : '');
        setSpecialFormImageUrl(special.image_url || '');
        setSpecialFormItems(
            (special.items || []).map(si => ({
                menu_item_id: si.menu_item_id,
                quantity: si.quantity,
                name: si.menu_item?.name || 'Item',
                price: si.menu_item?.price || 0
            }))
        );
        setSpecialItemSearch('');
        setShowSpecialItemDropdown(false);
        setShowSpecialModal(true);
    };

    const handleSpecialImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validationError = validateImageFile(file);
        if (validationError) {
            toast.error(validationError);
            return;
        }

        setIsUploadingSpecialImage(true);
        try {
            const compressed = await compressImage(file);
            const uploadedUrl = await MenuService.uploadMenuImage(compressed.file, undefined, restaurantId || urlRestaurantCode || undefined);
            setSpecialFormImageUrl(uploadedUrl);
            toast.success('Image uploaded successfully');
        } catch (error: any) {
            console.error('Upload failed:', error);
            toast.error(error?.message || 'Failed to upload image');
        } finally {
            setIsUploadingSpecialImage(false);
            if (specialImageInputRef.current) specialImageInputRef.current.value = '';
        }
    };

    const addMenuItemToSpecial = (item: MenuItem) => {
        if (specialModalType === 'special') {
            setSpecialFormItems([
                {
                    menu_item_id: item.id,
                    quantity: 1,
                    name: item.name,
                    price: item.price
                }
            ]);
            if (!specialFormTitle || specialFormTitle === specialFormItems[0]?.name) {
                setSpecialFormTitle(item.name);
            }
            if (!specialFormImageUrl && item.image_url) {
                setSpecialFormImageUrl(item.image_url);
            }
        } else {
            if (specialFormItems.some(i => i.menu_item_id === item.id)) {
                toast.error('Item already added to combo');
                return;
            }
            setSpecialFormItems(prev => [
                ...prev,
                {
                    menu_item_id: item.id,
                    quantity: 1,
                    name: item.name,
                    price: item.price
                }
            ]);
        }
        setSpecialItemSearch('');
        setShowSpecialItemDropdown(false);
    };

    const updateSpecialItemQuantity = (menuItemId: number, delta: number) => {
        setSpecialFormItems(prev =>
            prev.map(i => {
                if (i.menu_item_id === menuItemId) {
                    const newQty = Math.max(1, i.quantity + delta);
                    return { ...i, quantity: newQty };
                }
                return i;
            })
        );
    };

    const removeSpecialItem = (menuItemId: number) => {
        setSpecialFormItems(prev => prev.filter(i => i.menu_item_id !== menuItemId));
    };

    const handleSaveSpecial = async () => {
        if (!specialFormTitle.trim()) {
            toast.error('Please enter a title');
            return;
        }
        if (specialFormItems.length === 0) {
            toast.error('Please add at least one dish');
            return;
        }
        const targetResId = restaurantId || urlRestaurantCode;
        if (!targetResId) {
            toast.error('Restaurant ID missing');
            return;
        }

        setIsSavingSpecial(true);
        try {
            const isCombo = specialModalType === 'combo';
            const parsedPrice = specialFormPrice ? parseFloat(specialFormPrice) : undefined;
            const input: CreateSpecialInput = {
                restaurant_id: targetResId,
                title: specialFormTitle.trim(),
                description: specialFormDesc.trim() || undefined,
                special_price: parsedPrice,
                is_combo: isCombo,
                special_type: isCombo ? 'combo' : 'single',
                valid_to: specialFormValidTo ? new Date(specialFormValidTo).toISOString() : undefined,
                items: specialFormItems.map(s => ({ menu_item_id: s.menu_item_id, quantity: s.quantity })),
                image_url: specialFormImageUrl.trim() || undefined
            };

            if (editingSpecial) {
                const success = await SpecialsService.updateSpecial(editingSpecial.id, targetResId, {
                    title: input.title,
                    description: input.description,
                    special_price: input.special_price,
                    is_combo: input.is_combo,
                    valid_to: input.valid_to,
                    image_url: input.image_url
                } as any);

                if (success) {
                    await SpecialsService.updateSpecialItems(editingSpecial.id, targetResId, input.items);
                    toast.success(isCombo ? 'Combo updated successfully' : 'Special updated successfully');
                } else {
                    toast.error('Failed to update');
                }
            } else {
                const result = await SpecialsService.createSpecial(targetResId, input);
                if (result) {
                    toast.success(isCombo ? 'Combo created successfully' : 'Special created successfully');
                } else {
                    toast.error('Failed to create');
                }
            }

            setShowSpecialModal(false);
            await loadData(true);
        } catch (err: any) {
            console.error('Error saving special/combo:', err);
            toast.error(err?.message || 'Error occurred while saving');
        } finally {
            setIsSavingSpecial(false);
        }
    };

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
                const previousCategories = categories;
                const previousItems = items;
                const newCats = categories.filter(c => c.id !== id);
                const remainingDisplayCats = displayCategories.filter(c => c.id !== id);

                // Optimistic UI update: instantly update sidebar categories, items, and close modal
                setCategories(newCats);
                setItems(prev => prev.filter(i => i.category_id !== id));
                if (selectedCategoryId === id) {
                    setSelectedCategoryId(remainingDisplayCats.length > 0 ? remainingDisplayCats[0].id : null);
                }
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                if (restaurantId) clearCache(`menu-${restaurantId}`);

                try {
                    await MenuService.deleteCategory(id, restaurantId!);
                } catch (error) {
                    console.error('Error deleting category:', error);
                    // Revert on failure
                    setCategories(previousCategories);
                    setItems(previousItems);
                    if (restaurantId) clearCache(`menu-${restaurantId}`);
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
                                onClick={() => {
                                    setActiveMenuTab('food');
                                    setSelectedSpecialView(null);
                                }}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeMenuTab === 'food' && !selectedSpecialView ? 'bg-white text-blue-600 shadow-sm' : 'text-black hover:text-black'}`}
                            >
                                Food
                            </button>
                            <button
                                onClick={() => {
                                    setActiveMenuTab('alcohol');
                                    setSelectedSpecialView(null);
                                }}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${activeMenuTab === 'alcohol' && !selectedSpecialView ? 'bg-white text-blue-600 shadow-sm' : 'text-black hover:text-black'}`}
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
                    {/* Offers & Specials Navigation Section */}
                    <div className="space-y-1 pb-2.5 mb-2 border-b border-neutral-200">
                        {/* Combos & Offers */}
                        <div
                            onClick={() => {
                                setSelectedSpecialView('combos');
                                setSelectedCategoryId(null);
                                setSelectedSubCategoryId(null);
                            }}
                            className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                                selectedSpecialView === 'combos'
                                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                                    : 'text-neutral-700 hover:bg-purple-50/80 hover:text-purple-700'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 truncate">
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        triggerSpecialCategoryUpload('combos');
                                    }}
                                    title="Click to change Combo Category image"
                                    className={`size-7 p-0.5 rounded-lg flex items-center justify-center relative overflow-hidden group/img cursor-pointer flex-shrink-0 transition-all ${
                                        selectedSpecialView === 'combos' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-600'
                                    }`}
                                >
                                    {comboDisplayImage ? (
                                        <>
                                            <img src={comboDisplayImage} alt="Combos" className="w-full h-full object-cover rounded-md" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                                <LucideCamera size={11} className="text-white drop-shadow" />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <LucideSparkles size={14} className="group-hover/img:opacity-0 transition-opacity" />
                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                                <LucideCamera size={11} className="text-white drop-shadow" />
                                            </div>
                                        </>
                                    )}
                                </div>
                                <span className="font-bold text-[13px] truncate">Combos & Offers</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        triggerSpecialCategoryUpload('combos');
                                    }}
                                    title="Change Combo Category Image"
                                    className={`p-1 rounded-md transition-opacity opacity-0 group-hover:opacity-100 ${
                                        selectedSpecialView === 'combos' ? 'hover:bg-white/20 text-white' : 'hover:bg-purple-100 text-purple-600'
                                    }`}
                                >
                                    <LucideCamera size={12} />
                                </button>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                    selectedSpecialView === 'combos'
                                        ? 'bg-white/20 text-white'
                                        : 'bg-purple-100 text-purple-700'
                                }`}>
                                    {combosList.length}
                                </span>
                            </div>
                        </div>

                        {/* Today's Specials */}
                        <div
                            onClick={() => {
                                setSelectedSpecialView('specials');
                                setSelectedCategoryId(null);
                                setSelectedSubCategoryId(null);
                            }}
                            className={`group flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                                selectedSpecialView === 'specials'
                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                                    : 'text-neutral-700 hover:bg-amber-50/80 hover:text-amber-700'
                            }`}
                        >
                            <div className="flex items-center gap-2.5 truncate">
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        triggerSpecialCategoryUpload('specials');
                                    }}
                                    title="Click to change Specials Category image"
                                    className={`size-7 p-0.5 rounded-lg flex items-center justify-center relative overflow-hidden group/img cursor-pointer flex-shrink-0 transition-all ${
                                        selectedSpecialView === 'specials' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-600'
                                    }`}
                                >
                                    {specialsDisplayImage ? (
                                        <>
                                            <img src={specialsDisplayImage} alt="Specials" className="w-full h-full object-cover rounded-md" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                                <LucideCamera size={11} className="text-white drop-shadow" />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <LucideFlame size={14} className="group-hover/img:opacity-0 transition-opacity" />
                                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                                <LucideCamera size={11} className="text-white drop-shadow" />
                                            </div>
                                        </>
                                    )}
                                </div>
                                <span className="font-bold text-[13px] truncate">Today's Specials</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        triggerSpecialCategoryUpload('specials');
                                    }}
                                    title="Change Specials Category Image"
                                    className={`p-1 rounded-md transition-opacity opacity-0 group-hover:opacity-100 ${
                                        selectedSpecialView === 'specials' ? 'hover:bg-white/20 text-white' : 'hover:bg-amber-100 text-amber-600'
                                    }`}
                                >
                                    <LucideCamera size={12} />
                                </button>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                    selectedSpecialView === 'specials'
                                        ? 'bg-white/20 text-white'
                                        : 'bg-amber-100 text-amber-700'
                                }`}>
                                    {totalSpecialsCount}
                                </span>
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="text-center p-4 text-black text-sm">Loading...</div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEndCategory}
                        >
                            <SortableContext
                                items={displayCategories.map(c => c.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                <div className="space-y-0.5">
                                    {displayCategories.map((cat) => (
                                        <SortableCategoryRow
                                            key={cat.id}
                                            category={cat}
                                            isSelected={!selectedSpecialView && selectedCategoryId === cat.id}
                                            count={categoryCounts[cat.id] || 0}
                                            onClick={() => {
                                                setSelectedSpecialView(null);
                                                setSelectedCategoryId(cat.id);
                                            }}
                                            onDelete={(e) => handleDeleteCategory(cat.id, e)}
                                            onImageUpload={handleCategoryImageUpload}
                                        />
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
                {/* 1. Top Toolbar (Search & Add Item / Combo / Special) */}
                <div className="h-[69px] px-6 border-b border-neutral-200 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <LucideSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-black" size={20} />
                            <input
                                type="text"
                                placeholder={
                                    selectedSpecialView === 'combos'
                                        ? 'Search combos & offers...'
                                        : selectedSpecialView === 'specials'
                                            ? "Search today's specials..."
                                            : 'Search items...'
                                }
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2.5 border border-neutral-200 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder:text-neutral-400 transition-all shadow-sm"
                            />
                        </div>
                        <SyncIndicator isRevalidating={isRevalidating} />
                    </div>

                    <div className="flex items-center gap-4">
                        {selectedSpecialView === 'combos' ? (
                            <div className="flex items-center gap-3">
                                <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200 text-xs font-semibold">
                                    {(['all', 'active', 'inactive'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setSpecialStatusFilter(tab)}
                                            className={`px-3 py-1 rounded-md capitalize transition-all ${
                                                specialStatusFilter === tab
                                                    ? 'bg-white text-purple-700 shadow-xs font-bold'
                                                    : 'text-neutral-600 hover:text-black'
                                            }`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => openCreateSpecialModal('combo')}
                                    className="flex items-center px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/20 hover:-translate-y-0.5"
                                >
                                    <LucidePlus size={16} className="mr-1.5" />
                                    Create Combo
                                </button>
                            </div>
                        ) : selectedSpecialView === 'specials' ? (
                            <div className="flex items-center gap-3">
                                <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200 text-xs font-semibold">
                                    {(['all', 'active', 'inactive'] as const).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setSpecialStatusFilter(tab)}
                                            className={`px-3 py-1 rounded-md capitalize transition-all ${
                                                specialStatusFilter === tab
                                                    ? 'bg-white text-amber-700 shadow-xs font-bold'
                                                    : 'text-neutral-600 hover:text-black'
                                            }`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    onClick={() => openCreateSpecialModal('special')}
                                    className="flex items-center px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/20 hover:-translate-y-0.5"
                                >
                                    <LucidePlus size={16} className="mr-1.5" />
                                    Add Special
                                </button>
                            </div>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>
                </div>

                {/* 2. Subcategories Horizontal Bar (Only for Regular Categories) */}
                {(!selectedSpecialView && selectedCategoryId) && (
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

                {/* 3. Main Views: Combos View OR Specials View OR Standard Items Table */}
                {selectedSpecialView === 'combos' ? (
                    <div className="flex-1 overflow-y-auto p-6 bg-neutral-50/50">
                        {/* Category Banner with Image & Change CTA */}
                        <div className="flex items-center justify-between p-4 mb-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs">
                            <div className="flex items-center gap-3.5">
                                <div 
                                    onClick={() => triggerSpecialCategoryUpload('combos')}
                                    className="relative size-12 rounded-xl overflow-hidden bg-purple-100 flex items-center justify-center cursor-pointer group shadow-xs flex-shrink-0"
                                    title="Click to change Combo Category image"
                                >
                                    {comboDisplayImage ? (
                                        <img src={comboDisplayImage} alt="Combos Category" className="w-full h-full object-cover" />
                                    ) : (
                                        <LucideSparkles className="text-purple-600" size={22} />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <LucideCamera className="text-white" size={16} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base font-bold text-black">Combos & Offers Category</h2>
                                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                            {combosList.length} Combos
                                        </span>
                                    </div>
                                    <p className="text-xs text-neutral-500">
                                        This category image is shown in the sidebar menu across Customer, Waiter, and Admin panels.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => triggerSpecialCategoryUpload('combos')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 hover:border-purple-300 text-xs font-semibold text-neutral-700 hover:text-purple-700 bg-neutral-50 hover:bg-purple-50 transition-all cursor-pointer"
                            >
                                <LucideUpload size={13} />
                                <span>Change Category Image</span>
                            </button>
                        </div>
                        {filteredCombos.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-neutral-300 p-8 max-w-lg mx-auto mt-6">
                                <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto mb-4 border border-purple-100">
                                    <LucideSparkles size={28} />
                                </div>
                                <h3 className="text-lg font-bold text-black mb-1">No Combos Found</h3>
                                <p className="text-sm text-neutral-500 mb-6">
                                    {searchQuery ? 'No combos match your search criteria.' : 'Create combo meal bundles with discounted pricing to increase average order values.'}
                                </p>
                                <button
                                    onClick={() => openCreateSpecialModal('combo')}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white font-bold text-sm rounded-xl hover:bg-purple-700 shadow-md shadow-purple-600/20 transition-all hover:-translate-y-0.5"
                                >
                                    <LucidePlus size={16} />
                                    Create First Combo
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-7xl">
                                {filteredCombos.map(combo => {
                                    const originalPrice = combo.original_price || combo.items?.reduce((sum, it) => sum + (it.menu_item?.price || 0) * (it.quantity || 1), 0) || 0;
                                    const specialPrice = combo.special_price || 0;
                                    const savings = originalPrice > specialPrice ? originalPrice - specialPrice : 0;
                                    const discountPct = originalPrice > 0 && savings > 0 ? Math.round((savings / originalPrice) * 100) : 0;

                                    return (
                                        <div
                                            key={combo.id}
                                            className={`bg-white rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between overflow-hidden ${
                                                combo.is_active ? 'border-neutral-200 shadow-xs' : 'border-neutral-200/60 opacity-60 bg-neutral-50/50'
                                            }`}
                                        >
                                            <div className="p-5">
                                                {/* Top Header */}
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div className="flex items-start gap-3.5">
                                                        <div className="w-14 h-14 rounded-xl bg-purple-50 border border-purple-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-purple-600">
                                                            {combo.image_url ? (
                                                                <img src={combo.image_url} alt={combo.title} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <LucidePackage size={24} />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-extrabold text-base text-neutral-900 leading-tight">{combo.title}</h4>
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-purple-100 text-purple-700 border border-purple-200">
                                                                    Combo Deal
                                                                </span>
                                                            </div>
                                                            {combo.description && (
                                                                <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{combo.description}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            onClick={() => handleToggleSpecial(combo)}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                                combo.is_active ? 'bg-emerald-500' : 'bg-neutral-300'
                                                            }`}
                                                            title={combo.is_active ? 'Active - Click to Deactivate' : 'Inactive - Click to Activate'}
                                                        >
                                                            <span className={`inline-block size-4 transform rounded-full bg-white transition-transform shadow-sm ${
                                                                combo.is_active ? 'translate-x-6' : 'translate-x-1'
                                                            }`} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Included Items List */}
                                                <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100 mb-2">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                                                            <LucideLayers size={12} className="text-neutral-400" />
                                                            Included Dishes ({combo.items?.length || 0})
                                                        </span>
                                                    </div>
                                                    {combo.items && combo.items.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {combo.items.map((it, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-xs font-semibold text-neutral-800 shadow-2xs"
                                                                >
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                                                    {it.menu_item?.name || 'Item'}
                                                                    {it.quantity > 1 && (
                                                                        <span className="text-purple-600 font-bold">×{it.quantity}</span>
                                                                    )}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-neutral-400 italic">Custom promotional deal bundle</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Card Footer: Price & Actions */}
                                            <div className="px-5 py-3.5 bg-neutral-50/80 border-t border-neutral-100 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {specialPrice > 0 ? (
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-xl font-black text-emerald-600 flex items-center">
                                                                <LucideIndianRupee size={16} />
                                                                {specialPrice}
                                                            </span>
                                                            {originalPrice > specialPrice && (
                                                                <span className="text-xs font-semibold text-neutral-400 line-through flex items-center">
                                                                    <LucideIndianRupee size={10} />
                                                                    {originalPrice}
                                                                </span>
                                                            )}
                                                            {discountPct > 0 && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                                                    {discountPct}% OFF
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-lg font-black text-neutral-800 flex items-center">
                                                            <LucideIndianRupee size={16} />
                                                            {originalPrice}
                                                        </span>
                                                    )}
                                                    {combo.valid_to && (
                                                        <span className="text-[11px] font-medium text-neutral-500 flex items-center gap-1">
                                                            <LucideCalendar size={12} className="text-neutral-400" />
                                                            Until {new Date(combo.valid_to).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => openEditSpecialModal(combo)}
                                                        className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                        title="Edit Combo"
                                                    >
                                                        <LucideEdit2 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSpecial(combo)}
                                                        className="p-2 text-neutral-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                                                        title="Delete Combo"
                                                    >
                                                        <LucideTrash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : selectedSpecialView === 'specials' ? (
                    <div className="flex-1 overflow-y-auto p-6 bg-neutral-50/50">
                        {/* Category Banner with Image & Change CTA */}
                        <div className="flex items-center justify-between p-4 mb-5 rounded-2xl bg-white border border-neutral-200/80 shadow-xs">
                            <div className="flex items-center gap-3.5">
                                <div 
                                    onClick={() => triggerSpecialCategoryUpload('specials')}
                                    className="relative size-12 rounded-xl overflow-hidden bg-amber-100 flex items-center justify-center cursor-pointer group shadow-xs flex-shrink-0"
                                    title="Click to change Specials Category image"
                                >
                                    {specialsDisplayImage ? (
                                        <img src={specialsDisplayImage} alt="Specials Category" className="w-full h-full object-cover" />
                                    ) : (
                                        <LucideFlame className="text-amber-600" size={22} />
                                    )}
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <LucideCamera className="text-white" size={16} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-base font-bold text-black">Today's Specials Category</h2>
                                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                            {totalSpecialsCount} Specials
                                        </span>
                                    </div>
                                    <p className="text-xs text-neutral-500">
                                        This category image is shown in the sidebar menu across Customer, Waiter, and Admin panels.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => triggerSpecialCategoryUpload('specials')}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 hover:border-amber-300 text-xs font-semibold text-neutral-700 hover:text-amber-700 bg-neutral-50 hover:bg-amber-50 transition-all cursor-pointer"
                            >
                                <LucideUpload size={13} />
                                <span>Change Category Image</span>
                            </button>
                        </div>
                        {filteredSpecials.length === 0 && filteredStandaloneSpecials.length === 0 ? (
                            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-neutral-300 p-8 max-w-lg mx-auto mt-6">
                                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-100">
                                    <LucideFlame size={28} />
                                </div>
                                <h3 className="text-lg font-bold text-black mb-1">No Specials Configured</h3>
                                <p className="text-sm text-neutral-500 mb-6">
                                    {searchQuery ? 'No specials match your search criteria.' : 'Highlight chef recommendations, limited-time discounts, and daily specials.'}
                                </p>
                                <button
                                    onClick={() => openCreateSpecialModal('special')}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white font-bold text-sm rounded-xl hover:bg-amber-600 shadow-md shadow-amber-500/20 transition-all hover:-translate-y-0.5"
                                >
                                    <LucidePlus size={16} />
                                    Add Today's Special
                                </button>
                            </div>
                        ) : (                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-7xl">
                                {/* Render specials from today_specials */}
                                {filteredSpecials.map((special) => {
                                    const linkedItem = special.items?.[0]?.menu_item;
                                    const originalPrice = special.original_price || linkedItem?.price || 0;
                                    const specialPrice = special.special_price || 0;
                                    const savings = originalPrice > specialPrice ? originalPrice - specialPrice : 0;
                                    const discountPct = originalPrice > 0 && savings > 0 ? Math.round((savings / originalPrice) * 100) : 0;
                                    const displayImage = special.image_url || linkedItem?.image_url;

                                    return (
                                        <div
                                            key={special.id}
                                            className={`bg-white rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between overflow-hidden ${
                                                special.is_active ? 'border-neutral-200 shadow-xs' : 'border-neutral-200/60 opacity-60 bg-neutral-50/50'
                                            }`}
                                        >
                                            <div className="p-5">
                                                {/* Top Header */}
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div className="flex items-start gap-3.5">
                                                        <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-amber-600">
                                                            {displayImage ? (
                                                                <img src={displayImage} alt={special.title} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <LucideFlame size={24} />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="font-extrabold text-base text-neutral-900 leading-tight">{special.title}</h4>
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-700 border border-amber-200">
                                                                    Today's Special
                                                                </span>
                                                                {linkedItem?.item_type === 'Veg' && (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-bold border border-green-200">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-600 mr-1"></span>
                                                                        VEG
                                                                    </span>
                                                                )}
                                                                {linkedItem?.item_type === 'Non-Veg' && (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold border border-red-200">
                                                                        <span className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-red-600 mr-1"></span>
                                                                        NON-VEG
                                                                    </span>
                                                                )}
                                                                {linkedItem?.item_type === 'Egg' && (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 text-[10px] font-bold border border-yellow-200">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-600 mr-1"></span>
                                                                        EGG
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {special.description ? (
                                                                <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{special.description}</p>
                                                            ) : (
                                                                <p className="text-xs text-neutral-400 mt-1 line-clamp-1 italic">
                                                                    {linkedItem ? `Base dish: ${linkedItem.name}` : "Chef's recommended today special"}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            onClick={() => handleToggleSpecial(special)}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                                special.is_active ? 'bg-emerald-500' : 'bg-neutral-300'
                                                            }`}
                                                            title={special.is_active ? 'Active - Click to Deactivate' : 'Inactive - Click to Activate'}
                                                        >
                                                            <span className={`inline-block size-4 transform rounded-full bg-white transition-transform shadow-sm ${
                                                                special.is_active ? 'translate-x-6' : 'translate-x-1'
                                                            }`} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Dish Details Box */}
                                                <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100 mb-2">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                                                            <LucideFlame size={12} className="text-amber-500" />
                                                            Special Dish
                                                        </span>
                                                        <span className="font-semibold text-neutral-800">
                                                            {linkedItem ? linkedItem.name : special.title}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Card Footer: Price & Actions */}
                                            <div className="px-5 py-3.5 bg-neutral-50/80 border-t border-neutral-100 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {specialPrice > 0 ? (
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-xl font-black text-emerald-600 flex items-center">
                                                                <LucideIndianRupee size={16} />
                                                                {specialPrice}
                                                            </span>
                                                            {originalPrice > specialPrice && (
                                                                <span className="text-xs font-semibold text-neutral-400 line-through flex items-center">
                                                                    <LucideIndianRupee size={10} />
                                                                    {originalPrice}
                                                                </span>
                                                            )}
                                                            {discountPct > 0 && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                                                    {discountPct}% OFF
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-lg font-black text-neutral-800 flex items-center">
                                                            <LucideIndianRupee size={16} />
                                                            {originalPrice}
                                                        </span>
                                                    )}
                                                    {special.valid_to && (
                                                        <span className="text-[11px] font-medium text-neutral-500 flex items-center gap-1">
                                                            <LucideCalendar size={12} className="text-neutral-400" />
                                                            Until {new Date(special.valid_to).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => openEditSpecialModal(special)}
                                                        className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                        title="Edit Special"
                                                    >
                                                        <LucideEdit2 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteSpecial(special)}
                                                        className="p-2 text-neutral-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                                                        title="Delete Special"
                                                    >
                                                        <LucideTrash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Render standalone menu items marked as is_today_special */}
                                {filteredStandaloneSpecials.map((item) => {
                                    const originalPrice = item.price || 0;
                                    const specialPrice = item.special_price || originalPrice;
                                    const savings = originalPrice > specialPrice ? originalPrice - specialPrice : 0;
                                    const discountPct = originalPrice > 0 && savings > 0 ? Math.round((savings / originalPrice) * 100) : 0;

                                    return (
                                        <div
                                            key={`item-${item.id}`}
                                            className={`bg-white rounded-2xl border transition-all hover:shadow-md flex flex-col justify-between overflow-hidden ${
                                                item.is_available ? 'border-neutral-200 shadow-xs' : 'border-neutral-200/60 opacity-60 bg-neutral-50/50'
                                            }`}
                                        >
                                            <div className="p-5">
                                                {/* Top Header */}
                                                <div className="flex items-start justify-between gap-3 mb-3">
                                                    <div className="flex items-start gap-3.5">
                                                        <div className="w-14 h-14 rounded-xl bg-amber-50 border border-amber-100 overflow-hidden flex-shrink-0 flex items-center justify-center text-amber-600">
                                                            {item.image_url ? (
                                                                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <LucideFlame size={24} />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h4 className="font-extrabold text-base text-neutral-900 leading-tight">{item.name}</h4>
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-700 border border-amber-200">
                                                                    Today's Special
                                                                </span>
                                                                {item.item_type === 'Veg' && (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-bold border border-green-200">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-green-600 mr-1"></span>
                                                                        VEG
                                                                    </span>
                                                                )}
                                                                {item.item_type === 'Non-Veg' && (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold border border-red-200">
                                                                        <span className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-b-[5px] border-b-red-600 mr-1"></span>
                                                                        NON-VEG
                                                                    </span>
                                                                )}
                                                                {item.item_type === 'Egg' && (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 text-[10px] font-bold border border-yellow-200">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-600 mr-1"></span>
                                                                        EGG
                                                                    </span>
                                                                )}
                                                                {!item.item_type && (
                                                                    item.is_veg ? (
                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-50 text-green-700 text-[10px] font-bold border border-green-200">VEG</span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-bold border border-red-200">NON-VEG</span>
                                                                    )
                                                                )}
                                                            </div>
                                                            {item.description ? (
                                                                <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{item.description}</p>
                                                            ) : (
                                                                <p className="text-xs text-neutral-400 mt-1 line-clamp-1 italic">
                                                                    Menu dish spotlighted as today's special
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <button
                                                            onClick={() => toggleAvailability(item.id, item.is_available)}
                                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                                item.is_available ? 'bg-emerald-500' : 'bg-neutral-300'
                                                            }`}
                                                            title={item.is_available ? 'In Stock - Click to disable' : 'Out of stock - Click to enable'}
                                                        >
                                                            <span className={`inline-block size-4 transform rounded-full bg-white transition-transform shadow-sm ${
                                                                item.is_available ? 'translate-x-6' : 'translate-x-1'
                                                            }`} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Dish Details Box */}
                                                <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100 mb-2">
                                                    <div className="flex items-center justify-between text-xs">
                                                        <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                                                            <LucideFlame size={12} className="text-amber-500" />
                                                            Menu Dish Spotlight
                                                        </span>
                                                        <span className="font-semibold text-neutral-800">
                                                            Item #{item.id}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Card Footer: Price & Actions */}
                                            <div className="px-5 py-3.5 bg-neutral-50/80 border-t border-neutral-100 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    {specialPrice > 0 ? (
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-xl font-black text-emerald-600 flex items-center">
                                                                <LucideIndianRupee size={16} />
                                                                {specialPrice}
                                                            </span>
                                                            {originalPrice > specialPrice && (
                                                                <span className="text-xs font-semibold text-neutral-400 line-through flex items-center">
                                                                    <LucideIndianRupee size={10} />
                                                                    {originalPrice}
                                                                </span>
                                                            )}
                                                            {discountPct > 0 && (
                                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                                                    {discountPct}% OFF
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-lg font-black text-neutral-800 flex items-center">
                                                            <LucideIndianRupee size={16} />
                                                            {originalPrice}
                                                        </span>
                                                    )}
                                                    {item.special_expiry_datetime && (
                                                        <span className="text-[11px] font-medium text-neutral-500 flex items-center gap-1">
                                                            <LucideCalendar size={12} className="text-neutral-400" />
                                                            Until {new Date(item.special_expiry_datetime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => handleEditItem(item)}
                                                        className="p-2 text-neutral-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                                        title="Edit Dish & Special Price"
                                                    >
                                                        <LucideEdit2 size={15} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveStandaloneSpecial(item)}
                                                        className="p-2 text-neutral-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                                                        title="Remove from Specials"
                                                    >
                                                        <LucideTrash2 size={15} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ) : (
                    /* 3. Standard Items Table */
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
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-bold text-black">{item.name}</p>
                                                        {item.is_today_special && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-black uppercase">
                                                                <LucideFlame size={10} className="text-amber-600 fill-amber-500" />
                                                                Special
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {item.is_today_special && item.special_price != null ? (
                                                        <div>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-emerald-600 font-black flex items-center">
                                                                    <LucideIndianRupee size={12} className="mr-0.5" />
                                                                    {item.special_price}
                                                                </span>
                                                                <span className="text-slate-400 line-through text-xs font-semibold flex items-center">
                                                                    <LucideIndianRupee size={10} className="mr-0.2" />
                                                                    {item.price}
                                                                </span>
                                                            </div>
                                                            {item.special_expiry_datetime && (
                                                                <span className="text-[10px] text-amber-600 font-medium block mt-0.5">
                                                                    Exp: {new Date(item.special_expiry_datetime).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="font-bold text-black flex items-center">
                                                            <LucideIndianRupee size={12} className="mr-0.5" />
                                                            {item.price}
                                                        </div>
                                                    )}
                                                    <div className="text-[11px] font-semibold text-slate-500 mt-1">
                                                        GST {item.gst_percentage ?? item.tax_percent ?? 5}%
                                                        <span className="text-[10px] text-slate-400 font-normal block">
                                                            (CGST {item.cgst_percentage ?? (((item.gst_percentage ?? item.tax_percent ?? 5)) / 2)}% + SGST {item.sgst_percentage ?? (((item.gst_percentage ?? item.tax_percent ?? 5)) / 2)}%)
                                                        </span>
                                                    </div>
                                                </td>
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
                )}
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
            {/* Hidden special / combo category image input */}
            <input
                ref={specialCatImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processSpecialCategoryImageUpload(file);
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
                                <div className="col-span-2 bg-slate-50 border border-slate-200 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-bold text-slate-900">GST / Tax Configuration</span>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                                Default: {restaurantGst.gst}% (CGST {restaurantGst.cgst}% + SGST {restaurantGst.sgst}%)
                                            </span>
                                        </div>
                                        {(newItem.gstPercentage !== restaurantGst.gst.toString() ||
                                          newItem.cgstPercentage !== restaurantGst.cgst.toString() ||
                                          newItem.sgstPercentage !== restaurantGst.sgst.toString()) && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setNewItem({
                                                        ...newItem,
                                                        taxPercent: restaurantGst.gst.toString(),
                                                        gstPercentage: restaurantGst.gst.toString(),
                                                        cgstPercentage: restaurantGst.cgst.toString(),
                                                        sgstPercentage: restaurantGst.sgst.toString()
                                                    });
                                                }}
                                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                                            >
                                                Reset to Restaurant Default
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                Total GST (%)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={newItem.gstPercentage}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const num = parseFloat(val) || 0;
                                                        const half = Number((num / 2).toFixed(2)).toString();
                                                        setNewItem({
                                                            ...newItem,
                                                            taxPercent: val,
                                                            gstPercentage: val,
                                                            cgstPercentage: half,
                                                            sgstPercentage: half
                                                        });
                                                    }}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-semibold text-slate-900"
                                                    placeholder="5"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                CGST (%)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={newItem.cgstPercentage}
                                                    onChange={(e) => {
                                                        const cgstVal = e.target.value;
                                                        setNewItem({
                                                            ...newItem,
                                                            cgstPercentage: cgstVal
                                                        });
                                                    }}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-semibold text-slate-900"
                                                    placeholder="2.5"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                                SGST (%)
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    max="100"
                                                    value={newItem.sgstPercentage}
                                                    onChange={(e) => {
                                                        const sgstVal = e.target.value;
                                                        setNewItem({
                                                            ...newItem,
                                                            sgstPercentage: sgstVal
                                                        });
                                                    }}
                                                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-semibold text-slate-900"
                                                    placeholder="2.5"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* CGST + SGST mismatch note */}
                                    {Math.abs((parseFloat(newItem.cgstPercentage) || 0) + (parseFloat(newItem.sgstPercentage) || 0) - (parseFloat(newItem.gstPercentage) || 0)) > 0.01 && (
                                        <p className="text-[11px] text-amber-600 font-semibold mt-2">
                                            ⚠️ Note: CGST ({newItem.cgstPercentage || 0}%) + SGST ({newItem.sgstPercentage || 0}%) does not equal total GST ({newItem.gstPercentage || 0}%).
                                        </p>
                                    )}

                                    {/* Live Price with GST breakdown preview */}
                                    {parseFloat(newItem.price) > 0 && (
                                        <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 font-medium">
                                            <span>
                                                Base: <strong className="text-slate-900">₹{parseFloat(newItem.price) || 0}</strong>
                                                {' '}+ CGST ({newItem.cgstPercentage || 0}%): <strong className="text-slate-800">₹{((parseFloat(newItem.price) || 0) * (parseFloat(newItem.cgstPercentage) || 0) / 100).toFixed(2)}</strong>
                                                {' '}+ SGST ({newItem.sgstPercentage || 0}%): <strong className="text-slate-800">₹{((parseFloat(newItem.price) || 0) * (parseFloat(newItem.sgstPercentage) || 0) / 100).toFixed(2)}</strong>
                                            </span>
                                            <span className="text-slate-900 font-bold bg-white px-2 py-0.5 rounded border border-slate-200">
                                                Final: ₹{((parseFloat(newItem.price) || 0) * (1 + (parseFloat(newItem.gstPercentage) || 0) / 100)).toFixed(2)}
                                            </span>
                                        </div>
                                    )}
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
                                        <label className="block text-sm font-medium text-black mb-1">
                                            Subcategory <span className="text-xs text-neutral-500 font-normal">(Optional)</span>
                                        </label>
                                        <select
                                            value={newItem.subCategoryId}
                                            onChange={(e) => setNewItem({ ...newItem, subCategoryId: e.target.value })}
                                            className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        >
                                            <option value="">None / Select Subcategory</option>
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

                                {/* Today Special Settings */}
                                <div className="border-t border-neutral-200 pt-5 mt-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <label className="flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newItem.is_today_special}
                                                onChange={(e) => setNewItem({ ...newItem, is_today_special: e.target.checked })}
                                                className="w-4 h-4 text-orange-600 focus:ring-orange-500 border-neutral-300 rounded"
                                            />
                                            <span className="ml-2 text-sm font-bold text-black uppercase tracking-wider flex items-center gap-1.5">
                                                <LucideFlame size={16} className="text-orange-500 animate-pulse" />
                                                Today&apos;s Special Offer
                                            </span>
                                        </label>
                                    </div>
                                    
                                    {newItem.is_today_special && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-orange-50/50 border border-orange-100 mb-4">
                                            <div>
                                                <label className="block text-xs font-bold text-orange-800 uppercase tracking-wider mb-2">Special Price (₹)</label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    placeholder="e.g. 199"
                                                    value={newItem.special_price}
                                                    onChange={(e) => setNewItem({ ...newItem, special_price: e.target.value })}
                                                    required={newItem.is_today_special}
                                                    className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-orange-800 uppercase tracking-wider mb-2">Offer Expiry (Optional)</label>
                                                <input
                                                    type="datetime-local"
                                                    value={newItem.special_expiry_datetime}
                                                    onChange={(e) => setNewItem({ ...newItem, special_expiry_datetime: e.target.value })}
                                                    className="w-full bg-white border border-orange-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500"
                                                />
                                            </div>
                                        </div>
                                    )}
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

            {/* Special / Combo Modal */}
            <input
                ref={specialImageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleSpecialImageUpload}
            />

            {showSpecialModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-neutral-100 flex justify-between items-center bg-white sticky top-0 z-10">
                            <div>
                                <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
                                    {specialModalType === 'combo' ? (
                                        <>
                                            <span className="p-1.5 rounded-lg bg-purple-100 text-purple-600">
                                                <LucideSparkles size={18} />
                                            </span>
                                            {editingSpecial ? 'Edit Combo Deal' : 'Create New Combo Deal'}
                                        </>
                                    ) : (
                                        <>
                                            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-600">
                                                <LucideFlame size={18} />
                                            </span>
                                            {editingSpecial ? "Edit Today's Special" : "Create Today's Special"}
                                        </>
                                    )}
                                </h2>
                                <p className="text-xs text-neutral-500 mt-1">
                                    {specialModalType === 'combo'
                                        ? 'Bundle dishes together with special package pricing'
                                        : 'Set a promotional discount or spotlight a dish for today'}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowSpecialModal(false)}
                                className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                            >
                                <LucideX size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-5 flex-1">
                            {/* Title & Description */}
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                                        {specialModalType === 'combo' ? 'Combo Title *' : 'Special Title / Name *'}
                                    </label>
                                    <input
                                        type="text"
                                        value={specialFormTitle}
                                        onChange={(e) => setSpecialFormTitle(e.target.value)}
                                        placeholder={specialModalType === 'combo' ? 'e.g. Royal Biryani Feast, Lunch Combo' : 'e.g. Apollo Fish, Special Dal Tadka'}
                                        className={`w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:ring-2 ${
                                            specialModalType === 'combo' ? 'focus:ring-purple-500' : 'focus:ring-amber-500'
                                        }`}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                                        Description
                                    </label>
                                    <textarea
                                        value={specialFormDesc}
                                        onChange={(e) => setSpecialFormDesc(e.target.value)}
                                        placeholder="Add details, what it comes with, or serving size..."
                                        rows={2}
                                        className={`w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-sm text-neutral-900 focus:outline-none focus:ring-2 ${
                                            specialModalType === 'combo' ? 'focus:ring-purple-500' : 'focus:ring-amber-500'
                                        }`}
                                    />
                                </div>
                            </div>

                            {/* Image selector */}
                            <div>
                                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                                    Photo / Banner (Optional)
                                </label>
                                <div className="flex items-center gap-3">
                                    <div className="size-16 rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden flex items-center justify-center shrink-0">
                                        {specialFormImageUrl ? (
                                            <img src={specialFormImageUrl} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <LucideImage size={24} className="text-neutral-300" />
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => specialImageInputRef.current?.click()}
                                                disabled={isUploadingSpecialImage}
                                                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                            >
                                                {isUploadingSpecialImage ? (
                                                    <LucideLoader2 size={13} className="animate-spin" />
                                                ) : (
                                                    <LucideUpload size={13} />
                                                )}
                                                Upload Image
                                            </button>
                                            {specialFormImageUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSpecialFormImageUrl('')}
                                                    className="px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Items Included Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                                        {specialModalType === 'combo' ? 'Dishes in Combo *' : 'Selected Dish *'}
                                    </label>
                                    <span className="text-xs text-neutral-500 font-medium">
                                        {specialModalType === 'combo'
                                            ? `${specialFormItems.length} dishes selected`
                                            : specialFormItems.length > 0 ? '1 dish selected' : 'No dish selected'}
                                    </span>
                                </div>

                                {/* Search/Dropdown to add items */}
                                <div className="relative">
                                    <div className="relative">
                                        <LucideSearch size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                                        <input
                                            type="text"
                                            placeholder={specialModalType === 'combo' ? "Search & add menu item to combo..." : "Search & select dish for today's special..."}
                                            value={specialItemSearch}
                                            onChange={(e) => {
                                                setSpecialItemSearch(e.target.value);
                                                setShowSpecialItemDropdown(true);
                                            }}
                                            onFocus={() => setShowSpecialItemDropdown(true)}
                                            className={`w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 ${
                                                specialModalType === 'combo' ? 'focus:ring-purple-500' : 'focus:ring-amber-500'
                                            }`}
                                        />
                                    </div>

                                    {/* Dropdown list of items */}
                                    {showSpecialItemDropdown && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-xl z-30 max-h-52 overflow-y-auto divide-y divide-neutral-100">
                                            {items
                                                .filter(item => {
                                                    const matches = !specialItemSearch || item.name.toLowerCase().includes(specialItemSearch.toLowerCase());
                                                    const notAdded = specialModalType === 'combo' ? !specialFormItems.some(i => i.menu_item_id === item.id) : true;
                                                    return matches && notAdded;
                                                })
                                                .slice(0, 15)
                                                .map(item => (
                                                    <div
                                                        key={item.id}
                                                        onClick={() => addMenuItemToSpecial(item)}
                                                        className={`p-2.5 px-3 flex items-center justify-between cursor-pointer transition-colors ${
                                                            specialModalType === 'combo' ? 'hover:bg-purple-50/60' : 'hover:bg-amber-50/60'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <DietaryIcon type={item.item_type || (item.is_veg ? 'Veg' : 'Non-Veg')} />
                                                            <span className="text-xs font-semibold text-neutral-800">{item.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-neutral-700">₹{item.price}</span>
                                                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                                                specialModalType === 'combo'
                                                                    ? 'text-purple-600 bg-purple-50'
                                                                    : 'text-amber-700 bg-amber-50'
                                                            }`}>
                                                                {specialModalType === 'combo' ? '+ Add' : 'Select'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            {items.filter(item => (specialModalType === 'combo' ? !specialFormItems.some(i => i.menu_item_id === item.id) : true) && (!specialItemSearch || item.name.toLowerCase().includes(specialItemSearch.toLowerCase()))).length === 0 && (
                                                <div className="p-3 text-center text-xs text-neutral-400">
                                                    No available items match search
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Selected Items List */}
                                {specialFormItems.length > 0 && (
                                    <div className="space-y-2 bg-neutral-50 p-3 rounded-xl border border-neutral-200/80">
                                        {specialFormItems.map(item => (
                                            <div key={item.menu_item_id} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-neutral-200 shadow-2xs">
                                                <div className="flex-1">
                                                    <p className="text-xs font-bold text-neutral-800">{item.name}</p>
                                                    <p className="text-[11px] text-neutral-400">₹{item.price} each</p>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    {specialModalType === 'combo' && (
                                                        <div className="flex items-center border border-neutral-200 rounded-lg overflow-hidden">
                                                            <button
                                                                type="button"
                                                                onClick={() => updateSpecialItemQuantity(item.menu_item_id, -1)}
                                                                className="px-2 py-1 bg-neutral-50 hover:bg-neutral-100 text-xs font-bold text-neutral-600"
                                                            >
                                                                -
                                                            </button>
                                                            <span className="px-2.5 py-1 text-xs font-bold text-neutral-900 bg-white min-w-[24px] text-center">
                                                                {item.quantity}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => updateSpecialItemQuantity(item.menu_item_id, 1)}
                                                                className="px-2 py-1 bg-neutral-50 hover:bg-neutral-100 text-xs font-bold text-neutral-600"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    )}

                                                    <span className="text-xs font-bold text-neutral-800 min-w-[50px] text-right">
                                                        ₹{item.price * item.quantity}
                                                    </span>

                                                    <button
                                                        type="button"
                                                        onClick={() => removeSpecialItem(item.menu_item_id)}
                                                        className="p-1 text-neutral-400 hover:text-rose-500 rounded transition-colors"
                                                    >
                                                        <LucideTrash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}

                                        {/* Total Summary */}
                                        <div className="pt-2 border-t border-neutral-200/80 flex items-center justify-between text-xs font-bold px-1 text-neutral-600">
                                            <span>{specialModalType === 'combo' ? 'Original Total Sum:' : 'Original Dish Price:'}</span>
                                            <span className="text-neutral-900">₹{specialOriginalTotal}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Pricing & Expiry */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-neutral-100">
                                <div>
                                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                                        Special Offer Price (₹) *
                                    </label>
                                    <div className="relative">
                                        <LucideIndianRupee size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={specialFormPrice}
                                            onChange={(e) => setSpecialFormPrice(e.target.value)}
                                            placeholder="e.g. 599"
                                            className={`w-full pl-9 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-900 focus:outline-none focus:ring-2 ${
                                                specialModalType === 'combo' ? 'focus:ring-purple-500' : 'focus:ring-amber-500'
                                            }`}
                                        />
                                    </div>

                                    {/* Savings feedback */}
                                    {specialDiscountPercent > 0 && (
                                        <p className="text-xs text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
                                            <LucidePercent size={12} />
                                            Customer saves ₹{specialSavings} ({specialDiscountPercent}% OFF)
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                                        Valid Until (Optional)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={specialFormValidTo}
                                        onChange={(e) => setSpecialFormValidTo(e.target.value)}
                                        className={`w-full px-3.5 py-2.5 border border-neutral-200 rounded-xl text-xs font-medium text-neutral-900 focus:outline-none focus:ring-2 ${
                                            specialModalType === 'combo' ? 'focus:ring-purple-500' : 'focus:ring-amber-500'
                                        }`}
                                    />
                                    <p className="text-[11px] text-neutral-400 mt-1">Leave blank for unlimited validity</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 px-6 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setShowSpecialModal(false)}
                                className="px-4 py-2 text-sm font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveSpecial}
                                disabled={isSavingSpecial}
                                className={`px-6 py-2 text-sm font-bold text-white rounded-xl shadow-lg transition-all flex items-center gap-2 ${
                                    specialModalType === 'combo'
                                        ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
                                        : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                                }`}
                            >
                                {isSavingSpecial && <LucideLoader2 size={16} className="animate-spin" />}
                                {editingSpecial ? 'Update Deal' : specialModalType === 'combo' ? 'Create Combo' : 'Save Special'}
                            </button>
                        </div>
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
