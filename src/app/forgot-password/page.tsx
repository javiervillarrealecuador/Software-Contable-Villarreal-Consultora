import Link from 'next/link'
import { resetPassword } from './actions'

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; success?: string }
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 rounded-xl shadow-md border border-gray-100">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Recuperar Contraseña
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
          </p>
        </div>
        
        {searchParams?.error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm text-center">
            {searchParams.error}
          </div>
        )}

        {searchParams?.success && (
          <div className="bg-green-50 text-green-600 p-3 rounded-md text-sm text-center font-medium">
            {searchParams.success}
          </div>
        )}

        <form className="mt-8 space-y-6" action={resetPassword}>
          <div className="-space-y-px rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Correo electrónico
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full rounded-md border-0 py-2.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-blue-600 sm:text-sm sm:leading-6"
                placeholder="Correo electrónico"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
            >
              Enviar enlace de recuperación
            </button>
          </div>
        </form>
        
        <div className="text-center text-sm mt-4">
          <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
            Volver a Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
