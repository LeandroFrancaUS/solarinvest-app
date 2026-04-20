// src/pages/ClientPortfolioPage.tsx
// "Carteira de Clientes" — professional operational management hub.
// Access: admin | office | financeiro only.

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import '../styles/portfolio.css'
import {
  useClientPortfolio,
  usePortfolioClient,
  usePortfolioRemove,
  usePortfolioDelete,
} from '../hooks/useClientPortfolio'
import type { PortfolioClientRow, ContractAttachment } from '../types/clientPortfolio'
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
  exportClientToPortfolio,
} from '../services/clientPortfolioApi'
import { upsertClientByDocument } from '../lib/api/clientsApi'
import {
  isValidCpfOrCnpj,
  isValidBrazilPhone,
  isValidEmail,
  isValidCep,
  isValidUc,
} from '../lib/validation/clientReadiness'
import { formatCurrencyBRL } from '../utils/formatters'
import { ClientPortfolioEditorShell, type ViewMode } from '../components/portfolio/ClientPortfolioEditorShell'
import { UfConfigurationFields, type UfConfigData } from '../components/portfolio/UfConfigurationFields'
import { calculateBillingDates, generateInstallments, getBillingAlert, BILLING_ALERT_LABELS, MAX_DASHBOARD_ALERTS } from '../domain/billing/monthlyEngine'
import { generateNotificationsForClient } from '../domain/billing/BillingNotificationService'
import { BillingAlertsWidget, type BillingAlertItem } from '../components/portfolio/BillingAlertsWidget'
import type { Consultant, Engineer, Installer } from '../types/personnel'
import { fetchConsultants, fetchEngineers, fetchInstallers } from '../services/personnelApi'

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

/**
 * Calculates the remaining months in a contract.
 * Returns null when there is not enough data to compute.
 * Never returns a negative value (minimum is 0).
 */
function calcRemainingMonths(
  totalMonths: number | null | undefined,
  contractStartDate: string | null | undefined,
  fallbackDate?: string | null,
): number | null {
  const term = totalMonths ?? null
  if (!term || term <= 0) return null
  const startRaw = contractStartDate || fallbackDate
  if (!startRaw) return null
  const start = new Date(startRaw)
  if (isNaN(start.getTime())) return null
  const now = new Date()
  const elapsed =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth())
  return Math.max(0, Math.round(term - elapsed))
}

// ─────────────────────────────────────────────────────────────────────────────
// Client form validation (used by AddClientModal)
// ─────────────────────────────────────────────────────────────────────────────
interface ClientFormErrors {
  name?: string
  document?: string
  phone?: string
  email?: string
  cep?: string
  uc?: string
}

interface AddClientFormData {
  name: string
  document: string
  phone: string
  email: string
  cep: string
  city: string
  state: string
  address: string
  distribuidora: string
  uc: string
  consumption_kwh_month: string
  term_months: string
}

