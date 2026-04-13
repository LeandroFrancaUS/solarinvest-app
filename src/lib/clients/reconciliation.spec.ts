import { describe, expect, it } from 'vitest'
import {
  getClientStableKey,
  reconcileDeletedClients,
  shouldIgnoreSnapshot,
} from './reconciliation'

describe('clients reconciliation', () => {
  it('keeps client deleted when reload list contains stale snapshot data', () => {
    const deleted = new Set(['47'])
    const loaded = [{ id: '47', name: 'stale' }, { id: '99', name: 'active' }]
    const reconciled = reconcileDeletedClients(loaded, deleted)
    expect(reconciled.map((row) => row.id)).toEqual(['99'])
  })

  it('treats localId as stable key fallback', () => {
    expect(getClientStableKey({ localId: 'local-1' })).toBe('local-1')
  })

  it('ignores stale snapshots older than last delete reconciliation timestamp', () => {
    expect(shouldIgnoreSnapshot(1000, 2000)).toBe(true)
    expect(shouldIgnoreSnapshot(3000, 2000)).toBe(false)
    expect(shouldIgnoreSnapshot(null, 2000)).toBe(false)
  })
})
