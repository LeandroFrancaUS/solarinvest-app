/**
 * Table — Componente de tabela padronizado do Design System SolarInvest
 */

import React from 'react'

export interface TableColumn<T> {
  key: string
  header: React.ReactNode
  accessor: (row: T) => React.ReactNode
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
  width?: string
}

export interface TableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSort?: (key: string) => void
  emptyMessage?: string
  className?: string
  stickyHeader?: boolean
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  sortKey,
  sortDir,
  onSort,
  emptyMessage = 'Nenhum registro encontrado',
  className = '',
  stickyHeader = false,
}: TableProps<T>) {
  const sortArrow = (key: string) => {
    if (sortKey !== key) return null
    return (
      <span className="ml-1 text-ds-primary" aria-hidden="true">
        {sortDir === 'asc' ? '▲' : '▼'}
      </span>
    )
  }

  return (
    <div className={`w-full overflow-x-auto rounded-xl border border-ds-border ${className}`}>
      <table className="w-full text-left text-sm text-ds-text-secondary">
        <thead
          className={`border-b border-ds-border bg-ds-surface/95 text-xs font-semibold uppercase tracking-wide text-ds-text-muted backdrop-blur-sm ${
            stickyHeader ? 'sticky top-0 z-10' : ''
          }`}
        >
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={[
                  'px-4 py-3',
                  col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                  col.sortable && onSort ? 'cursor-pointer select-none hover:text-ds-text-primary transition-colors' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={col.width ? { width: col.width } : undefined}
                onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                aria-sort={
                  col.sortable && sortKey === col.key
                    ? sortDir === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
              >
                {col.header}
                {col.sortable ? sortArrow(col.key) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-10 text-center text-ds-text-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                className="border-b border-ds-border/50 transition-colors hover:bg-ds-surface-hover/60"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={[
                      'px-4 py-2.5 text-ds-text-secondary',
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                          ? 'text-center'
                          : 'text-left',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
