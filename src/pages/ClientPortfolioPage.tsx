import React, { useEffect, useMemo, useState } from 'react'
import { useClientPortfolio, usePortfolioClient } from '../hooks/useClientPortfolio'
import type { PortfolioClientRow } from '../types/clientPortfolio'
import {
  deleteClientFromPortfolio,
  removeClientFromPortfolio,
  updateClientFromPortfolio,
} from '../services/clientPortfolioApi'
import type { UpdateClientInput } from '../lib/api/clientsApi'

interface Props {
  onBack: () => void
}

interface ClientEditForm {
  name: string
  document: string
  phone: string
  email: string
  city: string
  state: string
  address: string
  cep: string
  uc: string
  uc_beneficiaria: string
  consumption_kwh_month: string
  system_kwp: string
  term_months: string
  distribuidora: string
}

const MOBILE_BREAKPOINT = 980

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('pt-BR')
}

function formFromClient(client: PortfolioClientRow): ClientEditForm {
  return {
    name: client.name ?? '',
    document: client.document ?? '',
    phone: client.phone ?? '',
    email: client.email ?? '',
    city: client.city ?? '',
    state: client.state ?? '',
    address: client.address ?? '',
    cep: '',
    uc: client.uc ?? '',
    uc_beneficiaria: client.uc_beneficiaria ?? '',
    consumption_kwh_month: client.consumption_kwh_month?.toString() ?? '',
    system_kwp: client.system_kwp?.toString() ?? '',
    term_months: client.term_months?.toString() ?? '',
    distribuidora: client.distribuidora ?? '',
  }
}

function toUpdatePayload(form: ClientEditForm): UpdateClientInput {
  const parseNullableNumber = (value: string): number | null => {
    if (!value.trim()) return null
    const parsed = Number(value.replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }

  const payload: UpdateClientInput = {
    name: form.name,
    consumption_kwh_month: parseNullableNumber(form.consumption_kwh_month),
    system_kwp: parseNullableNumber(form.system_kwp),
    term_months: parseNullableNumber(form.term_months),
  }

  const setIfPresent = (key: keyof UpdateClientInput, value: string) => {
    if (value.trim()) {
      ;(payload as Record<string, unknown>)[key] = value.trim()
    }
  }

  setIfPresent('document', form.document)
  setIfPresent('phone', form.phone)
  setIfPresent('email', form.email)
  setIfPresent('city', form.city)
  setIfPresent('state', form.state)
  setIfPresent('address', form.address)
  setIfPresent('cep', form.cep)
  setIfPresent('uc', form.uc)
  setIfPresent('uc_beneficiaria', form.uc_beneficiaria)
  setIfPresent('distribuidora', form.distribuidora)

  return payload
}

function ClientCard({
  client,
  selected,
  onSelect,
}: {
  client: PortfolioClientRow
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        border: `1px solid ${selected ? '#3b82f6' : 'var(--border, #334155)'}`,
        borderRadius: 12,
        background: selected ? 'rgba(59,130,246,0.08)' : 'var(--surface, #1e293b)',
        padding: 14,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{client.name || 'Sem nome'}</div>
      <div style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)', display: 'grid', gap: 3 }}>
        <span>{client.city ? `${client.city} / ${client.state ?? '—'}` : 'Cidade não informada'}</span>
        <span>Telefone: {client.phone || '—'}</span>
        <span>E-mail: {client.email || '—'}</span>
        <span>UC: {client.uc || '—'}</span>
        <span>Exportado: {formatDate(client.exported_to_portfolio_at)}</span>
      </div>
    </button>
  )
}

function Drawer({
  open,
  isMobile,
  children,
}: {
  open: boolean
  isMobile: boolean
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div style={{
      width: isMobile ? '100%' : '42%',
      borderLeft: isMobile ? 'none' : '1px solid var(--border, #334155)',
      borderTop: isMobile ? '1px solid var(--border, #334155)' : 'none',
      background: 'var(--surface, #0f172a)',
      overflowY: 'auto',
    }}>
      {children}
    </div>
  )
}

