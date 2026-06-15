'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPartner, updatePartner, getCompanies } from '@/lib/supabase';
import type { Partner, PartnerFormData, Company } from '@/types/capa0';

interface PartnerFormProps {
  initialData?: Partner | null;
  onSaved?: () => void;
}

export default function PartnerForm({ initialData, onSaved }: PartnerFormProps) {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<PartnerFormData>({
    name: '',
    email: '',
    phone: '',
    mobile: '',
    vat: '',
    is_company: false,
    company_name: '',
    country_id: undefined,
    state_id: undefined,
    city: '',
    zip: '',
    street: '',
    is_customer: true,
    is_supplier: false,
    
    // Avanzados
    identification_type: 'RUC',
    title: '',
    trade_name: '',
    alias: '',
    street_number: '',
    cross_street: '',
    fax: '',
    contact_preference: 'DOMICILIO',
    job_title: '',
    legal_representative: '',

    is_collector: false,
    is_salesperson: false,
    is_employee: false,
    is_agent: false,
    is_insurance_company: false,
    is_partner_shareholder: false,
    is_student: false,
    is_exporter: false,
    is_importer: false,
    is_carrier: false,

    comment: '',
    is_large_taxpayer: false,
    is_special_taxpayer: false,
    is_withholding_agent: false,
    rimpe_type: 'NO',

    credit_days: 0,
    zone: '',
    product_line: '',

    bank_name: '',
    bank_account_type: 'Ahorros',
    bank_account_number: '',
    bank_account_id_number: '',
  });

  useEffect(() => {
    async function loadCompanies() {
      const comps = await getCompanies();
      setCompanies(comps);
      if (comps.length > 0 && !initialData) {
        setSelectedCompany(comps[0].id);
      }
    }
    loadCompanies();
  }, [initialData]);

  useEffect(() => {
    if (initialData) {
      setSelectedCompany(initialData.company_id);
      setFormData({
        name: initialData.name || '',
        email: initialData.email || '',
        phone: initialData.phone || '',
        mobile: initialData.mobile || '',
        vat: initialData.vat || '',
        is_company: initialData.is_company || false,
        company_name: initialData.company_name || '',
        country_id: initialData.country_id,
        state_id: initialData.state_id,
        city: initialData.city || '',
        zip: initialData.zip || '',
        street: initialData.street || '',
        is_customer: initialData.is_customer ?? true,
        is_supplier: initialData.is_supplier ?? false,

        identification_type: initialData.identification_type || 'RUC',
        title: initialData.title || '',
        trade_name: initialData.trade_name || '',
        alias: initialData.alias || '',
        street_number: initialData.street_number || '',
        cross_street: initialData.cross_street || '',
        fax: initialData.fax || '',
        contact_preference: initialData.contact_preference || 'DOMICILIO',
        job_title: initialData.job_title || '',
        legal_representative: initialData.legal_representative || '',

        is_collector: initialData.is_collector || false,
        is_salesperson: initialData.is_salesperson || false,
        is_employee: initialData.is_employee || false,
        is_agent: initialData.is_agent || false,
        is_insurance_company: initialData.is_insurance_company || false,
        is_partner_shareholder: initialData.is_partner_shareholder || false,
        is_student: initialData.is_student || false,
        is_exporter: initialData.is_exporter || false,
        is_importer: initialData.is_importer || false,
        is_carrier: initialData.is_carrier || false,

        comment: initialData.comment || '',
        is_large_taxpayer: initialData.is_large_taxpayer || false,
        is_special_taxpayer: initialData.is_special_taxpayer || false,
        is_withholding_agent: initialData.is_withholding_agent || false,
        rimpe_type: initialData.rimpe_type || 'NO',

        credit_days: initialData.credit_days || 0,
        zone: initialData.zone || '',
        product_line: initialData.product_line || '',

        bank_name: initialData.bank_name || '',
        bank_account_type: initialData.bank_account_type || 'Ahorros',
        bank_account_number: initialData.bank_account_number || '',
        bank_account_id_number: initialData.bank_account_id_number || '',
      });
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: Number(e.target.value) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompany) {
      alert("Seleccione una empresa");
      return;
    }
    
    setSaving(true);
    try {
      const payload = { ...formData, company_id: selectedCompany };
      if (initialData) {
        await updatePartner(initialData.id, payload);
      } else {
        await createPartner(payload);
      }
      
      if (onSaved) {
        onSaved();
      } else {
        router.push('/partners');
      }
    } catch (error: any) {
      alert("Error al guardar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      
      {/* HEADER ACTIONS */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm sticky top-0 z-10 border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{initialData ? 'Mantenimiento de Partner' : 'Nuevo Partner'}</h1>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => router.push('/partners')} className="btn btn-outline">Cerrar</button>
          <button type="submit" disabled={saving} className="btn btn-primary shadow-lg shadow-blue-500/30">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMNA 1: Datos Generales */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold border-b pb-3 mb-5 text-slate-800 flex items-center gap-2">
              <span className="text-xl">📄</span> Información General
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Identificación */}
              <div>
                <label className="block text-sm font-semibold mb-1">Identificación N°</label>
                <div className="flex">
                  <input type="text" name="vat" value={formData.vat} onChange={handleChange} className="w-full rounded-r-none border-r-0" placeholder="RUC / Cédula" />
                  <select name="identification_type" value={formData.identification_type} onChange={handleChange} className="w-32 rounded-l-none bg-slate-50">
                    <option value="RUC">RUC</option>
                    <option value="CEDULA">CÉDULA</option>
                    <option value="PASAPORTE">PASAPORTE</option>
                    <option value="CONS. FINAL">CONS. FINAL</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Tipo de Persona</label>
                <select name="is_company" value={formData.is_company ? 'true' : 'false'} onChange={(e) => setFormData(p => ({ ...p, is_company: e.target.value === 'true' }))} className="w-full">
                  <option value="false">NATURAL</option>
                  <option value="true">JURÍDICA</option>
                </select>
              </div>

              {/* Nombres */}
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Razón Social / Nombre Completo *</label>
                <input type="text" name="name" required value={formData.name} onChange={handleChange} className="w-full" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Razón Comercial (Opcional)</label>
                <input type="text" name="trade_name" value={formData.trade_name} onChange={handleChange} className="w-full" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Título Profesional</label>
                <input type="text" name="title" value={formData.title} onChange={handleChange} className="w-full" placeholder="Ing. / Lcdo. / Sr." />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Alias</label>
                <input type="text" name="alias" value={formData.alias} onChange={handleChange} className="w-full" />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Correo Electrónico</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full" />
              </div>
            </div>
          </div>

          <div className="card shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold border-b pb-3 mb-5 text-slate-800 flex items-center gap-2">
              <span className="text-xl">📍</span> Dirección y Correspondencia
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Calle Principal</label>
                <div className="flex gap-2">
                  <input type="text" name="street" value={formData.street} onChange={handleChange} className="w-full" />
                  <div className="w-32">
                    <input type="text" name="street_number" value={formData.street_number} onChange={handleChange} placeholder="# Casa" className="w-full" />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold mb-1">Intersección</label>
                <input type="text" name="cross_street" value={formData.cross_street} onChange={handleChange} className="w-full" />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Teléfono 1</label>
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Teléfono 2 (Móvil)</label>
                <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Fax</label>
                <input type="text" name="fax" value={formData.fax} onChange={handleChange} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Correspondencia</label>
                <select name="contact_preference" value={formData.contact_preference} onChange={handleChange} className="w-full">
                  <option value="DOMICILIO">DOMICILIO</option>
                  <option value="OFICINA">OFICINA</option>
                  <option value="EMAIL">EMAIL</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold border-b pb-3 mb-5 text-slate-800 flex items-center gap-2">
              <span className="text-xl">🌍</span> Ubicación Geográfica
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Ciudad</label>
                <input type="text" name="city" value={formData.city} onChange={handleChange} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Casilla Postal / ZIP</label>
                <input type="text" name="zip" value={formData.zip} onChange={handleChange} className="w-full" />
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA 2: Relaciones, SRI, Observaciones */}
        <div className="space-y-6">
          <div className="card bg-blue-50/30 border border-blue-100 shadow-sm">
            <h3 className="text-lg font-bold border-b border-blue-200 pb-3 mb-5 text-blue-800 flex items-center gap-2">
              <span className="text-xl">🤝</span> Relación con la Empresa
            </h3>
            <div className="grid grid-cols-2 gap-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_customer" checked={formData.is_customer} onChange={handleChange} />
                <span className="text-sm font-semibold text-slate-700">Cliente</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_supplier" checked={formData.is_supplier} onChange={handleChange} />
                <span className="text-sm font-semibold text-slate-700">Proveedor</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_employee" checked={formData.is_employee} onChange={handleChange} />
                <span className="text-sm text-slate-700">Empleado</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_salesperson" checked={formData.is_salesperson} onChange={handleChange} />
                <span className="text-sm text-slate-700">Vendedor</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_collector" checked={formData.is_collector} onChange={handleChange} />
                <span className="text-sm text-slate-700">Cobrador</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_agent" checked={formData.is_agent} onChange={handleChange} />
                <span className="text-sm text-slate-700">Agente</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_partner_shareholder" checked={formData.is_partner_shareholder} onChange={handleChange} />
                <span className="text-sm text-slate-700">Socio</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_carrier" checked={formData.is_carrier} onChange={handleChange} />
                <span className="text-sm text-slate-700">Transportista</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_importer" checked={formData.is_importer} onChange={handleChange} />
                <span className="text-sm text-slate-700">Importador</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" name="is_exporter" checked={formData.is_exporter} onChange={handleChange} />
                <span className="text-sm text-slate-700">Exportador</span>
              </label>
            </div>
          </div>

          <div className="card shadow-sm border border-slate-100">
            <h3 className="text-lg font-bold border-b pb-3 mb-5 text-slate-800 flex items-center gap-2">
              <span className="text-xl">📝</span> Observaciones
            </h3>
            <textarea name="comment" value={formData.comment} onChange={handleChange} rows={4} className="w-full"></textarea>
          </div>

          <div className="card bg-orange-50/30 border border-orange-100 shadow-sm">
            <h3 className="text-lg font-bold border-b border-orange-200 pb-3 mb-5 text-orange-800 flex items-center gap-2">
              <span className="text-xl">🏛️</span> SRI y Tributación
            </h3>
            <div className="space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-semibold text-slate-700">Grande Contribuyente</span>
                <input type="checkbox" name="is_large_taxpayer" checked={formData.is_large_taxpayer} onChange={handleChange} className="h-5 w-5 rounded border-slate-300" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-semibold text-slate-700">Contribuyente Especial</span>
                <input type="checkbox" name="is_special_taxpayer" checked={formData.is_special_taxpayer} onChange={handleChange} className="h-5 w-5 rounded border-slate-300" />
              </label>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-semibold text-slate-700">Agente de Retención</span>
                <input type="checkbox" name="is_withholding_agent" checked={formData.is_withholding_agent} onChange={handleChange} className="h-5 w-5 rounded border-slate-300" />
              </label>
              
              <div className="pt-2">
                <label className="block text-sm font-semibold mb-1 text-slate-700">Cont. Reg. RIMPE</label>
                <select name="rimpe_type" value={formData.rimpe_type} onChange={handleChange} className="w-full">
                  <option value="NO">NO APLICA</option>
                  <option value="EMPRENDEDOR">EMPRENDEDOR</option>
                  <option value="NEGOCIO_POPULAR">NEGOCIO POPULAR</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* TERCERA FILA: Contactos Adicionales y Bancos */}
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card shadow-sm border border-slate-100 md:col-span-1">
            <h3 className="text-lg font-bold border-b pb-3 mb-5 text-slate-800 flex items-center gap-2">
              <span className="text-xl">💼</span> Información Laboral
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Cargo</label>
                <input type="text" name="job_title" value={formData.job_title} onChange={handleChange} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">R. Legal (Representante Legal)</label>
                <input type="text" name="legal_representative" value={formData.legal_representative} onChange={handleChange} className="w-full" />
              </div>
            </div>
          </div>

          <div className="card shadow-sm border border-slate-100 md:col-span-1">
            <h3 className="text-lg font-bold border-b pb-3 mb-5 text-slate-800 flex items-center gap-2">
              <span className="text-xl">📈</span> Crédito y Comercial
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Días de Crédito</label>
                <input type="number" name="credit_days" value={formData.credit_days} onChange={handleNumberChange} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Zona</label>
                <input type="text" name="zone" value={formData.zone} onChange={handleChange} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Línea de Productos</label>
                <input type="text" name="product_line" value={formData.product_line} onChange={handleChange} className="w-full" />
              </div>
            </div>
          </div>

          <div className="card shadow-sm border border-emerald-50 md:col-span-1 bg-emerald-50/20">
            <h3 className="text-lg font-bold border-b pb-3 mb-5 text-emerald-800 flex items-center gap-2">
              <span className="text-xl">🏦</span> Transferencias Bancarias
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Banco</label>
                <input type="text" name="bank_name" value={formData.bank_name} onChange={handleChange} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Tipo de Cuenta</label>
                <select name="bank_account_type" value={formData.bank_account_type} onChange={handleChange} className="w-full">
                  <option value="Ahorros">Ahorros</option>
                  <option value="Corriente">Corriente</option>
                  <option value="Virtual">Virtual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Número de Cuenta</label>
                <input type="text" name="bank_account_number" value={formData.bank_account_number} onChange={handleChange} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Identificación N° (Cta)</label>
                <input type="text" name="bank_account_id_number" value={formData.bank_account_id_number} onChange={handleChange} className="w-full" />
              </div>
            </div>
          </div>
        </div>

      </div>
    </form>
  );
}
