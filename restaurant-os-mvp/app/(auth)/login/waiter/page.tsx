import { redirect } from 'next/navigation';

// Legacy role-specific login pages are removed.
// All users must use the unified login at /login.
export default function WaiterLoginRedirect() {
    redirect('/login');
}
