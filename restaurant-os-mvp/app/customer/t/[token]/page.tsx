import { redirect } from 'next/navigation';

export default async function CustomerTokenRootPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = await params;
    redirect(`/customer/t/${token}/home`);
}
