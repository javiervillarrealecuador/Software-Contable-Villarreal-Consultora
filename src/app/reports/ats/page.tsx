'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AtsPage() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth() + 1); // 1-12
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/reports/ats?anio=${anio}&mes=${mes}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error al generar ATS');
      }
      const data = await res.text();
      
      const blob = new Blob([data], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ATS_${anio}_${String(mes).padStart(2, '0')}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <header className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Generar Anexo Transaccional Simplificado (ATS)</h1>
          <p className="text-slate-500 mt-2">Exportación XML para el SRI (DIMM)</p>
        </div>
        <div className="flex gap-4 items-center">
          <Link href="/reports" className="btn btn-outline">← Volver a Reportes</Link>
        </div>
      </header>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 max-w-md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Año</label>
            <input 
              type="number" 
              value={anio} 
              onChange={(e) => setAnio(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mes</label>
            <select 
              value={mes} 
              onChange={(e) => setMes(Number(e.target.value))}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={1}>Enero</option>
              <option value={2}>Febrero</option>
              <option value={3}>Marzo</option>
              <option value={4}>Abril</option>
              <option value={5}>Mayo</option>
              <option value={6}>Junio</option>
              <option value={7}>Julio</option>
              <option value={8}>Agosto</option>
              <option value={9}>Septiembre</option>
              <option value={10}>Octubre</option>
              <option value={11}>Noviembre</option>
              <option value={12}>Diciembre</option>
            </select>
          </div>

          <button 
            onClick={handleDownload}
            disabled={loading}
            className="w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Generando...' : 'Descargar XML'}
          </button>
        </div>
      </div>
    </div>
  );
}
