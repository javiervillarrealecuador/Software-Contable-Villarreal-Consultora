// src/app/products/page.tsx

'use client';

import { useState, useEffect } from 'react';

import { getProducts } from '@/lib/supabase';
import type { Product, ProductFormData } from '@/types/capa0';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    category_id: undefined,
    type: 'product',
    uom_id: 1,
    list_price: 0,
    standard_price: 0,
    description: '',
  });

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      // Primero crear product_template
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Error creando producto');

      setIsModalOpen(false);
      setFormData({
        name: '',
        category_id: undefined,
        type: 'product',
        uom_id: 1,
        list_price: 0,
        standard_price: 0,
        description: '',
      });
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error al guardar producto');
    }
  }

  function closeModal() {
    setIsModalOpen(false);
    setFormData({
      name: '',
      category_id: undefined,
      type: 'product',
      uom_id: 1,
      list_price: 0,
      standard_price: 0,
      description: '',
    });
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
          <button onClick={() => { closeModal(); setIsModalOpen(true); }} className="btn btn-primary shadow-lg shadow-blue-500/30">
            + Nuevo Producto
          </button>
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
                    <p className="font-bold text-lg">${product.template?.list_price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Costo</p>
                    <p className="font-bold text-lg">${product.template?.standard_price.toFixed(2)}</p>
                  </div>
                </div>

                <button className="btn btn-outline w-full mt-lg">
                  ✏️ Editar
                </button>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-md">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-xl">
            <h2 className="mb-lg">Nuevo Producto</h2>

            <form onSubmit={handleSubmit} className="space-y-lg">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                <div>
                  <label className="block text-sm font-semibold mb-sm">Tipo</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full"
                  >
                    <option value="product">Producto</option>
                    <option value="service">Servicio</option>
                    <option value="consu">Consumible</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-sm">Unidad de Medida</label>
                  <select
                    value={formData.uom_id}
                    onChange={(e) => setFormData({ ...formData, uom_id: Number(e.target.value) })}
                    className="w-full"
                  >
                    <option value={1}>Unidad</option>
                    <option value={2}>Kilogramo</option>
                    <option value={3}>Litro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
                <div>
                  <label className="block text-sm font-semibold mb-sm">Precio Lista *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.list_price}
                    onChange={(e) => setFormData({ ...formData, list_price: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-sm">Costo Estándar</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.standard_price}
                    onChange={(e) => setFormData({ ...formData, standard_price: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-sm">Descripción</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full"
                />
              </div>

              <div className="flex gap-md pt-lg border-t border-slate-200">
                <button type="submit" className="btn btn-primary flex-1">
                  Crear Producto
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
