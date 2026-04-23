interface ProposalOriginFieldProps {
  editMode: boolean
  displayCode: string | null
  isClickableCode: boolean
  legacyCode?: string
  onOpenSearch: () => void
  onClear: () => void
  onPreview: () => void
  onLegacyChange?: (value: string) => void
}

export function ProposalOriginField({
  editMode,
  displayCode,
  isClickableCode,
  legacyCode,
  onOpenSearch,
  onClear,
  onPreview,
  onLegacyChange,
}: ProposalOriginFieldProps) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {displayCode ? (
          isClickableCode ? (
            <button
              type="button"
              onClick={onPreview}
              className="pf-btn pf-btn-link"
              style={{ justifyContent: 'flex-start', fontWeight: 600, padding: 0 }}
            >
              {displayCode}
            </button>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #f8fafc)' }}>{displayCode}</span>
          )
        ) : (
          <span style={{ fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>Código da proposta ainda não informado.</span>
        )}
        {editMode ? (
          <button type="button" className="pf-btn pf-btn-edit" onClick={onOpenSearch} title="Buscar ou atualizar proposta" aria-label="Buscar ou atualizar proposta">🔎</button>
        ) : null}
        {editMode && displayCode ? (
          <button type="button" className="pf-btn pf-btn-cancel" onClick={onClear} title="Remover proposta" aria-label="Remover proposta">🗑️</button>
        ) : null}
      </div>
      <input
        type="text"
        value={legacyCode ?? ''}
        onChange={(event) => onLegacyChange?.(event.target.value)}
        placeholder="Informe manualmente o código da proposta"
        style={{ width: '100%', boxSizing: 'border-box' }}
        disabled={!editMode}
      />
    </div>
  )
}
