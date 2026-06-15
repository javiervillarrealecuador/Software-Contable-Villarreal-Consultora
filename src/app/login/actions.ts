'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export async function login(formData: FormData) {
  const supabase = createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/login?error=true')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function logout() {
  const supabase = createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;
  const secretKey = formData.get('secret_key') as string;

  // Validate Secret Key
  const validSecret = process.env.INSTALL_SECRET || 'ERP-ECUADOR-ADMIN';
  if (secretKey !== validSecret) {
    redirect('/signup?error=Clave+de+instalación+incorrecta');
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        role: 'superadmin',
      },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // Si se crea correctamente, usamos Service Role para insertar en res_users
  // porque el usuario aún no está verificado (si email confirmation está on)
  const adminClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  if (data.user) {
    const { error: dbError } = await adminClient
      .from('res_users')
      .insert({
        id: undefined, // auto-increment
        name: name,
        email: email,
        login: email,
        is_superadmin: true,
        active: true,
      });
      
    if (dbError) {
      console.error('Error insertando res_users:', dbError);
    }
  }

  redirect('/signup?success=Usuario+creado.+Por+favor+revisa+tu+correo+para+verificar+la+cuenta.');
}
