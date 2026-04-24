// src/components/portfolio/FaturasTab.tsx
// Tab for managing client invoices (faturas) for multiple consumer units (UCs).
// Only shown when is_contratante_titular = false (SolarInvest ownership).

import React, { useState, useEffect, useMemo } from 'react'
import type { PortfolioClientRow, ClientInvoice, InvoicePaymentStatus } from '../../types/clientPortfolio'
import {
  fetchClientInvoices,
  createInvoice,
  updateInvoice,
  deleteInvoice,
  registerInvoicePayment,
  type CreateInvoicePayload,
} from '../../services/invoicesApi'

interface FaturasTabProps {
  client: PortfolioClientRow
  onSaved: (patch: Partial<PortfolioClientRow>) => void
}

export function FaturasTab({ client }: FaturasTabProps) {
  const [invoices, setInvoices] = useState<ClientInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New invoice form
  const [showNewInvoiceForm, setShowNewInvoiceForm] = useState(false)
  const [newInvoiceForm, setNewInvoiceForm] = useState({
    uc: '',
    invoice_number: '',
    reference_month: '',
    due_date: '',
    amount: '',
    notes: '',
  })

  // Payment registration modal
  const [paymentModal, setPaymentModal] = useState<{
    invoice: ClientInvoice
  } | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    payment_status: 'pago' as InvoicePaymentStatus,
    receipt_number: '',
    transaction_number: '',
  })

  // Edit invoice modal
  const [editModal, setEditModal] = useState<{
    invoice: ClientInvoice
  } | null>(null)
  const [editForm, setEditForm] = useState({
    uc: '',
    invoice_number: '',
    reference_month: '',
    due_date: '',
    amount: '',
    notes: '',
  })

  // Get all UCs for this client
  const clientUCs = useMemo(() => {
    const ucs: string[] = []
    if (client.uc) ucs.push(client.uc)
    if (client.uc_beneficiarias && Array.isArray(client.uc_beneficiarias)) {
      ucs.push(...client.uc_beneficiarias)
    } else if (client.uc_beneficiaria) {
      ucs.push(client.uc_beneficiaria)
    }
    return ucs.filter((uc) => uc && uc.trim() !== '')
  }, [client.uc, client.uc_beneficiaria, client.uc_beneficiarias])

  // Load invoices
  useEffect(() => {
    loadInvoices()
  }, [client.id])

  async function loadInvoices() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchClientInvoices(client.id)
      setInvoices(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar faturas')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateInvoice() {
    if (!newInvoiceForm.uc || !newInvoiceForm.reference_month || !newInvoiceForm.due_date || !newInvoiceForm.amount) {
      setError('Preencha todos os campos obrigatórios.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const payload: CreateInvoicePayload = {
        client_id: client.id,
        uc: newInvoiceForm.uc,
        invoice_number: newInvoiceForm.invoice_number || null,
        reference_month: newInvoiceForm.reference_month,
        due_date: newInvoiceForm.due_date,
        amount: parseFloat(newInvoiceForm.amount),
        notes: newInvoiceForm.notes || null,
      }
      await createInvoice(payload)
      setNewInvoiceForm({ uc: '', invoice_number: '', reference_month: '', due_date: '', amount: '', notes: '' })
      setShowNewInvoiceForm(false)
      await loadInvoices()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar fatura')
    } finally {
      setSaving(false)
    }
  }

  async function handleRegisterPayment() {
    if (!paymentModal) return

    setSaving(true)
    setError(null)
    try {
      await registerInvoicePayment(paymentModal.invoice.id, {
        payment_status: paymentForm.payment_status,
        receipt_number: paymentForm.receipt_number || null,
        transaction_number: paymentForm.transaction_number || null,
      })
      setPaymentModal(null)
      setPaymentForm({ payment_status: 'pago', receipt_number: '', transaction_number: '' })
      await loadInvoices()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar pagamento')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateInvoice() {
    if (!editModal) return
    if (!editForm.reference_month || !editForm.due_date || !editForm.amount) {
      setError('Preencha todos os campos obrigatórios.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await updateInvoice(editModal.invoice.id, {
        invoice_number: editForm.invoice_number || null,
        reference_month: editForm.reference_month,
        due_date: editForm.due_date,
        amount: parseFloat(editForm.amount),
        notes: editForm.notes || null,
      })
      setEditModal(null)
      await loadInvoices()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar fatura')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteInvoice(invoiceId: number) {
    if (!confirm('Tem certeza que deseja excluir esta fatura?')) return

    setSaving(true)
    setError(null)
    try {
      await deleteInvoice(invoiceId)
      await loadInvoices()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir fatura')
    } finally {
      setSaving(false)
    }
  }

  // Auto-generate invoices from leasing installments
  async function handleAutoGenerateInvoices() {
    // Validate required data
    const contractTermMonths = client.contractual_term_months
    const firstBillingDate = client.first_billing_date
    const readingDay = client.reading_day

    if (!contractTermMonths || contractTermMonths <= 0) {
      setError('Prazo do contrato (meses) não definido na aba Cobrança.')
      return
    }

    if (!firstBillingDate) {
      setError('Data da primeira cobrança não definida na aba Cobrança.')
      return
    }

    if (!readingDay || readingDay < 1 || readingDay > 31) {
      setError('Dia da leitura inválido na aba Cobrança.')
      return
    }

    if (clientUCs.length === 0) {
      setError('Nenhuma UC cadastrada para este cliente.')
      return
    }

    // Show confirmation
    const totalInvoices = contractTermMonths * clientUCs.length
    const confirmMsg = `Gerar ${totalInvoices} faturas automaticamente?\n\n` +
      `${contractTermMonths} meses × ${clientUCs.length} UCs\n` +
      `Início: ${firstBillingDate}\n` +
      `Dia do vencimento: ${readingDay}\n\n` +
      `Valores ficarão em branco para preenchimento durante o pagamento.`

    if (!confirm(confirmMsg)) return

    setSaving(true)
    setError(null)

    try {
      const startDate = new Date(firstBillingDate + 'T00:00:00')
      if (isNaN(startDate.getTime())) {
        throw new Error('Data da primeira cobrança inválida.')
      }

      let createdCount = 0
      let skippedCount = 0

      // Helper: clamp day to valid range for month
      function clampDay(year: number, month: number, day: number): number {
        const lastDay = new Date(year, month + 1, 0).getDate()
        return Math.min(day, lastDay)
      }

      // Generate invoices for each UC and each month
      for (const uc of clientUCs) {
        for (let i = 0; i < contractTermMonths; i++) {
          // Calculate reference month
          const refMonth = startDate.getMonth() + i
          const refYear = startDate.getFullYear() + Math.floor(refMonth / 12)
          const refMonthNormalized = ((refMonth % 12) + 12) % 12
          const referenceMonthStr = `${refYear}-${String(refMonthNormalized + 1).padStart(2, '0')}-01`

          // Calculate due date
          const dueDay = clampDay(refYear, refMonthNormalized, readingDay)
          const dueDateStr = `${refYear}-${String(refMonthNormalized + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`

          // Check if invoice already exists
          const exists = invoices.some(
            (inv) => inv.uc === uc && inv.reference_month === referenceMonthStr
          )

          if (exists) {
            skippedCount++
            continue
          }

          // Create invoice with amount = 0 (blank for later filling)
          const payload: CreateInvoicePayload = {
            client_id: client.id,
            uc,
            invoice_number: null,
            reference_month: referenceMonthStr,
            due_date: dueDateStr,
            amount: 0,
            notes: 'Fatura gerada automaticamente',
          }

          await createInvoice(payload)
          createdCount++
        }
      }

      await loadInvoices()

      if (createdCount > 0) {
        alert(`✓ ${createdCount} faturas criadas com sucesso!${skippedCount > 0 ? `\n${skippedCount} faturas já existiam e foram ignoradas.` : ''}`)
      } else {
        alert('Nenhuma fatura foi criada. Todas as faturas já existem.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar faturas automaticamente')
    } finally {
      setSaving(false)
    }
  }

  // Group invoices by reference month
  const invoicesByMonth = useMemo(() => {
    const grouped: Record<string, ClientInvoice[]> = {}
    for (const inv of invoices) {
      const key = inv.reference_month
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(inv)
    }
    return grouped
  }, [invoices])

  // Check if all invoices for a month are paid
  const isMonthComplete = (monthInvoices: ClientInvoice[]): boolean => {
    return monthInvoices.every((inv) => inv.payment_status === 'pago' || inv.payment_status === 'confirmado')
  }

  // Format currency
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  // Format date
  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('pt-BR')
  }

  // Status badge
  const StatusBadge = ({ status }: { status: InvoicePaymentStatus }) => {
    const styles: Record<InvoicePaymentStatus, { bg: string; fg: string; label: string }> = {
      pendente: { bg: '#fee', fg: '#c00', label: '⏳ Pendente' },
      pago: { bg: '#efe', fg: '#060', label: '✓ Pago' },
      confirmado: { bg: '#dfd', fg: '#050', label: '✓✓ Confirmado' },
      vencida: { bg: '#fdd', fg: '#900', label: '⚠ Vencida' },
    }
    const s = styles[status] || styles.pendente
    return (
      <span
        style={{
          display: 'inline-block',
          padding: '3px 8px',
          borderRadius: 4,
          background: s.bg,
          color: s.fg,
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        {s.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="pf-section-card">
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
          Carregando faturas...
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {/* Header */}
      <div className="pf-section-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="pf-section-title">
              <span className="pf-icon">🧾</span> Faturas da Distribuidora
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Gerenciar faturas das unidades consumidoras sob titularidade da SolarInvest
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={handleAutoGenerateInvoices}
              disabled={saving}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #10b981',
                background: '#10b981',
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 13,
                fontWeight: 600,
                opacity: saving ? 0.6 : 1,
              }}
              title="Gerar faturas automaticamente com base nas parcelas de leasing"
            >
              ⚡ Gerar Automaticamente
            </button>
            <button
              type="button"
              onClick={() => setShowNewInvoiceForm(!showNewInvoiceForm)}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #8b5cf6',
                background: '#8b5cf6',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {showNewInvoiceForm ? 'Cancelar' : '+ Nova Fatura'}
            </button>
          </div>
        </div>

        {/* UCs summary */}
        {clientUCs.length > 0 && (
          <div style={{ marginTop: 12, padding: 10, background: 'var(--ghost-bg)', borderRadius: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Unidades Consumidoras ({clientUCs.length}):
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {clientUCs.join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div style={{ padding: 12, background: '#fee', border: '1px solid #fcc', borderRadius: 6, color: '#c00', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* New invoice form */}
      {showNewInvoiceForm && (
        <div className="pf-section-card">
          <div className="pf-section-title">📝 Nova Fatura</div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="pf-label">
                UC *
                <select
                  value={newInvoiceForm.uc}
                  onChange={(e) => setNewInvoiceForm((f) => ({ ...f, uc: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                >
                  <option value="">Selecione uma UC...</option>
                  {clientUCs.map((uc) => (
                    <option key={uc} value={uc}>{uc}</option>
                  ))}
                </select>
              </label>
              <label className="pf-label">
                Número da Fatura
                <input
                  type="text"
                  value={newInvoiceForm.invoice_number}
                  onChange={(e) => setNewInvoiceForm((f) => ({ ...f, invoice_number: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                  placeholder="Ex: 123456789"
                />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <label className="pf-label">
                Mês de Referência *
                <input
                  type="month"
                  value={newInvoiceForm.reference_month ? newInvoiceForm.reference_month.slice(0, 7) : ''}
                  onChange={(e) => setNewInvoiceForm((f) => ({ ...f, reference_month: e.target.value + '-01' }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                />
              </label>
              <label className="pf-label">
                Data de Vencimento *
                <input
                  type="date"
                  value={newInvoiceForm.due_date}
                  onChange={(e) => setNewInvoiceForm((f) => ({ ...f, due_date: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                />
              </label>
              <label className="pf-label">
                Valor (R$) *
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newInvoiceForm.amount}
                  onChange={(e) => setNewInvoiceForm((f) => ({ ...f, amount: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                  placeholder="0.00"
                />
              </label>
            </div>
            <label className="pf-label">
              Observações
              <textarea
                value={newInvoiceForm.notes}
                onChange={(e) => setNewInvoiceForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontFamily: 'inherit' }}
                placeholder="Observações adicionais..."
              />
            </label>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => {
                  setShowNewInvoiceForm(false)
                  setNewInvoiceForm({ uc: '', invoice_number: '', reference_month: '', due_date: '', amount: '', notes: '' })
                }}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCreateInvoice}
                disabled={saving}
                style={{
                  padding: '7px 16px',
                  borderRadius: 6,
                  border: '1px solid #8b5cf6',
                  background: '#8b5cf6',
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Salvando...' : 'Criar Fatura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoices by month */}
      {Object.keys(invoicesByMonth).length === 0 ? (
        <div className="pf-section-card">
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
            Nenhuma fatura cadastrada. Clique em "+ Nova Fatura" para adicionar.
          </div>
        </div>
      ) : (
        Object.keys(invoicesByMonth)
          .sort()
          .reverse()
          .map((month) => {
            const monthInvoices = invoicesByMonth[month]
            const complete = isMonthComplete(monthInvoices)
            const monthDate = new Date(month + 'T00:00:00')
            const monthLabel = monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

            return (
              <div key={month} className="pf-section-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div className="pf-section-title">
                    📅 {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}
                  </div>
                  {complete && (
                    <span style={{ fontSize: 12, color: '#060', fontWeight: 600 }}>
                      ✓ Completo ({monthInvoices.length} UC{monthInvoices.length > 1 ? 's' : ''})
                    </span>
                  )}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>UC</th>
                      <th style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 600 }}>Nº Fatura</th>
                      <th style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 600 }}>Vencimento</th>
                      <th style={{ textAlign: 'right', padding: '8px 4px', fontWeight: 600 }}>Valor</th>
                      <th style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 600 }}>Status</th>
                      <th style={{ textAlign: 'center', padding: '8px 4px', fontWeight: 600 }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthInvoices.map((inv) => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '10px 4px', fontFamily: 'monospace' }}>{inv.uc}</td>
                        <td style={{ padding: '10px 4px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-muted)' }}>
                          {inv.invoice_number || '—'}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                          {formatDate(inv.due_date)}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 600 }}>
                          {formatCurrency(inv.amount)}
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                          <StatusBadge status={inv.payment_status} />
                        </td>
                        <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                          {inv.payment_status === 'pendente' || inv.payment_status === 'vencida' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPaymentModal({ invoice: inv })
                                setPaymentForm({ payment_status: 'pago', receipt_number: '', transaction_number: '' })
                              }}
                              style={{
                                padding: '4px 12px',
                                borderRadius: 4,
                                border: '1px solid #16a34a',
                                background: '#16a34a',
                                color: '#fff',
                                cursor: 'pointer',
                                fontSize: 11,
                                fontWeight: 600,
                                marginRight: 4,
                              }}
                            >
                              Pagar
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {inv.payment_receipt_number ? `Recibo: ${inv.payment_receipt_number}` : '—'}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditModal({ invoice: inv })
                              setEditForm({
                                uc: inv.uc,
                                invoice_number: inv.invoice_number || '',
                                reference_month: inv.reference_month,
                                due_date: inv.due_date,
                                amount: String(inv.amount),
                                notes: inv.notes || '',
                              })
                            }}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: '1px solid #3b82f6',
                              background: 'transparent',
                              color: '#3b82f6',
                              cursor: 'pointer',
                              fontSize: 11,
                              marginRight: 4,
                            }}
                            title="Editar fatura"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteInvoice(inv.id)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: '1px solid #dc2626',
                              background: 'transparent',
                              color: '#dc2626',
                              cursor: 'pointer',
                              fontSize: 11,
                            }}
                            title="Excluir fatura"
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })
      )}

      {/* Payment registration modal */}
      {paymentModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setPaymentModal(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 10,
              padding: 24,
              maxWidth: 500,
              width: '90%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              Registrar Pagamento
            </div>
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
              <strong>UC:</strong> {paymentModal.invoice.uc}<br />
              <strong>Vencimento:</strong> {formatDate(paymentModal.invoice.due_date)}<br />
              <strong>Valor:</strong> {formatCurrency(paymentModal.invoice.amount)}
            </div>
            <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
              <label className="pf-label">
                Status do Pagamento
                <select
                  value={paymentForm.payment_status}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, payment_status: e.target.value as InvoicePaymentStatus }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                >
                  <option value="pago">Pago</option>
                  <option value="confirmado">Confirmado</option>
                </select>
              </label>
              <label className="pf-label">
                Número do Recibo
                <input
                  type="text"
                  value={paymentForm.receipt_number}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, receipt_number: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                  placeholder="Ex: REC-123456"
                />
              </label>
              <label className="pf-label">
                Número da Transação
                <input
                  type="text"
                  value={paymentForm.transaction_number}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, transaction_number: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                  placeholder="Ex: TRX-789012"
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPaymentModal(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRegisterPayment}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #16a34a',
                  background: '#16a34a',
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Salvando...' : 'Confirmar Pagamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit invoice modal */}
      {editModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setEditModal(null)}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 10,
              padding: 24,
              maxWidth: 600,
              width: '90%',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              Editar Fatura
            </div>
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
              <strong>UC:</strong> {editModal.invoice.uc}
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <label className="pf-label">
                Número da Fatura
                <input
                  type="text"
                  value={editForm.invoice_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, invoice_number: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                  placeholder="Ex: 123456789"
                />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <label className="pf-label">
                  Mês de Referência *
                  <input
                    type="month"
                    value={editForm.reference_month ? editForm.reference_month.slice(0, 7) : ''}
                    onChange={(e) => setEditForm((f) => ({ ...f, reference_month: e.target.value + '-01' }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>
                <label className="pf-label">
                  Data de Vencimento *
                  <input
                    type="date"
                    value={editForm.due_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, due_date: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>
                <label className="pf-label">
                  Valor (R$) *
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.amount}
                    onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)' }}
                  />
                </label>
              </div>
              <label className="pf-label">
                Observações
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', fontFamily: 'inherit' }}
                  placeholder="Observações adicionais..."
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setEditModal(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdateInvoice}
                disabled={saving}
                style={{
                  padding: '8px 16px',
                  borderRadius: 6,
                  border: '1px solid #3b82f6',
                  background: '#3b82f6',
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: 13,
                  fontWeight: 600,
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
