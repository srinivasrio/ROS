'use client';

import { useState, useEffect } from 'react';
import { Search as LucideSearch, Plus as LucidePlus, Trash2 as LucideTrash2, Save as LucideSave, CheckCircle2 as LucideCheckCircle2, BookOpen as LucideBookOpen, AlertTriangle as LucideAlertTriangle } from 'lucide-react';
import { MenuService } from '@/app/services/menu';
import { InventoryService, InventoryItem, InventoryCategory } from '@/app/services/inventory.service';
import { RecipeMapping, RecipeService } from '@/app/services/recipe.service';
import { useRestaurantId } from '@/app/hooks/useRestaurantId';

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

export default function RecipeMappingPage() {
    const { restaurantId, loading: restaurantLoading } = useRestaurantId();
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [categories, setCategories] = useState<InventoryCategory[]>([]);
    const [searchMenuQuery, setSearchMenuQuery] = useState('');
    const [menuFilterType, setMenuFilterType] = useState('All');
    const [menuCategory, setMenuCategory] = useState('All');
    const [loading, setLoading] = useState(true);

    const [selectedMenuItem, setSelectedMenuItem] = useState<any | null>(null);
    const [currentMappings, setCurrentMappings] = useState<any[]>([]);

    // New mapping form
    const [selectedInvItem, setSelectedInvItem] = useState('');
    const [requiredQty, setRequiredQty] = useState('');
    const [selectedUnit, setSelectedUnit] = useState('');
    const [filterCategory, setFilterCategory] = useState('All');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        if (!restaurantLoading && restaurantId) {
            loadInitialData();
        }
    }, [restaurantId, restaurantLoading]);

    const loadInitialData = async () => {
        if (!restaurantId) return;
        setLoading(true);
        try {
            const [mItems, iItems, cItems] = await Promise.all([
                MenuService.fetchMenuItems(restaurantId),
                InventoryService.fetchItems(restaurantId),
                InventoryService.fetchCategories(restaurantId)
            ]);
            setMenuItems(mItems);
            setInventoryItems(iItems);
            setCategories(cItems);
            if (mItems.length > 0) {
                handleSelectMenu(mItems[0]);
            }
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    }

    const handleSelectMenu = async (item: any) => {
        setSelectedMenuItem(item);
        if (!restaurantId) return;
        try {
            const mappings = await RecipeService.fetchMappingsForMenuItem(item.id, restaurantId);
            setCurrentMappings(mappings || []);
        } catch (error) {
            console.error('Failed to load mappings', error);
            setCurrentMappings([]);
        }
    }

    const handleAddMapping = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMenuItem || !selectedInvItem || !requiredQty) return;
        if (!restaurantId) return;

        try {
            const invItem = inventoryItems.find(i => i.id === selectedInvItem);
            if (!invItem) return;

            const unitToUse = selectedUnit || invItem.unit;
            const convertedQty = convertToBaseUnit(Number(requiredQty), unitToUse, invItem.unit);

            await RecipeService.saveMapping(selectedMenuItem.id, selectedInvItem, convertedQty, restaurantId);

            // Reload mappings
            const mappings = await RecipeService.fetchMappingsForMenuItem(selectedMenuItem.id, restaurantId);
            setCurrentMappings(mappings || []);

            setSelectedInvItem('');
            setRequiredQty('');
            setSelectedUnit('');
        } catch (error) {
            console.error('Failed to save mapping', error);
            alert('Failed to save mapping');
        }
    }

    const handleDeleteMapping = async (id: string) => {
        if (!restaurantId) return;
        try {
            await RecipeService.deleteMapping(id, restaurantId);
            setCurrentMappings(currentMappings.filter(m => m.id !== id));
        } catch (error) {
            console.error('Failed to delete mapping', error);
        }
    }

    const filteredMenu = menuItems.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchMenuQuery.toLowerCase());
        const matchesType = menuFilterType === 'All' || item.item_type === menuFilterType || (menuFilterType === 'Veg' && item.is_veg);
        const matchesCat = menuCategory === 'All' || (item.category?.name === menuCategory);
        return matchesSearch && matchesType && matchesCat;
    });

    const uniqueCategories = Array.from(new Set(menuItems.map(m => m.category?.name).filter(Boolean))) as string[];

    if (loading) return <div>Loading...</div>;

    // Filter available inventory items that are not already mapped
    const mappedIds = currentMappings.map(m => m.inventory_item_id);
    const availableInventory = inventoryItems.filter(i => !mappedIds.includes(i.id));

    return (
        <div className="flex gap-6 h-[calc(100vh-140px)]">
            {/* Left Side: Menu Items List */}
            <div className="w-1/3 bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col overflow-hidden">
                <div className="p-4 border-b border-neutral-200 bg-neutral-50/50">
                    <h2 className="font-bold text-black mb-4">Menu Items</h2>

                    <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
                        <button type="button" onClick={() => setMenuFilterType('All')} className={`px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-lg font-bold whitespace-nowrap transition-all ${menuFilterType === 'All' ? 'bg-neutral-800 text-white shadow-sm' : 'bg-white border border-neutral-200 text-black hover:bg-neutral-50 hover:text-black'}`}>All</button>
                        <button type="button" onClick={() => setMenuFilterType('Veg')} className={`px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-lg font-bold flex items-center gap-1 whitespace-nowrap transition-all ${menuFilterType === 'Veg' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50'}`}><span className="w-2 h-2 rounded-sm border border-current flex items-center justify-center p-[1px]"><span className="w-full h-full rounded-full bg-current"></span></span> Veg</button>
                        <button type="button" onClick={() => setMenuFilterType('Non-Veg')} className={`px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-lg font-bold flex items-center gap-1 whitespace-nowrap transition-all ${menuFilterType === 'Non-Veg' ? 'bg-rose-600 text-white shadow-sm' : 'bg-white border border-rose-200 text-rose-600 hover:bg-rose-50'}`}><span className="w-2 h-2 rounded-sm border border-current flex items-center justify-center p-[1px]"><span className="w-full h-full rounded-full bg-current"></span></span> Non-Veg</button>
                        <button type="button" onClick={() => setMenuFilterType('Egg')} className={`px-2.5 py-1 text-[10px] uppercase tracking-wider rounded-lg font-bold flex items-center gap-1 whitespace-nowrap transition-all ${menuFilterType === 'Egg' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white border border-amber-200 text-amber-600 hover:bg-amber-50'}`}><span className="w-2 h-2 rounded-sm border border-current flex items-center justify-center p-[1px]"><span className="w-full h-full rounded-full bg-current"></span></span> Egg</button>
                    </div>

                    <div className="flex gap-2 mb-3">
                        <select
                            value={menuCategory}
                            onChange={(e) => setMenuCategory(e.target.value)}
                            className="w-1/2 px-2 py-2 bg-white border border-neutral-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none text-black"
                        >
                            <option value="All">All Categories</option>
                            {uniqueCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <div className="relative flex-1">
                            <LucideSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-black" size={14} />
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchMenuQuery}
                                onChange={e => setSearchMenuQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-2 bg-white border border-neutral-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-black"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                    {filteredMenu.map(item => (
                        <button
                            key={item.id}
                            onClick={() => handleSelectMenu(item)}
                            className={`w-full text-left px-4 py-3 rounded-xl mb-1 transition-colors flex items-center justify-between group ${selectedMenuItem?.id === item.id ? 'bg-blue-50 text-blue-900 font-medium' : 'hover:bg-neutral-50 text-black'}`}
                        >
                            <span className="truncate pr-4 flex items-center gap-2">
                                {(() => {
                                    const type = item.item_type === 'Veg' || item.is_veg ? 'Veg' : item.item_type === 'Non-Veg' ? 'Non-Veg' : item.item_type === 'Egg' ? 'Egg' : 'Other';
                                    if (type === 'Other') return <span className="w-4 h-4 rounded-sm border border-neutral-300 bg-neutral-100 flex-shrink-0"></span>;

                                    const colorMap = { 'Veg': 'text-emerald-600 border-emerald-600', 'Non-Veg': 'text-rose-600 border-rose-600', 'Egg': 'text-amber-500 border-amber-500' };
                                    return (
                                        <span className={`w-3.5 h-3.5 flex items-center justify-center border-2 rounded-sm flex-shrink-0 ${colorMap[type]}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${type === 'Veg' ? 'bg-emerald-600' : type === 'Non-Veg' ? 'bg-rose-600' : 'bg-amber-500'}`}></span>
                                        </span>
                                    );
                                })()}
                                {item.name}
                            </span>
                            <LucideCheckCircle2 size={16} className={`shrink-0 ${selectedMenuItem?.id === item.id ? 'text-blue-600' : 'text-transparent group-hover:text-black'}`} />
                        </button>
                    ))}
                    {filteredMenu.length === 0 && (
                        <p className="p-4 text-center text-sm text-black">No menu items found.</p>
                    )}
                </div>
            </div>

            {/* Right Side: Recipe Mapping Form & Data */}
            <div className="flex-1 bg-white rounded-2xl border border-neutral-200 shadow-sm flex flex-col overflow-hidden relative">
                {selectedMenuItem ? (
                    <>
                        <div className="p-6 border-b border-neutral-200 bg-neutral-50/50">
                            <h2 className="text-xl font-bold text-black mb-1">{selectedMenuItem.name} <span className="text-sm font-normal text-black bg-neutral-200 px-2 py-0.5 rounded-full ml-2">Recipe</span></h2>
                            <p className="text-sm text-black">Map the raw materials required to prepare this item. These will be auto-deducted from inventory upon order confirmation.</p>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto">
                            {/* Current Mappings Table */}
                            {currentMappings.length > 0 ? (
                                <div className="border border-neutral-200 rounded-xl overflow-hidden mb-8">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-neutral-50 text-xs font-semibold text-black uppercase tracking-wider">
                                                <th className="p-4 border-b">Raw Material</th>
                                                <th className="p-4 border-b">Quantity Required</th>
                                                <th className="p-4 border-b w-16"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-neutral-100">
                                            {currentMappings.map(mapping => (
                                                <tr key={mapping.id} className="hover:bg-neutral-50/50 transition-colors">
                                                    <td className="p-4 font-medium text-black">{mapping.inventory_item?.name || 'Unknown Item'}</td>
                                                    <td className="p-4 text-black">{mapping.quantity_required} {mapping.inventory_item?.unit || 'units'}</td>
                                                    <td className="p-4 text-right">
                                                        <button
                                                            onClick={() => handleDeleteMapping(mapping.id)}
                                                            className="text-black hover:text-rose-600 transition-colors p-1"
                                                        >
                                                            <LucideTrash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12 px-4 bg-neutral-50 border border-neutral-200 border-dashed rounded-xl mb-8">
                                    <LucideBookOpen size={32} className="mx-auto text-black mb-3" />
                                    <h3 className="text-sm font-bold text-black mb-1">No ingredients mapped</h3>
                                    <p className="text-xs text-black">Add raw materials below to automatically track stock usage for {selectedMenuItem.name}.</p>
                                </div>
                            )}

                            {/* Add New Mapping Form */}
                            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                                        <LucidePlus size={16} /> Add Ingredient
                                    </h3>
                                </div>
                                <form onSubmit={handleAddMapping} className="flex gap-4 items-end">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-end mb-1.5 gap-2">
                                            <label className="block text-xs font-medium text-blue-800">Raw Material</label>
                                            <select
                                                value={filterCategory}
                                                onChange={(e) => setFilterCategory(e.target.value)}
                                                className="text-[10px] border border-blue-200 bg-white rounded flex-1 focus:outline-none p-1 max-w-[120px]"
                                            >
                                                <option value="All">All Categories</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="relative w-full">
                                            <button
                                                type="button"
                                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                                className="w-full flex items-center justify-between border border-blue-200 bg-white rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-left"
                                            >
                                                {selectedInvItem ? (
                                                    <span className="flex items-center gap-2 truncate">
                                                        <DietaryIcon type={inventoryItems.find(i => i.id === selectedInvItem)?.item_type} />
                                                        {inventoryItems.find(i => i.id === selectedInvItem)?.name}
                                                        <span className="text-black ml-1 text-xs">
                                                            (Stock: {inventoryItems.find(i => i.id === selectedInvItem)?.current_stock} {inventoryItems.find(i => i.id === selectedInvItem)?.unit})
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="text-black">Select material...</span>
                                                )}
                                                <svg className={`shrink-0 w-4 h-4 text-black transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                            </button>

                                            {isDropdownOpen && (
                                                <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                                    {(() => {
                                                        const filtered = availableInventory.filter(i =>
                                                            (filterCategory === 'All' || i.category_id === filterCategory)
                                                        );
                                                        const grouped = filtered.reduce((acc, item) => {
                                                            const cat = categories.find(c => c.id === item.category_id)?.name || item.category || 'Uncategorized';
                                                            if (!acc[cat]) acc[cat] = [];
                                                            acc[cat].push(item);
                                                            return acc;
                                                        }, {} as Record<string, InventoryItem[]>);

                                                        if (filtered.length === 0) {
                                                            return <div className="p-3 text-sm text-black text-center">No ingredients found</div>;
                                                        }

                                                        return Object.entries(grouped).map(([cat, items]) => (
                                                            <div key={cat}>
                                                                <div className="px-3 py-1.5 text-xs font-bold text-black bg-neutral-50 border-y border-neutral-100 uppercase tracking-wider sticky top-0">{cat}</div>
                                                                {items.map(item => (
                                                                    <button
                                                                        key={item.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedInvItem(item.id);
                                                                            setSelectedUnit(item.unit);
                                                                            setIsDropdownOpen(false);
                                                                        }}
                                                                        className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-blue-50 transition-colors ${selectedInvItem === item.id ? 'bg-blue-50/50' : ''}`}
                                                                    >
                                                                        <span className="flex items-center gap-2 truncate">
                                                                            <DietaryIcon type={item.item_type} />
                                                                            {item.name}
                                                                        </span>
                                                                        <span className="text-xs text-black whitespace-nowrap ml-2">Stock: {item.current_stock} {item.unit}</span>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ));
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="w-40 relative">
                                        <label className="block text-xs font-medium text-blue-800 mb-1.5">Amount</label>
                                        <div className="relative">
                                            <input
                                                required
                                                type="number"
                                                step="0.001"
                                                value={requiredQty}
                                                onChange={e => setRequiredQty(e.target.value)}
                                                className="w-full border border-blue-200 bg-white rounded-lg p-2.5 pr-16 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                placeholder="e.g. 0.5"
                                            />
                                            {selectedInvItem && (
                                                <select
                                                    value={selectedUnit}
                                                    onChange={e => setSelectedUnit(e.target.value)}
                                                    className="absolute right-1 top-1 bottom-1 bg-transparent text-xs text-black border-none focus:ring-0 outline-none cursor-pointer pr-4 appearance-none hover:bg-neutral-50 rounded"
                                                    style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23666666%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 4px center', backgroundSize: '8px auto', paddingRight: '16px', paddingLeft: '4px' }}
                                                >
                                                    {getSubUnits(inventoryItems.find(i => i.id === selectedInvItem)?.unit || '').map(u => (
                                                        <option key={u} value={u}>{u}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={availableInventory.length === 0}
                                        className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-[42px]"
                                    >
                                        <LucideSave size={16} /> Map
                                    </button>
                                </form>
                                {availableInventory.length === 0 && inventoryItems.length > 0 && (
                                    <p className="text-xs text-amber-600 mt-3 flex items-center gap-1"><LucideAlertTriangle size={12} /> All available inventory items have already been mapped to this recipe.</p>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-black flex-col gap-3">
                        <LucideBookOpen size={48} className="opacity-20" />
                        <p>Select a menu item from the left to view or edit its recipe mapping.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

