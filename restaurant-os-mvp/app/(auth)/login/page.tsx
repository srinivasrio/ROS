import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

export default async function UniversalLoginPage() {
    const headersList = await headers();
    const host = headersList.get('host') || '';
    const hostWithoutPort = host.split(':')[0].toLowerCase();
    const isProductionMarketingApex = hostWithoutPort === 'dineinone.com' || hostWithoutPort === 'www.dineinone.com';

    if (isProductionMarketingApex) {
        redirect('https://owner.dineinone.com/login');
    } else {
        redirect('/login/owner');
    }
}

