// src/features/admin-users/AdminUsersPage.tsx
import { useCallback, useEffect, useState } from "react"
import type { AppUserAccess } from "../../lib/auth/access-types"
import {
  fetchAdminUsers,
  approveUser,
  blockUser,
  revokeUser,
  changeUserRole,
} from "../../services/auth/admin-users"

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  blocked: "Bloqueado",
  revoked: "Revogado",
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  manager: "Gerente",
  user: "Usuário",
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  blocked: "bg-red-100 text-red-800",
  revoked: "bg-slate-100 text-slate-600",
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUserAccess[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  const PER_PAGE = 20

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchAdminUsers({
      page,
      perPage: PER_PAGE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    })
    if (data) {
      setUsers(data.users)
      setTotal(data.total)
    }
    setLoading(false)
  }, [page, debouncedSearch])

  useEffect(() => {
    void load()
  }, [load])

  const showMessage = (type: "ok" | "err", text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const doAction = async (userId: string, action: () => Promise<boolean>, label: string) => {
    setActionLoading(userId + label)
    const ok = await action()
    if (ok) {
      showMessage("ok", `Ação "${label}" realizada com sucesso.`)
      await load()
    } else {
      showMessage("err", `Falha ao executar "${label}".`)
    }
    setActionLoading(null)
  }

  const totalPages = Math.ceil(total / PER_PAGE)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gerenciamento de Usuários</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} usuário{total !== 1 ? "s" : ""} registrado{total !== 1 ? "s" : ""}</p>
        </div>
        <input
          type="search"
          placeholder="Buscar por nome ou e-mail..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-64 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
      </div>

      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            message.type === "ok"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3">Nome / E-mail</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ativo</th>
              <th className="px-4 py-3">Último login</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
            {!loading &&
              users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {user.full_name ?? <span className="text-slate-400 italic">Sem nome</span>}
                    </div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      disabled={Boolean(actionLoading)}
                      onChange={(e) => {
                        void doAction(
                          user.id,
                          () => changeUserRole(user.id, e.target.value as "admin" | "manager" | "user"),
                          `mudar para ${e.target.value}`,
                        )
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs focus:border-amber-500 focus:outline-none"
                    >
                      <option value="user">Usuário</option>
                      <option value="manager">Gerente</option>
                      <option value="admin">Admin</option>
                    </select>
                    <span className="ml-1 hidden">{ROLE_LABELS[user.role]}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_COLORS[user.access_status] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {STATUS_LABELS[user.access_status] ?? user.access_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={user.is_active ? "text-green-600" : "text-red-500"}>
                      {user.is_active ? "Sim" : "Não"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {user.last_login_at
                      ? new Date(user.last_login_at).toLocaleString("pt-BR")
                      : "Nunca"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {user.access_status !== "approved" && (
                        <ActionButton
                          label="Aprovar"
                          color="green"
                          loading={actionLoading === user.id + "Aprovar"}
                          onClick={() => { void doAction(user.id, () => approveUser(user.id), "Aprovar") }}
                        />
                      )}
                      {user.access_status === "approved" && (
                        <ActionButton
                          label="Bloquear"
                          color="yellow"
                          loading={actionLoading === user.id + "Bloquear"}
                          onClick={() => { void doAction(user.id, () => blockUser(user.id), "Bloquear") }}
                        />
                      )}
                      {user.access_status !== "revoked" && (
                        <ActionButton
                          label="Revogar"
                          color="red"
                          loading={actionLoading === user.id + "Revogar"}
                          onClick={() => { void doAction(user.id, () => revokeUser(user.id), "Revogar") }}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-slate-300 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionButton({
  label,
  color,
  loading,
  onClick,
}: {
  label: string
  color: "green" | "yellow" | "red"
  loading: boolean
  onClick: () => void
}) {
  const colors = {
    green: "bg-green-100 text-green-800 hover:bg-green-200 border-green-200",
    yellow: "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200",
    red: "bg-red-100 text-red-800 hover:bg-red-200 border-red-200",
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium transition disabled:opacity-50 ${colors[color]}`}
    >
      {loading ? "..." : label}
    </button>
  )
}
