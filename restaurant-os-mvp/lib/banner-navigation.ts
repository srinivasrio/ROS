/**
 * banner-navigation.ts
 * Clean utilities for banner destination resolution, custom pages, CTA suggestions,
 * and safe customer redirect routing.
 */

import { Banner } from '@/services/banner.service';

export type BannerDestinationType =
  | 'none'
  | 'menu_item'
  | 'combo'
  | 'category'
  | 'special'
  | 'offer'
  | 'service'
  | 'custom_page';

export interface DestinationTypeOption {
  type: BannerDestinationType;
  label: string;
  description: string;
}

export const BANNER_DESTINATION_TYPES: DestinationTypeOption[] = [
  { type: 'none', label: 'None', description: 'Banner is non-clickable' },
  { type: 'menu_item', label: 'Menu Item', description: 'Open exact dish detail view directly' },
  { type: 'combo', label: 'Combo', description: 'Open exact combo meal record directly' },
  { type: 'special', label: 'Special', description: "Open exact chef special record directly" },
  { type: 'offer', label: 'Offer', description: 'Open exact offer/coupon record directly' },
  { type: 'service', label: 'Service', description: 'Open exact guest service request directly' },
  { type: 'category', label: 'Category', description: 'Filter menu by this category' },
  { type: 'custom_page', label: 'Custom Page', description: 'Redirect to a customer portal page' },
];

export interface CustomPageOption {
  key: string;
  label: string;
  route: string;
  suggestedCta: string;
}

export const CUSTOM_PAGE_OPTIONS: CustomPageOption[] = [
  { key: 'menu', label: 'Full Menu', route: 'menu', suggestedCta: 'Explore Menu' },
  { key: 'specials', label: "Today's Specials", route: 'specials', suggestedCta: 'View Specials' },
  { key: 'combos', label: 'Combo Meals', route: 'combos', suggestedCta: 'View Combos' },
  { key: 'offers', label: 'Offers & Coupons', route: 'offers', suggestedCta: 'Claim Offers' },
  { key: 'services', label: 'Guest Services', route: 'services', suggestedCta: 'Request Service' },
  { key: 'popular', label: 'Popular Dishes', route: 'popular', suggestedCta: 'Explore Popular' },
  { key: 'cart', label: 'Cart', route: 'cart', suggestedCta: 'View Cart' },
  { key: 'myorders', label: 'My Orders / History', route: 'myorders', suggestedCta: 'Order History' },
];

export const CTA_PRESETS: Record<string, string[]> = {
  menu_item: ['Order Now', 'View Dish', 'Add to Cart', 'Explore Menu'],
  combo: ['View Combo', 'Order Combo', 'Explore Combos', 'Order Now'],
  category: ['Explore Menu', 'View Category', 'Browse Items', 'Order Now'],
  special: ['View Special', 'Order Special', "Today's Pick", 'Order Now'],
  offer: ['Claim Offer', 'View Deals', 'Get Discount', 'Order Now'],
  service: ['Request Service', 'View Services', 'Call Waiter', 'Explore'],
  custom_page: ['Explore Menu', 'View Specials', 'View Combos', 'View Offers', 'Order Now'],
  none: ['Order Now', 'Explore Menu', 'View Special'],
};

/**
 * Returns suggested CTAs for a given destination type.
 */
export function getSuggestedCtas(type: BannerDestinationType | string): string[] {
  return CTA_PRESETS[type] || CTA_PRESETS.none;
}

/**
 * Safely resolves a banner destination into a customer-facing URL.
 * Never throws errors or produces broken 404s for deleted destinations.
 * Returns null if the banner has no destination (non-clickable) or if target is deleted.
 */
