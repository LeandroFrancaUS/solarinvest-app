// src/pages/ClientPortfolioPage.tsx
// "Carteira de Clientes" — professional operational management hub.
// Access: admin | office | financeiro only.

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import '../styles/portfolio.css'
import { useStackRbac } from '../lib/auth/rbac'
import {
  useClientPortfolio,
  usePortfolioClient,
  usePortfolioRemove,
  usePortfolioDelete,
} from '../hooks/useClientPortfolio'
import type { PortfolioClientRow, ContractAttachment, InstallmentPayment } from '../types/clientPortfolio'
import { DUE_DAY_OPTIONS } from '../types/clientPortfolio'
import {
  buildProjetoForm,
  buildProjetoSavePayload,
  validateProjetoSave,
  PROJECT_STATUS_LABELS,
  INSTALLATION_STATUS_OPTIONS,
  ENGINEERING_STATUS_OPTIONS,
  HOMOLOGATION_STATUS_OPTIONS,
  COMMISSIONING_STATUS_OPTIONS,
  ART_STATUS_OPTIONS,
} from '../shared/projects/portfolioProjectOps'
import type { ProjetoFormData } from '../shared/projects/portfolioProjectOps'
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
import { patchProjectPvData, fetchProjectByClientId, createProjectFromContract } from '../services/projectsApi'
import { upsertClientByDocument } from '../lib/api/clientsApi'
import {
  isValidCpfOrCnpj,
  isValidBrazilPhone,
  isValidEmail,
  isValidCep,
  isValidUc,
} from '../lib/validation/clientReadiness'
import { formatCurrencyBRL } from '../utils/formatters'
import { formatNumberBR, formatMoneyBR } from '../lib/locale/br-number'
import { getDistribuidorasFallback } from '../utils/distribuidorasAneel'
import { lookupCep } from '../shared/cepLookup'
import { ClientPortfolioEditorShell, type ViewMode } from '../components/portfolio/ClientPortfolioEditorShell'
import { UfConfigurationFields, type UfConfigData } from '../components/portfolio/UfConfigurationFields'
import { FaturasTab } from '../components/portfolio/FaturasTab'
import { calculateBillingDates, generateInstallments, getBillingAlert, BILLING_ALERT_LABELS, MAX_DASHBOARD_ALERTS } from '../domain/billing/monthlyEngine'
import { calculateBillingDates as calculateBillingDatesV2, addMonthsSafe as addMonthsSafeV2 } from '../domain/billing/billingDates'
import { calculateMensalidade } from '../domain/billing/mensalidadeEngine'
import { generateNotificationsForClient } from '../domain/billing/BillingNotificationService'
import { BillingAlertsWidget, type BillingAlertItem } from '../components/portfolio/BillingAlertsWidget'
import { getClientPaymentStatusV2, type ClientPaymentStatusV2 } from '../domain/payments/clientPaymentStatusV2'
import type { Consultant, Engineer, Installer } from '../types/personnel'
import { fetchConsultants, fetchEngineers, fetchInstallers, consultorDisplayName, formatConsultantOptionLabel } from '../services/personnelApi'
import { ImportarContratoButton } from '../components/carteira/contrato/ImportarContratoButton'
import { ImportarContratoDialog } from '../components/carteira/contrato/ImportarContratoDialog'
import { ProposalOriginField } from '../components/carteira/contrato/ProposalOriginField'
import { ProposalOriginSearchDialog } from '../components/carteira/contrato/ProposalOriginSearchDialog'
import { createProposalOriginLink, validateProposalOriginLink } from '../lib/proposals/proposalOriginLink'
import { findSavedProposalByExactCode, getSavedProposalRecord, openSavedProposalPreview } from '../services/proposalRecordsService'
import { formatCpfCnpj } from '../lib/format/document'

interface Props {
  onBack: () => void
  /** Called after a client is successfully removed from the portfolio or deleted,
   *  so the main clients list can refresh its in_portfolio status. */
  onClientRemovedFromPortfolio?: () => void
  /** Called when the user wants to navigate to a specific project in Gestão Financeira. */
  onOpenFinancialProject?: (projectId: string) => void
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

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getBeneficiaryUCs(client: { uc_beneficiaria?: unknown; uc_beneficiarias?: unknown }): string[] {
  if (Array.isArray(client.uc_beneficiarias)) {
    return client.uc_beneficiarias
      .map((item) => toTrimmedString(item))
      .filter((item): item is string => item != null)
  }
  const single = toTrimmedString(client.uc_beneficiaria)
  return single ? [single] : []
}

function sanitizeBeneficiaryUCs(values: string[]): string[] {
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

/**
 * Calculates the next due date for a client based on unpaid installments.
 * Returns the due date of the earliest unpaid installment, or null if unable to calculate.
 */
function getNextDueDate(client: PortfolioClientRow): Date | null {
  const installments = client.installments_json ?? []
  if (installments.length === 0) return null

  const dueDay = client.due_day
  if (!dueDay || dueDay < 1 || dueDay > 31) return null

  const startDate = client.first_billing_date ?? client.inicio_da_mensalidade ?? client.commissioning_date_billing
  if (!startDate) return null

  const start = new Date(startDate)
  if (isNaN(start.getTime())) return null

  let nextDue: Date | null = null

  for (const inst of installments) {
    // Skip paid installments
    if (inst.status === 'pago' || inst.status === 'confirmado') {
      continue
    }

    // Calculate due date for this installment
    const month = start.getMonth() + (inst.number - 1)
    const year = start.getFullYear() + Math.floor(month / 12)
    const monthNormalized = ((month % 12) + 12) % 12

    // Clamp day to valid range for the month
    const lastDay = new Date(year, monthNormalized + 1, 0).getDate()
    const day = Math.min(dueDay, lastDay)

    const dueDate = new Date(year, monthNormalized, day)
    dueDate.setHours(0, 0, 0, 0)

    // Track the earliest unpaid due date
    if (!nextDue || dueDate < nextDue) {
      nextDue = dueDate
    }
  }

  return nextDue
}

// ─────────────────────────────────────────────────────────────────────────────
// Brazilian state UF list (used by AddClientModal)
// ─────────────────────────────────────────────────────────────────────────────
const BR_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

// ─────────────────────────────────────────────────────────────────────────────
// Client form validation (used by AddClientModal)
// ─────────────────────────────────────────────────────────────────────────────
interface ClientFormErrors {
  name?: string
  document?: string
  phone?: string
  email?: string
  cep?: string
  city?: string
  state?: string
  address?: string
  distribuidora?: string
  consumption_kwh_month?: string
  term_months?: string
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
  if (!data.phone.trim()) {
    errors.phone = 'Telefone obrigatório'
  } else if (!isValidBrazilPhone(data.phone)) {
    errors.phone = 'Telefone incompleto'
  }
  if (!data.email.trim()) {
    errors.email = 'E-mail obrigatório'
  } else if (!isValidEmail(data.email)) {
    errors.email = 'E-mail inválido'
  }
  if (!data.cep.trim()) {
    errors.cep = 'CEP obrigatório'
  } else if (!isValidCep(data.cep)) {
    errors.cep = 'CEP inválido'
  }
  if (!data.city.trim()) {
    errors.city = 'Cidade obrigatória'
  }
  if (!data.state.trim()) {
    errors.state = 'Estado obrigatório'
  }
  if (!data.address.trim()) {
    errors.address = 'Endereço obrigatório'
  }
  if (!data.distribuidora.trim()) {
    errors.distribuidora = 'Distribuidora obrigatória'
  }
  if (!data.consumption_kwh_month.trim() || Number(data.consumption_kwh_month) <= 0) {
    errors.consumption_kwh_month = 'Consumo mensal obrigatório'
  }
  if (!data.term_months.trim() || Number(data.term_months) <= 0) {
    errors.term_months = 'Prazo contratual obrigatório'
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
    <div className={`pf-toast pf-toast-${type}`}>
      <span>{type === 'success' ? '✅' : '❌'}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="pf-toast-dismiss"
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
  variant?: 'primary' | 'success' | 'danger' | 'warning'
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', variant = 'danger', onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'var(--backdrop, rgba(0,0,0,0.65))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 28,
          maxWidth: 420,
          width: '100%',
        }}
      >
        <h3 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 700, color: 'var(--text-strong)' }}>{title}</h3>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            className="pf-btn pf-btn-cancel"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`pf-confirm-btn pf-confirm-btn-${variant}`}
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
  const shouldOpenPdfInNewTab = Boolean(pdf && att.url)

  function handlePreviewClick() {
    if (!att.url) return
    if (shouldOpenPdfInNewTab) {
      window.open(att.url, '_blank', 'noopener,noreferrer')
      return
    }
    setShowPreview(true)
  }

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
        {sizeLabel && <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{sizeLabel}</span>}
        {previewable && (
          <button type="button" onClick={handlePreviewClick}
            style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
            {shouldOpenPdfInNewTab ? '🔎 Abrir PDF' : '👁️ Visualizar'}
          </button>
        )}
        {att.url && (
          <a href={att.url} download={att.fileName}
            style={{ fontSize: 11, color: 'var(--accent)', textDecoration: 'none', padding: '2px 6px' }}>
            ⬇️ Baixar
          </a>
        )}
        {editMode && onRemove && (
          <button type="button" onClick={onRemove}
            style={{ fontSize: 11, color: 'var(--ds-danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
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
                  style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>⬇️ Baixar</a>
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

/**
 * Resolves installment progress for a portfolio client.
 * Returns { value, current, total } where:
 *   - value = amount for the current installment (BRL)
 *   - current = 1-based installment number representing the current billing position
 *   - total = total number of installments
 *
 * Priority for "current" installment selection:
 *   A) Installment whose due_date/vencimento falls in the current calendar month/year.
 *   B) If no per-installment dates, use the largest-numbered paid/confirmado installment.
 *   C) If none paid, use the smallest-numbered pending installment.
 *   D) Fallback: first installment.
 */
function getInstallmentProgress(client: PortfolioClientRow): {
  value: number | null
  current: number | null
  total: number | null
} {
  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null
    const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? n : null
  }

  // --- 1. Parse installments_json (may be null, array, or JSON string) ---
  let installments: InstallmentPayment[] = []
  if (client.installments_json) {
    if (Array.isArray(client.installments_json)) {
      installments = client.installments_json
    } else if (typeof client.installments_json === 'string') {
      try {
        const parsed = JSON.parse(client.installments_json)
        if (Array.isArray(parsed)) installments = parsed
      } catch {
        // ignore malformed JSON
      }
    }
  }

  const isPaid = (s: string) => s === 'pago' || s === 'confirmado'

  // --- 2. Identify current installment ---
  let chosen: InstallmentPayment | null = null

  if (installments.length > 0) {
    const now = new Date()
    const nowYear = now.getFullYear()
    const nowMonth = now.getMonth() // 0-based

    // A) Match by due_date / vencimento in current month+year
    const matchedByDate = installments.find((i) => {
      const dateStr = i.due_date ?? i.vencimento
      if (!dateStr) return false
      const d = new Date(dateStr)
      return !isNaN(d.getTime()) && d.getFullYear() === nowYear && d.getMonth() === nowMonth
    })
    if (matchedByDate) {
      chosen = matchedByDate
    } else {
      // B) Smallest-numbered pending installment (next to be paid — best for operations/billing)
      const pending = installments.filter((i) => !isPaid(i.status))
      if (pending.length > 0) {
        chosen = pending.reduce((min, i) => (i.number < min.number ? i : min), pending[0])
      } else {
        // C) Largest-numbered paid/confirmado installment (all paid — show last)
        const paid = installments.filter((i) => isPaid(i.status))
        if (paid.length > 0) {
          chosen = paid.reduce((max, i) => (i.number > max.number ? i : max), paid[0])
        } else {
          // D) First installment
          chosen = installments[0]
        }
      }
    }
  }

  // --- 3. Derive current number ---
  const current: number | null = chosen ? (chosen.number ?? 1) : null

  // --- 4. Derive value ---
  let value: number | null = null
  if (chosen) {
    value =
      toNum(chosen.valor_override) ??
      toNum(chosen.valor) ??
      toNum(chosen.amount) ??
      null
  }
  if (value === null) {
    value =
      toNum(client.mensalidade) ??
      toNum(client.valor_mensalidade) ??
      toNum(client.monthly_payment) ??
      toNum(client.installment_value) ??
      toNum(client.valor_parcela) ??
      toNum(client.valor_prestacao) ??
      null
  }

  // --- 5. Derive total ---
  let total: number | null = null
  if (installments.length > 0) {
    total = installments.length
  }
  if (total === null) {
    total =
      toNum(client.contractual_term_months) ??
      toNum(client.prazo_meses) ??
      toNum(client.term_months) ??
      toNum(client.number_of_installments) ??
      toNum(client.parcelas) ??
      toNum(client.installments_count) ??
      null
  }

  // --- 6. Dev logging ---
  if (import.meta.env.DEV) {
    console.info('[wallet-card][mensalidade]', {
      clientId: client.id,
      installmentsCount: installments.length,
      current,
      total,
      value,
    })
  }

  return { value, current, total }
}

/**
 * Central map of visual styles for each ClientPaymentStatusV2 value.
 * Single source of truth for badge bg/fg/icon in the portfolio card.
 */
const PAYMENT_STATUS_STYLES: Record<ClientPaymentStatusV2, { bg: string; fg: string; icon: string }> = {
  SEM_COBRANCA:    { bg: '#e5e7eb', fg: '#6b7280', icon: '⚪' },
  PENDENTE:        { bg: '#fef3c7', fg: '#92400e', icon: '⏳' },
  PAGO:            { bg: '#d1fae5', fg: '#065f46', icon: '✅' },
  VENCIDO:         { bg: '#ffedd5', fg: '#9a3412', icon: '🟠' },
  ATRASADO:        { bg: '#fecaca', fg: '#7f1d1d', icon: '🔴' },
  PARCIALMENTE_PAGO: { bg: '#ede9fe', fg: '#5b21b6', icon: '🔵' },
}

const WIFI_BADGE_MAP: Record<string, { icon: string; label: string; color: string }> = {
  conectado:    { icon: '🟢', label: 'Online',       color: '#166534' },
  desconectado: { icon: '🟡', label: 'Desconectado', color: '#854d0e' },
  falha:        { icon: '🔴', label: 'Falha',        color: '#991b1b' },
}

const WIFI_BADGE_DEFAULT = { icon: '⚪', label: 'Sem monitoramento', color: '#6b7280' }

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
  const clientName = client.name?.trim() || '—'

  // Get payment status for this client
  const paymentStatusResult = getClientPaymentStatusV2(client)
  const paymentStatus = paymentStatusResult.status
  const statusStyle = PAYMENT_STATUS_STYLES[paymentStatus]

  // Helper: coerce PostgreSQL numeric strings or JS numbers to finite number or null
  const toFiniteNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null
    const parsed = typeof value === 'number'
      ? value
      : Number(String(value).replace(',', '.'))
    return Number.isFinite(parsed) ? parsed : null
  }

  // Consumo — prefer kwh_mes_contratado / kwh_contratado, fall back to raw consumption
  const consumo = toFiniteNumber(client.kwh_mes_contratado ?? client.kwh_contratado ?? client.consumption_kwh_month)
  const kwhContratadoLabel = consumo != null ? `${formatNumberBR(consumo)} kWh/mês` : '—'

  const cityState = [client.city, client.state].filter(Boolean).join('/')
  const cityStateLabel = cityState || '—'

  // Mensalidade / installment progress
  const installmentProgress = getInstallmentProgress(client)
  const mensalidadeLabel = (() => {
    const { value, current, total } = installmentProgress
    if (value === null && current === null && total === null) return '—'
    const valorStr = value != null ? formatMoneyBR(value) : null
    if (valorStr && current != null && total != null) return `${valorStr} (${current}/${total})`
    if (valorStr) return valorStr
    return '—'
  })()

  // Vencimento — use next unpaid installment date when available, fall back to due_day
  const nextDueDate = getNextDueDate(client)
  const dueDateLabel = nextDueDate
    ? nextDueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : client.due_day
    ? `Todo dia ${client.due_day}`
    : '—'

  // WiFi / monitoring badge
  const wifiStatus = client.wifi_status ?? (client.metadata?.wifi_status as string | null | undefined) ?? null
  const wifiBadge = (wifiStatus && WIFI_BADGE_MAP[wifiStatus]) ?? WIFI_BADGE_DEFAULT

  const formattedDocument = formatCpfCnpj(client.document)

  return (
    <div className="pf-client-card active-wallet-card">
      {/* Col 1: Client name + document */}
      <div className="client-cell">
        <button
          type="button"
          onClick={onEdit}
          className="pf-card-name-button"
          aria-label={`Abrir cliente ${clientName}`}
          title={`Abrir cliente ${clientName}`}
        >
          <span className="pf-card-name">{clientName}</span>
        </button>
        <span className="pf-card-doc">{formattedDocument}</span>
      </div>

      {/* Col 2: Produto/Plano */}
      <div className="info-cell">
        <span className="info-label">Produto</span>
        <span className="info-value">{contractLabel}</span>
      </div>

      {/* Col 3: Cidade/UF */}
      <div className="info-cell">
        <span className="info-label">Cidade/UF</span>
        <span className="info-value">{cityStateLabel}</span>
      </div>

      {/* Col 4: Consumo */}
      <div className="info-cell">
        <span className="info-label">Consumo</span>
        <span className="info-value">{kwhContratadoLabel}</span>
      </div>

      {/* Col 5: Mensalidade */}
      <div className="info-cell">
        <span className="info-label">Mensalidade</span>
        <span className="info-value">{mensalidadeLabel}</span>
      </div>

      {/* Col 6: Vencimento */}
      <div className="info-cell">
        <span className="info-label">Vencimento</span>
        <span className="info-value">{dueDateLabel}</span>
      </div>

      {/* Col 7: WiFi / monitoring badge */}
      <span
        className="wallet-wifi-badge"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 3,
          padding: '2px 7px',
          borderRadius: 8,
          background: 'var(--surface-alt, #f3f4f6)',
          color: wifiBadge.color,
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          alignSelf: 'center',
        }}
        title={`Status de monitoramento: ${wifiBadge.label}`}
      >
        <span aria-hidden="true">{wifiBadge.icon}</span>
        <span>{wifiBadge.label}</span>
      </span>

      {/* Col 8: Payment status badge */}
      <span
        className="wallet-status-badge"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 9px',
          borderRadius: 10,
          background: statusStyle.bg,
          color: statusStyle.fg,
          fontSize: 10,
          fontWeight: 600,
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          alignSelf: 'center',
        }}
        title={
          paymentStatus === 'SEM_COBRANCA'
            ? 'Nenhuma cobrança registrada para este cliente'
            : paymentStatus === 'VENCIDO'
            ? 'Pagamento vencido (dentro do período de 5 dias)'
            : paymentStatus === 'ATRASADO'
            ? 'Pagamento atrasado (mais de 5 dias após vencimento)'
            : paymentStatus === 'PARCIALMENTE_PAGO'
            ? 'Alguns meses pagos, outros em atraso'
            : paymentStatusResult.label
        }
      >
        <span aria-hidden="true">{statusStyle.icon}</span>
        <span>{paymentStatusResult.label}</span>
      </span>

      {/* Col 9: Actions */}
      <div className="wallet-card-actions">
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
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Panel Tabs
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'editar' | 'usina' | 'contrato' | 'plano' | 'projeto' | 'cobranca' | 'faturas' | 'notas'

