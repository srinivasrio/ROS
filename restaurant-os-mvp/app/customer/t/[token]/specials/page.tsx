'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function CustomerTokenSpecialsPage() {
    const params = useParams();
    const router = useRouter();
    const token = (params?.token as string) || '';

    useEffect(() => {
        if (token) {
            router.replace(`/customer/t/${token}/menu`);
        }
    }, [token, router]);

    return null;
}
