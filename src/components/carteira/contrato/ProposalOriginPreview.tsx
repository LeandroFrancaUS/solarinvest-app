import type { SavedProposalRecord } from '../../../lib/proposals/types'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('pt-BR')
}

interface ProposalOriginPreviewProps {
  open: boolean
  record: SavedProposalRecord | null
  onClose: () => void
  onSelect?: (record: SavedProposalRecord) => void
  onDownload?: (record: SavedProposalRecord) => void
}

export function ProposalOriginPreview({ open, record, onClose, onSelect, onDownload }: ProposalOriginPreviewProps) {
  if (!open || !record) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview da proposta ${record.code}`}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.7)', zIndex: 1010, display: 'grid', placeItems: 'center' }}
    >
      <button type="button" aria-label="Fechar preview" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'transparent', border: 'none', padding: 0 }} />
      <div style={{ position: 'relative', width: 'min(760px, calc(100vw - 48px))', maxHeight: '88vh', overflow: 'auto', background: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Preview da proposta {record.code}</h3>
          <button type="button" className="pf-btn pf-btn-cancel" onClick={onClose}>Fechar</button>
        </div>
        <div style={{ display: 'grid', gap: 8, fontSize: 13, marginBottom: 16 }}>
          <div><strong>Código:</strong> {record.code}</div>
          <div><strong>Cliente:</strong> {record.clientName ?? '—'}</div>
          <div><strong>CPF/CNPJ:</strong> {record.document ?? '—'}</div>
          <div><strong>Telefone:</strong> {record.phone ?? '—'}</div>
          <div><strong>E-mail:</strong> {record.email ?? '—'}</div>
          <div><strong>Cidade/UF:</strong> {[record.city, record.state].filter(Boolean).join('/') || '—'}</div>
          <div><strong>Modalidade:</strong> {record.proposalType ?? '—'}</div>
          <div><strong>Status:</strong> {record.status ?? '—'}</div>
          <div><strong>Data:</strong> {formatDate(record.createdAt)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {onDownload ? <button type="button" className="pf-btn pf-btn-edit" onClick={() => onDownload(record)}>Baixar</button> : null}
          {onSelect ? <button type="button" className="pf-btn pf-btn-save" onClick={() => onSelect(record)}>Selecionar esta proposta</button> : null}
        </div>
      </div>
    </div>
  )
}
