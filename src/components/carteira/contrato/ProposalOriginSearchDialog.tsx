import { useEffect, useState } from 'react'
import { Modal } from '../../ui/Modal'
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

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="xl"
        title="Buscar proposta original"
        description="Consulta conectada aos registros salvos de propostas."
      >
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
      </Modal>

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
