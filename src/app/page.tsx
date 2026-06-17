// src/app/page.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCompanies, getPartnersCount, getProductsCount } from '@/lib/supabase';
import type { Company } from '@/types/capa0';


export default function Dashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState({
    partners: 0,
    products: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const comps = await getCompanies();
      setCompanies(comps);
      
      if (comps.length > 0) {
        setSelectedCompany(comps[0]);
        
        const [partnersCount, productsCount] = await Promise.all([
          getPartnersCount(comps[0].id),
          getProductsCount()
        ]);
        
        setStats({
          partners: partnersCount,
          products: productsCount,
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Panel Principal</h1>
        <p className="text-slate-500 mt-2">Visión general y accesos rápidos de ERP Ecuador</p>
      </div>

      <main>
        {/* Company Selector */}
        <div className="card mb-lg">
          <h2>Selecciona una Empresa</h2>
          <div className="flex gap-md flex-wrap mt-md">
            {companies.map(company => (
              <button
                key={company.id}
                onClick={() => setSelectedCompany(company)}
                className={`px-lg py-md rounded-lg border-2 font-semibold transition-all ${
                  selectedCompany?.id === company.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-blue-600'
                }`}
              >
                {company.name}
                <span className="ml-sm text-xs opacity-75">{company.vat}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        {selectedCompany && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg mb-lg">
              <StatCard
                title="Partners"
                value={stats.partners}
                icon="👥"
                color="blue"
              />
              <StatCard
                title="Productos"
                value={stats.products}
                icon="📦"
                color="green"
              />
              <StatCard
                title="Compañía"
                value={selectedCompany.name}
                icon="🏢"
                color="purple"
              />
              <StatCard
                title="Moneda"
                value="USD"
                icon="💵"
                color="amber"
              />
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              <QuickActionCard
                title="Gestionar Partners"
                description="Clientes, proveedores y contactos"
                icon="👥"
                href="/partners"
                color="blue"
              />
              <QuickActionCard
                title="Gestionar Productos"
                description="Catálogo de productos y servicios"
                icon="📦"
                href="/products"
                color="green"
              />
              <QuickActionCard
                title="Compras"
                description="Órdenes de compra e ingreso a inventario"
                icon="🛒"
                href="/purchases"
                color="purple"
              />
              <QuickActionCard
                title="Ventas"
                description="Facturas de venta, entrega y margen bruto"
                icon="🧾"
                href="/sales"
                color="amber"
              />
              <QuickActionCard
                title="Inventario"
                description="Stock, Kardex y promedio ponderado"
                icon="🏷️"
                href="/inventory"
                color="blue"
              />
              <QuickActionCard
                title="Reportes e IA"
                description="Estados financieros, márgenes, mayores y análisis con IA"
                icon="📈"
                href="/reports"
                color="green"
              />
            </div>
          </>
        )}

        {!selectedCompany && !loading && (
          <div className="card text-center py-2xl">
            <p className="text-xl mb-lg">No hay empresas configuradas</p>
            <button className="btn btn-primary">Crear Primera Empresa</button>
          </div>
        )}
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}) {
  const colorMap = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    purple: 'bg-purple-50 border-purple-200',
    amber: 'bg-amber-50 border-amber-200',
  };

  return (
    <div className={`card ${colorMap[color as keyof typeof colorMap]}`}>
      <div className="text-3xl mb-md">{icon}</div>
      <p className="text-sm text-slate-600 mb-sm">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function QuickActionCard({
  title,
  description,
  icon,
  href,
  color,
}: {
  title: string;
  description: string;
  icon: string;
  href: string;
  color: string;
}) {
  const colorMap = {
    blue: 'border-blue-200 hover:bg-blue-50',
    green: 'border-green-200 hover:bg-green-50',
    purple: 'border-purple-200 hover:bg-purple-50',
    amber: 'border-amber-200 hover:bg-amber-50',
  };

  return (
    <Link href={href}>
      <div className={`card cursor-pointer group h-full ${colorMap[color as keyof typeof colorMap]}`}>
        <div className="flex flex-col h-full justify-between">
          <div>
            <p className="text-4xl mb-4">{icon}</p>
            <h3 className="text-lg font-bold mb-2 group-hover:text-blue-600 transition-colors">{title}</h3>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
          <div className="mt-4 flex justify-end">
            <span className="text-xl text-slate-300 group-hover:text-blue-600 group-hover:translate-x-2 transition-all">→</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
