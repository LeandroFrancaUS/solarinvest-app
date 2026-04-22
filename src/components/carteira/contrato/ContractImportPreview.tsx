import React from 'react'
import type { ContractImportPreview } from '../../../lib/contracts/contractImport/types'

export function ContractImportPreviewCard({ preview }: { preview: ContractImportPreview }) {
  return (
    <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
      <div><strong>Contratante:</strong> {preview.parsedFields.contractorName ?? '—'}</div>
      <div><strong>CPF/CNPJ:</strong> {preview.parsedFields.contractorDocument ?? '—'}</div>
      <div><strong>Assinatura encontrada:</strong> {preview.contractorSignature ? 'Sim' : 'Não'}</div>
      <div><strong>Data assinatura:</strong> {preview.contractorSignature?.signedAt ?? '—'}</div>
      <div><strong>KWh contratado:</strong> {preview.parsedFields.kwhContratado ?? '—'}</div>
      <div><strong>Prazo:</strong> {preview.parsedFields.contractualTermMonths ?? '—'} meses</div>
      <div><strong>Código:</strong> {preview.parsedFields.proposalCode ?? '—'}</div>
    </div>
  )
}
