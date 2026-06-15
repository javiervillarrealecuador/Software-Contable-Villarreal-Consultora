'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPartners, getCompanies } from '@/lib/supabase';
import type { Partner, Company } from '@/types/capa0';

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    if (selectedCompany) {
      loadPartners();
    }
  }, [selectedCompany]);

  async function loadCompanies() {
    try {
      const comps = await getCompanies();
      setCompanies(comps);
      if (comps.length > 0) {
        setSelectedCompany(comps[0].id);
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  }

  async function loadPartners() {
    if (!selectedCompany) return;
    try {
      setLoading(true);
      const data = await getPartners(selectedCompany);
      setPartners(data || []);
    } catch (error) {
      console.error('Error loading partners:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredPartners = partners.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.vat?.includes(searchTerm)
  );

  return (
    <div className="w-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Directorio de Partners</h1>
          <p className="text-slate-500 mt-2">Gestión de clientes, proveedores y contactos</p>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/partners/new" className="btn btn-primary shadow-lg shadow-blue-500/30">
            + Nuevo Partner
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* Company Selector */}
        <div className="card mb-lg">
          <label className="block text-sm font-semibold mb-md">Empresa</label>
          <select
            value={selectedCompany || ''}
            onChange={(e) => setSelectedCompany(Number(e.target.value))}
            className="w-full"
          >
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.name} ({company.vat})
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="card mb-lg">
          <input
            type="text"
            placeholder="Buscar por nombre o RUC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Partners Table */}
        <div className="card">
          {loading ? (
            <p className="text-center py-2xl">Cargando...</p>
          ) : filteredPartners.length === 0 ? (
            <p className="text-center py-2xl text-slate-600">
              {searchTerm ? 'No se encontraron resultados' : 'No hay partners agregados'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>RUC/Cédula</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Ciudad</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPartners.map(partner => (
                    <tr key={partner.id}>
                      <td className="font-semibold">{partner.name}</td>
                      <td>
                        <div className="flex gap-1 flex-wrap max-w-xs">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            partner.is_company
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {partner.is_company ? 'Empresa' : 'Persona'}
                          </span>
                          {partner.is_customer && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Cliente</span>
                          )}
                          {partner.is_supplier && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">Proveedor</span>
                          )}
                          {partner.is_employee && (
                            <span className="px-2 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">Empleado</span>
                          )}
                        </div>
                      </td>
                      <td className="font-mono text-sm">{partner.vat || '-'}</td>
                      <td>{partner.email || '-'}</td>
                      <td>{partner.phone || '-'}</td>
                      <td>{partner.city || '-'}</td>
                      <td>
                        <Link
                          href={`/partners/${partner.id}`}
                          className="btn btn-ghost text-sm"
                        >
                          ✏️ Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
