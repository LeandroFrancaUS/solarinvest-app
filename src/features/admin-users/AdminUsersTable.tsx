// src/features/admin-users/AdminUsersTable.tsx
// Table component for displaying and managing users in the admin panel.
// Includes confirmation prompts for all destructive/role-changing actions.

import React, { useState } from 'react'
import type { AdminUser, StackPermission } from '../../lib/auth/access-types'
import { accessStatusLabel, roleLabel, ALL_STACK_PERMISSIONS, stackPermissionLabel } from '../../lib/auth/access-mappers'
import {
  approveUser,
  blockUser,
  revokeUser,
  setUserRole,
  grantPermission,
  revokePermission,
  deleteUser,
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

function PermBadge({ perm }: { perm: StackPermission }) {
  const colors: Record<StackPermission, string> = {
    role_admin: 'bg-purple-100 text-purple-700',
    role_comercial: 'bg-sky-100 text-sky-700',
    role_office: 'bg-teal-100 text-teal-700',
    role_financeiro: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[perm] ?? 'bg-slate-100 text-slate-600'}`}>
      {stackPermissionLabel(perm)}
    </span>
  )
}

// ── Confirmation dialog ────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  message: string
  onConfirm: () => void
  onCancel: () => void
  destructive?: boolean
}

function ConfirmDialog({ message, onConfirm, onCancel, destructive }: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
    >
      <div className="mx-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <p className="text-sm text-slate-700">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${destructive ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Per-row actions ────────────────────────────────────────────────────────────

interface RowActionsProps {
  user: AdminUser
  onRefresh: () => void
}

function RowActions({ user, onRefresh }: RowActionsProps) {
  const [loading, setLoading] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<{ message: string; action: () => Promise<void>; destructive?: boolean } | null>(null)

  function requestConfirm(message: string, action: () => Promise<void>, destructive?: boolean) {
    setPendingAction({ message, action, destructive })
  }

  async function executeConfirmed() {
    if (!pendingAction) return
    const fn = pendingAction.action
    setPendingAction(null)
    setLoading(true)
    setRowError(null)
    try {
      await fn()
      onRefresh()
    } catch (err) {
      setRowError(err instanceof Error ? err.message : 'Falha ao executar ação')
    } finally {
      setLoading(false)
    }
  }

  const hasPermission = (perm: StackPermission) => user.stack_permissions.includes(perm)
  const isAdmin = hasPermission('role_admin')

  return (
    <>
      {pendingAction && (
        <ConfirmDialog
          message={pendingAction.message}
          destructive={pendingAction.destructive}
          onConfirm={executeConfirmed}
          onCancel={() => setPendingAction(null)}
        />
      )}
      <div className="space-y-2">
        {rowError && (
          <p className="text-xs text-red-600">{rowError}</p>
        )}

        {/* Access status actions */}
        <div className="flex flex-wrap gap-1">
          {user.access_status !== 'approved' && (
            <button
              type="button"
              disabled={loading}
              onClick={() => requestConfirm(
                `Aprovar acesso de ${user.full_name ?? user.email}?`,
                () => approveUser(user.id),
              )}
              className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
            >
              Aprovar
            </button>
          )}
          {user.access_status !== 'blocked' && (
            <button
              type="button"
              disabled={loading}
              onClick={() => requestConfirm(
                `Bloquear acesso de ${user.full_name ?? user.email}? O usuário não conseguirá entrar no sistema.`,
                () => blockUser(user.id),
                true,
              )}
              className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Bloquear
            </button>
          )}
          {user.access_status !== 'revoked' && (
            <button
              type="button"
              disabled={loading}
              onClick={() => requestConfirm(
                `Revogar acesso de ${user.full_name ?? user.email}?`,
                () => revokeUser(user.id),
                true,
              )}
              className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Revogar
            </button>
          )}
        </div>

        {/* Stack Auth permissions */}
        <div className="flex flex-wrap gap-1">
          {ALL_STACK_PERMISSIONS.map((perm) => {
            const active = hasPermission(perm)
            const label = stackPermissionLabel(perm)
            // Non-admin permissions are implicit/inherited when the user has role_admin
            const isImplicit = isAdmin && perm !== 'role_admin' && !active

            if (isImplicit) {
              return (
                <span
                  key={perm}
                  className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-400"
                  title="Permissão implícita pelo papel Administrador"
                >
                  {label}
                </span>
              )
            }

            return active ? (
              <button
                key={perm}
                type="button"
                disabled={loading}
                onClick={() => requestConfirm(
                  `Remover permissão "${label}" de ${user.full_name ?? user.email}?`,
                  () => revokePermission(user.id, perm),
                  true,
                )}
                className="inline-flex items-center gap-0.5 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800 hover:bg-purple-200 disabled:opacity-50"
                title={`Clique para remover permissão ${label}`}
              >
                {label} ✕
              </button>
            ) : (
              <button
                key={perm}
                type="button"
                disabled={loading}
                onClick={() => requestConfirm(
                  `Conceder permissão "${label}" para ${user.full_name ?? user.email}?`,
                  () => grantPermission(user.id, perm),
                )}
                className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs font-medium text-slate-500 hover:border-purple-400 hover:text-purple-700 disabled:opacity-50"
                title={`Clique para conceder permissão ${label}`}
              >
                + {label}
              </button>
            )
          })}
        </div>

        {/* Delete button — only shown for inactive users */}
        {!user.is_active && (
          <div>
            <button
              type="button"
              disabled={loading}
              onClick={() => requestConfirm(
                `Remover permanentemente o usuário ${user.full_name ?? user.email}? Essa ação não pode ser desfeita e remove o usuário do banco de dados e do Stack Auth.`,
                () => deleteUser(user.id),
                true,
              )}
              className="rounded px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
            >
              🗑 Remover usuário
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Table ──────────────────────────────────────────────────────────────────────

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
            <th className="px-4 py-3 text-left font-medium text-slate-600">Perfil (DB)</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Permissões Stack Auth</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Último login</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {users.map((user) => (
            <tr
              key={user.id}
              className={`hover:bg-slate-50 ${!user.is_active ? 'opacity-60' : ''}`}
            >
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900">{user.full_name || '—'}</div>
                <div className="text-slate-500">{user.email}</div>
                {!user.is_active && (
                  <span className="mt-0.5 inline-block text-xs text-slate-400 italic">inativo</span>
                )}
              </td>
              <td className="px-4 py-3">
                <RoleBadge role={user.role} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {user.stack_permissions.length > 0
                    ? user.stack_permissions.map((perm) => (
                        <PermBadge key={perm} perm={perm} />
                      ))
                    : <span className="text-xs text-slate-400">Nenhuma</span>
                  }
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={user.access_status} />
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
