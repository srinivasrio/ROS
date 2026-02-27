
import { LucideGlassWater, LucideReceipt, LucideUtensils, LucideHandPlatter, LucideDisc, LucideSoup, LucideWind, LucideDroplet, LucideGripHorizontal, LucidePipette } from 'lucide-react';

export const getServiceRequestDetails = (type: string) => {
    switch (type) {
        case 'order_ready':
            return {
                label: 'Order Ready',
                icon: LucideGlassWater,
                image: '/services/Waiter.png', // Placeholder
                color: 'text-green-600',
                bg: 'bg-green-100',
                borderColor: 'border-green-200'
            };
        case 'bill_requested':
            return {
                label: 'Bill Requested',
                icon: LucideReceipt,
                image: '/services/Bill.png',
                color: 'text-purple-600',
                bg: 'bg-purple-100',
                borderColor: 'border-purple-200'
            };
        case 'water_requested':
            return {
                label: 'Water',
                icon: LucideGlassWater,
                image: '/services/Water.png',
                color: 'text-blue-600',
                bg: 'bg-blue-100',
                borderColor: 'border-blue-200'
            };
        case 'cutlery_requested':
            return {
                label: 'Cutlery',
                icon: LucideUtensils,
                image: '/services/Cutlery.webp',
                color: 'text-emerald-600',
                bg: 'bg-emerald-100',
                borderColor: 'border-emerald-200'
            };
        case 'glass_requested':
            return {
                label: 'Extra Glass',
                icon: LucideGlassWater,
                image: '/services/Glass.jpg',
                color: 'text-sky-600',
                bg: 'bg-sky-100',
                borderColor: 'border-sky-200'
            };
        case 'straw_requested':
            return {
                label: 'Straw',
                icon: LucidePipette,
                image: '/services/Straw.png',
                color: 'text-yellow-600',
                bg: 'bg-yellow-100',
                borderColor: 'border-yellow-200'
            };
        case 'plate_requested':
            return {
                label: 'Extra Plate',
                icon: LucideDisc,
                image: '/services/Plate.png',
                color: 'text-zinc-600',
                bg: 'bg-zinc-100',
                borderColor: 'border-zinc-200'
            };
        case 'bowl_requested':
            return {
                label: 'Finger Bowl',
                icon: LucideSoup,
                image: '/services/Finger bowl.jpg',
                color: 'text-teal-600',
                bg: 'bg-teal-100',
                borderColor: 'border-teal-200'
            };
        case 'salt_requested':
            return {
                label: 'Salt',
                icon: LucideGripHorizontal,
                image: '/services/Salt.jpg',
                color: 'text-stone-600',
                bg: 'bg-stone-100',
                borderColor: 'border-stone-200'
            };
        case 'pepper_requested':
            return {
                label: 'Pepper',
                icon: LucideWind,
                image: '/services/Pepper.jpg',
                color: 'text-stone-600',
                bg: 'bg-stone-100',
                borderColor: 'border-stone-200'
            };
        case 'sauce_requested':
            return {
                label: 'Ketchup',
                icon: LucideDroplet,
                image: '/services/Ketchup.jpg',
                color: 'text-red-600',
                bg: 'bg-red-100',
                borderColor: 'border-red-200'
            };
        case 'call_waiter':
        default:
            return {
                label: 'Call Waiter',
                icon: LucideHandPlatter,
                image: '/services/Waiter.png',
                color: 'text-orange-600',
                bg: 'bg-orange-100',
                borderColor: 'border-orange-200'
            };
    }
};
