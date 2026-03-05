import React, { useCallback, useId, useRef, useState } from 'react'
import type { PropostaImportData } from '../types/proposalImport'
import type { ClienteDados } from '../types/printableProposal'
import type { BudgetUploadProgress } from '../app/services/budgetUpload'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImportPhase =
  | 'file-pick'
  | 'processing'
  | 'unsaved-warning'
  | 'identical-confirm'
  | 'client-diff'
  | 'new-client'
  | 'error'

type ImportState =
  | { phase: 'file-pick' }
  | { phase: 'processing'; progress: BudgetUploadProgress | null }
  | { phase: 'unsaved-warning'; pendingData: PropostaImportData }
  | { phase: 'identical-confirm'; data: PropostaImportData }
  | {
      phase: 'client-diff'
      data: PropostaImportData
      existingCliente: ClienteDados
      diffs: FieldDiff[]
    }
  | { phase: 'new-client'; data: PropostaImportData }
  | { phase: 'error'; message: string }

export type FieldDiff = {
  label: string
  imported: string
  existing: string
}

export type PdfImportDialogProps = {
  isOpen: boolean
  onClose: () => void
  hasUnsavedChanges: boolean
  /**
   * Find an existing client by nome/documento. Returns `null` if not found.
   * Returns a `ClienteDados` if a match exists.
   */
  findExistingCliente: (data: PropostaImportData) => ClienteDados | null
  /**
   * Returns `true` when the import data is identical to the currently loaded state.
   */
  isCurrentData: (data: PropostaImportData) => boolean
  /**
   * Called when the user confirms the import. App.tsx is responsible for
   * applying the data to the form.
   */
  onConfirmImport: (data: PropostaImportData) => void
  /**
   * Called by the dialog to extract text from a PDF file.
   * Returns plainText or throws.
   */
  extractTextFromFile: (
    file: File,
    onProgress: (p: BudgetUploadProgress) => void,
  ) => Promise<string>
  /**
   * Parse import data from plain PDF text.
   * Returns `null` if no embedded marker is found.
   */
  extractImportData: (text: string) => PropostaImportData | null
  /** Compute diff between imported client and existing client. */
  computeDiffs: (imported: ClienteDados, existing: ClienteDados) => FieldDiff[]
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const PHASE_TITLE: Record<ImportPhase, string> = {
  'file-pick': 'Importar proposta em PDF',
  processing: 'Processando PDF…',
  'unsaved-warning': 'Dados não salvos',
  'identical-confirm': 'Proposta já existe',
  'client-diff': 'Cliente já cadastrado',
  'new-client': 'Novo cliente detectado',
  error: 'Erro na importação',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PdfImportDialog({
  isOpen,
  onClose,
  hasUnsavedChanges,
  findExistingCliente,
  isCurrentData,
  onConfirmImport,
  extractTextFromFile,
  extractImportData,
  computeDiffs,
}: PdfImportDialogProps) {
  const titleId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<ImportState>({ phase: 'file-pick' })
  const [dragOver, setDragOver] = useState(false)

  const resetToFilePick = useCallback(() => {
    setState({ phase: 'file-pick' })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const advanceToComparison = useCallback(
    (importData: PropostaImportData) => {
      // Scenario 1: Data identical to current
      if (isCurrentData(importData)) {
        setState({ phase: 'identical-confirm', data: importData })
        return
      }

      // Scenario 2 / 3: Check for existing client
      const existing = findExistingCliente(importData)
      if (existing) {
        const diffs = computeDiffs(importData.cliente, existing)
        setState({ phase: 'client-diff', data: importData, existingCliente: existing, diffs })
        return
      }

      // Scenario 3: New client
      setState({ phase: 'new-client', data: importData })
    },
    [computeDiffs, findExistingCliente, isCurrentData],
  )

  const processFile = useCallback(
    async (file: File, bypassUnsavedWarning = false) => {
      if (!bypassUnsavedWarning && hasUnsavedChanges) {
        // We need to show the unsaved warning first; process after confirmation.
        // We'll store the file reference via a temporary processing step.
        setState({ phase: 'processing', progress: null })
        let text: string
        try {
          text = await extractTextFromFile(file, (p) =>
            setState({ phase: 'processing', progress: p }),
          )
        } catch (error) {
          setState({
            phase: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Não foi possível processar o arquivo PDF.',
          })
          return
        }

        const importData = extractImportData(text)
        if (!importData) {
          setState({
            phase: 'error',
            message:
              'Este PDF não contém dados de importação reconhecidos pela SolarInvest. ' +
              'Certifique-se de importar uma proposta gerada pela ferramenta de geração de propostas.',
          })
          return
        }

        // Show unsaved warning before proceeding.
        setState({ phase: 'unsaved-warning', pendingData: importData })
        return
      }

      setState({ phase: 'processing', progress: null })

      let text: string
      try {
        text = await extractTextFromFile(file, (p) =>
          setState({ phase: 'processing', progress: p }),
        )
      } catch (error) {
        setState({
          phase: 'error',
          message:
            error instanceof Error ? error.message : 'Não foi possível processar o arquivo PDF.',
        })
        return
      }

      const importData = extractImportData(text)
      if (!importData) {
        setState({
          phase: 'error',
          message:
            'Este PDF não contém dados de importação reconhecidos pela SolarInvest. ' +
            'Certifique-se de importar uma proposta gerada pela ferramenta de geração de propostas.',
        })
        return
      }

      advanceToComparison(importData)
    },
    [advanceToComparison, extractImportData, extractTextFromFile, hasUnsavedChanges],
  )

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) {
        void processFile(file)
      }
    },
    [processFile],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setDragOver(false)
      const file = event.dataTransfer.files[0]
      if (file) {
        void processFile(file)
      }
    },
    [processFile],
  )

  const handleClose = useCallback(() => {
    resetToFilePick()
    onClose()
  }, [onClose, resetToFilePick])

  if (!isOpen) {
    return null
  }

  const phase = state.phase

  return (
    <div
      className="modal pdf-import-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="modal-backdrop modal-backdrop--opaque" onClick={handleClose} />
      <div className="modal-content pdf-import-modal__content">
        <div className="modal-header">
          <h3 id={titleId}>{PHASE_TITLE[phase]}</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={handleClose}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* ---- File Pick ---- */}
        {phase === 'file-pick' && (
          <div className="modal-body">
            <p className="pdf-import-modal__description">
              Selecione ou arraste uma proposta em PDF gerada pela SolarInvest para importar as
              informações do cliente e da proposta de volta ao formulário.
            </p>
            <div
              className={`pdf-import-dropzone${dragOver ? ' pdf-import-dropzone--over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  fileInputRef.current?.click()
                }
              }}
              aria-label="Área para selecionar ou arrastar PDF"
            >
              <span className="pdf-import-dropzone__icon" aria-hidden="true">
                📄
              </span>
              <span className="pdf-import-dropzone__text">
                Clique para selecionar ou arraste o PDF aqui
              </span>
              <span className="pdf-import-dropzone__hint">.pdf · máx. 40 MB</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="pdf-import-file-input"
                onChange={handleFileChange}
                aria-hidden="true"
                tabIndex={-1}
              />
            </div>
          </div>
        )}

        {/* ---- Processing ---- */}
        {phase === 'processing' && (
          <div className="modal-body pdf-import-modal__processing">
            <ProgressIndicator progress={state.progress} />
          </div>
        )}

        {/* ---- Unsaved Warning ---- */}
        {phase === 'unsaved-warning' && (
          <>
            <div className="modal-body">
              <p>
                Existem dados inseridos manualmente no formulário que ainda não foram salvos. Se
                prosseguir com a importação,{' '}
                <strong>todos esses dados serão descartados</strong> e o formulário será
                preenchido com as informações do PDF.
              </p>
              <p>Deseja prosseguir mesmo assim?</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={handleClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  const { pendingData } = state
                  advanceToComparison(pendingData)
                }}
              >
                Prosseguir com a importação
              </button>
            </div>
          </>
        )}

        {/* ---- Identical Confirm ---- */}
        {phase === 'identical-confirm' && (
          <>
            <div className="modal-body">
              <p>
                Esta proposta já está carregada no sistema com dados idênticos aos do arquivo PDF.
              </p>
              <p>Deseja recarregar as informações do PDF (isso descartará as alterações atuais)?</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={handleClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  onConfirmImport(state.data)
                  handleClose()
                }}
              >
                Recarregar do PDF
              </button>
            </div>
          </>
        )}

        {/* ---- Client Diff ---- */}
        {phase === 'client-diff' && (
          <>
            <div className="modal-body">
              <p>
                O cliente <strong>{state.data.cliente.nome}</strong> já está cadastrado no sistema,
                mas os dados do PDF são diferentes dos cadastrados.
              </p>
              {state.diffs.length > 0 ? (
                <>
                  <p className="pdf-import-modal__diff-title">O que seria alterado:</p>
                  <table className="pdf-import-modal__diff-table">
                    <thead>
                      <tr>
                        <th>Campo</th>
                        <th>Cadastrado</th>
                        <th>Importado (PDF)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.diffs.map((diff) => (
                        <tr key={diff.label}>
                          <td>{diff.label}</td>
                          <td>{diff.existing || '—'}</td>
                          <td>{diff.imported || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              ) : (
                <p>Os dados são iguais, mas a proposta possui outras diferenças nos parâmetros.</p>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={handleClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  onConfirmImport(state.data)
                  handleClose()
                }}
              >
                Importar dados do PDF
              </button>
            </div>
          </>
        )}

        {/* ---- New Client ---- */}
        {phase === 'new-client' && (
          <>
            <div className="modal-body">
              {state.data.cliente.nome ? (
                <p>
                  O cliente <strong>{state.data.cliente.nome}</strong> não está cadastrado no
                  sistema. As informações da proposta serão importadas como um novo cliente.
                </p>
              ) : (
                <p>
                  As informações da proposta serão importadas e preenchidas no formulário como um
                  novo cliente.
                </p>
              )}
              <PropostaImportSummary data={state.data} />
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={handleClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => {
                  onConfirmImport(state.data)
                  handleClose()
                }}
              >
                Importar como novo cliente
              </button>
            </div>
          </>
        )}

        {/* ---- Error ---- */}
        {phase === 'error' && (
          <>
            <div className="modal-body">
              <p className="pdf-import-modal__error">{state.message}</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={resetToFilePick}>
                Tentar novamente
              </button>
              <button type="button" className="primary" onClick={handleClose}>
                Fechar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ProgressIndicator({ progress }: { progress: BudgetUploadProgress | null }) {
  const stageLabel: Record<BudgetUploadProgress['stage'], string> = {
    carregando: 'Carregando arquivo…',
    texto: 'Extraindo texto…',
    ocr: 'Reconhecimento óptico (OCR)…',
    parse: 'Analisando dados…',
  }

  if (!progress) {
    return (
      <p className="pdf-import-modal__progress-text">Preparando processamento do arquivo…</p>
    )
  }

  const { stage, progress: pct } = progress
  return (
    <div className="pdf-import-modal__progress">
      <p className="pdf-import-modal__progress-text">{stageLabel[stage]}</p>
      <div className="pdf-import-progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={1}>
        <div
          className="pdf-import-progress-bar__fill"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      {progress.totalPages > 1 && (
        <p className="pdf-import-modal__progress-pages">
          Página {progress.page} de {progress.totalPages}
        </p>
      )}
    </div>
  )
}

function PropostaImportSummary({ data }: { data: PropostaImportData }) {
  const rows: Array<{ label: string; value: string }> = []

  if (data.tipo) {
    rows.push({
      label: 'Tipo',
      value: data.tipo === 'VENDA_DIRETA' ? 'Venda direta' : 'Leasing solar',
    })
  }
  if (data.consumo_kwh_mes) {
    rows.push({ label: 'Consumo', value: `${data.consumo_kwh_mes} kWh/mês` })
  }
  if (data.tarifa_r_kwh) {
    rows.push({
      label: 'Tarifa',
      value: `R$ ${data.tarifa_r_kwh.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}/kWh`,
    })
  }
  if (data.n_modulos && data.potencia_modulo_wp) {
    rows.push({
      label: 'Sistema',
      value: `${data.n_modulos} módulos × ${data.potencia_modulo_wp} Wp`,
    })
  }
  if ((data.orcamento_itens?.length ?? 0) > 0) {
    rows.push({ label: 'Itens no orçamento', value: String(data.orcamento_itens!.length) })
  }

  if (rows.length === 0) {
    return null
  }

  return (
    <table className="pdf-import-modal__summary-table">
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th>{row.label}</th>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
