// src/components/RidePdfButton.tsx
// IMPORTANTE: Este archivo importa jsPDF y JsBarcode estáticamente.
// Debe cargarse SOLO mediante next/dynamic({ ssr: false }) para que webpack
// NUNCA lo incluya en el bundle del servidor (SSR).
// Cuando next/dynamic recibe ssr:false, el módulo queda completamente fuera
// del bundle del servidor — es la única forma garantizada en Next.js 14.
'use client';

import { useState } from 'react';
import { buildRideFactura } from '@/lib/sri-ride';
import { getRideInputForSale } from '@/lib/sri-factura-db';

interface Props {
  saleId: number;
  style?: React.CSSProperties;
}

export default function RidePdfButton({ saleId, style }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    if (loading) return;
    try {
      setLoading(true);
      const input = await getRideInputForSale(saleId);
      const doc = buildRideFactura(input);
      doc.save(`RIDE_${input.comprobante.numero.replace(/-/g, '_')}.pdf`);
    } catch (e: any) {
      alert('Error generando RIDE PDF: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      style={style}
    >
      {loading ? '...' : 'RIDE PDF'}
    </button>
  );
}
