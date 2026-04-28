// src/features/operacao/SegurosPage.tsx
// Insurance policies page: lists insurance_policies from /api/operations/insurance.

import { useCallback, useEffect, useState } from 'react'
import {
  listInsurancePolicies,
  createInsurancePolicy,
  type InsuranceFilters,
} from './operationsApi'
import type { InsurancePolicy, CreateInsurancePolicyPayload, InsuranceStatus } from './operationTypes'
import { INSURANCE_STATUSES } from './operationTypes'

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

export function SegurosPage() {
  const [items, setItems] = useState<InsurancePolicy[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formClientId, setFormClientId] = useState('')
  const [formInsurer, setFormInsurer] = useState('')
  const [formPolicyNumber, setFormPolicyNumber] = useState('')
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')

  const load = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    const filters: InsuranceFilters = {}
    if (statusFilter) filters.status = statusFilter
    try {
      const data = await listInsurancePolicies(filters)
      setItems(data)
      setLoadState('loaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar seguros.')
      setLoadState('error')
    }
  }, [statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    const clientIdNum = formClientId ? parseInt(formClientId, 10) : NaN
    if (!Number.isFinite(clientIdNum) || clientIdNum <= 0) {
      setFormError('ID do cliente é obrigatório e deve ser um número válido.')
      return
    }
    setSubmitting(true)
    const payload: CreateInsurancePolicyPayload = { client_id: clientIdNum }
    if (formInsurer.trim()) payload.insurer = formInsurer.trim()
    if (formPolicyNumber.trim()) payload.policy_number = formPolicyNumber.trim()
    if (formStartDate) payload.start_date = formStartDate
    if (formEndDate) payload.end_date = formEndDate
    try {
      const created = await createInsurancePolicy(payload)
      setItems((prev) => [created, ...prev])
      setShowForm(false)
      setFormClientId('')
      setFormInsurer('')
      setFormPolicyNumber('')
      setFormStartDate('')
      setFormEndDate('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar apólice.')
    } finally {
      setSubmitting(false)
    }
  }, [formClientId, formInsurer, formPolicyNumber, formStartDate, formEndDate])

  return (
    <div className="operacao-page">
      <div className="operacao-page-header">
        <h1>Seguros</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setShowForm((v) => !v); setFormError(null) }}
        >
          {showForm ? 'Cancelar' : 'Nova apólice'}
        </button>
      </div>

      {showForm && (
        <form className="operacao-form" onSubmit={(e) => { void handleCreate(e) }}>
          <h2>Nova apólice</h2>
          {formError && <p className="operacao-form-error" role="alert">{formError}</p>}
          <label>
            ID do cliente * <span className="operacao-label-hint">(número)</span>
            <input
              type="number"
              min="1"
              value={formClientId}
              onChange={(e) => setFormClientId(e.target.value)}
              placeholder="ex: 42"
              required
            />
          </label>
          <label>
            Seguradora
            <input
              type="text"
              value={formInsurer}
              onChange={(e) => setFormInsurer(e.target.value)}
            />
          </label>
          <label>
            Número da apólice
            <input
              type="text"
              value={formPolicyNumber}
              onChange={(e) => setFormPolicyNumber(e.target.value)}
            />
          </label>
          <label>
            Início da vigência
            <input
              type="date"
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.target.value)}
            />
          </label>
          <label>
            Fim da vigência
            <input
              type="date"
              value={formEndDate}
              onChange={(e) => setFormEndDate(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Salvando…' : 'Salvar'}
          </button>
        </form>
      )}

      <div className="operacao-filters">
        <label>
          Status:
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            {INSURANCE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-secondary" onClick={() => { void load() }}>
          Atualizar
        </button>
      </div>

      {loadState === 'loading' && <p className="operacao-status">Carregando…</p>}
      {loadState === 'error' && (
        <p className="operacao-status operacao-status-error" role="alert">
          {error}
          <button type="button" className="btn-link" onClick={() => { void load() }}>Tentar novamente</button>
        </p>
      )}
      {loadState === 'loaded' && items.length === 0 && (
        <div className="operacao-empty">
          <p>Nenhuma apólice encontrada.</p>
        </div>
      )}
      {loadState === 'loaded' && items.length > 0 && (
        <div className="operacao-table-wrapper">
          <table className="operacao-table">
            <thead>
              <tr>
                <th>Seguradora</th>
                <th>Apólice</th>
                <th>Status</th>
                <th>Início</th>
                <th>Fim</th>
                <th>Cliente ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td>{p.insurer ?? '—'}</td>
                  <td>{p.policy_number ?? '—'}</td>
                  <td>
                    <span className={`operacao-badge operacao-badge-${p.status as InsuranceStatus}`}>
                      {p.status}
                    </span>
                  </td>
                  <td>{p.start_date ? new Date(p.start_date).toLocaleDateString('pt-BR') : '—'}</td>
                  <td>{p.end_date ? new Date(p.end_date).toLocaleDateString('pt-BR') : '—'}</td>
                  <td>{p.client_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
