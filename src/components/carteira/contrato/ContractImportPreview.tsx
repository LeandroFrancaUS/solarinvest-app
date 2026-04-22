import React from 'react'
import type { ContractImportPreview } from '../../../lib/contracts/contractImport/types'

export function ContractImportPreviewCard({ preview }: { preview: ContractImportPreview }) {
  return (
    <div style={{ display: 'grid', gap: 6, fontSize: 12, color: '#0f172a', lineHeight: 1.35 }}>
      <div><strong>Contratante:</strong> {preview.parsedFields.contractorName ?? '—'}</div>
      <div><strong>CPF/CNPJ:</strong> {preview.parsedFields.contractorDocument ?? '—'}</div>
      <div><strong>Assinatura encontrada:</strong> {preview.contractorSignature ? 'Sim' : 'Não'}</div>
      <div><strong>Data assinatura:</strong> {preview.contractorSignature?.signedAt ?? '—'}</div>
      <div><strong>KWh contratado:</strong> {preview.parsedFields.kwhContratado ?? '—'}</div>
      <div><strong>Prazo:</strong> {preview.parsedFields.contractualTermMonths ?? '—'} meses</div>
      <div><strong>Código:</strong> {preview.parsedFields.proposalCode ?? '—'}</div>
      <div style={{ marginTop: 2, fontSize: 11, color: '#475569' }}>
        Signatários encontrados: {preview.signatures.length}
      </div>
    </div>
  )
}
