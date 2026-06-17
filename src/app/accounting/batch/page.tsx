'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function BatchAccountingPage() {
  const [docType, setDocType] = useState('sale');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleProcess = async () => {
    if (!startDate || !endDate) return alert('Seleccione un rango de fechas');
    if (startDate > endDate) return alert('La fecha de inicio debe ser menor o igual a la de fin');
    
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/accounting/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType, startDate, endDate }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <header className="flex justify-between items-end mb-8">
        <div>
          <Link href="/accounting" className="text-blue-600 text-sm font-semibold mb-2 inline-block">← Volver al Plan de Cuentas</Link>
          <h1 className="text-3xl font-bold text-slate-800">Contabilización Masiva</h1>
          <p className="text-slate-500 mt-2">Generar asientos contables en lote por rango de fechas</p>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="card">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Tipo de Operación</label>
              <select className="w-full p-2 border border-slate-300 rounded" value={docType} onChange={e => setDocType(e.target.value)}>
                <option value="sale">Ventas</option>
                <option value="received_withholding">Retenciones Recibidas (Clientes)</option>
                <option value="purchase">Compras</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Desde Fecha</label>
              <input type="date" className="w-full p-2 border border-slate-300 rounded" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Hasta Fecha</label>
              <input type="date" className="w-full p-2 border border-slate-300 rounded" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>

          <button 
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-colors"
            onClick={handleProcess}
            disabled={loading}
          >
            {loading ? 'Procesando...' : 'Procesar Contabilización'}
          </button>
        </div>

        {result && (
          <div className="mt-8">
            <h3 className="text-xl font-bold mb-4 text-slate-800">Resultados</h3>
            <div className="bg-white rounded border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex gap-8">
                <div className="text-green-600 font-bold">✅ Procesados: {result.results?.length || 0}</div>
                <div className="text-red-600 font-bold">❌ Errores: {result.errors?.length || 0}</div>
              </div>
              
              {result.errors && result.errors.length > 0 && (
                <div className="p-4 border-b border-red-100 bg-red-50">
                  <h4 className="font-bold text-red-800 mb-2">Detalle de Errores:</h4>
                  <ul className="text-sm text-red-700 list-disc pl-5">
                    {result.errors.map((err: any, i: number) => (
                      <li key={i}><strong>{err.name || 'Doc'}:</strong> {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {result.results && result.results.length > 0 && (
                <div className="p-4 max-h-60 overflow-y-auto">
                  <h4 className="font-bold text-slate-800 mb-2">Asientos Generados:</h4>
                  <ul className="text-sm text-slate-600 space-y-1">
                    {result.results.map((res: any, i: number) => (
                      <li key={i}>{res.name} ➔ Asiento MOVE-{res.moveId}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
