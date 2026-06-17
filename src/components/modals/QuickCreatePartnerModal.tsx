'use client';

import { useState } from 'react';
import { createPartner } from '@/lib/supabase';
import type { PartnerFormData } from '@/types/capa0';

interface QuickCreatePartnerModalProps {
  companyId: number;
  defaultIsCustomer?: boolean;
  defaultIsSupplier?: boolean;
  onSaved: (partnerId: number) => void;
  onCancel: () => void;
}

export default function QuickCreatePartnerModal({
  companyId,
  defaultIsCustomer = true,
  defaultIsSupplier = false,
  onSaved,
  onCancel,
}: QuickCreatePartnerModalProps) {
  const [formData, setFormData] = useState<PartnerFormData>({
    name: '',
    vat: '',
    email: '',
    phone: '',
    city: '',
    is_company: false,
    is_customer: defaultIsCustomer,
    is_supplier: defaultIsSupplier,
  } as PartnerFormData);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name) return;
    
    try {
      setSaving(true);
      const newPartner = await createPartner({
        ...formData,
        company_id: companyId,
      });
      if (newPartner && newPartner.id) {
        onSaved(newPartner.id);
      }
    } catch (error: any) {
      alert('Error al crear: ' + (error.message || ''));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-800">
            Crear {defaultIsSupplier ? 'Proveedor' : 'Cliente'} Rápido
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700">Nombre / Razón Social *</label>
            <input
              type="text"
              required
              autoFocus
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">RUC/Cédula</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                value={formData.vat}
                onChange={(e) => setFormData({ ...formData, vat: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">Teléfono</label>
              <input
                type="tel"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 items-center mt-4">
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded border border-slate-200">
              <input
                type="checkbox"
                checked={formData.is_customer}
                onChange={(e) => setFormData({ ...formData, is_customer: e.target.checked })}
              />
              <span className="text-sm font-semibold">Es Cliente</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-2 rounded border border-slate-200">
              <input
                type="checkbox"
                checked={formData.is_supplier}
                onChange={(e) => setFormData({ ...formData, is_supplier: e.target.checked })}
              />
              <span className="text-sm font-semibold">Es Proveedor</span>
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200 mt-6">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-semibold text-slate-700 hover:bg-slate-50 flex-1"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-semibold hover:bg-blue-700 flex-1"
            >
              {saving ? 'Guardando...' : 'Crear y Seleccionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
