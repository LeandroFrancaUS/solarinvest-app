// src/pages/SignInPage.tsx
import { useState } from "react"
import { stackClientApp } from "../stack/client"

export default function SignInPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stackClientApp) return
    setError(null)
    setLoading(true)
    try {
      const result = await stackClientApp.signInWithCredential({
        email: email.trim(),
        password,
      })
      if (result.status === "error") {
        setError("E-mail ou senha incorretos. Tente novamente.")
      }
    } catch {
      setError("Não foi possível fazer login. Verifique sua conexão e tente novamente.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    if (!stackClientApp) return
    setError(null)
    try {
      await stackClientApp.signInWithOAuth("google")
    } catch {
      setError("Não foi possível iniciar o login com Google.")
    }
  }

  const handleForgotPassword = async () => {
    if (!stackClientApp) return
    if (!email.trim()) {
      setError("Informe seu e-mail antes de solicitar a recuperação de senha.")
      return
    }
    setError(null)
    setLoading(true)
    try {
      await stackClientApp.sendForgotPasswordEmail(email.trim())
      setError("E-mail de recuperação enviado. Verifique sua caixa de entrada.")
    } catch {
      setError("Não foi possível enviar o e-mail de recuperação.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-amber-50 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* Logo / Brand */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">☀️</span>
            <h1 className="text-2xl font-bold text-slate-900">SolarInvest</h1>
          </div>
          <p className="text-sm text-slate-500">Faça login para continuar</p>
        </div>

        {/* Google Sign In */}
        <button
          type="button"
          onClick={() => { void handleGoogleSignIn() }}
          className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 active:bg-slate-100"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Entrar com Google
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs text-slate-400">
            <span className="bg-white px-2">ou continue com e-mail</span>
          </div>
        </div>

        {/* Email / Password Form */}
        <form onSubmit={(e) => { void handleEmailSignIn(e) }} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="seu@email.com"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-600 active:bg-amber-700 disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={() => { void handleForgotPassword() }}
            className="text-xs text-slate-400 underline hover:text-slate-600"
          >
            Esqueci minha senha
          </button>
        </div>

        <p className="text-center text-xs text-slate-400">
          Suas credenciais são protegidas com autenticação segura.
        </p>
      </div>
    </div>
  )
}

