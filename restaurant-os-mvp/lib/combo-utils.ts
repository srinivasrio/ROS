import { getCategoryMenuItemImage } from '@/lib/utils';

export interface ComboSubItem {
    name: string;
    quantity: number;
    price?: number;
    image_url?: string;
    item_type?: string;
    menu_item_id?: number | string | null;
}

/**
 * Robustly parses and extracts constituent sub-items from any order item payload.
 * Handles nested arrays, JSON-stringified payloads, legacy specialItemsData, and comma-separated fallback strings.
 */
export function parseComboSubItems(item: any): ComboSubItem[] {
    if (!item) return [];

    let raw = item.combo_items ?? item.specialItemsData ?? item.items ?? item.sub_items;

    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try {
                raw = JSON.parse(trimmed);
            } catch {
                raw = [];
            }
        }
    }

    if (Array.isArray(raw) && raw.length > 0) {
        return raw.map((si: any) => {
            const subName = (si.name || si.title || si.menu_item?.name || 'Item').trim();
            const subImg = si.image_url || si.menu_item?.image_url || getCategoryMenuItemImage(subName);
            const lowerName = subName.toLowerCase();
            const isNonVeg = lowerName.includes('chicken') || lowerName.includes('mutton') || lowerName.includes('fish') || lowerName.includes('prawn') || lowerName.includes('egg') || lowerName.includes('meat') || lowerName.includes('pork') || lowerName.includes('beef');
            const itemType = si.item_type || si.menu_item?.item_type || (isNonVeg ? 'Non-Veg' : 'Veg');
            const subPrice = Number(si.price ?? si.menu_item?.price ?? si.unit_price ?? si.price_at_time ?? 0);

            return {
                name: subName,
                quantity: Number(si.quantity) || 1,
                price: !isNaN(subPrice) ? subPrice : 0,
                image_url: subImg,
                item_type: itemType,
                menu_item_id: si.menu_item_id || si.id || null
            };
        });
    }

    // Fallback: Parse comma-separated specialItems string if available (e.g. "Item A × 2, Item B × 1")
    if (item.specialItems && typeof item.specialItems === 'string') {
        return item.specialItems.split(',').map((s: string) => {
            const parts = s.trim().split('×');
            const subName = (parts[0]?.trim() || s.trim());
            const qty = parts[1] ? parseInt(parts[1].trim(), 10) || 1 : 1;
            const lowerName = subName.toLowerCase();
            const isNonVeg = lowerName.includes('chicken') || lowerName.includes('mutton') || lowerName.includes('fish') || lowerName.includes('prawn') || lowerName.includes('egg');
            return {
                name: subName,
                quantity: qty,
                price: Number(item.price ? Math.round(Number(item.price) / 2) : 0),
                image_url: getCategoryMenuItemImage(subName),
                item_type: isNonVeg ? 'Non-Veg' : 'Veg'
            };
        });
    }

    return [];
}

/**
 * Checks if an item is a combo or bundle containing multiple sub-items.
 */
export function isComboItem(item: any): boolean {
    if (!item) return false;
    const itemType = (item.item_type || '').toLowerCase();
    if (itemType === 'combo' || itemType === 'special' || item.is_combo || item.isSpecial || item.combo_id || item.combo_name) {
        return true;
    }
    const subs = parseComboSubItems(item);
    if (subs.length > 0) return true;
    return false;
}

/**
 * Enriches sub-items with menu item pricing, images, and food type if missing.
 */
export function enrichComboSubItemsWithMenu(subItems: ComboSubItem[], menuItems: any[]): ComboSubItem[] {
    if (!subItems || subItems.length === 0 || !menuItems || menuItems.length === 0) return subItems;

    const mapById = new Map<string, any>();
    const mapByName = new Map<string, any>();

    menuItems.forEach((m) => {
        if (m.id != null) {
            mapById.set(String(m.id), m);
        }
        if (m.name) {
            mapByName.set(m.name.trim().toLowerCase(), m);
        }
    });

    return subItems.map((sub) => {
        let price = Number(sub.price || 0);
        let img = sub.image_url;
        let type = sub.item_type;

        const matched = (sub.menu_item_id ? mapById.get(String(sub.menu_item_id)) : null) ||
                        (sub.name ? mapByName.get(sub.name.trim().toLowerCase()) : null);

        if (matched) {
            if (!price) price = Number(matched.price || 0);
            if (!img) img = matched.image_url;
            if (!type) type = matched.item_type || (matched.is_veg ? 'Veg' : 'Non-Veg');
        }

        if (!img) img = getCategoryMenuItemImage(sub.name || 'Item');

        return {
            ...sub,
            name: sub.name || matched?.name || 'Item',
            quantity: Number(sub.quantity) || 1,
            price,
            image_url: img,
            item_type: type || 'Veg',
            menu_item_id: sub.menu_item_id || matched?.id || null
        };
    });
}
