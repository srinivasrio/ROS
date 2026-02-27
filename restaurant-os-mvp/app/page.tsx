import Link from 'next/link';
import { LucideChefHat, LucideLayoutDashboard, LucideUtensilsCrossed, LucideUserCheck } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">
            Restaurant OS
          </h1>
          <p className="text-neutral-400 text-lg md:text-xl font-medium">
            Select your role to continue
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Admin Dashboard */}
          <Link
            href="/admin/dashboard"
            className="group relative bg-neutral-900 border border-neutral-800 rounded-3xl p-8 hover:border-orange-500/50 hover:bg-neutral-800/50 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="p-3 bg-neutral-800 rounded-2xl group-hover:bg-orange-500/20 group-hover:text-orange-500 transition-colors">
                <LucideLayoutDashboard size={32} />
              </div>
              <span className="text-neutral-500 group-hover:text-white transition-colors">→</span>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-neutral-200 group-hover:text-white">Admin Portal</h2>
            <p className="text-neutral-400 text-sm">Manage menu, staff, tables, and view analytics.</p>
          </Link>

          {/* Waiter Dashboard */}
          <Link
            href="/waiter/dashboard"
            className="group relative bg-neutral-900 border border-neutral-800 rounded-3xl p-8 hover:border-blue-500/50 hover:bg-neutral-800/50 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="p-3 bg-neutral-800 rounded-2xl group-hover:bg-blue-500/20 group-hover:text-blue-500 transition-colors">
                <LucideUserCheck size={32} />
              </div>
              <span className="text-neutral-500 group-hover:text-white transition-colors">→</span>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-neutral-200 group-hover:text-white">Waiter Panel</h2>
            <p className="text-neutral-400 text-sm">Take orders, manage tables, and track status.</p>
          </Link>

          {/* Kitchen Display */}
          <Link
            href="/kitchen"
            className="group relative bg-neutral-900 border border-neutral-800 rounded-3xl p-8 hover:border-green-500/50 hover:bg-neutral-800/50 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="p-3 bg-neutral-800 rounded-2xl group-hover:bg-green-500/20 group-hover:text-green-500 transition-colors">
                <LucideChefHat size={32} />
              </div>
              <span className="text-neutral-500 group-hover:text-white transition-colors">→</span>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-neutral-200 group-hover:text-white">Kitchen Display</h2>
            <p className="text-neutral-400 text-sm">View incoming orders and manage preparation.</p>
          </Link>
        </div>

        <div className="mt-16 text-center text-neutral-600 text-sm">
          <p>© 2024 Restaurant OS. All rights reserved.</p>
        </div>
      </div>
    </main>
  );
}
