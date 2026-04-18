// src/pages/ClientPortfolioPage.tsx
// "Carteira de Clientes" — professional operational management hub.
// Access: admin | office | financeiro only.

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  useClientPortfolio,
  usePortfolioClient,
  usePortfolioRemove,
  usePortfolioDelete,
} from '../hooks/useClientPortfolio'
import type { PortfolioClientRow } from '../types/clientPortfolio'
import { DUE_DAY_OPTIONS } from '../types/clientPortfolio'
import {
  patchPortfolioContract,
  patchPortfolioProject,
  patchPortfolioBilling,
  patchPortfolioUsina,
  patchPortfolioPlan,
  patchPortfolioProfile,
  fetchPortfolioNotes,
  addPortfolioNote,
} from '../services/clientPortfolioApi'
import { ClientPortfolioEditorShell, type ViewMode } from '../components/portfolio/ClientPortfolioEditorShell'
import { UfConfigurationFields, type UfConfigData } from '../components/portfolio/UfConfigurationFields'
import { calculateBillingDates, generateInstallments, getBillingAlert, BILLING_ALERT_LABELS, MAX_DASHBOARD_ALERTS } from '../domain/billing/monthlyEngine'
import { generateNotificationsForClient } from '../domain/billing/BillingNotificationService'
import { BillingAlertsWidget, type BillingAlertItem } from '../components/portfolio/BillingAlertsWidget'