function validateClientForm(data: AddClientFormData): ClientFormErrors {
  const errors: ClientFormErrors = {}
  if (!data.name.trim()) {
    errors.name = 'Nome obrigatório'
  }
  if (!isValidCpfOrCnpj(data.document)) {
    const digits = data.document.replace(/\D/g, '')
    if (digits.length === 11) errors.document = 'CPF inválido'
    else if (digits.length === 14) errors.document = 'CNPJ inválido'
    else errors.document = 'CPF/CNPJ inválido'
  }
  if (data.phone && !isValidBrazilPhone(data.phone)) {
    errors.phone = 'Telefone incompleto'
  }
  if (data.email && !isValidEmail(data.email)) {
    errors.email = 'E-mail inválido'
  }
  if (data.cep && !isValidCep(data.cep)) {
    errors.cep = 'CEP inválido'
  }
  if (data.uc && !isValidUc(data.uc)) {
    errors.uc = 'UC deve ter 15 dígitos numéricos'
  }
  return errors
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
// Attachment helpers
// ─────────────────────────────────────────────────────────────────────────────
function isPreviewable(mimeType?: string | null, fileName?: string | null): boolean {
  const name = (fileName ?? '').toLowerCase()
  const mime = (mimeType ?? '').toLowerCase()
  return (
    mime.includes('pdf') ||
    mime.startsWith('image/') ||
    name.endsWith('.pdf') ||
    name.endsWith('.png') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.webp')
  )
}

function isPdf(mimeType?: string | null, fileName?: string | null): boolean {
  return (mimeType ?? '').includes('pdf') || (fileName ?? '').toLowerCase().endsWith('.pdf')
}

function isImage(mimeType?: string | null, fileName?: string | null): boolean {
  const name = (fileName ?? '').toLowerCase()
  return (
    (mimeType ?? '').startsWith('image/') ||
    name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp')
  )
}

interface AttachmentItemProps {
  att: ContractAttachment
  onRemove?: (() => void) | undefined
  editMode: boolean
}

function AttachmentItem({ att, onRemove, editMode }: AttachmentItemProps) {
  const [showPreview, setShowPreview] = useState(false)
  const previewable = att.url && isPreviewable(att.mimeType, att.fileName)
  const pdf = att.url && isPdf(att.mimeType, att.fileName)
  const image = att.url && isImage(att.mimeType, att.fileName)
  const sizeLabel = att.sizeBytes != null ? `${(att.sizeBytes / 1024).toFixed(1)} KB` : null
  const icon = pdf ? '📄' : image ? '🖼️' : '📎'

  return (
    <>
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        padding: '6px 8px', borderRadius: 6,
        background: 'var(--surface-2, rgba(255,255,255,0.04))',
        border: '1px solid var(--border, #334155)',
      }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {att.fileName}
        </span>
        {sizeLabel && <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{sizeLabel}</span>}
        {previewable && (
          <button type="button" onClick={() => setShowPreview(true)}
            style={{ fontSize: 11, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
            👁️ Visualizar
          </button>
        )}
        {att.url && (
          <a href={att.url} download={att.fileName}
            style={{ fontSize: 11, color: '#3b82f6', textDecoration: 'none', padding: '2px 6px' }}>
            ⬇️ Baixar
          </a>
        )}
        {editMode && onRemove && (
          <button type="button" onClick={onRemove}
            style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
            ✕
          </button>
        )}
      </div>
      {showPreview && att.url && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPreview(false) }}
        >
          <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{att.fileName}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={att.url} download={att.fileName}
                  style={{ fontSize: 12, color: '#3b82f6', textDecoration: 'none' }}>⬇️ Baixar</a>
                <button type="button" onClick={() => setShowPreview(false)}
                  style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
              </div>
            </div>
            {pdf && (
              <iframe src={att.url} title={att.fileName}
                style={{ width: '100%', height: '75vh', border: 'none', borderRadius: 6 }} />
            )}
            {image && (
              <img src={att.url} alt={att.fileName}
                style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 6 }} />
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Client card (list row)
// ─────────────────────────────────────────────────────────────────────────────
const CARD_CONTRACT_LABELS: Record<string, string> = {
  leasing: 'Leasing',
  sale: 'Venda',
  buyout: 'Buy Out',
}

function ClientCard({
  client,
  onEdit,
  onDelete,
}: {
  client: PortfolioClientRow
  onEdit: () => void
  onDelete: () => void
}) {
  const contractLabel = client.contract_type ? (CARD_CONTRACT_LABELS[client.contract_type] ?? client.contract_type) : '—'
  const remainingMonths = calcRemainingMonths(
    client.contractual_term_months ?? client.term_months,
    client.contract_start_date,
    client.client_created_at,
  )
  const remainingLabel = remainingMonths !== null ? `${remainingMonths} meses` : '—'

  return (
    <div className="pf-client-card">
      <div className="pf-card-body">
        <div className="pf-card-info">
          <div className="pf-card-name">{client.name ?? '—'}</div>
          <div className="pf-card-doc">{client.document ?? '—'}</div>
          <div className="pf-card-meta">
            <span className="pf-card-contract">{contractLabel}</span>
            <span className="pf-card-meta-sep">·</span>
            <span className="pf-card-remaining">{remainingLabel}</span>
          </div>
        </div>
        <div className="pf-card-actions">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            className="pf-row-btn pf-row-btn-edit"
          >
            ✏️ Editar
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="pf-row-btn pf-row-btn-delete"
          >
            🗑️ Excluir
          </button>
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
    <div className="pf-tab-bar">
      {tabs.filter((t) => !t.hidden).map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`pf-tab-btn${activeTab === t.id ? ' active' : ''}`}
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
      console.log('[clients][update] success', { clientId: client.id, name: form.client_name })
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
    boxSizing: 'border-box' as const,
  }
  const labelStyle: React.CSSProperties = {}
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  return (
    <div style={{ paddingBottom: 20 }}>
      <div className="pf-section-card">
        <div className="pf-section-title"><span className="pf-icon">📇</span> Identificação</div>
        <div className="pf-form-grid">
          <label className="pf-label" style={labelStyle}>
            Nome / Razão Social
            <input type="text" value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <label className="pf-label" style={labelStyle}>
            Documento (CPF/CNPJ)
            <input type="text" value={form.client_document} onChange={(e) => setForm((f) => ({ ...f, client_document: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <div style={gridStyle}>
            <label className="pf-label" style={labelStyle}>
              Telefone
              <input type="text" value={form.client_phone} onChange={(e) => setForm((f) => ({ ...f, client_phone: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label className="pf-label" style={labelStyle}>
              E-mail
              <input type="email" value={form.client_email} onChange={(e) => setForm((f) => ({ ...f, client_email: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridStyle}>
            <label className="pf-label" style={labelStyle}>
              Cidade
              <input type="text" value={form.client_city} onChange={(e) => setForm((f) => ({ ...f, client_city: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label className="pf-label" style={labelStyle}>
              Estado (UF)
              <input type="text" maxLength={2} value={form.client_state} onChange={(e) => setForm((f) => ({ ...f, client_state: e.target.value.toUpperCase() }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <label className="pf-label" style={labelStyle}>
            Endereço
            <input type="text" value={form.client_address} onChange={(e) => setForm((f) => ({ ...f, client_address: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
        </div>
      </div>

      <div className="pf-section-card">
        <div className="pf-section-title"><span className="pf-icon">⚡</span> Energia</div>
        <div className="pf-form-grid">
          <label className="pf-label" style={labelStyle}>
            Distribuidora
            <input type="text" value={form.distribuidora} onChange={(e) => setForm((f) => ({ ...f, distribuidora: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <div style={gridStyle}>
            <label className="pf-label" style={labelStyle}>
              UC Geradora
              <input type="text" value={form.uc_geradora} onChange={(e) => setForm((f) => ({ ...f, uc_geradora: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label className="pf-label" style={labelStyle}>
              UC Beneficiária
              <input type="text" value={form.uc_beneficiaria} onChange={(e) => setForm((f) => ({ ...f, uc_beneficiaria: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridStyle}>
            <label className="pf-label" style={labelStyle}>
              Consumo (kWh/mês)
              <input type="number" value={form.consumption_kwh_month} onChange={(e) => setForm((f) => ({ ...f, consumption_kwh_month: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label className="pf-label" style={labelStyle}>
              Potência (kWp)
              <input type="number" value={form.system_kwp} onChange={(e) => setForm((f) => ({ ...f, system_kwp: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <label className="pf-label" style={labelStyle}>
            Prazo Contratual (meses)
            <input type="number" value={form.term_months} onChange={(e) => setForm((f) => ({ ...f, term_months: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
        </div>
      </div>

      <div className="pf-footer-actions">
        {!editMode && (
          <button type="button" onClick={() => setShowEditPrompt(true)}
            className="pf-btn pf-btn-edit">
            ✏️ Editar
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => setShowSavePrompt(true)} disabled={saving}
            className="pf-btn pf-btn-save">
            {saving ? 'Salvando…' : '💾 Salvar Alterações'}
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => { setEditMode(false); resetForm() }}
            className="pf-btn pf-btn-cancel">
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

function buildBuyoutEligibleDefault(contractType: string, persisted: boolean | null | undefined): boolean {
  if (persisted != null) return persisted
  return contractType === 'leasing' || contractType === 'buyout'
}

function ContratoTab({ client, onSaved }: { client: PortfolioClientRow; onSaved: (patch: Partial<PortfolioClientRow>) => void }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [showEditPrompt, setShowEditPrompt] = useState(false)
  const [showSavePrompt, setShowSavePrompt] = useState(false)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  // Multiple attachments state — seeded from DB or migrated from legacy single-file fields
  const [contractAttachments, setContractAttachments] = useState<ContractAttachment[]>(() => {
    // If DB has an explicit attachments array (even empty), use it — avoids clobbering a
    // deliberate clear of legacy data. Only fall through when the column is null/absent.
    if (Array.isArray(client.contract_attachments)) {
      return client.contract_attachments
    }
    // Backward compatibility: promote legacy single file to array
    if (client.contract_file_url) {
      return [{
        id: 'legacy',
        fileName: client.contract_file_name ?? 'contrato',
        mimeType: client.contract_file_type ?? null,
        url: client.contract_file_url,
      }]
    }
    return []
  })

  useEffect(() => {
    void fetchConsultants(true).then(setConsultants).catch(() => { /* graceful — remain empty, show text field */ })
  }, [])

  const [form, setForm] = useState({
    contract_type: client.contract_type ?? 'leasing',
    contract_status: client.contract_status ?? 'draft',
    source_proposal_id: client.source_proposal_id ?? '',
    contract_signed_at: client.contract_signed_at?.slice(0, 10) ?? '',
    contract_start_date: client.contract_start_date?.slice(0, 10) ?? '',
    billing_start_date: client.billing_start_date?.slice(0, 10) ?? '',
    expected_billing_end_date: client.expected_billing_end_date?.slice(0, 10) ?? '',
    contractual_term_months: client.contractual_term_months != null ? String(client.contractual_term_months) : '',
    buyout_eligible: buildBuyoutEligibleDefault(client.contract_type ?? 'leasing', client.buyout_eligible),
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
    buyout_eligible: buildBuyoutEligibleDefault(client.contract_type ?? 'leasing', client.buyout_eligible),
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
        contract_attachments: contractAttachments,
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
        contract_attachments: contractAttachments,
      } as Partial<PortfolioClientRow>)
      setEditMode(false)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const isVenda = form.contract_type === 'sale'
  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' as const,
  }
  const labelSty: React.CSSProperties = {}
  const gridSty: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="pf-section-card">
        <div className="pf-section-title"><span className="pf-icon">📄</span> Dados do Contrato</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label className="pf-label" style={labelSty}>
            Tipo de Contrato
            <select value={form.contract_type ?? ''} onChange={(e) => setForm((f) => ({ ...f, contract_type: e.target.value }))} disabled={!editMode} style={inputStyle}>
              {Object.entries(CONTRACT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="pf-label" style={labelSty}>
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
          <label className="pf-label" style={labelSty}>
            ID da Proposta de Origem
            <input type="text" value={form.source_proposal_id} onChange={(e) => setForm((f) => ({ ...f, source_proposal_id: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <div style={gridSty}>
            <label className="pf-label" style={labelSty}>
              Data de Assinatura
              <input type="date" value={form.contract_signed_at} onChange={(e) => setForm((f) => ({ ...f, contract_signed_at: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label className="pf-label" style={labelSty}>
              Início do Contrato
              <input type="date" value={form.contract_start_date} onChange={(e) => setForm((f) => ({ ...f, contract_start_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridSty}>
            <label className="pf-label" style={labelSty}>
              Início da Cobrança
              <input type="date" value={form.billing_start_date} onChange={(e) => setForm((f) => ({ ...f, billing_start_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label className="pf-label" style={labelSty}>
              Fim Previsto da Cobrança
              <input type="date" value={form.expected_billing_end_date} onChange={(e) => setForm((f) => ({ ...f, expected_billing_end_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <label className="pf-label" style={labelSty}>
            Prazo Contratual (meses)
            <input type="number" value={form.contractual_term_months} onChange={(e) => setForm((f) => ({ ...f, contractual_term_months: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          {/* Valor do Sistema Fotovoltaico — shown for all contract types */}
          {client.valordemercado != null && (
            <div style={{ fontSize: 13 }}>
              <span className="pf-label" style={{ display: 'block', marginBottom: 2 }}>Valor do Sistema Fotovoltaico</span>
              <strong style={{ color: 'var(--text-primary, #f8fafc)' }}>
                {formatCurrencyBRL(client.valordemercado)}
              </strong>
              <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 6 }}>(Preço Ideal da Análise Financeira)</span>
            </div>
          )}
          {/* Elegível para Buy Out — hidden for sale contracts */}
          {!isVenda && (
            <>
              <label className="pf-checkbox-label">
                <input type="checkbox" checked={form.buyout_eligible} onChange={(e) => setForm((f) => ({ ...f, buyout_eligible: e.target.checked }))} disabled={!editMode} style={{ width: 14, height: 14, accentColor: '#f59e0b' }} />
                Elegível para Buy Out
              </label>
              {form.buyout_eligible && (
                <div style={gridSty}>
                  <label className="pf-label" style={labelSty}>
                    Status do Buy Out
                    <input type="text" value={form.buyout_status} onChange={(e) => setForm((f) => ({ ...f, buyout_status: e.target.value }))} disabled={!editMode} style={inputStyle} />
                  </label>
                  <label className="pf-label" style={labelSty}>
                    Data do Buy Out
                    <input type="date" value={form.buyout_date} onChange={(e) => setForm((f) => ({ ...f, buyout_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
                  </label>
                  <label className="pf-label" style={labelSty}>
                    Valor de Referência Buy Out (R$)
                    <input type="number" min={0} step="0.01" value={form.buyout_amount_reference} onChange={(e) => setForm((f) => ({ ...f, buyout_amount_reference: e.target.value }))} disabled={!editMode} style={inputStyle} />
                  </label>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Consultant section */}
      <div className="pf-section-card">
        <div className="pf-section-title"><span className="pf-icon">🧑‍💼</span> Consultor</div>
        <div style={gridSty}>
          {consultants.length > 0 ? (
            <label className="pf-label" style={{ ...labelSty, gridColumn: '1 / -1' }}>
              Consultor
              <select
                value={form.consultant_id}
                onChange={(e) => {
                  const selected = consultants.find((c) => String(c.id) === e.target.value)
                  setForm((f) => ({
                    ...f,
                    consultant_id: e.target.value,
                    consultant_name: selected ? selected.full_name : f.consultant_name,
                  }))
                }}
                disabled={!editMode}
                style={inputStyle}
              >
                <option value="">Selecione um consultor…</option>
                {consultants.map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.full_name} ({c.consultant_code})</option>
                ))}
                {/* Show legacy value if not in active list */}
                {form.consultant_id && !consultants.find((c) => String(c.id) === form.consultant_id) && (
                  <option value={form.consultant_id}>{form.consultant_name || form.consultant_id}</option>
                )}
              </select>
            </label>
          ) : (
            <>
              <label className="pf-label" style={labelSty}>
                ID do Consultor
                <input type="text" value={form.consultant_id} onChange={(e) => setForm((f) => ({ ...f, consultant_id: e.target.value }))} disabled={!editMode} style={inputStyle} />
              </label>
              <label className="pf-label" style={labelSty}>
                Nome do Consultor
                <input type="text" value={form.consultant_name} onChange={(e) => setForm((f) => ({ ...f, consultant_name: e.target.value }))} disabled={!editMode} style={inputStyle} />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Contract attachments section — supports multiple files */}
      <div className="pf-section-card">
        <div className="pf-section-title"><span className="pf-icon">📎</span> Anexos do Contrato</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {/* List existing attachments */}
          {contractAttachments.length > 0 ? (
            contractAttachments.map((att, idx) => (
              <AttachmentItem
                key={att.id}
                att={att}
                editMode={editMode}
                onRemove={editMode ? () => setContractAttachments((prev) => prev.filter((_, i) => i !== idx)) : undefined}
              />
            ))
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
              Nenhum anexo adicionado.
            </div>
          )}
          {/* Add new attachments in edit mode */}
          {editMode && (
            <label style={{ cursor: 'pointer', marginTop: 4 }}>
              <span style={{ fontSize: 13, color: '#3b82f6' }}>➕ Adicionar anexo</span>
              <input
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg,image/jpg,image/webp,.docx,.doc,.xlsx,.xls"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? [])
                  if (files.length === 0) return
                  const newAtts: ContractAttachment[] = files.map((file) => ({
                    id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                      ? crypto.randomUUID()
                      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    fileName: file.name,
                    mimeType: file.type || null,
                    sizeBytes: file.size,
                    url: null,
                    storageKey: null,
                    uploadedAt: new Date().toISOString(),
                  }))
                  setContractAttachments((prev) => [...prev, ...newAtts])
                  e.target.value = ''
                }}
                style={{ display: 'none' }}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', marginTop: 2 }}>
                PDF, imagem, Word, Excel — múltiplos arquivos permitidos
              </div>
            </label>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="pf-section-card">
        <label className="pf-label" style={labelSty}>
          Observações
          <textarea value={form.contract_notes} onChange={(e) => setForm((f) => ({ ...f, contract_notes: e.target.value }))} rows={3} disabled={!editMode} style={{ ...inputStyle, resize: 'vertical' }} />
        </label>
      </div>

      {saveError && <p style={{ color: '#ef4444', fontSize: 12 }}>{saveError}</p>}
      <div className="pf-footer-actions">
        {!editMode && (
          <button type="button" onClick={() => setShowEditPrompt(true)}
            className="pf-btn pf-btn-edit">
            ✏️ Editar
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => setShowSavePrompt(true)} disabled={saving}
            className="pf-btn pf-btn-save">
            {saving ? 'Salvando…' : '💾 Salvar Alterações'}
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => { setEditMode(false); resetForm() }}
            className="pf-btn pf-btn-cancel">
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

  // Personnel lists loaded from the API
  const [engineers, setEngineers] = useState<Engineer[]>([])
  const [installers, setInstallers] = useState<Installer[]>([])

  useEffect(() => {
    void fetchEngineers(true).then(setEngineers).catch(() => { /* graceful — use text field */ })
    void fetchInstallers(true).then(setInstallers).catch(() => { /* graceful */ })
  }, [])

  const [form, setForm] = useState({
    project_status: client.project_status ?? 'pending',
    installation_status: client.installation_status ?? '',
    engineering_status: client.engineering_status ?? DEFAULT_ENGINEERING_STATUS,
    homologation_status: client.homologation_status ?? '',
    commissioning_status: client.commissioning_status ?? '',
    commissioning_date: client.commissioning_date?.slice(0, 10) ?? '',
    integrator_name: client.integrator_name ?? DEFAULT_INTEGRATOR,
    engineer_name: client.engineer_name ?? DEFAULT_ENGINEER,
    engineer_id: client.engineer_id ?? null,
    installer_id: client.installer_id ?? null,
    art_number: client.art_number ?? '',
    art_issued_at: client.art_issued_at?.slice(0, 10) ?? '',
    art_status: client.art_status ?? '',
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
    engineer_id: client.engineer_id ?? null,
    installer_id: client.installer_id ?? null,
    art_number: client.art_number ?? '',
    art_issued_at: client.art_issued_at?.slice(0, 10) ?? '',
    art_status: client.art_status ?? '',
    project_notes: client.project_notes ?? '',
  })

  async function handleSave() {
    // ART requires engineer
    if (form.art_number.trim() && !form.engineer_id) {
      setSaveError('Não é possível salvar ART sem selecionar um engenheiro.')
      return
    }
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
        engineer_id: form.engineer_id ?? null,
        installer_id: form.installer_id ?? null,
        art_number: form.art_number.trim() || null,
        art_issued_at: form.art_issued_at || null,
        art_status: form.art_status || null,
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
        engineer_id: form.engineer_id ?? null,
        installer_id: form.installer_id ?? null,
        art_number: form.art_number.trim() || null,
        art_issued_at: form.art_issued_at || null,
        art_status: form.art_status || null,
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
    display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' as const,
  }

  return (
    <div className="pf-section-card">
      <div className="pf-section-title"><span className="pf-icon">🔧</span> Status do Projeto</div>
      <div style={{ display: 'grid', gap: 10 }}>
        {/* 1. Installation + Engineering */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="pf-label">
            Status Instalação
            <select value={form.installation_status} onChange={(e) => setForm((f) => ({ ...f, installation_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="">Selecione…</option>
              <option value="Aguardando Agendamento">Aguardando Agendamento</option>
              <option value="Agendado">Agendado</option>
              <option value="Em Andamento">Em Andamento</option>
              <option value="Concluído">Concluído</option>
            </select>
          </label>
          <label className="pf-label">
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="pf-label">
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
          <label className="pf-label">
            Status Comissionamento
            <select value={form.commissioning_status} onChange={(e) => setForm((f) => ({ ...f, commissioning_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="">Selecione…</option>
              <option value="Pendente">Pendente</option>
              <option value="Em execução">Em execução</option>
              <option value="Concluído">Concluído</option>
            </select>
          </label>
        </div>
        {/* 3. Integrator + Engineer (entity dropdown) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="pf-label">
            Integrador
            <select value={form.integrator_name} onChange={(e) => setForm((f) => ({ ...f, integrator_name: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="">Selecione…</option>
              <option value="Solarinvest">Solarinvest</option>
            </select>
          </label>
          <label className="pf-label">
            Engenheiro
            <select
              value={form.engineer_id != null ? String(form.engineer_id) : ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null
                const eng = engineers.find((en) => en.id === val)
                setForm((f) => ({ ...f, engineer_id: val, engineer_name: eng ? eng.full_name : f.engineer_name }))
              }}
              disabled={!editMode}
              style={inputStyle}
            >
              <option value="">Selecione…</option>
              {engineers.map((eng) => (
                <option key={eng.id} value={String(eng.id)}>{eng.full_name}</option>
              ))}
              {/* Show currently linked engineer even if not in active list */}
              {form.engineer_id != null && !engineers.find((e) => e.id === form.engineer_id) && (
                <option value={String(form.engineer_id)}>{form.engineer_name ?? `Engenheiro #${form.engineer_id}`}</option>
              )}
              {/* Fallback text input indicator */}
              {engineers.length === 0 && form.engineer_name && (
                <option value="">{form.engineer_name}</option>
              )}
            </select>
          </label>
        </div>
        {/* 4. Installer */}
        <label className="pf-label">
          Instalador
          <select
            value={form.installer_id != null ? String(form.installer_id) : ''}
            onChange={(e) => {
              const val = e.target.value ? Number(e.target.value) : null
              setForm((f) => ({ ...f, installer_id: val }))
            }}
            disabled={!editMode}
            style={inputStyle}
          >
            <option value="">Selecione…</option>
            {installers.map((ins) => (
              <option key={ins.id} value={String(ins.id)}>{ins.full_name}</option>
            ))}
            {/* Show currently linked installer even if not in active list */}
            {form.installer_id != null && !installers.find((i) => i.id === form.installer_id) && (
              <option value={String(form.installer_id)}>Instalador #{form.installer_id}</option>
            )}
          </select>
        </label>
        {/* 5. ART fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <label className="pf-label">
            Número da ART
            <input
              type="text"
              value={form.art_number}
              onChange={(e) => setForm((f) => ({ ...f, art_number: e.target.value }))}
              disabled={!editMode}
              placeholder="ex: 0123456"
              style={inputStyle}
            />
          </label>
          <label className="pf-label">
            Data de Emissão da ART
            <input
              type="date"
              value={form.art_issued_at}
              onChange={(e) => setForm((f) => ({ ...f, art_issued_at: e.target.value }))}
              disabled={!editMode}
              style={inputStyle}
            />
          </label>
          <label className="pf-label">
            Status da ART
            <select value={form.art_status} onChange={(e) => setForm((f) => ({ ...f, art_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="">Selecione…</option>
              <option value="pendente">Pendente</option>
              <option value="emitida">Emitida</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </label>
        </div>
        {/* 6. Commissioning date */}
        <label className="pf-label">
          Data de Comissionamento
          <input type="date" value={form.commissioning_date} onChange={(e) => setForm((f) => ({ ...f, commissioning_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
        </label>
        {/* 7. General status */}
        <label className="pf-label">
          Status Geral
          <select value={form.project_status ?? ''} onChange={(e) => setForm((f) => ({ ...f, project_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
            {Object.entries(PROJECT_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        {/* 8. Notes */}
        <label className="pf-label">
          Observações
          <textarea value={form.project_notes} onChange={(e) => setForm((f) => ({ ...f, project_notes: e.target.value }))} rows={3} disabled={!editMode} style={{ ...inputStyle, resize: 'vertical' }} />
        </label>
      </div>
      {saveError && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{saveError}</p>}
      <div className="pf-footer-actions">
        {!editMode && (
          <button type="button" onClick={() => setShowEditPrompt(true)}
            className="pf-btn pf-btn-edit">
            ✏️ Editar
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => setShowSavePrompt(true)} disabled={saving}
            className="pf-btn pf-btn-save">
            {saving ? 'Salvando…' : '💾 Salvar Alterações'}
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => { setEditMode(false); resetForm() }}
            className="pf-btn pf-btn-cancel">
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

  // Build the confirmed-payments map from an installments array.
  // Handles both 'confirmado' (canonical) and 'pago' (legacy alias) statuses.
  const buildConfirmedMap = (installments: typeof client.installments_json) => {
    const map: Record<number, { receipt_number: string | null; paid_at: string }> = {}
    if (installments) {
      for (const p of installments) {
        if (p.status === 'confirmado' || p.status === 'pago') {
          map[p.number] = { receipt_number: p.receipt_number ?? null, paid_at: p.paid_at ?? '' }
        }
      }
    }
    return map
  }

  // Local confirmed-payments map for instant UI feedback before full reload.
  // Seeded from client.installments_json on mount (now populated by normalizer).
  const [confirmedPayments, setConfirmedPayments] = useState<Record<number, { receipt_number: string | null; paid_at: string }>>(() =>
    buildConfirmedMap(client.installments_json),
  )

  // Keep confirmedPayments in sync when client.installments_json is updated
  // by the parent (e.g. after onSaved merges the server response).
  useEffect(() => {
    setConfirmedPayments(buildConfirmedMap(client.installments_json))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.installments_json])
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
    display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' as const,
  }
  const labelSty: React.CSSProperties = {}
  const gridSty: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  const pendingNotifCount = notifications.filter((n) => n.status === 'pending').length

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Billing profile */}
      <div className="pf-section-card">
        <div className="pf-section-title"><span className="pf-icon">💰</span> Perfil de Cobrança</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={gridSty}>
            <label className="pf-label" style={labelSty}>
              Dia de Vencimento
              <select value={form.due_day} onChange={(e) => setForm((f) => ({ ...f, due_day: e.target.value }))} disabled={!editMode} style={inputStyle}>
                <option value="">Selecione…</option>
                {DUE_DAY_OPTIONS.map((d) => (
                  <option key={d} value={String(d)}>Dia {d}</option>
                ))}
              </select>
            </label>
            <label className="pf-label" style={labelSty}>
              Dia de Leitura
              <input type="number" min={1} max={31} value={form.reading_day} onChange={(e) => setForm((f) => ({ ...f, reading_day: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridSty}>
            <label className="pf-label" style={labelSty}>
              Data de Comissionamento
              <input type="date" value={form.commissioning_date_billing} onChange={(e) => setForm((f) => ({ ...f, commissioning_date_billing: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label className="pf-label" style={labelSty}>
              Valor da Mensalidade (R$)
              <input type="number" min={0} step="0.01" value={form.valor_mensalidade} onChange={(e) => setForm((f) => ({ ...f, valor_mensalidade: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <label className="pf-label" style={labelSty}>
            Primeiro Vencimento
            <input type="date" value={form.first_billing_date} onChange={(e) => setForm((f) => ({ ...f, first_billing_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <div style={gridSty}>
            <label className="pf-label" style={labelSty}>
              Recorrência
              <select value={form.recurrence_type} onChange={(e) => setForm((f) => ({ ...f, recurrence_type: e.target.value }))} disabled={!editMode} style={inputStyle}>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="annual">Anual</option>
                <option value="custom">Personalizado</option>
              </select>
            </label>
            <label className="pf-label" style={labelSty}>
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
          <label className="pf-label" style={labelSty}>
            Último Vencimento Previsto
            <input type="date" value={form.expected_last_billing_date} onChange={(e) => setForm((f) => ({ ...f, expected_last_billing_date: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
          <label className="pf-checkbox-label">
            <input type="checkbox" checked={form.auto_reminder_enabled} onChange={(e) => setForm((f) => ({ ...f, auto_reminder_enabled: e.target.checked }))} disabled={!editMode} style={{ width: 14, height: 14, accentColor: '#8b5cf6' }} />
            Lembrete automático ativado
          </label>
        </div>
      </div>

      {/* Engine result */}
      {engineResult && engineResult.status_calculo !== 'erro_entrada' && (
        <div className="pf-section-card">
          <div className="pf-section-title"><span className="pf-icon">📊</span> Cálculo de Vencimento</div>
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="pf-info-row">
              <span className="pf-info-label">Início da Mensalidade:</span>
              <span className="pf-info-value">{engineResult.inicio_da_mensalidade.toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="pf-info-row">
              <span className="pf-info-label">Início Mensalidade Fixa:</span>
              <span className="pf-info-value">{engineResult.inicio_mensalidade_fixa.toLocaleDateString('pt-BR')}</span>
            </div>
            <div className="pf-info-row">
              <span className="pf-info-label">Status:</span>
              <span style={{
                fontWeight: 600,
                color: engineResult.status_calculo === 'ok' ? '#4ade80' : '#fbbf24',
              }}>
                {engineResult.status_calculo === 'ok' ? '✅ Calculado' : '⏳ Aguardando Comissionamento'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
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
            <div className="pf-section-card">
              <div className="pf-section-title"><span className="pf-icon">📋</span> Parcelas</div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Configure a <strong>Data de Início da Cobrança</strong> ou a <strong>Data de Comissionamento</strong> para visualizar as parcelas.
              </p>
            </div>
          )
        }
        if (installments.length === 0) return null
        return (
          <div className="pf-section-card">
            <div className="pf-section-title">
              <span className="pf-icon">📋</span> Parcelas ({installments.length})
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Vencimento</th>
                    <th className="right">Valor</th>
                    <th className="center">Status</th>
                    <th>Registro</th>
                    <th>Pago em</th>
                    <th className="center">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {installments.map((inst) => {
                    const confirmed = confirmedPayments[inst.numero]
                    const isConfirmed = !!confirmed
                    return (
                      <tr key={inst.numero}>
                        <td>{inst.numero}</td>
                        <td>{inst.data_vencimento.toLocaleDateString('pt-BR')}</td>
                        <td className="right">
                          {inst.valor > 0 ? `R$ ${inst.valor.toFixed(2).replace('.', ',')}` : '—'}
                        </td>
                        <td className="center">
                          {isConfirmed
                            ? <span className="pf-status-confirmed">✅ Confirmado</span>
                            : <span className="pf-status-pending">⏳ Pendente</span>
                          }
                        </td>
                        <td className="mono" style={{ color: isConfirmed ? 'var(--text-base)' : 'var(--text-muted)' }}>
                          {confirmed?.receipt_number ? confirmed.receipt_number : '—'}
                        </td>
                        <td style={{ color: isConfirmed ? 'var(--text-base)' : 'var(--text-muted)' }}>
                          {confirmed?.paid_at
                            ? new Date(confirmed.paid_at).toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                        <td className="center">
                          {editMode && !isConfirmed && (
                            <button
                              type="button"
                              onClick={() => {
                                setProofError(null)
                                setPaymentProof({ receipt_number: '', transaction_number: '' })
                                setPaymentModal({ installmentNumber: inst.numero, valor: inst.valor, vencimento: inst.data_vencimento.toISOString() })
                              }}
                              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid #4ade80', background: 'rgba(74,222,128,0.1)', color: '#4ade80', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                            >
                              Pagar
                            </button>
                          )}
                          {isConfirmed && (
                            <span style={{ fontSize: 13, color: '#4ade80' }}>✓</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* Payment proof modal */}
      {paymentModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface, #122040)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 420, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: 'var(--text-strong)' }}>
              💳 Registrar Pagamento — Parcela #{paymentModal.installmentNumber}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
              Valor: R$ {paymentModal.valor.toFixed(2).replace('.', ',')} • Vencimento: {new Date(paymentModal.vencimento).toLocaleDateString('pt-BR')}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <label className="pf-label">
                Nº do Comprovante
                <input
                  type="text"
                  value={paymentProof.receipt_number}
                  onChange={(e) => setPaymentProof((p) => ({ ...p, receipt_number: e.target.value }))}
                  placeholder="Ex: 123456"
                  style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                />
              </label>
              <label className="pf-label">
                Nº da Transação Bancária
                <input
                  type="text"
                  value={paymentProof.transaction_number}
                  onChange={(e) => setPaymentProof((p) => ({ ...p, transaction_number: e.target.value }))}
                  placeholder="Ex: TXN-789"
                  style={{ display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
                />
              </label>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
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
                  // Persist via billing patch with installment_payment payload.
                  // The server returns the full updated installments_json array,
                  // which we pass to onSaved so handleTabSaved can merge it into
                  // localClient before the tab remounts — preventing the flash
                  // where the confirmed payment appears to revert.
                  void patchPortfolioBilling(client.id, {
                    installment_payment: {
                      number: paymentModal.installmentNumber,
                      status: 'confirmado',
                      paid_at: paidAt,
                      receipt_number: receiptNum,
                      transaction_number: paymentProof.transaction_number.trim() || null,
                    },
                  }).then((updatedInstallments) => {
                    // Instant UI update via local state
                    setConfirmedPayments((prev) => ({
                      ...prev,
                      [paymentModal.installmentNumber]: { receipt_number: receiptNum, paid_at: paidAt },
                    }))
                    setPaymentModal(null)
                    // Merge the authoritative installments_json from the server
                    // into the parent localClient so remount reads the new value
                    onSaved(updatedInstallments != null ? { installments_json: updatedInstallments } : {})
                  }).catch((err: unknown) => {
                    setProofError(err instanceof Error ? err.message : 'Erro ao registrar pagamento.')
                  })
                }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#4ade80,#16a34a)', color: '#0b1526', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
              >
                ✅ Confirmar Pagamento
              </button>
              <button
                type="button"
                onClick={() => { setPaymentModal(null); setProofError(null) }}
                className="pf-btn pf-btn-cancel"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification preview */}
      {pendingNotifCount > 0 && (
        <div className="pf-section-card">
          <div className="pf-section-title">
            <span className="pf-icon">🔔</span> Notificações Pendentes ({pendingNotifCount})
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {notifications.slice(0, 6).map((notif) => (
              <div key={notif.id} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 5, background: 'rgba(245,158,11,0.06)', borderLeft: '2px solid var(--accent)' }}>
                <span style={{ fontWeight: 600 }}>{notif.channel === 'email' ? '✉️' : '📱'}</span>{' '}
                <span style={{ color: 'var(--text-muted)' }}>Parcela #{notif.installmentNumber}</span>{' '}
                — {BILLING_ALERT_LABELS[notif.level]}
              </div>
            ))}
            {pendingNotifCount > 6 && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                + {pendingNotifCount - 6} notificações
              </p>
            )}
          </div>
        </div>
      )}

      {saveError && <p style={{ color: '#ef4444', fontSize: 12 }}>{saveError}</p>}
      <div className="pf-footer-actions">
        {!editMode && (
          <button type="button" onClick={() => setShowEditPrompt(true)}
            className="pf-btn pf-btn-edit">
            ✏️ Editar
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => setShowSavePrompt(true)} disabled={saving}
            className="pf-btn pf-btn-save">
            {saving ? 'Salvando…' : '💾 Salvar Alterações'}
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => { setEditMode(false); resetForm() }}
            className="pf-btn pf-btn-cancel">
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
      <div className="pf-footer-actions">
        {!editMode && (
          <button type="button" onClick={() => setShowEditPrompt(true)}
            className="pf-btn pf-btn-edit">
            ✏️ Editar
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => setShowSavePrompt(true)} disabled={saving}
            className="pf-btn pf-btn-save">
            {saving ? 'Salvando…' : '💾 Salvar Alterações'}
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => { setEditMode(false); resetUfData() }}
            className="pf-btn pf-btn-cancel">
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
    display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' as const,
  }
  const labelSty: React.CSSProperties = {}
  const gridSty: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="pf-section-card">
        <div className="pf-section-title"><span className="pf-icon">📋</span> Plano Leasing</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label className="pf-label" style={labelSty}>
            Modalidade
            <select value={form.modalidade} onChange={(e) => setForm((f) => ({ ...f, modalidade: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="leasing">Leasing</option>
              <option value="assinatura">Assinatura</option>
              <option value="consorcio">Consórcio</option>
            </select>
          </label>
          <div style={gridSty}>
            <label className="pf-label" style={labelSty}>
              kWh/mês Contratado
              <input type="number" min={0} value={form.kwh_mes_contratado} onChange={(e) => setForm((f) => ({ ...f, kwh_mes_contratado: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label className="pf-label" style={labelSty}>
              Desconto (%)
              <input type="number" min={0} max={100} step="0.1" value={form.desconto_percentual} onChange={(e) => setForm((f) => ({ ...f, desconto_percentual: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridSty}>
            <label className="pf-label" style={labelSty}>
              Tarifa Atual (R$/kWh)
              <input type="number" min={0} step="0.0001" value={form.tarifa_atual} onChange={(e) => setForm((f) => ({ ...f, tarifa_atual: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label className="pf-label" style={labelSty}>
              Mensalidade (R$)
              <input type="number" min={0} step="0.01" value={form.mensalidade} onChange={(e) => setForm((f) => ({ ...f, mensalidade: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridSty}>
            <label className="pf-label" style={labelSty}>
              Prazo (meses)
              <input type="number" min={0} value={form.prazo_meses} onChange={(e) => setForm((f) => ({ ...f, prazo_meses: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            <label className="pf-label" style={labelSty}>
              Potência (kWp)
              <input type="number" min={0} step="0.01" value={form.potencia_kwp} onChange={(e) => setForm((f) => ({ ...f, potencia_kwp: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <div style={gridSty}>
            <label className="pf-label" style={labelSty}>
              Tipo de Rede
              <select value={form.tipo_rede} onChange={(e) => setForm((f) => ({ ...f, tipo_rede: e.target.value }))} disabled={!editMode} style={inputStyle}>
                <option value="">Selecione…</option>
                <option value="monofasico">Monofásico</option>
                <option value="bifasico">Bifásico</option>
                <option value="trifasico">Trifásico</option>
              </select>
            </label>
            <label className="pf-label" style={labelSty}>
              Marca Inversor
              <input type="text" value={form.marca_inversor} onChange={(e) => setForm((f) => ({ ...f, marca_inversor: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
          <label className="pf-label" style={labelSty}>
            Indicação
            <input type="text" value={form.indicacao} onChange={(e) => setForm((f) => ({ ...f, indicacao: e.target.value }))} disabled={!editMode} style={inputStyle} />
          </label>
        </div>
      </div>
      {saveError && <p style={{ color: '#ef4444', fontSize: 12 }}>{saveError}</p>}
      <div className="pf-footer-actions">
        {!editMode && (
          <button type="button" onClick={() => setShowEditPrompt(true)}
            className="pf-btn pf-btn-edit">
            ✏️ Editar
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => setShowSavePrompt(true)} disabled={saving}
            className="pf-btn pf-btn-save">
            {saving ? 'Salvando…' : '💾 Salvar Alterações'}
          </button>
        )}
        {editMode && (
          <button type="button" onClick={() => { setEditMode(false); resetForm() }}
            className="pf-btn pf-btn-cancel">
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
    width: '100%', boxSizing: 'border-box' as const,
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
            style={{ padding: '0 16px', borderRadius: 7, border: 'none', background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#0b1526', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end', height: 40 }}>
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
            <div key={note.id} className="pf-section-card" style={{ borderLeft: '3px solid var(--accent)', marginBottom: 0 }}>
              {note.title && (
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: 'var(--accent)' }}>{note.title}</div>
              )}
              <div style={{ fontSize: 13, color: 'var(--text-base)', lineHeight: 1.5 }}>{note.content}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
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
// Add Client Modal
// ─────────────────────────────────────────────────────────────────────────────
function AddClientModal({
  onClose,
  onCreated,
  onToast,
}: {
  onClose: () => void
  onCreated: () => void
  onToast: (msg: string, type: 'success' | 'error') => void
}) {
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<ClientFormErrors>({})
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [form, setForm] = useState<AddClientFormData>({
    name: '',
    document: '',
    phone: '',
    email: '',
    cep: '',
    city: '',
    state: '',
    address: '',
    distribuidora: '',
    uc: '',
    consumption_kwh_month: '',
    term_months: '',
  })

  const set = (field: keyof AddClientFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setGlobalError(null)
  }

  async function handleSave() {
    const errs = validateClientForm(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      setGlobalError('Preencha corretamente todos os campos obrigatórios antes de salvar.')
      return
    }
    setSaving(true)
    setGlobalError(null)
    try {
      const phoneVal = form.phone.trim()
      const emailVal = form.email.trim()
      const cepVal = form.cep.trim()
      const cityVal = form.city.trim()
      const stateVal = form.state.trim()
      const addressVal = form.address.trim()
      const distribuidoraVal = form.distribuidora.trim()
      const ucVal = form.uc.trim()
      const created = await upsertClientByDocument({
        name: form.name.trim(),
        document: form.document.trim(),
        ...(phoneVal && { phone: phoneVal }),
        ...(emailVal && { email: emailVal }),
        ...(cepVal && { cep: cepVal }),
        ...(cityVal && { city: cityVal }),
        ...(stateVal && { state: stateVal }),
        ...(addressVal && { address: addressVal }),
        ...(distribuidoraVal && { distribuidora: distribuidoraVal }),
        ...(ucVal && { uc: ucVal }),
        consumption_kwh_month: form.consumption_kwh_month ? Number(form.consumption_kwh_month) : null,
        term_months: form.term_months ? Number(form.term_months) : null,
      })
      const clientId = Number(created.id)
      console.log('[clients][create] success', { clientId, name: form.name })
      await exportClientToPortfolio(clientId)
      onToast('Cliente adicionado à carteira com sucesso.', 'success')
      onCreated()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar cliente.'
      console.error('[clients][create] error', msg)
      setGlobalError(msg)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 10 }
  const errStyle: React.CSSProperties = { color: '#ef4444', fontSize: 11, marginTop: 2 }
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '24px 16px', overflowY: 'auto',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: 'var(--surface, #1e293b)',
          border: '1px solid var(--border, #334155)',
          borderRadius: 14,
          padding: '28px 28px 24px',
          width: '100%',
          maxWidth: 640,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>➕ Adicionar Cliente</h2>
          <button type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted, #94a3b8)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>
            ×
          </button>
        </div>

        <div className="pf-section-card" style={{ marginBottom: 14 }}>
          <div className="pf-section-title"><span className="pf-icon">📇</span> Identificação</div>
          <label className="pf-label" style={labelStyle}>
            Nome / Razão Social *
            <input type="text" value={form.name} onChange={set('name')} placeholder="Nome completo ou Razão Social" style={{ ...inputStyle, borderColor: errors.name ? '#ef4444' : undefined }} />
            {errors.name && <span style={errStyle}>{errors.name}</span>}
          </label>
          <label className="pf-label" style={labelStyle}>
            CPF / CNPJ *
            <input type="text" value={form.document} onChange={set('document')} placeholder="000.000.000-00 ou 00.000.000/0000-00" style={{ ...inputStyle, borderColor: errors.document ? '#ef4444' : undefined }} />
            {errors.document && <span style={errStyle}>{errors.document}</span>}
          </label>
          <div style={gridStyle}>
            <label className="pf-label" style={labelStyle}>
              Telefone
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="(XX) 9XXXX-XXXX" style={{ ...inputStyle, borderColor: errors.phone ? '#ef4444' : undefined }} />
              {errors.phone && <span style={errStyle}>{errors.phone}</span>}
            </label>
            <label className="pf-label" style={labelStyle}>
              E-mail
              <input type="email" value={form.email} onChange={set('email')} placeholder="email@exemplo.com" style={{ ...inputStyle, borderColor: errors.email ? '#ef4444' : undefined }} />
              {errors.email && <span style={errStyle}>{errors.email}</span>}
            </label>
          </div>
          <div style={gridStyle}>
            <label className="pf-label" style={labelStyle}>
              CEP
              <input type="text" value={form.cep} onChange={set('cep')} placeholder="XXXXX-XXX" maxLength={9} style={{ ...inputStyle, borderColor: errors.cep ? '#ef4444' : undefined }} />
              {errors.cep && <span style={errStyle}>{errors.cep}</span>}
            </label>
            <label className="pf-label" style={labelStyle}>
              Estado (UF)
              <input type="text" value={form.state} onChange={(e) => { setForm((f) => ({ ...f, state: e.target.value.toUpperCase() })) }} placeholder="SP" maxLength={2} style={inputStyle} />
            </label>
          </div>
          <div style={gridStyle}>
            <label className="pf-label" style={labelStyle}>
              Cidade
              <input type="text" value={form.city} onChange={set('city')} placeholder="Cidade" style={inputStyle} />
            </label>
            <label className="pf-label" style={labelStyle}>
              Endereço
              <input type="text" value={form.address} onChange={set('address')} placeholder="Rua, número, bairro" style={inputStyle} />
            </label>
          </div>
        </div>

        <div className="pf-section-card" style={{ marginBottom: 14 }}>
          <div className="pf-section-title"><span className="pf-icon">⚡</span> Energia</div>
          <label className="pf-label" style={labelStyle}>
            Distribuidora
            <input type="text" value={form.distribuidora} onChange={set('distribuidora')} placeholder="Ex: ENEL, CEMIG, CPFL…" style={inputStyle} />
          </label>
          <label className="pf-label" style={labelStyle}>
            UC Geradora
            <input type="text" value={form.uc} onChange={set('uc')} placeholder="000000000000000 (15 dígitos)" style={{ ...inputStyle, borderColor: errors.uc ? '#ef4444' : undefined }} />
            {errors.uc && <span style={errStyle}>{errors.uc}</span>}
          </label>
          <div style={gridStyle}>
            <label className="pf-label" style={labelStyle}>
              Consumo (kWh/mês)
              <input type="number" value={form.consumption_kwh_month} onChange={set('consumption_kwh_month')} placeholder="0" min={0} style={inputStyle} />
            </label>
            <label className="pf-label" style={labelStyle}>
              Prazo Contratual (meses)
              <input type="number" value={form.term_months} onChange={set('term_months')} placeholder="0" min={1} style={inputStyle} />
            </label>
          </div>
        </div>

        {globalError && (
          <div style={{
            padding: '10px 14px', borderRadius: 7, background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
            fontSize: 13, marginBottom: 14,
          }}>
            {globalError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={saving}
            style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            style={{
              padding: '9px 22px', borderRadius: 7, border: 'none',
              background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff',
              fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14,
              opacity: saving ? 0.7 : 1,
            }}>
            {saving ? 'Salvando…' : '💾 Salvar Cliente'}
          </button>
        </div>
      </div>
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
    console.log('[clients][delete] initiated', { clientId })
    const ok = await deleteClient(clientId)
    if (ok) {
      console.log('[clients][delete] success', { clientId })
      onToast('Cliente excluído com sucesso.', 'success')
      onDeleted(clientId)
    } else {
      console.error('[clients][delete] error', { clientId })
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
      <div className="pf-detail-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div>
            <div className="pf-detail-name">{displayClient.name ?? '—'}</div>
            <div className="pf-detail-meta">
              {[displayClient.city, displayClient.state].filter(Boolean).join(' / ')} · Exportado {formatDate(displayClient.exported_to_portfolio_at)}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar painel"
            style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.2)', color: '#94a3b8', fontSize: 16, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* Action buttons */}
        <div className="pf-action-bar">
          <button
            type="button"
            onClick={() => setViewMode('expanded')}
            className="pf-action-fullscreen"
          >
            ↗️ Tela Cheia
          </button>
          <button
            type="button"
            onClick={() => setConfirmRemove(true)}
            disabled={removing}
            className="pf-action-remove"
          >
            {removing ? 'Removendo…' : '📤 Remover da Carteira'}
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deleting}
            className="pf-action-delete"
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
  const { deleting, deleteClient } = usePortfolioDelete()
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [showAddClient, setShowAddClient] = useState(false)

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

  const handleInlineDelete = useCallback(async (clientId: number) => {
    setConfirmDeleteId(null)
    console.log('[clients][delete] initiated', { clientId })
    const ok = await deleteClient(clientId)
    if (ok) {
      console.log('[clients][delete] success', { clientId })
      removeClient(clientId)
      if (selectedClientId === clientId) setSelectedClientId(null)
      onClientRemovedFromPortfolio?.()
      showToast('Cliente excluído com sucesso.', 'success')
    } else {
      console.error('[clients][delete] error', { clientId })
      showToast('Não foi possível excluir o cliente.', 'error')
    }
  }, [deleteClient, removeClient, selectedClientId, onClientRemovedFromPortfolio, showToast])

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

  const confirmDeleteClient = clients.find((c) => c.id === confirmDeleteId)

  return (
    <div
      className="budget-search-page portfolio-page"
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
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowAddClient(true)}
              className="pf-btn-add-client"
            >
              ➕ Adicionar Cliente
            </button>
            <button
              type="button"
              onClick={reload}
              title="Atualizar lista"
              className="pf-btn-toolbar"
            >
              🔄
            </button>
            <button
              type="button"
              onClick={onBack}
              className="pf-btn-toolbar"
            >
              ← Voltar
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', maxWidth: 480, marginTop: 4 }}>
          <input
            type="search"
            placeholder="Buscar por nome, e-mail, documento, cidade, UC…"
            value={searchInput}
            onChange={handleSearch}
            className="pf-search-input"
          />
          {searchInput && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Limpar busca"
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--text-muted, #6B8BB5)',
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
            flex: selectedClientId ? '0 0 40%' : '1 1 100%',
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
                    Nenhum cliente na carteira ainda.
                    <br />
                    Clique em <strong>➕ Adicionar Cliente</strong> para começar.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddClient(true)}
                    style={{
                      marginTop: 14, padding: '9px 20px', borderRadius: 7, border: 'none',
                      background: 'linear-gradient(135deg,#22c55e,#16a34a)', color: '#fff',
                      fontWeight: 700, cursor: 'pointer', fontSize: 14,
                    }}
                  >
                    ➕ Adicionar Cliente
                  </button>
                </>
              )}
            </div>
          )}
          {!isLoading && !error && hasClients && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {clients.map((c) => (
                <ClientCard
                  key={c.id}
                  client={c}
                  onEdit={() => setSelectedClientId(c.id)}
                  onDelete={() => setConfirmDeleteId(c.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        {selectedClientId && (
          <div
            style={{
              flex: '0 0 60%',
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

      {/* Inline delete confirmation */}
      {confirmDeleteId !== null && confirmDeleteClient && (
        <ConfirmDialog
          title="Excluir Cliente"
          message={`Tem certeza que deseja excluir o cliente "${confirmDeleteClient.name ?? confirmDeleteId}"?\nEsta ação não pode ser desfeita.`}
          confirmLabel={deleting ? 'Excluindo…' : 'Confirmar exclusão'}
          confirmColor="#ef4444"
          onConfirm={() => void handleInlineDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      {/* Add client modal */}
      {showAddClient && (
        <AddClientModal
          onClose={() => setShowAddClient(false)}
          onCreated={() => { reload(); onClientRemovedFromPortfolio?.() }}
          onToast={showToast}
        />
      )}

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
