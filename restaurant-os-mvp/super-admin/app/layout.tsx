import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Dine In One — Super Admin Portal',
  description: 'Enterprise onboarding pipeline, compliance verification, and restaurant lifecycle administration platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f8fafc] text-slate-800 antialiased font-sans">
        <Toaster position="top-right" richColors theme="light" />
        {children}
      </body>
    </html>
  );
}
