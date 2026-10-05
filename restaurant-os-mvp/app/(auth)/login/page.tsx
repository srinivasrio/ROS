import { notFound } from 'next/navigation';

/**
 * The main Dine in One website is strictly a public marketing platform.
 * Staff and administrative panels are completely decoupled and accessible
 * only through their respective dedicated subdomains (admin, waiter, kds, delivery, employee).
 * Direct apex-domain access to /login yields 404 (Not Found).
 */
export default function UniversalLoginPage() {
    notFound();
}
