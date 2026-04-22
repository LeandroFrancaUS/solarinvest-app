// src/components/financial-import/FinancialImportModal.tsx
// Excel (.xlsx) import wizard for Gestão Financeira.
//
// Steps:
//   1. Upload   — drag & drop or click to select .xlsx
//   2. Preview  — table of detected items + match status
//   3. Confirm  — trigger actual import
//   4. Report   — show what was created/updated

import React, { useCallback, useRef, useState } from 'react'
import type {
  ParseResult,
  PreviewItem,
  ConfirmResult,
  ClientMatchType,
} from '../../services/financialImportApi'
import { parseImportFile, confirmImportFile } from '../../services/financialImportApi'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'confirm' | 'report'

interface Props {
  onClose: () => void
  onImportComplete?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const MATCH_LABELS: Record<ClientMatchType, string> = {
  exact: 'Exato',
  probable: 'Provável',
  weak: 'Fraco',
  none: 'Novo',
}

const MATCH_BADGE_CLASS: Record<ClientMatchType, string> = {
  exact: 'fim-badge fim-badge--exact',
  probable: 'fim-badge fim-badge--probable',
  weak: 'fim-badge fim-badge--weak',
  none: 'fim-badge fim-badge--none',
}

const SHEET_TYPE_LABELS: Record<string, string> = {
  sale_project: 'Projeto Venda',
  leasing_project: 'Projeto Leasing',
  fixed_costs: 'Custos Fixos',
  variable_costs: 'Custos Variados',
  unknown: 'Desconhecido',
}

function fmtBRL(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '—'
  return `${n.toFixed(1)}%`
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: Step[] = ['upload', 'preview', 'confirm', 'report']
  const labels: Record<Step, string> = {
    upload: '1. Upload',
    preview: '2. Preview',
    confirm: '3. Importar',
    report: '4. Relatório',
  }
  return (
    <div className="fim-steps">
      {steps.map((s) => (
        <span
          key={s}
          className={`fim-step ${step === s ? 'fim-step--active' : ''} ${
            steps.indexOf(s) < steps.indexOf(step) ? 'fim-step--done' : ''
          }`}
        >
          {labels[s]}
        </span>
      ))}
    </div>
  )
}

function PreviewTable({ items }: { items: PreviewItem[] }) {
  const projectItems = items.filter(
    (i) => i.worksheetType === 'sale_project' || i.worksheetType === 'leasing_project',
  )
  const costItems = items.filter(
    (i) => i.worksheetType === 'fixed_costs' || i.worksheetType === 'variable_costs',
  )

  return (
    <div className="fim-preview">
      {projectItems.length > 0 && (
        <>
          <h4 className="fim-section-title">Projetos detectados ({projectItems.length})</h4>
          <div className="fim-table-wrap">
            <table className="fim-table">
              <thead>
                <tr>
                  <th>Aba</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>UF</th>
                  <th>Potência</th>
                  <th>CAPEX</th>
                  <th>ROI</th>
                  <th>Match</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projectItems.map((item, i) => {
                  const mt = item.match?.clientMatchType ?? 'none'
                  const fin = item.financeiro as Record<string, number> | null
                  const usi = item.usina as Record<string, number | string> | null
                  return (
                    <tr key={i} className={mt === 'none' ? 'fim-row--new' : ''}>
                      <td>{item.sheetName}</td>
                      <td>{SHEET_TYPE_LABELS[item.worksheetType] ?? item.worksheetType}</td>
                      <td className="fim-cell-name">{item.clientName ?? '—'}</td>
                      <td>{item.uf ?? '—'}</td>
                      <td>{usi?.potencia_instalada_kwp != null ? `${usi.potencia_instalada_kwp} kWp` : '—'}</td>
                      <td>{fmtBRL(fin?.capex_total)}</td>
                      <td>{fmtPct(fin?.roi_percent)}</td>
                      <td>
                        <span className={MATCH_BADGE_CLASS[mt]}>
                          {MATCH_LABELS[mt]}
                          {item.match?.clientConfidence
                            ? ` ${Math.round(item.match.clientConfidence * 100)}%`
                            : ''}
                        </span>
                      </td>
                      <td>
                        {mt === 'none' ? (
                          <span className="fim-badge fim-badge--create">Criar</span>
                        ) : (
                          <span className="fim-badge fim-badge--link">Vincular</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {costItems.length > 0 && (
        <>
          <h4 className="fim-section-title" style={{ marginTop: 20 }}>
            Lançamentos de custo ({costItems.length})
          </h4>
          <div className="fim-table-wrap">
            <table className="fim-table">
              <thead>
                <tr>
                  <th>Aba</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th>Categoria</th>
                </tr>
              </thead>
              <tbody>
                {costItems.map((item, i) => {
                  const e = item.entry
                  const desc = e?.description
                  const cat = e?.category
                  return (
                    <tr key={i}>
                      <td>{item.sheetName}</td>
                      <td>{SHEET_TYPE_LABELS[item.worksheetType]}</td>
                      <td>{typeof desc === 'string' ? desc : '—'}</td>
                      <td>{fmtBRL(typeof e?.amount === 'number' ? e.amount : null)}</td>
                      <td>{typeof cat === 'string' ? cat : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function ReportView({ result }: { result: ConfirmResult }) {
  const { counters, warnings, report } = result
  return (
    <div className="fim-report">
      <div className="fim-report-kpis">
        <div className="fim-kpi">
          <span className="fim-kpi-value">{counters.total_created_clients}</span>
          <span className="fim-kpi-label">Clientes criados</span>
        </div>
        <div className="fim-kpi">
          <span className="fim-kpi-value">{counters.total_created_proposals}</span>
          <span className="fim-kpi-label">Propostas criadas</span>
        </div>
        <div className="fim-kpi">
          <span className="fim-kpi-value">{counters.total_created_projects}</span>
          <span className="fim-kpi-label">Projetos criados</span>
        </div>
        <div className="fim-kpi">
          <span className="fim-kpi-value">{counters.total_created_entries}</span>
          <span className="fim-kpi-label">Lançamentos</span>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="fim-warnings">
          <strong>⚠️ Avisos:</strong>
          <ul>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {report.length > 0 && (
        <>
          <h4 className="fim-section-title">Detalhes da importação</h4>
          <div className="fim-table-wrap">
            <table className="fim-table">
              <thead>
                <tr>
                  <th>Aba</th>
                  <th>Cliente</th>
                  <th>UF</th>
                  <th>Cliente</th>
                  <th>Proposta</th>
                  <th>Projeto</th>
                </tr>
              </thead>
              <tbody>
                {report.map((row, i) => (
                  <tr key={i}>
                    <td>{row.sheet}</td>
                    <td>{row.clientName ?? '—'}</td>
                    <td>{row.uf ?? '—'}</td>
                    <td>
                      {row.client ? (
                        <span className={`fim-badge fim-badge--${row.client.status === 'created' ? 'create' : 'link'}`}>
                          {row.client.status === 'created' ? 'Criado' : 'Vinculado'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {row.proposal ? (
                        <span className={`fim-badge fim-badge--${row.proposal.status === 'created' ? 'create' : 'link'}`}>
                          {row.proposal.status === 'created' ? 'Criada' : 'Vinculada'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {row.project ? (
                        <span className={`fim-badge fim-badge--${row.project.status === 'created' ? 'create' : 'link'}`}>
                          {row.project.status === 'created' ? 'Criado' : 'Vinculado'}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Modal
// ─────────────────────────────────────────────────────────────────────────────

export function FinancialImportModal({ onClose, onImportComplete }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetError = () => setError(null)

  // ── File selection ─────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((selected: File | null) => {
    if (!selected) return
    if (!selected.name.toLowerCase().endsWith('.xlsx')) {
      setError('Apenas arquivos .xlsx são aceitos.')
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Limite: 10 MB.')
      return
    }
    setError(null)
    setFile(selected)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const dropped = e.dataTransfer.files[0] ?? null
      handleFileSelect(dropped)
    },
    [handleFileSelect],
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => setDragging(false)

  // ── Step: parse/preview ────────────────────────────────────────────────────

  const handleParse = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const result = await parseImportFile(file)
      setParseResult(result)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step: confirm import ───────────────────────────────────────────────────

  const handleConfirm = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const result = await confirmImportFile(file)
      setConfirmResult(result)
      setStep('report')
      onImportComplete?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar dados.')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const totalItems = parseResult?.items.length ?? 0
  const newClients = parseResult?.summary.total_new_clients ?? 0
  const conflicts = parseResult?.summary.total_conflicts ?? 0

  return (
    <div className="fim-overlay" role="dialog" aria-modal="true" aria-label="Importar Excel">
      <div className="fim-modal">
        {/* Header */}
        <div className="fim-header">
          <div>
            <h2 className="fim-title">📥 Importar Planilha Excel</h2>
            <p className="fim-subtitle">Importe projetos, propostas e custos via arquivo .xlsx</p>
          </div>
          <button className="fim-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <StepIndicator step={step} />

        {/* Error */}
        {error && (
          <div className="fim-error" role="alert">
            <span>⚠️ {error}</span>
            <button onClick={resetError} className="fim-error-dismiss">✕</button>
          </div>
        )}

        {/* Step: Upload */}
        {step === 'upload' && (
          <div className="fim-body">
            <div
              className={`fim-dropzone ${dragging ? 'fim-dropzone--dragging' : ''} ${file ? 'fim-dropzone--has-file' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="fim-file-input"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="fim-file-info">
                  <span className="fim-file-icon">📊</span>
                  <span className="fim-file-name">{file.name}</span>
                  <span className="fim-file-size">
                    {(file.size / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} KB
                  </span>
                  <button
                    className="fim-file-remove"
                    onClick={(e) => { e.stopPropagation(); setFile(null) }}
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <div className="fim-dropzone-hint">
                  <span className="fim-dropzone-icon">📂</span>
                  <span>Arraste ou clique para selecionar um arquivo <strong>.xlsx</strong></span>
                  <span className="fim-dropzone-sub">Tamanho máximo: 10 MB</span>
                </div>
              )}
            </div>

            <div className="fim-format-hint">
              <strong>Formatos suportados:</strong>
              <ul>
                <li><em>Projeto Venda</em> — colunas: cliente, uf, potência, custo_kit, frete, valor_contrato, roi, payback, tir</li>
                <li><em>Projeto Leasing</em> — colunas: cliente, uf, kwh_mes, mensalidade, capex_total, roi, payback, tir</li>
                <li><em>Custos Fixos</em> — colunas: descrição, valor, categoria</li>
                <li><em>Custos Variados</em> — colunas: descrição, valor, categoria, cliente (opcional)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === 'preview' && parseResult && (
          <div className="fim-body">
            <div className="fim-preview-summary">
              <div className="fim-kpi fim-kpi--sm">
                <span className="fim-kpi-value">{totalItems}</span>
                <span className="fim-kpi-label">Itens detectados</span>
              </div>
              <div className="fim-kpi fim-kpi--sm fim-kpi--green">
                <span className="fim-kpi-value">{totalItems - newClients}</span>
                <span className="fim-kpi-label">Clientes existentes</span>
              </div>
              <div className="fim-kpi fim-kpi--sm fim-kpi--blue">
                <span className="fim-kpi-value">{newClients}</span>
                <span className="fim-kpi-label">Clientes novos</span>
              </div>
              {conflicts > 0 && (
                <div className="fim-kpi fim-kpi--sm fim-kpi--warn">
                  <span className="fim-kpi-value">{conflicts}</span>
                  <span className="fim-kpi-label">Conflitos</span>
                </div>
              )}
            </div>

            {parseResult.warnings.length > 0 && (
              <div className="fim-warnings">
                {parseResult.warnings.map((w, i) => (
                  <div key={i}>⚠️ {w}</div>
                ))}
              </div>
            )}

            <PreviewTable items={parseResult.items} />
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && parseResult && (
          <div className="fim-body">
            <div className="fim-confirm-msg">
              <p>
                Você está prestes a importar <strong>{totalItems}</strong> item(ns).
              </p>
              <ul>
                <li>
                  <strong>{newClients}</strong> cliente(s) será(ão) criado(s)
                </li>
                <li>
                  <strong>{totalItems - newClients}</strong> cliente(s) será(ão) vinculado(s)
                </li>
                {conflicts > 0 && (
                  <li className="fim-text-warn">
                    <strong>{conflicts}</strong> item(ns) com correspondência fraca — clientes novos serão criados
                  </li>
                )}
              </ul>
              <p className="fim-confirm-note">
                Esta operação é auditável. Você pode consultar o histórico de importações após a conclusão.
              </p>
            </div>
          </div>
        )}

        {/* Step: Report */}
        {step === 'report' && confirmResult && (
          <div className="fim-body">
            <div className="fim-success-banner">
              ✅ Importação concluída com sucesso!
            </div>
            <ReportView result={confirmResult} />
          </div>
        )}

        {/* Footer */}
        <div className="fim-footer">
          {step !== 'report' && (
            <button className="fim-btn fim-btn--secondary" onClick={onClose} disabled={loading}>
              Cancelar
            </button>
          )}

          {step === 'upload' && (
            <button
              className="fim-btn fim-btn--primary"
              onClick={() => { void handleParse() }}
              disabled={!file || loading}
            >
              {loading ? 'Analisando…' : 'Analisar →'}
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                className="fim-btn fim-btn--secondary"
                onClick={() => { setStep('upload'); setParseResult(null) }}
                disabled={loading}
              >
                ← Voltar
              </button>
              <button
                className="fim-btn fim-btn--primary"
                onClick={() => setStep('confirm')}
                disabled={loading || totalItems === 0}
              >
                Prosseguir →
              </button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <button
                className="fim-btn fim-btn--secondary"
                onClick={() => setStep('preview')}
                disabled={loading}
              >
                ← Voltar
              </button>
              <button
                className="fim-btn fim-btn--confirm"
                onClick={() => { void handleConfirm() }}
                disabled={loading}
              >
                {loading ? 'Importando…' : '✅ Confirmar importação'}
              </button>
            </>
          )}

          {step === 'report' && (
            <button className="fim-btn fim-btn--primary" onClick={onClose}>
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
