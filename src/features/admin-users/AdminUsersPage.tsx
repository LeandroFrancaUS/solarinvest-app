// src/features/admin-users/AdminUsersPage.tsx
// Admin panel for managing user access to SolarInvest.
// Only accessible to users with role=admin and approved access.

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { fetchAdminUsers } from '../../services/auth/admin-users'
import { AdminUsersTable } from './AdminUsersTable'
import type { AdminUser } from '../../lib/auth/access-types'

const PAGE_SIZE = 20

export function AdminUsersPage() {
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Gestão de Usuários</h1>
        <p className="mt-1 text-sm text-slate-500">
          Gerencie o acesso dos usuários ao SolarInvest. Total: <strong>{total}</strong> usuário(s).
        </p>
      </div>

      <div className="mb-4 flex items-center gap-3">
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

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      <AdminUsersTable users={users} onRefresh={handleRefresh} />

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>
            Página {page} de {pages}
          </span>
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