function ClientDetailEditor({
  clientId,
  onClose,
  onSaved,
  onRemoved,
  onDeleted,
}: {
  clientId: number
  onClose: () => void
  onSaved: (id: number) => void
  onRemoved: (id: number) => void
  onDeleted: (id: number) => void
}) {
  const { client, isLoading, error, reload } = usePortfolioClient(clientId)
  const [form, setForm] = useState<ClientEditForm | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (client) setForm(formFromClient(client))
  }, [client])

  const handleChange = (field: keyof ClientEditForm, value: string) => {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  const handleSave = async () => {
    if (!form) return
    setIsSaving(true)
    setFeedback(null)
    try {
      await updateClientFromPortfolio(clientId, toUpdatePayload(form))
      setFeedback('Cliente atualizado com sucesso.')
      reload()
      onSaved(clientId)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Não foi possível salvar as alterações do cliente.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemove = async () => {
    const confirmed = window.confirm('Remover este cliente da carteira? O cliente continuará na base geral.')
    if (!confirmed) return
    setIsRemoving(true)
    setFeedback(null)
    try {
      await removeClientFromPortfolio(clientId)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('portfolio:changed', {
          detail: { action: 'remove', clientId },
        }))
      }
      onRemoved(clientId)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Não foi possível remover o cliente da carteira.')
    } finally {
      setIsRemoving(false)
    }
  }

  const handleDelete = async () => {
    const confirmed = window.confirm('Excluir cliente? Esta ação remove da carteira e da gestão geral (soft delete).')
    if (!confirmed) return
    setIsDeleting(true)
    setFeedback(null)
    try {
      await deleteClientFromPortfolio(clientId)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('portfolio:changed', {
          detail: { action: 'delete', clientId },
        }))
      }
      onDeleted(clientId)
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Não foi possível excluir o cliente.')
    } finally {
      setIsDeleting(false)
    }
  }

  if (isLoading) return <div style={{ padding: 20 }}>Carregando cliente…</div>
  if (error || !client || !form) return <div style={{ padding: 20, color: '#ef4444' }}>{error || 'Cliente não encontrado.'}</div>

  return (
    <div style={{ padding: 18, display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>{client.name || 'Cliente'}</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>Manutenção operacional da carteira</p>
        </div>
        <button type="button" onClick={onClose} style={{ border: '1px solid var(--border,#334155)', background: 'none', borderRadius: 6, padding: '6px 10px', color: 'inherit' }}>Fechar</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {([
          ['name', 'Nome / Razão social'],
          ['document', 'Documento'],
          ['phone', 'Telefone'],
          ['email', 'E-mail'],
          ['city', 'Cidade'],
          ['state', 'Estado'],
          ['address', 'Endereço'],
          ['cep', 'CEP'],
          ['uc', 'UC geradora'],
          ['uc_beneficiaria', 'UC beneficiária'],
          ['consumption_kwh_month', 'Consumo kWh/mês'],
          ['system_kwp', 'Potência do sistema (kWp)'],
          ['term_months', 'Prazo contratual (meses)'],
          ['distribuidora', 'Distribuidora'],
        ] as Array<[keyof ClientEditForm, string]>).map(([key, label]) => (
          <label key={key} style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            {label}
            <input
              type="text"
              value={form[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              style={{ width: '100%', marginTop: 4, border: '1px solid var(--border,#334155)', background: 'var(--surface-2,#1e293b)', color: 'inherit', borderRadius: 8, padding: '8px 10px' }}
            />
          </label>
        ))}
      </div>

      {feedback && <div style={{ color: feedback.includes('sucesso') ? '#22c55e' : '#ef4444', fontSize: 13 }}>{feedback}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" onClick={() => void handleSave()} disabled={isSaving} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px' }}>
          {isSaving ? 'Salvando…' : 'Salvar alterações'}
        </button>
        <button type="button" onClick={() => void handleRemove()} disabled={isRemoving} style={{ background: '#f59e0b', color: '#111827', border: 'none', borderRadius: 8, padding: '8px 12px' }}>
          {isRemoving ? 'Removendo…' : 'Remover da carteira'}
        </button>
        <button type="button" onClick={() => void handleDelete()} disabled={isDeleting} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 12px' }}>
          {isDeleting ? 'Excluindo…' : 'Excluir cliente'}
        </button>
      </div>
    </div>
  )
}

export function ClientPortfolioPage({ onBack }: Props) {
  const { clients, setClients, isLoading, error, reload, setSearch } = useClientPortfolio()
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => setSearch(searchInput), 300)
    return () => window.clearTimeout(timeout)
  }, [searchInput, setSearch])

  const title = useMemo(() => `Carteira de Clientes (${clients.length})`, [clients.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ borderBottom: '1px solid var(--border, #334155)', padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22 }}>{title}</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--text-muted, #94a3b8)', fontSize: 13 }}>Painel profissional para editar, atualizar e remover clientes da carteira.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={reload} style={{ border: '1px solid var(--border,#334155)', background: 'none', borderRadius: 8, color: 'inherit', padding: '8px 10px' }}>Atualizar</button>
            <button type="button" onClick={onBack} style={{ border: '1px solid var(--border,#334155)', background: 'none', borderRadius: 8, color: 'inherit', padding: '8px 10px' }}>Voltar</button>
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, maxWidth: 620 }}>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Buscar por nome, e-mail, cidade, documento, telefone ou UC"
            style={{ flex: 1, border: '1px solid var(--border,#334155)', background: 'var(--surface,#1e293b)', color: 'inherit', borderRadius: 8, padding: '9px 12px' }}
          />
          <button type="button" onClick={() => setSearchInput('')} style={{ border: '1px solid var(--border,#334155)', background: 'none', borderRadius: 8, color: 'inherit', padding: '8px 10px' }}>Limpar</button>
        </div>
      </header>

      <main style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: isMobile ? 'column' : 'row' }}>
        <section style={{ flex: selectedClientId && !isMobile ? '0 0 58%' : '1 1 auto', overflowY: 'auto', padding: 16 }}>
          {isLoading && <p style={{ color: 'var(--text-muted,#94a3b8)' }}>Carregando carteira…</p>}
          {!isLoading && error && (
            <div>
              <p style={{ color: '#ef4444' }}>{error}</p>
              <button type="button" onClick={reload} style={{ border: '1px solid #ef4444', background: 'none', color: '#ef4444', borderRadius: 8, padding: '8px 10px' }}>Tentar novamente</button>
            </div>
          )}
          {!isLoading && !error && clients.length === 0 && !searchInput && (
            <p style={{ color: 'var(--text-muted,#94a3b8)' }}>Nenhum cliente na carteira.</p>
          )}
          {!isLoading && !error && clients.length === 0 && !!searchInput && (
            <p style={{ color: 'var(--text-muted,#94a3b8)' }}>Nenhum cliente encontrado para este termo.</p>
          )}
          {!isLoading && !error && clients.length > 0 && (
            isMobile ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {clients.map((client) => (
                  <ClientCard
                    key={client.id}
                    client={client}
                    selected={selectedClientId === client.id}
                    onSelect={() => setSelectedClientId(client.id)}
                  />
                ))}
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid var(--border,#334155)', borderRadius: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', fontSize: 12, color: 'var(--text-muted,#94a3b8)', background: 'var(--surface,#1e293b)' }}>
                      <th style={{ padding: '10px 12px' }}>Nome</th>
                      <th style={{ padding: '10px 12px' }}>Cidade/UF</th>
                      <th style={{ padding: '10px 12px' }}>Telefone</th>
                      <th style={{ padding: '10px 12px' }}>E-mail</th>
                      <th style={{ padding: '10px 12px' }}>UC</th>
                      <th style={{ padding: '10px 12px' }}>Exportado</th>
                      <th style={{ padding: '10px 12px' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => {
                      const selected = selectedClientId === client.id
                      return (
                        <tr
                          key={client.id}
                          style={{
                            borderTop: '1px solid var(--border,#334155)',
                            background: selected ? 'rgba(59,130,246,0.08)' : 'transparent',
                          }}
                        >
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{client.name || 'Sem nome'}</td>
                          <td style={{ padding: '10px 12px' }}>{client.city ? `${client.city} / ${client.state ?? '—'}` : '—'}</td>
                          <td style={{ padding: '10px 12px' }}>{client.phone || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>{client.email || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>{client.uc || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>{formatDate(client.exported_to_portfolio_at)}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <button
                              type="button"
                              onClick={() => setSelectedClientId(client.id)}
                              style={{ border: '1px solid var(--border,#334155)', background: 'none', color: 'inherit', borderRadius: 6, padding: '5px 8px' }}
                            >
                              Ver / Editar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </section>

        <Drawer open={Boolean(selectedClientId)} isMobile={isMobile}>
          {selectedClientId && (
            <ClientDetailEditor
              clientId={selectedClientId}
              onClose={() => setSelectedClientId(null)}
              onSaved={() => void reload()}
              onRemoved={(id) => {
                setClients((prev) => prev.filter((c) => c.id !== id))
                setSelectedClientId(null)
              }}
              onDeleted={(id) => {
                setClients((prev) => prev.filter((c) => c.id !== id))
                setSelectedClientId(null)
              }}
            />
          )}
        </Drawer>
      </main>
    </div>
  )
}
