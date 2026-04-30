// src/components/clients/ExistingClientPicker.tsx
// Searchable dropdown that lets the user pick an already-registered client.
// When a client is selected the parent receives a ClientPickerRow so it can
// auto-fill registration fields; when the selection is cleared it receives null.

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { searchClientsForPicker, type ClientPickerRow } from '../../lib/api/clientsApi'
import { formatCpfCnpj } from '../../lib/format/document'

interface Props {
  /** Called whenever the selection changes. null means "no client selected". */
  onSelect: (client: ClientPickerRow | null) => void
}

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

export function ExistingClientPicker({ onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClientPickerRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<ClientPickerRow | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    let cancelled = false
    setLoading(true)
    searchClientsForPicker(debouncedQuery)
      .then((rows) => {
        if (!cancelled) {
          setResults(rows)
          setOpen(rows.length > 0)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [debouncedQuery])

  // Close dropdown when clicking outside.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => { document.removeEventListener('mousedown', handler) }
  }, [])

  const handleSelect = useCallback((client: ClientPickerRow) => {
    setSelected(client)
    setQuery('')
    setOpen(false)
    onSelect(client)
  }, [onSelect])

  const handleClear = useCallback(() => {
    setSelected(null)
    setQuery('')
    setResults([])
    onSelect(null)
  }, [onSelect])

  const displayDocument = (doc: string | null) =>
    doc ? formatCpfCnpj(doc) : ''

  return (
    <div ref={containerRef} style={{ position: 'relative', marginBottom: '1rem' }}>
      <label
        htmlFor="existing-client-picker"
        style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}
      >
        Selecionar cliente existente
      </label>

      {selected ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            border: '1px solid var(--color-border, #ccc)',
            borderRadius: '6px',
            background: 'var(--color-surface-2, #f9f9f9)',
          }}
        >
          <span style={{ flex: 1, fontSize: '0.9rem' }}>
            <strong>{selected.name}</strong>
            {selected.document ? ` — ${displayDocument(selected.document)}` : ''}
          </span>
          <button
            type="button"
            onClick={handleClear}
            aria-label="Remover seleção de cliente"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary, #666)',
              fontSize: '1rem',
              lineHeight: 1,
              padding: '0.1rem 0.25rem',
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          <input
            id="existing-client-picker"
            type="search"
            value={query}
            onChange={(e) => { setQuery(e.target.value) }}
            placeholder="Buscar por nome ou CPF/CNPJ..."
            autoComplete="off"
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
          {loading && (
            <span
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '0.8rem',
                color: 'var(--color-text-secondary, #888)',
              }}
            >
              …
            </span>
          )}
          {open && results.length > 0 && (
            <ul
              role="listbox"
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 100,
                margin: 0,
                padding: 0,
                listStyle: 'none',
                background: 'var(--color-surface, #fff)',
                border: '1px solid var(--color-border, #ccc)',
                borderRadius: '0 0 6px 6px',
                maxHeight: '260px',
                overflowY: 'auto',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            >
              {results.map((client) => (
                <li key={client.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => { handleSelect(client) }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 0.75rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      lineHeight: 1.4,
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.background =
                        'var(--color-surface-hover, #f0f0f0)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.background = 'none'
                    }}
                  >
                    <strong>{client.name}</strong>
                    {client.document && (
                      <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-secondary, #666)' }}>
                        {displayDocument(client.document)}
                      </span>
                    )}
                    {client.city && (
                      <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-secondary, #888)', fontSize: '0.8rem' }}>
                        {client.city}{client.state ? `/${client.state}` : ''}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
