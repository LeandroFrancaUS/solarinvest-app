import React from 'react'

import '../../styles/print.css'
import '../../styles/print-colors.css'

import type { PrintableProposalProps } from '../../types/printableProposal'

import PrintableProposalLeasing from './PrintableProposalLeasing'
import PrintableProposalVenda from './PrintableProposalVenda'
import { usePrintThemeLight } from './usePrintTheme'

export type PrintableProposalComponentProps = PrintableProposalProps & {
  onPrint?: () => void
  onDownload?: () => void
  onToggleSimple?: () => void
  variant?: 'standard' | 'simple'
}

function PrintableProposalInner(
  { onPrint, onDownload, onToggleSimple, variant = 'standard', ...props }: PrintableProposalComponentProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  usePrintThemeLight()

  const handlePrintClick = () => {
    onPrint?.()
  }

  const handleDownloadClick = () => {
    onDownload?.()
  }

  const handleToggleSimpleClick = () => {
    onToggleSimple?.()
  }

  return (
    <div className="proposal-print-shell" data-print-variant={variant}>
      <header className="print-header">
        <div className="print-header-actions">
          <button type="button" onClick={handlePrintClick}>
            Imprimir
          </button>
          <button type="button" onClick={handleDownloadClick}>
            Salvar PDF
          </button>
          <button type="button" onClick={handleToggleSimpleClick}>
            Versão simples
          </button>
        </div>
      </header>
      <div
        id="proposal-print-root"
        ref={ref}
        className="proposal-print-root"
        data-print-variant={variant}
      >
        {props.tipoProposta === 'LEASING' ? (
          <PrintableProposalLeasing {...props} />
        ) : (
          <PrintableProposalVenda {...props} />
        )}
      </div>
    </div>
  )
}

export const PrintableProposal = React.forwardRef<HTMLDivElement, PrintableProposalComponentProps>(
  PrintableProposalInner,
)

export default PrintableProposal
