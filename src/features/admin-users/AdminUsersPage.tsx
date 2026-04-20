// src/features/admin-users/AdminUsersPage.tsx
// Admin panel for managing user access to SolarInvest.
// Only accessible to users with role=admin and approved access.
// Tabs: Usuários | Consultores | Engenheiros | Instaladores

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { fetchAdminUsers, createUser } from '../../services/auth/admin-users'
import { AdminUsersTable } from './AdminUsersTable'
import { ConsultantsTab, EngineersTab, InstallersTab } from './PersonnelManagementTab'
import type { AdminUser, StackPermission, CreateUserRequest } from '../../lib/auth/access-types'
import { ALL_STACK_PERMISSIONS, stackPermissionLabel } from '../../lib/auth/access-mappers'

const PAGE_SIZE = 20

type AdminTab = 'users' | 'consultants' | 'engineers' | 'installers'

interface Props {
  onBack?: () => void
}

// ── Add User Modal ─────────────────────────────────────────────────────────────

interface AddUserModalProps {
  onClose: () => void
  onCreated: () => void
}

function AddUserModal({ onClose, onCreated }: AddUserModalProps) {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [permissions, setPermissions] = useState<StackPermission[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function togglePerm(perm: StackPermission) {
    setPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setError('E-mail é obrigatório.'); return }
    if (permissions.length === 0) { setError('Selecione ao menos uma permissão.'); return }

    setSubmitting(true)
    setError(null)
    try {
      const req: CreateUserRequest = {
        email: email.trim().toLowerCase(),
        displayName: displayName.trim() || undefined,
        permissions,
      }
      await createUser(req)
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar usuário')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-user-modal-title"
    >
      <div className="mx-4 w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <h2 id="add-user-modal-title" className="text-base font-semibold text-slate-900 mb-4">
          Adicionar Usuário
        </h2>

        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
          <div>
            <label htmlFor="new-user-email" className="block text-sm font-medium text-slate-700 mb-1">
              E-mail <span className="text-red-500">*</span>
            </label>
            <input
              id="new-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="usuario@exemplo.com"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div>
            <label htmlFor="new-user-name" className="block text-sm font-medium text-slate-700 mb-1">
              Nome (opcional)
            </label>
            <input
              id="new-user-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nome do usuário"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div>
            <p className="block text-sm font-medium text-slate-700 mb-2">
              Permissões <span className="text-red-500">*</span>
            </p>
            <div className="space-y-2">
              {ALL_STACK_PERMISSIONS.map((perm) => (
                <label key={perm} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm)}
                    onChange={() => togglePerm(perm)}
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-sm text-slate-700">{stackPermissionLabel(perm)}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {submitting ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Users sub-panel ────────────────────────────────────────────────────────────

function UsersPanel({ onShowAddModal }: { onShowAddModal: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadUsers = useCallback(async (currentPage: number, currentSearch: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminUsers({ page: currentPage, limit: PAGE_SIZE, search: currentSearch })
      setUsers(data.users)
      setTotal(data.total)
      setPages(data.pages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadUsers(page, search)
  }, [loadUsers, page, search])

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  function handleSearchInputChange(value: string) {
    setSearchInput(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setPage(1)
      setSearch(value)
    }, 300)
  }

  function handleRefresh() {
    void loadUsers(page, search)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <input
              type="search"
              placeholder="Buscar por nome ou e-mail..."
              value={searchInput}
              onChange={(e) => handleSearchInputChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 pl-9 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
            <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
        <button
          type="button"
          onClick={onShowAddModal}
          className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600"
        >
          ＋ Adicionar Usuário
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <AdminUsersTable users={users} onRefresh={handleRefresh} />

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>Página {page} de {pages} — {total} usuário(s)</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="rounded px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages || loading}
              className="rounded px-3 py-1 hover:bg-slate-100 disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

const TABS: { id: AdminTab; label: string; emoji: string }[] = [
  { id: 'users',       label: 'Usuários',     emoji: '👤' },
  { id: 'consultants', label: 'Consultores',  emoji: '🤝' },
  { id: 'engineers',   label: 'Engenheiros',  emoji: '⚙️' },
  { id: 'installers',  label: 'Instaladores', emoji: '🔧' },
]

export function AdminUsersPage({ onBack }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('users')
  const [showAddModal, setShowAddModal] = useState(false)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { /* UsersPanel has its own refresh */ }}
        />
      )}

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Gestão de Usuários</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gerencie usuários, consultores, engenheiros e instaladores.
          </p>
        </div>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Voltar
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="flex gap-1" aria-label="Tabs de gestão">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-1.5 rounded-t-lg border border-b-0 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-slate-200 bg-white text-amber-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'users' && (
        <UsersPanel onShowAddModal={() => setShowAddModal(true)} />
      )}
      {activeTab === 'consultants' && <ConsultantsTab />}
      {activeTab === 'engineers' && <EngineersTab />}
      {activeTab === 'installers' && <InstallersTab />}
    </div>
  )
}
