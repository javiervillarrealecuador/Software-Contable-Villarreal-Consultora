'use client';

import Sidebar from './Sidebar';
import { usePathname } from 'next/navigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/signup';

  if (isAuthPage) {
    return <div className="min-h-screen bg-slate-50 font-inter">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-inter">
      <Sidebar />
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Aquí podríamos poner un Header superior en el futuro si se requiere, por ejemplo para búsqueda global o notificaciones */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-end px-6 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button className="text-slate-400 hover:text-slate-600 transition-colors">
              <span className="text-xl">🔔</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold border border-blue-200">
              U
            </div>
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
