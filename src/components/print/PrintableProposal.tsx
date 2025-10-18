import React from 'react'

import type { PrintableProposalProps } from '../../types/printableProposal'

import PrintableProposalLeasing from './PrintableProposalLeasing'
import PrintableProposalVenda from './PrintableProposalVenda'

function PrintableProposalInner(
  props: PrintableProposalProps,
  ref: React.ForwardedRef<HTMLDivElement>,
) {
  if (props.tipoProposta === 'LEASING') {
    return <PrintableProposalLeasing ref={ref} {...props} />
  }

  return <PrintableProposalVenda ref={ref} {...props} />
}

export const PrintableProposal = React.forwardRef<HTMLDivElement, PrintableProposalProps>(PrintableProposalInner)

export default PrintableProposal
