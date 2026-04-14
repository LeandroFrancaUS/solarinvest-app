// src/components/clients/BulkImportPreviewModal.tsx
// Smart preview modal for the enterprise bulk client importer.

import React, { useCallback, useId, useMemo, useState } from 'react'
import type {
  AnalyzedImportRow,
  ConfidenceLevel,
  ImportStatus,
  MatchLevel,
  SuggestedAction,
} from '../../lib/clients/deduplication'

export type { AnalyzedImportRow }

export type FilterMode = 'all' | 'new' | 'duplicates' | 'valid'

interface BulkImportPreviewModalProps {
  rows: AnalyzedImportRow[]
  autoMerge: boolean
  isLoading: boolean
  onAutoMergeChange: (value: boolean) => void
  onRowSelectionChange: (rowIndex: number, selected: boolean) => void
  onRowActionChange: (rowIndex: number, action: SuggestedAction) => void
  onSelectAllValid: () => void
  onSelectAll: () => void
  onClearSelection: () => void
  onConfirm: () => void
  onClose: () => void
}

// ─── Badge helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<ImportStatus, string> = {
  new: 'Novo',
  existing: 'Existente',
  possible_duplicate: 'Possível duplicado',
}

const STATUS_CLASS: Record<ImportStatus, string> = {
  new: 'bulk-badge bulk-badge--new',
  existing: 'bulk-badge bulk-badge--existing',
  possible_duplicate: 'bulk-badge bulk-badge--duplicate',
}

const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
}

const CONFIDENCE_CLASS: Record<ConfidenceLevel, string> = {
  high: 'bulk-badge bulk-badge--high',
  medium: 'bulk-badge bulk-badge--medium',
  low: 'bulk-badge bulk-badge--low',
}

const MATCH_LEVEL_ICON: Record<MatchLevel, string> = {
  hard: '🔴',
  medium: '🟡',
  soft: '🟢',
  none: '⚪',
}

const ACTION_LABEL: Record<SuggestedAction, string> = {
  import: 'Importar',
  ignore: 'Ignorar',
  merge: 'Mesclar',
}

