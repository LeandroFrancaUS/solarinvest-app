// src/lib/clients/clientFilter.spec.ts
// Unit tests for the getFilteredClients() pure filter function.

import { describe, expect, it } from 'vitest'
import { getFilteredClients } from './clientFilter'

const ADMIN_ID = 'ae1f8d08-a591-454f-915b-ba003b120f75'
const LAIENY_ID = '2eca0fe5-d4d8-4f9b-8fbb-02616e08aefa'
const OTHER_ID = 'cccc0000-0000-0000-0000-000000000001'

const clients = [
  { id: '1', createdByUserId: LAIENY_ID, deletedAt: null },
  { id: '2', createdByUserId: ADMIN_ID, deletedAt: null },
  { id: '3', createdByUserId: ADMIN_ID, deletedAt: '2026-04-12T00:00:00Z' },
  { id: '4', createdByUserId: OTHER_ID, deletedAt: null },
  { id: '5', createdByUserId: null, deletedAt: null },
  { id: '6', createdByUserId: LAIENY_ID, deletedAt: null },
]

describe('getFilteredClients', () => {
  it('returns all active clients when filter is "all"', () => {
    const result = getFilteredClients(clients, 'all')
    expect(result.map((c) => c.id)).toEqual(['1', '2', '4', '5', '6'])
  })

  it('returns only active clients for admin filter', () => {
    const result = getFilteredClients(clients, ADMIN_ID)
    expect(result.map((c) => c.id)).toEqual(['2'])
  })

  it('returns only active clients for laieny filter', () => {
    const result = getFilteredClients(clients, LAIENY_ID)
    expect(result.map((c) => c.id)).toEqual(['1', '6'])
  })

  it('excludes clients with deletedAt != null regardless of filter', () => {
    // client id=3 has admin's created_by_user_id but is deleted
    const result = getFilteredClients(clients, ADMIN_ID)
    expect(result.find((c) => c.id === '3')).toBeUndefined()
  })

  it('excludes deleted clients even when filter is "all"', () => {
    const result = getFilteredClients(clients, 'all')
    expect(result.find((c) => c.id === '3')).toBeUndefined()
  })

  it('returns empty array when no clients match the filter', () => {
    const result = getFilteredClients(clients, 'unknown-user-id-xyz')
    expect(result).toEqual([])
  })

  it('handles empty client list without throwing', () => {
    expect(getFilteredClients([], 'all')).toEqual([])
    expect(getFilteredClients([], ADMIN_ID)).toEqual([])
  })

  it('does not filter by user_id or owner_user_id', () => {
    const withUserIdOnly = [
      { id: '10', createdByUserId: null, deletedAt: null, user_id: ADMIN_ID },
      { id: '11', createdByUserId: null, deletedAt: null, owner_user_id: ADMIN_ID },
    ]
    // Should return empty because createdByUserId is null, not ADMIN_ID
    const result = getFilteredClients(withUserIdOnly, ADMIN_ID)
    expect(result).toEqual([])
  })

  it('does not mutate the original array', () => {
    const original = [...clients]
    getFilteredClients(clients, ADMIN_ID)
    expect(clients).toEqual(original)
  })

  it('returns all active records when selectedConsultorId is empty string', () => {
    const result = getFilteredClients(clients, '')
    expect(result.map((c) => c.id)).toEqual(['1', '2', '4', '5', '6'])
  })

  it('handles records where deletedAt is undefined (treated as active)', () => {
    const noDeletedAt = [
      { id: '20', createdByUserId: ADMIN_ID },
      { id: '21', createdByUserId: LAIENY_ID },
    ]
    const result = getFilteredClients(noDeletedAt, 'all')
    expect(result.map((c) => c.id)).toEqual(['20', '21'])
  })
})
