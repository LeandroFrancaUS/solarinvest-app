import { useEffect, useState } from 'react'
import { ProposalOriginResultList } from './ProposalOriginResultList'
import { ProposalOriginPreview } from './ProposalOriginPreview'
import { downloadSavedProposal, searchSavedProposals } from '../../../services/proposalRecordsService'
import type { SavedProposalRecord } from '../../../lib/proposals/types'

interface ProposalOriginSearchDialogProps {
  open: boolean
  onClose: () => void
  onSelect: (record: SavedProposalRecord) => void
}

export function ProposalOriginSearchDialog({ open, onClose, onSelect }: ProposalOriginSearchDialogProps) {
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<SavedProposalRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPreview, setSelectedPreview] = useState<SavedProposalRecord | null>(null)

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      setLoading(true)
      void searchSavedProposals({ query, limit: 50, page: 1 })
        .then((res) => setItems(res.items))
        .catch(() => setItems([]))
        .finally(() => setLoading(false))
    }, 320)

    return () => clearTimeout(timer)
  }, [open, query])

  if (!open) return null

  return (
    <>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Buscar proposta original">
        <button type="button" className="modal-backdrop modal-backdrop--opaque" aria-label="Fechar busca" onClick={onClose} />
        <div className="modal-content" style={{ position: 'fixed', inset: '8% 6%', height: '84%', padding: 16, overflow: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <h3 style={{ margin: 0 }}>Buscar proposta original</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>
                Consulta conectada aos registros salvos.
              </p>
            </div>
            <button type="button" className="pf-btn pf-btn-cancel" onClick={onClose}>Fechar</button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por código, nome, CPF/CNPJ, telefone..."
              style={{ width: '100%', boxSizing: 'border-box', padding: 10 }}
            />
            <ProposalOriginResultList
              loading={loading}
              items={items}
              onPreview={(item) => setSelectedPreview(item)}
              onSelect={(item) => {
                onSelect(item)
                onClose()
              }}
              onDownload={(item) => { void downloadSavedProposal(item) }}
            />
          </div>
        </div>
      </div>
      <ProposalOriginPreview
        open={Boolean(selectedPreview)}
        record={selectedPreview}
        onClose={() => setSelectedPreview(null)}
        onSelect={(item) => {
          onSelect(item)
          setSelectedPreview(null)
          onClose()
        }}
        onDownload={(item) => { void downloadSavedProposal(item) }}
      />
    </>
  )
}
