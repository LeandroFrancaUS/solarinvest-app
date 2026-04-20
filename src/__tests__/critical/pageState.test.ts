/**
 * Tests for the Page State Persistence service.
 *
 * Validates:
 *   - Save/load/clear page state by route key
 *   - TTL-based expiration
 *   - Schema version rejection
 *   - Navigation state convenience helpers
 *   - clearAllPageStates on logout
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  savePageState,
  loadPageState,
  clearPageState,
  clearAllPageStates,
  saveNavigationState,
  loadNavigationState,
  clearNavigationState,
} from '../../lib/persist/pageState'

describe('pageState persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  // ─── savePageState / loadPageState ──────────────────────────────────────────

  it('saves and loads page state for a given route key', () => {
    savePageState('proposal-leasing', { formData: { nome: 'Leandro' }, tab: 'leasing' })
    const result = loadPageState<{ formData: { nome: string }; tab: string }>('proposal-leasing')
    expect(result).toEqual({ formData: { nome: 'Leandro' }, tab: 'leasing' })
  })

  it('returns null for non-existent keys', () => {
    expect(loadPageState('nonexistent')).toBeNull()
  })

  it('returns null for expired entries', () => {
    savePageState('old-route', { stale: true })

    // Manually manipulate the timestamp to simulate an old entry
    const key = 'solarinvest:pageState:old-route'
    const raw = window.localStorage.getItem(key)!
    const envelope = JSON.parse(raw) as { ts: string; [key: string]: unknown }
    envelope.ts = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() // 48 hours ago
    window.localStorage.setItem(key, JSON.stringify(envelope))

    // Default TTL is 24 hours, so this should be expired
    expect(loadPageState('old-route')).toBeNull()
    // Should also clean up the expired entry
    expect(window.localStorage.getItem(key)).toBeNull()
  })

  it('returns null when schema version mismatches', () => {
    const key = 'solarinvest:pageState:versioned'
    window.localStorage.setItem(
      key,
      JSON.stringify({ v: 999, ts: new Date().toISOString(), data: { ok: true } }),
    )
    expect(loadPageState('versioned')).toBeNull()
  })

  it('supports custom TTL', () => {
    savePageState('short-ttl', { data: 'test' })

    // Manually set timestamp to 2 hours ago
    const key = 'solarinvest:pageState:short-ttl'
    const raw = window.localStorage.getItem(key)!
    const envelope = JSON.parse(raw) as { ts: string; [key: string]: unknown }
    envelope.ts = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    window.localStorage.setItem(key, JSON.stringify(envelope))

    // With 1 hour TTL, should be expired
    expect(loadPageState('short-ttl', 60 * 60 * 1000)).toBeNull()

    // Re-save fresh
    savePageState('short-ttl', { data: 'test2' })
    // With 3 hour TTL, should still be valid
    expect(loadPageState<{ data: string }>('short-ttl', 3 * 60 * 60 * 1000)).toEqual({
      data: 'test2',
    })
  })

  // ─── clearPageState ────────────────────────────────────────────────────────

  it('clears a specific route state', () => {
    savePageState('route-a', { a: 1 })
    savePageState('route-b', { b: 2 })

    clearPageState('route-a')

    expect(loadPageState('route-a')).toBeNull()
    expect(loadPageState<{ b: number }>('route-b')).toEqual({ b: 2 })
  })

  // ─── clearAllPageStates ────────────────────────────────────────────────────

  it('clears all page states on logout', () => {
    savePageState('route-1', { x: 1 })
    savePageState('route-2', { y: 2 })
    window.localStorage.setItem('unrelated-key', 'preserve-me')

    clearAllPageStates()

    expect(loadPageState('route-1')).toBeNull()
    expect(loadPageState('route-2')).toBeNull()
    expect(window.localStorage.getItem('unrelated-key')).toBe('preserve-me')
  })

  // ─── Navigation state helpers ──────────────────────────────────────────────

  it('saves and loads navigation state', () => {
    saveNavigationState({
      activePage: 'crm',
      activeTab: 'leasing',
      simulacoesSection: 'analise',
      openEntityId: 'client-123',
    })

    const nav = loadNavigationState()
    expect(nav).toEqual({
      activePage: 'crm',
      activeTab: 'leasing',
      simulacoesSection: 'analise',
      openEntityId: 'client-123',
    })
  })

  it('clears navigation state', () => {
    saveNavigationState({ activePage: 'dashboard', activeTab: 'vendas' })
    clearNavigationState()
    expect(loadNavigationState()).toBeNull()
  })

  // ─── Edge cases ────────────────────────────────────────────────────────────

  it('handles corrupted localStorage gracefully', () => {
    window.localStorage.setItem('solarinvest:pageState:corrupted', 'not-json{{{')
    expect(loadPageState('corrupted')).toBeNull()
  })

  it('handles localStorage.setItem failure gracefully', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceededError')
    }
    // Should not throw
    expect(() => savePageState('overflow', { big: 'data' })).not.toThrow()
    Storage.prototype.setItem = originalSetItem
  })
})
