'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'

export async function resetPassword(formData: FormData) {
  const email = formData.get('email') as string
  const supabase = createClient()
  
  // Obtenemos el origin real de los headers (p. ej: https://erp-ecuador.vercel.app o http://localhost:3000)
  const origin = headers().get('origin')

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  if (error) {
    redirect('/forgot-password?error=No+se+pudo+enviar+el+correo')
  }

  redirect('/forgot-password?success=Revisa+tu+bandeja+de+entrada')
}

export async function updatePassword(formData: FormData) {
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (password !== confirmPassword) {
    redirect('/reset-password?error=Las+contraseñas+no+coinciden')
  }

  const supabase = createClient()
  const { error } = await supabase.auth.updateUser({
    password: password
  })

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`)
  }

  redirect('/login?success=Contraseña+actualizada+correctamente')
}
