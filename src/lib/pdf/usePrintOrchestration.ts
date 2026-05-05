/**
 * Hook that owns all print/PDF orchestration state and handlers.
 *
 * Extracted from App.tsx as part of PR33.  Owns:
 *   - useBentoGridPdf state + localStorage persistence
 *   - printableRef / pendingPreviewDataRef
 *   - prepararPropostaParaExportacao
 *   - handlePrint
 *   - handlePreviewActionRequest
 *   - window.__solarinvestOnPreviewAction wiring
 */
import { useCallback, useEffect, useRef } from 'react'
import {
  renderPrintableProposalToHtml,
  sanitizePrintableHtml,
  type PrintVariant,
} from './printRenderers'
import { clonePrintableData } from './buildPrintableData'
import {
  persistProposalPdf,
  isProposalPdfIntegrationAvailable,
  ProposalPdfIntegrationMissingError,
} from '../../utils/proposalPdf'
import { normalizeProposalId } from '../ids'
import { vendaActions } from '../../store/useVendaStore'
import type { PrintableProposalProps } from '../../types/printableProposal'
import type { OrcamentoSalvo } from '../../features/propostas/useProposalOrchestration'

// ── Preview window types (mirrors App.tsx module-level types) ─────────────────

type PrintMode = 'preview' | 'print' | 'download'

type BudgetPreviewOptions = {
  nomeCliente: string
  budgetId?: string | undefined
  actionMessage?: string | undefined
  autoPrint?: boolean | undefined
  closeAfterPrint?: boolean | undefined
  initialMode?: PrintMode | undefined
  initialVariant?: PrintVariant | undefined
  /** Pre-opened Window reference. When provided, skips window.open() so Safari popup policy is respected. */
  preOpenedWindow?: Window | null | undefined
}

type PreviewActionRequest = { action: 'print' | 'download' }

type PreviewActionResponse = {
  proceed?: boolean | undefined
  budgetId?: string | undefined
  updatedHtml?: string | undefined
}

// ── Callbacks the hook needs from App.tsx ────────────────────────────────────

export type PrintOrchestrationCallbacks = {
  validatePropostaLeasingMinimal(): boolean
  confirmarAlertasGerarProposta(): boolean
  ensureNormativePrecheck(): Promise<boolean>
  handleSalvarCliente(opts: { skipGuard: boolean; silent: boolean }): Promise<boolean>
  openBudgetPreviewWindow(html: string, opts: BudgetPreviewOptions): void
  salvarOrcamentoLocalmente(dados: PrintableProposalProps): OrcamentoSalvo | null
  switchBudgetId(id: string): void
  getActiveBudgetId(): string | null
  atualizarOrcamentoAtivo(registro: OrcamentoSalvo): void
  adicionarNotificacao(msg: string, type: 'success' | 'error' | 'info'): void
  setProposalPdfIntegrationAvailable(v: boolean): void
}

export type UsePrintOrchestrationParams = {
  printableData: PrintableProposalProps
  isVendaDiretaTab: boolean
  /** Current tab key (e.g. 'vendas' | 'leasing') */
  activeTab: string
  clienteEmEdicaoId: string | null
  /** Bento Grid PDF preference (state owned by App.tsx; passed in) */
  useBentoGridPdf: boolean
  callbacks: PrintOrchestrationCallbacks
}

