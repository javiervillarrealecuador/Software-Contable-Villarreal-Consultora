// src/app/products/page.tsx

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getProducts } from '@/lib/supabase';
import type { Product } from '@/types/capa0';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      setLoading(true);
      const data = await getProducts();
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredProducts = products.filter(p =>
    p.template?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code?.includes(searchTerm)
  );

  return (
    <div className="w-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Catálogo de Productos</h1>
          <p className="text-slate-500 mt-2">Gestión de bienes, servicios y consumibles</p>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/products/new" className="btn btn-primary">
            + Nuevo Producto
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main>
        {/* Search */}
        <div className="card mb-lg">
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-lg">
          {loading ? (
            <p className="text-center col-span-full py-2xl">Cargando...</p>
          ) : filteredProducts.length === 0 ? (
            <p className="text-center col-span-full py-2xl text-slate-600">
              {searchTerm ? 'No se encontraron resultados' : 'No hay productos agregados'}
            </p>
          ) : (
            filteredProducts.map(product => (
              <div key={product.id} className="card">
                <div className="flex justify-between items-start mb-md">
                  <h3 className="font-bold text-lg flex-1">{product.template?.name}</h3>
                  <span className={`text-xs font-semibold px-md py-sm rounded-full ${
                    product.template?.type === 'product'
                      ? 'bg-blue-100 text-blue-700'
                      : product.template?.type === 'service'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {product.template?.type === 'product' ? 'Producto' : product.template?.type === 'service' ? 'Servicio' : 'Consumible'}
                  </span>
                </div>

                {product.code && (
                  <p className="text-xs text-slate-600 mb-md">
                    <strong>Código:</strong> <span className="font-mono">{product.code}</span>
                  </p>
                )}

                {product.template?.description && (
                  <p className="text-sm text-slate-600 mb-md line-clamp-2">
                    {product.template.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-md pt-md border-t border-slate-200">
                  <div>
                    <p className="text-xs text-slate-600">Precio Lista</p>
                    <p className="font-bold text-lg">${product.template?.list_price?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Costo</p>
                    <p className="font-bold text-lg">${product.template?.standard_price?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>

                <Link href={`/products/${product.id}`} className="btn btn-outline w-full mt-lg block text-center">
                  ✏️ Editar
                </Link>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
