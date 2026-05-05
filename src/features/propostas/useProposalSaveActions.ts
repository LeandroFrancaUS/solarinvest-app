/**
 * useProposalSaveActions.ts
 *
 * Owns proposal save action handlers extracted from App.tsx:
 *   - confirmarAlertasAntesDeSalvar
 *   - handleSalvarPropostaLeasing
 *   - handleSalvarPropostaPdf
 *
 * State owned:
 *   - salvandoPropostaLeasing
 *   - salvandoPropostaPdf
 */

import { useCallback, useState } from 'react'
import type React from 'react'
import {
  sanitizePrintableHtml,
  renderPrintableProposalToHtml,
} from '../../lib/pdf/printRenderers'
import {
  persistProposalPdf,
  ProposalPdfIntegrationMissingError,
} from '../../utils/proposalPdf'
import type { SaveDecisionPromptRequest, SaveDecisionChoice } from '../../components/modals/SaveChangesDialog'
import type { PrintableProposalProps } from '../../types/printableProposal'
import type { OrcamentoSalvo } from './proposalHelpers'
import { vendaActions } from '../../store/useVendaStore'

export interface UseProposalSaveActionsParams {
  isVendaDiretaTab: boolean
  activeTab: string
  useBentoGridPdf: boolean
  validatePropostaLeasingMinimal: () => boolean
  ensureNormativePrecheck: () => Promise<boolean>
  coletarAlertasProposta: () => string[]
  handleSalvarCliente: (options?: { skipGuard?: boolean; silent?: boolean }) => Promise<boolean>
  prepararPropostaParaExportacao: (options?: { incluirTabelaBuyout?: boolean }) => Promise<{ html: string; dados: PrintableProposalProps } | null>
  salvarOrcamentoLocalmente: (dados: PrintableProposalProps) => OrcamentoSalvo | null
  atualizarOrcamentoAtivo: (registro: OrcamentoSalvo) => void
  switchBudgetId: (nextId: string) => void
  scheduleMarkStateAsSaved: (signatureOverride?: string | null) => void
  requestSaveDecision: (options: SaveDecisionPromptRequest) => Promise<SaveDecisionChoice>
  adicionarNotificacao: (msg: string, tipo?: 'success' | 'info' | 'error') => void
  isProposalPdfIntegrationAvailable: () => boolean
  setProposalPdfIntegrationAvailable: React.Dispatch<React.SetStateAction<boolean>>
  proposalServerIdMapRef: React.MutableRefObject<Record<string, string>>
}

