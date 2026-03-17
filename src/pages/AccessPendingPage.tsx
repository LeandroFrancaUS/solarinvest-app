// src/pages/AccessPendingPage.tsx
import type { AccessState } from "../lib/auth/access-types"
import { useAuthSessionContext } from "../auth/AuthSessionContext"
import { stackClientApp } from "../stack/client"

interface Props {
  accessState?: AccessState
}

const messages: Record<string, { title: string; body: string }> = {
  pending: {
    title: "Acesso pendente de aprovação",
    body: "Seu login foi identificado com sucesso, mas o seu acesso ao sistema ainda não foi liberado. Entre em contato com o administrador da SolarInvest para solicitar aprovação.",
  },
  blocked: {
    title: "Acesso temporariamente bloqueado",
    body: "Seu acesso ao sistema foi bloqueado temporariamente. Entre em contato com o administrador da SolarInvest para mais informações.",
  },
  revoked: {
    title: "Acesso revogado",
    body: "Seu acesso ao sistema foi revogado. Entre em contato com o administrador da SolarInvest caso acredite que isso seja um erro.",
  },
}

export default function AccessPendingPage({ accessState }: Props) {
  const { me } = useAuthSessionContext()
  const state = accessState ?? "pending"
  const msg = messages[state] ?? messages["pending"]!

  const handleSignOut = async () => {
    if (stackClientApp) {
      await stackClientApp.signOut()
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-amber-50 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">☀️</span>
            <h1 className="text-2xl font-bold text-slate-900">SolarInvest</h1>
          </div>
        </div>

        <div className="rounded-xl bg-amber-50 border border-amber-200 p-5 space-y-2">
          <p className="text-base font-semibold text-amber-800">{msg.title}</p>
          <p className="text-sm text-amber-700">{msg.body}</p>
        </div>

        {me?.user?.email && (
          <p className="text-xs text-slate-400">
            Autenticado como:{" "}
            <span className="font-medium text-slate-600">{me.user.email}</span>
          </p>
        )}

        <button
          type="button"
          onClick={() => { void handleSignOut() }}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Sair
        </button>
      </div>
    </div>
  )
}

