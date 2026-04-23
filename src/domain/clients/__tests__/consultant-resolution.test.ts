// src/domain/clients/__tests__/consultant-resolution.test.ts
import { describe, it, expect } from 'vitest'
import {
  resolveClientConsultant,
  resolveDefaultConsultantForUser,
  getClientConsultantLabel,
  normalizeConsultantId,
} from '../consultant-resolution'
import type { ConsultantForResolution, ClientForConsultantResolution } from '../consultant-resolution'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const kim: ConsultantForResolution = {
  id: 3,
  full_name: 'Joaquim Amarildo de Oliveira',
  apelido: 'Kim',
  email: 'kim@example.com',
  linked_user_id: 'user-abc',
}

const claudio: ConsultantForResolution = {
  id: 7,
  full_name: 'Claudio Silva',
  apelido: null,
  email: 'claudio@example.com',
  linked_user_id: null,
}

const consultants = [kim, claudio]

// ─── normalizeConsultantId ────────────────────────────────────────────────────

describe('normalizeConsultantId', () => {
  it('returns null for null/undefined/empty', () => {
    expect(normalizeConsultantId(null)).toBeNull()
    expect(normalizeConsultantId(undefined)).toBeNull()
    expect(normalizeConsultantId('')).toBeNull()
    expect(normalizeConsultantId('  ')).toBeNull()
  })

  it('converts number to string', () => {
    expect(normalizeConsultantId(3)).toBe('3')
  })

  it('trims string', () => {
    expect(normalizeConsultantId(' 3 ')).toBe('3')
  })
})

// ─── resolveDefaultConsultantForUser ─────────────────────────────────────────

describe('resolveDefaultConsultantForUser', () => {
  it('matches by linked_user_id', () => {
    const result = resolveDefaultConsultantForUser({ id: 'user-abc', email: 'other@example.com' }, consultants)
    expect(result?.id).toBe(3)
  })

  it('matches by email (case-insensitive)', () => {
    const result = resolveDefaultConsultantForUser({ id: 'unknown-id', email: 'CLAUDIO@EXAMPLE.COM' }, consultants)
    expect(result?.id).toBe(7)
  })

  it('returns null when no match', () => {
    const result = resolveDefaultConsultantForUser({ id: 'unknown', email: 'nobody@example.com' }, consultants)
    expect(result).toBeNull()
  })

  it('returns null when currentUser is null', () => {
    expect(resolveDefaultConsultantForUser(null, consultants)).toBeNull()
  })

  it('returns null when consultants list is empty', () => {
    expect(resolveDefaultConsultantForUser({ id: 'user-abc' }, [])).toBeNull()
  })
})

// ─── resolveClientConsultant ─────────────────────────────────────────────────

