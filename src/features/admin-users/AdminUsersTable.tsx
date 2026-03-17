// src/features/admin-users/AdminUsersTable.tsx
// Table component for displaying and managing users in the admin panel.

import React, { useState } from 'react'
import type { AdminUser, AccessRole } from '../../lib/auth/access-types'
import { accessStatusLabel, roleLabel } from '../../lib/auth/access-mappers'
import {
  approveUser,
  blockUser,
  revokeUser,
  setUserRole,
} from '../../services/auth/admin-users'

interface Props {
  users: AdminUser[]
  onRefresh: () => void
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    approved: 'bg-green-100 text-green-800',
    pending: 'bg-amber-100 text-amber-800',
    blocked: 'bg-red-100 text-red-800',
    revoked: 'bg-slate-100 text-slate-600',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {accessStatusLabel(status)}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-800',
    manager: 'bg-blue-100 text-blue-800',
    user: 'bg-slate-100 text-slate-600',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[role] ?? 'bg-slate-100 text-slate-600'}`}>
      {roleLabel(role)}
    </span>
  )
}

interface RowActionsProps {
  user: AdminUser
  onRefresh: () => void
}

function RowActions({ user, onRefresh }: RowActionsProps) {
  const [loading, setLoading] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)

  async function doAction(action: () => Promise<void>) {
    setLoading(true)
    setRowError(null)
    try {
      await action()
      onRefresh()
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Falha ao executar ação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-1">
      {rowError && (
        <p className="text-xs text-red-600">{rowError}</p>
      )}
      <div className="flex flex-wrap gap-1">
      {user.access_status !== 'approved' && (
        <button
          type="button"
          disabled={loading}
          onClick={() => { void doAction(() => approveUser(user.id)) }}
          className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
        >
          Aprovar
        </button>
      )}
      {user.access_status !== 'blocked' && (
        <button
          type="button"
          disabled={loading}
          onClick={() => { void doAction(() => blockUser(user.id)) }}
          className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Bloquear
        </button>
      )}
      {user.access_status !== 'revoked' && (
        <button
          type="button"
          disabled={loading}
          onClick={() => { void doAction(() => revokeUser(user.id)) }}
          className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Revogar
        </button>
      )}
      {user.role !== 'admin' && (
        <button
          type="button"
          disabled={loading}
          onClick={() => { void doAction(() => setUserRole(user.id, 'admin')) }}
          className="rounded px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
        >
          + Admin
        </button>
      )}
      {user.role === 'admin' && (
        <button
          type="button"
          disabled={loading}
          onClick={() => { void doAction(() => setUserRole(user.id, 'user' as AccessRole)) }}
          className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          − Admin
        </button>
      )}
      </div>
    </div>
  )
}

export function AdminUsersTable({ users, onRefresh }: Props) {
  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
        <p className="text-sm text-slate-500">Nenhum usuário encontrado.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Nome / E-mail</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Perfil</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Último login</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{user.full_name || '—'}</div>
                <div className="text-slate-500">{user.email}</div>
              </td>
              <td className="px-4 py-3">
                <RoleBadge role={user.role} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={user.access_status} />
                {!user.is_active && (
                  <span className="ml-1 text-xs text-slate-400">(inativo)</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {formatDate(user.last_login_at)}
              </td>
              <td className="px-4 py-3">
                <RowActions user={user} onRefresh={onRefresh} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
