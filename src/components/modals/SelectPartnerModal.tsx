'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface PartnerMini {
  id: number;
  name: string;
  vat?: string;
  city?: string;
  is_customer?: boolean;
  is_supplier?: boolean;
}

interface SelectPartnerModalProps {
  companyId?: number;
  partners?: PartnerMini[];
  onSelect: (partnerId: number, partner?: PartnerMini) => void;
  onCancel: () => void;
  onCreateNew: () => void;
  filterType?: 'customer' | 'supplier' | 'all';
}

export default function SelectPartnerModal({
  companyId,
  partners = [],
  onSelect,
  onCancel,
  onCreateNew,
  filterType = 'all',
}: SelectPartnerModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<PartnerMini[]>(partners);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) {
      let filtered = partners;
      if (filterType === 'customer') {
        filtered = partners.filter(p => p.is_customer);
      } else if (filterType === 'supplier') {
        filtered = partners.filter(p => p.is_supplier);
      }

      if (!searchTerm) setResults(filtered);
      else {
        const lower = searchTerm.toLowerCase();
        setResults(filtered.filter(p => 
          p.name.toLowerCase().includes(lower) || 
          (p.vat && p.vat.includes(searchTerm))
        ));
      }
      return;
    }

    async function searchDB() {
      setLoading(true);
      let q = supabase
        .from('res_partner')
        .select('id, name, vat, city, is_customer, is_supplier')
        .eq('company_id', companyId)
        .eq('active', true);

      if (filterType === 'customer') {
        q = q.eq('is_customer', true);
      } else if (filterType === 'supplier') {
        q = q.eq('is_supplier', true);
      }
        
      if (searchTerm) {
        q = q.or(`name.ilike.%${searchTerm}%,vat.ilike.%${searchTerm}%`);
      }
      
      const { data } = await q.order('name').limit(20);
      setResults((data as PartnerMini[]) || []);
      setLoading(false);
    }
    
    const timer = setTimeout(() => {
      searchDB();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, companyId, partners, filterType]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl flex flex-col shadow-2xl" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
          <h2 className="text-lg font-bold text-slate-800">Seleccionar Cliente / Proveedor</h2>
          <button 
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 font-bold text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Search & Actions */}
        <div className="p-4 border-b border-slate-100 flex gap-3">
          <input
            type="text"
            autoFocus
            placeholder="Buscar por nombre o RUC..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button
            onClick={onCreateNew}
            className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 whitespace-nowrap shadow-sm"
          >
            + Crear Nuevo
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
             <div className="text-center py-8 text-slate-500">Buscando...</div>
          ) : results.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No se encontraron coincidencias.
            </div>
          ) : (
            <ul className="space-y-1">
              {results.map(p => (
                <li key={p.id}>
                  <button
                    onClick={() => onSelect(p.id, p)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 rounded-md transition-colors flex justify-between items-center group border border-transparent hover:border-blue-100"
                  >
                    <div>
                      <div className="font-semibold text-slate-800 group-hover:text-blue-700">
                        {p.name}
                      </div>
                      <div className="text-sm text-slate-500 flex gap-3 mt-1">
                        {p.vat && <span><span className="font-medium text-slate-400">RUC:</span> {p.vat}</span>}
                        {p.city && <span><span className="font-medium text-slate-400">Ciudad:</span> {p.city}</span>}
                      </div>
                    </div>
                    <div className="text-blue-600 opacity-0 group-hover:opacity-100 font-medium text-sm px-2">
                      Seleccionar &rarr;
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
