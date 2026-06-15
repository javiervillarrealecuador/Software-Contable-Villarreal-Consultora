// src/app/partners/page.tsx

'use client';

import { useState, useEffect } from 'react';

import { getPartners, createPartner, updatePartner, getCompanies } from '@/lib/supabase';
import type { Partner, Company, PartnerFormData } from '@/types/capa0';

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<PartnerFormData>({
    name: '',
    email: '',
    phone: '',
    vat: '',
    is_company: false,
    country_id: undefined,
    state_id: undefined,
    city: '',
  });

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCompany) return;

    try {
      const partnerData = {
        ...formData,
        company_id: selectedCompany,
      };

      if (editingPartner) {
        await updatePartner(editingPartner.id, partnerData);
      } else {
        await createPartner(partnerData);
      }

      setIsModalOpen(false);
      setEditingPartner(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        vat: '',
        is_company: false,
        country_id: undefined,
        state_id: undefined,
        city: '',
      });
      loadPartners();
    } catch (error) {
      console.error('Error saving partner:', error);
      alert('Error al guardar');
    }
  }

  function openEditModal(partner: Partner) {
    setEditingPartner(partner);
    setFormData({
      name: partner.name,
      email: partner.email,
      phone: partner.phone,
      vat: partner.vat,
      is_company: partner.is_company,
      country_id: partner.country_id,
      state_id: partner.state_id,
      city: partner.city,
    });
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingPartner(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      vat: '',
      is_company: false,
      country_id: undefined,
      state_id: undefined,
      city: '',
    });
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
          <button onClick={() => { closeModal(); setIsModalOpen(true); }} className="btn btn-primary shadow-lg shadow-blue-500/30">
            + Nuevo Partner
          </button>
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
                        <span className={`px-md py-sm rounded-full text-xs font-semibold ${
                          partner.is_company
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {partner.is_company ? 'Empresa' : 'Persona'}
                        </span>
                      </td>
                      <td className="font-mono text-sm">{partner.vat || '-'}</td>
                      <td>{partner.email || '-'}</td>
                      <td>{partner.phone || '-'}</td>
                      <td>{partner.city || '-'}</td>
                      <td>
                        <button
                          onClick={() => openEditModal(partner)}
                          className="btn btn-ghost text-sm"
                        >
                          ✏️ Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-xl">
            <h2 className="mb-lg">{editingPartner ? 'Editar Partner' : 'Nuevo Partner'}</h2>

            <form onSubmit={handleSubmit} className="space-y-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                <div>
                  <label className="block text-sm font-semibold mb-sm">Nombre *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-sm">RUC/Cédula</label>
                  <input
                    type="text"
                    value={formData.vat || ''}
                    onChange={(e) => setFormData({ ...formData, vat: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-sm">Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-sm">Teléfono</label>
                  <input
                    type="tel"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-sm">Ciudad</label>
                  <input
                    type="text"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-sm mt-lg cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_company}
                      onChange={(e) => setFormData({ ...formData, is_company: e.target.checked })}
                    />
                    <span className="text-sm font-semibold">¿Es una empresa?</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-md pt-lg border-t border-slate-200">
                <button type="submit" className="btn btn-primary flex-1">
                  {editingPartner ? 'Actualizar' : 'Crear'} Partner
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-outline flex-1"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
