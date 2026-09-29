import { redirect } from 'next/navigation';

// The restaurant-scoped /portal route has been removed.
// The middleware redirects /[restaurantCode]/portal → /login.
// This server component provides a fallback redirect in case middleware is bypassed.
export default function RestaurantPortalRedirect() {
    redirect('/login');
}
