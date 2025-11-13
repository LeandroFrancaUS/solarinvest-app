import React from 'react'

import '../../styles/print.css'
import '../../styles/print-colors.css'

import type { PrintableProposalProps } from '../../types/printableProposal'

import PrintableProposalLeasing from './PrintableProposalLeasing'
import PrintableProposalVenda from './PrintableProposalVenda'
import { usePrintThemeLight } from './usePrintTheme'

export type PrintableRenderMode = 'preview' | 'pdf'

type PrintableProposalComponentProps = PrintableProposalProps & {
  renderMode?: PrintableRenderMode
}

function PrintableProposalInner(
  { renderMode = 'preview', ...printableProps }: PrintableProposalComponentProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  usePrintThemeLight()

  const isPdfLayout = renderMode === 'pdf'
  const Component =
    printableProps.tipoProposta === 'LEASING' ? PrintableProposalLeasing : PrintableProposalVenda

  return (
    <div
      ref={ref}
      className="printable-proposal-root"
      data-render-mode={isPdfLayout ? 'pdf' : 'preview'}
    >
      <Component {...printableProps} renderMode={renderMode} />
    </div>
  )
}

export const PrintableProposal = React.forwardRef<HTMLDivElement, PrintableProposalComponentProps>(
  PrintableProposalInner,
)

export default PrintableProposal
