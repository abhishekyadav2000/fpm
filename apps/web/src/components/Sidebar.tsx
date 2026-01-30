'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Receipt,
  PiggyBank,
  TrendingUp,
  Briefcase,
  Gem,
  Upload,
  Settings,
  Bot,
  Wallet,
  Tag
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/ledger', label: 'Ledger', icon: Receipt },
  { href: '/categories', label: 'Categories', icon: Tag },
  { href: '/budgets', label: 'Budgets', icon: PiggyBank },
  { href: '/net-worth', label: 'Net Worth', icon: TrendingUp },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/insights', label: 'Insight Miner', icon: Gem },
  { href: '/import', label: 'Import', icon: Upload },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-slate-900 text-white">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-8">
          <Bot className="w-8 h-8 text-emerald-400" />
          <span className="text-xl font-bold">FPM</span>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-700">
        <div className="text-xs text-slate-400">
          <p>Local-first • Offline AI</p>
          <p className="mt-1">All data stays on your machine</p>
        </div>
      </div>
    </aside>
  );
}
