import React from 'react'

import '../../styles/print.css'
import '../../styles/print-colors.css'

import type { PrintableProposalProps } from '../../types/printableProposal'

import PrintableProposalLeasing from './PrintableProposalLeasing'
import PrintableProposalVenda from './PrintableProposalVenda'
import { usePrintThemeLight } from './usePrintTheme'

function PrintableProposalInner(
  props: PrintableProposalProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  usePrintThemeLight()

  if (props.tipoProposta === 'LEASING') {
    return <PrintableProposalLeasing ref={ref} {...props} />
  }

  return <PrintableProposalVenda ref={ref} {...props} />
}

export const PrintableProposal = React.forwardRef<HTMLDivElement, PrintableProposalProps>(PrintableProposalInner)

export default PrintableProposal
