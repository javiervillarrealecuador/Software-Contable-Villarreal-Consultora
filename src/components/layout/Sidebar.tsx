'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const pathname = usePathname();

  const menu = [
    { label: 'Dashboard', path: '/', icon: '📊' },
    { label: 'Directorio', path: '/partners', icon: '👥' },
    { label: 'Productos', path: '/products', icon: '🏷️' },
    { label: 'Ventas', path: '/sales', icon: '🛒' },
    { label: 'Compras', path: '/purchases', icon: '🛍️' },
    { label: 'Inventario', path: '/inventory', icon: '📦' },
    { label: 'Contabilidad', path: '/accounting', icon: '📒' },
    { label: 'Impuestos (SRI)', path: '/taxes/withholdings', icon: '🏛️' },
    { label: 'Reportes', path: '/reports', icon: '📈' },
    { label: 'Configuración', path: '/settings', icon: '⚙️' },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 h-screen sticky top-0 flex flex-col shadow-2xl z-50">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/30">
          E
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">ERP Ecuador</h1>
      </div>
      
      <nav className="flex-1 py-6 px-3 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
        {menu.map(item => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                isActive 
                  ? 'bg-blue-600/10 text-blue-400 font-medium shadow-[inset_2px_0_0_0_#2563eb]' 
                  : 'hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400">
          <div className="font-semibold text-slate-300 mb-1">Empresa Activa</div>
          <div>Villarreal Consultora</div>
          <div className="mt-2 pt-2 border-t border-slate-700">
            <Link href="/admin" className="text-blue-400 hover:text-blue-300 transition-colors">
              Cambiar empresa →
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
