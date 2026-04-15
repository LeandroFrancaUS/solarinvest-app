// src/pages/ClientPortfolioPage.tsx
// "Carteira de Clientes" — post-conversion operational hub.
// Access: admin | office | financeiro only.

import React, { useState, useCallback } from 'react'
import {
  useClientPortfolio,
  usePortfolioClient,
} from '../hooks/useClientPortfolio'
import type { PortfolioClientRow } from '../types/clientPortfolio'
import {
  LIFECYCLE_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  BILLING_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
} from '../types/clientPortfolio'
import {
  patchPortfolioContract,
  patchPortfolioProject,
  patchPortfolioBilling,
  fetchPortfolioNotes,
  addPortfolioNote,
} from '../services/clientPortfolioApi'

interface Props {
  onBack: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function formatBRL(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

function StatusBadge({ status, label }: { status: string | null; label: string }) {
  const colorMap: Record<string, string> = {
    active: '#22c55e',
    contracted: '#3b82f6',
    implementation: '#f59e0b',
    billing: '#8b5cf6',
    commissioned: '#22c55e',
    engineering: '#f59e0b',
    installation: '#f97316',
    homologation: '#eab308',
    overdue: '#ef4444',
    current: '#22c55e',
    pending: '#94a3b8',
    churned: '#6b7280',
    cancelled: '#6b7280',
    issue: '#ef4444',
  }
  const color = status ? (colorMap[status] ?? '#94a3b8') : '#94a3b8'
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 600,
        background: `${color}22`,
        color,
        border: `1px solid ${color}44`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Portfolio Summary Cards
// ─────────────────────────────────────────────────────────────────────────────
function PortfolioSummaryBar({ clients }: { clients: PortfolioClientRow[] }) {
  const total = clients.length
  const active = clients.filter((c) => c.lifecycle_status === 'active').length
  const inImpl = clients.filter(
    (c) => c.project_status && ['engineering', 'installation', 'homologation'].includes(c.project_status),
  ).length
  const overdue = clients.filter((c) => c.billing_payment_status === 'overdue').length
  const monthlyRev = clients.reduce((sum, c) => sum + (c.mensalidade ?? 0), 0)

  const cards = [
    { label: 'Clientes na Carteira', value: String(total), color: '#3b82f6' },
    { label: 'Ativos', value: String(active), color: '#22c55e' },
    { label: 'Em Implantação', value: String(inImpl), color: '#f59e0b' },
    { label: 'Inadimplentes', value: String(overdue), color: '#ef4444' },
    { label: 'Receita Mensal Prevista', value: formatBRL(monthlyRev), color: '#8b5cf6' },
  ]

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            flex: '1 1 150px',
            background: 'var(--surface, #1e293b)',
            border: '1px solid var(--border, #334155)',
            borderRadius: 10,
            padding: '14px 18px',
            minWidth: 130,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginBottom: 4 }}>
            {card.label}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Client Table Row
// ─────────────────────────────────────────────────────────────────────────────
function PortfolioTableRow({
  client,
  isSelected,
  onSelect,
}: {
  client: PortfolioClientRow
  isSelected: boolean
  onSelect: () => void
}) {
  const lifecycleLabel =
    LIFECYCLE_STATUS_LABELS[client.lifecycle_status] ??
    client.lifecycle_status ??
    '—'
  const projectLabel = client.project_status
    ? PROJECT_STATUS_LABELS[client.project_status] ?? client.project_status
    : '—'
  const billingLabel = client.billing_payment_status
    ? BILLING_STATUS_LABELS[client.billing_payment_status] ?? client.billing_payment_status
    : '—'

  return (
    <tr
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        background: isSelected ? 'var(--row-selected, #1e3a5f22)' : undefined,
        transition: 'background 0.15s',
      }}
    >
      <td data-label="Cliente">
        <div style={{ fontWeight: 600, fontSize: 14 }}>{client.name ?? '—'}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>
          {client.city ? `${client.city}${client.state ? ` / ${client.state}` : ''}` : '—'}
        </div>
      </td>
      <td data-label="Modalidade">
        {client.modalidade ? (
          <StatusBadge status={client.contract_type} label={client.modalidade} />
        ) : (
          '—'
        )}
      </td>
      <td data-label="Status Ciclo">
        <StatusBadge status={client.lifecycle_status} label={lifecycleLabel} />
      </td>
      <td data-label="Projeto">
        <StatusBadge status={client.project_status} label={projectLabel} />
      </td>
      <td data-label="Cobrança">
        <StatusBadge status={client.billing_payment_status} label={billingLabel} />
      </td>
      <td data-label="Mensalidade" style={{ textAlign: 'right', fontWeight: 600 }}>
        {formatBRL(client.mensalidade)}
      </td>
      <td data-label="Exportado em">
        <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          {formatDate(client.exported_to_portfolio_at)}
        </span>
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Panel – Tabs
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'resumo' | 'contrato' | 'projeto' | 'cobranca' | 'notas'

function DetailTabBar({ activeTab, onChange }: { activeTab: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'resumo', label: '📋 Resumo' },
    { id: 'contrato', label: '📄 Contrato' },
    { id: 'projeto', label: '🔧 Projeto' },
    { id: 'cobranca', label: '💰 Cobrança' },
    { id: 'notas', label: '📝 Notas' },
  ]
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        borderBottom: '1px solid var(--border, #334155)',
        marginBottom: 16,
        flexWrap: 'wrap',
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          style={{
            padding: '8px 14px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === t.id ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === t.id ? '#3b82f6' : 'var(--text-muted, #94a3b8)',
            fontWeight: activeTab === t.id ? 700 : 400,
            cursor: 'pointer',
            fontSize: 13,
            transition: 'all 0.15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function FieldRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '8px 0',
        borderBottom: '1px solid var(--border-subtle, #1e293b)',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', minWidth: 140 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function ResumoTab({ client }: { client: PortfolioClientRow }) {
  return (
    <div>
      <div
        style={{
          background: 'var(--surface-2, #0f172a)',
          borderRadius: 8,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#3b82f6' }}>
          📇 Identificação
        </div>
        <FieldRow label="Nome" value={client.name ?? '—'} />
        <FieldRow label="Documento" value={client.document ?? '—'} />
        <FieldRow label="E-mail" value={client.email ?? '—'} />
        <FieldRow label="Telefone" value={client.phone ?? '—'} />
        <FieldRow label="Cidade / UF" value={client.city && client.state ? `${client.city} / ${client.state}` : client.city ?? '—'} />
      </div>
      <div
        style={{
          background: 'var(--surface-2, #0f172a)',
          borderRadius: 8,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#8b5cf6' }}>
          ⚡ Perfil Energético
        </div>
        <FieldRow label="Modalidade" value={client.modalidade ?? '—'} />
        <FieldRow label="Distribuidora" value={client.distribuidora ?? '—'} />
        <FieldRow label="UC Geradora" value={client.uc ?? '—'} />
        <FieldRow label="UC Beneficiária" value={client.uc_beneficiaria ?? '—'} />
        <FieldRow label="Consumo (kWh/mês)" value={client.kwh_contratado != null ? `${client.kwh_contratado} kWh` : '—'} />
        <FieldRow label="Potência (kWp)" value={client.potencia_kwp != null ? `${client.potencia_kwp} kWp` : '—'} />
        <FieldRow label="Tipo de Rede" value={client.tipo_rede ?? '—'} />
        <FieldRow label="Tarifa Atual" value={client.tarifa_atual != null ? `R$ ${Number(client.tarifa_atual).toFixed(4)}/kWh` : '—'} />
        <FieldRow label="Desconto" value={client.desconto_percentual != null ? `${client.desconto_percentual}%` : '—'} />
        <FieldRow label="Mensalidade Base" value={formatBRL(client.mensalidade)} />
        <FieldRow label="Prazo Contratual" value={client.prazo_meses ? `${client.prazo_meses} meses` : '—'} />
        <FieldRow label="Inversor" value={client.marca_inversor ?? '—'} />
      </div>
      <div
        style={{
          background: 'var(--surface-2, #0f172a)',
          borderRadius: 8,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#22c55e' }}>
          📅 Ciclo de Vida
        </div>
        <FieldRow
          label="Status"
          value={
            <StatusBadge
              status={client.lifecycle_status}
              label={LIFECYCLE_STATUS_LABELS[client.lifecycle_status] ?? client.lifecycle_status}
            />
          }
        />
        <FieldRow label="Exportado para Carteira" value={formatDate(client.exported_to_portfolio_at)} />
        <FieldRow label="Onboarding" value={client.onboarding_status ?? '—'} />
      </div>
    </div>
  )
}

function ContratoTab({ client, onSaved }: { client: PortfolioClientRow; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState<{
    contract_type: string
    contract_status: string
    contract_signed_at: string
    billing_start_date: string
    contractual_term_months: string | number
    buyout_eligible: boolean
    buyout_status: string
    contract_notes: string
  }>({
    contract_type: client.contract_type ?? 'leasing',
    contract_status: client.contract_status ?? 'draft',
    contract_signed_at: client.contract_signed_at?.slice(0, 10) ?? '',
    billing_start_date: client.billing_start_date?.slice(0, 10) ?? '',
    contractual_term_months: client.contractual_term_months ?? '',
    buyout_eligible: client.buyout_eligible ?? false,
    buyout_status: client.buyout_status ?? '',
    contract_notes: client.contract_notes ?? '',
  })

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      await patchPortfolioContract(client.id, {
        ...form,
        id: client.contract_id ?? undefined,
        contractual_term_months: form.contractual_term_months !== '' ? Number(form.contractual_term_months) : null,
        contract_signed_at: form.contract_signed_at || null,
        billing_start_date: form.billing_start_date || null,
        buyout_status: form.buyout_status || null,
        notes: form.contract_notes || null,
      })
      onSaved()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div
        style={{
          background: 'var(--surface-2, #0f172a)',
          borderRadius: 8,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#3b82f6' }}>
          📄 Dados do Contrato
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Tipo de Contrato
            <select
              value={form.contract_type}
              onChange={(e) => setForm((f) => ({ ...f, contract_type: e.target.value }))}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }}
            >
              {Object.entries(CONTRACT_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Status do Contrato
            <select
              value={form.contract_status}
              onChange={(e) => setForm((f) => ({ ...f, contract_status: e.target.value }))}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }}
            >
              <option value="draft">Rascunho</option>
              <option value="active">Ativo</option>
              <option value="suspended">Suspenso</option>
              <option value="completed">Concluído</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Data de Assinatura
            <input
              type="date"
              value={form.contract_signed_at}
              onChange={(e) => setForm((f) => ({ ...f, contract_signed_at: e.target.value }))}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }}
            />
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Início da Cobrança
            <input
              type="date"
              value={form.billing_start_date}
              onChange={(e) => setForm((f) => ({ ...f, billing_start_date: e.target.value }))}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }}
            />
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Prazo Contratual (meses)
            <input
              type="number"
              value={form.contractual_term_months}
              onChange={(e) => setForm((f) => ({ ...f, contractual_term_months: e.target.value }))}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }}
            />
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={form.buyout_eligible}
              onChange={(e) => setForm((f) => ({ ...f, buyout_eligible: e.target.checked }))}
            />
            Elegível para Buy Out
          </label>
          {form.buyout_eligible && (
            <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
              Status Buy Out
              <input
                type="text"
                value={form.buyout_status}
                onChange={(e) => setForm((f) => ({ ...f, buyout_status: e.target.value }))}
                placeholder="Ex.: solicitado, aprovado..."
                style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }}
              />
            </label>
          )}
          <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Observações
            <textarea
              value={form.contract_notes}
              onChange={(e) => setForm((f) => ({ ...f, contract_notes: e.target.value }))}
              rows={3}
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit', resize: 'vertical' }}
            />
          </label>
        </div>
        {saveError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{saveError}</p>}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          style={{
            marginTop: 14,
            padding: '8px 18px',
            borderRadius: 6,
            border: 'none',
            background: '#3b82f6',
            color: '#fff',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Salvando…' : '💾 Salvar Contrato'}
        </button>
      </div>
    </div>
  )
}

function ProjetoTab({ client, onSaved }: { client: PortfolioClientRow; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState<{
    project_status: string
    installation_status: string
    engineering_status: string
    homologation_status: string
    commissioning_date: string
    expected_go_live_date: string
    integrator_name: string
    engineer_name: string
    project_notes: string
  }>({
    project_status: client.project_status ?? 'pending',
    installation_status: client.installation_status ?? '',
    engineering_status: client.engineering_status ?? '',
    homologation_status: client.homologation_status ?? '',
    commissioning_date: client.commissioning_date?.slice(0, 10) ?? '',
    expected_go_live_date: client.expected_go_live_date?.slice(0, 10) ?? '',
    integrator_name: client.integrator_name ?? '',
    engineer_name: client.engineer_name ?? '',
    project_notes: client.project_notes ?? '',
  })

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      await patchPortfolioProject(client.id, {
        ...form,
        commissioning_date: form.commissioning_date || null,
        expected_go_live_date: form.expected_go_live_date || null,
        installation_status: form.installation_status || null,
        engineering_status: form.engineering_status || null,
        homologation_status: form.homologation_status || null,
        integrator_name: form.integrator_name || null,
        engineer_name: form.engineer_name || null,
        notes: form.project_notes || null,
      })
      onSaved()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#f59e0b' }}>
        🔧 Status do Projeto
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Status Geral
          <select
            value={form.project_status}
            onChange={(e) => setForm((f) => ({ ...f, project_status: e.target.value }))}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }}
          >
            {Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Status Instalação
          <input type="text" value={form.installation_status} onChange={(e) => setForm((f) => ({ ...f, installation_status: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Status Engenharia
          <input type="text" value={form.engineering_status} onChange={(e) => setForm((f) => ({ ...f, engineering_status: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Status Homologação
          <input type="text" value={form.homologation_status} onChange={(e) => setForm((f) => ({ ...f, homologation_status: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Data de Comissionamento
          <input type="date" value={form.commissioning_date} onChange={(e) => setForm((f) => ({ ...f, commissioning_date: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Previsão de Go-Live
          <input type="date" value={form.expected_go_live_date} onChange={(e) => setForm((f) => ({ ...f, expected_go_live_date: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Integrador
          <input type="text" value={form.integrator_name} onChange={(e) => setForm((f) => ({ ...f, integrator_name: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Engenheiro Responsável
          <input type="text" value={form.engineer_name} onChange={(e) => setForm((f) => ({ ...f, engineer_name: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Observações
          <textarea value={form.project_notes} onChange={(e) => setForm((f) => ({ ...f, project_notes: e.target.value }))} rows={3} style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit', resize: 'vertical' }} />
        </label>
      </div>
      {saveError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{saveError}</p>}
      <button type="button" onClick={() => void handleSave()} disabled={saving} style={{ marginTop: 14, padding: '8px 18px', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#000', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Salvando…' : '💾 Salvar Projeto'}
      </button>
    </div>
  )
}

function CobrancaTab({ client, onSaved }: { client: PortfolioClientRow; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState<{
    due_day: string | number
    first_billing_date: string
    recurrence_type: string
    payment_status: string
    delinquency_status: string
  }>({
    due_day: client.due_day ?? '',
    first_billing_date: client.first_billing_date?.slice(0, 10) ?? '',
    recurrence_type: client.recurrence_type ?? 'monthly',
    payment_status: client.billing_payment_status ?? 'pending',
    delinquency_status: client.delinquency_status ?? '',
  })

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      await patchPortfolioBilling(client.id, {
        ...form,
        due_day: form.due_day !== '' ? Number(form.due_day) : null,
        first_billing_date: form.first_billing_date || null,
        delinquency_status: form.delinquency_status || null,
      })
      onSaved()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#8b5cf6' }}>
        💰 Perfil de Cobrança
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Dia de Vencimento
          <input type="number" min={1} max={31} value={form.due_day} onChange={(e) => setForm((f) => ({ ...f, due_day: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Primeiro Vencimento
          <input type="date" value={form.first_billing_date} onChange={(e) => setForm((f) => ({ ...f, first_billing_date: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Recorrência
          <select value={form.recurrence_type} onChange={(e) => setForm((f) => ({ ...f, recurrence_type: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }}>
            <option value="monthly">Mensal</option>
            <option value="quarterly">Trimestral</option>
            <option value="annual">Anual</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Status de Pagamento
          <select value={form.payment_status} onChange={(e) => setForm((f) => ({ ...f, payment_status: e.target.value }))} style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }}>
            <option value="pending">Pendente</option>
            <option value="current">Em Dia</option>
            <option value="overdue">Inadimplente</option>
            <option value="written_off">Baixado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Status de Inadimplência
          <input type="text" value={form.delinquency_status} onChange={(e) => setForm((f) => ({ ...f, delinquency_status: e.target.value }))} placeholder="Ex.: em cobrança, acionado juridicamente..." style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit' }} />
        </label>
      </div>
      {saveError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{saveError}</p>}
      <button type="button" onClick={() => void handleSave()} disabled={saving} style={{ marginTop: 14, padding: '8px 18px', borderRadius: 6, border: 'none', background: '#8b5cf6', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Salvando…' : '💾 Salvar Cobrança'}
      </button>
    </div>
  )
}

function NotasTab({ client }: { client: PortfolioClientRow }) {
  const clientId = client.id
  const [notes, setNotes] = useState<Array<{ id: number; content: string; entry_type: string; created_at: string; title: string | null }>>([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  React.useEffect(() => {
    async function loadNotes() {
      setLoadingNotes(true)
      try {
        const ns = await fetchPortfolioNotes(clientId)
        setNotes(ns)
      } catch (err: unknown) {
        console.error('[portfolio] notes load error', err)
      } finally {
        setLoadingNotes(false)
      }
    }
    void loadNotes()
  }, [clientId])

  async function handleAddNote() {
    if (!newNote.trim()) return
    setAddingNote(true)
    setAddError(null)
    try {
      const note = await addPortfolioNote(clientId, { content: newNote.trim(), entry_type: 'note' })
      setNotes((prev) => [note, ...prev])
      setNewNote('')
    } catch (err: unknown) {
      console.error('[portfolio] add note error', err)
      setAddError(err instanceof Error ? err.message : 'Erro ao salvar nota.')
    } finally {
      setAddingNote(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        <textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          rows={2}
          placeholder="Adicionar observação..."
          style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface, #1e293b)', color: 'inherit', resize: 'none' }}
        />
        <button type="button" onClick={() => void handleAddNote()} disabled={addingNote || !newNote.trim()} style={{ padding: '0 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}>
          {addingNote ? '…' : '＋'}
        </button>
      </div>
      {addError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{addError}</p>}
      {!addError && <div style={{ marginBottom: 10 }} />}
      {loadingNotes ? (
        <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 13 }}>Carregando notas…</p>
      ) : notes.length === 0 ? (
        <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 13 }}>Nenhuma nota registrada.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {notes.map((note) => (
            <div key={note.id} style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 12, borderLeft: '3px solid #3b82f6' }}>
              <div style={{ fontSize: 13 }}>{note.content}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 4 }}>
                {formatDate(note.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Panel
// ─────────────────────────────────────────────────────────────────────────────
function ClientDetailPanel({
  clientId,
  onClose,
}: {
  clientId: number
  onClose: () => void
}) {
  const { client, isLoading, error, reload } = usePortfolioClient(clientId)
  const [activeTab, setActiveTab] = useState<Tab>('resumo')

  if (isLoading) {
    return (
      <div style={{ padding: 24, color: 'var(--text-muted, #94a3b8)' }}>Carregando cliente…</div>
    )
  }
  if (error || !client) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#ef4444', fontSize: 13 }}>{error ?? 'Cliente não encontrado.'}</p>
        <button type="button" onClick={onClose} style={{ marginTop: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer' }}>
          ← Voltar
        </button>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #334155)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{client.name ?? '—'}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <StatusBadge
              status={client.lifecycle_status}
              label={LIFECYCLE_STATUS_LABELS[client.lifecycle_status] ?? client.lifecycle_status}
            />
            {client.mensalidade != null && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#8b5cf6' }}>
                {formatBRL(client.mensalidade)}/mês
              </span>
            )}
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar painel" style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', fontSize: 20, cursor: 'pointer', padding: 4 }}>×</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        <DetailTabBar activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === 'resumo' && <ResumoTab client={client} />}
        {activeTab === 'contrato' && <ContratoTab client={client} onSaved={reload} />}
        {activeTab === 'projeto' && <ProjetoTab client={client} onSaved={reload} />}
        {activeTab === 'cobranca' && <CobrancaTab client={client} onSaved={reload} />}
        {activeTab === 'notas' && <NotasTab client={client} />}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export function ClientPortfolioPage({ onBack }: Props) {
  const { clients, isLoading, error, reload, setSearch } = useClientPortfolio()
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value
      setSearchInput(q)
      setSearch(q)
    },
    [setSearch],
  )

  const hasClients = clients.length > 0

  return (
    <div
      className="budget-search-page"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Page header */}
      <div className="budget-search-page-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border, #334155)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>💼 Carteira de Clientes</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)', margin: '4px 0 0' }}>
              Gestão operacional e financeira dos clientes contratados
            </p>
          </div>
          <button type="button" onClick={onBack} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13 }}>
            ← Voltar
          </button>
        </div>

        {/* Search */}
        <input
          type="search"
          placeholder="Buscar por nome, e-mail, documento, cidade…"
          value={searchInput}
          onChange={handleSearch}
          style={{
            width: '100%',
            maxWidth: 480,
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid var(--border, #334155)',
            background: 'var(--surface, #1e293b)',
            color: 'inherit',
            fontSize: 13,
          }}
        />
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: list */}
        <div
          style={{
            flex: selectedClientId ? '0 0 55%' : '1 1 100%',
            overflowY: 'auto',
            padding: 20,
            transition: 'flex 0.2s',
          }}
        >
          {/* Summary */}
          {hasClients && !isLoading && <PortfolioSummaryBar clients={clients} />}

          {isLoading && (
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 14 }}>Carregando carteira…</p>
          )}
          {error && (
            <div style={{ color: '#ef4444', fontSize: 13 }}>
              <p>{error}</p>
              <button type="button" onClick={reload} style={{ marginTop: 8, padding: '6px 14px', borderRadius: 6, border: '1px solid #ef4444', background: 'none', color: '#ef4444', cursor: 'pointer' }}>
                Tentar novamente
              </button>
            </div>
          )}
          {!isLoading && !error && clients.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>💼 Carteira vazia</p>
              <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 13 }}>
                Nenhum cliente foi exportado para a carteira ainda.
                <br />
                Use o ícone <strong>🤝 Negócio fechado</strong> na lista de clientes para adicionar.
              </p>
            </div>
          )}
          {!isLoading && !error && hasClients && (
            <div className="budget-search-table clients-table" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', borderBottom: '1px solid var(--border, #334155)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Cliente</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Modalidade</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Ciclo</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Projeto</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Cobrança</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600 }}>Mensalidade</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontWeight: 600 }}>Exportado em</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <PortfolioTableRow
                      key={c.id}
                      client={c}
                      isSelected={selectedClientId === c.id}
                      onSelect={() => setSelectedClientId(c.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: detail */}
        {selectedClientId && (
          <div
            style={{
              flex: '0 0 45%',
              borderLeft: '1px solid var(--border, #334155)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <ClientDetailPanel
              clientId={selectedClientId}
              onClose={() => setSelectedClientId(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
