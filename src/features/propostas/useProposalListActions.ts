/**
 * useProposalListActions.ts
 *
 * Owns proposal list action handlers extracted from App.tsx:
 *   - abrirOrcamentoSalvo
 *   - confirmarRemocaoOrcamento
 *   - limparDadosModalidade
 *   - carregarOrcamentoSalvo
 */

import { useCallback } from 'react'
import type React from 'react'
import {
  sanitizePrintableHtml,
  renderPrintableProposalToHtml,
  type PrintVariant,
} from '../../lib/pdf/printRenderers'
import { ensureProposalId } from '../../lib/ids'
import type { OrcamentoSnapshotData } from '../../types/orcamentoTypes'
import type { PrintableProposalProps, PrintableProposalTipo } from '../../types/printableProposal'
import type { ConfirmDialogState } from '../../components/modals/ConfirmDialog'
import type { SaveDecisionPromptRequest, SaveDecisionChoice } from '../../components/modals/SaveChangesDialog'
import { fieldSyncActions } from '../../store/useFieldSyncStore'
import { vendaStore, hasVendaStateChanges } from '../../store/useVendaStore'
import { leasingActions, hasLeasingStateChanges } from '../../store/useLeasingStore'
import type { OrcamentoSalvo } from './proposalHelpers'

export interface BudgetPreviewOptions {
  nomeCliente: string
  budgetId?: string | undefined
  actionMessage?: string | undefined
  autoPrint?: boolean | undefined
  closeAfterPrint?: boolean | undefined
  initialMode?: 'preview' | 'print' | 'download' | undefined
  initialVariant?: PrintVariant | undefined
  preOpenedWindow?: Window | null | undefined
}

export interface UseProposalListActionsParams {
  useBentoGridPdf: boolean
  printableDataTipoProposta: PrintableProposalTipo
  leasingPrazo: number
  removerOrcamentoSalvo: (id: string) => Promise<void>
  carregarOrcamentoParaEdicao: (registro: OrcamentoSalvo, opts?: { notificationMessage?: string }) => Promise<void>
  carregarOrcamentosPrioritarios: () => Promise<OrcamentoSalvo[]>
  requestConfirmDialog: (options: Omit<ConfirmDialogState, 'resolve'>) => Promise<boolean>
  requestSaveDecision: (options: SaveDecisionPromptRequest) => Promise<SaveDecisionChoice>
  hasUnsavedChangesRef: React.MutableRefObject<() => boolean>
  handleSalvarPropostaPdf: () => Promise<boolean>
  computeSnapshotSignature: (snapshot: OrcamentoSnapshotData, dados: PrintableProposalProps) => string
  computeSignatureRef: React.MutableRefObject<() => string>
  openBudgetPreviewWindow: (html: string, options: BudgetPreviewOptions) => void
}

