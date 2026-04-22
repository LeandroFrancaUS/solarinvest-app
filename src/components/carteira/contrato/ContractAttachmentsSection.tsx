import React from 'react'
import type { ContractAttachment } from '../../../types/clientPortfolio'

export function ContractAttachmentsSection({
  attachments,
  importedAttachmentId,
}: {
  attachments: ContractAttachment[]
  importedAttachmentId?: string
}) {
  if (attachments.length === 0) {
    return <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>Nenhum anexo adicionado.</div>
  }

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {attachments.map((att) => (
        <div key={att.id} style={{ border: '1px solid #334155', borderRadius: 8, padding: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {att.fileName}
            {importedAttachmentId === att.id ? ' • Contrato principal' : ''}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{att.mimeType ?? 'arquivo'}</div>
        </div>
      ))}
    </div>
  )
}
