interface ProposalOriginFieldProps {
  editMode: boolean
  displayCode: string | null
  legacyCode?: string
  onOpenSearch: () => void
  onClear: () => void
  onPreview: () => void
  onDownload: () => void
  onLegacyChange?: (value: string) => void
}

export function ProposalOriginField({
  editMode,
  displayCode,
  legacyCode,
  onOpenSearch,
  onClear,
  onPreview,
  onDownload,
  onLegacyChange,
}: ProposalOriginFieldProps) {
  if (!displayCode) {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>Nenhuma proposta vinculada.</div>
        {editMode ? (
          <button type="button" className="pf-btn pf-btn-edit" onClick={onOpenSearch}>🔎 Buscar proposta</button>
        ) : null}
        {editMode && onLegacyChange ? (
          <input
            type="text"
            value={legacyCode ?? ''}
            onChange={(event) => onLegacyChange(event.target.value)}
            placeholder="(Opcional) Código manual legado"
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <button
        type="button"
        onClick={onPreview}
        className="pf-btn pf-btn-link"
        style={{ justifyContent: 'flex-start', fontWeight: 600 }}
      >
        {displayCode}
      </button>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button type="button" className="pf-btn pf-btn-edit" onClick={onPreview}>Preview</button>
        <button type="button" className="pf-btn pf-btn-save" onClick={onDownload}>Baixar</button>
        {editMode ? <button type="button" className="pf-btn pf-btn-edit" onClick={onOpenSearch}>Trocar</button> : null}
        {editMode ? <button type="button" className="pf-btn pf-btn-cancel" onClick={onClear}>Remover</button> : null}
      </div>
    </div>
  )
}