export function resolveBannerDestination(
  banner: Partial<Banner> | null | undefined,
  restaurantCodeOrId: string,
  tableNumber: string = '1',
  data?: {
    menuItems?: any[];
    categories?: any[];
    combos?: any[];
    specials?: any[];
    offers?: any[];
    services?: any[];
  }
): string | null {
  if (!banner || !banner.redirect_type || banner.redirect_type === 'none') {
    return null;
  }

  const table = encodeURIComponent(tableNumber || '1');
  const restCode = encodeURIComponent(restaurantCodeOrId || '');
  if (!restCode) return null;
  const prefix = `/${restCode}/customer`;

  try {
    switch (banner.redirect_type) {
      case 'menu_item': {
        const itemId = banner.redirect_target?.trim();
        if (!itemId) return null;

        // If menu items data is loaded, verify item existence
        if (data?.menuItems && data.menuItems.length > 0) {
          const item = data.menuItems.find(
            (m: any) => m.id?.toString() === itemId || m.name?.toLowerCase() === itemId.toLowerCase()
          );
          if (!item) {
            // Item was deleted or unavailable: safely disable link
            return null;
          }
          // Directly target the exact menu item without category filtering
          return `${prefix}/menu/${table}?item=${encodeURIComponent(item.id)}`;
        }

        return `${prefix}/menu/${table}?item=${encodeURIComponent(itemId)}`;
      }

      case 'combo': {
        const comboId = banner.redirect_target?.trim();
        if (!comboId) return null;
        if (comboId === 'all') return `${prefix}/combos/${table}`;

        if (data?.combos && data.combos.length > 0) {
          const combo = data.combos.find((c: any) => c.id?.toString() === comboId);
          if (!combo) {
            // Combo deleted/unavailable: safely disable link
            return null;
          }
          return `${prefix}/combos/${table}?id=${encodeURIComponent(combo.id || comboId)}`;
        }
        return `${prefix}/combos/${table}?id=${encodeURIComponent(comboId)}`;
      }

      case 'special': {
        const specialId = banner.redirect_target?.trim();
        if (!specialId) return null;
        if (specialId === 'all') return `${prefix}/specials/${table}`;

        if (data?.specials && data.specials.length > 0) {
          const special = data.specials.find((s: any) => s.id?.toString() === specialId);
          if (!special) {
            // Special deleted/unavailable: safely disable link
            return null;
          }
          return `${prefix}/specials/${table}?id=${encodeURIComponent(special.id || specialId)}`;
        }
        return `${prefix}/specials/${table}?id=${encodeURIComponent(specialId)}`;
      }

      case 'offer': {
        const offerId = banner.redirect_target?.trim();
        if (!offerId || offerId === 'all') return `${prefix}/offers/${table}`;

        if (data?.offers && data.offers.length > 0) {
          const offer = data.offers.find((o: any) => o.id?.toString() === offerId);
          if (!offer) {
            // Offer deleted/unavailable: safely disable link
            return null;
          }
          return `${prefix}/offers/${table}?id=${encodeURIComponent(offer.id || offerId)}`;
        }
        return `${prefix}/offers/${table}?id=${encodeURIComponent(offerId)}`;
      }

      case 'service': {
        const serviceId = banner.redirect_target?.trim();
        if (!serviceId || serviceId === 'all') return `${prefix}/services/${table}`;

        if (data?.services && data.services.length > 0) {
          const service = data.services.find(
            (s: any) => s.id?.toString() === serviceId || s.service_key === serviceId
          );
          if (!service) {
            // Service deleted/unavailable: safely disable link
            return null;
          }
          return `${prefix}/services/${table}?id=${encodeURIComponent(service.id || serviceId)}`;
        }
        return `${prefix}/services/${table}?id=${encodeURIComponent(serviceId)}`;
      }

      case 'category': {
        const catTarget = banner.redirect_target?.trim();
        if (!catTarget) return null;

        if (data?.categories && data.categories.length > 0) {
          const cat = data.categories.find(
            (c: any) =>
              c.id?.toString() === catTarget ||
              c.name?.toLowerCase() === catTarget.toLowerCase()
          );
          if (!cat) {
            // Category was deleted: safely disable link
            return null;
          }
          return `${prefix}/menu/${table}?category=${encodeURIComponent(cat.name || cat.id)}`;
        }

        return `${prefix}/menu/${table}?category=${encodeURIComponent(catTarget)}`;
      }

      case 'custom_page': {
        const target = (banner.redirect_target || '').toLowerCase().trim();
        const validPage = CUSTOM_PAGE_OPTIONS.find((p) => p.key === target || p.route === target);
        if (!validPage) return null;
        return `${prefix}/${validPage.route}/${table}`;
      }

      default: {
        return null;
      }
    }
  } catch (err) {
    console.warn('[resolveBannerDestination] Failed to resolve URL:', err);
    return null;
  }
}
