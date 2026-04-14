import { describe, it, expect, vi } from 'vitest'
import { resolveClientLinkByDocument } from '../proposals/repository.js'

describe('resolveClientLinkByDocument', () => {
  it('links proposal to exactly one active client match', async () => {
    const sql = vi.fn(async () => [{ id: 'client-1' }])
    const result = await resolveClientLinkByDocument(sql, '123.456.789-01')
    expect(result).toEqual({
      clientId: 'client-1',
      isConflicted: false,
      conflictReason: null,
    })
  })

  it('keeps client_id null when no active match exists', async () => {
    const sql = vi.fn(async () => [])
    const result = await resolveClientLinkByDocument(sql, '123.456.789-01')
    expect(result).toEqual({
      clientId: null,
      isConflicted: false,
      conflictReason: null,
    })
  })

  it('flags conflict when multiple active clients share same normalized document', async () => {
    const sql = vi.fn(async () => [{ id: 'a' }, { id: 'b' }])
    const result = await resolveClientLinkByDocument(sql, '12.345.678/0001-99')
    expect(result).toEqual({
      clientId: null,
      isConflicted: true,
      conflictReason: 'multiple_active_clients_same_document',
    })
  })

  it('does not query clients table when document is absent', async () => {
    const sql = vi.fn(async () => [])
    const result = await resolveClientLinkByDocument(sql, null)
    expect(result).toEqual({
      clientId: null,
      isConflicted: false,
      conflictReason: null,
    })
    expect(sql).not.toHaveBeenCalled()
  })
})
