import type { CSSProperties } from 'react'

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
  const showLinkedCode = Boolean(displayCode && isClickableCode)
  const iconButtonStyle: CSSProperties = {
    width: 36,
    height: 36,
    minWidth: 36,
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: '0 0 auto',
    lineHeight: 1,
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {showLinkedCode ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onPreview}
            className="pf-btn pf-btn-link"
            style={{ justifyContent: 'flex-start', fontWeight: 600, padding: 0 }}
          >
            {displayCode}
          </button>
          {editMode ? (
            <button
              type="button"
              className="pf-btn pf-btn-edit"
              onClick={onOpenSearch}
              title="Buscar ou atualizar proposta"
              aria-label="Buscar ou atualizar proposta"
              style={iconButtonStyle}
            >
              🔎
            </button>
          ) : null}
          {editMode && displayCode ? (
            <button
              type="button"
              className="pf-btn pf-btn-cancel"
              onClick={onClear}
              title="Remover proposta"
              aria-label="Remover proposta"
              style={iconButtonStyle}
            >
              🗑️
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {editMode ? (
              <button
                type="button"
                className="pf-btn pf-btn-edit"
                onClick={onOpenSearch}
                title="Buscar ou atualizar proposta"
                aria-label="Buscar ou atualizar proposta"
                style={iconButtonStyle}
              >
                🔎
              </button>
            ) : null}
            {editMode && displayCode ? (
              <button
                type="button"
                className="pf-btn pf-btn-cancel"
                onClick={onClear}
                title="Remover proposta"
                aria-label="Remover proposta"
                style={iconButtonStyle}
              >
                🗑️
              </button>
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
        </>
      )}
    </div>
  )
}