export function useProposalSaveActions({
  isVendaDiretaTab,
  activeTab,
  useBentoGridPdf,
  validatePropostaLeasingMinimal,
  ensureNormativePrecheck,
  coletarAlertasProposta,
  handleSalvarCliente,
  prepararPropostaParaExportacao,
  salvarOrcamentoLocalmente,
  atualizarOrcamentoAtivo,
  switchBudgetId,
  scheduleMarkStateAsSaved,
  requestSaveDecision,
  adicionarNotificacao,
  isProposalPdfIntegrationAvailable,
  setProposalPdfIntegrationAvailable,
  proposalServerIdMapRef,
}: UseProposalSaveActionsParams) {
  const [salvandoPropostaLeasing, setSalvandoPropostaLeasing] = useState(false)
  const [salvandoPropostaPdf, setSalvandoPropostaPdf] = useState(false)

  const confirmarAlertasAntesDeSalvar = useCallback(async (): Promise<boolean> => {
    const alertas = coletarAlertasProposta()

    if (alertas.length === 0) {
      return true
    }

    const descricao = `${
      alertas.length === 1
        ? 'Encontramos um alerta que precisa de atenção antes de salvar:'
        : 'Encontramos alguns alertas que precisam de atenção antes de salvar:'
    } ${alertas.map((texto) => `• ${texto}`).join(' ')}`

    const choice = await requestSaveDecision({
      title: 'Resolver alertas antes de salvar?',
      description: descricao,
      confirmLabel: 'Continuar',
      discardLabel: 'Voltar',
    })

    return choice === 'save'
  }, [coletarAlertasProposta, requestSaveDecision])

  const handleSalvarPropostaLeasing = useCallback(async (): Promise<boolean> => {
    if (salvandoPropostaLeasing) {
      return false
    }

    if (!validatePropostaLeasingMinimal()) {
      return false
    }

    if (!(await ensureNormativePrecheck())) {
      return false
    }

    const confirmouAlertas = await confirmarAlertasAntesDeSalvar()
    if (!confirmouAlertas) {
      return false
    }

    await handleSalvarCliente({ skipGuard: true, silent: true })

    setSalvandoPropostaLeasing(true)

    try {
      const resultado = await prepararPropostaParaExportacao({
        incluirTabelaBuyout: isVendaDiretaTab,
      })

      if (!resultado) {
        window.alert('Não foi possível preparar a proposta para salvar. Tente novamente.')
        return false
      }

      const { dados } = resultado
      const registroSalvo = salvarOrcamentoLocalmente(dados)
      if (!registroSalvo) {
        return false
      }

      const emissaoIso = new Date().toISOString().slice(0, 10)
      switchBudgetId(registroSalvo.id)

      vendaActions.updateCodigos({
        codigo_orcamento_interno: registroSalvo.id,
        data_emissao: emissaoIso,
      })

      atualizarOrcamentoAtivo(registroSalvo)
      scheduleMarkStateAsSaved()

      adicionarNotificacao(
        'Proposta de leasing salva localmente. Para persistência oficial, certifique-se de salvar via servidor.',
        'success',
      )

      return true
    } catch (error) {
      console.error('Erro ao salvar proposta de leasing.', error)
      adicionarNotificacao(
        'Não foi possível salvar a proposta de leasing. Tente novamente após corrigir os alertas.',
        'error',
      )
      return false
    } finally {
      setSalvandoPropostaLeasing(false)
    }
  }, [
    adicionarNotificacao,
    atualizarOrcamentoAtivo,
    confirmarAlertasAntesDeSalvar,
    ensureNormativePrecheck,
    handleSalvarCliente,
    isVendaDiretaTab,
    prepararPropostaParaExportacao,
    salvarOrcamentoLocalmente,
    salvandoPropostaLeasing,
    scheduleMarkStateAsSaved,
    switchBudgetId,
    validatePropostaLeasingMinimal,
  ])

  const handleSalvarPropostaPdf = useCallback(async (): Promise<boolean> => {
    if (salvandoPropostaPdf) {
      return false
    }

    if (!validatePropostaLeasingMinimal()) {
      return false
    }

    if (!(await ensureNormativePrecheck())) {
      return false
    }

    console.info('[client-save] proceeding to proposal save', { proposalId: proposalServerIdMapRef.current })

    const clienteSalvoComSucesso = await handleSalvarCliente({ skipGuard: true, silent: true })
    if (!clienteSalvoComSucesso) {
      console.warn('[client-save] client mutation did not succeed — proposal will still be saved, but client data may not be updated in DB')
    }

    setSalvandoPropostaPdf(true)

    let salvouLocalmente = false
    let sucesso = false

    try {
      const resultado = await prepararPropostaParaExportacao({
        incluirTabelaBuyout: isVendaDiretaTab,
      })

      if (!resultado) {
        window.alert('Não foi possível preparar a proposta para salvar em PDF. Tente novamente.')
        return false
      }

      const { html, dados } = resultado
      const registroSalvo = salvarOrcamentoLocalmente(dados)
      if (!registroSalvo) {
        return false
      }

      salvouLocalmente = true
      dados.budgetId = registroSalvo.id

      const emissaoIso = new Date().toISOString().slice(0, 10)
      switchBudgetId(registroSalvo.id)

      vendaActions.updateCodigos({
        codigo_orcamento_interno: registroSalvo.id,
        data_emissao: emissaoIso,
      })

      atualizarOrcamentoAtivo(registroSalvo)

      let htmlComCodigo = sanitizePrintableHtml(html) || ''
      try {
        const atualizado = await renderPrintableProposalToHtml(dados, useBentoGridPdf)
        if (atualizado) {
          const sanitized = sanitizePrintableHtml(atualizado)
          if (sanitized) {
            htmlComCodigo = sanitized
          }
        }
      } catch (error) {
        console.warn('Não foi possível atualizar o HTML com o código do orçamento.', error)
      }

      const proposalType = activeTab === 'vendas' ? 'VENDA_DIRETA' : 'LEASING'

      const integracaoPdfDisponivel = isProposalPdfIntegrationAvailable()
      setProposalPdfIntegrationAvailable(integracaoPdfDisponivel)
      if (!integracaoPdfDisponivel) {
        const mensagemLocal = clienteSalvoComSucesso
          ? 'Cliente e proposta armazenados localmente. Configure a integração de PDF para gerar o arquivo automaticamente.'
          : 'Proposta armazenada localmente. Os dados do cliente não foram atualizados no servidor.'
        adicionarNotificacao(mensagemLocal, 'info')
        sucesso = true
      } else {
        await persistProposalPdf({
          html: htmlComCodigo,
          budgetId: registroSalvo.id,
          clientName: dados.cliente.nome,
          proposalType,
        })

        const mensagemSucesso = clienteSalvoComSucesso
          ? (salvouLocalmente
            ? 'Cliente e proposta salvos com sucesso. Uma cópia foi armazenada localmente.'
            : 'Cliente e proposta salvos com sucesso.')
          : (salvouLocalmente
            ? 'Proposta salva em PDF. Os dados do cliente não foram atualizados no servidor.'
            : 'Proposta salva em PDF. Os dados do cliente não foram atualizados no servidor.')
        adicionarNotificacao(mensagemSucesso, clienteSalvoComSucesso ? 'success' : 'info')
        sucesso = true
      }
    } catch (error) {
      if (error instanceof ProposalPdfIntegrationMissingError) {
        setProposalPdfIntegrationAvailable(false)
        adicionarNotificacao(
          'Proposta armazenada localmente, mas a integração de PDF não está configurada.',
          'info',
        )
        sucesso = salvouLocalmente
      } else {
        console.error('Erro ao salvar a proposta em PDF.', error)
        const mensagem =
          error instanceof Error && error.message
            ? error.message
            : 'Não foi possível salvar a proposta em PDF. Tente novamente.'
        const mensagemComFallback = salvouLocalmente
          ? `${mensagem} Uma cópia foi armazenada localmente no histórico de orçamentos.`
          : mensagem
        adicionarNotificacao(mensagemComFallback, 'error')
        sucesso = salvouLocalmente
      }
    } finally {
      setSalvandoPropostaPdf(false)
    }

    if (sucesso) {
      scheduleMarkStateAsSaved()
    }
    return sucesso
  }, [
    activeTab,
    adicionarNotificacao,
    ensureNormativePrecheck,
    handleSalvarCliente,
    isProposalPdfIntegrationAvailable,
    isVendaDiretaTab,
    prepararPropostaParaExportacao,
    salvarOrcamentoLocalmente,
    salvandoPropostaPdf,
    atualizarOrcamentoAtivo,
    setProposalPdfIntegrationAvailable,
    scheduleMarkStateAsSaved,
    switchBudgetId,
    useBentoGridPdf,
    validatePropostaLeasingMinimal,
    proposalServerIdMapRef,
  ])

  return {
    salvandoPropostaLeasing,
    setSalvandoPropostaLeasing,
    salvandoPropostaPdf,
    setSalvandoPropostaPdf,
    confirmarAlertasAntesDeSalvar,
    handleSalvarPropostaLeasing,
    handleSalvarPropostaPdf,
  }
}
