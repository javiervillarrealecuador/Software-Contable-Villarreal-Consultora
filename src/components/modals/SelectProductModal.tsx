'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

interface ProductMini {
  id: number;
  name: string;
  code?: string;
  list_price?: number;
}

interface SelectProductModalProps {
  products?: ProductMini[];
  onSelect: (productId: number, product?: ProductMini) => void;
  onCancel: () => void;
  onCreateNew: () => void;
}

export default function SelectProductModal({
  products = [],
  onSelect,
  onCancel,
  onCreateNew,
}: SelectProductModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<ProductMini[]>(products);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function searchDB() {
      setLoading(true);
      let q = supabase
        .from('product_product')
        .select(`
          id,
          code,
          product_template!inner(name, list_price)
        `)
        .eq('active', true);
        
      if (searchTerm) {
        // Unfortunately searching across joined table string requires a different approach
        // We can search code, or use a view. Let's do a basic ilike if possible.
        // Actually Supabase allows: product_template!inner(name.ilike.%search%)
        q = q.or(`code.ilike.%${searchTerm}%,product_template.name.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await q.limit(30);
      if (data && !error) {
        const mapped = data.map((d: any) => ({
          id: d.id,
          code: d.code,
          name: d.product_template?.name || '',
          list_price: d.product_template?.list_price || 0,
        }));
        setResults(mapped);
      } else {
        setResults([]);
      }
      setLoading(false);
    }
    
    const timer = setTimeout(() => {
      searchDB();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl flex flex-col shadow-2xl" style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 rounded-t-lg">
          <h2 className="text-lg font-bold text-slate-800">Seleccionar Producto / Servicio</h2>
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
            placeholder="Buscar por nombre o código..."
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
                        {p.code ? `[${p.code}] ` : ''}{p.name}
                      </div>
                      <div className="text-sm text-slate-500 mt-1">
                        Precio Lista: ${Number(p.list_price).toFixed(2)}
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
