'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import PartnerForm from '@/components/partners/PartnerForm';
import { supabase } from '@/lib/supabase';
import type { Partner } from '@/types/capa0';

export default function EditPartnerPage() {
  const params = useParams();
  const id = Number(params.id);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPartner() {
      try {
        const { data, error } = await supabase
          .from('res_partner')
          .select('*')
          .eq('id', id)
          .single();
          
        if (error) throw error;
        setPartner(data as Partner);
      } catch (err: any) {
        console.error('Error fetching partner:', err);
        alert('No se pudo cargar el partner');
      } finally {
        setLoading(false);
      }
    }
    if (id) {
      loadPartner();
    }
  }, [id]);

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Cargando datos del partner...</div>;
  }

  if (!partner) {
    return <div className="p-8 text-center text-red-500">Partner no encontrado</div>;
  }

  return (
    <div className="max-w-7xl mx-auto py-6">
      <PartnerForm initialData={partner} />
    </div>
  );
}
