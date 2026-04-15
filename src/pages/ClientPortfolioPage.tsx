// src/pages/ClientPortfolioPage.tsx
// "Carteira de Clientes" — professional operational management hub.
// Access: admin | office | financeiro only.

import React, { useState, useCallback, useEffect } from 'react'
import {
  useClientPortfolio,
  usePortfolioClient,
  usePortfolioRemove,
  usePortfolioUpdate,
  usePortfolioDelete,
} from '../hooks/useClientPortfolio'
import type { PortfolioClientRow } from '../types/clientPortfolio'
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
function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast notification
// ─────────────────────────────────────────────────────────────────────────────
interface ToastProps {
  message: string
  type: 'success' | 'error'
  onDismiss: () => void
}

function Toast({ message, type, onDismiss }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        padding: '12px 20px',
        borderRadius: 10,
        background: type === 'success' ? '#166534' : '#7f1d1d',
        border: `1px solid ${type === 'success' ? '#22c55e' : '#ef4444'}`,
        color: '#fff',
        fontSize: 14,
        fontWeight: 500,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        maxWidth: 360,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <span>{type === 'success' ? '✅' : '❌'}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, padding: 0 }}
      >
        ×
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Confirm dialog
// ─────────────────────────────────────────────────────────────────────────────
interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  confirmColor?: string
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', confirmColor = '#ef4444', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        style={{
          background: 'var(--surface, #1e293b)',
          border: '1px solid var(--border, #334155)',
          borderRadius: 12,
          padding: 28,
          maxWidth: 420,
          width: '100%',
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700 }}>{title}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-muted, #94a3b8)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ padding: '8px 18px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{ padding: '8px 18px', borderRadius: 6, border: 'none', background: confirmColor, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Client card
// ─────────────────────────────────────────────────────────────────────────────
function ClientCard({
  client,
  isSelected,
  onSelect,
}: {
  client: PortfolioClientRow
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        cursor: 'pointer',
        padding: '14px 16px',
        borderRadius: 10,
        border: isSelected
          ? '1.5px solid #3b82f6'
          : '1px solid var(--border, #334155)',
        background: isSelected ? 'rgba(59,130,246,0.08)' : 'var(--surface, #1e293b)',
        transition: 'all 0.15s',
        marginBottom: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? '#3b82f6' : 'inherit' }}>
          {client.name ?? '—'}
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>
          {formatDate(client.exported_to_portfolio_at)}
        </span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
        {(client.city || client.state) && (
          <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            📍 {[client.city, client.state].filter(Boolean).join(' / ')}
          </span>
        )}
        {client.phone && (
          <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            📞 {client.phone}
          </span>
        )}
        {client.uc && (
          <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            ⚡ UC: {client.uc}
          </span>
        )}
      </div>
      {client.email && (
        <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginTop: 4 }}>
          ✉️ {client.email}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Panel Tabs
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'editar' | 'contrato' | 'projeto' | 'cobranca' | 'notas'

