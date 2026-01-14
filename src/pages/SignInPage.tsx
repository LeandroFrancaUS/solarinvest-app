// src/pages/SignInPage.tsx
// This page is currently not in use. The auth flow is handled in Providers.tsx
// If you need a dedicated login page, integrate with @stackframe/react properly
export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10 text-center">
      <div className="max-w-lg space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">
          Carregando...
        </h1>
        <p className="text-sm text-slate-600">
          Você será redirecionado automaticamente.
        </p>
      </div>
    </div>
  )
}