/**
 * Returns whether a leasing client has all Plano-tab fields filled in.
 * The Plano tab feeds the mensalidade engine and the billing dates engine,
 * so Cobrança can only be enabled once these are present.
 */
function hasCompletePlanInfo(client: PortfolioClientRow): boolean {
  // PostgreSQL `numeric` columns are returned as strings by node-postgres,
  // so we coerce defensively here instead of using `typeof === 'number'`.
  const toFiniteNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? n : null
  }
  const kwh = toFiniteNumber(client.kwh_mes_contratado ?? client.kwh_contratado)
  const tarifa = toFiniteNumber(client.tarifa_atual)
  const desconto = toFiniteNumber(client.desconto_percentual)
  const prazo = toFiniteNumber(
    client.contractual_term_months ?? client.prazo_meses ?? client.term_months,
  )
  return (
    kwh !== null && kwh > 0 &&
    tarifa !== null && tarifa > 0 &&
    desconto !== null && desconto >= 0 &&
    prazo !== null && prazo > 0
  )
}

/**
 * Determines whether the Cobrança tab should be enabled and, when not, the
 * reason that should be surfaced as a tooltip.
 *
 * Cobrança is only available when ALL of the following hold:
 *   1. contract_type === 'leasing'  (sale and buyout never have recurring billing)
 *   2. contract_status === 'active'
 *   3. Plano tab is shown (true for leasing) and all its fields are filled
 */
function resolveCobrancaGating(client: PortfolioClientRow): { enabled: boolean; reason?: string } {
  if (client.contract_type !== 'leasing') {
    return { enabled: false, reason: 'Indisponível para contratos de venda ou buy-out.' }
  }
  if (client.contract_status !== 'active') {
    return { enabled: false, reason: 'Disponível somente quando o contrato estiver ativo.' }
  }
  if (!hasCompletePlanInfo(client)) {
    return { enabled: false, reason: 'Preencha todos os campos da aba Plano (kWh/mês, tarifa, desconto e prazo).' }
  }
  return { enabled: true }
}