export function useProposalListActions({
  useBentoGridPdf,
  printableDataTipoProposta,
  leasingPrazo,
  removerOrcamentoSalvo,
  carregarOrcamentoParaEdicao,
  carregarOrcamentosPrioritarios,
  requestConfirmDialog,
  requestSaveDecision,
  hasUnsavedChangesRef,
  handleSalvarPropostaPdf,
  computeSnapshotSignature,
  computeSignatureRef,
  openBudgetPreviewWindow,
}: UseProposalListActionsParams) {
  const abrirOrcamentoSalvo = useCallback(
    async (registro: OrcamentoSalvo, modo: 'preview' | 'print' | 'download') => {
      // Open the preview window synchronously before any await (required for Safari popup policy).
      const preOpenedWindow = window.open('', '_blank', 'width=1024,height=768')
      try {
        const dadosParaImpressao: PrintableProposalProps = {
          ...registro.dados,
          budgetId: ensureProposalId(registro.dados.budgetId ?? registro.id),
          tipoProposta:
            registro.dados.tipoProposta === 'VENDA_DIRETA' ? 'VENDA_DIRETA' : 'LEASING',
        }
        const layoutHtml = await renderPrintableProposalToHtml(dadosParaImpressao, useBentoGridPdf)
        const sanitizedLayoutHtml = sanitizePrintableHtml(layoutHtml)

        if (!sanitizedLayoutHtml) {
          preOpenedWindow?.close()
          window.alert('Não foi possível preparar o orçamento selecionado. Tente novamente.')
          return
        }

        const nomeCliente = registro.dados.cliente.nome?.trim() || 'SolarInvest'
        let actionMessage = 'Revise o conteúdo e utilize as ações para gerar o PDF.'
        if (modo === 'print') {
          actionMessage = 'A janela de impressão será aberta automaticamente. Verifique as preferências antes de confirmar.'
        } else if (modo === 'download') {
          actionMessage =
            'Escolha a opção "Salvar como PDF" na janela de impressão para baixar o orçamento.'
        }

        openBudgetPreviewWindow(sanitizedLayoutHtml, {
          nomeCliente,
          budgetId: registro.id,
          actionMessage,
          autoPrint: modo !== 'preview',
          closeAfterPrint: modo === 'download',
          initialMode: modo === 'download' ? 'download' : modo === 'print' ? 'print' : 'preview',
          preOpenedWindow,
        })
      } catch (error) {
        preOpenedWindow?.close()
        console.error('Erro ao abrir orçamento salvo.', error)
        window.alert('Não foi possível abrir o orçamento selecionado. Tente novamente.')
      }
    },
    [openBudgetPreviewWindow, useBentoGridPdf],
  )

  const confirmarRemocaoOrcamento = useCallback(
    async (registro: OrcamentoSalvo) => {
      if (typeof window === 'undefined') {
        return
      }

      const nomeCliente = registro.clienteNome || registro.dados.cliente.nome || 'este cliente'
      const confirmado = await requestConfirmDialog({
        title: 'Excluir orçamento',
        description: `Deseja realmente excluir o orçamento ${registro.id} de ${nomeCliente}? Essa ação não poderá ser desfeita.`,
        confirmLabel: 'Excluir',
        cancelLabel: 'Cancelar',
      })

      if (!confirmado) {
        return
      }

      await removerOrcamentoSalvo(registro.id)
    },
    [removerOrcamentoSalvo, requestConfirmDialog],
  )

  const limparDadosModalidade = useCallback((tipo: PrintableProposalTipo) => {
    fieldSyncActions.reset()
    if (tipo === 'VENDA_DIRETA') {
      vendaStore.reset()
    } else {
      leasingActions.reset()
      // Re-sync prazoContratualMeses immediately after reset so the store
      // never stays at 0 while leasingPrazo hasn't changed (effect wouldn't re-fire)
      leasingActions.update({ prazoContratualMeses: leasingPrazo * 12 })
    }
  }, [leasingPrazo])

  const carregarOrcamentoSalvo = useCallback(
    async (registroInicial: OrcamentoSalvo) => {
      let registro = registroInicial

      if (!registro.snapshot) {
        void carregarOrcamentoParaEdicao(registro)
        return
      }

      const assinaturaAtual = computeSignatureRef.current()
      const assinaturaRegistro = computeSnapshotSignature(registro.snapshot, registro.dados)

      if (assinaturaRegistro === assinaturaAtual) {
        void carregarOrcamentoParaEdicao(registro, {
          notificationMessage:
            'Os dados desta proposta já estavam carregados. A versão salva foi reaplicada.',
        })
        return
      }

      if (hasUnsavedChangesRef.current()) {
        const choice = await requestSaveDecision({
          title: 'Salvar alterações atuais?',
          description:
            'Existem alterações não salvas. Deseja salvar a proposta atual antes de carregar a selecionada?',
        })

        if (choice === 'save') {
          const salvou = await handleSalvarPropostaPdf()
          if (!salvou) {
            return
          }

          limparDadosModalidade(printableDataTipoProposta)

          const registrosAtualizados = await carregarOrcamentosPrioritarios()
          const atualizado = registrosAtualizados.find((item) => item.id === registro.id)
          if (atualizado?.snapshot) {
            registro = atualizado
          }
        } else {
          limparDadosModalidade(printableDataTipoProposta)
        }
      }

      const tipoRegistro = registro.dados.tipoProposta
      const possuiDadosPreenchidos =
        tipoRegistro === 'VENDA_DIRETA' ? hasVendaStateChanges() : hasLeasingStateChanges()

      if (possuiDadosPreenchidos) {
        limparDadosModalidade(tipoRegistro)
      }

      void carregarOrcamentoParaEdicao(registro)
    },
    [
      carregarOrcamentoParaEdicao,
      carregarOrcamentosPrioritarios,
      handleSalvarPropostaPdf,
      hasUnsavedChangesRef,
      requestSaveDecision,
      limparDadosModalidade,
      printableDataTipoProposta,
      computeSnapshotSignature,
      computeSignatureRef,
    ],
  )

  return {
    abrirOrcamentoSalvo,
    confirmarRemocaoOrcamento,
    limparDadosModalidade,
    carregarOrcamentoSalvo,
  }
}
