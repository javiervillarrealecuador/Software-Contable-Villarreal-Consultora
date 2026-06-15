// Módulo movido al proyecto sri-descargador (C:\sri-descargador)
'use client';
import { useEffect } from 'react';

export default function DescargasRedirect() {
  useEffect(() => {
    window.location.href = 'http://localhost:3001';
  }, []);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', background: '#f0f4ff' }}>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📥</div>
        <h2 style={{ color: '#1e293b', marginBottom: '0.5rem' }}>Descargador SRI</h2>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
          El módulo de descarga fue separado a su propio servidor.<br />
          Redirigiendo a <strong>sri-descargador</strong>…
        </p>
        <a href="http://localhost:3001" style={{ background: '#059669', color: 'white', padding: '0.6rem 1.2rem', borderRadius: '0.5rem', textDecoration: 'none', fontWeight: 700 }}>
          Ir al descargador →
        </a>
      </div>
    </div>
  );
}
