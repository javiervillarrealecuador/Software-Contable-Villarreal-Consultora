// src/app/layout.tsx

import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import AppLayout from '@/components/layout/AppLayout';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const poppins = Poppins({ 
  weight: ['400', '600', '700'], 
  subsets: ['latin'],
  variable: '--font-poppins'
});

export const metadata: Metadata = {
  title: 'ERP Ecuador - Contabilidad & Tributación',
  description: 'Sistema ERP moderno multiempresa para Ecuador con IA integrada',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es-EC" className={`${inter.variable} ${poppins.variable}`}>
      <body className="bg-slate-50 min-h-screen text-slate-900">
        <AppLayout>
          {children}
        </AppLayout>
      </body>
    </html>
  );
}