export type UsePrintOrchestrationResult = {
  printableRef: React.RefObject<HTMLDivElement>
  prepararPropostaParaExportacao(
    options?: { incluirTabelaBuyout?: boolean },
  ): Promise<{ html: string; dados: PrintableProposalProps } | null>
  handlePrint(): Promise<void>
  handlePreviewActionRequest(
    req: PreviewActionRequest,
  ): Promise<PreviewActionResponse>
  /** Clears pending preview data. Call before opening an unrelated preview window (e.g. buyout table). */
  clearPendingPreview(): void
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePrintOrchestration(
  params: UsePrintOrchestrationParams,
): UsePrintOrchestrationResult {
  const { printableData, isVendaDiretaTab, activeTab, clienteEmEdicaoId, useBentoGridPdf, callbacks } = params

  // Keep callbacks fresh without adding them to every dep array
  const cbRef = useRef(callbacks)
  cbRef.current = callbacks

  // ── Refs ──────────────────────────────────────────────────────────────────
  const printableRef = useRef<HTMLDivElement>(null)
  const pendingPreviewDataRef = useRef<{ html: string; dados: PrintableProposalProps } | null>(null)

  // Keep reactive values in a ref so handlers always read the latest without
  // being forced into every useCallback dep array.
  const stateRef = useRef({ printableData, isVendaDiretaTab, activeTab, clienteEmEdicaoId, useBentoGridPdf })
  stateRef.current = { printableData, isVendaDiretaTab, activeTab, clienteEmEdicaoId, useBentoGridPdf }

  // ── prepararPropostaParaExportacao ────────────────────────────────────────
  const prepararPropostaParaExportacao = useCallback(
    async (options?: { incluirTabelaBuyout?: boolean }) => {
      const { printableData: data, useBentoGridPdf: bentoGrid } = stateRef.current
      const dadosParaImpressao = clonePrintableData(data)
      if (options?.incluirTabelaBuyout === false) {
        dadosParaImpressao.mostrarTabelaBuyout = false
      }
      let layoutHtml: string | null = null

      try {
        layoutHtml = await renderPrintableProposalToHtml(dadosParaImpressao, bentoGrid)
      } catch (error) {
        console.error('Erro ao preparar a proposta para exportação.', error)
      }

      if (!layoutHtml) {
        const node = printableRef.current
        if (node) {
          const clone = node.cloneNode(true) as HTMLElement
          if (options?.incluirTabelaBuyout === false) {
            clone.querySelectorAll('[data-print-section="buyout"]').forEach((element) => {
              element.parentElement?.removeChild(element)
            })
          }
          const codigoDd = clone.querySelector('.print-client-grid .print-client-field:first-child dd')
          if (codigoDd && dadosParaImpressao.budgetId) {
            codigoDd.textContent = dadosParaImpressao.budgetId
          }
          layoutHtml = clone.outerHTML
        }
      }

      const sanitizedLayoutHtml = sanitizePrintableHtml(layoutHtml)
      if (!sanitizedLayoutHtml) return null

      return { html: sanitizedLayoutHtml, dados: dadosParaImpressao }
    },
    [],
  )

  // ── handlePrint ───────────────────────────────────────────────────────────
  const handlePrint = useCallback(async () => {
    const { isVendaDiretaTab: isDiretaTab } = stateRef.current
    const cb = cbRef.current

    if (!cb.validatePropostaLeasingMinimal()) return
    if (!cb.confirmarAlertasGerarProposta()) return

    // Open the preview window synchronously here — before any await — so that Safari's
    // popup policy (which only allows window.open() within a synchronous user-gesture
    // handler) is satisfied.  All subsequent async work writes into this already-opened
    // window via the preOpenedWindow option of openBudgetPreviewWindow.
    const preOpenedWindow = window.open('', '_blank', 'width=1024,height=768')

    if (!(await cb.ensureNormativePrecheck())) {
      preOpenedWindow?.close()
      return
    }

    await cb.handleSalvarCliente({ skipGuard: true, silent: true })

    const resultado = await prepararPropostaParaExportacao({
      incluirTabelaBuyout: isDiretaTab,
    })

    if (!resultado) {
      preOpenedWindow?.close()
      window.alert('Não foi possível gerar a visualização para impressão. Tente novamente.')
      return
    }

    const { html: layoutHtml, dados } = resultado
    pendingPreviewDataRef.current = { html: layoutHtml, dados }

    const nomeCliente = dados.cliente.nome?.trim() || 'SolarInvest'
    const budgetId = normalizeProposalId(dados.budgetId)
    cb.openBudgetPreviewWindow(layoutHtml, {
      nomeCliente,
      budgetId,
      actionMessage: 'Revise o conteúdo e utilize as ações para gerar o PDF.',
      initialMode: 'preview',
      preOpenedWindow,
    })
  }, [prepararPropostaParaExportacao])

  // ── handlePreviewActionRequest ────────────────────────────────────────────
  const handlePreviewActionRequest = useCallback(
    async ({ action: _action }: PreviewActionRequest): Promise<PreviewActionResponse> => {
      const previewData = pendingPreviewDataRef.current
      const { activeTab: tab, useBentoGridPdf: bentoGrid } = stateRef.current
      const cb = cbRef.current
      const budgetIdAtual = normalizeProposalId(cb.getActiveBudgetId())

      if (!previewData) {
        return { proceed: true }
      }

      const { dados } = previewData
      const idExistente = normalizeProposalId(dados.budgetId ?? budgetIdAtual)
      if (idExistente) {
        const emissaoIso = new Date().toISOString().slice(0, 10)
        cb.switchBudgetId(idExistente)
        vendaActions.updateCodigos({
          codigo_orcamento_interno: idExistente,
          data_emissao: emissaoIso,
        })
        return { proceed: true, budgetId: idExistente }
      }

      const clienteId = stateRef.current.clienteEmEdicaoId
      if (!clienteId) {
        return { proceed: true, budgetId: '' }
      }

      const confirmarSalvar = window.confirm(
        'Deseja salvar este documento antes de imprimir ou baixar? Ele será armazenado no histórico do cliente.',
      )
      if (!confirmarSalvar) {
        return { proceed: true, budgetId: '' }
      }

      try {
        const registro = cb.salvarOrcamentoLocalmente(dados)
        if (!registro) {
          return { proceed: false }
        }

        dados.budgetId = registro.id
        const emissaoIso = new Date().toISOString().slice(0, 10)
        cb.switchBudgetId(registro.id)

        vendaActions.updateCodigos({
          codigo_orcamento_interno: registro.id,
          data_emissao: emissaoIso,
        })

        cb.atualizarOrcamentoAtivo(registro)

        let htmlAtualizado = sanitizePrintableHtml(previewData.html) || ''
        try {
          const reprocessado = await renderPrintableProposalToHtml(dados, bentoGrid)
          if (reprocessado) {
            const sanitized = sanitizePrintableHtml(reprocessado)
            if (sanitized) {
              htmlAtualizado = sanitized
              previewData.html = sanitized
            }
          }
        } catch (error) {
          console.warn('Não foi possível atualizar o HTML antes da impressão.', error)
        }

        try {
          const proposalType = tab === 'vendas' ? 'VENDA_DIRETA' : 'LEASING'
          const integracaoPdfDisponivel = isProposalPdfIntegrationAvailable()
          cb.setProposalPdfIntegrationAvailable(integracaoPdfDisponivel)
          if (integracaoPdfDisponivel) {
            try {
              await persistProposalPdf({
                html: htmlAtualizado,
                budgetId: registro.id,
                clientName: dados.cliente.nome,
                proposalType,
              })
              cb.adicionarNotificacao(
                'Proposta salva em PDF com sucesso. Uma cópia foi armazenada localmente.',
                'success',
              )
            } catch (error) {
              if (error instanceof ProposalPdfIntegrationMissingError) {
                cb.setProposalPdfIntegrationAvailable(false)
                cb.adicionarNotificacao(
                  'Proposta preparada, mas a integração para salvar PDF não está configurada.',
                  'info',
                )
              } else {
                console.error('Erro ao salvar a proposta em PDF durante a impressão.', error)
                window.alert('Não foi possível salvar a proposta em PDF. Tente novamente.')
                return { proceed: false }
              }
            }
          } else {
            cb.adicionarNotificacao(
              'Proposta preparada, mas a integração para salvar PDF não está configurada.',
              'info',
            )
          }
        } catch (error) {
          console.error('Erro ao salvar a proposta em PDF durante a impressão.', error)
          window.alert('Não foi possível salvar a proposta em PDF. Tente novamente.')
          return { proceed: false }
        }

        previewData.dados = dados

        return {
          proceed: true,
          budgetId: registro.id,
          updatedHtml: htmlAtualizado,
        }
      } catch (error) {
        console.error('Erro ao preparar o salvamento antes da impressão.', error)
        window.alert('Não foi possível salvar o documento. Tente novamente.')
        return { proceed: false }
      }
    },
    [],
  )

  // ── Wire handlePreviewActionRequest to window ─────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.__solarinvestOnPreviewAction = handlePreviewActionRequest
    return () => {
      if (window.__solarinvestOnPreviewAction === handlePreviewActionRequest) {
        delete window.__solarinvestOnPreviewAction
      }
    }
  }, [handlePreviewActionRequest])

  const clearPendingPreview = useCallback(() => {
    pendingPreviewDataRef.current = null
  }, [])

  return {
    printableRef,
    prepararPropostaParaExportacao,
    handlePrint,
    handlePreviewActionRequest,
    clearPendingPreview,
  }
}
