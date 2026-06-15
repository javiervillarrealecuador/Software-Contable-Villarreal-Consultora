'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface QuickCreateProductModalProps {
  onSaved: (productId: number) => void;
  onCancel: () => void;
}

export default function QuickCreateProductModal({
  onSaved,
  onCancel,
}: QuickCreateProductModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'product',
    list_price: 0,
    standard_price: 0,
    uom_id: 1, // Default uom (Units)
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name) return;
    
    try {
      setSaving(true);
      
      // Step 1: Create template
      const { data: tmpl, error: errTmpl } = await supabase
        .from('product_template')
        .insert([{
          name: formData.name,
          type: formData.type,
          list_price: formData.list_price,
          standard_price: formData.standard_price,
          uom_id: formData.uom_id,
          active: true,
        }])
        .select()
        .single();
        
      if (errTmpl) throw errTmpl;

      // Step 2: Create product variant
      const { data: prod, error: errProd } = await supabase
        .from('product_product')
        .insert([{
          product_tmpl_id: tmpl.id,
          code: formData.code || null,
          active: true,
        }])
        .select()
        .single();

      if (errProd) throw errProd;

      if (prod && prod.id) {
        onSaved(prod.id);
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
            Crear Producto Rápido
          </h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1 text-slate-700">Nombre del Producto *</label>
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
              <label className="block text-sm font-semibold mb-1 text-slate-700">Código</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">Tipo</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <option value="product">Almacenable</option>
                <option value="service">Servicio</option>
                <option value="consu">Consumible</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">Precio de Venta (PVP)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md text-sm"
                  value={formData.list_price || ''}
                  onChange={(e) => setFormData({ ...formData, list_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-slate-700">Costo (Standard)</label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-md text-sm"
                  value={formData.standard_price || ''}
                  onChange={(e) => setFormData({ ...formData, standard_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
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
