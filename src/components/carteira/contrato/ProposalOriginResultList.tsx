import type { SavedProposalRecord } from '../../../lib/proposals/types'

interface ProposalOriginResultListProps {
  loading: boolean
  items: SavedProposalRecord[]
  onPreview: (item: SavedProposalRecord) => void
  onSelect: (item: SavedProposalRecord) => void
}

export function ProposalOriginResultList({ loading, items, onPreview, onSelect }: ProposalOriginResultListProps) {
  if (loading) {
    return <div style={{ fontSize: 12, color: '#64748b' }}>Carregando propostas salvas…</div>
  }

  if (items.length === 0) {
    return <div style={{ fontSize: 12, color: '#64748b' }}>Nenhuma proposta encontrada.</div>
  }

  return (
    <div style={{ display: 'grid', gap: 8, maxHeight: 380, overflow: 'auto' }}>
      {items.map((item) => (
        <div key={item.id} className="pf-section-card" style={{ padding: 10, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'grid', gap: 3, fontSize: 12 }}>
              <button
                type="button"
                onClick={() => onPreview(item)}
                className="pf-btn pf-btn-link"
                style={{ fontSize: 13, fontWeight: 700, padding: 0, justifyContent: 'flex-start', color: '#0f172a' }}
              >
                {item.code}
              </button>
              <span>{item.clientName ?? 'Cliente não informado'}</span>
              <span>{item.document ?? 'CPF/CNPJ não informado'} • {item.phone ?? 'Telefone não informado'}</span>
              <span>{item.createdAt ? new Date(item.createdAt).toLocaleDateString('pt-BR') : 'Data não informada'} • {item.proposalType ?? 'Tipo não informado'}</span>
            </div>
            <div style={{ display: 'grid', alignContent: 'start', gap: 6 }}>
              <button type="button" className="pf-btn pf-btn-save" onClick={() => onSelect(item)}>Selecionar</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
