import React, { useEffect, useMemo } from 'react'

import '../../styles/print-colors.css'
import './styles/proposal-print.css'

import type { PrintableProposalProps, PrintableProposalTipo } from '../../types/printableProposal'
import { normalizeProposalId } from '../../lib/ids'
import { usePrintableProposalsStore } from '../../store/usePrintableProposalsStore'
import PrintableProposal from './PrintableProposal'

type PrintableProposalPageProps = {
  proposalId: string
  tipo: PrintableProposalTipo
  onClose?: () => void
}

type PrintableProposalToolbarProps = {
  onClose?: () => void
  onPrint?: () => void
  proposalCode: string | null
}

const PrintableProposalToolbar: React.FC<PrintableProposalToolbarProps> = ({
  onClose,
  onPrint,
  proposalCode,
}) => {
  return (
    <header className="print-toolbar" role="banner">
      <div className="print-toolbar__info">
        <h1>Proposta SolarInvest</h1>
        {proposalCode ? <p>Código da proposta: {proposalCode}</p> : null}
      </div>
      <div className="print-toolbar__actions">
        <button type="button" className="print-toolbar__button" onClick={onPrint}>
          Imprimir / Salvar PDF
        </button>
        <button type="button" className="print-toolbar__button secondary" onClick={onClose}>
          Voltar para o painel
        </button>
      </div>
    </header>
  )
}

const isMatchingTipo = (dados: PrintableProposalProps | null, tipo: PrintableProposalTipo): boolean => {
  if (!dados) {
    return false
  }
  if (tipo === 'LEASING') {
    return dados.tipoProposta === 'LEASING'
  }
  return dados.tipoProposta === 'VENDA_DIRETA'
}

export const PrintableProposalPage: React.FC<PrintableProposalPageProps> = ({ proposalId, tipo, onClose }) => {
  const resolvedId = useMemo(() => normalizeProposalId(proposalId) || proposalId, [proposalId])
  const record = usePrintableProposalsStore((state) => state.getProposal(resolvedId))
  const proposalDados = record?.dados ?? null

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    const { body, documentElement } = document
    const previousBodyMode = body.dataset.printMode
    const previousHtmlMode = documentElement.dataset.printMode
    body.dataset.printMode = 'download'
    documentElement.dataset.printMode = 'download'

    return () => {
      if (previousBodyMode) {
        body.dataset.printMode = previousBodyMode
      } else {
        delete body.dataset.printMode
      }
      if (previousHtmlMode) {
        documentElement.dataset.printMode = previousHtmlMode
      } else {
        delete documentElement.dataset.printMode
      }
    }
  }, [])

  useEffect(() => {
    if (!record) {
      return
    }
    const timestampCutoff = Date.now() - 12 * 60 * 60 * 1000
    usePrintableProposalsStore.getState().clearOlderThan(timestampCutoff)
  }, [record])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }
    const nomeCliente = proposalDados?.cliente.nome?.trim()
    const titulo = nomeCliente ? `Proposta SolarInvest — ${nomeCliente}` : 'Proposta SolarInvest'
    const previousTitle = document.title
    document.title = titulo
    return () => {
      document.title = previousTitle
    }
  }, [proposalDados])

  useEffect(() => {
    if (!proposalDados) {
      return
    }
    if (!isMatchingTipo(proposalDados, tipo)) {
      console.warn('Tipo de proposta carregada não corresponde à rota de impressão selecionada.')
    }
  }, [proposalDados, tipo])

  const handlePrint = () => {
    window.print()
  }

  if (!proposalDados) {
    return (
      <div className="print-route">
        <PrintableProposalToolbar onClose={onClose} onPrint={handlePrint} proposalCode={null} />
        <main className="print-empty" role="main">
          <h2>Não foi possível localizar a proposta selecionada.</h2>
          <p>Volte ao painel e gere a proposta novamente.</p>
          <button type="button" className="print-toolbar__button" onClick={onClose}>
            Voltar
          </button>
        </main>
      </div>
    )
  }

  const codigo = proposalDados.budgetId ?? resolvedId

  return (
    <div className="print-route">
      <PrintableProposalToolbar onClose={onClose} onPrint={handlePrint} proposalCode={codigo} />
      <main className="print-main" role="main">
        <div className="print-root" data-print-variant="standard">
          <React.Suspense fallback={null}>
            <PrintableProposal {...proposalDados} />
          </React.Suspense>
        </div>
      </main>
    </div>
  )
}

export default PrintableProposalPage
