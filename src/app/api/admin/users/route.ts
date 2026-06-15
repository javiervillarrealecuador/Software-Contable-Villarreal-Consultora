import { NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: Request) {
  try {
    const supabaseClient = await createClient();
    const { data: { user } } = await supabaseClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar permisos del usuario actual (debe ser admin o superadmin)
    const { data: currentUser, error: userError } = await supabaseClient
      .from('res_users')
      .select('is_superadmin, role, company_id')
      .eq('email', user.email)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 403 });
    }

    if (!currentUser.is_superadmin && currentUser.role !== 'admin') {
      return NextResponse.json({ error: 'Permisos insuficientes' }, { status: 403 });
    }

    const { email, name, role, company_ids } = await req.json();

    if (!email || !role || !company_ids || company_ids.length === 0) {
      return NextResponse.json({ error: 'Email, rol y al menos una empresa son obligatorios' }, { status: 400 });
    }

    // Usar el Service Role Key para invitar al usuario mediante Supabase Auth
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Invitar al usuario (envía correo mágico para que cree su contraseña)
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { name, role, is_superadmin: false }
    });

    if (inviteError) {
      // Si el error es que ya existe, podemos omitir este paso y simplemente crear/actualizar en res_users
      if (!inviteError.message.includes('already exists')) {
        return NextResponse.json({ error: inviteError.message }, { status: 400 });
      }
    }

    // 2. Crear el registro en res_users
    // En caso de que el usuario ya exista, debemos hacer un upsert.
    // Usamos el id aleatorio para el partner o lo creamos si no existe.
    // Por simplicidad, primero buscamos si existe en res_users.
    
    const { data: existingUser } = await supabaseAdmin
      .from('res_users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      // Actualizar
      const { error: updateError } = await supabaseAdmin
        .from('res_users')
        .update({
          name: name || email.split('@')[0],
          role: role,
          company_ids: company_ids,
          company_id: company_ids[0], // Empresa por defecto
          active: true
        })
        .eq('id', existingUser.id);
        
      if (updateError) throw updateError;
    } else {
      // Insertar nuevo usuario
      const { error: insertError } = await supabaseAdmin
        .from('res_users')
        .insert({
          name: name || email.split('@')[0],
          email: email,
          login: email,
          role: role,
          company_ids: company_ids,
          company_id: company_ids[0],
          active: true
        });
        
      if (insertError) throw insertError;
    }

    return NextResponse.json({ success: true, message: 'Usuario invitado correctamente' });

  } catch (error: any) {
    console.error('Error invitando usuario:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
