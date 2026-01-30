'use client';

import { usePathname } from 'next/navigation';
import { AuthProvider, RequireAuth } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';
import AdvisorPanel from '@/components/AdvisorPanel';

const publicRoutes = ['/login'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublicRoute = publicRoutes.includes(pathname);

  return (
    <AuthProvider>
      {isPublicRoute ? (
        children
      ) : (
        <RequireAuth>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-64 p-4 bg-slate-50">
              {children}
            </main>
            {/* Floating AI Advisor */}
            <AdvisorPanel compact />
          </div>
        </RequireAuth>
      )}
    </AuthProvider>
  );
}