function DetailTabBar({ activeTab, onChange, showPlano, showFaturas, cobrancaEnabled, cobrancaDisabledReason }: {
  activeTab: Tab
  onChange: (t: Tab) => void
  showPlano: boolean
  showFaturas: boolean
  cobrancaEnabled: boolean
  cobrancaDisabledReason?: string
}) {
  const tabs: { id: Tab; label: string; hidden?: boolean; disabled?: boolean; title?: string }[] = [
    { id: 'editar', label: '👤 Cliente' },
    { id: 'contrato', label: '📄 Contrato' },
    { id: 'plano', label: '📋 Plano', hidden: !showPlano },
    { id: 'projeto', label: '🔧 Projeto' },
    { id: 'usina', label: '☀️ Usina' },
    {
      id: 'cobranca',
      label: '💰 Cobrança',
      disabled: !cobrancaEnabled,
      title: cobrancaEnabled ? undefined : (cobrancaDisabledReason ?? 'Indisponível'),
    },
    { id: 'faturas', label: '🧾 Faturas', hidden: !showFaturas, title: 'Faturas sob titularidade da SolarInvest' },
    { id: 'notas', label: '📝 Notas' },
  ]
  return (
    <div className="pf-tab-bar">
      {tabs.filter((t) => !t.hidden).map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => { if (!t.disabled) onChange(t.id) }}
          className={`pf-tab-btn${activeTab === t.id ? ' active' : ''}${t.disabled ? ' disabled' : ''}`}
          disabled={t.disabled}
          title={t.title}
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
  editMode,
  onRegisterSave,
}: {
  client: PortfolioClientRow
  onSaved: (updated: PortfolioClientRow) => void
  onToast: (msg: string, type: 'success' | 'error') => void
  editMode: boolean
  onRegisterSave?: (fn: (() => Promise<void>) | null) => void
}) {
  const [saving, setSaving] = useState(false)
  const initialUcBeneficiarias = useMemo(() => getBeneficiaryUCs(client), [client])
  const hasUcBeneficiaria = initialUcBeneficiarias.length > 0
  const [showUcBeneficiariaField, setShowUcBeneficiariaField] = useState(hasUcBeneficiaria)

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
    uc_beneficiarias: initialUcBeneficiarias,
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
    uc_beneficiarias: initialUcBeneficiarias,
    consumption_kwh_month: client.consumption_kwh_month != null ? String(client.consumption_kwh_month) : '',
    system_kwp: client.system_kwp != null ? String(client.system_kwp) : '',
    term_months: client.term_months != null ? String(client.term_months) : '',
  })

  useEffect(() => {
    setShowUcBeneficiariaField(hasUcBeneficiaria)
  }, [hasUcBeneficiaria, client.id])

  async function handleSave() {
    setSaving(true)
    try {
      const beneficiaryUCs = sanitizeBeneficiaryUCs(form.uc_beneficiarias)
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
        uc_beneficiaria: beneficiaryUCs[0] ?? null,
        uc_beneficiarias: beneficiaryUCs,
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
        uc_beneficiaria: beneficiaryUCs[0] ?? null,
        uc_beneficiarias: beneficiaryUCs,
        consumption_kwh_month: form.consumption_kwh_month !== '' ? Number(form.consumption_kwh_month) : client.consumption_kwh_month,
        system_kwp: form.system_kwp !== '' ? Number(form.system_kwp) : client.system_kwp,
        term_months: form.term_months !== '' ? Number(form.term_months) : client.term_months,
      })
    } catch {
      onToast('Não foi possível salvar as alterações do cliente.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  useEffect(() => {
    onRegisterSave?.(() => handleSaveRef.current())
    return () => { onRegisterSave?.(null) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span>UC Geradora</span>
                {form.uc_beneficiarias.length === 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!editMode) return
                      setShowUcBeneficiariaField(true)
                      setForm((prev) => (
                        prev.uc_beneficiarias.length > 0
                          ? prev
                          : { ...prev, uc_beneficiarias: [''] }
                      ))
                    }}
                    disabled={!editMode}
                    className="pf-uc-add-btn"
                    aria-label="Adicionar UC beneficiária"
                    title="Adicionar UC beneficiária"
                  >
                    +
                  </button>
                )}
              </span>
              <input type="text" value={form.uc_geradora} onChange={(e) => setForm((f) => ({ ...f, uc_geradora: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
            {showUcBeneficiariaField && (
              <div style={{ display: 'grid', gap: 8 }}>
                {form.uc_beneficiarias.map((uc, index) => (
                  <label key={`uc-beneficiaria-${index}`} className="pf-label" style={labelStyle}>
                    {`UC Beneficiária ${index + 1}`}
                    <div style={{ display: 'grid', gridTemplateColumns: editMode && index === form.uc_beneficiarias.length - 1 ? '1fr auto auto' : '1fr', gap: 8 }}>
                      <input
                        type="text"
                        value={uc}
                        onChange={(e) => setForm((prev) => ({
                          ...prev,
                          uc_beneficiarias: prev.uc_beneficiarias.map((item, itemIndex) => (
                            itemIndex === index ? e.target.value : item
                          )),
                        }))}
                        disabled={!editMode}
                        style={inputStyle}
                      />
                      {editMode && index === form.uc_beneficiarias.length - 1 && (
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({
                            ...prev,
                            uc_beneficiarias: [...prev.uc_beneficiarias, ''],
                          }))}
                          className="pf-uc-add-secondary-btn"
                          aria-label="Adicionar UC beneficiária"
                          title="Adicionar UC beneficiária"
                        >
                          +
                        </button>
                      )}
                      {editMode && index === form.uc_beneficiarias.length - 1 && (
                        <button
                          type="button"
                          onClick={() => setForm((prev) => {
                            const nextBeneficiaryUCs = prev.uc_beneficiarias.filter((_, itemIndex) => itemIndex !== index)
                            if (nextBeneficiaryUCs.length === 0) {
                              setShowUcBeneficiariaField(false)
                            }
                            return { ...prev, uc_beneficiarias: nextBeneficiaryUCs }
                          })}
                          className="pf-uc-add-secondary-btn"
                          aria-label="Remover última UC beneficiária"
                          title="Remover última UC beneficiária"
                        >
                          -
                        </button>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

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

function ContratoTab({ client, onSaved, editMode, onRegisterSave }: { client: PortfolioClientRow; onSaved: (patch: Partial<PortfolioClientRow>) => void; editMode: boolean; onRegisterSave?: (fn: (() => Promise<void>) | null) => void }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showProposalSearchDialog, setShowProposalSearchDialog] = useState(false)
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
    source_proposal_record_id: client.source_proposal_record_id ?? '',
    source_proposal_code: client.source_proposal_code ?? '',
    source_proposal_client_name: client.source_proposal_client_name ?? '',
    source_proposal_created_at: client.source_proposal_created_at ?? '',
    source_proposal_type: client.source_proposal_type ?? '',
    source_proposal_preview_url: client.source_proposal_preview_url ?? '',
    source_proposal_download_url: client.source_proposal_download_url ?? '',
    contract_signed_at: client.contract_signed_at?.slice(0, 10) ?? '',
    contractual_term_months: client.contractual_term_months != null ? String(client.contractual_term_months) : '',
    buyout_eligible: buildBuyoutEligibleDefault(client.contract_type ?? 'leasing', client.buyout_eligible),
    contract_notes: client.contract_notes ?? '',
    consultant_id: client.consultant_id ?? '',
    consultant_name: client.consultant_name ?? '',
    contract_file_name: client.contract_file_name ?? '',
  })

  const resetForm = () => setForm({
    contract_type: client.contract_type ?? 'leasing',
    contract_status: client.contract_status ?? 'draft',
    source_proposal_id: client.source_proposal_id ?? '',
    source_proposal_record_id: client.source_proposal_record_id ?? '',
    source_proposal_code: client.source_proposal_code ?? '',
    source_proposal_client_name: client.source_proposal_client_name ?? '',
    source_proposal_created_at: client.source_proposal_created_at ?? '',
    source_proposal_type: client.source_proposal_type ?? '',
    source_proposal_preview_url: client.source_proposal_preview_url ?? '',
    source_proposal_download_url: client.source_proposal_download_url ?? '',
    contract_signed_at: client.contract_signed_at?.slice(0, 10) ?? '',
    contractual_term_months: client.contractual_term_months != null ? String(client.contractual_term_months) : '',
    buyout_eligible: buildBuyoutEligibleDefault(client.contract_type ?? 'leasing', client.buyout_eligible),
    contract_notes: client.contract_notes ?? '',
    consultant_id: client.consultant_id ?? '',
    consultant_name: client.consultant_name ?? '',
    contract_file_name: client.contract_file_name ?? '',
  })

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const linkValidation = validateProposalOriginLink(
        form.source_proposal_record_id && form.source_proposal_code
          ? {
            proposalOriginRecordId: form.source_proposal_record_id,
            proposalOriginCode: form.source_proposal_code,
          }
          : null,
      )
      if (!linkValidation.valid) {
        throw new Error(`Vínculo da proposta de origem inválido: ${linkValidation.reason}`)
      }

      const savedContractId = await patchPortfolioContract(client.id, {
        ...form,
        id: client.contract_id ?? undefined,
        contractual_term_months: form.contractual_term_months !== '' ? Number(form.contractual_term_months) : null,
        contract_signed_at: form.contract_signed_at || null,
        source_proposal_id: form.source_proposal_record_id || form.source_proposal_id || null,
        source_proposal_record_id: form.source_proposal_record_id || null,
        source_proposal_code: form.source_proposal_code || null,
        source_proposal_client_name: form.source_proposal_client_name || null,
        source_proposal_created_at: form.source_proposal_created_at || null,
        source_proposal_type: form.source_proposal_type || null,
        source_proposal_preview_url: form.source_proposal_preview_url || null,
        source_proposal_download_url: form.source_proposal_download_url || null,
        notes: form.contract_notes || null,
        consultant_id: form.consultant_id || null,
        consultant_name: form.consultant_name || null,
        contract_attachments: contractAttachments,
      })
      onSaved({
        contract_id: savedContractId,
        contract_type: form.contract_type,
        contract_status: form.contract_status,
        source_proposal_id: form.source_proposal_record_id || form.source_proposal_id || null,
        source_proposal_record_id: form.source_proposal_record_id || null,
        source_proposal_code: form.source_proposal_code || null,
        source_proposal_client_name: form.source_proposal_client_name || null,
        source_proposal_created_at: form.source_proposal_created_at || null,
        source_proposal_type: form.source_proposal_type || null,
        source_proposal_preview_url: form.source_proposal_preview_url || null,
        source_proposal_download_url: form.source_proposal_download_url || null,
        contract_signed_at: form.contract_signed_at || null,
        contractual_term_months: form.contractual_term_months !== '' ? Number(form.contractual_term_months) : null,
        prazo_meses: form.contractual_term_months !== '' ? Number(form.contractual_term_months) : null,
        buyout_eligible: form.buyout_eligible,
        contract_notes: form.contract_notes || null,
        consultant_id: form.consultant_id || null,
        consultant_name: form.consultant_name || null,
        contract_file_name: form.contract_file_name || null,
        contract_attachments: contractAttachments,
      } as Partial<PortfolioClientRow>)
      // Auto-create a project in Gestão Financeira when contract becomes active
      if (form.contract_status === 'active' && client.contract_status !== 'active') {
        createProjectFromContract(savedContractId).catch((err) => {
          console.warn('[portfolio][contrato] auto-create project failed (non-blocking):', err)
        })
      }
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  useEffect(() => {
    onRegisterSave?.(() => handleSaveRef.current())
    return () => { onRegisterSave?.(null) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const code = (form.source_proposal_code || form.source_proposal_id || '').trim()
    if (!code || form.source_proposal_record_id) return

    let active = true
    void findSavedProposalByExactCode(code).then((match) => {
      if (!active || !match) return
      const link = createProposalOriginLink(match)
      setForm((prev) => ({
        ...prev,
        source_proposal_id: prev.source_proposal_id || code,
        source_proposal_record_id: link.proposalOriginRecordId,
        source_proposal_code: link.proposalOriginCode,
        source_proposal_client_name: link.proposalOriginClientName ?? '',
        source_proposal_created_at: link.proposalOriginCreatedAt ?? '',
        source_proposal_type: link.proposalOriginType ?? '',
        source_proposal_preview_url: link.proposalOriginPreviewUrl ?? '',
        source_proposal_download_url: link.proposalOriginDownloadUrl ?? '',
      }))
    }).catch(() => { /* no-op */ })

    return () => {
      active = false
    }
  }, [form.source_proposal_code, form.source_proposal_id, form.source_proposal_record_id])

  const isVenda = form.contract_type === 'sale'
  const inputStyle: React.CSSProperties = {
    display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' as const,
  }
  const labelSty: React.CSSProperties = {}
  const gridSty: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="pf-section-card">
        <div className="pf-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><span className="pf-icon">📄</span> Dados do Contrato</span>
          <ImportarContratoButton onClick={() => setShowImportDialog(true)} disabled={saving} />
        </div>
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
            <div style={{ marginTop: 6 }}>
              <ProposalOriginField
                editMode={editMode}
                displayCode={form.source_proposal_code || null}
                isClickableCode={Boolean(form.source_proposal_record_id)}
                legacyCode={form.source_proposal_code}
                onOpenSearch={() => setShowProposalSearchDialog(true)}
                onClear={() => {
                  setForm((prev) => ({
                    ...prev,
                    source_proposal_id: '',
                    source_proposal_record_id: '',
                    source_proposal_code: '',
                    source_proposal_client_name: '',
                    source_proposal_created_at: '',
                    source_proposal_type: '',
                    source_proposal_preview_url: '',
                    source_proposal_download_url: '',
                  }))
                  console.info('[audit][proposal-origin] link_removed', { clientId: client.id, contractId: client.contract_id ?? null })
                }}
                onPreview={() => {
                  const recordId = form.source_proposal_record_id
                  if (!recordId) return
                  void getSavedProposalRecord(recordId).then((record) => {
                    if (!record) return
                    openSavedProposalPreview(record)
                    console.info('[audit][proposal-origin] preview_opened', { clientId: client.id, proposalId: recordId })
                  })
                }}
                onLegacyChange={(value) => setForm((f) => ({
                  ...f,
                  source_proposal_id: value,
                  source_proposal_code: value,
                  source_proposal_record_id: '',
                }))}
              />
            </div>
          </label>
          <div style={gridSty}>
            <label className="pf-label" style={labelSty}>
              Data de Assinatura
              <input type="date" value={form.contract_signed_at} onChange={(e) => setForm((f) => ({ ...f, contract_signed_at: e.target.value }))} disabled={!editMode} style={inputStyle} />
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
                <input type="checkbox" checked={form.buyout_eligible} onChange={(e) => setForm((f) => ({ ...f, buyout_eligible: e.target.checked }))} disabled={!editMode} style={{ width: 14, height: 14, accentColor: 'var(--accent)' }} />
                Elegível para Buy Out
              </label>
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
                    consultant_name: selected ? consultorDisplayName(selected) : f.consultant_name,
                  }))
                }}
                disabled={!editMode}
                style={inputStyle}
              >
                <option value="">Selecione um consultor…</option>
                {consultants.map((c) => (
                  <option key={c.id} value={String(c.id)}>{formatConsultantOptionLabel(c)} ({c.consultant_code})</option>
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
              <span style={{ fontSize: 13, color: 'var(--accent)' }}>➕ Adicionar anexo</span>
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

      {saveError && <p style={{ color: 'var(--ds-danger)', fontSize: 12 }}>{saveError}</p>}
      <ProposalOriginSearchDialog
        open={showProposalSearchDialog}
        onClose={() => setShowProposalSearchDialog(false)}
        onSelect={(record) => {
          const link = createProposalOriginLink(record)
          setForm((prev) => ({
            ...prev,
            source_proposal_id: link.proposalOriginRecordId,
            source_proposal_record_id: link.proposalOriginRecordId,
            source_proposal_code: link.proposalOriginCode,
            source_proposal_client_name: link.proposalOriginClientName ?? '',
            source_proposal_created_at: link.proposalOriginCreatedAt ?? '',
            source_proposal_type: link.proposalOriginType ?? '',
            source_proposal_preview_url: link.proposalOriginPreviewUrl ?? '',
            source_proposal_download_url: link.proposalOriginDownloadUrl ?? '',
          }))
          console.info('[audit][proposal-origin] link_created', {
            clientId: client.id,
            contractId: client.contract_id ?? null,
            proposalId: link.proposalOriginRecordId,
            code: link.proposalOriginCode,
          })
        }}
      />
      <ImportarContratoDialog
        open={showImportDialog}
        client={client}
        existingAttachments={contractAttachments}
        onClose={() => setShowImportDialog(false)}
        onImported={({ attachment, contractSignedAt, sourceProposalId, contractualTermMonths, kwhContratado, contractorName, contractorDocument, contractorEmail, contractorPhone, contractorAddress, contractorCity, contractorState }) => {
          const nextAttachments = [
            ...contractAttachments.filter((item) => item.origin !== 'importacao_contrato'),
            attachment,
          ]
          setContractAttachments(nextAttachments)
          setForm((prev) => ({
            ...prev,
            contract_status: 'active',
            contract_signed_at: contractSignedAt ? contractSignedAt.slice(0, 10) : prev.contract_signed_at,
            source_proposal_id: sourceProposalId ?? prev.source_proposal_id,
            source_proposal_code: sourceProposalId ?? prev.source_proposal_code,
            source_proposal_record_id: sourceProposalId ? '' : prev.source_proposal_record_id,
            contractual_term_months:
              contractualTermMonths != null ? String(contractualTermMonths) : prev.contractual_term_months,
          }))
          onSaved({
            contract_status: 'active',
            contract_signed_at: contractSignedAt ? contractSignedAt.slice(0, 10) : null,
            source_proposal_id: sourceProposalId,
            source_proposal_code: sourceProposalId,
            contractual_term_months: contractualTermMonths,
            prazo_meses: contractualTermMonths,
            contract_attachments: nextAttachments,
            kwh_contratado: kwhContratado,
            kwh_mes_contratado: kwhContratado,
            name: contractorName,
            document: contractorDocument,
            email: contractorEmail,
            phone: contractorPhone,
            address: contractorAddress,
            city: contractorCity,
            state: contractorState,
          } as Partial<PortfolioClientRow>)
          setShowImportDialog(false)
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Tab — uses shared/projects/portfolioProjectOps for types/logic
// ─────────────────────────────────────────────────────────────────────────────
function ProjetoTab({
  client,
  onSaved,
  onOpenFinancialProject,
  editMode,
  onRegisterSave,
}: {
  client: PortfolioClientRow
  onSaved: (patch: Partial<PortfolioClientRow>) => void
  onOpenFinancialProject?: (projectId: string) => void
  editMode: boolean
  onRegisterSave?: (fn: (() => Promise<void>) | null) => void
}) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Financial project linked to this client in Gestão Financeira
  const [financialProjectId, setFinancialProjectId] = useState<string | null>(null)

  // Personnel lists loaded from the API
  const [engineers, setEngineers] = useState<Engineer[]>([])
  const [installers, setInstallers] = useState<Installer[]>([])

  useEffect(() => {
    void fetchEngineers(true).then(setEngineers).catch(() => { /* graceful — use text field */ })
    void fetchInstallers(true).then(setInstallers).catch(() => { /* graceful */ })
    void fetchProjectByClientId(client.id).then((p) => {
      if (p) setFinancialProjectId(p.id)
    }).catch(() => { /* graceful */ })
  }, [client.id])

  const [form, setForm] = useState<ProjetoFormData>(() => buildProjetoForm(client))

  const resetForm = () => setForm(buildProjetoForm(client))

  async function handleSave() {
    const validationError = validateProjetoSave(form)
    if (validationError) {
      setSaveError(validationError)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      const payload = buildProjetoSavePayload(form)
      await patchPortfolioProject(client.id, payload)
      onSaved({
        project_status: form.project_status as PortfolioClientRow['project_status'],
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
        project_notes: (payload.notes as string | null) ?? null,
      } as Partial<PortfolioClientRow>)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  useEffect(() => {
    onRegisterSave?.(() => handleSaveRef.current())
    return () => { onRegisterSave?.(null) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
              {INSTALLATION_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="pf-label">
            Status Engenharia
            <select value={form.engineering_status} onChange={(e) => setForm((f) => ({ ...f, engineering_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="">Selecione…</option>
              {ENGINEERING_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
        </div>
        {/* 2. Homologation + Commissioning */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="pf-label">
            Status Homologação
            <select value={form.homologation_status} onChange={(e) => setForm((f) => ({ ...f, homologation_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="">Selecione…</option>
              {HOMOLOGATION_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label className="pf-label">
            Status Comissionamento
            <select value={form.commissioning_status} onChange={(e) => setForm((f) => ({ ...f, commissioning_status: e.target.value }))} disabled={!editMode} style={inputStyle}>
              <option value="">Selecione…</option>
              {COMMISSIONING_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
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
              {ART_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
      {saveError && <p style={{ color: 'var(--ds-danger)', fontSize: 12, marginTop: 8 }}>{saveError}</p>}
      {financialProjectId && onOpenFinancialProject && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className="pf-btn pf-btn-edit"
            onClick={() => onOpenFinancialProject(financialProjectId)}
          >
            📂 Gerenciar projeto
          </button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing Tab
// ─────────────────────────────────────────────────────────────────────────────
function CobrancaTab({ client, onSaved, editMode, onRegisterSave }: { client: PortfolioClientRow; onSaved: (patch: Partial<PortfolioClientRow>) => void; editMode: boolean; onRegisterSave?: (fn: (() => Promise<void>) | null) => void }) {
  const { isAdmin, isOffice, isFinanceiro } = useStackRbac()
  const canManageBilling = isAdmin || isOffice || isFinanceiro

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [paymentModal, setPaymentModal] = useState<{ installmentNumber: number; valor: number; vencimento: string } | null>(null)
  const [paymentProof, setPaymentProof] = useState<{ receipt_number: string; transaction_number: string }>({ receipt_number: '', transaction_number: '' })
  const [proofError, setProofError] = useState<string | null>(null)
  const [removePaymentModal, setRemovePaymentModal] = useState<{ installmentNumber: number } | null>(null)
  const [removingPayment, setRemovingPayment] = useState(false)
  const [removePaymentError, setRemovePaymentError] = useState<string | null>(null)
  // Per-installment valor editing: tracks which installment is being edited and its current input value
  const [editingValorInstallment, setEditingValorInstallment] = useState<number | null>(null)
  const [editingValorValue, setEditingValorValue] = useState('')
  const [savingValorInstallment, setSavingValorInstallment] = useState<number | null>(null)

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

  // Build a map of per-installment valor overrides from installments_json
  const buildValorOverrideMap = (installments: typeof client.installments_json) => {
    const map: Record<number, number> = {}
    if (installments) {
      for (const p of installments) {
        if (p.valor_override != null) {
          map[p.number] = p.valor_override
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

  // Local valor-override map for instant UI feedback
  const [valorOverrides, setValorOverrides] = useState<Record<number, number>>(() =>
    buildValorOverrideMap(client.installments_json),
  )

  // Keep confirmedPayments and valorOverrides in sync when client.installments_json is updated
  // by the parent (e.g. after onSaved merges the server response).
  useEffect(() => {
    setConfirmedPayments(buildConfirmedMap(client.installments_json))
    setValorOverrides(buildValorOverrideMap(client.installments_json))
   
  }, [client.installments_json])
  const [form, setForm] = useState({
    due_day: client.due_day != null ? String(client.due_day) : '5',
    reading_day: client.reading_day != null ? String(client.reading_day) : '',
    auto_reminder_enabled: client.auto_reminder_enabled ?? true,
    // Flag to determine which mensalidade rule applies: true = standard rule, false = GO/SolarInvest rule
    // Now persisted to backend
    is_contratante_titular: client.is_contratante_titular != null ? client.is_contratante_titular : true,
    commissioning_date_billing: client.commissioning_date_billing?.slice(0, 10) ?? client.commissioning_date?.slice(0, 10) ?? '',
    valor_mensalidade: client.valor_mensalidade != null ? String(client.valor_mensalidade) : '',
  })

  const resetForm = () => setForm({
    due_day: client.due_day != null ? String(client.due_day) : '5',
    reading_day: client.reading_day != null ? String(client.reading_day) : '',
    auto_reminder_enabled: client.auto_reminder_enabled ?? true,
    is_contratante_titular: client.is_contratante_titular != null ? client.is_contratante_titular : true,
    commissioning_date_billing: client.commissioning_date_billing?.slice(0, 10) ?? client.commissioning_date?.slice(0, 10) ?? '',
    valor_mensalidade: client.valor_mensalidade != null ? String(client.valor_mensalidade) : '',
  })

  // Auto-calculated monthly fee using the available engine.
  // Inputs come from the Plano tab values (kwh_mes_contratado as consumo,
  // tarifa_atual, desconto_percentual). The same value plays the role of
  // both `C` (consumo) and `Kc` (energia contratada) so that the standard
  // rule M = min(C, Kc) × Tc collapses to `kwh × tarifa × (1 − desconto)`,
  // which matches what the user expects from the Plano-based engine.
  // - Contratante titular (default): standard rule.
  // - Otherwise (titularidade SolarInvest): GO/SolarInvest rule (requires Kr/E).
  const mensalidadeAuto = useMemo(() => {
    const planKwh = client.kwh_mes_contratado ?? client.kwh_contratado ?? null
    return calculateMensalidade(
      {
        C: planKwh,
        Kc: planKwh,
        T: client.tarifa_atual ?? null,
        desconto: client.desconto_percentual ?? null,
        Kr: client.geracao_estimada_kwh ?? null,
      },
      form.is_contratante_titular,
    )
  }, [
    client.kwh_mes_contratado,
    client.kwh_contratado,
    client.tarifa_atual,
    client.desconto_percentual,
    client.geracao_estimada_kwh,
    form.is_contratante_titular,
  ])

  // Mirror the auto-calculated value into the form's `valor_mensalidade`
  // so that downstream consumers (installments, save payload) stay in
  // sync. The user can still override the value when the engine cannot
  // compute it (e.g. missing inputs).
  useEffect(() => {
    if (mensalidadeAuto.status !== 'OK' || mensalidadeAuto.valor == null) return
    const next = mensalidadeAuto.valor.toFixed(2)
    setForm((f) => (f.valor_mensalidade === next ? f : { ...f, valor_mensalidade: next }))
  }, [mensalidadeAuto])

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

  // Automatic billing date calculation (pure module — no recalculation
  // of the monthly amount; uses the value already produced by the
  // upstream billing engines).
  const billingDatesV2 = useMemo(() => {
    return calculateBillingDatesV2({
      valorMensalidade: form.valor_mensalidade !== '' ? Number(form.valor_mensalidade) : null,
      dataComissionamento: form.commissioning_date_billing || null,
      diaLeituraDistribuidora: form.reading_day !== '' ? Number(form.reading_day) : null,
      diaVencimentoCliente: form.due_day !== '' ? Number(form.due_day) : null,
    })
  }, [form.commissioning_date_billing, form.due_day, form.reading_day, form.valor_mensalidade])

  // "Último Vencimento Previsto" =
  //   Próxima cobrança recorrente + (Prazo − 1) meses
  const termMonths = client.contractual_term_months ?? client.term_months ?? client.prazo_meses ?? 0
  const ultimoVencimentoPrevisto = useMemo(() => {
    if (
      billingDatesV2.status !== 'OK' ||
      !billingDatesV2.proximaCobrancaRecorrente ||
      !termMonths ||
      termMonths < 1 ||
      !billingDatesV2.vencimentoRecorrenteMensal
    ) {
      return null
    }
    return addMonthsSafeV2(
      billingDatesV2.proximaCobrancaRecorrente,
      Math.max(0, termMonths - 1),
      billingDatesV2.vencimentoRecorrenteMensal,
    )
  }, [billingDatesV2, termMonths])

  // Generate installments.
  // Uses the engine-computed start date when all billing fields are available.
  // Falls back to commissioning_date_billing so that the table is visible
  // even when reading_day / commissioning_date are not yet set.
  const installments = useMemo(() => {
    if (!termMonths || !form.due_day) return []

    // Determine start date: prefer the engine result, then commissioning date
    let inicio: string | Date | null = null
    if (engineResult && engineResult.status_calculo !== 'erro_entrada') {
      inicio = engineResult.inicio_da_mensalidade
    } else if (billingDatesV2.status === 'OK' && billingDatesV2.dataPrimeiraCobranca) {
      inicio = billingDatesV2.dataPrimeiraCobranca
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
  }, [engineResult, billingDatesV2, termMonths, form.due_day, form.valor_mensalidade, form.commissioning_date_billing])

  // Generate notifications preview
  const notifications = useMemo(() => {
    if (installments.length === 0) return []
    return generateNotificationsForClient(client.id, client.name ?? '', installments)
  }, [installments, client.id, client.name])

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      const expectedLast = ultimoVencimentoPrevisto
        ? ultimoVencimentoPrevisto.toISOString().slice(0, 10)
        : null
      await patchPortfolioBilling(client.id, {
        ...form,
        due_day: form.due_day !== '' ? Number(form.due_day) : null,
        reading_day: form.reading_day !== '' ? Number(form.reading_day) : null,
        first_billing_date: billingDatesV2.status === 'OK' && billingDatesV2.dataPrimeiraCobranca
          ? billingDatesV2.dataPrimeiraCobranca.toISOString().slice(0, 10)
          : null,
        recurrence_type: 'monthly',
        expected_last_billing_date: expectedLast,
        commissioning_date_billing: form.commissioning_date_billing || null,
        valor_mensalidade: form.valor_mensalidade !== '' ? Number(form.valor_mensalidade) : null,
      })
      onSaved({
        due_day: form.due_day !== '' ? Number(form.due_day) : null,
        reading_day: form.reading_day !== '' ? Number(form.reading_day) : null,
        first_billing_date: billingDatesV2.status === 'OK' && billingDatesV2.dataPrimeiraCobranca
          ? billingDatesV2.dataPrimeiraCobranca.toISOString().slice(0, 10)
          : null,
        expected_last_billing_date: expectedLast,
        recurrence_type: 'monthly',
        auto_reminder_enabled: form.auto_reminder_enabled,
        is_contratante_titular: form.is_contratante_titular,
        commissioning_date_billing: form.commissioning_date_billing || null,
        valor_mensalidade: form.valor_mensalidade !== '' ? Number(form.valor_mensalidade) : null,
      } as Partial<PortfolioClientRow>)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  useEffect(() => {
    onRegisterSave?.(() => handleSaveRef.current())
    return () => { onRegisterSave?.(null) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.valor_mensalidade}
                onChange={(e) => setForm((f) => ({ ...f, valor_mensalidade: e.target.value }))}
                disabled={!editMode || mensalidadeAuto.status === 'OK'}
                style={inputStyle}
                title={mensalidadeAuto.status === 'OK'
                  ? `Calculado automaticamente pela regra ${mensalidadeAuto.rule === 'PADRAO' ? 'padrão' : 'GO/SolarInvest'}.`
                  : 'Inserir manualmente — dados insuficientes para cálculo automático.'}
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {mensalidadeAuto.status === 'OK'
                  ? `Calculado automaticamente — regra ${mensalidadeAuto.rule === 'PADRAO' ? 'padrão' : 'GO/SolarInvest'}.`
                  : form.is_contratante_titular
                    ? 'Preencha kwh, tarifa e desconto na aba Plano para cálculo automático.'
                    : 'Titularidade da SolarInvest. Configure os dados na aba Faturas.'}
              </div>
            </label>
          </div>
          <div style={gridSty}>
            <label className="pf-checkbox-label">
              <input type="checkbox" checked={form.auto_reminder_enabled} onChange={(e) => setForm((f) => ({ ...f, auto_reminder_enabled: e.target.checked }))} disabled={!editMode} style={{ width: 14, height: 14, accentColor: '#8b5cf6' }} />
              Lembrete automático ativado
            </label>
            <label
              className="pf-checkbox-label"
              title="Quando marcado, a mensalidade segue a regra padrão (M = min(C, Kc) × Tc). Desmarcado, a titularidade é da SolarInvest e a regra GO/SolarInvest é aplicada."
            >
              <input
                type="checkbox"
                checked={form.is_contratante_titular}
                onChange={(e) => setForm((f) => ({ ...f, is_contratante_titular: e.target.checked }))}
                disabled={!editMode}
                style={{ width: 14, height: 14, accentColor: '#8b5cf6' }}
              />
              Contratante titular
            </label>
          </div>
        </div>
      </div>

      {/* Automatic billing dates (pure module) */}
      <div className="pf-section-card">
        <div className="pf-section-title"><span className="pf-icon">📅</span> Datas de Cobrança</div>
        {billingDatesV2.status === 'NA' && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>N/A</div>
        )}
        {billingDatesV2.status === 'AGUARDANDO' && (
          <div>
            <span
              style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: 999,
                background: 'var(--color-warning-bg, #fef3c7)',
                color: 'var(--color-warning-fg, #92400e)',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Aguardando dados
            </span>
            {billingDatesV2.motivo && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                {billingDatesV2.motivo}
              </div>
            )}
          </div>
        )}
        {billingDatesV2.status === 'OK' && (
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="pf-info-row">
              <span className="pf-info-label">Data da primeira cobrança:</span>
              <span className="pf-info-value">
                {billingDatesV2.dataPrimeiraCobranca?.toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="pf-info-row">
              <span className="pf-info-label">Vencimento recorrente mensal:</span>
              <span className="pf-info-value">
                {`Todo dia ${billingDatesV2.vencimentoRecorrenteMensal}`}
              </span>
            </div>
            <div className="pf-info-row">
              <span className="pf-info-label">Próxima cobrança recorrente:</span>
              <span className="pf-info-value">
                {billingDatesV2.proximaCobrancaRecorrente?.toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="pf-info-row">
              <span className="pf-info-label">Último vencimento previsto:</span>
              <span className="pf-info-value">
                {ultimoVencimentoPrevisto
                  ? ultimoVencimentoPrevisto.toLocaleDateString('pt-BR')
                  : '—'}
              </span>
            </div>
            {!termMonths && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Configure o prazo do contrato para calcular o último vencimento previsto.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Installments with payment management */}
      {(() => {
        const termMonths = client.contractual_term_months ?? client.term_months ?? 0
        const hasStartDate = !!(engineResult?.inicio_da_mensalidade || form.commissioning_date_billing)
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
                    const displayValor = valorOverrides[inst.numero] ?? inst.valor
                    const isEditingValor = editMode && canManageBilling && editingValorInstallment === inst.numero

                    // Calculate payment status based on due date
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    const dueDate = new Date(inst.data_vencimento)
                    dueDate.setHours(0, 0, 0, 0)
                    const diffMs = dueDate.getTime() - today.getTime()
                    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

                    // Determine display status
                    let statusLabel = '⏳ Pendente'
                    let statusClass = 'pf-status-pending'

                    if (isConfirmed) {
                      statusLabel = '✅ Confirmado'
                      statusClass = 'pf-status-confirmed'
                    } else if (diffDays < -30) {
                      // More than 30 days overdue
                      statusLabel = '🔴 Em Atraso'
                      statusClass = 'pf-status-overdue-severe'
                    } else if (diffDays < 0) {
                      // Overdue but less than 30 days
                      statusLabel = `⚠️ Vencido (${Math.abs(diffDays)}d)`
                      statusClass = 'pf-status-overdue'
                    }

                    return (
                      <tr key={inst.numero}>
                        <td>{inst.numero}</td>
                        <td>{inst.data_vencimento.toLocaleDateString('pt-BR')}</td>
                        <td className="right">
                          {isEditingValor ? (
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={editingValorValue}
                              onChange={(e) => setEditingValorValue(e.target.value)}
                              onBlur={() => {
                                const num = parseFloat(editingValorValue)
                                if (!isNaN(num) && num >= 0) {
                                  const newValor = parseFloat(num.toFixed(2))
                                  setSavingValorInstallment(inst.numero)
                                  void patchPortfolioBilling(client.id, {
                                    installment_valor: { number: inst.numero, valor_override: newValor },
                                  }).then((updatedInstallments) => {
                                    setValorOverrides((prev) => ({ ...prev, [inst.numero]: newValor }))
                                    setEditingValorInstallment(null)
                                    onSaved(updatedInstallments != null ? { installments_json: updatedInstallments } : {})
                                  }).catch((err: unknown) => {
                                    setSaveError(err instanceof Error ? err.message : `Falha ao atualizar o valor da parcela #${inst.numero}. Tente novamente.`)
                                  }).finally(() => setSavingValorInstallment(null))
                                } else {
                                  setEditingValorInstallment(null)
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                                if (e.key === 'Escape') setEditingValorInstallment(null)
                              }}
                              style={{ width: 90, fontSize: 12, textAlign: 'right', padding: '2px 4px', borderRadius: 4, border: '1px solid var(--accent)', background: 'var(--surface)', color: 'var(--text-base)' }}
                              autoFocus
                            />
                          ) : (
                            <span
                              title={editMode && canManageBilling ? 'Clique para editar o valor desta parcela' : undefined}
                              style={editMode && canManageBilling ? { cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: 3 } : undefined}
                              onClick={editMode && canManageBilling ? () => {
                                setEditingValorInstallment(inst.numero)
                                setEditingValorValue(displayValor > 0 ? displayValor.toFixed(2) : '')
                              } : undefined}
                            >
                              {savingValorInstallment === inst.numero
                                ? '…'
                                : displayValor > 0
                                  ? `R$ ${displayValor.toFixed(2).replace('.', ',')}${valorOverrides[inst.numero] != null ? ' ✏️' : ''}`
                                  : '—'}
                            </span>
                          )}
                        </td>
                        <td className="center">
                          <span className={statusClass}>{statusLabel}</span>
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
                          {editMode && canManageBilling && !isConfirmed && (
                            <button
                              type="button"
                              onClick={() => {
                                setProofError(null)
                                setPaymentProof({ receipt_number: '', transaction_number: '' })
                                setPaymentModal({ installmentNumber: inst.numero, valor: displayValor, vencimento: inst.data_vencimento.toISOString() })
                              }}
                              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--color-success-border)', background: 'var(--color-success-bg)', color: 'var(--color-success-fg)', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                            >
                              Pagar
                            </button>
                          )}
                          {editMode && canManageBilling && isConfirmed && (
                            <button
                              type="button"
                              onClick={() => { setRemovePaymentError(null); setRemovePaymentModal({ installmentNumber: inst.numero }) }}
                              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--ds-danger, #ef4444)', background: 'rgba(239,68,68,0.08)', color: 'var(--ds-danger, #ef4444)', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' }}
                            >
                              Remover
                            </button>
                          )}
                          {!editMode && isConfirmed && (
                            <span style={{ fontSize: 13, color: 'var(--color-success-fg)' }}>✓</span>
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
            {proofError && <p style={{ color: 'var(--ds-danger)', fontSize: 12, marginTop: 8 }}>{proofError}</p>}
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
                style={{ flex: 1, padding: '10px 0', borderRadius: 7, border: 'none', background: 'var(--ds-success, #22C55E)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
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

      {/* Remove payment confirmation modal */}
      {removePaymentModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface, #122040)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, maxWidth: 400, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: 'var(--text-strong)' }}>
              🗑️ Remover Pagamento — Parcela #{removePaymentModal.installmentNumber}
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 16px' }}>
              Tem certeza que deseja remover o registro de pagamento desta parcela? O status voltará para <strong>Pendente</strong>.
            </p>
            {removePaymentError && <p style={{ color: 'var(--ds-danger)', fontSize: 12, marginBottom: 8 }}>{removePaymentError}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                disabled={removingPayment}
                onClick={() => {
                  setRemovingPayment(true)
                  setRemovePaymentError(null)
                  void patchPortfolioBilling(client.id, {
                    installment_payment: {
                      number: removePaymentModal.installmentNumber,
                      status: 'pendente',
                      paid_at: null,
                      receipt_number: null,
                      transaction_number: null,
                      attachment_url: null,
                      confirmed_by: null,
                    },
                  }).then((updatedInstallments) => {
                    setConfirmedPayments((prev) => {
                      const next = { ...prev }
                      delete next[removePaymentModal.installmentNumber]
                      return next
                    })
                    setRemovePaymentModal(null)
                    onSaved(updatedInstallments != null ? { installments_json: updatedInstallments } : {})
                  }).catch((err: unknown) => {
                    setRemovePaymentError(err instanceof Error ? err.message : `Falha ao remover o pagamento da parcela #${removePaymentModal.installmentNumber}. Tente novamente.`)
                  }).finally(() => setRemovingPayment(false))
                }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 7, border: 'none', background: 'var(--ds-danger, #ef4444)', color: '#fff', fontWeight: 700, cursor: removingPayment ? 'not-allowed' : 'pointer', fontSize: 13, opacity: removingPayment ? 0.7 : 1 }}
              >
                {removingPayment ? 'Removendo…' : '🗑️ Remover Pagamento'}
              </button>
              <button
                type="button"
                disabled={removingPayment}
                onClick={() => { setRemovePaymentModal(null); setRemovePaymentError(null) }}
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
              <div key={notif.id} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 5, background: 'var(--color-warning-bg)', borderLeft: '2px solid var(--accent)' }}>
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

      {saveError && <p style={{ color: 'var(--ds-danger)', fontSize: 12 }}>{saveError}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Usina Tab — UF configuration reuse
// ─────────────────────────────────────────────────────────────────────────────
function UsinaTab({ client, onSaved, editMode, onRegisterSave }: { client: PortfolioClientRow; onSaved: (patch: Partial<PortfolioClientRow>) => void; editMode: boolean; onRegisterSave?: (fn: (() => Promise<void>) | null) => void }) {
  const [saving, setSaving] = useState(false)

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
    wifi_status: client.wifi_status ?? (client.metadata?.wifi_status as string) ?? '',
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
    wifi_status: client.wifi_status ?? (client.metadata?.wifi_status as string) ?? '',
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
        wifi_status: ufData.wifi_status || null,
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
        wifi_status: ufData.wifi_status || null,
      } as Partial<PortfolioClientRow>)
      // Best-effort sync: if a financial project exists for this client, also
      // write the usina data to project_pv_data so both views stay in sync.
      void fetchProjectByClientId(client.id).then((proj) => {
        if (!proj) return
        const pvPayload = {
          potencia_modulo_wp: ufData.potencia_modulo_wp ? Number(ufData.potencia_modulo_wp) : null,
          numero_modulos: ufData.numero_modulos ? Number(ufData.numero_modulos) : null,
          modelo_modulo: ufData.modelo_modulo || null,
          modelo_inversor: ufData.modelo_inversor || null,
          area_utilizada_m2: ufData.area_instalacao_m2 ? Number(ufData.area_instalacao_m2) : null,
          geracao_estimada_kwh_mes: ufData.geracao_estimada_kwh ? Number(ufData.geracao_estimada_kwh) : null,
          potencia_sistema_kwp: ufData.potencia_kwp ? Number(ufData.potencia_kwp) : null,
          tipo_rede: ufData.tipo_rede && ufData.tipo_rede !== 'nenhum' ? ufData.tipo_rede : null,
        }
        return patchProjectPvData(proj.id, pvPayload)
      }).catch((err: unknown) => {
        // Non-fatal: portfolio usina save already succeeded
        console.warn('[UsinaTab] project_pv_data sync failed (non-fatal)', err)
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  useEffect(() => {
    onRegisterSave?.(() => handleSaveRef.current())
    return () => { onRegisterSave?.(null) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <UfConfigurationFields data={ufData} onChange={handleFieldChange} readOnly={!editMode} installationStatus={client.installation_status} />
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
function PlanoLeasingTab({ client, onSaved, editMode, onRegisterSave }: { client: PortfolioClientRow; onSaved: (patch: Partial<PortfolioClientRow>) => void; editMode: boolean; onRegisterSave?: (fn: (() => Promise<void>) | null) => void }) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const prazoUnificado = client.contractual_term_months ?? client.prazo_meses ?? null

  // Note: potencia_kwp, tipo_rede, marca_inversor, indicacao removed from this form.
  // These fields now live exclusively in project_pv_data (UsinaTab / Usina section).
  // Legacy records may still have values in those columns; they are preserved on the
  // server but no longer edited here.
  const [form, setForm] = useState({
    modalidade: client.modalidade ?? 'leasing',
    kwh_mes_contratado: client.kwh_mes_contratado != null ? String(client.kwh_mes_contratado) : (client.kwh_contratado != null ? String(client.kwh_contratado) : ''),
    desconto_percentual: client.desconto_percentual != null ? String(client.desconto_percentual) : '',
    tarifa_atual: client.tarifa_atual != null ? String(client.tarifa_atual) : '',
    prazo_meses: prazoUnificado != null ? String(prazoUnificado) : '',
  })

  const resetForm = () => setForm({
    modalidade: client.modalidade ?? 'leasing',
    kwh_mes_contratado: client.kwh_mes_contratado != null ? String(client.kwh_mes_contratado) : (client.kwh_contratado != null ? String(client.kwh_contratado) : ''),
    desconto_percentual: client.desconto_percentual != null ? String(client.desconto_percentual) : '',
    tarifa_atual: client.tarifa_atual != null ? String(client.tarifa_atual) : '',
    prazo_meses: prazoUnificado != null ? String(prazoUnificado) : '',
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
        prazo_meses: form.prazo_meses ? Number(form.prazo_meses) : null,
      }
      await patchPortfolioPlan(client.id, payload)
      onSaved({
        modalidade: form.modalidade || null,
        kwh_contratado: form.kwh_mes_contratado ? Number(form.kwh_mes_contratado) : null,
        kwh_mes_contratado: form.kwh_mes_contratado ? Number(form.kwh_mes_contratado) : null,
        desconto_percentual: form.desconto_percentual ? Number(form.desconto_percentual) : null,
        tarifa_atual: form.tarifa_atual ? Number(form.tarifa_atual) : null,
        prazo_meses: form.prazo_meses ? Number(form.prazo_meses) : null,
        contractual_term_months: form.prazo_meses ? Number(form.prazo_meses) : null,
      } as Partial<PortfolioClientRow>)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar plano.')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveRef = useRef(handleSave)
  handleSaveRef.current = handleSave

  useEffect(() => {
    onRegisterSave?.(() => handleSaveRef.current())
    return () => { onRegisterSave?.(null) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          </div>
          <div style={gridSty}>
            <label className="pf-label" style={labelSty}>
              Prazo (meses)
              <input type="number" min={0} value={form.prazo_meses} onChange={(e) => setForm((f) => ({ ...f, prazo_meses: e.target.value }))} disabled={!editMode} style={inputStyle} />
            </label>
          </div>
        </div>
      </div>
      {saveError && <p style={{ color: 'var(--ds-danger)', fontSize: 12 }}>{saveError}</p>}
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
            style={{ padding: '0 16px', borderRadius: 7, border: 'none', background: 'var(--ds-primary, #2D8CFF)', color: '#fff', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-end', height: 40 }}>
            {addingNote ? '…' : '＋'}
          </button>
        </div>
      </div>
      {addError && <p style={{ color: 'var(--ds-danger)', fontSize: 12, marginBottom: 10 }}>{addError}</p>}
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
  const [cepLoading, setCepLoading] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)
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
    term_months: '60',
  })

  const distribuidorasData = useMemo(() => getDistribuidorasFallback(), [])
  const distribuidorasList = useMemo(() => {
    if (form.state && distribuidorasData.distribuidorasPorUf[form.state]) {
      return distribuidorasData.distribuidorasPorUf[form.state]
    }
    const all = Object.values(distribuidorasData.distribuidorasPorUf).flat()
    return [...new Set(all)].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [form.state, distribuidorasData])

  const set = (field: keyof AddClientFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setGlobalError(null)
  }

  async function handleCepChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setForm((f) => ({ ...f, cep: val }))
    setErrors((prev) => ({ ...prev, cep: undefined }))
    setCepError(null)
    setGlobalError(null)
    const digits = val.replace(/\D/g, '')
    if (digits.length === 8) {
      setCepLoading(true)
      try {
        const result = await lookupCep(val)
        if (result) {
          setForm((f) => ({
            ...f,
            cep: val,
            city: result.cidade ?? f.city,
            state: result.uf ?? f.state,
            address: result.logradouro
              ? result.bairro
                ? `${result.logradouro}, ${result.bairro}`
                : result.logradouro
              : f.address,
            distribuidora: '',
          }))
          setErrors((prev) => ({ ...prev, city: undefined, state: undefined, address: undefined }))
        } else {
          setCepError('CEP não encontrado')
        }
      } catch {
        setCepError('Falha ao buscar CEP. Preencha manualmente.')
      } finally {
        setCepLoading(false)
      }
    }
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
      const created = await upsertClientByDocument({
        name: form.name.trim(),
        document: form.document.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        cep: form.cep.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        address: form.address.trim(),
        distribuidora: form.distribuidora.trim(),
        ...(form.uc.trim() && { uc: form.uc.trim() }),
        consumption_kwh_month: Number(form.consumption_kwh_month),
        term_months: Number(form.term_months),
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
  const errStyle: React.CSSProperties = { color: 'var(--ds-danger)', fontSize: 11, marginTop: 2 }
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1250,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 'calc(var(--header-h, 64px) + 16px)',
        paddingBottom: 24,
        paddingLeft: 16,
        paddingRight: 16,
        overflowY: 'auto',
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
            <input type="text" value={form.name} onChange={set('name')} placeholder="Nome completo ou Razão Social" style={{ ...inputStyle, borderColor: errors.name ? 'var(--ds-danger)' : undefined }} />
            {errors.name && <span style={errStyle}>{errors.name}</span>}
          </label>
          <label className="pf-label" style={labelStyle}>
            CPF / CNPJ *
            <input type="text" value={form.document} onChange={set('document')} placeholder="000.000.000-00 ou 00.000.000/0000-00" style={{ ...inputStyle, borderColor: errors.document ? 'var(--ds-danger)' : undefined }} />
            {errors.document && <span style={errStyle}>{errors.document}</span>}
          </label>
          <div style={gridStyle}>
            <label className="pf-label" style={labelStyle}>
              Telefone *
              <input type="tel" value={form.phone} onChange={set('phone')} placeholder="(XX) 9XXXX-XXXX" style={{ ...inputStyle, borderColor: errors.phone ? 'var(--ds-danger)' : undefined }} />
              {errors.phone && <span style={errStyle}>{errors.phone}</span>}
            </label>
            <label className="pf-label" style={labelStyle}>
              E-mail *
              <input type="email" value={form.email} onChange={set('email')} placeholder="email@exemplo.com" style={{ ...inputStyle, borderColor: errors.email ? 'var(--ds-danger)' : undefined }} />
              {errors.email && <span style={errStyle}>{errors.email}</span>}
            </label>
          </div>
          <div style={gridStyle}>
            <label className="pf-label" style={labelStyle}>
              CEP *
              <input
                type="text"
                value={form.cep}
                onChange={(e) => { void handleCepChange(e) }}
                placeholder="XXXXX-XXX"
                maxLength={9}
                style={{ ...inputStyle, borderColor: errors.cep ? 'var(--ds-danger)' : undefined }}
              />
              {cepLoading && <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Buscando CEP…</span>}
              {cepError && !cepLoading && <span style={errStyle}>{cepError}</span>}
              {errors.cep && !cepLoading && <span style={errStyle}>{errors.cep}</span>}
            </label>
            <label className="pf-label" style={labelStyle}>
              Estado (UF) *
              <select
                value={form.state}
                onChange={(e) => {
                  setForm((f) => ({ ...f, state: e.target.value, distribuidora: '' }))
                  setErrors((prev) => ({ ...prev, state: undefined, distribuidora: undefined }))
                  setGlobalError(null)
                }}
                style={{ ...inputStyle, borderColor: errors.state ? 'var(--ds-danger)' : undefined }}
              >
                <option value="">Selecione o estado…</option>
                {BR_STATES.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
              {errors.state && <span style={errStyle}>{errors.state}</span>}
            </label>
          </div>
          <div style={gridStyle}>
            <label className="pf-label" style={labelStyle}>
              Cidade *
              <input type="text" value={form.city} onChange={set('city')} placeholder="Cidade" style={{ ...inputStyle, borderColor: errors.city ? 'var(--ds-danger)' : undefined }} />
              {errors.city && <span style={errStyle}>{errors.city}</span>}
            </label>
            <label className="pf-label" style={labelStyle}>
              Endereço *
              <input type="text" value={form.address} onChange={set('address')} placeholder="Rua, número, bairro" style={{ ...inputStyle, borderColor: errors.address ? 'var(--ds-danger)' : undefined }} />
              {errors.address && <span style={errStyle}>{errors.address}</span>}
            </label>
          </div>
        </div>

        <div className="pf-section-card" style={{ marginBottom: 14 }}>
          <div className="pf-section-title"><span className="pf-icon">⚡</span> Energia</div>
          <label className="pf-label" style={labelStyle}>
            Distribuidora *
            <select
              value={form.distribuidora}
              onChange={(e) => {
                setForm((f) => ({ ...f, distribuidora: e.target.value }))
                setErrors((prev) => ({ ...prev, distribuidora: undefined }))
                setGlobalError(null)
              }}
              style={{ ...inputStyle, borderColor: errors.distribuidora ? 'var(--ds-danger)' : undefined }}
            >
              <option value="">Selecione a distribuidora…</option>
              {distribuidorasList.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {errors.distribuidora && <span style={errStyle}>{errors.distribuidora}</span>}
          </label>
          <label className="pf-label" style={labelStyle}>
            UC Geradora
            <input type="text" value={form.uc} onChange={set('uc')} placeholder="000000000000000 (15 dígitos)" style={{ ...inputStyle, borderColor: errors.uc ? 'var(--ds-danger)' : undefined }} />
            {errors.uc && <span style={errStyle}>{errors.uc}</span>}
          </label>
          <div style={gridStyle}>
            <label className="pf-label" style={labelStyle}>
              Consumo (kWh/mês) *
              <input type="number" value={form.consumption_kwh_month} onChange={set('consumption_kwh_month')} placeholder="0" min={0} style={{ ...inputStyle, borderColor: errors.consumption_kwh_month ? 'var(--ds-danger)' : undefined }} />
              {errors.consumption_kwh_month && <span style={errStyle}>{errors.consumption_kwh_month}</span>}
            </label>
            <label className="pf-label" style={labelStyle}>
              Prazo Contratual (meses) *
              <input type="number" value={form.term_months} onChange={set('term_months')} placeholder="60" min={1} style={{ ...inputStyle, borderColor: errors.term_months ? 'var(--ds-danger)' : undefined }} />
              {errors.term_months && <span style={errStyle}>{errors.term_months}</span>}
            </label>
          </div>
        </div>

        {globalError && (
          <div className="pf-error-banner" style={{ marginBottom: 14 }}>
            {globalError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={saving}
            style={{ padding: '9px 20px', borderRadius: 7, border: '1px solid var(--border, #334155)', background: 'none', color: 'inherit', cursor: 'pointer', fontSize: 14 }}>
            Cancelar
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            className="pf-btn-add-client"
            style={{ opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
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
  onOpenFinancialProject,
}: {
  clientId: number
  onClose: () => void
  onClientUpdated: () => void
  onRemovedFromPortfolio: (clientId: number) => void
  onDeleted: (clientId: number) => void
  onToast: (msg: string, type: 'success' | 'error') => void
  onOpenFinancialProject?: (projectId: string) => void
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
  const [editMode, setEditMode] = useState(false)
  const [showGlobalSavePrompt, setShowGlobalSavePrompt] = useState(false)
  const [savingAll, setSavingAll] = useState(false)
  const tabSaveFnsRef = useRef<Map<string, () => Promise<void>>>(new Map())
  const savingAllRef = useRef(false)

  const registerTabSave = useCallback((tabId: string, fn: (() => Promise<void>) | null) => {
    if (fn === null) tabSaveFnsRef.current.delete(tabId)
    else tabSaveFnsRef.current.set(tabId, fn)
  }, [])

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
    setLocalClient((prev) => prev ? { ...prev, ...patch } : prev)
    setHookClient((prev) => prev ? { ...prev, ...patch } : prev)
    // During a global save, handleGlobalSave handles the single reload/refresh
    // cycle after all tabs finish. Individual tab callbacks still run to keep
    // localClient optimistically up-to-date, but we skip the per-tab reload.
    if (savingAllRef.current) return
    const keys = Object.keys(patch)
    const isInstallmentsOnly = keys.length > 0 && keys.every((k) => k === 'installments_json')
    if (!isInstallmentsOnly) {
      void reloadSilent().then(() => setRefreshKey((k) => k + 1))
    }
    onClientUpdated()
  }, [reloadSilent, setHookClient, onClientUpdated])

  async function handleGlobalSave() {
    setShowGlobalSavePrompt(false)
    setSavingAll(true)
    savingAllRef.current = true
    const errors: string[] = []
    const tabLabels: Record<string, string> = {
      editar: 'Dados', usina: 'Usina', contrato: 'Contrato',
      plano: 'Plano', projeto: 'Projeto', cobranca: 'Cobrança',
    }
    try {
      for (const [tabId, saveFn] of tabSaveFnsRef.current.entries()) {
        try { await saveFn() } catch (err) {
          const label = tabLabels[tabId] ?? tabId
          const msg = err instanceof Error ? err.message : 'Erro desconhecido'
          errors.push(`${label}: ${msg}`)
        }
      }
      await reloadSilent()
      setRefreshKey((k) => k + 1)
      onClientUpdated()
      if (errors.length > 0) {
        onToast(`Algumas abas não puderam ser salvas: ${errors.join('; ')}`, 'error')
      } else {
        setEditMode(false)
      }
    } finally {
      setSavingAll(false)
      savingAllRef.current = false
    }
  }

  function handleGlobalCancel() {
    setEditMode(false)
    tabSaveFnsRef.current.clear()
    // Reload from server to ensure forms remount with authoritative server data.
    void reloadSilent().then(() => setRefreshKey((k) => k + 1))
  }

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
        <p style={{ color: 'var(--ds-danger)', fontSize: 13 }}>{error ?? 'Cliente não encontrado.'}</p>
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
        <DetailTabBar
          activeTab={activeTab}
          onChange={setActiveTab}
          showPlano={displayClient.contract_type === 'leasing'}
          showFaturas={displayClient.is_contratante_titular === false}
          cobrancaEnabled={resolveCobrancaGating(displayClient).enabled}
          cobrancaDisabledReason={resolveCobrancaGating(displayClient).reason}
        />

        {/* Global edit controls */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {!editMode && (
            <button type="button" className="pf-btn pf-btn-edit" onClick={() => setEditMode(true)}>✏️ Editar</button>
          )}
          {editMode && (
            <>
              <button type="button" className="pf-btn pf-btn-save" disabled={savingAll} onClick={() => setShowGlobalSavePrompt(true)}>
                {savingAll ? 'Salvando…' : '💾 Salvar Alterações'}
              </button>
              <button type="button" className="pf-btn pf-btn-cancel" onClick={handleGlobalCancel}>Cancelar</button>
            </>
          )}
        </div>

        {editMode ? (
          <>
            <div style={{ display: activeTab === 'editar' ? undefined : 'none' }}>
              <EditarTab
                client={displayClient}
                editMode={editMode}
                onRegisterSave={(fn) => registerTabSave('editar', fn)}
                onSaved={(updated) => { setLocalClient(updated); setHookClient(updated) }}
                onToast={onToast}
              />
            </div>
            <div style={{ display: activeTab === 'usina' ? undefined : 'none' }}>
              <UsinaTab client={displayClient} editMode={editMode} onRegisterSave={(fn) => registerTabSave('usina', fn)} onSaved={handleTabSaved} />
            </div>
            <div style={{ display: activeTab === 'contrato' ? undefined : 'none' }}>
              <ContratoTab client={displayClient} editMode={editMode} onRegisterSave={(fn) => registerTabSave('contrato', fn)} onSaved={handleTabSaved} />
            </div>
            {displayClient.contract_type === 'leasing' && (
              <div style={{ display: activeTab === 'plano' ? undefined : 'none' }}>
                <PlanoLeasingTab client={displayClient} editMode={editMode} onRegisterSave={(fn) => registerTabSave('plano', fn)} onSaved={handleTabSaved} />
              </div>
            )}
            <div style={{ display: activeTab === 'projeto' ? undefined : 'none' }}>
              <ProjetoTab client={displayClient} editMode={editMode} onRegisterSave={(fn) => registerTabSave('projeto', fn)} onSaved={handleTabSaved} onOpenFinancialProject={onOpenFinancialProject} />
            </div>
            {resolveCobrancaGating(displayClient).enabled && (
              <div style={{ display: activeTab === 'cobranca' ? undefined : 'none' }}>
                <CobrancaTab client={displayClient} editMode={editMode} onRegisterSave={(fn) => registerTabSave('cobranca', fn)} onSaved={handleTabSaved} />
              </div>
            )}
            {displayClient.is_contratante_titular === false && (
              <div style={{ display: activeTab === 'faturas' ? undefined : 'none' }}>
                <FaturasTab key={`faturas-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />
              </div>
            )}
            {activeTab === 'notas' && <NotasTab key={`notas-${refreshKey}`} client={displayClient} />}
          </>
        ) : (
          <>
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
                editMode={false}
              />
            )}
            {activeTab === 'usina' && <UsinaTab key={`usina-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} editMode={false} />}
            {activeTab === 'contrato' && <ContratoTab key={`contrato-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} editMode={false} />}
            {activeTab === 'plano' && displayClient.contract_type === 'leasing' && <PlanoLeasingTab key={`plano-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} editMode={false} />}
            {activeTab === 'projeto' && <ProjetoTab key={`projeto-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} onOpenFinancialProject={onOpenFinancialProject} editMode={false} />}
            {activeTab === 'cobranca' && resolveCobrancaGating(displayClient).enabled && <CobrancaTab key={`cobranca-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} editMode={false} />}
            {activeTab === 'faturas' && displayClient.is_contratante_titular === false && <FaturasTab key={`faturas-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />}
            {activeTab === 'notas' && <NotasTab key={`notas-${refreshKey}`} client={displayClient} />}
          </>
        )}
      </div>

      {/* Confirm dialogs */}
      {confirmRemove && (
        <ConfirmDialog
          title="Remover da Carteira"
          message={`Tem certeza que deseja remover "${displayClient.name}" da Carteira de Clientes? O cliente continuará existindo no sistema — apenas sairá da carteira.`}
          confirmLabel="Remover da Carteira"
          variant="warning"
          onConfirm={() => void handleRemoveFromPortfolio()}
          onCancel={() => setConfirmRemove(false)}
        />
      )}
      {confirmDelete && (
        <ConfirmDialog
          title="Excluir Cliente"
          message={`Atenção: esta ação excluirá definitivamente o cliente "${displayClient.name}" do sistema. Esta ação não pode ser desfeita. Deseja continuar?`}
          confirmLabel="Excluir Definitivamente"
          variant="danger"
          onConfirm={() => void handleDeleteClient()}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
      {showGlobalSavePrompt && (
        <ConfirmDialog
          title="Salvar Alterações"
          message="Deseja realmente salvar todas as alterações feitas?"
          confirmLabel="Salvar"
          variant="success"
          onConfirm={() => void handleGlobalSave()}
          onCancel={() => setShowGlobalSavePrompt(false)}
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
            <DetailTabBar
              activeTab={activeTab}
              onChange={setActiveTab}
              showPlano={displayClient.contract_type === 'leasing'}
              showFaturas={displayClient.is_contratante_titular === false}
              cobrancaEnabled={resolveCobrancaGating(displayClient).enabled}
              cobrancaDisabledReason={resolveCobrancaGating(displayClient).reason}
            />

            {/* Global edit controls */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {!editMode && (
                <button type="button" className="pf-btn pf-btn-edit" onClick={() => setEditMode(true)}>✏️ Editar</button>
              )}
              {editMode && (
                <>
                  <button type="button" className="pf-btn pf-btn-save" disabled={savingAll} onClick={() => setShowGlobalSavePrompt(true)}>
                    {savingAll ? 'Salvando…' : '💾 Salvar Alterações'}
                  </button>
                  <button type="button" className="pf-btn pf-btn-cancel" onClick={handleGlobalCancel}>Cancelar</button>
                </>
              )}
            </div>

            {editMode ? (
              <>
                <div style={{ display: activeTab === 'editar' ? undefined : 'none' }}>
                  <EditarTab
                    client={displayClient}
                    editMode={editMode}
                    onRegisterSave={(fn) => registerTabSave('editar', fn)}
                    onSaved={(updated) => { setLocalClient(updated); setHookClient(updated) }}
                    onToast={onToast}
                  />
                </div>
                <div style={{ display: activeTab === 'usina' ? undefined : 'none' }}>
                  <UsinaTab client={displayClient} editMode={editMode} onRegisterSave={(fn) => registerTabSave('usina', fn)} onSaved={handleTabSaved} />
                </div>
                <div style={{ display: activeTab === 'contrato' ? undefined : 'none' }}>
                  <ContratoTab client={displayClient} editMode={editMode} onRegisterSave={(fn) => registerTabSave('contrato', fn)} onSaved={handleTabSaved} />
                </div>
                {displayClient.contract_type === 'leasing' && (
                  <div style={{ display: activeTab === 'plano' ? undefined : 'none' }}>
                    <PlanoLeasingTab client={displayClient} editMode={editMode} onRegisterSave={(fn) => registerTabSave('plano', fn)} onSaved={handleTabSaved} />
                  </div>
                )}
                <div style={{ display: activeTab === 'projeto' ? undefined : 'none' }}>
                  <ProjetoTab client={displayClient} editMode={editMode} onRegisterSave={(fn) => registerTabSave('projeto', fn)} onSaved={handleTabSaved} onOpenFinancialProject={onOpenFinancialProject} />
                </div>
                {resolveCobrancaGating(displayClient).enabled && (
                  <div style={{ display: activeTab === 'cobranca' ? undefined : 'none' }}>
                    <CobrancaTab client={displayClient} editMode={editMode} onRegisterSave={(fn) => registerTabSave('cobranca', fn)} onSaved={handleTabSaved} />
                  </div>
                )}
                {displayClient.is_contratante_titular === false && (
                  <div style={{ display: activeTab === 'faturas' ? undefined : 'none' }}>
                    <FaturasTab key={`fs-faturas-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />
                  </div>
                )}
                {activeTab === 'notas' && <NotasTab key={`fs-notas-${refreshKey}`} client={displayClient} />}
              </>
            ) : (
              <>
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
                    editMode={false}
                  />
                )}
                {activeTab === 'usina' && <UsinaTab key={`fs-usina-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} editMode={false} />}
                {activeTab === 'contrato' && <ContratoTab key={`fs-contrato-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} editMode={false} />}
                {activeTab === 'plano' && displayClient.contract_type === 'leasing' && <PlanoLeasingTab key={`fs-plano-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} editMode={false} />}
                {activeTab === 'projeto' && <ProjetoTab key={`fs-projeto-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} onOpenFinancialProject={onOpenFinancialProject} editMode={false} />}
                {activeTab === 'cobranca' && resolveCobrancaGating(displayClient).enabled && <CobrancaTab key={`fs-cobranca-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} editMode={false} />}
                {activeTab === 'faturas' && displayClient.is_contratante_titular === false && <FaturasTab key={`fs-faturas-${refreshKey}`} client={displayClient} onSaved={handleTabSaved} />}
                {activeTab === 'notas' && <NotasTab key={`fs-notas-${refreshKey}`} client={displayClient} />}
              </>
            )}
          </div>
        </ClientPortfolioEditorShell>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export function ClientPortfolioPage({ onBack, onClientRemovedFromPortfolio, onOpenFinancialProject }: Props) {
  const { clients, isLoading, error, reload, setSearch, removeClient } = useClientPortfolio()
  const { deleting, deleteClient } = usePortfolioDelete()
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [showAddClient, setShowAddClient] = useState(false)
  const [sortBy, setSortBy] = useState<'due_date' | 'created_at' | 'name' | 'city'>('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

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

  // Sort clients based on selected criteria
  const sortedClients = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const sorted = [...clients].sort((a, b) => {
      let compareResult = 0
      if (sortBy === 'due_date') {
        const dueDateA = getNextDueDate(a)
        const dueDateB = getNextDueDate(b)

        // Handle null dates (put at end)
        if (!dueDateA && !dueDateB) return 0
        if (!dueDateA) return 1
        if (!dueDateB) return -1

        // Special logic: upcoming dates (>= today) have precedence over overdue dates (< today)
        const isUpcomingA = dueDateA >= today
        const isUpcomingB = dueDateB >= today

        if (isUpcomingA && !isUpcomingB) {
          // A is upcoming, B is overdue → A comes first
          return -1
        } else if (!isUpcomingA && isUpcomingB) {
          // B is upcoming, A is overdue → B comes first
          return 1
        } else {
          // Both upcoming or both overdue → sort by proximity to today
          const diffA = Math.abs(dueDateA.getTime() - today.getTime())
          const diffB = Math.abs(dueDateB.getTime() - today.getTime())
          compareResult = diffA - diffB
        }
      } else if (sortBy === 'name') {
        const nameA = (a.name ?? '').toLowerCase()
        const nameB = (b.name ?? '').toLowerCase()
        compareResult = nameA.localeCompare(nameB, 'pt-BR')
      } else if (sortBy === 'city') {
        const cityA = (a.city ?? '').toLowerCase()
        const cityB = (b.city ?? '').toLowerCase()
        compareResult = cityA.localeCompare(cityB, 'pt-BR')
      } else if (sortBy === 'created_at') {
        const dateA = a.client_created_at ? new Date(a.client_created_at).getTime() : 0
        const dateB = b.client_created_at ? new Date(b.client_created_at).getTime() : 0
        compareResult = dateA - dateB
      }
      return sortDir === 'asc' ? compareResult : -compareResult
    })
    return sorted
  }, [clients, sortBy, sortDir])

  const toggleSort = useCallback((field: 'due_date' | 'created_at' | 'name' | 'city') => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir(field === 'created_at' ? 'desc' : 'asc')
    }
  }, [sortBy, sortDir])

  // Compute billing alerts from all clients for the dashboard widget.
  // Skip clients whose Cobrança tab would be disabled (sale/buyout, inactive
  // contracts, or incomplete plans) so we don't surface notifications for
  // clients that can't be billed.
  const billingAlerts = useMemo(() => {
    if (!hasClients) return []
    const alerts: BillingAlertItem[] = []
    for (const c of clients) {
      if (!resolveCobrancaGating(c).enabled) continue
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

  const confirmDeleteClient = sortedClients.find((c) => c.id === confirmDeleteId)

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
                <span style={{ marginLeft: 8, fontWeight: 600, color: 'var(--accent)' }}>
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

        {/* Sort controls */}
        {!isLoading && hasClients && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>Ordenar por:</span>
            <button
              type="button"
              onClick={() => toggleSort('created_at')}
              style={{
                padding: '5px 10px',
                fontSize: 12,
                borderRadius: 6,
                border: sortBy === 'created_at' ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: sortBy === 'created_at' ? 'var(--accent-bg, rgba(255,140,0,0.1))' : 'transparent',
                color: sortBy === 'created_at' ? 'var(--accent)' : 'var(--text-base)',
                cursor: 'pointer',
                fontWeight: sortBy === 'created_at' ? 600 : 400,
              }}
              title="Clique para ordenar por data de criação"
            >
              Data {sortBy === 'created_at' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
            <button
              type="button"
              onClick={() => toggleSort('name')}
              style={{
                padding: '5px 10px',
                fontSize: 12,
                borderRadius: 6,
                border: sortBy === 'name' ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: sortBy === 'name' ? 'var(--accent-bg, rgba(255,140,0,0.1))' : 'transparent',
                color: sortBy === 'name' ? 'var(--accent)' : 'var(--text-base)',
                cursor: 'pointer',
                fontWeight: sortBy === 'name' ? 600 : 400,
              }}
              title="Clique para ordenar por nome"
            >
              Nome {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
            <button
              type="button"
              onClick={() => toggleSort('city')}
              style={{
                padding: '5px 10px',
                fontSize: 12,
                borderRadius: 6,
                border: sortBy === 'city' ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: sortBy === 'city' ? 'var(--accent-bg, rgba(255,140,0,0.1))' : 'transparent',
                color: sortBy === 'city' ? 'var(--accent)' : 'var(--text-base)',
                cursor: 'pointer',
                fontWeight: sortBy === 'city' ? 600 : 400,
              }}
              title="Clique para ordenar por cidade"
            >
              Cidade {sortBy === 'city' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
          </div>
        )}
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
            <div style={{ color: 'var(--ds-danger)', fontSize: 13 }}>
              <p style={{ marginBottom: 10 }}>❌ {error}</p>
              <button
                type="button"
                onClick={reload}
                className="pf-action-delete"
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
                    className="pf-btn-add-client"
                    style={{ marginTop: 14 }}
                  >
                    ➕ Adicionar Cliente
                  </button>
                </>
              )}
            </div>
          )}
          {!isLoading && !error && hasClients && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sortedClients.map((c) => (
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
              onOpenFinancialProject={onOpenFinancialProject}
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
          variant="danger"
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