describe('resolveClientConsultant', () => {
  // Test 1: new client + user with linked consultant → user's consultant
  it('1. new client + user linked to consultant → resolves user-match-default', () => {
    const client: ClientForConsultantResolution = {}
    const result = resolveClientConsultant({
      client,
      consultants,
      currentUser: { id: 'user-abc', email: 'kim@example.com' },
      isNewClient: true,
    })
    expect(result.source).toBe('user-match-default')
    expect(result.consultantId).toBe('3')
    expect(result.consultantNickname).toBe('Kim')
  })

  // Test 2: new client + no match → none
  it('2. new client + no auto-match → source=none', () => {
    const result = resolveClientConsultant({
      client: {},
      consultants,
      currentUser: { id: 'unknown', email: 'nobody@x.com' },
      isNewClient: true,
    })
    expect(result.source).toBe('none')
    expect(result.consultantId).toBeNull()
  })

  // Test 3: existing client with canonical consultant_id → preserves it
  it('3. existing client with consultant_id persisted → source=canonical', () => {
    const client: ClientForConsultantResolution = { consultant_id: '3' }
    const result = resolveClientConsultant({
      client,
      consultants,
      currentUser: { id: 'user-abc' },
      isNewClient: false,
    })
    expect(result.source).toBe('canonical')
    expect(result.consultantId).toBe('3')
    expect(result.consultantNickname).toBe('Kim')
  })

  // Test 3b: consultant_id as numeric (DB BIGINT returned as number)
  it('3b. consultant_id as number (BIGINT) → source=canonical', () => {
    const client: ClientForConsultantResolution = { consultant_id: 3 }
    const result = resolveClientConsultant({ client, consultants })
    expect(result.source).toBe('canonical')
    expect(result.consultantId).toBe('3')
  })

  // Test 4: existing client with null canonical + legacy metadata
  it('4. consultant_id=null + metadata.consultor_id set → source=legacy-metadata', () => {
    const client: ClientForConsultantResolution = {
      consultant_id: null,
      metadata: { consultor_id: '3', consultor_nome: 'Kim' },
    }
    const result = resolveClientConsultant({
      client,
      consultants,
      currentUser: { id: 'user-abc' },
      isNewClient: false,
    })
    expect(result.source).toBe('legacy-metadata')
    expect(result.consultantId).toBe('3')
    expect(result.consultantNickname).toBe('Kim')
  })

  // Test 5: user-match default does NOT apply to existing persisted clients
  it('5. existing client without consultant — user-match default is NOT applied', () => {
    const client: ClientForConsultantResolution = { consultant_id: null, metadata: {} }
    const result = resolveClientConsultant({
      client,
      consultants,
      currentUser: { id: 'user-abc', email: 'kim@example.com' },
      isNewClient: false,
    })
    expect(result.source).toBe('none')
    expect(result.consultantId).toBeNull()
  })

  // Test 6: canonical wins over metadata when both are set
  it('6. canonical takes priority over legacy metadata', () => {
    const client: ClientForConsultantResolution = {
      consultant_id: '7',
      metadata: { consultor_id: '3', consultor_nome: 'Kim (wrong)' },
    }
    const result = resolveClientConsultant({ client, consultants })
    expect(result.source).toBe('canonical')
    expect(result.consultantId).toBe('7')
  })

  // Test 7: null client → none
  it('7. null client → source=none', () => {
    const result = resolveClientConsultant({ client: null, consultants })
    expect(result.source).toBe('none')
  })
})

// ─── getClientConsultantLabel ─────────────────────────────────────────────────

describe('getClientConsultantLabel', () => {
  const byId = new Map<string, ConsultantForResolution>([
    ['3', kim],
    ['7', claudio],
  ])

  // Test 8: shows apelido (never full_name) from canonical ID
  it('8. shows apelido when consultant_id is resolved', () => {
    const label = getClientConsultantLabel({ consultant_id: '3' }, byId)
    expect(label).toBe('Kim')
  })

  // Test 9: falls back to metadata.consultor_nome when map is empty
  it('9. falls back to metadata.consultor_nome before "Sem consultor"', () => {
    const label = getClientConsultantLabel(
      { consultant_id: null, metadata: { consultor_nome: 'Kim' } },
      new Map(),
    )
    expect(label).toBe('Kim')
  })

  // Test 10: "Sem consultor" only when nothing is available
  it('10. shows "Sem consultor" when nothing is available', () => {
    const label = getClientConsultantLabel({ consultant_id: null, metadata: {} }, new Map())
    expect(label).toBe('Sem consultor')
  })

  // No full_name in list output — apelido or first name
  it('shows first name when apelido is null (Claudio case)', () => {
    const label = getClientConsultantLabel({ consultant_id: '7' }, byId)
    expect(label).toBe('Claudio')
  })

  // Resolves by legacy metadata consultor_id when canonical is null
  it('resolves via legacy metadata.consultor_id when canonical is null', () => {
    const label = getClientConsultantLabel(
      { consultant_id: null, metadata: { consultor_id: '3' } },
      byId,
    )
    expect(label).toBe('Kim')
  })
})
