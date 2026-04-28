// src/features/operacao/ChamadosPage.tsx
// Service tickets page: lists service_tickets from /api/operations/tickets.

import { useCallback, useEffect, useState } from 'react'
import {
  listTickets,
  createTicket,
  type TicketFilters,
} from './operationsApi'
import type { ServiceTicket, CreateTicketPayload, TicketPriority, TicketStatus } from './operationTypes'
import { TICKET_PRIORITIES, TICKET_STATUSES } from './operationTypes'

type LoadState = 'idle' | 'loading' | 'loaded' | 'error'

export function ChamadosPage() {
  const [items, setItems] = useState<ServiceTicket[]>([])
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formClientId, setFormClientId] = useState('')
  const [formPriority, setFormPriority] = useState<TicketPriority | ''>('')
  const [formDescription, setFormDescription] = useState('')

  const load = useCallback(async () => {
    setLoadState('loading')
    setError(null)
    const filters: TicketFilters = {}
    if (statusFilter) filters.status = statusFilter
    try {
      const data = await listTickets(filters)
      const filtered = priorityFilter
        ? data.filter((t) => t.priority === priorityFilter)
        : data
      setItems(filtered)
      setLoadState('loaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar chamados.')
      setLoadState('error')
    }
  }, [statusFilter, priorityFilter])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!formTitle.trim()) { setFormError('Título é obrigatório.'); return }
    const clientIdNum = formClientId ? parseInt(formClientId, 10) : NaN
    if (!Number.isFinite(clientIdNum) || clientIdNum <= 0) {
      setFormError('ID do cliente é obrigatório e deve ser um número válido.')
      return
    }
    setSubmitting(true)
    const payload: CreateTicketPayload = {
      client_id: clientIdNum,
      title: formTitle.trim(),
    }
    if (formPriority) payload.priority = formPriority
    if (formDescription.trim()) payload.description = formDescription.trim()
    try {
      const created = await createTicket(payload)
      setItems((prev) => [created, ...prev])
      setShowForm(false)
      setFormTitle('')
      setFormClientId('')
      setFormPriority('')
      setFormDescription('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao criar chamado.')
    } finally {
      setSubmitting(false)
    }
  }, [formTitle, formClientId, formPriority, formDescription])

  return (
    <div className="operacao-page">
      <div className="operacao-page-header">
        <h1>Chamados</h1>
        <button
          type="button"
          className="btn-primary"
          onClick={() => { setShowForm((v) => !v); setFormError(null) }}
        >
          {showForm ? 'Cancelar' : 'Novo chamado'}
        </button>
      </div>

      {showForm && (
        <form className="operacao-form" onSubmit={(e) => { void handleCreate(e) }}>
          <h2>Novo chamado</h2>
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
            Título *
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
            />
          </label>
          <label>
            Prioridade
            <select value={formPriority} onChange={(e) => setFormPriority(e.target.value as TicketPriority | '')}>
              <option value="">— selecione —</option>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            Descrição
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={3}
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
            {TICKET_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Prioridade:
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">Todas</option>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>{p}</option>
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
          <p>Nenhum chamado encontrado.</p>
        </div>
      )}
      {loadState === 'loaded' && items.length > 0 && (
        <div className="operacao-table-wrapper">
          <table className="operacao-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Prioridade</th>
                <th>Status</th>
                <th>Tipo</th>
                <th>Agendado</th>
                <th>Cliente ID</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td>{t.title}</td>
                  <td>{t.priority ? (
                    <span className={`operacao-badge operacao-badge-priority-${t.priority as TicketPriority}`}>
                      {t.priority}
                    </span>
                  ) : '—'}</td>
                  <td>
                    <span className={`operacao-badge operacao-badge-${t.status as TicketStatus}`}>
                      {t.status}
                    </span>
                  </td>
                  <td>{t.ticket_type ?? '—'}</td>
                  <td>{t.scheduled_at ? new Date(t.scheduled_at).toLocaleDateString('pt-BR') : '—'}</td>
                  <td>{t.client_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