const FILTER_LABEL: Record<FilterMode, string> = {
  all: 'Todos',
  new: 'Apenas novos',
  duplicates: 'Apenas duplicados',
  valid: 'Apenas válidos',
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BulkImportPreviewModal({
  rows,
  autoMerge,
  isLoading,
  onAutoMergeChange,
  onRowSelectionChange,
  onRowActionChange,
  onSelectAllValid,
  onSelectAll,
  onClearSelection,
  onConfirm,
  onClose,
}: BulkImportPreviewModalProps) {
  const titleId = useId()
  const [filterMode, setFilterMode] = useState<FilterMode>('all')

  const filteredRows = useMemo(() => {
    switch (filterMode) {
      case 'new':
        return rows.filter((r) => r.dedupResult.status === 'new')
      case 'duplicates':
        return rows.filter((r) => r.dedupResult.status !== 'new')
      case 'valid':
        return rows.filter(
          (r) =>
            r.dedupResult.status === 'new' ||
            (r.dedupResult.status === 'possible_duplicate' &&
              r.dedupResult.matchLevel !== 'hard'),
        )
      default:
        return rows
    }
  }, [rows, filterMode])

  const summary = useMemo(() => {
    const total = rows.length
    const newCount = rows.filter((r) => r.dedupResult.status === 'new').length
    const existing = rows.filter((r) => r.dedupResult.matchLevel === 'hard').length
    const possible = rows.filter(
      (r) => r.dedupResult.matchLevel === 'medium' || r.dedupResult.matchLevel === 'soft',
    ).length
    const selected = rows.filter((r) => r.selected).length
    return { total, newCount, existing, possible, selected }
  }, [rows])

  const handleFilterChange = useCallback(
    (mode: FilterMode) => setFilterMode(mode),
    [],
  )

  return (
    <div
      className="bulk-import-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="bulk-import-modal">
        {/* ── Header ── */}
        <div className="bulk-import-modal__header">
          <div>
            <h2 id={titleId} className="bulk-import-modal__title">
              Pré-visualização da Importação
            </h2>
            <p className="bulk-import-modal__subtitle">
              Revise os dados antes de importar. Selecione os clientes desejados.
            </p>
          </div>
          <button
            type="button"
            className="ghost bulk-import-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {/* ── Summary bar ── */}
        <div className="bulk-import-modal__summary">
          <span className="bulk-badge bulk-badge--new">
            {summary.newCount} novo{summary.newCount !== 1 ? 's' : ''}
          </span>
          <span className="bulk-badge bulk-badge--existing">
            {summary.existing} existente{summary.existing !== 1 ? 's' : ''}
          </span>
          <span className="bulk-badge bulk-badge--duplicate">
            {summary.possible} {summary.possible !== 1 ? 'possíveis duplicados' : 'possível duplicado'}
          </span>
          <span className="bulk-import-modal__selected">
            {summary.selected} selecionado{summary.selected !== 1 ? 's' : ''} de {summary.total}
          </span>
        </div>

        {/* ── Auto-merge toggle ── */}
        <div className="bulk-import-modal__merge-toggle">
          <label className="bulk-import-modal__merge-label">
            <input
              type="checkbox"
              checked={autoMerge}
              onChange={(e) => onAutoMergeChange(e.target.checked)}
            />
            <span>
              Ativar merge automático{' '}
              <small>(preencher campos vazios em clientes existentes)</small>
            </span>
          </label>
        </div>

        {/* ── Filter tabs ── */}
        <div className="bulk-import-modal__filters" role="tablist" aria-label="Filtros de importação">
          {(Object.keys(FILTER_LABEL) as FilterMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={filterMode === mode}
              className={`bulk-import-modal__filter-btn${filterMode === mode ? ' bulk-import-modal__filter-btn--active' : ''}`}
              onClick={() => handleFilterChange(mode)}
            >
              {FILTER_LABEL[mode]}
            </button>
          ))}
        </div>

        {/* ── Bulk selection buttons ── */}
        <div className="bulk-import-modal__bulk-actions">
          <button type="button" className="ghost" onClick={onSelectAllValid}>
            ✅ Selecionar todos válidos
          </button>
          <button type="button" className="ghost" onClick={onSelectAll}>
            Selecionar todos
          </button>
          <button type="button" className="ghost" onClick={onClearSelection}>
            Limpar seleção
          </button>
        </div>

        {/* ── Table ── */}
        <div className="bulk-import-modal__table-wrapper">
          <table className="bulk-import-modal__table">
            <thead>
              <tr>
                <th scope="col" className="bulk-col-check">Sel.</th>
                <th scope="col" className="bulk-col-name">Nome</th>
                <th scope="col" className="bulk-col-doc">Documento</th>
                <th scope="col" className="bulk-col-uc">UC</th>
                <th scope="col" className="bulk-col-status">Status</th>
                <th scope="col" className="bulk-col-conf">Confiança</th>
                <th scope="col" className="bulk-col-action">Ação</th>
                <th scope="col" className="bulk-col-reason">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="bulk-import-modal__empty">
                    Nenhum cliente encontrado para o filtro selecionado.
                  </td>
                </tr>
              )}
              {filteredRows.map((row) => (
                <BulkImportPreviewRow
                  key={row.rowIndex}
                  row={row}
                  onSelectionChange={onRowSelectionChange}
                  onActionChange={onRowActionChange}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── */}
        <div className="bulk-import-modal__footer">
          <button type="button" className="ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={isLoading || summary.selected === 0}
            aria-busy={isLoading}
          >
            {isLoading
              ? 'Importando…'
              : `Importar ${summary.selected} cliente${summary.selected !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Row component ─────────────────────────────────────────────────────────────

interface BulkImportPreviewRowProps {
  row: AnalyzedImportRow
  onSelectionChange: (rowIndex: number, selected: boolean) => void
  onActionChange: (rowIndex: number, action: SuggestedAction) => void
}

function BulkImportPreviewRow({
  row,
  onSelectionChange,
  onActionChange,
}: BulkImportPreviewRowProps) {
  const { dedupResult } = row
  const isHardMatch = dedupResult.matchLevel === 'hard'

  return (
    <tr
      className={`bulk-row${isHardMatch ? ' bulk-row--existing' : ''}${row.selected ? ' bulk-row--selected' : ''}`}
    >
      {/* Checkbox */}
      <td className="bulk-col-check">
        <input
          type="checkbox"
          checked={row.selected}
          onChange={(e) => onSelectionChange(row.rowIndex, e.target.checked)}
          aria-label={`Selecionar ${row.name}`}
        />
      </td>

      {/* Name */}
      <td className="bulk-col-name">
        <span className="bulk-name">{row.name || <em>—</em>}</span>
        {dedupResult.existingClientName && (
          <small className="bulk-existing-name">
            → {dedupResult.existingClientName}
          </small>
        )}
      </td>

      {/* Document */}
      <td className="bulk-col-doc">
        <span>{row.document ?? '—'}</span>
      </td>

      {/* UC */}
      <td className="bulk-col-uc">
        <span>{row.uc ?? '—'}</span>
      </td>

      {/* Status */}
      <td className="bulk-col-status">
        <span className={STATUS_CLASS[dedupResult.status]}>
          {MATCH_LEVEL_ICON[dedupResult.matchLevel]}{' '}
          {STATUS_LABEL[dedupResult.status]}
        </span>
      </td>

      {/* Confidence */}
      <td className="bulk-col-conf">
        <span className={CONFIDENCE_CLASS[dedupResult.confidence]}>
          {CONFIDENCE_LABEL[dedupResult.confidence]}
        </span>
      </td>

      {/* Action */}
      <td className="bulk-col-action">
        <select
          value={row.userAction}
          onChange={(e) => onActionChange(row.rowIndex, e.target.value as SuggestedAction)}
          className="bulk-action-select"
          aria-label={`Ação para ${row.name}`}
        >
          {(Object.keys(ACTION_LABEL) as SuggestedAction[]).map((action) => (
            <option key={action} value={action}>
              {ACTION_LABEL[action]}
            </option>
          ))}
        </select>
      </td>

      {/* Reason */}
      <td className="bulk-col-reason">
        <small className="bulk-reason">{dedupResult.matchReason ?? '—'}</small>
      </td>
    </tr>
  )
}