interface Props {
  onBack: () => void
  /** Called after a client is successfully removed from the portfolio or deleted,
   *  so the main clients list can refresh its in_portfolio status. */
  onClientRemovedFromPortfolio?: () => void
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
        padding: '10px 14px',
        borderRadius: 8,
        border: isSelected
          ? '1.5px solid #3b82f6'
          : '1px solid var(--border, #334155)',
        background: isSelected ? 'rgba(59,130,246,0.10)' : 'var(--surface, #1e293b)',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: isSelected ? '#60a5fa' : '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {client.name ?? '—'}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          {(client.city || client.state) && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {[client.city, client.state].filter(Boolean).join('/')}
            </span>
          )}
          <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>
            {formatDate(client.exported_to_portfolio_at)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Panel Tabs
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'editar' | 'usina' | 'contrato' | 'plano' | 'projeto' | 'cobranca' | 'notas'

function DetailTabBar({ activeTab, onChange, showPlano }: { activeTab: Tab; onChange: (t: Tab) => void; showPlano: boolean }) {
  const tabs: { id: Tab; label: string; hidden?: boolean }[] = [
    { id: 'editar', label: '👤 Cliente' },
    { id: 'projeto', label: '🔧 Projeto' },
    { id: 'usina', label: '☀️ Usina' },
    { id: 'contrato', label: '📄 Contrato' },
    { id: 'plano', label: '📋 Plano', hidden: !showPlano },
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
      {tabs.filter((t) => !t.hidden).map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          style={{
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === t.id ? '2px solid var(--accent, #ff8c00)' : '2px solid transparent',
            color: activeTab === t.id ? 'var(--accent, #ff8c00)' : 'var(--text-muted, #94a3b8)',
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
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)

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

  const resetForm = () => setForm({
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
    setSaving(true)
    try {
      await patchPortfolioProfile(client.id, {
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
      setEditMode(false)
    } catch {
      onToast('Não foi possível salvar as alterações do cliente.', 'error')
    } finally {
      setSaving(false)
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
            <input type="text" value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Documento (CPF/CNPJ)
            <input type="text" value={form.client_document} onChange={(e) => setForm((f) => ({ ...f, client_document: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <div style={gridStyle}>
            <label style={labelStyle}>
              Telefone
              <input type="text" value={form.client_phone} onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              E-mail
              <input type="email" value={form.client_email} onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridStyle}>
            <label style={labelStyle}>
              Cidade
              <input type="text" value={form.client_city} onChange={(e) => setForm((f) => ({ ...f, client_city: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Estado (UF)
              <input type="text" maxLength={2} value={form.client_state} onChange={(e) => setForm((f) => ({ ...f, client_state: e.target.value.toUpperCase() }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <label style={labelStyle}>
            Endereço
            <input type="text" value={form.client_address} onChange={(e) => setForm((f) => ({ ...f, client_address: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
        </div>
      </div>

      <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14, marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#8b5cf6' }}>⚡ Energia</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={labelStyle}>
            Distribuidora
            <input type="text" value={form.distribuidora} onChange={(e) => setForm((f) => ({ ...f, distribuidora: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <div style={gridStyle}>
            <label style={labelStyle}>
              UC Geradora
              <input type="text" value={form.uc_geradora} onChange={(e) => setForm((f) => ({ ...f, uc_geradora: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              UC Beneficiária
              <input type="text" value={form.uc_beneficiaria} onChange={(e) => setForm((f) => ({ ...f, uc_beneficiaria: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridStyle}>
            <label style={labelStyle}>
              Consumo (kWh/mês)
              <input type="number" value={form.consumption_kwh_month} onChange={(e) => setForm((f) => ({ ...f, consumption_kwh_month: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label style={labelStyle}>
              Potência (kWp)
              <input type="number" value={form.system_kwp} onChange={(e) => setForm((f) => ({ ...f, system_kwp: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <label style={labelStyle}>
            Prazo Contratual (meses)
            <input type="number" value={form.term_months} onChange={(e) => setForm((f) => ({ ...f, term_months: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {!editMode && (
          <button type="button" onClick={() => setShowEditPrompt(true)}
            style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            ✏️ Editar
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => setShowSavePrompt(true)} disabled={saving}
            style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontSize: 13 }}>
            {saving ? 'Salvando…' : '💾 Salvar Alterações'}
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => { setEditMode(false); resetForm() }}
            style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
        )}
      </div>
      {showEditPrompt && (
        <ConfirmDialog
          title="Editar Cliente"
          message="Deseja realmente editar os dados do cliente?"
          confirmLabel="Editar"
          confirmColor="#3b82f6"
          onConfirm={() => { setShowEditPrompt(false); setEditMode(true) }}
          onCancel={() => setShowEditPrompt(false)}
        />
      )}
      {showSavePrompt && (
        <ConfirmDialog
          title="Salvar Cliente"
          message="Deseja realmente salvar as alterações dos dados do cliente?"
          confirmLabel="Salvar"
          confirmColor="#22c55e"
          onConfirm={() => { setShowSavePrompt(false); void handleSave() }}
          onCancel={() => setShowSavePrompt(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Contract Tab
// ─────────────────────────────────────────────────────────────────────────────
const CONTRACT_TYPE_LABELS: Record<string, string> = { leasing: 'Leasing', sale: 'Venda', buyout: 'Buy Out' }

function ContratoTab({ client, onSaved }: { client: PortfolioClientRow; onSaved: (patch: Partial<PortfolioClientRow>) => void }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [form, setForm] = useState({
    contract_type: client.contract_type ?? 'leasing',
    contract_status: client.contract_status ?? 'draft',
    source_proposal_id: client.source_proposal_id ?? '',
    contract_signed_at: client.contract_signed_at?.slice(0, 10) ?? '',
    contract_start_date: client.contract_start_date?.slice(0, 10) ?? '',
    billing_start_date: client.billing_start_date?.slice(0, 10) ?? '',
    expected_billing_end_date: client.expected_billing_end_date?.slice(0, 10) ?? '',
    contractual_term_months: client.contractual_term_months != null ? String(client.contractual_term_months) : '',
    buyout_eligible: client.buyout_eligible ?? true,
    buyout_status: client.buyout_status ?? '',
    buyout_date: client.buyout_date?.slice(0, 10) ?? '',
    buyout_amount_reference: client.buyout_amount_reference != null ? String(client.buyout_amount_reference) : '',
    contract_notes: client.contract_notes ?? '',
    consultant_id: client.consultant_id ?? '',
    consultant_name: client.consultant_name ?? '',
    contract_file_name: client.contract_file_name ?? '',
  })

  const resetForm = () => setForm({
    contract_type: client.contract_type ?? 'leasing',
    contract_status: client.contract_status ?? 'draft',
    source_proposal_id: client.source_proposal_id ?? '',
    contract_signed_at: client.contract_signed_at?.slice(0, 10) ?? '',
    contract_start_date: client.contract_start_date?.slice(0, 10) ?? '',
    billing_start_date: client.billing_start_date?.slice(0, 10) ?? '',
    expected_billing_end_date: client.expected_billing_end_date?.slice(0, 10) ?? '',
    contractual_term_months: client.contractual_term_months != null ? String(client.contractual_term_months) : '',
    buyout_eligible: client.buyout_eligible ?? true,
    buyout_status: client.buyout_status ?? '',
    buyout_date: client.buyout_date?.slice(0, 10) ?? '',
    buyout_amount_reference: client.buyout_amount_reference != null ? String(client.buyout_amount_reference) : '',
    contract_notes: client.contract_notes ?? '',
    consultant_id: client.consultant_id ?? '',
    consultant_name: client.consultant_name ?? '',
    contract_file_name: client.contract_file_name ?? '',
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
        contract_start_date: form.contract_start_date || null,
        billing_start_date: form.billing_start_date || null,
        expected_billing_end_date: form.expected_billing_end_date || null,
        buyout_status: form.buyout_status || null,
        buyout_date: form.buyout_date || null,
        buyout_amount_reference: form.buyout_amount_reference !== '' ? Number(form.buyout_amount_reference) : null,
        source_proposal_id: form.source_proposal_id || null,
        notes: form.contract_notes || null,
        consultant_id: form.consultant_id || null,
        consultant_name: form.consultant_name || null,
      })
      onSaved({
        contract_type: form.contract_type,
        contract_status: form.contract_status,
        source_proposal_id: form.source_proposal_id || null,
        contract_signed_at: form.contract_signed_at || null,
        contract_start_date: form.contract_start_date || null,
        billing_start_date: form.billing_start_date || null,
        expected_billing_end_date: form.expected_billing_end_date || null,
        contractual_term_months: form.contractual_term_months !== '' ? Number(form.contractual_term_months) : null,
        buyout_eligible: form.buyout_eligible,
        buyout_status: form.buyout_status || null,
        buyout_date: form.buyout_date || null,
        buyout_amount_reference: form.buyout_amount_reference !== '' ? Number(form.buyout_amount_reference) : null,
        contract_notes: form.contract_notes || null,
        consultant_id: form.consultant_id || null,
        consultant_name: form.consultant_name || null,
        contract_file_name: form.contract_file_name || null,
      } as Partial<PortfolioClientRow>)
      setEditMode(false)
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
  const labelSty: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted, #94a3b8)' }
  const gridSty: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#3b82f6' }}>📄 Dados do Contrato</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={labelSty}>
            Tipo de Contrato
            <select value={form.contract_type ?? ''} onChange={(e) => setForm((f) => ({ ...f, contract_type: e.target.value }))} disabled={!editMode} style={inputStyle}>
              {Object.entries(CONTRACT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label style={labelSty}>
            Status do Contrato
            <select value={form.contract_status ?? ''} onChange={(e) => setForm((f) => ({ ...f, contract_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="draft">Rascunho</option>
              <option value="active">Ativo</option>
              <option value="signed">Assinado</option>
              <option value="suspended">Suspenso</option>
              <option value="completed">Concluído</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </label>
          <label style={labelSty}>
            ID da Proposta de Origem
            <input type="text" value={form.source_proposal_id} onChange={(e) => setForm((f) => ({ ...f, source_proposal_id: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <div style={gridSty}>
            <label style={labelSty}>
              Data de Assinatura
              <input type="date" value={form.contract_signed_at} onChange={(e) => setForm((f) => ({ ...f, contract_signed_at: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label style={labelSty}>
              Início do Contrato
              <input type="date" value={form.contract_start_date} onChange={(e) => setForm((f) => ({ ...f, contract_start_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridSty}>
            <label style={labelSty}>
              Início da Cobrança
              <input type="date" value={form.billing_start_date} onChange={(e) => setForm((f) => ({ ...f, billing_start_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label style={labelSty}>
              Fim Previsto da Cobrança
              <input type="date" value={form.expected_billing_end_date} onChange={(e) => setForm((f) => ({ ...f, expected_billing_end_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <label style={labelSty}>
            Prazo Contratual (meses)
            <input type="number" value={form.contractual_term_months} onChange={(e) => setForm((f) => ({ ...f, contractual_term_months: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <label style={{ ...labelSty, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={form.buyout_eligible} onChange={(e) => setForm((f) => ({ ...f, buyout_eligible: e.target.checked }))} disabled={!editMode} style={{ width: 14, height: 14, accentColor: '#3b82f6' }} />
            Elegível para Buy Out
          </label>
          {form.buyout_eligible && (
            <div style={gridSty}>
              <label style={labelSty}>
                Status do Buy Out
                <input type="text" value={form.buyout_status} onChange={(e) => setForm((f) => ({ ...f, buyout_status: e.target.value }))} disabled={!editMode} style={inputStyle} />
              </label>
              <label style={labelSty}>
                Data do Buy Out
                <input type="date" value={form.buyout_date} onChange={(e) => setForm((f) => ({ ...f, buyout_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
              </label>
              <label style={labelSty}>
                Valor de Referência Buy Out (R$)
                <input type="number" min={0} step="0.01" value={form.buyout_amount_reference} onChange={(e) => setForm((f) => ({ ...f, buyout_amount_reference: e.target.value }))} disabled={!editMode} style={inputStyle} />
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Consultant section */}
      <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#10b981' }}>🧑‍💼 Consultor</div>
        <div style={gridSty}>
          <label style={labelSty}>
            ID do Consultor
            <input type="text" value={form.consultant_id} onChange={(e) => setForm((f) => ({ ...f, consultant_id: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <label style={labelSty}>
            Nome do Consultor
            <input type="text" value={form.consultant_name} onChange={(e) => setForm((f) => ({ ...f, consultant_name: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
        </div>
      </div>

      {/* Contract file upload section */}
      <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#6366f1' }}>📎 Arquivo do Contrato</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {editMode && (
            <label style={{ ...labelSty, cursor: 'pointer' }}>
              Selecionar arquivo (PDF ou imagem)
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const accepted = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
                  if (!accepted.includes(file.type)) {
                    alert('Formato não aceito. Use PDF, PNG, JPEG ou WebP.')
                    e.target.value = ''
                    return
                  }
                  setForm((f) => ({ ...f, contract_file_name: file.name }))
                }}
                style={{ display: 'block', marginTop: 4, fontSize: 13, cursor: 'pointer' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 4 }}>
                Formatos aceitos: PDF, PNG, JPEG, WebP
              </div>
            </label>
          )}
          {form.contract_file_name && (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              📄 <strong>{form.contract_file_name}</strong>
            </div>
          )}
          {/* Preview of existing uploaded file */}
          {client.contract_file_url && (
            <div>
              {client.contract_file_type?.startsWith('image/') ? (
                <div style={{ marginBottom: 8 }}>
                  <img
                    src={client.contract_file_url}
                    alt={client.contract_file_name ?? 'Contrato'}
                    style={{ maxWidth: '100%', maxHeight: 300, borderRadius: 6, border: '1px solid var(--border, #334155)' }}
                  />
                </div>
              ) : client.contract_file_type === 'application/pdf' ? (
                <div style={{ marginBottom: 8 }}>
                  <iframe
                    src={client.contract_file_url}
                    title="Preview do contrato"
                    style={{ width: '100%', height: 400, borderRadius: 6, border: '1px solid var(--border, #334155)' }}
                  />
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href={client.contract_file_url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}>
                  👁️ Abrir em nova aba
                </a>
                <a href={client.contract_file_url} download={client.contract_file_name ?? 'contrato'}
                  style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}>
                  ⬇️ Download
                </a>
              </div>
            </div>
          )}
          {!client.contract_file_url && !form.contract_file_name && (
            <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
              Nenhum arquivo anexado.
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
        <label style={labelSty}>
          Observações
          <textarea value={form.contract_notes} onChange={(e) => setForm((f) => ({ ...f, contract_notes: e.target.value }))} rows={3} disabled={!editMode} style={{ ...inputStyle, resize: 'vertical' }} />
        </label>
      </div>

      {saveError && <p style={{ color: '#ef4444', fontSize: 12 }}>{saveError}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {!editMode && (
          <button type="button" onClick={() => setShowEditPrompt(true)}
            style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            ✏️ Editar
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => setShowSavePrompt(true)} disabled={saving}
            style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontSize: 13 }}>
            {saving ? 'Salvando…' : '💾 Salvar Alterações'}
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => { setEditMode(false); resetForm() }}
            style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
        )}
      </div>
      {showEditPrompt && (
        <ConfirmDialog
          title="Editar Contrato"
          message="Deseja realmente editar os dados do contrato?"
          confirmLabel="Editar"
          confirmColor="#3b82f6"
          onConfirm={() => { setShowEditPrompt(false); setEditMode(true) }}
          onCancel={() => setShowEditPrompt(false)}
        />
      )}
      {showSavePrompt && (
        <ConfirmDialog
          title="Salvar Contrato"
          message="Deseja realmente salvar as alterações dos dados do contrato?"
          confirmLabel="Salvar"
          confirmColor="#22c55e"
          onConfirm={() => { setShowSavePrompt(false); void handleSave() }}
          onCancel={() => setShowSavePrompt(false)}
        />
      )}
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

const DEFAULT_INTEGRATOR = 'Solarinvest'
const DEFAULT_ENGINEER = 'Tiago Souza'
const DEFAULT_ENGINEERING_STATUS = 'Não Iniciado'

function ProjetoTab({ client, onSaved }: { client: PortfolioClientRow; onSaved: (patch: Partial<PortfolioClientRow>) => void }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [form, setForm] = useState({
    project_status: client.project_status ?? 'pending',
    installation_status: client.installation_status ?? '',
    engineering_status: client.engineering_status ?? DEFAULT_ENGINEERING_STATUS,
    homologation_status: client.homologation_status ?? '',
    commissioning_status: client.commissioning_status ?? '',
    commissioning_date: client.commissioning_date?.slice(0, 10) ?? '',
    integrator_name: client.integrator_name ?? DEFAULT_INTEGRATOR,
    engineer_name: client.engineer_name ?? DEFAULT_ENGINEER,
    project_notes: client.project_notes ?? '',
  })

  const resetForm = () => setForm({
    project_status: client.project_status ?? 'pending',
    installation_status: client.installation_status ?? '',
    engineering_status: client.engineering_status ?? DEFAULT_ENGINEERING_STATUS,
    homologation_status: client.homologation_status ?? '',
    commissioning_status: client.commissioning_status ?? '',
    commissioning_date: client.commissioning_date?.slice(0, 10) ?? '',
    integrator_name: client.integrator_name ?? DEFAULT_INTEGRATOR,
    engineer_name: client.engineer_name ?? DEFAULT_ENGINEER,
    project_notes: client.project_notes ?? '',
  })

  async function handleSave() {
    const needsObservation = 
      form.homologation_status === 'Reprovado' || form.homologation_status === 'Pendências' ||
      form.commissioning_status === 'Reprovado' || form.commissioning_status === 'Pendências'
    if (needsObservation && !form.project_notes.trim()) {
      setSaveError('Observação obrigatória quando status é Reprovado ou Pendências.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      let finalNotes = form.project_notes
      if (needsObservation && finalNotes.trim()) {
        const now = new Date()
        const ts = now.toISOString().slice(0, 16).replace('T', ' ')
        const origin = (form.homologation_status === 'Reprovado' || form.homologation_status === 'Pendências') ? 'Homologação' : 'Comissionamento'
        if (!finalNotes.startsWith('[')) {
          finalNotes = `[${ts}] [${origin}] ${finalNotes}`
        }
      }
      await patchPortfolioProject(client.id, {
        ...form,
        commissioning_date: form.commissioning_date || null,
        installation_status: form.installation_status || null,
        engineering_status: form.engineering_status || null,
        homologation_status: form.homologation_status || null,
        commissioning_status: form.commissioning_status || null,
        integrator_name: form.integrator_name || null,
        engineer_name: form.engineer_name || null,
        notes: finalNotes || null,
      })
      onSaved({
        project_status: form.project_status,
        installation_status: form.installation_status || null,
        engineering_status: form.engineering_status || null,
        homologation_status: form.homologation_status || null,
        commissioning_status: form.commissioning_status || null,
        commissioning_date: form.commissioning_date || null,
        integrator_name: form.integrator_name || null,
        engineer_name: form.engineer_name || null,
        project_notes: finalNotes || null,
      } as Partial<PortfolioClientRow>)
      setEditMode(false)
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
        {/* 1. Installation + Engineering */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Status Instalação
            <select value={form.installation_status} onChange={(e) => setForm((f) => ({ ...f, installation_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="">Selecione…</option>
              <option value="Aguardando Agendamento">Aguardando Agendamento</option>
              <option value="Agendado">Agendado</option>
              <option value="Em Andamento">Em Andamento</option>
              <option value="Concluído">Concluído</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Status Engenharia
            <select value={form.engineering_status} onChange={(e) => setForm((f) => ({ ...f, engineering_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="">Selecione…</option>
              <option value="Não Iniciado">Não Iniciado</option>
              <option value="Análise Técnica">Análise Técnica</option>
              <option value="Enviado à Concessionária">Enviado à Concessionária</option>
              <option value="Aprovado">Aprovado</option>
              <option value="Reprovado">Reprovado</option>
            </select>
          </label>
        </div>
        {/* 2. Homologation + Commissioning */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Status Homologação
            <select value={form.homologation_status} onChange={(e) => setForm((f) => ({ ...f, homologation_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="">Selecione…</option>
              <option value="Solicitado">Solicitado</option>
              <option value="Aguardando Vistoria">Aguardando Vistoria</option>
              <option value="Homologado">Homologado</option>
              <option value="Reprovado">Reprovado</option>
              <option value="Pendências">Pendências</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Status Comissionamento
            <select value={form.commissioning_status} onChange={(e) => setForm((f) => ({ ...f, commissioning_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="">Selecione…</option>
              <option value="Pendente">Pendente</option>
              <option value="Em execução">Em execução</option>
              <option value="Concluído">Concluído</option>
            </select>
          </label>
        </div>
        {/* 3. Integrator + Engineer */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Integrador
            <select value={form.integrator_name} onChange={(e) => setForm((f) => ({ ...f, integrator_name: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="">Selecione…</option>
              <option value="Solarinvest">Solarinvest</option>
            </select>
          </label>
          <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
            Engenheiro
            <select value={form.engineer_name} onChange={(e) => setForm((f) => ({ ...f, engineer_name: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="">Selecione…</option>
              <option value="Tiago Souza">Tiago Souza</option>
            </select>
          </label>
        </div>
        {/* 4. Commissioning date */}
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Data de Comissionamento
          <input type="date" value={form.commissioning_date} onChange={(e) => setForm((f) => ({ ...f, commissioning_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
        </label>
        {/* 5. General status */}
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Status Geral
          <select value={form.project_status ?? ''} onChange={(e) => setForm((f) => ({ ...f, project_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
            {Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {/* 6. Notes */}
        <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
          Observações
          <textarea value={form.project_notes} onChange={(e) => setForm((f) => ({ ...f, project_notes: e.target.value }))} rows={3} disabled={!editMode} style={{ ...inputStyle, resize: 'vertical' }} />
        </label>
      </div>
      {saveError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{saveError}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {!editMode && (
          <button type="button" onClick={() => setShowEditPrompt(true)}
            style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            ✏️ Editar
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => setShowSavePrompt(true)} disabled={saving}
            style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#000', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontSize: 13 }}>
            {saving ? 'Salvando…' : '💾 Salvar Alterações'}
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => { setEditMode(false); resetForm() }}
            style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
        )}
      </div>
      {showEditPrompt && (
        <ConfirmDialog
          title="Editar Projeto"
          message="Deseja realmente editar os dados do projeto?"
          confirmLabel="Editar"
          confirmColor="#3b82f6"
          onConfirm={() => { setShowEditPrompt(false); setEditMode(true) }}
          onCancel={() => setShowEditPrompt(false)}
        />
      )}
      {showSavePrompt && (
        <ConfirmDialog
          title="Salvar Projeto"
          message="Deseja realmente salvar as alterações dos dados do projeto?"
          confirmLabel="Salvar"
          confirmColor="#22c55e"
          onConfirm={() => { setShowSavePrompt(false); void handleSave() }}
          onCancel={() => setShowSavePrompt(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing Tab
// ─────────────────────────────────────────────────────────────────────────────
function CobrancaTab({ client, onSaved }: { client: PortfolioClientRow; onSaved: (patch: Partial<PortfolioClientRow>) => void }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [paymentModal, setPaymentModal] = useState<{ installmentNumber: number; valor: number; vencimento: string } | null>(null)
  const [paymentProof, setPaymentProof] = useState<{ receipt_number: string; transaction_number: string }>({ receipt_number: '', transaction_number: '' })
  const [proofError, setProofError] = useState<string | null>(null)
  // Local confirmed-payments map for instant UI feedback before full reload
  const [confirmedPayments, setConfirmedPayments] = useState<Record<number, { receipt_number: string | null; paid_at: string }>>(() => {
    const map: Record<number, { receipt_number: string | null; paid_at: string }> = {}
    if (client.installments_json) {
      for (const p of client.installments_json) {
        if (p.status === 'confirmado') {
          map[p.number] = { receipt_number: p.receipt_number ?? null, paid_at: p.paid_at ?? '' }
        }
      }
    }
    return map
  })
  const [form, setForm] = useState({
    due_day: client.due_day != null ? String(client.due_day) : '5',
    reading_day: client.reading_day != null ? String(client.reading_day) : '',
    first_billing_date: client.first_billing_date?.slice(0, 10) ?? '',
    expected_last_billing_date: client.expected_last_billing_date?.slice(0, 10) ?? '',
    recurrence_type: client.recurrence_type ?? 'monthly',
    payment_status: client.billing_payment_status ?? 'pending',
    auto_reminder_enabled: client.auto_reminder_enabled ?? true,
    commissioning_date_billing: client.commissioning_date_billing?.slice(0, 10) ?? client.commissioning_date?.slice(0, 10) ?? '',
    valor_mensalidade: client.valor_mensalidade != null ? String(client.valor_mensalidade) : '',
  })

  const resetForm = () => setForm({
    due_day: client.due_day != null ? String(client.due_day) : '5',
    reading_day: client.reading_day != null ? String(client.reading_day) : '',
    first_billing_date: client.first_billing_date?.slice(0, 10) ?? '',
    expected_last_billing_date: client.expected_last_billing_date?.slice(0, 10) ?? '',
    recurrence_type: client.recurrence_type ?? 'monthly',
    payment_status: client.billing_payment_status ?? 'pending',
    auto_reminder_enabled: client.auto_reminder_enabled ?? true,
    commissioning_date_billing: client.commissioning_date_billing?.slice(0, 10) ?? client.commissioning_date?.slice(0, 10) ?? '',
    valor_mensalidade: client.valor_mensalidade != null ? String(client.valor_mensalidade) : '',
  })

  // Compute billing dates using the engine
  const engineResult = useMemo(() => {
    if (!form.commissioning_date_billing || !form.due_day || !form.reading_day) return null
    return calculateBillingDates({
      data_comissionamento: form.commissioning_date_billing,
      dia_leitura: Number(form.reading_day),
      dia_vencimento: Number(form.due_day),
      valor_mensalidade: form.valor_mensalidade ? Number(form.valor_mensalidade) : 0,
    })
  }, [form.commissioning_date_billing, form.due_day, form.reading_day, form.valor_mensalidade])

  // Generate installments.
  // Uses the engine-computed start date when all billing fields are available.
  // Falls back to first_billing_date or commissioning_date_billing so that the
  // table is visible even when reading_day / commissioning_date are not yet set.
  const installments = useMemo(() => {
    const termMonths = client.contractual_term_months ?? client.term_months ?? 0
    if (!termMonths || !form.due_day) return []

    // Determine start date: prefer the engine result, then explicit billing dates
    let inicio: string | null = null
    if (engineResult && engineResult.status_calculo !== 'erro_entrada') {
      inicio = engineResult.inicio_da_mensalidade
    } else if (form.first_billing_date) {
      inicio = form.first_billing_date
    } else if (form.commissioning_date_billing) {
      inicio = form.commissioning_date_billing
    }

    if (!inicio) return []

    return generateInstallments({
      inicio_mensalidade: inicio,
      prazo: termMonths,
      dia_vencimento: Number(form.due_day),
      // Allow valor = 0 so the table renders before the amount is configured
      valor_mensalidade: form.valor_mensalidade ? Number(form.valor_mensalidade) : 0,
    })
  }, [engineResult, client.contractual_term_months, client.term_months, form.due_day, form.valor_mensalidade, form.first_billing_date, form.commissioning_date_billing])

  // Generate notifications preview
  const notifications = useMemo(() => {
    if (installments.length === 0) return []
    return generateNotificationsForClient(client.id, client.name ?? '', installments)
  }, [installments, client.id, client.name])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      await patchPortfolioBilling(client.id, {
        ...form,
        due_day: form.due_day !== '' ? Number(form.due_day) : null,
        first_billing_date: form.first_billing_date || null,
        expected_last_billing_date: form.expected_last_billing_date || null,
      })
      onSaved({
        due_day: form.due_day !== '' ? Number(form.due_day) : null,
        reading_day: form.reading_day !== '' ? Number(form.reading_day) : null,
        first_billing_date: form.first_billing_date || null,
        expected_last_billing_date: form.expected_last_billing_date || null,
        recurrence_type: form.recurrence_type,
        billing_payment_status: form.payment_status,
        auto_reminder_enabled: form.auto_reminder_enabled,
        commissioning_date_billing: form.commissioning_date_billing || null,
        valor_mensalidade: form.valor_mensalidade !== '' ? Number(form.valor_mensalidade) : null,
      } as Partial<PortfolioClientRow>)
      setEditMode(false)
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
  const labelSty: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted, #94a3b8)' }
  const gridSty: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }

  const pendingNotifCount = notifications.filter((n) => n.status === 'pending').length

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Billing profile */}
      <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#8b5cf6' }}>💰 Perfil de Cobrança</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={gridSty}>
            <label style={labelSty}>
              Dia de Vencimento
              <select value={form.due_day} onChange={(e) => setForm((f) => ({ ...f, due_day: e.target.value }))} disabled={!editMode} style={inputStyle}>
                <option value="">Selecione…</option>
                {DUE_DAY_OPTIONS.map((d) => (
                  <option key={d} value={String(d)}>Dia {d}</option>
                ))}
              </select>
            </label>
            <label style={labelSty}>
              Dia de Leitura
              <input type="number" min={1} max={31} value={form.reading_day} onChange={(e) => setForm((f) => ({ ...f, reading_day: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridSty}>
            <label style={labelSty}>
              Data de Comissionamento
              <input type="date" value={form.commissioning_date_billing} onChange={(e) => setForm((f) => ({ ...f, commissioning_date_billing: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label style={labelSty}>
              Valor da Mensalidade (R$)
              <input type="number" min={0} step="0.01" value={form.valor_mensalidade} onChange={(e) => setForm((f) => ({ ...f, valor_mensalidade: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <label style={labelSty}>
            Primeiro Vencimento
            <input type="date" value={form.first_billing_date} onChange={(e) => setForm((f) => ({ ...f, first_billing_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <div style={gridSty}>
            <label style={labelSty}>
              Recorrência
              <select value={form.recurrence_type} onChange={(e) => setForm((f) => ({ ...f, recurrence_type: e.target.value }))} disabled={!editMode} style={inputStyle}>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="annual">Anual</option>
                <option value="custom">Personalizado</option>
              </select>
            </label>
            <label style={labelSty}>
              Status de Pagamento
              <select value={form.payment_status ?? ''} onChange={(e) => setForm((f) => ({ ...f, payment_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
                <option value="pending">Pendente</option>
                <option value="current">Em Dia</option>
                <option value="overdue">Inadimplente</option>
                <option value="written_off">Baixado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </label>
          </div>
          <label style={labelSty}>
            Último Vencimento Previsto
            <input type="date" value={form.expected_last_billing_date} onChange={(e) => setForm((f) => ({ ...f, expected_last_billing_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <label style={{ ...labelSty, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={form.auto_reminder_enabled} onChange={(e) => setForm((f) => ({ ...f, auto_reminder_enabled: e.target.checked }))} disabled={!editMode} style={{ width: 14, height: 14, accentColor: '#8b5cf6' }} />
            Lembrete automático ativado
          </label>
        </div>
      </div>

      {/* Engine result */}
      {engineResult && engineResult.status_calculo !== 'erro_entrada' && (
        <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#10b981' }}>📊 Cálculo de Vencimento</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Início da Mensalidade:</span>
              <span style={{ fontWeight: 600 }}>{engineResult.inicio_da_mensalidade.toLocaleDateString('pt-BR')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Início Mensalidade Fixa:</span>
              <span style={{ fontWeight: 600 }}>{engineResult.inicio_mensalidade_fixa.toLocaleDateString('pt-BR')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Status:</span>
              <span style={{
                fontWeight: 600,
                color: engineResult.status_calculo === 'ok' ? '#22c55e' : '#f59e0b',
              }}>
                {engineResult.status_calculo === 'ok' ? '✅ Calculado' : '⏳ Aguardando Comissionamento'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 4 }}>
              {engineResult.mensagem}
            </div>
          </div>
        </div>
      )}

      {/* Installments with payment management */}
      {(() => {
        const termMonths = client.contractual_term_months ?? client.term_months ?? 0
        const hasStartDate = !!(engineResult?.inicio_da_mensalidade || form.first_billing_date || form.commissioning_date_billing)
        // Show a hint when term is known but we can't produce rows yet
        if (termMonths > 0 && !hasStartDate) {
          return (
            <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: '#f59e0b' }}>📋 Parcelas</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', margin: 0 }}>
                Configure a <strong>Data de Início da Cobrança</strong> ou a <strong>Data de Comissionamento</strong> para visualizar as parcelas.
              </p>
            </div>
          )
        }
        if (installments.length === 0) return null
        return (
          <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#f59e0b' }}>
              📋 Parcelas ({installments.length})
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border, #334155)' }}>
                    <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-muted, #94a3b8)' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-muted, #94a3b8)' }}>Vencimento</th>
                    <th style={{ textAlign: 'right', padding: '4px 6px', color: 'var(--text-muted, #94a3b8)' }}>Valor</th>
                    <th style={{ textAlign: 'center', padding: '4px 6px', color: 'var(--text-muted, #94a3b8)' }}>Status</th>
                    <th style={{ textAlign: 'left', padding: '4px 6px', color: 'var(--text-muted, #94a3b8)', minWidth: 90 }}>Registro</th>
                    <th style={{ textAlign: 'center', padding: '4px 6px', color: 'var(--text-muted, #94a3b8)' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.slice(0, 36).map((inst) => {
                    const confirmed = confirmedPayments[inst.numero]
                    const isConfirmed = !!confirmed
                    return (
                      <tr key={inst.numero} style={{ borderBottom: '1px solid var(--border, #1e293b)' }}>
                        <td style={{ padding: '4px 6px' }}>{inst.numero}</td>
                        <td style={{ padding: '4px 6px' }}>{inst.data_vencimento.toLocaleDateString('pt-BR')}</td>
                        <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                          {inst.valor > 0 ? `R$ ${inst.valor.toFixed(2).replace('.', ',')}` : '—'}
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600, color: isConfirmed ? '#22c55e' : '#f59e0b' }}>
                          {isConfirmed ? '✅ Confirmado' : '⏳ Pendente'}
                        </td>
                        <td style={{ padding: '4px 6px', color: isConfirmed ? 'inherit' : 'var(--text-muted, #94a3b8)', fontFamily: 'monospace' }}>
                          {confirmed?.receipt_number ? confirmed.receipt_number : '—'}
                        </td>
                        <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                          {editMode && !isConfirmed && (
                            <button
                              type="button"
                              onClick={() => {
                                setProofError(null)
                                setPaymentProof({ receipt_number: '', transaction_number: '' })
                                setPaymentModal({ installmentNumber: inst.numero, valor: inst.valor, vencimento: inst.data_vencimento.toISOString() })
                              }}
                              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #22c55e', background: 'rgba(34,197,94,0.1)', color: '#22c55e', cursor: 'pointer', fontWeight: 600 }}
                            >
                              Pagar
                            </button>
                          )}
                          {isConfirmed && (
                            <span style={{ fontSize: 11, color: '#22c55e' }}>✓</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {installments.length > 36 && (
                <p style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 4, textAlign: 'center' }}>
                  Mostrando 36 de {installments.length} parcelas
                </p>
              )}
            </div>
          </div>
        )
      })()}

      {/* Payment proof modal */}
      {paymentModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface, #1e293b)', border: '1px solid var(--border, #334155)', borderRadius: 12, padding: 24, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
              💳 Registrar Pagamento — Parcela #{paymentModal.installmentNumber}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginBottom: 16 }}>
              Valor: R$ {paymentModal.valor.toFixed(2).replace('.', ',')} • Vencimento: {new Date(paymentModal.vencimento).toLocaleDateString('pt-BR')}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
                Nº do Comprovante
                <input
                  type="text"
                  value={paymentProof.receipt_number}
                  onChange={(e) => setPaymentProof((p) => ({ ...p, receipt_number: e.target.value }))}
                  placeholder="Ex: 123456"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface-2, #0f172a)', color: 'inherit', fontSize: 13, boxSizing: 'border-box' }}
                />
              </label>
              <label style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
                Nº da Transação Bancária
                <input
                  type="text"
                  value={paymentProof.transaction_number}
                  onChange={(e) => setPaymentProof((p) => ({ ...p, transaction_number: e.target.value }))}
                  placeholder="Ex: TXN-789"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'var(--surface-2, #0f172a)', color: 'inherit', fontSize: 13, boxSizing: 'border-box' }}
                />
              </label>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 8 }}>
              * Informe pelo menos um: Nº do Comprovante ou Nº da Transação.
            </div>
            {proofError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{proofError}</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                type="button"
                onClick={() => {
                  if (!paymentProof.receipt_number.trim() && !paymentProof.transaction_number.trim()) {
                    setProofError('Informe o número do comprovante ou o número da transação bancária.')
                    return
                  }
                  setProofError(null)
                  const paidAt = new Date().toISOString()
                  const receiptNum = paymentProof.receipt_number.trim() || null
                  // Persist via billing patch with installment_payment payload
                  void patchPortfolioBilling(client.id, {
                    installment_payment: {
                      number: paymentModal.installmentNumber,
                      status: 'confirmado',
                      paid_at: paidAt,
                      receipt_number: receiptNum,
                      transaction_number: paymentProof.transaction_number.trim() || null,
                    },
                  }).then(() => {
                    // Instant UI update — no full reload needed
                    setConfirmedPayments((prev) => ({
                      ...prev,
                      [paymentModal.installmentNumber]: { receipt_number: receiptNum, paid_at: paidAt },
                    }))
                    setPaymentModal(null)
                    onSaved({})
                  }).catch((err: unknown) => {
                    setProofError(err instanceof Error ? err.message : 'Erro ao registrar pagamento.')
                  })
                }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: 'none', background: '#22c55e', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
              >
                ✅ Confirmar Pagamento
              </button>
              <button
                type="button"
                onClick={() => { setPaymentModal(null); setProofError(null) }}
                style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13 }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification preview */}
      {pendingNotifCount > 0 && (
        <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#ec4899' }}>
            🔔 Notificações Pendentes ({pendingNotifCount})
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {notifications.slice(0, 6).map((notif) => (
              <div key={notif.id} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 4, background: 'rgba(236,72,153,0.06)', borderLeft: '2px solid #ec4899' }}>
                <span style={{ fontWeight: 600 }}>{notif.channel === 'email' ? '✉️' : '📱'}</span>{' '}
                <span style={{ color: 'var(--text-muted, #94a3b8)' }}>Parcela #{notif.installmentNumber}</span>{' '}
                — {BILLING_ALERT_LABELS[notif.level]}
              </div>
            ))}
            {pendingNotifCount > 6 && (
              <p style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', textAlign: 'center' }}>
                + {pendingNotifCount - 6} notificações
              </p>
            )}
          </div>
        </div>
      )}

      {saveError && <p style={{ color: '#ef4444', fontSize: 12 }}>{saveError}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {!editMode && (
          <button type="button" onClick={() => setShowEditPrompt(true)}
            style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            ✏️ Editar
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => setShowSavePrompt(true)} disabled={saving}
            style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: 'none', background: '#8b5cf6', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontSize: 13 }}>
            {saving ? 'Salvando…' : '💾 Salvar Alterações'}
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => { setEditMode(false); resetForm() }}
            style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
        )}
      </div>
      {showEditPrompt && (
        <ConfirmDialog
          title="Editar Cobrança"
          message="Deseja realmente editar os dados de cobrança?"
          confirmLabel="Editar"
          confirmColor="#3b82f6"
          onConfirm={() => { setShowEditPrompt(false); setEditMode(true) }}
          onCancel={() => setShowEditPrompt(false)}
        />
      )}
      {showSavePrompt && (
        <ConfirmDialog
          title="Salvar Cobrança"
          message="Deseja realmente salvar as alterações dos dados de cobrança?"
          confirmLabel="Salvar"
          confirmColor="#22c55e"
          onConfirm={() => { setShowSavePrompt(false); void handleSave() }}
          onCancel={() => setShowSavePrompt(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Usina Tab — UF configuration reuse
// ─────────────────────────────────────────────────────────────────────────────
function UsinaTab({ client, onSaved }: { client: PortfolioClientRow; onSaved: (patch: Partial<PortfolioClientRow>) => void }) {
  const [saving, setSaving] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)

  const [ufData, setUfData] = useState<UfConfigData>({
    potencia_modulo_wp: client.potencia_modulo_wp != null ? String(client.potencia_modulo_wp) : '',
    numero_modulos: client.numero_modulos != null ? String(client.numero_modulos) : '',
    modelo_modulo: client.modelo_modulo ?? '',
    modelo_inversor: client.modelo_inversor ?? '',
    tipo_instalacao: client.tipo_instalacao ?? '',
    area_instalacao_m2: client.area_instalacao_m2 != null ? String(client.area_instalacao_m2) : '',
    geracao_estimada_kwh: client.geracao_estimada_kwh != null ? String(client.geracao_estimada_kwh) : '',
    potencia_kwp: client.system_kwp != null ? String(client.system_kwp) : '',
    tipo_rede: client.tipo_rede ?? '',
  })

  const resetUfData = () => setUfData({
    potencia_modulo_wp: client.potencia_modulo_wp != null ? String(client.potencia_modulo_wp) : '',
    numero_modulos: client.numero_modulos != null ? String(client.numero_modulos) : '',
    modelo_modulo: client.modelo_modulo ?? '',
    modelo_inversor: client.modelo_inversor ?? '',
    tipo_instalacao: client.tipo_instalacao ?? '',
    area_instalacao_m2: client.area_instalacao_m2 != null ? String(client.area_instalacao_m2) : '',
    geracao_estimada_kwh: client.geracao_estimada_kwh != null ? String(client.geracao_estimada_kwh) : '',
    potencia_kwp: client.system_kwp != null ? String(client.system_kwp) : '',
    tipo_rede: client.tipo_rede ?? '',
  })

  const handleFieldChange = useCallback((field: keyof UfConfigData, value: string) => {
    setUfData((prev) => ({ ...prev, [field]: value }))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        potencia_modulo_wp: ufData.potencia_modulo_wp ? Number(ufData.potencia_modulo_wp) : null,
        numero_modulos: ufData.numero_modulos ? Number(ufData.numero_modulos) : null,
        modelo_modulo: ufData.modelo_modulo || null,
        modelo_inversor: ufData.modelo_inversor || null,
        tipo_instalacao: ufData.tipo_instalacao || null,
        area_instalacao_m2: ufData.area_instalacao_m2 ? Number(ufData.area_instalacao_m2) : null,
        geracao_estimada_kwh: ufData.geracao_estimada_kwh ? Number(ufData.geracao_estimada_kwh) : null,
        system_kwp: ufData.potencia_kwp ? Number(ufData.potencia_kwp) : null,
        // Persist tipo_rede via energy profile upsert
        energyProfile: {
          tipo_rede: ufData.tipo_rede && ufData.tipo_rede !== 'nenhum' ? ufData.tipo_rede : null,
        },
      }
      await patchPortfolioUsina(client.id, payload)
      onSaved({
        potencia_modulo_wp: ufData.potencia_modulo_wp ? Number(ufData.potencia_modulo_wp) : null,
        numero_modulos: ufData.numero_modulos ? Number(ufData.numero_modulos) : null,
        modelo_modulo: ufData.modelo_modulo || null,
        modelo_inversor: ufData.modelo_inversor || null,
        tipo_instalacao: ufData.tipo_instalacao || null,
        area_instalacao_m2: ufData.area_instalacao_m2 ? Number(ufData.area_instalacao_m2) : null,
        geracao_estimada_kwh: ufData.geracao_estimada_kwh ? Number(ufData.geracao_estimada_kwh) : null,
        system_kwp: ufData.potencia_kwp ? Number(ufData.potencia_kwp) : null,
        tipo_rede: ufData.tipo_rede && ufData.tipo_rede !== 'nenhum' ? ufData.tipo_rede : null,
      } as Partial<PortfolioClientRow>)
      setEditMode(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <UfConfigurationFields data={ufData} onChange={handleFieldChange} readOnly={!editMode} />
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {!editMode && (
          <button type="button" onClick={() => setShowEditPrompt(true)}
            style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            ✏️ Editar
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => setShowSavePrompt(true)} disabled={saving}
            style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: 'none', background: '#f59e0b', color: '#000', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontSize: 13 }}>
            {saving ? 'Salvando…' : '💾 Salvar Alterações'}
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => { setEditMode(false); resetUfData() }}
            style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
        )}
      </div>
      {showEditPrompt && (
        <ConfirmDialog
          title="Editar Usina"
          message="Deseja realmente editar os dados da usina?"
          confirmLabel="Editar"
          confirmColor="#3b82f6"
          onConfirm={() => { setShowEditPrompt(false); setEditMode(true) }}
          onCancel={() => setShowEditPrompt(false)}
        />
      )}
      {showSavePrompt && (
        <ConfirmDialog
          title="Salvar Usina"
          message="Deseja realmente salvar as alterações dos dados da usina?"
          confirmLabel="Salvar"
          confirmColor="#22c55e"
          onConfirm={() => { setShowSavePrompt(false); void handleSave() }}
          onCancel={() => setShowSavePrompt(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Plano Leasing Tab — shown only when contract_type = 'leasing'
// Persists to client_energy_profile via PATCH /api/client-portfolio/:id/plan
// PORTFOLIO CONTEXT: Energy plan fields (kwh_mes_contratado, tarifa_atual, etc.)
// come exclusively from /api/client-portfolio/:id → energy_profile / top-level.
// NEVER use latest_proposal_profile as a source for these fields.
// If energy_profile is null, the UI must show empty — not fallback to proposal.
// ─────────────────────────────────────────────────────────────────────────────
function PlanoLeasingTab({ client, onSaved }: { client: PortfolioClientRow; onSaved: (patch: Partial<PortfolioClientRow>) => void }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)

  const [form, setForm] = useState({
    modalidade: client.modalidade ?? 'leasing',
    kwh_mes_contratado: client.kwh_mes_contratado != null ? String(client.kwh_mes_contratado) : (client.kwh_contratado != null ? String(client.kwh_contratado) : ''),
    desconto_percentual: client.desconto_percentual != null ? String(client.desconto_percentual) : '',
    tarifa_atual: client.tarifa_atual != null ? String(client.tarifa_atual) : '',
    mensalidade: client.mensalidade != null ? String(client.mensalidade) : (client.valor_mensalidade != null ? String(client.valor_mensalidade) : ''),
    prazo_meses: client.prazo_meses != null ? String(client.prazo_meses) : '',
    potencia_kwp: client.potencia_kwp != null ? String(client.potencia_kwp) : (client.system_kwp != null ? String(client.system_kwp) : ''),
    tipo_rede: client.tipo_rede ?? '',
    marca_inversor: client.marca_inversor ?? '',
    indicacao: client.indicacao ?? '',
  })

  const resetForm = () => setForm({
    modalidade: client.modalidade ?? 'leasing',
    kwh_mes_contratado: client.kwh_mes_contratado != null ? String(client.kwh_mes_contratado) : (client.kwh_contratado != null ? String(client.kwh_contratado) : ''),
    desconto_percentual: client.desconto_percentual != null ? String(client.desconto_percentual) : '',
    tarifa_atual: client.tarifa_atual != null ? String(client.tarifa_atual) : '',
    mensalidade: client.mensalidade != null ? String(client.mensalidade) : (client.valor_mensalidade != null ? String(client.valor_mensalidade) : ''),
    prazo_meses: client.prazo_meses != null ? String(client.prazo_meses) : '',
    potencia_kwp: client.potencia_kwp != null ? String(client.potencia_kwp) : (client.system_kwp != null ? String(client.system_kwp) : ''),
    tipo_rede: client.tipo_rede ?? '',
    marca_inversor: client.marca_inversor ?? '',
    indicacao: client.indicacao ?? '',
  })

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const payload: Record<string, unknown> = {
        modalidade: form.modalidade || null,
        kwh_contratado: form.kwh_mes_contratado ? Number(form.kwh_mes_contratado) : null,
        desconto_percentual: form.desconto_percentual ? Number(form.desconto_percentual) : null,
        tarifa_atual: form.tarifa_atual ? Number(form.tarifa_atual) : null,
        mensalidade: form.mensalidade ? Number(form.mensalidade) : null,
        prazo_meses: form.prazo_meses ? Number(form.prazo_meses) : null,
        potencia_kwp: form.potencia_kwp ? Number(form.potencia_kwp) : null,
        tipo_rede: form.tipo_rede || null,
        marca_inversor: form.marca_inversor || null,
        indicacao: form.indicacao || null,
      }
      await patchPortfolioPlan(client.id, payload)
      onSaved({
        modalidade: form.modalidade || null,
        kwh_contratado: form.kwh_mes_contratado ? Number(form.kwh_mes_contratado) : null,
        kwh_mes_contratado: form.kwh_mes_contratado ? Number(form.kwh_mes_contratado) : null,
        desconto_percentual: form.desconto_percentual ? Number(form.desconto_percentual) : null,
        tarifa_atual: form.tarifa_atual ? Number(form.tarifa_atual) : null,
        mensalidade: form.mensalidade ? Number(form.mensalidade) : null,
        valor_mensalidade: form.mensalidade ? Number(form.mensalidade) : null,
        prazo_meses: form.prazo_meses ? Number(form.prazo_meses) : null,
        potencia_kwp: form.potencia_kwp ? Number(form.potencia_kwp) : null,
        tipo_rede: form.tipo_rede || null,
        marca_inversor: form.marca_inversor || null,
        indicacao: form.indicacao || null,
      } as Partial<PortfolioClientRow>)
      setEditMode(false)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar plano.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 4, padding: '7px 10px',
    borderRadius: 6, border: '1px solid var(--border, #334155)',
    background: 'var(--surface-2, #0f172a)', color: 'inherit', fontSize: 13,
  }
  const labelSty: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted, #94a3b8)' }
  const gridSty: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ background: 'var(--surface-2, #0f172a)', borderRadius: 8, padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: '#06b6d4' }}>📋 Plano Leasing</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={labelSty}>
            Modalidade
            <select value={form.modalidade} onChange={(e) => setForm((f) => ({ ...f, modalidade: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="leasing">Leasing</option>
              <option value="assinatura">Assinatura</option>
              <option value="consorcio">Consórcio</option>
            </select>
          </label>
          <div style={gridSty}>
            <label style={labelSty}>
              kWh/mês Contratado
              <input type="number" min={0} value={form.kwh_mes_contratado} onChange={(e) => setForm((f) => ({ ...f, kwh_mes_contratado: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label style={labelSty}>
              Desconto (%)
              <input type="number" min={0} max={100} step="0.1" value={form.desconto_percentual} onChange={(e) => setForm((f) => ({ ...f, desconto_percentual: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridSty}>
            <label style={labelSty}>
              Tarifa Atual (R$/kWh)
              <input type="number" min={0} step="0.0001" value={form.tarifa_atual} onChange={(e) => setForm((f) => ({ ...f, tarifa_atual: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label style={labelSty}>
              Mensalidade (R$)
              <input type="number" min={0} step="0.01" value={form.mensalidade} onChange={(e) => setForm((f) => ({ ...f, mensalidade: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridSty}>
            <label style={labelSty}>
              Prazo (meses)
              <input type="number" min={0} value={form.prazo_meses} onChange={(e) => setForm((f) => ({ ...f, prazo_meses: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label style={labelSty}>
              Potência (kWp)
              <input type="number" min={0} step="0.01" value={form.potencia_kwp} onChange={(e) => setForm((f) => ({ ...f, potencia_kwp: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridSty}>
            <label style={labelSty}>
              Tipo de Rede
              <select value={form.tipo_rede} onChange={(e) => setForm((f) => ({ ...f, tipo_rede: e.target.value }))} disabled={!editMode} style={inputStyle}>
                <option value="">Selecione…</option>
                <option value="monofasico">Monofásico</option>
                <option value="bifasico">Bifásico</option>
                <option value="trifasico">Trifásico</option>
              </select>
            </label>
            <label style={labelSty}>
              Marca Inversor
              <input type="text" value={form.marca_inversor} onChange={(e) => setForm((f) => ({ ...f, marca_inversor: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <label style={labelSty}>
            Indicação
            <input type="text" value={form.indicacao} onChange={(e) => setForm((f) => ({ ...f, indicacao: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
        </div>
      </div>
      {saveError && <p style={{ color: '#ef4444', fontSize: 12 }}>{saveError}</p>}
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        {!editMode && (
          <button type="button" onClick={() => setShowEditPrompt(true)}
            style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
            ✏️ Editar
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => setShowSavePrompt(true)} disabled={saving}
            style={{ flex: 1, padding: '9px 0', borderRadius: 6, border: 'none', background: '#06b6d4', color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontSize: 13 }}>
            {saving ? 'Salvando…' : '💾 Salvar Alterações'}
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => { setEditMode(false); resetForm() }}
            style={{ padding: '9px 16px', borderRadius: 6, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13 }}>
            Cancelar
          </button>
        )}
      </div>
      {showEditPrompt && (
        <ConfirmDialog
          title="Editar Plano"
          message="Deseja realmente editar os dados do plano?"
          confirmLabel="Editar"
          confirmColor="#3b82f6"
          onConfirm={() => { setShowEditPrompt(false); setEditMode(true) }}
          onCancel={() => setShowEditPrompt(false)}
        />
      )}
      {showSavePrompt && (
        <ConfirmDialog
          title="Salvar Plano"
          message="Deseja realmente salvar as alterações dos dados do plano?"
          confirmLabel="Salvar"
          confirmColor="#22c55e"
          onConfirm={() => { setShowSavePrompt(false); void handleSave() }}
          onCancel={() => setShowSavePrompt(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes Tab
// ─────────────────────────────────────────────────────────────────────────────
function NotasTab({ client }: { client: PortfolioClientRow }) {
  // ── PORTFOLIO CONTEXT: data sourced exclusively from /api/client-portfolio/:id/notes ──
  // Never read notes from /api/clients/:id or any legacy endpoint.
  const clientId = client.id
  const [notes, setNotes] = useState<Array<{ id: number; content: string; entry_type: string; created_at: string; title: string | null; created_by_user_id?: string | null; created_by_name?: string | null }>>([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [newNoteTitle, setNewNoteTitle] = useState('')
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
      const payload: { content: string; entry_type: string; title?: string } = {
        content: newNote.trim(),
        entry_type: 'note',
      }
      if (newNoteTitle.trim()) {
        payload.title = newNoteTitle.trim()
      }
      const note = await addPortfolioNote(clientId, payload)
      setNotes((prev) => [note, ...prev])
      setNewNote('')
      setNewNoteTitle('')
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Erro ao salvar nota.')
    } finally {
      setAddingNote(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 6,
    border: '1px solid var(--border, #334155)',
    background: 'var(--surface-2, #0f172a)', color: 'inherit', fontSize: 13,
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 4 }}>
        <input
          type="text"
          value={newNoteTitle}
          onChange={(e) => setNewNoteTitle(e.target.value)}
          placeholder="Título (opcional)"
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={2}
            placeholder="Adicionar observação..."
            style={{ ...inputStyle, resize: 'none', flex: 1 }}
          />
          <button type="button" onClick={() => void handleAddNote()} disabled={addingNote || !newNote.trim()}
            style={{ padding: '0 16px', borderRadius: 6, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end', height: 40 }}>
            {addingNote ? '…' : '＋'}
          </button>
        </div>
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
              {note.title && (
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2, color: '#93c5fd' }}>{note.title}</div>
              )}
              <div style={{ fontSize: 13 }}>{note.content}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 4 }}>
                {note.created_at ? new Date(note.created_at).toLocaleString('pt-BR') : '—'}
                {(note.created_by_name || note.created_by_user_id) && (
                  <span> — {note.created_by_name ?? note.created_by_user_id}</span>
                )}
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
// PORTFOLIO REHYDRATION RULE (Etapa 2.4):
//   All tabs are hydrated exclusively from GET /api/client-portfolio/:id.
//   The state flows through usePortfolioClient → normalizePortfolioClientPayload.
//   NEVER hydrate portfolio tabs from:
//     - /api/clients/:id
//     - /api/clients?page=... (listing endpoint)
//     - latest_proposal_profile
//     - metadata as primary source
//   If a field is null in the portfolio payload, the UI MUST show empty — no
//   fallback to proposal data or legacy endpoints.
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
  const { client, isLoading, error, reloadSilent, setClient: setHookClient } = usePortfolioClient(clientId)
  const [activeTab, setActiveTab] = useState<Tab>('editar')
  const [localClient, setLocalClient] = useState<PortfolioClientRow | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('expanded')
  const { removing, removeClient } = usePortfolioRemove()
  const { deleting, deleteClient } = usePortfolioDelete()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  // Counter to force tab remount after a silent reload completes, so forms
  // re-initialise from the fresh server data instead of stale props.
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (client) setLocalClient(client)
  }, [client])

  const displayClient = localClient ?? client

  /**
   * Central post-save handler for all portfolio tabs (except EditarTab which
   * already handles its own optimistic merge via onSaved callback).
   *
   * 1. Optimistically merge the saved fields into localClient so the UI
   *    reflects the new values immediately — no flash.
   * 2. Trigger a silent refetch of the full client-portfolio row so every
   *    cross-tab derived field stays consistent.
   * 3. Bump refreshKey so that the active tab component remounts with the
   *    authoritative server data as its initial form state.
   * 4. Refresh the clients list in the background.
   */
  const handleTabSaved = useCallback((patch: Partial<PortfolioClientRow>) => {
    // Step 1 — optimistic merge
    setLocalClient((prev) => prev ? { ...prev, ...patch } : prev)
    setHookClient((prev) => prev ? { ...prev, ...patch } : prev)

    // Step 2+3 — silent refetch, then bump key to re-init forms
    void reloadSilent().then(() => setRefreshKey((k) => k + 1))

    // Step 4 — refresh the sidebar list
    onClientUpdated()
  }, [reloadSilent, setHookClient, onClientUpdated])

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
      <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border, #334155)', flexShrink: 0, background: 'linear-gradient(135deg, rgba(30,41,59,0.95) 0%, rgba(15,23,42,0.95) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 3, color: '#f1f5f9' }}>{displayClient.name ?? '—'}</div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {[displayClient.city, displayClient.state].filter(Boolean).join(' / ')} · Exportado {formatDate(displayClient.exported_to_portfolio_at)}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar painel"
            style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontSize: 16, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setViewMode('expanded')}
            style={{
              padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.5)',
              background: 'rgba(59,130,246,0.15)', color: '#60a5fa',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ↗️ Tela Cheia
          </button>
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            disabled={removing}
            style={{
              padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(245,158,11,0.5)',
              background: 'rgba(245,158,11,0.15)', color: '#fbbf24',
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
              padding: '7px 14px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.5)',
              background: 'rgba(239,68,68,0.15)', color: '#f87171',
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
        <DetailTabBar activeTab={activeTab} onChange={setActiveTab} showPlano={displayClient.contract_type === 'leasing'} />
        {activeTab === 'editar' && (
          <EditarTab
            key={`editar-${refreshKey}`}
            client={displayClient}
            onSaved={(updated) => {
              setLocalClient(updated)
              setHookClient(updated)
              void reloadSilent().then(() => setRefreshKey((k) => k + 1))
              onClientUpdated()
            }}
            onToast={onToast}
          />
        )}
        {activeTab === 'usina' && <UsinaTab key={`usina-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />}
        {activeTab === 'contrato' && <ContratoTab key={`contrato-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />}
        {activeTab === 'plano' && displayClient.contract_type === 'leasing' && <PlanoLeasingTab key={`plano-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />}
        {activeTab === 'projeto' && <ProjetoTab key={`projeto-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />}
        {activeTab === 'cobranca' && <CobrancaTab key={`cobranca-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />}
        {activeTab === 'notas' && <NotasTab key={`notas-${refreshKey}`} client={displayClient} />}
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

      {/* Full-screen editor shell */}
      {viewMode === 'expanded' && (
        <ClientPortfolioEditorShell
          clientName={displayClient.name ?? ''}
          viewMode={viewMode}
          onClose={() => { setViewMode('collapsed'); onClose() }}
          onToggleMode={() => setViewMode('collapsed')}
        >
          <div style={{ padding: '16px 24px', maxWidth: 1100, margin: '0 auto' }}>
            <DetailTabBar activeTab={activeTab} onChange={setActiveTab} showPlano={displayClient.contract_type === 'leasing'} />
            {activeTab === 'editar' && (
              <EditarTab
                key={`fs-editar-${refreshKey}`}
                client={displayClient}
                onSaved={(updated) => {
                  setLocalClient(updated)
                  setHookClient(updated)
                  void reloadSilent().then(() => setRefreshKey((k) => k + 1))
                  onClientUpdated()
                }}
                onToast={onToast}
              />
            )}
            {activeTab === 'usina' && <UsinaTab key={`fs-usina-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />}
            {activeTab === 'contrato' && <ContratoTab key={`fs-contrato-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />}
            {activeTab === 'plano' && displayClient.contract_type === 'leasing' && <PlanoLeasingTab key={`fs-plano-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />}
            {activeTab === 'projeto' && <ProjetoTab key={`fs-projeto-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />}
            {activeTab === 'cobranca' && <CobrancaTab key={`fs-cobranca-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />}
            {activeTab === 'notas' && <NotasTab key={`fs-notas-${refreshKey}`} client={displayClient} />}
          </div>
        </ClientPortfolioEditorShell>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export function ClientPortfolioPage({ onBack, onClientRemovedFromPortfolio }: Props) {
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
    onClientRemovedFromPortfolio?.()
  }, [removeClient, selectedClientId, onClientRemovedFromPortfolio])

  const handleDeleted = useCallback((clientId: number) => {
    removeClient(clientId)
    if (selectedClientId === clientId) setSelectedClientId(null)
    onClientRemovedFromPortfolio?.()
  }, [removeClient, selectedClientId, onClientRemovedFromPortfolio])

  const total = clients.length
  const hasClients = total > 0

  // Compute billing alerts from all clients for the dashboard widget
  const billingAlerts = useMemo(() => {
    if (!hasClients) return []
    const alerts: BillingAlertItem[] = []
    for (const c of clients) {
      if (!c.due_day || !c.valor_mensalidade || !c.commissioning_date) continue
      const readingDay = c.reading_day ?? c.due_day
      const engine = calculateBillingDates({
        data_comissionamento: c.commissioning_date,
        dia_leitura: readingDay,
        dia_vencimento: c.due_day,
        valor_mensalidade: c.valor_mensalidade,
      })
      if (engine.status_calculo === 'erro_entrada') continue
      const termMonths = c.contractual_term_months ?? c.term_months ?? 12
      const insts = generateInstallments({
        inicio_mensalidade: engine.inicio_da_mensalidade,
        prazo: termMonths,
        dia_vencimento: c.due_day,
        valor_mensalidade: c.valor_mensalidade,
      })
      for (const inst of insts) {
        const alert = getBillingAlert(inst.data_vencimento, inst.status === 'paga')
        if (alert.level === 'a_vencer' || alert.level === 'vence_hoje' || alert.level === 'vencida') {
          alerts.push({
            clientId: c.id,
            clientName: c.name ?? '—',
            level: alert.level,
            dueDate: inst.data_vencimento.toISOString(),
            amount: inst.valor,
            installmentNumber: inst.numero,
          })
        }
      }
    }
    return alerts.slice(0, MAX_DASHBOARD_ALERTS)
  }, [clients, hasClients])

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
            flex: selectedClientId ? '0 0 30%' : '1 1 100%',
            overflowY: 'auto',
            padding: '12px 16px',
            transition: 'flex 0.2s',
            minWidth: 0,
          }}
        >
          {/* Billing alerts widget */}
          {!isLoading && hasClients && billingAlerts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <BillingAlertsWidget
                alerts={billingAlerts}
                onClientClick={(cid) => setSelectedClientId(cid)}
              />
            </div>
          )}
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
              flex: '0 0 70%',
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