function DetailTabBar({ activeTab, onChange }: { activeTab: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'editar', label: '✏️ Editar' },
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
        overflowX: 'auto',
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          style={{
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === t.id ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === t.id ? '#3b82f6' : 'var(--text-muted, #94a3b8)',
            fontWeight: activeTab === t.id ? 700 : 400,
            cursor: 'pointer',
            fontSize: 12,
            whiteSpace: 'nowrap',
            transition: 'all 0.15s',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit Tab — edits core client fields via PUT /api/clients/:id
// ─────────────────────────────────────────────────────────────────────────────
function EditarTab({
  client,
  onSaved,
  onToast,
}: {
  client: PortfolioClientRow
  onSaved: (updated: PortfolioClientRow) => void
  onToast: (msg: string, type: 'success' | 'error') => void
}) {
  const { updating, updateClient } = usePortfolioUpdate()

  const [form, setForm] = useState({
    client_name: client.name ?? '',
    client_document: client.document ?? '',
    client_phone: client.phone ?? '',
    client_email: client.email ?? '',
    client_city: client.city ?? '',
    client_state: client.state ?? '',
    client_address: client.address ?? '',
    distribuidora: client.distribuidora ?? '',
    uc_geradora: client.uc ?? '',
    uc_beneficiaria: client.uc_beneficiaria ?? '',
    consumption_kwh_month: client.consumption_kwh_month != null ? String(client.consumption_kwh_month) : '',
    system_kwp: client.system_kwp != null ? String(client.system_kwp) : '',
    term_months: client.term_months != null ? String(client.term_months) : '',
  })

  async function handleSave() {
    const ok = await updateClient(client.id, {
      client_name: form.client_name || undefined,
      client_document: form.client_document || undefined,
      client_phone: form.client_phone || undefined,
      client_email: form.client_email || undefined,
      client_city: form.client_city || undefined,
      client_state: form.client_state || undefined,
      client_address: form.client_address || undefined,
      distribuidora: form.distribuidora || undefined,
      uc_geradora: form.uc_geradora || undefined,
      uc_beneficiaria: form.uc_beneficiaria || undefined,
      consumption_kwh_month: form.consumption_kwh_month !== '' ? Number(form.consumption_kwh_month) : undefined,
      system_kwp: form.system_kwp !== '' ? Number(form.system_kwp) : undefined,
      term_months: form.term_months !== '' ? Number(form.term_months) : undefined,
    })
    if (ok) {
      onToast('Cliente atualizado com sucesso.', 'success')
      onSaved({
        ...client,
        name: form.client_name || client.name,
        document: form.client_document || client.document,
        phone: form.client_phone || client.phone,
        email: form.client_email || client.email,
        city: form.client_city || client.city,
        state: form.client_state || client.state,
        address: form.client_address || client.address,
        distribuidora: form.distribuidora || client.distribuidora,
        uc: form.uc_geradora || client.uc,
        uc_beneficiaria: form.uc_beneficiaria || client.uc_beneficiaria,
        consumption_kwh_month: form.consumption_kwh_month !== '' ? Number(form.consumption_kwh_month) : client.consumption_kwh_month,
        system_kwp: form.system_kwp !== '' ? Number(form.system_kwp) : client.system_kwp,
        term_months: form.term_months !== '' ? Number(form.term_months) : client.term_months,
      })
    } else {
      onToast('Não foi possível salvar as alterações do cliente.', 'error')
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    marginTop: 4,
    padding: '7px 10px',
    borderRadius: 6,
    border: '1px solid var(--border, #334155)',
    background: 'var(--surface-2, #0f172a)',
    color: 'inherit',
    fontSize: 13,
  }
  const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted, #94a3b8)' }
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }

  return (
    <div style={{ paddingBottom: 20 }}>
      <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#3b82f6' }}>📇 Identificação</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={labelStyle}>
            Nome / Razão Social
            <input type="text" value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Documento (CPF/CNPJ)
            <input type="text" value={form.client_document} onChange={(e) => setForm((f) => ({ ...f, client_document: e.target.value }))} style={inputStyle} />
          </label>
          <div style={gridStyle}>
            <label style={labelStyle}>
              Telefone
              <input type="text" value={form.client_phone} onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              E-mail
              <input type="email" value={form.client_email} onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} style={inputStyle} />
            </label>
          </div>
          <div style={gridStyle}>
            <label style={labelStyle}>
              Cidade
              <input type="text" value={form.client_city} onChange={(e) => setForm((f) => ({ ...f, client_city: e.target.value }))} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Estado (UF)
              <input type="text" maxLength={2} value={form.client_state} onChange={(e) => setForm((f) => ({ ...f, client_state: e.target.value.toUpperCase() }))} style={inputStyle} />
            </label>
          </div>
          <label style={labelStyle}>
            Endereço
            <input type="text" value={form.client_address} onChange={(e) => setForm((f) => ({ ...f, client_address: e.target.value }))} style={inputStyle} />
          </label>
        </div>
      </div>

      <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#8b5cf6' }}>⚡ Energia</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={labelStyle}>
            Distribuidora
            <input type="text" value={form.distribuidora} onChange={(e) => setForm((f) => ({ ...f, distribuidora: e.target.value }))} style={inputStyle} />
          </label>
          <div style={gridStyle}>
            <label style={labelStyle}>
              UC Geradora
              <input type="text" value={form.uc_geradora} onChange={(e) => setForm((f) => ({ ...f, uc_geradora: e.target.value }))} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              UC Beneficiária
              <input type="text" value={form.uc_beneficiaria} onChange={(e) => setForm((f) => ({ ...f, uc_beneficiaria: e.target.value }))} style={inputStyle} />
            </label>
          </div>
          <div style={gridStyle}>
            <label style={labelStyle}>
              Consumo (kWh/mês)
              <input type="number" value={form.consumption_kwh_month} onChange={(e) => setForm((f) => ({ ...f, consumption_kwh_month: e.target.value }))} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Potência (kWp)
              <input type="number" value={form.system_kwp} onChange={(e) => setForm((f) => ({ ...f, system_kwp: e.target.value }))} style={inputStyle} />
            </label>
          </div>
          <label style={labelStyle}>
            Prazo Contratual (meses)
            <input type="number" value={form.term_months} onChange={(e) => setForm((f) => ({ ...f, term_months: e.target.value }))} style={inputStyle} />
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={updating}
        style={{
          width: '100%',
          padding: '10px 0',
          borderRadius: 8,
          border: 'none',
          background: '#3b82f6',
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
          cursor: updating ? 'not-allowed' : 'pointer',
          opacity: updating ? 0.7 : 1,
        }}
      >
        {updating ? 'Salvando…' : '💾 Salvar Alterações'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract Tab
// ─────────────────────────────────────────────────────────────────────────────
const CONTRACT_TYPE_LABELS: Record<string, string> = { leasing: 'Leasing', sale: 'Venda', buyout: 'Buy Out' }

function ContratoTab({ client, onSaved }: { client: PortfolioClientRow; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    contract_type: client.contract_type ?? 'leasing',
    contract_status: client.contract_status ?? 'draft',
    contract_signed_at: client.contract_signed_at?.slice(0, 10) ?? '',
    billing_start_date: client.billing_start_date?.slice(0, 10) ?? '',
    contractual_term_months: client.contractual_term_months != null ? String(client.contractual_term_months) : '',
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

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 4, padding: '7px 10px',
    borderRadius: 6, border: '1px solid var(--border, #334155)',
    background: 'var(--surface-2, #0f172a)', color: 'inherit', fontSize: 13,
  }

  return (
    <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#3b82f6' }}>📄 Dados do Contrato</div>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Tipo de Contrato
          <select value={form.contract_type ?? ''} onChange={(e) => setForm((f) => ({ ...f, contract_type: e.target.value }))} style={inputStyle}>
            {Object.entries(CONTRACT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Status do Contrato
          <select value={form.contract_status ?? ''} onChange={(e) => setForm((f) => ({ ...f, contract_status: e.target.value }))} style={inputStyle}>
            <option value="draft">Rascunho</option>
            <option value="active">Ativo</option>
            <option value="suspended">Suspenso</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Data de Assinatura
          <input type="date" value={form.contract_signed_at} onChange={(e) => setForm((f) => ({ ...f, contract_signed_at: e.target.value }))} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Início da Cobrança
          <input type="date" value={form.billing_start_date} onChange={(e) => setForm((f) => ({ ...f, billing_start_date: e.target.value }))} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Prazo Contratual (meses)
          <input type="number" value={form.contractual_term_months} onChange={(e) => setForm((f) => ({ ...f, contractual_term_months: e.target.value }))} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={form.buyout_eligible} onChange={(e) => setForm((f) => ({ ...f, buyout_eligible: e.target.checked }))} />
          Elegível para Buy Out
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Observações
          <textarea value={form.contract_notes} onChange={(e) => setForm((f) => ({ ...f, contract_notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </label>
      </div>
      {saveError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{saveError}</p>}
      <button type="button" onClick={() => void handleSave()} disabled={saving}
        style={{ marginTop: 14, width: '100%', padding: '9px 0', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Salvando…' : '💾 Salvar Contrato'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Tab
// ─────────────────────────────────────────────────────────────────────────────
const PROJECT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente', engineering: 'Engenharia', installation: 'Instalação',
  homologation: 'Homologação', commissioned: 'Comissionado', active: 'Ativo', issue: 'Com Problema',
}

function ProjetoTab({ client, onSaved }: { client: PortfolioClientRow; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    project_status: client.project_status ?? 'pending',
    installation_status: client.installation_status ?? '',
    engineering_status: client.engineering_status ?? '',
    commissioning_date: client.commissioning_date?.slice(0, 10) ?? '',
    expected_go_live_date: client.expected_go_live_date?.slice(0, 10) ?? '',
    integrator_name: client.integrator_name ?? '',
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
        integrator_name: form.integrator_name || null,
        notes: form.project_notes || null,
      })
      onSaved()
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 4, padding: '7px 10px',
    borderRadius: 6, border: '1px solid var(--border, #334155)',
    background: 'var(--surface-2, #0f172a)', color: 'inherit', fontSize: 13,
  }

  return (
    <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#f59e0b' }}>🔧 Status do Projeto</div>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Status Geral
          <select value={form.project_status ?? ''} onChange={(e) => setForm((f) => ({ ...f, project_status: e.target.value }))} style={inputStyle}>
            {Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Status Instalação
          <input type="text" value={form.installation_status} onChange={(e) => setForm((f) => ({ ...f, installation_status: e.target.value }))} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Status Engenharia
          <input type="text" value={form.engineering_status} onChange={(e) => setForm((f) => ({ ...f, engineering_status: e.target.value }))} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Data de Comissionamento
          <input type="date" value={form.commissioning_date} onChange={(e) => setForm((f) => ({ ...f, commissioning_date: e.target.value }))} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Previsão de Go-Live
          <input type="date" value={form.expected_go_live_date} onChange={(e) => setForm((f) => ({ ...f, expected_go_live_date: e.target.value }))} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Integrador
          <input type="text" value={form.integrator_name} onChange={(e) => setForm((f) => ({ ...f, integrator_name: e.target.value }))} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Observações
          <textarea value={form.project_notes} onChange={(e) => setForm((f) => ({ ...f, project_notes: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </label>
      </div>
      {saveError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{saveError}</p>}
      <button type="button" onClick={() => void handleSave()} disabled={saving}
        style={{ marginTop: 14, width: '100%', padding: '9px 0', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#000', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Salvando…' : '💾 Salvar Projeto'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing Tab
// ─────────────────────────────────────────────────────────────────────────────
function CobrancaTab({ client, onSaved }: { client: PortfolioClientRow; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({
    due_day: client.due_day != null ? String(client.due_day) : '',
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

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 4, padding: '7px 10px',
    borderRadius: 6, border: '1px solid var(--border, #334155)',
    background: 'var(--surface-2, #0f172a)', color: 'inherit', fontSize: 13,
  }

  return (
    <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#8b5cf6' }}>💰 Perfil de Cobrança</div>
      <div style={{ display: 'grid', gap: 10 }}>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Dia de Vencimento
          <input type="number" min={1} max={31} value={form.due_day} onChange={(e) => setForm((f) => ({ ...f, due_day: e.target.value }))} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Primeiro Vencimento
          <input type="date" value={form.first_billing_date} onChange={(e) => setForm((f) => ({ ...f, first_billing_date: e.target.value }))} style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Recorrência
          <select value={form.recurrence_type} onChange={(e) => setForm((f) => ({ ...f, recurrence_type: e.target.value }))} style={inputStyle}>
            <option value="monthly">Mensal</option>
            <option value="quarterly">Trimestral</option>
            <option value="annual">Anual</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Status de Pagamento
          <select value={form.payment_status ?? ''} onChange={(e) => setForm((f) => ({ ...f, payment_status: e.target.value }))} style={inputStyle}>
            <option value="pending">Pendente</option>
            <option value="current">Em Dia</option>
            <option value="overdue">Inadimplente</option>
            <option value="written_off">Baixado</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </label>
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Status de Inadimplência
          <input type="text" value={form.delinquency_status} onChange={(e) => setForm((f) => ({ ...f, delinquency_status: e.target.value }))} style={inputStyle} />
        </label>
      </div>
      {saveError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{saveError}</p>}
      <button type="button" onClick={() => void handleSave()} disabled={saving}
        style={{ marginTop: 14, width: '100%', padding: '9px 0', borderRadius: 6, border: 'none', background: '#8b5cf6', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
        {saving ? 'Salvando…' : '💾 Salvar Cobrança'}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes Tab
// ─────────────────────────────────────────────────────────────────────────────
function NotasTab({ client }: { client: PortfolioClientRow }) {
  const clientId = client.id
  const [notes, setNotes] = useState<Array<{ id: number; content: string; entry_type: string; created_at: string; title: string | null }>>([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingNotes(true)
    fetchPortfolioNotes(clientId)
      .then((ns) => setNotes(ns))
      .catch((err: unknown) => console.error('[portfolio] notes load error', err))
      .finally(() => setLoadingNotes(false))
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
          style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface-2, #0f172a)', color: 'inherit', resize: 'none', fontSize: 13 }}
        />
        <button type="button" onClick={() => void handleAddNote()} disabled={addingNote || !newNote.trim()}
          style={{ padding: '0 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end', height: 40 }}>
          {addingNote ? '…' : '＋'}
        </button>
      </div>
      {addError && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 10 }}>{addError}</p>}
      <div style={{ marginBottom: addError ? 0 : 10 }} />
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
  onClientUpdated,
  onRemovedFromPortfolio,
  onDeleted,
  onToast,
}: {
  clientId: number
  onClose: () => void
  onClientUpdated: () => void
  onRemovedFromPortfolio: (clientId: number) => void
  onDeleted: (clientId: number) => void
  onToast: (msg: string, type: 'success' | 'error') => void
}) {
  const { client, isLoading, error, reload } = usePortfolioClient(clientId)
  const [activeTab, setActiveTab] = useState<Tab>('editar')
  const [localClient, setLocalClient] = useState<PortfolioClientRow | null>(null)
  const { removing, removeClient } = usePortfolioRemove()
  const { deleting, deleteClient } = usePortfolioDelete()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (client) setLocalClient(client)
  }, [client])

  const displayClient = localClient ?? client

  async function handleRemoveFromPortfolio() {
    setConfirmRemove(false)
    const ok = await removeClient(clientId)
    if (ok) {
      onToast('Cliente removido da carteira com sucesso.', 'success')
      onRemovedFromPortfolio(clientId)
    } else {
      onToast('Não foi possível remover o cliente da carteira.', 'error')
    }
  }

  async function handleDeleteClient() {
    setConfirmDelete(false)
    const ok = await deleteClient(clientId)
    if (ok) {
      onToast('Cliente excluído com sucesso.', 'success')
      onDeleted(clientId)
    } else {
      onToast('Não foi possível excluir o cliente.', 'error')
    }
  }

  if (isLoading) {
    return <div style={{ padding: 24, color: 'var(--text-muted, #94a3b8)' }}>Carregando cliente…</div>
  }
  if (error || !displayClient) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: '#ef4444', fontSize: 13 }}>{error ?? 'Cliente não encontrado.'}</p>
        <button type="button" onClick={onClose}
          style={{ marginTop: 12, padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer' }}>
          ← Voltar
        </button>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border, #334155)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{displayClient.name ?? '—'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
              {[displayClient.city, displayClient.state].filter(Boolean).join(' / ')} · Exportado {formatDate(displayClient.exported_to_portfolio_at)}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar painel"
            style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', fontSize: 20, cursor: 'pointer', padding: 4 }}>
            ×
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            disabled={removing}
            style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #f59e0b',
              background: 'rgba(245,158,11,0.1)', color: '#f59e0b',
              fontSize: 12, fontWeight: 600, cursor: removing ? 'not-allowed' : 'pointer',
              opacity: removing ? 0.7 : 1,
            }}
          >
            {removing ? 'Removendo…' : '📤 Remover da Carteira'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #ef4444',
              background: 'rgba(239,68,68,0.1)', color: '#ef4444',
              fontSize: 12, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting ? 'Excluindo…' : '🗑️ Excluir Cliente'}
          </button>
        </div>
      </div>

      {/* Tabs + content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        <DetailTabBar activeTab={activeTab} onChange={setActiveTab} />
        {activeTab === 'editar' && (
          <EditarTab
            client={displayClient}
            onSaved={(updated) => {
              setLocalClient(updated)
              onClientUpdated()
            }}
            onToast={onToast}
          />
        )}
        {activeTab === 'contrato' && <ContratoTab client={displayClient} onSaved={reload} />}
        {activeTab === 'projeto' && <ProjetoTab client={displayClient} onSaved={reload} />}
        {activeTab === 'cobranca' && <CobrancaTab client={displayClient} onSaved={reload} />}
        {activeTab === 'notas' && <NotasTab client={displayClient} />}
      </div>

      {/* Confirm dialogs */}
      {confirmRemove && (
        <ConfirmDialog
          title="Remover da Carteira"
          message={`Tem certeza que deseja remover "${displayClient.name}" da Carteira de Clientes? O cliente continuará existindo no sistema — apenas sairá da carteira.`}
          confirmLabel="Remover da Carteira"
          confirmColor="#f59e0b"
          onConfirm={() => void handleRemoveFromPortfolio()}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Excluir Cliente"
          message={`Atenção: esta ação excluirá definitivamente o cliente "${displayClient.name}" do sistema. Esta ação não pode ser desfeita. Deseja continuar?`}
          confirmLabel="Excluir Definitivamente"
          confirmColor="#ef4444"
          onConfirm={() => void handleDeleteClient()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export function ClientPortfolioPage({ onBack }: Props) {
  const { clients, isLoading, error, reload, setSearch, removeClient } = useClientPortfolio()
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value
      setSearchInput(q)
      setSearch(q)
    },
    [setSearch],
  )

  const clearSearch = useCallback(() => {
    setSearchInput('')
    setSearch('')
  }, [setSearch])

  const showToast = useCallback((msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
  }, [])

  const handleClientUpdated = useCallback(() => {
    // Clients list will reflect changes on next reload; the panel already holds local state
    reload()
  }, [reload])

  const handleRemovedFromPortfolio = useCallback((clientId: number) => {
    removeClient(clientId)
    if (selectedClientId === clientId) setSelectedClientId(null)
  }, [removeClient, selectedClientId])

  const handleDeleted = useCallback((clientId: number) => {
    removeClient(clientId)
    if (selectedClientId === clientId) setSelectedClientId(null)
  }, [removeClient, selectedClientId])

  const total = clients.length
  const hasClients = total > 0

  return (
    <div
      className="budget-search-page"
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Page header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border, #334155)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>💼 Carteira de Clientes</h1>
            <p style={{ fontSize: 13, color: 'var(--text-muted, #94a3b8)', margin: '4px 0 0' }}>
              Gestão operacional dos clientes contratados
              {!isLoading && hasClients && (
                <span style={{ marginLeft: 8, fontWeight: 600, color: '#3b82f6' }}>
                  · {total} {total === 1 ? 'cliente' : 'clientes'}
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={reload}
              title="Atualizar lista"
              style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13 }}
            >
              🔄
            </button>
            <button
              type="button"
              onClick={onBack}
              style={{ padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13 }}
            >
              ← Voltar
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 480 }}>
          <input
            type="search"
            placeholder="Buscar por nome, e-mail, documento, cidade, UC…"
            value={searchInput}
            onChange={handleSearch}
            style={{
              width: '100%',
              padding: '8px 38px 8px 14px',
              borderRadius: 8,
              border: '1px solid var(--border, #334155)',
              background: 'var(--surface, #1e293b)',
              color: 'inherit',
              fontSize: 13,
              boxSizing: 'border-box',
            }}
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Limpar busca"
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer', fontSize: 16, padding: 0,
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: list */}
        <div
          style={{
            flex: selectedClientId ? '0 0 45%' : '1 1 100%',
            overflowY: 'auto',
            padding: '16px 20px',
            transition: 'flex 0.2s',
            minWidth: 0,
          }}
        >
          {isLoading && (
            <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 14, marginTop: 8 }}>Carregando carteira…</p>
          )}
          {error && !isLoading && (
            <div style={{ color: '#ef4444', fontSize: 13 }}>
              <p style={{ marginBottom: 10 }}>❌ {error}</p>
              <button
                type="button"
                onClick={reload}
                style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid #ef4444', background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
              >
                Tentar novamente
              </button>
            </div>
          )}
          {!isLoading && !error && clients.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
              {searchInput ? (
                <>
                  <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Nenhum resultado</p>
                  <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 13 }}>
                    Nenhum cliente encontrado para <strong>"{searchInput}"</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={clearSearch}
                    style={{ marginTop: 12, padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13 }}
                  >
                    Limpar busca
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Carteira vazia</p>
                  <p style={{ color: 'var(--text-muted, #94a3b8)', fontSize: 13 }}>
                    Nenhum cliente foi exportado para a carteira ainda.
                    <br />
                    Use o ícone <strong>🤝 Negócio fechado</strong> na lista de clientes para adicionar.
                  </p>
                </>
              )}
            </div>
          )}
          {!isLoading && !error && hasClients && (
            <div>
              {clients.map((c) => (
                <ClientCard
                  key={c.id}
                  client={c}
                  isSelected={selectedClientId === c.id}
                  onSelect={() => setSelectedClientId(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        {selectedClientId && (
          <div
            style={{
              flex: '0 0 55%',
              borderLeft: '1px solid var(--border, #334155)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            <ClientDetailPanel
              clientId={selectedClientId}
              onClose={() => setSelectedClientId(null)}
              onClientUpdated={handleClientUpdated}
              onRemovedFromPortfolio={handleRemovedFromPortfolio}
              onDeleted={handleDeleted}
              onToast={showToast}
            />
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.msg}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}
