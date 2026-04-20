// src/features/admin-users/ImportFromExistingModal.tsx
// Reusable modal for searching and selecting an existing user or client to
// pre-fill a personnel form (consultant / engineer / installer).
//
// This component is a pure UI tool — it does NOT save anything automatically.
// When the admin selects a record it calls `onImport(type, record)` and
// the parent component decides how to apply the data to its form state.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  fetchImportableUsers,
  fetchImportableClients,
  type ImportableUser,
  type ImportableClient,
} from '../../services/personnelImport'

export type ImportSource = 'users' | 'clients'
export type ImportRecord = ImportableUser | ImportableClient

export interface ImportFromExistingModalProps {
  /**
   * Which entities to allow importing from.
   * If only one is provided, the source-tabs are hidden and that source is
   * used directly.
   */
  sources?: ImportSource[]
  onImport: (source: ImportSource, record: ImportRecord) => void
  onClose: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-amber-500" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function ImportFromExistingModal({
  sources = ['users', 'clients'],
  onImport,
  onClose,
}: ImportFromExistingModalProps) {
  const [activeSource, setActiveSource] = useState<ImportSource>(sources[0] ?? 'users')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [users, setUsers] = useState<ImportableUser[]>([])
  const [clients, setClients] = useState<ImportableClient[]>([])

  const [selectedUser, setSelectedUser] = useState<ImportableUser | null>(null)
  const [selectedClient, setSelectedClient] = useState<ImportableClient | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef(search)
  searchRef.current = search

  // ── Fetch ────────────────────────────────────────────────────────────────

  const doFetch = useCallback(async (source: ImportSource, q: string) => {
    setLoading(true)
    setError(null)
    try {
      if (source === 'users') {
        const data = await fetchImportableUsers(q)
        setUsers(data)
      } else {
        const data = await fetchImportableClients(q)
        setClients(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load when modal opens or source changes
  useEffect(() => {
    void doFetch(activeSource, search)
    // Reset selection when source changes
    setSelectedUser(null)
    setSelectedClient(null)
    // search is intentionally excluded: initial load should not re-run on every keystroke
  }, [activeSource, doFetch])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void doFetch(activeSource, searchRef.current)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, activeSource, doFetch])

  // ── Confirm ──────────────────────────────────────────────────────────────

  function handleConfirm() {
    if (activeSource === 'users' && selectedUser) {
      onImport('users', selectedUser)
    } else if (activeSource === 'clients' && selectedClient) {
      onImport('clients', selectedClient)
    }
  }

  const hasSelection = activeSource === 'users' ? selectedUser !== null : selectedClient !== null

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Importar dados"
    >
      <div className="mx-4 w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Importar dados existentes</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Info banner */}
        <div className="mx-5 mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 border border-amber-200">
          Os dados serão apenas pré-preenchidos no formulário. Nenhuma entidade é alterada ou vinculada automaticamente.
        </div>

        {/* Source tabs (only when both sources are shown) */}
        {sources.length > 1 && (
          <div className="flex gap-1 px-5 pt-4">
            {sources.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => setActiveSource(src)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeSource === src
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {src === 'users' ? 'Usuários do app' : 'Clientes'}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="px-5 pt-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nome, e-mail ou telefone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm placeholder:text-slate-400 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-200"
              autoFocus
            />
            <svg className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            {loading && (
              <span className="absolute right-2.5 top-2">
                <Spinner />
              </span>
            )}
          </div>
        </div>

        {/* Results list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</p>
          )}

          {!loading && !error && activeSource === 'users' && (
            <>
              {users.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Nenhum usuário encontrado.</p>
              ) : (
                <ul className="space-y-1">
                  {users.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedUser(u)}
                        className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                          selectedUser?.id === u.id
                            ? 'bg-amber-50 border border-amber-300'
                            : 'border border-transparent hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-medium text-slate-900">{u.full_name || '(sem nome)'}</p>
                        <p className="text-xs text-slate-500">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {!loading && !error && activeSource === 'clients' && (
            <>
              {clients.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">Nenhum cliente encontrado.</p>
              ) : (
                <ul className="space-y-1">
                  {clients.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedClient(c)}
                        className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                          selectedClient?.id === c.id
                            ? 'bg-amber-50 border border-amber-300'
                            : 'border border-transparent hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-sm font-medium text-slate-900">{c.name || '(sem nome)'}</p>
                        <p className="text-xs text-slate-500">
                          {c.email}{c.phone ? ` · ${c.phone}` : ''}
                          {c.document ? ` · ${c.document}` : ''}
                          {(c.city || c.state) ? ` · ${[c.city, c.state].filter(Boolean).join('/')}` : ''}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Preview of selected record */}
        {hasSelection && (
          <div className="border-t border-slate-100 mx-5 mb-1 mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <p className="font-medium text-slate-500 mb-1">Dados que serão pré-preenchidos:</p>
            {activeSource === 'users' && selectedUser && (
              <ul className="space-y-0.5">
                {selectedUser.full_name && <li>• Nome: <span className="font-medium">{selectedUser.full_name}</span></li>}
                {selectedUser.email && <li>• E-mail: <span className="font-medium">{selectedUser.email}</span></li>}
                {selectedUser.phone && <li>• Telefone: <span className="font-medium">{selectedUser.phone}</span></li>}
              </ul>
            )}
            {activeSource === 'clients' && selectedClient && (
              <ul className="space-y-0.5">
                {selectedClient.name && <li>• Nome: <span className="font-medium">{selectedClient.name}</span></li>}
                {selectedClient.email && <li>• E-mail: <span className="font-medium">{selectedClient.email}</span></li>}
                {selectedClient.phone && <li>• Telefone: <span className="font-medium">{selectedClient.phone}</span></li>}
                {selectedClient.state && <li>• Estado (UF): <span className="font-medium">{selectedClient.state}</span></li>}
              </ul>
            )}
          </div>
        )}

        {/* Footer actions */}
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!hasSelection}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Confirmar importação
          </button>
        </div>
      </div>
    </div>
  )
}
