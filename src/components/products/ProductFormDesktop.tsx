'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductFormData, ProductPresentation } from '@/types/capa0';

interface ProductFormDesktopProps {
  initialData?: ProductFormData;
}

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ProductFormDesktop({ initialData }: ProductFormDesktopProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('account_account').select('id, code, name').then(({ data }) => {
      if (data) setAccounts(data);
    });
  }, []);

  const [formData, setFormData] = useState<ProductFormData>(initialData || {
    name: '',
    reference: '',
    type: 'product',
    uom_id: 1,
    list_price: 0,
    standard_price: 0,
    description: '',
    group1: '',
    group2: '',
    group3: '',
    stock_unit: 'UNIDAD',
    min_stock: 0,
    max_stock: 0,
    cost_center: '',
    iva_code: '15%',
    has_ice: false,
    ice_percentage: 0,
    price_1: 0,
    price_2: 0,
    price_3: 0,
    price_4: 0,
    price_5: 0,
    price_6: 0,
    discount_percentage: 0,
    previous_price: 0,
    promo_quantity: 0,
    promo_valid_until: '',
    warehouse_location: '',
    active: true,
    presentations: [],
  });

  const [activeTab, setActiveTab] = useState('presentaciones');

  const handleSave = async () => {
    setLoading(true);
    try {
      const isEdit = !!formData.id;
      const url = isEdit ? `/api/products/${formData.id}` : '/api/products';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Error al guardar el producto');
      router.push('/products');
      router.refresh();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePresentationChange = (index: number, field: keyof ProductPresentation, value: any) => {
    const newPresentations = [...(formData.presentations || [])];
    newPresentations[index] = { ...newPresentations[index], [field]: value };
    setFormData({ ...formData, presentations: newPresentations });
  };

  const addPresentation = () => {
    setFormData({
      ...formData,
      presentations: [
        ...(formData.presentations || []),
        { name: '', barcode: '', gross_weight: 0, weight_unit: 'UNIDAD', price_1: 0, price_2: 0, price_3: 0, price_4: 0, price_5: 0, price_6: 0 }
      ]
    });
  };

  const removePresentation = (index: number) => {
    const newPresentations = [...(formData.presentations || [])];
    newPresentations.splice(index, 1);
    setFormData({ ...formData, presentations: newPresentations });
  };

  return (
    <div className="min-h-screen bg-slate-100 p-2 sm:p-4 text-sm font-sans flex justify-center">
      <div className="bg-white w-full max-w-7xl border shadow-xl flex flex-col" style={{ minHeight: '85vh' }}>
        
        {/* TOP BAR */}
        <div className="bg-[#eef2f6] border-b p-2 flex justify-between items-center text-slate-800">
          <div className="flex items-center gap-4">
            <span className="font-bold text-blue-800 tracking-wide">
              {formData.type === 'service' ? 'SERVICIOS' : 'PRODUCTOS'}
            </span>
            <span className="font-semibold">{formData.name || 'Nuevo Registro'}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-semibold text-xs">Seleccione Tipo de producto:</label>
            <select 
              className="border p-1 text-xs"
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value as any})}
            >
              <option value="product">PRODUCTOS</option>
              <option value="service">SERVICIOS</option>
              <option value="consu">CONSUMIBLE</option>
            </select>
          </div>
        </div>

        {/* MAIN BODY */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* LEFT & CENTER SECTIONS */}
          <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
            
            {/* Header info */}
            <div className="grid grid-cols-12 gap-2">
              <div className="col-span-2 text-right font-semibold pt-1">Codigo :</div>
              <div className="col-span-4">
                <input type="text" className="border w-full p-1 bg-gray-50" placeholder="Autogenerado" disabled />
              </div>
              <div className="col-span-2 text-right font-semibold pt-1">Referencia :</div>
              <div className="col-span-4">
                <input type="text" className="border w-full p-1" value={formData.reference || ''} onChange={e => setFormData({...formData, reference: e.target.value})} />
              </div>

              <div className="col-span-2 text-right font-semibold pt-1">Nombre :</div>
              <div className="col-span-10">
                <input type="text" className="border w-full p-1" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
            </div>

            {/* Middle grids */}
            <div className="grid grid-cols-12 gap-4">
              
              {/* Categorization & Stock */}
              <div className="col-span-7 flex flex-col gap-2 bg-[#f8f9fa] p-2 border">
                <div className="flex items-center gap-2">
                  <span className="w-24 text-right font-semibold">Grupo I :</span>
                  <input type="text" className="border flex-1 p-1" value={formData.group1 || ''} onChange={e => setFormData({...formData, group1: e.target.value})} placeholder="N/A" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-24 text-right font-semibold">Grupo II :</span>
                  <input type="text" className="border flex-1 p-1" value={formData.group2 || ''} onChange={e => setFormData({...formData, group2: e.target.value})} placeholder="N/A" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-24 text-right font-semibold">Grupo III :</span>
                  <input type="text" className="border flex-1 p-1" value={formData.group3 || ''} onChange={e => setFormData({...formData, group3: e.target.value})} placeholder="N/A" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-24 text-right font-semibold">Stock en :</span>
                  <input type="text" className="border flex-1 p-1" value={formData.stock_unit || ''} onChange={e => setFormData({...formData, stock_unit: e.target.value})} placeholder="UNIDAD" />
                </div>
              </div>

              <div className="col-span-5 flex flex-col gap-2 bg-[#f8f9fa] p-2 border">
                <div className="flex items-center gap-2">
                  <span className="w-32 text-right font-semibold">Existencia mínima :</span>
                  <input type="number" className="border flex-1 p-1 text-right" value={formData.min_stock || 0} onChange={e => setFormData({...formData, min_stock: parseFloat(e.target.value)})} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-32 text-right font-semibold">Existencia máxima :</span>
                  <input type="number" className="border flex-1 p-1 text-right" value={formData.max_stock || 0} onChange={e => setFormData({...formData, max_stock: parseFloat(e.target.value)})} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-32 text-right font-semibold">Centro de Costo F2:</span>
                  <input type="text" className="border flex-1 p-1" value={formData.cost_center || ''} onChange={e => setFormData({...formData, cost_center: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Taxes and Status */}
            <div className="grid grid-cols-12 gap-4 items-center bg-[#f8f9fa] border p-2">
              <div className="col-span-6 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-24 text-right font-semibold">Codigo I.V.A :</span>
                  <select className="border p-1 flex-1" value={formData.iva_code || ''} onChange={e => setFormData({...formData, iva_code: e.target.value})}>
                    <option value="15%">15%</option>
                    <option value="12%">12%</option>
                    <option value="0%">0%</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-24 text-right font-semibold">Grava I.C.E :</span>
                  <label className="flex items-center gap-1"><input type="radio" name="ice" checked={formData.has_ice} onChange={() => setFormData({...formData, has_ice: true})} /> SI</label>
                  <label className="flex items-center gap-1"><input type="radio" name="ice" checked={!formData.has_ice} onChange={() => setFormData({...formData, has_ice: false, ice_percentage: 0})} /> NO</label>
                  <span className="ml-2 font-semibold">% I.C.E :</span>
                  <input type="number" className="border w-16 p-1 text-right" disabled={!formData.has_ice} value={formData.ice_percentage || 0} onChange={e => setFormData({...formData, ice_percentage: parseFloat(e.target.value)})} />
                </div>
              </div>
              <div className="col-span-6 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-32 text-right font-semibold">Cta. Ingresos:</span>
                  <select className="border p-1 flex-1" value={formData.income_account_id || ''} onChange={e => setFormData({...formData, income_account_id: e.target.value ? parseInt(e.target.value) : undefined})}>
                    <option value="">Seleccione cuenta</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-32 text-right font-semibold">Cta. Gastos:</span>
                  <select className="border p-1 flex-1" value={formData.expense_account_id || ''} onChange={e => setFormData({...formData, expense_account_id: e.target.value ? parseInt(e.target.value) : undefined})}>
                    <option value="">Seleccione cuenta</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} - {a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-center p-2 bg-[#f8f9fa] border-b">
              <span className="font-semibold mr-4">Estado del Producto :</span>
              <label className="flex items-center gap-1 mr-4"><input type="radio" name="active" checked={formData.active} onChange={() => setFormData({...formData, active: true})} /> Activo</label>
              <label className="flex items-center gap-1"><input type="radio" name="active" checked={!formData.active} onChange={() => setFormData({...formData, active: false})} /> Inactivo</label>
            </div>

            {/* Catalogs & Ubication */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="w-28 text-right font-semibold">Catalogo PDF :</span>
                <input type="text" className="border flex-1 p-1 bg-gray-50" readOnly placeholder="Ruta del archivo PDF" />
                <button className="border px-2 py-1 bg-gray-100 hover:bg-gray-200">...</button>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-28 text-right font-semibold">Ubicación BO :</span>
                <input type="text" className="border flex-1 p-1" value={formData.warehouse_location || ''} onChange={e => setFormData({...formData, warehouse_location: e.target.value})} />
              </div>
            </div>

            {/* Description & Adjunto */}
            <div className="grid grid-cols-12 gap-4 mt-2">
              <div className="col-span-8 flex flex-col gap-1">
                <span className="font-semibold text-[#185b9d] border-b border-[#185b9d] inline-block w-max">Descripción o Características del Producto</span>
                <textarea className="border w-full p-2 h-24" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})}></textarea>
              </div>
              <div className="col-span-4 flex flex-col gap-1">
                <span className="font-semibold text-xs text-slate-600">Documento Adjunto<br/>en formato PDF, WORD, EXCEL, JPG</span>
                <div className="border h-24 bg-white flex items-center justify-center text-slate-400">
                  Sin Adjunto
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT PANEL (Prices & Buttons) */}
          <div className="w-80 bg-[#eef2f6] border-l p-4 flex flex-col gap-4">
            
            {/* Buttons */}
            <div className="flex flex-col gap-2 mb-4">
              <button onClick={() => router.push('/products')} className="bg-gradient-to-b from-white to-gray-200 border border-gray-400 shadow-sm py-1 font-bold text-slate-700 hover:from-gray-50 hover:to-gray-300 flex items-center justify-center gap-2">
                ✖ Cerrar
              </button>
              <button onClick={() => window.location.reload()} className="bg-gradient-to-b from-white to-gray-200 border border-gray-400 shadow-sm py-1 font-bold text-slate-700 hover:from-gray-50 hover:to-gray-300 flex items-center justify-center gap-2">
                📄 Nuevo
              </button>
              <button onClick={handleSave} disabled={loading} className="bg-gradient-to-b from-white to-gray-200 border border-gray-400 shadow-sm py-1 font-bold text-[#185b9d] hover:from-gray-50 hover:to-gray-300 flex items-center justify-center gap-2">
                💾 {loading ? 'Guardando...' : 'Guardar'}
              </button>
              <button className="bg-gradient-to-b from-white to-gray-200 border border-gray-400 shadow-sm py-1 text-xs text-slate-700 hover:from-gray-50 hover:to-gray-300 mt-2">Cerrar Características</button>
              <button className="bg-gradient-to-b from-white to-gray-200 border border-gray-400 shadow-sm py-1 text-xs text-slate-700 hover:from-gray-50 hover:to-gray-300">Conversiones</button>
              <button className="bg-gradient-to-b from-white to-gray-200 border border-gray-400 shadow-sm py-1 text-xs text-slate-700 hover:from-gray-50 hover:to-gray-300">Catalogo</button>
              <button className="bg-gradient-to-b from-white to-gray-200 border border-gray-400 shadow-sm py-1 text-xs text-slate-700 hover:from-gray-50 hover:to-gray-300">Esp. Técnicas</button>
            </div>

            {/* Prices */}
            <div className="bg-white border text-xs">
              <div className="grid grid-cols-4 bg-[#b5d3f2] text-center font-bold border-b border-white">
                <div className="col-span-1 p-1"></div>
                <div className="col-span-1 p-1 border-l border-white text-[#185b9d]">PVP</div>
                <div className="col-span-2 p-1 border-l border-white text-[#185b9d]">Promocion x %</div>
              </div>
              <div className="grid grid-cols-4 text-center font-bold bg-[#eef2f6] border-b">
                <div className="col-span-1"></div>
                <div className="col-span-1"></div>
                <div className="col-span-1 border-l border-white">Dscto %</div>
                <div className="col-span-1 border-l border-white">PVP Anterior</div>
              </div>
              
              {[1,2,3,4,5,6].map((num) => (
                <div key={num} className="grid grid-cols-4 gap-1 p-1 border-b">
                  <div className="col-span-1 text-right font-bold pt-1">Precio {num} :</div>
                  <div className="col-span-1"><input type="number" className="border w-full p-1 text-right" value={(formData as any)[`price_${num}`]} onChange={e => setFormData({...formData, [`price_${num}`]: parseFloat(e.target.value)})} /></div>
                  {num === 1 ? (
                    <>
                      <div className="col-span-1"><input type="number" className="border w-full p-1 text-right" value={formData.discount_percentage || 0} onChange={e => setFormData({...formData, discount_percentage: parseFloat(e.target.value)})} /></div>
                      <div className="col-span-1"><input type="number" className="border w-full p-1 text-right" value={formData.previous_price || 0} onChange={e => setFormData({...formData, previous_price: parseFloat(e.target.value)})} /></div>
                    </>
                  ) : (
                    <div className="col-span-2"></div>
                  )}
                </div>
              ))}
            </div>

            {/* Promotion Box */}
            <div className="bg-white border mt-2">
              <div className="bg-[#b5d3f2] text-center font-bold p-1 text-[#185b9d] text-xs">
                Promocion x Cantidades<br/>Condiciones de la Promocion
              </div>
              <div className="p-2 flex flex-col gap-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Por cada</span>
                  <input type="number" className="border w-16 p-1 text-right" value={formData.promo_quantity || 0} onChange={e => setFormData({...formData, promo_quantity: parseFloat(e.target.value)})} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Vigencia hasta</span>
                  <input type="date" className="border w-24 p-1" value={formData.promo_valid_until || ''} onChange={e => setFormData({...formData, promo_valid_until: e.target.value})} />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* BOTTOM TABS & GRID */}
        <div className="border-t bg-white flex flex-col h-64">
          
          {/* Tab Content (Presentaciones) */}
          <div className="flex-1 overflow-auto bg-white border-b relative">
            {activeTab === 'presentaciones' ? (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-[#eef2f6] sticky top-0 shadow-sm">
                  <tr>
                    <th className="border p-2 w-8"></th>
                    <th className="border p-2">Presentaciones</th>
                    <th className="border p-2">Codigo de Barras</th>
                    <th className="border p-2">Peso Bruto</th>
                    <th className="border p-2">Peso en</th>
                    <th className="border p-2">Precio 1</th>
                    <th className="border p-2">Precio 2</th>
                    <th className="border p-2">Precio 3</th>
                    <th className="border p-2">Precio 4</th>
                    <th className="border p-2">Precio 5</th>
                    <th className="border p-2">Precio 6</th>
                  </tr>
                </thead>
                <tbody>
                  {(formData.presentations || []).map((p, idx) => (
                    <tr key={idx} className="hover:bg-blue-50">
                      <td className="border p-1 text-center">
                        <button onClick={() => removePresentation(idx)} className="text-red-500 font-bold hover:text-red-700">&times;</button>
                      </td>
                      <td className="border p-0"><input type="text" className="w-full h-full p-1 bg-transparent border-none outline-none" value={p.name} onChange={e => handlePresentationChange(idx, 'name', e.target.value)} /></td>
                      <td className="border p-0"><input type="text" className="w-full h-full p-1 bg-transparent border-none outline-none" value={p.barcode || ''} onChange={e => handlePresentationChange(idx, 'barcode', e.target.value)} /></td>
                      <td className="border p-0"><input type="number" className="w-full h-full p-1 bg-transparent border-none outline-none text-right" value={p.gross_weight} onChange={e => handlePresentationChange(idx, 'gross_weight', parseFloat(e.target.value))} /></td>
                      <td className="border p-0">
                        <select className="w-full h-full p-1 bg-transparent border-none outline-none" value={p.weight_unit} onChange={e => handlePresentationChange(idx, 'weight_unit', e.target.value)}>
                          <option value="UNIDAD">UNIDAD</option>
                          <option value="KG">KG</option>
                          <option value="LB">LB</option>
                        </select>
                      </td>
                      <td className="border p-0"><input type="number" className="w-full h-full p-1 bg-transparent border-none outline-none text-right" value={p.price_1} onChange={e => handlePresentationChange(idx, 'price_1', parseFloat(e.target.value))} /></td>
                      <td className="border p-0"><input type="number" className="w-full h-full p-1 bg-transparent border-none outline-none text-right" value={p.price_2} onChange={e => handlePresentationChange(idx, 'price_2', parseFloat(e.target.value))} /></td>
                      <td className="border p-0"><input type="number" className="w-full h-full p-1 bg-transparent border-none outline-none text-right" value={p.price_3} onChange={e => handlePresentationChange(idx, 'price_3', parseFloat(e.target.value))} /></td>
                      <td className="border p-0"><input type="number" className="w-full h-full p-1 bg-transparent border-none outline-none text-right" value={p.price_4} onChange={e => handlePresentationChange(idx, 'price_4', parseFloat(e.target.value))} /></td>
                      <td className="border p-0"><input type="number" className="w-full h-full p-1 bg-transparent border-none outline-none text-right" value={p.price_5} onChange={e => handlePresentationChange(idx, 'price_5', parseFloat(e.target.value))} /></td>
                      <td className="border p-0"><input type="number" className="w-full h-full p-1 bg-transparent border-none outline-none text-right" value={p.price_6} onChange={e => handlePresentationChange(idx, 'price_6', parseFloat(e.target.value))} /></td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={11} className="p-2 border-b">
                      <button type="button" onClick={addPresentation} className="text-[#185b9d] font-semibold text-xs hover:underline flex items-center gap-1">
                        + Añadir Presentación
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                Esta sección está inactiva en esta fase.
              </div>
            )}
          </div>

          {/* Bottom Tabs navigation */}
          <div className="bg-slate-100 flex gap-1 p-1 overflow-x-auto text-xs font-semibold shadow-inner border-b">
            <button className={`px-4 py-1.5 flex items-center gap-1 ${activeTab === 'codigo' ? 'bg-white border-t border-l border-r rounded-t shadow-sm text-blue-700' : 'text-slate-600 hover:bg-slate-200'}`} onClick={() => setActiveTab('codigo')}>
              Codigo de Barras
            </button>
            <button className={`px-4 py-1.5 flex items-center gap-1 ${activeTab === 'componentes' ? 'bg-white border-t border-l border-r rounded-t shadow-sm text-blue-700' : 'text-slate-600 hover:bg-slate-200'}`} onClick={() => setActiveTab('componentes')}>
              Componentes
            </button>
            <button className={`px-4 py-1.5 flex items-center gap-1 ${activeTab === 'proveedores' ? 'bg-white border-t border-l border-r rounded-t shadow-sm text-blue-700' : 'text-slate-600 hover:bg-slate-200'}`} onClick={() => setActiveTab('proveedores')}>
              Proveedores
            </button>
            <button className={`px-4 py-1.5 flex items-center gap-1 ${activeTab === 'cantidades' ? 'bg-white border-t border-l border-r rounded-t shadow-sm text-blue-700' : 'text-slate-600 hover:bg-slate-200'}`} onClick={() => setActiveTab('cantidades')}>
              Cantidades Minimas para una orden
            </button>
            <button className={`px-4 py-1.5 flex items-center gap-1 ${activeTab === 'calendario' ? 'bg-white border-t border-l border-r rounded-t shadow-sm text-blue-700' : 'text-slate-600 hover:bg-slate-200'}`} onClick={() => setActiveTab('calendario')}>
              Calendario de Mantenimiento
            </button>
            <button className={`px-4 py-1.5 flex items-center gap-1 ${activeTab === 'caracteristicas' ? 'bg-white border-t border-l border-r rounded-t shadow-sm text-blue-700' : 'text-slate-600 hover:bg-slate-200'}`} onClick={() => setActiveTab('caracteristicas')}>
              Caracteristicas
            </button>
            <button className={`px-4 py-1.5 flex items-center gap-1 ${activeTab === 'promocion' ? 'bg-white border-t border-l border-r rounded-t shadow-sm text-blue-700' : 'text-slate-600 hover:bg-slate-200'}`} onClick={() => setActiveTab('promocion')}>
              Promoción
            </button>
            <button className={`px-4 py-1.5 flex items-center gap-1 ${activeTab === 'presentaciones' ? 'bg-white border-t border-l border-r rounded-t shadow-sm text-[#185b9d]' : 'text-slate-600 hover:bg-slate-200'}`} onClick={() => setActiveTab('presentaciones')}>
              Presentaciones
            </button>
          </div>
          <div className="bg-[#eef2f6] h-6 flex-shrink-0 border-t border-b"></div>

        </div>

      </div>
    </div>
  );
}
